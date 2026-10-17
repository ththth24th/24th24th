import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HANGAR, PAD, PUMP } from '../core/config';
import { heightAt } from './Terrain';

type Collider = { x: number; z: number; r: number; height: number };
type Transform = { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number };

/** Small material batches keep the detailed farm inexpensive to render. */
class GeometryBatch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geometry: THREE.BufferGeometry, material: THREE.Material, t: Transform = {}) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0));
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), q, new THREE.Vector3(1, 1, 1)));
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (nonIndexed !== geometry) geometry.dispose();
    const parts = this.parts.get(material) || [];
    parts.push(nonIndexed); this.parts.set(material, parts);
  }
  box(material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rz = 0) {
    this.add(new THREE.BoxGeometry(w, h, d), material, { x, y, z, ry, rz });
  }
  cylinder(material: THREE.Material, top: number, bottom: number, h: number, x: number, y: number, z: number, segments = 16, rx = 0, rz = 0) {
    this.add(new THREE.CylinderGeometry(top, bottom, h, segments), material, { x, y, z, rx, rz });
  }
  rod(material: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, radius: number, segments = 8) {
    const delta = b.clone().sub(a), geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), segments);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    const mid = a.clone().add(b).multiplyScalar(.5);
    this.add(geometry, material, { x: mid.x, y: mid.y, z: mid.z });
  }
  flush(parent: THREE.Object3D) {
    for (const [material, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false);
      if (geometry) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = !material.transparent; mesh.receiveShadow = true;
        parent.add(mesh);
      }
      parts.forEach(g => g.dispose());
    }
    this.parts.clear();
  }
}

function signTexture(title: string, subtitle: string) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f0e9d5'; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#33483c'; ctx.lineWidth = 8; ctx.strokeRect(12, 12, 1000, 232);
  ctx.fillStyle = '#263e32'; ctx.textAlign = 'center';
  ctx.font = 'bold 100px Georgia, serif'; ctx.fillText(title, 512, 128);
  ctx.font = '25px Arial, sans-serif'; ctx.fillText(subtitle, 512, 190);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; return texture;
}

export function buildStructures(scene: THREE.Scene): { colliders: Collider[]; update: (dt: number, time: number, daylight: number) => void; setTechOnline: (online: boolean) => void } {
  const farm = new THREE.Group(); farm.name = 'Agro Nova farm'; scene.add(farm);
  const batch = new GeometryBatch();
  const standard = (color: THREE.ColorRepresentation, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const m = {
    red: standard('#a83d2e'), redShadow: standard('#792b24'), trim: standard('#e9ddbd'),
    wood: standard('#9b8055'), roof: standard('#354c50', .48, .5), metal: standard('#a4afb0', .36, .75),
    darkMetal: standard('#425052', .45, .65), dark: standard('#172526'), concrete: standard('#aaa492'),
    gravel: standard('#aca58d'), white: standard('#eee8d9'), green: standard('#527a39'),
    blue: standard('#427b89', .4, .35), yellow: standard('#edb73d', .5, .15), rubber: standard('#242725', .98),
    window: new THREE.MeshStandardMaterial({color:'#6a9a9c',roughness:.18,metalness:.55}),
    glass: new THREE.MeshStandardMaterial({color:'#8eb8a6',roughness:.23,metalness:.08,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide}),
    light: new THREE.MeshStandardMaterial({color:'#fff4cb',emissive:'#ffd58c',emissiveIntensity:0}),
    windowGlow: new THREE.MeshStandardMaterial({color:'#d6c499',emissive:'#ffbd66',emissiveIntensity:0,roughness:.3}),
    pad: standard('#56605b', .93), paint: standard('#d8ddc2', .87),
    solar: standard('#233e55', .23, .48),
    tech: new THREE.MeshStandardMaterial({color:'#263c35',emissive:'#64ff9a',emissiveIntensity:0,roughness:.3}),
  };
  const colliders: Collider[] = [];
  const lamps: THREE.PointLight[] = [];
  let techOnline=false;
  const v = (x:number,y:number,z:number) => new THREE.Vector3(x,y,z);
  const roof = (x:number, z:number, base:number, w:number, d:number, wall:number, rise:number, material:THREE.Material) => {
    const span=w/2+.6, angle=Math.atan2(rise, w/2), length=span/Math.cos(angle);
    for (const side of [-1,1]) {
      batch.box(material,length,.27,d+1.3,x+side*span/2,base+wall+rise/2,z,0,-side*angle);
      // Folded metal seams catch the low evening light.
      for (let dz=-d/2;dz<=d/2;dz+=1.4) batch.box(m.darkMetal,length,.055,.045,x+side*span/2,base+wall+rise/2+.17,z+dz,0,-side*angle);
    }
    batch.cylinder(m.darkMetal,.16,.16,d+1.45,x,base+wall+rise+.14,z,12,Math.PI/2);
  };
  const gable = (x:number,z:number,base:number,w:number,wall:number,rise:number,material:THREE.Material) => {
    const shape = new THREE.Shape(); shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,rise);shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});
    batch.add(geo,material,{x,y:base+wall,z:z-.09});
  };
  const window = (x:number,y:number,z:number,w=1.4,h=1.7,ry=0,lit=false) => {
    batch.box(m.trim,w+.23,h+.23,.17,x,y,z,ry);
    batch.box(lit?m.windowGlow:m.window,w,h,.19,x,y,z,ry);
    batch.box(m.trim,.075,h,.22,x,y,z,ry);
    batch.box(m.trim,w,.075,.22,x,y,z,ry);
  };
  const addLamp = (x:number,z:number,h=5.8) => {
    const y=heightAt(x,z);
    batch.cylinder(m.darkMetal,.075,.12,h,x,y+h/2,z,10);
    batch.rod(m.darkMetal,v(x,y+h-.15,z),v(x+.8,y+h+.1,z),.065);
    batch.box(m.darkMetal,.75,.16,.42,x+.8,y+h+.1,z);
    batch.box(m.light,.58,.045,.3,x+.8,y+h,z);
    const light=new THREE.PointLight('#ffdda0',0,21,2); light.position.set(x+.8,y+h-.3,z);farm.add(light);lamps.push(light);
  };

  // Main barn: corrugated timber walls, a working-size sliding door, and a ventilated roof.
  {
    const x=HANGAR.x,z=HANGAR.z,y=heightAt(x,z),w=26,d=20,wall=8,rise=4;
    batch.box(m.concrete,w+.8,.45,d+.8,x,y+.22,z);
    batch.box(m.red,w,wall,d,x,y+wall/2+.3,z);
    for (const side of [-1,1]) {
      for (let dz=-d/2+.45;dz<d/2;dz+=.8) batch.box(m.redShadow,.08,wall-.25,.085,x+side*(w/2+.035),y+wall/2+.4,z+dz);
      for(let dx=-w/2+.5;dx<w/2;dx+=.8) batch.box(m.redShadow,.075,wall-.25,.08,x+dx,y+wall/2+.4,z+side*(d/2+.035));
      gable(x,z+side*d/2,y+.3,w,wall,rise,m.red);
      batch.box(m.trim,w+.3,.22,.25,x,y+wall+.3,z+side*(d/2+.1));
      for(const dx of [-w/2,w/2]) batch.box(m.trim,.3,wall,.3,x+dx,y+wall/2+.3,z+side*d/2);
    }
    roof(x,z,y+.3,w,d,wall,rise,m.roof);
    batch.box(m.dark,10.5,6.3,.2,x,y+3.4,z-d/2-.09);
    for (const dx of [-2.55,2.55]) {
      batch.box(m.redShadow,5.05,6.1,.18,x+dx,y+3.4,z-d/2-.25);
      for (let i=-2;i<=2;i++) batch.box(m.red,.09,5.9,.07,x+dx+i,y+3.4,z-d/2-.39);
      batch.box(m.trim,4.9,.18,.08,x+dx,y+.48,z-d/2-.4);
      batch.box(m.trim,4.9,.18,.08,x+dx,y+6.36,z-d/2-.4);
      batch.box(m.trim,.17,6,.08,x+dx-2.4,y+3.4,z-d/2-.4);
      batch.box(m.trim,.17,6,.08,x+dx+2.4,y+3.4,z-d/2-.4);
      batch.rod(m.trim,v(x+dx-2.3,y+.65,z-d/2-.45),v(x+dx+2.3,y+6.2,z-d/2-.45),.075);
      batch.rod(m.trim,v(x+dx+2.3,y+.65,z-d/2-.45),v(x+dx-2.3,y+6.2,z-d/2-.45),.075);
      batch.box(m.darkMetal,.12,.7,.18,x+dx+(dx<0?2:-2),y+3.4,z-d/2-.55);
    }
    batch.box(m.darkMetal,12,.13,.2,x,y+6.7,z-d/2-.5);
    for(const dx of [-9,9])window(x+dx,y+4.9,z-d/2-.15,2.1,2.2);
    for(const dz of [-5,3,7])window(x-w/2-.15,y+4.4,z+dz,2,2,Math.PI/2);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.25),new THREE.MeshStandardMaterial({map:signTexture('AGRO NOVA','PRECISION FARMING  /  EST. 2026'),roughness:.75}));
    sign.position.set(x,y+9.45,z-d/2-.2);sign.rotation.y=Math.PI;farm.add(sign);
    for(const dz of [-5.7,5.7]) {
      batch.box(m.darkMetal,2.2,.9,2.2,x,y+wall+rise+.65,z+dz);
      batch.box(m.roof,2.9,.23,2.9,x,y+wall+rise+1.23,z+dz);
      for (let i=0;i<4;i++)batch.box(m.metal,2.25,.07,.12,x,y+wall+rise+.34+i*.2,z+dz-1.12);
    }
    // Straw bales and stacked timber beside the apron.
    for(let i=0;i<5;i++) {
      const bx=x+17+(i%2)*2.25,bz=z+5+Math.floor(i/2)*2.15;
      batch.cylinder(m.yellow,1.05,1.05,2,bx,y+1.08,bz,16,Math.PI/2);
      for(const dz of [-.73,.73])batch.add(new THREE.TorusGeometry(1.06,.035,4,18),m.wood,{x:bx,y:y+1.08,z:bz+dz});
    }
    colliders.push({x,z,r:16,height:13});
  }

  // Family farmhouse with a covered porch and a small kitchen garden.
  {
    const x=0,z=102,y=heightAt(x,z),w=14,d=11,wall=6.5;
    batch.box(m.concrete,w+.5,.5,d+.5,x,y+.25,z);
    batch.box(m.white,w,wall,d,x,y+wall/2+.5,z);
    for(const side of [-1,1]) {
      gable(x,z+side*d/2,y+.5,w,wall,3.4,m.white);
      for(let h=1;h<6.5;h+=.42)batch.box(m.trim,w,.045,.04,x,y+h,z+side*(d/2+.03));
    }
    roof(x,z,y+.5,w,d,wall,3.4,m.roof);
    for(const dx of [-4.4,4.4]) {
      window(x+dx,y+3.1,z-d/2-.14,2,2.3,0,true);
      for(const side of [-1,1])batch.box(m.green,.5,2.45,.16,x+dx+side*1.36,y+3.1,z-d/2-.17);
    }
    batch.box(m.wood,1.7,3.3,.25,x,y+2.1,z-d/2-.16);
    batch.box(m.windowGlow,1.25,1,.07,x,y+2.85,z-d/2-.33);
    batch.cylinder(m.yellow,.08,.08,.14,x+.56,y+1.9,z-d/2-.35,8,Math.PI/2);
    batch.box(m.wood,11,.3,3.7,x,y+.6,z-d/2-1.85);
    batch.box(m.roof,11.6,.2,4.1,x,y+4.75,z-d/2-1.8,0,0);
    for(const dx of [-5,5]) {
      batch.box(m.trim,.24,4.2,.24,x+dx,y+2.7,z-d/2-3.35);
      batch.box(m.trim,.11,.16,3.1,x+dx,y+1.9,z-d/2-1.85);
      for(let k=0;k<6;k++)batch.box(m.trim,.09,1.15,.09,x+dx,y+1.3,z-d/2-.5-k*.5);
    }
    for(let i=0;i<3;i++)batch.box(m.concrete,3.1-i*.25,.2,1.1,x,y+.15+i*.18,z-d/2-4.25+i*.6);
    batch.box(m.redShadow,1.4,4,1.5,x+4.2,y+9.2,z+2.5);
    batch.box(m.concrete,1.7,.2,1.8,x+4.2,y+11.3,z+2.5);
    for(let i=0;i<3;i++) {
      batch.box(m.wood,1.7,.55,4.8,-12-i*2.3,y+.3,103);
      batch.box(m.gravel,1.45,.12,4.55,-12-i*2.3,y+.63,103);
      for(let j=0;j<8;j++)batch.add(new THREE.SphereGeometry(.22,5,4),m.green,{x:-12-i*2.3,y:y+.87,z:101.1+j*.54});
    }
    colliders.push({x,z,r:9,height:11});
  }

  // Riveted grain silos, external hoops and a connecting auger.
  for(let i=0;i<3;i++) {
    const positions=[[68,105],[75,114],[65,114]];
    const [x,z]=positions[i],y=heightAt(x,z),r=i===1?3.6:3.1,h=i===1?14:11;
    batch.cylinder(m.concrete,r+.5,r+.7,.5,x,y+.25,z,24);
    batch.cylinder(m.metal,r,r,h,x,y+h/2+.5,z,32);
    batch.cylinder(m.roof,.06,r+.18,2.8,x,y+h+1.9,z,24);
    for(let ring=1;ring<h;ring+=1.2)batch.add(new THREE.TorusGeometry(r+.025,.035,5,32),m.darkMetal,{x,y:y+ring+.5,z,rx:Math.PI/2});
    for(let a=0;a<12;a++) {
      const angle=a*Math.PI/6;
      batch.cylinder(m.darkMetal,.025,.025,h,x+Math.cos(angle)*(r+.03),y+h/2+.5,z+Math.sin(angle)*(r+.03),5);
    }
    const lx=x-r-.3;
    for(const offset of [-.32,.32])batch.cylinder(m.darkMetal,.045,.045,h+1,lx+offset,y+(h+1)/2,z,6);
    for(let rung=.7;rung<h+1;rung+=.42)batch.box(m.metal,.72,.055,.07,lx,y+rung,z);
    batch.box(m.darkMetal,1.2,1.8,.13,x,y+1.5,z-r-.06);
    colliders.push({x,z,r:r+.5,height:h+3.5});
  }
  batch.rod(m.metal,v(68,heightAt(68,105)+13,105),v(75,heightAt(75,114)+17,114),.22,12);

  // Long glasshouses with fine arched steel ribs and planting benches.
  for(let k=0;k<2;k++) {
    const x=-25+k*10,z=80,y=heightAt(x,z),w=7,d=18,r=3.5;
    batch.box(m.concrete,w+.35,.3,d+.35,x,y+.15,z);
    batch.box(m.green,w-.6,.4,d-1,x,y+.45,z);
    const glassGeo=new THREE.CylinderGeometry(r,r,d,16,1,true,0,Math.PI);
    // A half-cylinder rotated so its arch rises above the planting beds.
    glassGeo.rotateZ(Math.PI/2);glassGeo.rotateY(Math.PI/2);
    batch.add(glassGeo,m.glass,{x,y:y+.5,z});
    for(let dz=-d/2;dz<=d/2+.01;dz+=2) {
      for(let a=0;a<12;a++) {
        const a0=a*Math.PI/12,a1=(a+1)*Math.PI/12;
        batch.rod(m.white,v(x+Math.cos(a0)*r,y+.5+Math.sin(a0)*r,z+dz),v(x+Math.cos(a1)*r,y+.5+Math.sin(a1)*r,z+dz),.045);
      }
    }
    for(const side of [-1,0,1])batch.rod(m.white,v(x+side*r,y+.55+(side===0?r:0),z-d/2),v(x+side*r,y+.55+(side===0?r:0),z+d/2),.055);
    for(const dz of [-d/2,d/2]) {
      batch.box(m.glass,6.8,2.4,.05,x,y+1.7,z+dz);
      batch.box(m.white,1.65,.09,.11,x,y+2.7,z+dz);
      for(const dx of [-.8,.8])batch.box(m.white,.08,2.3,.11,x+dx,y+1.6,z+dz);
    }
    for(const dx of [-2,2])for(let j=0;j<16;j++)batch.add(new THREE.SphereGeometry(.34,6,4),m.green,{x:x+dx,y:y+.95,z:z-d/2+1+j});
    colliders.push({x,z,r:10,height:4.2});
  }

  // Charging pad and its inset guidance lamps.
  {
    const x=PAD.x,z=PAD.z,y=heightAt(x,z)+.05;
    batch.cylinder(m.concrete,9.2,9.4,.25,x,y+.04,z,64);
    batch.cylinder(m.pad,8.65,8.65,.28,x,y+.1,z,64);
    batch.add(new THREE.RingGeometry(6.4,6.65,64),m.paint,{x,y:y+.251,z,rx:-Math.PI/2});
    for(const dx of [-1.65,1.65])batch.box(m.paint,.6,.025,4.6,x+dx,y+.263,z);
    batch.box(m.paint,3.9,.025,.6,x,y+.263,z);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      batch.box(m.light,.2,.06,.75,x+Math.sin(a)*8.45,y+.29,z+Math.cos(a)*8.45,-a);
    }
    batch.box(m.darkMetal,1.2,2.5,.9,x-9.5,y+1.2,z);
    batch.box(m.blue,.85,1.65,.08,x-9.5,y+1.5,z-.5);
    batch.box(m.light,.55,.2,.05,x-9.5,y+2,z-.55);
    batch.box(m.tech,.65,.83,.04,x-9.5,y+1.35,z-.56);
    batch.rod(m.dark,v(x-9.2,y+.4,z),v(x-7.5,y+.2,z),.09);
  }

  // River pump station with a pressure gauge and delivery pipes.
  {
    const x=PUMP.x,z=PUMP.z,y=heightAt(x,z);
    batch.box(m.concrete,6,.35,5,x,y+.18,z);
    batch.box(m.darkMetal,3.6,.35,2.2,x,y+.58,z);
    batch.cylinder(m.blue,.9,.9,2.5,x,y+1.55,z,20,0,Math.PI/2);
    batch.cylinder(m.darkMetal,.7,.7,.8,x+1.7,y+1.55,z,20,0,Math.PI/2);
    for(let i=0;i<8;i++)batch.add(new THREE.TorusGeometry(.91,.035,4,20),m.metal,{x:x-1.1+i*.3,y:y+1.55,z,ry:Math.PI/2});
    batch.rod(m.metal,v(x+1.9,y+1.55,z),v(x+10.5,y+1.55,z),.25,12);
    batch.rod(m.metal,v(x+10.5,y+1.55,z),v(x+10.5,-.6,z),.25,12);
    batch.rod(m.blue,v(x-1.8,y+1.5,z),v(x-4.2,y+1.5,z),.22,12);
    batch.rod(m.blue,v(x-4.2,y+1.5,z),v(x-4.2,y+.1,z-4.5),.22,12);
    batch.cylinder(m.darkMetal,.28,.28,.18,x,y+2.6,z,16,Math.PI/2);
    batch.cylinder(m.white,.23,.23,.2,x,y+2.6,z-.03,16,Math.PI/2);
    batch.box(m.red,.03,.25,.025,x+.05,y+2.64,z-.14,0,-.6);
    batch.box(m.darkMetal,1,2,.8,x-2,y+1.3,z+1.5);
    batch.box(m.yellow,.68,.55,.035,x-2,y+1.65,z+1.08);
    colliders.push({x,z,r:3,height:3.3});
  }

  // The final precision-farming upgrade powers the array controller and radio beacon.
  {
    const y=heightAt(18,110);
    for(let row=0;row<2;row++)for(let col=0;col<3;col++) {
      const x=12+col*3.25,z=110+row*3.4;
      batch.cylinder(m.darkMetal,.08,.08,1.5,x,y+.75,z,8);
      batch.add(new THREE.BoxGeometry(3,.14,2.6),m.metal,{x,y:y+1.55,z,rx:-.27});
      batch.add(new THREE.BoxGeometry(2.8,.05,2.4),m.solar,{x,y:y+1.65,z,rx:-.27});
      for(let grid=-1;grid<=1;grid++)batch.add(new THREE.BoxGeometry(.02,.06,2.4),m.metal,{x:x+grid*.7,y:y+1.69,z,rx:-.27});
    }
    batch.box(m.darkMetal,1.2,1.5,.7,23,y+.75,112);
    batch.box(m.tech,.7,.2,.05,23,y+1.15,111.62);
    const ax=HANGAR.x+7,az=HANGAR.z+4,ay=heightAt(ax,az)+10.1;
    batch.cylinder(m.darkMetal,.055,.1,4.4,ax,ay+2.2,az,8);
    for(const h of [1,1.7,2.4])batch.box(m.metal,2.5-h*.4,.055,.07,ax,ay+h,az);
    batch.add(new THREE.SphereGeometry(.22,10,6),m.tech,{x:ax,y:ay+4.5,z:az});
  }

  // Farm boundary: split timber rails, gate opening, and overhead utility cable.
  const fence=(ax:number,az:number,bx:number,bz:number) => {
    const length=Math.hypot(bx-ax,bz-az),segments=Math.ceil(length/4),angle=Math.atan2(bx-ax,bz-az);
    for(let i=0;i<=segments;i++) {
      const t=i/segments,x=THREE.MathUtils.lerp(ax,bx,t),z=THREE.MathUtils.lerp(az,bz,t),y=heightAt(x,z);
      batch.box(m.wood,.19,1.8,.19,x,y+.9,z,angle);
      batch.cylinder(m.trim,.15,.15,.07,x,y+1.83,z,4);
    }
    for(let i=0;i<segments;i++)for(const h of [.65,1.3]) {
      const a=i/segments,b=(i+1)/segments;
      const x1=THREE.MathUtils.lerp(ax,bx,a),z1=THREE.MathUtils.lerp(az,bz,a),x2=THREE.MathUtils.lerp(ax,bx,b),z2=THREE.MathUtils.lerp(az,bz,b);
      batch.rod(m.wood,v(x1,heightAt(x1,z1)+h,z1),v(x2,heightAt(x2,z2)+h,z2),.07,4);
    }
  };
  fence(-38,66,7,66);fence(-38,66,-38,118);fence(-38,118,95,118);fence(95,118,95,80);
  for(let i=0;i<5;i++) {
    const x=-40+i*29,z=124,y=heightAt(x,z);
    batch.cylinder(m.wood,.13,.24,10,x,y+5,z,9);
    batch.box(m.wood,3.2,.16,.17,x,y+9.3,z);
    for(const dx of [-1.2,1.2]) {
      batch.cylinder(m.white,.11,.11,.38,x+dx,y+9.5,z,8);
      if(i<4)for(let n=0;n<8;n++) {
        const a=n/8,b=(n+1)/8,xa=x+dx+29*a,xb=x+dx+29*b;
        batch.rod(m.darkMetal,v(xa,y+9.7-Math.sin(a*Math.PI)*.8,z),v(xb,heightAt(x+29,z)+9.7-Math.sin(b*Math.PI)*.8,z),.018,4);
      }
    }
  }
  for(const [x,z] of [[14,75],[39,76],[62,88],[-8,89],[79,101]])addLamp(x,z);

  // Distant wind farm: static towers and individually rotating three-blade hubs.
  const rotors: THREE.Group[]=[];
  for(const [x,z,s] of [[-153,137,1],[-192,110,.9],[-217,154,1.08],[155,178,.9]]) {
    const y=heightAt(x,z),h=37*s;
    batch.cylinder(m.concrete,2.4,2.9,.6,x,y+.3,z,18);
    batch.cylinder(m.white,.55,1.5,h,x,y+h/2,z,18);
    batch.box(m.white,1.65,1.7,4.4,x,y+h,z);
    const rotor=new THREE.Group();rotor.position.set(x,y+h,z-2.55);farm.add(rotor);
    const rb=new GeometryBatch();
    rb.cylinder(m.darkMetal,.48,.48,1,0,0,0,14,Math.PI/2);
    rb.add(new THREE.SphereGeometry(.66,12,8),m.white,{z:-.5});
    for(let a=0;a<3;a++) {
      const shape=new THREE.Shape();shape.moveTo(-.35,.8);shape.lineTo(-.8,3.2);shape.lineTo(-.33,15*s);shape.lineTo(.08,16*s);shape.lineTo(.55,4);shape.lineTo(.35,.8);shape.closePath();
      const blade=new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:false});
      rb.add(blade,m.white,{rz:a*Math.PI*2/3,z:-.55});
    }
    rb.flush(rotor);rotors.push(rotor);
    colliders.push({x,z,r:2,height:h+1});
  }
  batch.flush(farm);

  // A compact articulated tractor follows the service lane, away from the crop beds.
  const tractor=new THREE.Group();tractor.name='Service tractor';farm.add(tractor);
  const tb=new GeometryBatch();
  tb.box(m.darkMetal,2.05,.42,4.2,0,.95,0);
  tb.box(m.green,1.7,1.2,2.5,0,1.65,-1.25);
  tb.box(m.green,1.88,.25,2.7,0,2.32,-1.25);
  tb.box(m.dark,1.43,.95,.08,0,1.6,-2.55);
  for(let x=-.57;x<=.6;x+=.18)tb.box(m.metal,.045,.82,.06,x,1.6,-2.62);
  tb.box(m.green,2.02,.22,1.9,0,3.65,.8);
  tb.box(m.window,1.72,1.35,.07,0,2.84,-.15);
  tb.box(m.window,1.72,1.35,.07,0,2.84,1.66);
  for(const side of [-1,1]) {
    tb.box(m.window,.07,1.35,1.65,side*.87,2.84,.75);
    for(const z of [-.16,1.68])tb.box(m.darkMetal,.12,1.5,.12,side*.91,2.88,z);
    tb.box(m.green,.52,.22,2,side*1.12,2.04,1.05);
    tb.box(m.light,.4,.3,.1,side*.61,1.99,-2.64);
    tb.box(m.red,.22,.27,.08,side*.85,2.16,1.9);
    tb.box(m.darkMetal,.5,.16,.7,side*1.05,1.26,.1);
    tb.box(m.darkMetal,.46,.16,.5,side*1.05,.98,.2);
  }
  tb.cylinder(m.darkMetal,.075,.1,2.3,-.58,2.7,-1.5,9);
  tb.box(m.darkMetal,.22,.12,.28,-.58,3.87,-1.5);
  tb.box(m.dark,.8,.8,.7,0,2.5,1.05);
  tb.add(new THREE.TorusGeometry(.26,.035,5,12),m.dark,{x:0,y:2.6,z:.05,rx:.8});
  tb.cylinder(m.yellow,.16,.2,.22,0,3.89,.85,12);
  tb.flush(tractor);
  const wheels: THREE.Group[]=[];
  for(const [z,r] of [[1.08,1],[-1.65,.68]])for(const side of [-1,1]) {
    const wheel=new THREE.Group();wheel.position.set(side*1.23,r,z);tractor.add(wheel);wheels.push(wheel);
    const wb=new GeometryBatch();
    wb.cylinder(m.rubber,r,r,.6,0,0,0,20,0,Math.PI/2);
    wb.cylinder(m.yellow,r*.55,r*.55,.62,0,0,0,16,0,Math.PI/2);
    wb.cylinder(m.darkMetal,r*.22,r*.22,.66,0,0,0,12,0,Math.PI/2);
    for(let a=0;a<14;a++) {
      const angle=a*Math.PI*2/14;
      wb.add(new THREE.BoxGeometry(.66,.1,r*.34),m.rubber,{y:Math.cos(angle)*r,z:Math.sin(angle)*r,rx:angle});
    }
    wb.flush(wheel);
  }
  // Attached flat-bed trailer with a small stack of straw bales.
  const trailer=new GeometryBatch();
  trailer.box(m.wood,2.9,.2,3.6,0,.9,4.3);
  trailer.box(m.darkMetal,2.5,.25,3.8,0,.7,4.3);
  trailer.rod(m.darkMetal,v(0,.7,1.8),v(0,.7,3.2),.09);
  for(const side of [-1,1]) {
    trailer.box(m.green,.12,.75,3.8,side*1.45,1.25,4.3);
    trailer.cylinder(m.rubber,.55,.55,.36,side*1.55,.55,4.5,14,0,Math.PI/2);
    trailer.cylinder(m.yellow,.28,.28,.38,side*1.55,.55,4.5,12,0,Math.PI/2);
  }
  trailer.box(m.green,2.9,.75,.12,0,1.25,6.15);
  for(let i=0;i<4;i++)trailer.box(m.yellow,1.23,.7,1.45,(i%2-.5)*1.25,1.32,3.45+Math.floor(i/2)*1.5);
  trailer.flush(tractor);

  let travel=0;
  const route=new THREE.CatmullRomCurve3([
    v(-142,0,43),v(-80,0,43),v(5,0,44),v(15,0,48),
    v(5,0,53),v(-80,0,52),v(-142,0,52),v(-149,0,47),
  ],true,'catmullrom',.16);
  const totalLength=route.getLength(),routePoint=new THREE.Vector3(),routeTangent=new THREE.Vector3();
  return {
    colliders,
    setTechOnline(online:boolean) {
      techOnline=online;
      m.tech.color.set(online?'#a0ffc0':'#263c35');
      m.tech.emissiveIntensity=online?1.8:0;
    },
    update(dt:number,time:number,daylight:number) {
      const night=THREE.MathUtils.smoothstep(1-daylight,.45,.88);
      m.light.emissiveIntensity=.12+night*3;
      m.windowGlow.emissiveIntensity=.05+night*1.5;
      m.tech.emissiveIntensity=techOnline?1.8+Math.sin(time*.8)*.18:0;
      lamps.forEach(light=>light.intensity=night*28);
      rotors.forEach((rotor,i)=>rotor.rotation.z=time*(.33+i*.018)+i);
      travel=(travel+dt*3.3)%totalLength;
      route.getPointAt(travel/totalLength,routePoint);route.getTangentAt(travel/totalLength,routeTangent);
      tractor.position.set(routePoint.x,heightAt(routePoint.x,routePoint.z),routePoint.z);
      tractor.rotation.y=Math.atan2(-routeTangent.x,-routeTangent.z);
      wheels.forEach((wheel,i)=>wheel.rotation.x=-(travel/(i<2?1:.68)));
    }
  };
}
