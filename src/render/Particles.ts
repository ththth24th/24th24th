import * as THREE from 'three';
import { clamp } from '../core/config';

const COUNT=2200;
export class SpraySystem {
 private positions=new Float32Array(COUNT*3);private velocities=new Float32Array(COUNT*3);
 private lives=new Float32Array(COUNT);private sizes=new Float32Array(COUNT);private types=new Float32Array(COUNT);
 private geometry=new THREE.BufferGeometry();private points:THREE.Points;private head=0;private spawn=0;
 constructor(scene:THREE.Scene,private heightAt:(x:number,z:number)=>number){
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
  this.geometry.setAttribute('aLife',new THREE.BufferAttribute(this.lives,1));
  this.geometry.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1));
  this.geometry.setAttribute('aType',new THREE.BufferAttribute(this.types,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,
   uniforms:{uRatio:{value:Math.min(devicePixelRatio,1.6)},uDay:{value:1}},
   vertexShader:`attribute float aLife,aSize,aType;varying float vLife,vType;uniform float uRatio;
    void main(){vLife=aLife;vType=aType;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*220.*uRatio/max(2.,-mv.z),1.,35.);if(aLife<=0.)gl_PointSize=0.;}`,
   fragmentShader:`varying float vLife,vType;uniform float uDay;
    void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.||vLife<=0.)discard;float a=(1.-smoothstep(.0,1.,r))*clamp(vLife*3.,0.,1.);
    vec3 c=vType>1.5?vec3(.74,.55,.23):mix(vec3(.78,.92,.98),vec3(.64,.51,.31),vType);c*=.25+uDay*.85;
    gl_FragColor=vec4(c,a*(vType>1.5?.95:mix(.62,.16,vType)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
  });
  this.points=new THREE.Points(this.geometry,material);this.points.frustumCulled=false;scene.add(this.points);
 }
 private emit(p:THREE.Vector3,velocity:THREE.Vector3,dust:boolean,wind:THREE.Vector2,seed:boolean){
  const i=this.head;this.head=(this.head+1)%COUNT;const j=i*3;
  const a=Math.random()*Math.PI*2,r=Math.random();
  this.positions[j]=p.x+Math.cos(a)*(dust?2.8:1.2);
  this.positions[j+1]=p.y-(dust?p.y-this.heightAt(p.x,p.z)-.2:1.1);
  this.positions[j+2]=p.z+Math.sin(a)*(dust?2.8:1.2);
  this.velocities[j]=Math.cos(a)*(dust?2.5:3.5)*r+wind.x*.24+velocity.x*.2;
  this.velocities[j+1]=dust?.3+Math.random():-3.5-Math.random()*3;
  this.velocities[j+2]=Math.sin(a)*(dust?2.5:3.5)*r+wind.y*.24+velocity.z*.2;
  this.lives[i]=dust?1.8:2.5;this.sizes[i]=dust?.35+Math.random()*.45:seed?.09:.035+Math.random()*.09;this.types[i]=dust?1:seed?2:0;
 }
 update(dt:number,p:THREE.Vector3,v:THREE.Vector3,wind:THREE.Vector2,spraying:boolean,altitude:number,daylight:number,rain:number,seed=false){
  const dust=altitude>1.3&&altitude<5&&rain<.1&&v.lengthSq()>1;
  this.spawn+=dt*(spraying?650:dust?70:0);
  while(this.spawn>1){this.emit(p,v,!spraying,wind,seed);this.spawn--;}
  const pos=this.positions,vel=this.velocities;
  for(let i=0;i<COUNT;i++){
   if(this.lives[i]<=0)continue;const j=i*3;this.lives[i]-=dt;
   pos[j]+=vel[j]*dt;pos[j+1]+=vel[j+1]*dt;pos[j+2]+=vel[j+2]*dt;
   if(this.types[i]!==1){vel[j+1]-=4*dt;if(pos[j+1]<this.heightAt(pos[j],pos[j+2])+.1)this.lives[i]=0;}
  }
  this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.aLife.needsUpdate=true;
  this.geometry.attributes.aSize.needsUpdate=true;this.geometry.attributes.aType.needsUpdate=true;
  (this.points.material as THREE.ShaderMaterial).uniforms.uDay.value=daylight;
 }
}

export class RainSystem {
 private count=1000;private data=new Float32Array(this.count*6);private geometry=new THREE.BufferGeometry();
 private lines:THREE.LineSegments;private seeded=false;
 constructor(scene:THREE.Scene){
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.data,3));
  this.lines=new THREE.LineSegments(this.geometry,new THREE.LineBasicMaterial({color:0xb3cdd3,transparent:true,opacity:.3,depthWrite:false}));
  this.lines.frustumCulled=false;scene.add(this.lines);
 }
 update(dt:number,p:THREE.Vector3,rain:number,wind:THREE.Vector2){
  this.lines.visible=rain>.03;if(!this.lines.visible)return;
  (this.lines.material as THREE.LineBasicMaterial).opacity=.14+rain*.24;
  this.geometry.setDrawRange(0,Math.floor(this.count*rain)*2);
  for(let i=0;i<this.count;i++){
   const j=i*6;
   if(!this.seeded||this.data[j+1]<p.y-20||Math.abs(this.data[j]-p.x)>55||Math.abs(this.data[j+2]-p.z)>55){
    this.data[j]=p.x+(Math.random()-.5)*100;this.data[j+1]=p.y+Math.random()*50;this.data[j+2]=p.z+(Math.random()-.5)*100;
   }
   this.data[j]+=wind.x*dt;this.data[j+1]-=(25+rain*10)*dt;this.data[j+2]+=wind.y*dt;
   this.data[j+3]=this.data[j]-wind.x*.045;this.data[j+4]=this.data[j+1]+1.3;this.data[j+5]=this.data[j+2]-wind.y*.045;
  }
  this.seeded=true;this.geometry.attributes.position.needsUpdate=true;
 }
}

export class ScannerSystem {
 private line:THREE.LineLoop;private positions=new Float32Array(128*3);private geometry=new THREE.BufferGeometry();
 private disc:THREE.Mesh;private phase=0;
 constructor(scene:THREE.Scene,private heightAt:(x:number,z:number)=>number){
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
  this.line=new THREE.LineLoop(this.geometry,new THREE.LineBasicMaterial({color:0xc5ff84,transparent:true,opacity:.8,depthTest:true}));
  this.line.frustumCulled=false;
  this.disc=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.03,64),new THREE.MeshBasicMaterial({color:0xa7ef75,transparent:true,opacity:.06,depthWrite:false}));
  scene.add(this.line,this.disc);
 }
 update(dt:number,p:THREE.Vector3,active:boolean,using:boolean,radius:number){
  this.line.visible=active;this.disc.visible=active;
  if(!active)return;
  this.phase=(this.phase+dt*(using?.42:.16))%1;
  const r=radius*(.15+this.phase*.85);
  for(let i=0;i<128;i++){
   const a=i/128*Math.PI*2,x=p.x+Math.sin(a)*r,z=p.z+Math.cos(a)*r;
   this.positions[i*3]=x;this.positions[i*3+1]=this.heightAt(x,z)+.18;this.positions[i*3+2]=z;
  }
  this.geometry.attributes.position.needsUpdate=true;
  (this.line.material as THREE.LineBasicMaterial).opacity=clamp(1-this.phase,.1,.75);
  this.disc.position.set(p.x,this.heightAt(p.x,p.z)+.12,p.z);this.disc.scale.set(radius,1,radius);
 }
}
