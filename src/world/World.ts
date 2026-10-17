import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIELD_DEFS, PAD, PUMP, WORLD_SIZE, randHash, clamp, type FieldDef, type Quality } from '../core/config';
import { heightAt, riverCenter, riverWidth } from './Terrain';
import { buildStructures } from './Structures';

interface Cell { moisture: number; health: number; growth: number; seeded: boolean; scanned: boolean; coverage?: number }
interface FieldState {def: FieldDef; cells: Cell[]; cols: number; rows: number }
interface CropBatch {mesh:THREE.InstancedMesh; highGeometry:THREE.BufferGeometry; lowGeometry:THREE.BufferGeometry; fullCount:number; def:FieldDef; points:{x:number;z:number;rotation:number;scale:number}[]; ground:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>}
const Y = new THREE.Vector3(0,1,0), dummy = new THREE.Object3D();
const color = new THREE.Color();
const hash = randHash;
const sat=(v:number)=>clamp(v,0,1);
function paint(g:THREE.BufferGeometry,c:THREE.ColorRepresentation):THREE.BufferGeometry {
 const p=g.getAttribute('position');if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(p.count*2),2));const a=new Float32Array(p.count*3);const col=new THREE.Color(c);
 for(let i=0;i<p.count;i++){a[i*3]=col.r;a[i*3+1]=col.g;a[i*3+2]=col.b;}
 g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;
}
function cylinder(a:THREE.Vector3,b:THREE.Vector3,r1:number,r2:number,c:THREE.ColorRepresentation,sides=5):THREE.BufferGeometry {
 const d=b.clone().sub(a);const g=new THREE.CylinderGeometry(r2,r1,d.length(),sides,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y,d.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);return paint(g,c);
}
function blade(base:THREE.Vector3,angle:number,length:number,width:number,rise:number,c:THREE.ColorRepresentation,simple=false):THREE.BufferGeometry {
 const side=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));const cross=new THREE.Vector3(-side.z,0,side.x);const mid=base.clone().addScaledVector(side,length*.48).addScaledVector(Y,rise);const tip=base.clone().addScaledVector(side,length).addScaledVector(Y,rise*.62);
 const verts=[base,mid.clone().addScaledVector(cross,width),mid.clone().addScaledVector(Y,.025),mid.clone().addScaledVector(cross,-width),tip];
 const g=new THREE.BufferGeometry().setFromPoints(verts);g.setIndex(simple?[0,1,4,0,4,3]:[0,1,2,0,2,3,1,4,2,2,4,3]);g.computeVertexNormals();return paint(g,c);
}
function merged(parts:THREE.BufferGeometry[]):THREE.BufferGeometry { const out=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());return out; }

export class World {
 readonly colliders:{x:number;z:number;r:number;height:number}[]=[];
 readonly vegetation = new THREE.Group();
 private readonly uniforms={uTime:{value:0},uWind:{value:new THREE.Vector2(1,.3)},uDrone:{value:new THREE.Vector3(25,6,65)},uRain:{value:0}};
 private crops:CropBatch[]=[];
 private water:THREE.ShaderMaterial;
 private structures:ReturnType<typeof buildStructures>;
 private birds:THREE.InstancedMesh;
 private birdsGeometry:THREE.BufferGeometry;
 private lastFieldSync=-10;
 private scannerActive=false;
 private waterMeshes:THREE.Mesh[]=[];
 private techOnline=false;
 private quality:Quality='HIGH';
 private treeLods:{mesh:THREE.InstancedMesh;high:THREE.BufferGeometry;low:THREE.BufferGeometry}[]=[];
 private densityLods:{mesh:THREE.InstancedMesh;count:number;low:number}[]=[];
 private scene:THREE.Scene;
 constructor(scene:THREE.Scene){
  this.scene=scene;scene.add(this.vegetation);
  this.buildTerrain();
  this.water=this.waterMaterial();this.buildWater();
  this.buildLanes();this.buildFields();this.buildTrees();this.buildMeadow();this.buildRocks();
  this.structures=buildStructures(scene);this.colliders.push(...this.structures.colliders);
  this.birdsGeometry=new THREE.BufferGeometry();this.birdsGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,0,.15,.12,0,0,.3,0,0,.3,0,.15,.12,1,0,0],3));this.birdsGeometry.computeVertexNormals();
  this.birds=new THREE.InstancedMesh(this.birdsGeometry,new THREE.MeshStandardMaterial({color:0x343f3c,roughness:.9,side:THREE.DoubleSide}),20);this.birds.frustumCulled=false;scene.add(this.birds);
 }
 private windMaterial(base:THREE.ColorRepresentation,amount:number,roughness=1){
  const m=new THREE.MeshStandardMaterial({color:base,vertexColors:true,roughness,side:THREE.DoubleSide});
  const u=this.uniforms;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,u);
   shader.vertexShader='uniform float uTime; uniform vec2 uWind; uniform vec3 uDrone;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 plantOrigin = vec3(0.0);
    #ifdef USE_INSTANCING
    plantOrigin = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
    #endif
    float sway = sin(uTime*1.7 + plantOrigin.x*.37 + plantOrigin.z*.23)*.6 + sin(uTime*2.8 + plantOrigin.x*.11)*.3;
    float tip = max(0.0,position.y);
    vec2 washDelta = plantOrigin.xz-uDrone.xz;
    float wash = exp(-dot(washDelta,washDelta)/33.0)*(1.0-smoothstep(2.0,11.0,uDrone.y-plantOrigin.y));
    transformed.xz += (uWind*sway*${amount.toFixed(3)} + normalize(washDelta+vec2(.001))*wash*.55)*tip*tip;
    transformed.y -= wash*tip*.16;
   `);
  };
  m.customProgramCacheKey=()=>`agronova-wind-${amount}`;
  return m;
 }
 private buildTerrain(){
  const g=new THREE.PlaneGeometry(WORLD_SIZE+80,WORLD_SIZE+80,190,190);g.rotateX(-Math.PI/2);
  const p=g.getAttribute('position');const cs=new Float32Array(p.count*3);const grassA=new THREE.Color('#5f7435'),grassB=new THREE.Color('#8b984c'),shore=new THREE.Color('#a59972');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),h=heightAt(x,z);p.setY(i,h);
   const f=.5+.25*Math.sin(x*.055+Math.sin(z*.04))+.15*Math.cos(z*.083)+hash(x,z)*.13;
   color.copy(grassA).lerp(grassB,sat(f));
   const nearRiver=Math.abs(x-riverCenter(z));if(nearRiver<riverWidth(z)+7)color.lerp(shore,.6);
   if(h<.7)color.set('#756f50');
   cs.set([color.r,color.g,color.b],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(cs,3));g.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  mat.onBeforeCompile=s=>{
   s.uniforms.uRain=this.uniforms.uRain;
   s.fragmentShader='uniform float uRain;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= 1.0-uRain*.55;');
   s.vertexShader='varying vec3 vGroundWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGroundWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   s.fragmentShader='varying vec3 vGroundWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float grain=fract(sin(dot(floor(vGroundWorld.xz*6.),vec2(127.1,311.7)))*43758.5453);
    float soilVariation=sin(vGroundWorld.x*.41+sin(vGroundWorld.z*.22))*sin(vGroundWorld.z*.67)*.035;
    diffuseColor.rgb*=(.92+grain*.15+soilVariation)*(1.-uRain*.28);
   `);
  };
  const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;this.scene.add(mesh);
  // Layered, irregular ridgelines enclose the playable agricultural valley.
  for(let ring=0;ring<3;ring++){
   const v:number[]=[],cols:number[]=[],idx:number[]=[];const n=104;
   for(let i=0;i<=n;i++){
    const a=i/n*Math.PI*2;const radius=355+ring*170;const peak=(Math.sin(a*7+ring)*.5+.5)*35+Math.sin(a*13+2)*14+35+ring*24;
    for(let j=0;j<3;j++){
     const r=radius+(j-1)*145;const h=j===1?peak:-8;
     v.push(Math.sin(a)*r,h,Math.cos(a)*r);const c=new THREE.Color(ring===0?'#677a65':ring===1?'#7c9083':'#93a39a');c.multiplyScalar(.92+hash(i,ring)*.16);cols.push(c.r,c.g,c.b);
    }
    if(i<n)for(let j=0;j<2;j++){const k=i*3+j;idx.push(k,k+3,k+1,k+1,k+3,k+4);}
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));geo.setIndex(idx);geo.computeVertexNormals();const mountain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));this.scene.add(mountain);
  }
 }
 private waterMaterial(){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:this.uniforms.uTime,uRain:{value:0},uDaylight:{value:1},uFogColor:{value:(this.scene.fog as THREE.Fog)?.color??new THREE.Color('#c6d2c0')},uFogNear:{value:160},uFogFar:{value:660}},vertexShader:`varying vec3 vWorld; varying vec2 vUv; uniform float uTime; void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.72+uTime*1.1)*.022+sin(p.z*.54-uTime)*.018;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`varying vec3 vWorld;varying vec2 vUv;uniform float uTime;uniform float uRain;uniform float uDaylight;uniform vec3 uFogColor;uniform float uFogNear;uniform float uFogFar;
    void main(){vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(eye,vec3(0.,1.,0.)),0.),3.);float wave=sin(vWorld.x*2.2+sin(vWorld.z*.75-uTime*1.3)*2.+uTime)*sin(vWorld.z*1.9-uTime*1.1);float fine=pow(max(0.,sin(vWorld.x*4.7+vWorld.z*2.5-uTime*2.3)),20.);vec3 col=mix(vec3(.105,.25,.22),vec3(.46,.64,.65),fresnel*.78);col+=vec3(.2,.24,.2)*fine*(.07+uRain*.18)+wave*(.011+uRain*.01);float edge=1.-smoothstep(0.,.09,min(vUv.x,1.-vUv.x));col=mix(col,vec3(.58,.62,.45),edge*.42);col*=.25+.75*uDaylight;col=mix(col,uFogColor,smoothstep(uFogNear,uFogFar,distance(cameraPosition,vWorld)));gl_FragColor=vec4(col,.87);}`});
 }
 private buildWater(){
  const vs:number[]=[],uv:number[]=[],idx:number[]=[];const n=240;
  for(let i=0;i<=n;i++){
   const z=-350+i/n*700,c=riverCenter(z),w=riverWidth(z)+1.5;
   vs.push(c-w,.025,z,c+w,.025,z);uv.push(0,i/4,1,i/4);if(i<n){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const river=new THREE.Mesh(geo,this.water);river.renderOrder=1;this.scene.add(river);this.waterMeshes.push(river);
  const pondGeo=new THREE.CircleGeometry(1,64);pondGeo.rotateX(-Math.PI/2);pondGeo.scale(32,1,22);pondGeo.translate(120,.035,145);const pond=new THREE.Mesh(pondGeo,this.water);this.scene.add(pond);this.waterMeshes.push(pond);
  // Reeds, cattails and shoreline rushes break up the straight water edge.
  const parts:THREE.BufferGeometry[]=[];
  for(let k=0;k<4;k++)parts.push(blade(new THREE.Vector3(0,0,0),k*2.4,.17,.022,.9+k*.12,k%2?'#737b38':'#858b45'));
  parts.push(cylinder(new THREE.Vector3(),new THREE.Vector3(.05,1.35,0),.018,.012,'#6e753b'));
  parts.push(cylinder(new THREE.Vector3(.05,1.08,0),new THREE.Vector3(.05,1.4,0),.05,.04,'#5c432b'));
  const reeds=new THREE.InstancedMesh(merged(parts),this.windMaterial(0xffffff,.027),850);let count=0;
  for(let i=0;i<1400 && count<850;i++){
   const z=-260+hash(i,21)*520;const side=hash(i,7)>.5?1:-1;const x=riverCenter(z)+side*(riverWidth(z)+3+hash(i,9)*3);const y=heightAt(x,z);
   if(y<-.15||y>2.8)continue;dummy.position.set(x,y,z);dummy.rotation.set(0,hash(i,14)*6.28,0);dummy.scale.setScalar(.7+hash(i,4)*.7);dummy.updateMatrix();reeds.setMatrixAt(count++,dummy.matrix);
  }
  reeds.count=count;this.densityLods.push({mesh:reeds,count,low:.45});reeds.castShadow=true;this.vegetation.add(reeds);
 }
 private lane(points:[number,number][],width:number){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));const v:number[]=[],u:number[]=[],idx:number[]=[];
  const n=120;
  for(let i=0;i<=n;i++){
   const t=i/n,p=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
   for(let j=0;j<2;j++){const x=p.x+side.x*width*(j-.5),z=p.z+side.z*width*(j-.5);v.push(x,heightAt(x,z)+.045,z);u.push(j,t*45);}
   if(i<n){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(idx);g.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:'#a99a74',roughness:1,side:THREE.DoubleSide});material.onBeforeCompile=s=>{s.vertexShader='varying vec2 vLaneUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLaneUv=uv;');s.fragmentShader='varying vec2 vLaneUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float tires=smoothstep(.03,.07,abs(abs(vLaneUv.x-.5)-.27));float stones=fract(sin(dot(floor(vLaneUv*vec2(80.,800.)),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=(.8+stones*.3)*mix(.78,1.,tires);`);};
  const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;this.scene.add(mesh);
 }
 private buildLanes(){
  this.lane([[-280,44],[-170,43],[-88,41],[-18,43],[24,44],[43,57],[45,94],[90,128],[170,210],[260,275]],5.6);
  this.lane([[-85,42],[-80,9],[-68,-30],[-64,-75],[-60,-127],[-89,-192],[-151,-276]],4.1);
  this.lane([[8,44],[9,-4],[9,-61],[0,-100],[-8,-145],[18,-200]],3.8);
  this.lane([[44,45],[52,17],[78,-13],[107,-9],[156,-11],[208,-13],[275,-39]],4.2);
  this.lane([[24,44],[24,65]],4.2);
 }
 private cropGeometry(type:FieldDef['crop']){
  const p:THREE.BufferGeometry[]=[];
  if(type==='wheat'){
   p.push(cylinder(new THREE.Vector3(),new THREE.Vector3(0,1.25,0),.013,.009,'#aa9b48',3));
   p.push(blade(new THREE.Vector3(0,.28,0),.8,.37,.026,.28,'#b4ab55'),blade(new THREE.Vector3(0,.65,0),3.5,.28,.022,.19,'#c7b967'));
   p.push(cylinder(new THREE.Vector3(0,1.2,0),new THREE.Vector3(0,1.7,0),.047,.017,'#d7bc63',4));
   for(let i=0;i<7;i++)for(const s of [-1,1]){const y=1.26+i*.057;p.push(blade(new THREE.Vector3(0,y,0),s>0?0:Math.PI,.13-i*.008,.018,.13,'#e9ce79',true));}
  } else if(type==='corn'){
   p.push(cylinder(new THREE.Vector3(),new THREE.Vector3(0,2.55,0),.038,.017,'#697b38',5));
   for(let i=0;i<7;i++)p.push(blade(new THREE.Vector3(0,.35+i*.28,0),i*2.4,.8-i*.045,.10-i*.004,.35,'#778c3c'));
   for(let i=0;i<6;i++)p.push(cylinder(new THREE.Vector3(0,2.22,0),new THREE.Vector3(Math.sin(i*2.4)*.22,2.7+hash(i,2)*.18,Math.cos(i*2.4)*.22),.012,.003,'#c8b46b',3));
   p.push(cylinder(new THREE.Vector3(.08,1.1,0),new THREE.Vector3(.16,1.48,0),.062,.035,'#bc9e47',5));
  } else if(type==='sunflower'){
   p.push(cylinder(new THREE.Vector3(),new THREE.Vector3(0,2.1,0),.025,.015,'#637437',5));
   for(let i=0;i<5;i++)p.push(blade(new THREE.Vector3(0,.4+i*.28,0),i*2.5,.44,.15,.19,'#72833b'));
   const center=paint(new THREE.CylinderGeometry(.18,.18,.055,9),'#51432b');center.rotateX(Math.PI/2);center.translate(0,2.03,0);p.push(center);
   for(let i=0;i<12;i++){const a=i*Math.PI/6;const verts=new Float32Array([Math.sin(a)*.135,2.03+Math.cos(a)*.135,0,Math.sin(a+.2)*.25,2.03+Math.cos(a+.2)*.25,.01,Math.sin(a)*.36,2.03+Math.cos(a)*.36,0,Math.sin(a-.2)*.25,2.03+Math.cos(a-.2)*.25,.01]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(verts,3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();p.push(paint(g,i%3?'#e9bb32':'#f4d05a'));}
  } else{
   p.push(blade(new THREE.Vector3(),0,.1,.037,.35,'#8eab53'),blade(new THREE.Vector3(),2.4,.12,.033,.28,'#9cb260'),blade(new THREE.Vector3(),4.6,.11,.03,.4,'#739346'));
  }
  return merged(p);
 }

 private lowCropGeometry(type:FieldDef['crop']){
  const p:THREE.BufferGeometry[]=[];
  if(type==='bare')return merged([blade(new THREE.Vector3(),0,.12,.035,.33,'#8eab53',true),blade(new THREE.Vector3(),2.4,.12,.03,.3,'#9cb260',true)]);
  const h=type==='wheat'?1.55:type==='corn'?2.5:2.1;
  // Crossed ribbons keep the silhouettes legible at a distance without cylindrical stems.
  for(let k=0;k<2;k++){
   const a=k*Math.PI*.5,w=type==='wheat'?.017:.03,dx=Math.cos(a)*w,dz=Math.sin(a)*w;
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-dx,0,-dz,dx,0,dz,-dx,h,-dz,dx,h,dz],3));g.setIndex([0,1,2,2,1,3]);g.computeVertexNormals();p.push(paint(g,type==='wheat'?'#baac59':'#778741'));
  }
  if(type==='wheat'){
   for(let k=0;k<2;k++){
    const g=new THREE.PlaneGeometry(.105,.47,1,1);g.rotateY(k*Math.PI*.5);g.translate(0,1.43,0);p.push(paint(g,'#dfc66f'));
   }
  }else if(type==='corn'){
   for(let k=0;k<4;k++)p.push(blade(new THREE.Vector3(0,.5+k*.4,0),k*2.4,.66,.08,.27,'#819645',true));
   p.push(blade(new THREE.Vector3(0,2.25,0),.8,.15,.03,.3,'#c8b46b',true));
  }else{
   for(let k=0;k<3;k++)p.push(blade(new THREE.Vector3(0,.4+k*.4,0),k*2.4,.38,.13,.16,'#74863b',true));
   const petal=paint(new THREE.CircleGeometry(.32,7),'#eac34a');petal.translate(0,2.03,0);p.push(petal);const seed=paint(new THREE.CircleGeometry(.17,7),'#51432b');seed.translate(0,2.03,.003);p.push(seed);
  }
  return merged(p);
 }
 private buildFields(){
  for(const def of FIELD_DEFS){
   const g=new THREE.BufferGeometry();const pos:number[]=[],cs:number[]=[],idx:number[]=[];
   for(let row=0;row<8;row++)for(let col=0;col<10;col++){
    const x0=def.x-def.w/2+col*def.w/10,x1=x0+def.w/10,z0=def.z-def.d/2+row*def.d/8,z1=z0+def.d/8;const k=pos.length/3;
    pos.push(x0,2.032,z0,x0,2.032,z1,x1,2.032,z0,x1,2.032,z1);idx.push(k,k+1,k+2,k+2,k+1,k+3);
    const c=new THREE.Color(def.crop==='bare'?'#766044':'#7c7749');for(let i=0;i<4;i++)cs.push(c.r,c.g,c.b);
   }
   g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));g.setIndex(idx);g.computeVertexNormals();
   const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});material.onBeforeCompile=s=>{s.vertexShader='varying vec3 vSoilWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSoilWorld=position;');s.fragmentShader='varying vec3 vSoilWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float furrow=pow(abs(sin(vSoilWorld.x*9.)),5.);float grit=fract(sin(dot(floor(vSoilWorld.xz*21.),vec2(47.1,81.7)))*43758.545);diffuseColor.rgb*=.83+furrow*.14+grit*.15;`);};
   const ground=new THREE.Mesh(g,material);ground.receiveShadow=true;this.scene.add(ground);
   const spacing=def.crop==='wheat'?[.35,.65]:def.crop==='corn'?[.85,1]:def.crop==='sunflower'?[1.1,1.2]:[.66,.8];
   const points:CropBatch['points']=[];
   for(let x=def.x-def.w/2+.35;x<def.x+def.w/2-.3;x+=spacing[0])for(let z=def.z-def.d/2+.35;z<def.z+def.d/2-.3;z+=spacing[1]){
    const jx=(hash(x,z)-.5)*spacing[0]*.25,jz=(hash(z,x)-.5)*spacing[1]*.38;
    points.push({x:x+jx,z:z+jz,rotation:hash(x+3,z)*6.28,scale:.75+hash(x,z+17)*.4});
   }
   for(let i=points.length-1;i>0;i--){const j=Math.floor(hash(i,def.id+501)*(i+1));[points[i],points[j]]=[points[j],points[i]];}
   const cropMat=this.windMaterial(0xffffff,def.crop==='corn'?.018:.045);
   const highGeometry=this.cropGeometry(def.crop),lowGeometry=this.lowCropGeometry(def.crop);
   const mesh=new THREE.InstancedMesh(highGeometry,cropMat,points.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
   for(let i=0;i<points.length;i++){const p=points[i];dummy.position.set(p.x,2.04,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(p.scale,p.scale,p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.setRGB(.93+hash(i,1)*.07,.94+hash(i,2)*.06,.87+hash(i,3)*.12));}
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.vegetation.add(mesh);this.crops.push({mesh,highGeometry,lowGeometry,fullCount:points.length,def,points,ground});
   // Raised grass headlands and old timber field markers.
   const markerMat=new THREE.MeshStandardMaterial({color:'#8f7751',roughness:1});const mg=new THREE.CylinderGeometry(.07,.09,1.1,5);
   const marker=new THREE.InstancedMesh(mg,markerMat,4);
   for(let i=0;i<4;i++){const x=def.x+(i%2?1:-1)*(def.w/2+.4),z=def.z+(i<2?1:-1)*(def.d/2+.4);dummy.position.set(x,heightAt(x,z)+.5,z);dummy.rotation.set(.04,0,.04);dummy.scale.setScalar(1);dummy.updateMatrix();marker.setMatrixAt(i,dummy.matrix);}this.scene.add(marker);
  }
 }
 setQuality(quality:Quality){
  this.quality=quality;this.lastFieldSync=-10;
  this.vegetation.traverse(obj=>{const mesh=obj as THREE.Mesh;if(!mesh.isMesh)return;mesh.castShadow=quality!=='LOW'&&mesh.userData.castShadow!==false;});
  for(const lod of this.treeLods)lod.mesh.geometry=quality==='LOW'?lod.low:lod.high;
  for(const lod of this.densityLods)lod.mesh.count=Math.max(1,Math.floor(lod.count*(quality==='LOW'?lod.low:quality==='MEDIUM'?.62:1)));
  for(const batch of this.crops){batch.mesh.count=Math.max(1,Math.floor(batch.fullCount*(quality==='LOW'?.28:quality==='MEDIUM'?.7:1)));if(quality==='LOW')batch.mesh.geometry=batch.lowGeometry;}
 }
 setTechOnline(online:boolean){if(this.techOnline===online)return;this.techOnline=online;this.structures.setTechOnline?.(online);}
 setScanner(active:boolean){if(active===this.scannerActive)return;this.scannerActive=active;this.lastFieldSync=-10;}
 updateFields(fields:FieldState[]){
  for(const batch of this.crops){
   const field=fields.find(f=>f.def.id===batch.def.id);if(!field||!field.cells?.length)continue;
   const moistureColor=new THREE.Color('#493d2c'),dryColor=new THREE.Color('#91764a');const attr=batch.ground.geometry.getAttribute('color');
   field.cells.forEach((cell,i)=>{if(i>=80)return;const wet=sat(cell.moisture>1?cell.moisture/100:cell.moisture);color.copy(dryColor).lerp(moistureColor,wet*.8);if(cell.seeded&&batch.def.crop==='bare')color.lerp(new THREE.Color('#738049'),sat(cell.growth)*.3);if(this.scannerActive&&cell.scanned){const health=sat(cell.health>1?cell.health/100:cell.health);color.setHSL((wet*.65+health*.35)*.48,.72,.39);}for(let k=0;k<4;k++)attr.setXYZ(i*4+k,color.r,color.g,color.b);});attr.needsUpdate=true;
   for(let i=0;i<batch.mesh.count;i++){
    const p=batch.points[i];const col=clamp(Math.floor((p.x-batch.def.x+batch.def.w/2)/batch.def.w*(field.cols||10)),0,(field.cols||10)-1),row=clamp(Math.floor((p.z-batch.def.z+batch.def.d/2)/batch.def.d*(field.rows||8)),0,(field.rows||8)-1);const cell=field.cells[row*(field.cols||10)+col];if(!cell)continue;
    let growth=sat(cell.growth>1?cell.growth/100:cell.growth);if(!Number.isFinite(growth))growth=.7;
    const scale=(batch.def.crop==='bare'?(cell.seeded?.25+growth*1.8:.001):.38+growth*.65)*p.scale;
    dummy.position.set(p.x,2.04,p.z);dummy.rotation.set(0,p.rotation,0);const widthScale=batch.def.crop==='bare'&&!cell.seeded?.001:p.scale;dummy.scale.set(widthScale,scale,widthScale);dummy.updateMatrix();batch.mesh.setMatrixAt(i,dummy.matrix);
    const health=sat(cell.health>1?cell.health/100:cell.health);color.setRGB(1,.85+health*.15,.62+health*.35);if(this.scannerActive&&cell.scanned){const wet=sat(cell.moisture>1?cell.moisture/100:cell.moisture);color.setHSL((wet*.65+health*.35)*.48,.7,.55);}batch.mesh.setColorAt(i,color);
   }
   batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;
  }
 }
 private buildTrees(){
  const trunkParts:THREE.BufferGeometry[]=[],leafParts:THREE.BufferGeometry[]=[],lowLeafParts:THREE.BufferGeometry[]=[];
  trunkParts.push(cylinder(new THREE.Vector3(),new THREE.Vector3(.17,5.8,.12),.32,.09,'#6b6045',7));
  for(let k=0;k<15;k++){
   const a=k*2.399;const base=2.4+(k%5)*.56;const len=1.4+hash(k,2)*1.8;const end=new THREE.Vector3(Math.cos(a)*len,base+1.3+hash(k,5)*1.4,Math.sin(a)*len);
   trunkParts.push(cylinder(new THREE.Vector3(.08,base,0),end,.095,.015,'#73674b',5));
   for(let q=0;q<2;q++){
    for(const detail of [1,0]){
     const leaf=new THREE.IcosahedronGeometry(1,detail);const positions=leaf.getAttribute('position');for(let i=0;i<positions.count;i++){const j=.8+hash(i+k*11,q)*.35;positions.setXYZ(i,positions.getX(i)*j,positions.getY(i)*(.8+hash(i,k)*.35),positions.getZ(i)*j);}leaf.computeVertexNormals();
     leaf.scale(1.15+hash(k,8)*.6,.95+hash(k,6)*.65,1.1+hash(k,7)*.5);leaf.translate(end.x+(q-.5)*.7,end.y+q*.5,end.z+(q-.5)*.4);paint(leaf,new THREE.Color('#6f8243').lerp(new THREE.Color('#9b9b53'),hash(k,q)*.55));(detail?leafParts:lowLeafParts).push(leaf);
    }
   }
  }
  const trunkGeo=merged(trunkParts),leafGeo=merged(leafParts),lowLeafGeo=merged(lowLeafParts);const n=220;const trunks=new THREE.InstancedMesh(trunkGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),n),leaves=new THREE.InstancedMesh(leafGeo,this.windMaterial(0xffffff,.002),n);
  let count=0;
  const place=(x:number,z:number,k:number)=>{
   if(count>=n||heightAt(x,z)<.5||this.nearField(x,z,6)||this.inFarm(x,z)||this.nearRoad(x,z))return;
   const sc=.74+hash(k,58)*.8;dummy.position.set(x,heightAt(x,z),z);dummy.rotation.set(0,hash(k,46)*6.28,0);dummy.scale.set(sc,sc*(.85+hash(k,48)*.3),sc);dummy.updateMatrix();trunks.setMatrixAt(count,dummy.matrix);leaves.setMatrixAt(count,dummy.matrix);leaves.setColorAt(count,color.setRGB(.8+hash(k,61)*.2,.9+hash(k,44)*.1,.7+hash(k,33)*.25));
   this.colliders.push({x,z,r:sc*.4,height:sc*7.5});count++;
  };
  for(let i=0;i<155;i++){
   const z=-270+i/155*540;const x=riverCenter(z)+(i%2?1:-1)*(21+hash(i,14)*17);place(x,z,i);
  }
  for(let i=0;i<600&&count<n;i++){
   const x=(hash(i,27)-.5)*600,z=(hash(i,29)-.5)*600;const edge=Math.max(Math.abs(x),Math.abs(z));if(edge<110&&hash(i,84)>.2)continue;place(x,z,i+1000);
  }
  this.treeLods.push({mesh:leaves,high:leafGeo,low:lowLeafGeo});trunks.count=leaves.count=count;trunks.castShadow=leaves.castShadow=true;leaves.receiveShadow=true;this.vegetation.add(trunks,leaves);
  // Shrub islands with broken silhouettes, concentrated along hedgerows.
  const shrubGeo=leafGeo.clone();shrubGeo.scale(.21,.19,.21);shrubGeo.translate(0,-.48,0);const lowShrubGeo=lowLeafGeo.clone();lowShrubGeo.scale(.21,.19,.21);lowShrubGeo.translate(0,-.48,0);const shrubs=new THREE.InstancedMesh(shrubGeo,this.windMaterial('#a3a163',.012),180);
  let sn=0;for(let i=0;i<550&&sn<180;i++){const x=(hash(i,91)-.5)*530,z=(hash(i,93)-.5)*530;if(heightAt(x,z)<.5||this.nearField(x,z,2)||this.inFarm(x,z)||this.nearRoad(x,z))continue;dummy.position.set(x,heightAt(x,z),z);dummy.rotation.set(0,hash(i,92)*6.28,0);dummy.scale.setScalar(.5+hash(i,94)*.8);dummy.updateMatrix();shrubs.setMatrixAt(sn++,dummy.matrix);}shrubs.count=sn;this.treeLods.push({mesh:shrubs,high:shrubGeo,low:lowShrubGeo});this.densityLods.push({mesh:shrubs,count:sn,low:.6});shrubs.castShadow=true;this.vegetation.add(shrubs);
 }
 private nearField(x:number,z:number,extra=0){return FIELD_DEFS.some(f=>Math.abs(x-f.x)<f.w/2+extra&&Math.abs(z-f.z)<f.d/2+extra);}
 private inFarm(x:number,z:number){return x>-42&&x<91&&z>43&&z<130;}
 private nearRoad(x:number,z:number){return Math.abs(z-43)<6||Math.abs(x-8)<5||(Math.abs(x+67)<8&&z<44&&z>-150)||Math.abs(z+11)<4&&x>50;}
 private buildMeadow(){
  const parts:THREE.BufferGeometry[]=[];for(let j=0;j<5;j++)parts.push(blade(new THREE.Vector3((hash(j,3)-.5)*.2,0,(hash(j,5)-.5)*.2),j*2.4,.12,.025,.28+hash(j,6)*.35,j%2?'#95a25e':'#7d8c48'));
  const grass=new THREE.InstancedMesh(merged(parts),this.windMaterial('#d3cf9d',.12),7000);let count=0;
  for(let i=0;i<20000&&count<7000;i++){
   const x=(hash(i,302)-.5)*410,z=(hash(i,305)-.5)*410;const y=heightAt(x,z);
   if(y<.6||this.nearField(x,z,.6)||this.inFarm(x,z)||this.nearRoad(x,z))continue;
   dummy.position.set(x,y,z);dummy.rotation.set(0,hash(i,306)*6.28,0);const sc=.6+hash(i,307)*.8;dummy.scale.set(sc,sc,sc);dummy.updateMatrix();grass.setMatrixAt(count++,dummy.matrix);
  }
  grass.count=count;this.densityLods.push({mesh:grass,count,low:.24});grass.userData.castShadow=false;grass.receiveShadow=true;this.vegetation.add(grass);
  // Wildflowers: small ivory and yellow constellations above the meadow grass.
  const flowerParts:THREE.BufferGeometry[]=[];flowerParts.push(cylinder(new THREE.Vector3(),new THREE.Vector3(0,.36,0),.008,.005,'#6c8044',3));
  for(let j=0;j<5;j++){const g=new THREE.CircleGeometry(.047,4);g.rotateX(-Math.PI/2);g.translate(Math.cos(j*1.256)*.045,.37,Math.sin(j*1.256)*.045);flowerParts.push(paint(g,j%2?'#ede2a9':'#d3b94b'));}
  const flowers=new THREE.InstancedMesh(merged(flowerParts),this.windMaterial(0xffffff,.12),550);let fn=0;
  for(let i=0;i<2500&&fn<550;i++){const x=(hash(i,409)-.5)*310,z=(hash(i,410)-.5)*310,y=heightAt(x,z);if(y<.8||this.nearField(x,z,2)||this.inFarm(x,z)||this.nearRoad(x,z))continue;dummy.position.set(x,y,z);dummy.rotation.set(0,hash(i,411)*6.28,0);dummy.scale.setScalar(.8+hash(i,412));dummy.updateMatrix();flowers.setMatrixAt(fn++,dummy.matrix);}flowers.count=fn;this.densityLods.push({mesh:flowers,count:fn,low:.4});flowers.userData.castShadow=false;this.vegetation.add(flowers);
 }
 private buildRocks(){
  const g=new THREE.IcosahedronGeometry(1,1);const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const s=.8+hash(p.getX(i),p.getZ(i))*.3;p.setXYZ(i,p.getX(i)*s,p.getY(i)*s*.6,p.getZ(i)*s);}g.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:'#8c8d7a',roughness:1}),130);let n=0;
  for(let i=0;i<350&&n<130;i++){
   const z=(hash(i,78)-.5)*590;const x=i<140?riverCenter(z)+(hash(i,76)>.5?1:-1)*(riverWidth(z)+3+hash(i,79)*5):(hash(i,75)-.5)*560;
   if(this.nearField(x,z,3)||this.inFarm(x,z)||this.nearRoad(x,z)||heightAt(x,z)<-.2)continue;const sc=.23+hash(i,77)*1.1;dummy.position.set(x,heightAt(x,z),z);dummy.scale.set(sc,sc,sc);dummy.rotation.set(hash(i,70),hash(i,71)*6.28,hash(i,72));dummy.updateMatrix();rocks.setMatrixAt(n++,dummy.matrix);
  }
  rocks.count=n;rocks.castShadow=true;rocks.receiveShadow=true;this.scene.add(rocks);
 }
 update(dt:number,time:number,drone:THREE.Vector3,weather:{rain:number;wind:THREE.Vector2;daylight:number},fields:FieldState[]=[]){
  this.uniforms.uTime.value=time;this.uniforms.uDrone.value.copy(drone);this.uniforms.uWind.value.copy(weather.wind).multiplyScalar(.28);this.uniforms.uRain.value=weather.rain;
  this.water.uniforms.uRain.value=weather.rain;this.water.uniforms.uDaylight.value=weather.daylight;const fog=this.scene.fog as THREE.Fog;if(fog){this.water.uniforms.uFogNear.value=fog.near;this.water.uniforms.uFogFar.value=fog.far;}
  this.structures.update(dt,time,weather.daylight);
  for(const batch of this.crops){const distance=Math.hypot(drone.x-batch.def.x,drone.z-batch.def.z);batch.mesh.castShadow=this.quality!=='LOW'&&distance<125;batch.mesh.geometry=this.quality!=='LOW'&&distance<(this.quality==='ULTRA'?165:115)?batch.highGeometry:batch.lowGeometry;}
  if(fields.length&&time-this.lastFieldSync>.55){this.updateFields(fields);this.lastFieldSync=time;}
  for(let i=0;i<20;i++){
   const t=time*.06+i*.4,r=22+(i%5)*4;dummy.position.set(-63+Math.cos(t)*r+i%3*5,23+Math.sin(t*1.3+i)*3+(i%4)*1.1,-29+Math.sin(t)*r*.7);dummy.rotation.set(0,-t,Math.sin(time*3+i)*.1);dummy.scale.setScalar(.55+(i%3)*.08);dummy.updateMatrix();this.birds.setMatrixAt(i,dummy.matrix);
  }
  this.birds.instanceMatrix.needsUpdate=true;
  // The entire six-triangle bird silhouette flexes, preserving a cheap flock draw call.
  const bp=this.birdsGeometry.getAttribute('position');bp.setY(0,Math.sin(time*5.6)*.32);bp.setY(5,Math.sin(time*5.6)*.32);bp.needsUpdate=true;
 }
}
