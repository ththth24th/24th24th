import * as THREE from 'three';
import { damp, type WeatherKind } from '../core/config';
import type { Renderer } from './Renderer';

export class WeatherSystem {
 kind:WeatherKind='clear';rain=0;clouds=.16;windStrength=.18;
 readonly wind=new THREE.Vector2(0.9,0.12);
 private elapsed=0;private cycle=0;private forced=false;
 private kinds:WeatherKind[]=['clear','cloudy','rain','storm'];
 private desired:WeatherKind='clear';
 update(dt:number,crosswind=false){
  this.elapsed+=dt;
  if(!this.forced&&this.elapsed>160){this.elapsed=0;this.cycle=(this.cycle+1)%4;this.desired=this.kinds[this.cycle];}
  this.kind=this.desired;
  const r=this.kind==='rain'?.65:this.kind==='storm'?1:0;
  const c=this.kind==='clear'?.15:this.kind==='cloudy'?.65:.95;
  this.rain=damp(this.rain,r,.13,dt);this.clouds=damp(this.clouds,c,.1,dt);
  const w=crosswind?.7:this.kind==='storm'?.9:this.kind==='rain'?.53:.18;
  this.windStrength=damp(this.windStrength,w,.7,dt);
  this.wind.set(this.windStrength*5*(1+.15*Math.sin(performance.now()*.0008)),.35*Math.sin(performance.now()*.0001));
 }
 cycleWeather(){this.forced=true;this.desired=this.kinds[(this.kinds.indexOf(this.desired)+1)%4];return this.label;}
 set(kind:WeatherKind){this.desired=kind;this.forced=true;}
 get label(){return {clear:'Ясно',cloudy:'Облачно',rain:'Дождь',storm:'Гроза'}[this.desired];}
}

export class DayNightSystem {
 hour=16.6;daylight=1;
 update(dt:number){this.hour=(this.hour+dt/65)%24;this.daylight=THREE.MathUtils.smoothstep(Math.sin((this.hour-6)/24*Math.PI*2),-.16,.35);}
 jump(){this.hour=(this.hour+4)%24;this.update(0);}
 get label(){const h=Math.floor(this.hour),m=Math.floor((this.hour-h)*60);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
}

export class Atmosphere {
 readonly weather=new WeatherSystem();readonly day=new DayNightSystem();
 private sky:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
 private flash=0;private lightningTimer=18;
 private sunDirection=new THREE.Vector3();private fogDay=new THREE.Color(0xbfcdd0);private fogNight=new THREE.Color(0x101d32);private fogRain=new THREE.Color(0x697e88);
 constructor(private render:Renderer){
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(1400,32,20),new THREE.ShaderMaterial({
   side:THREE.BackSide,depthWrite:false,fog:false,
   uniforms:{uTime:{value:0},uSun:{value:new THREE.Vector3()},uDay:{value:1},uCloud:{value:.16},uRain:{value:0},uFlash:{value:0}},
   vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`varying vec3 vDir;uniform float uTime,uDay,uCloud,uRain,uFlash;uniform vec3 uSun;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+vec2(12.4,3.7);a*=.5;}return n;}
   void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);float gold=pow(1.-clamp(abs(uSun.y)*1.5,0.,1.),3.);
    vec3 zen=mix(vec3(.006,.015,.042),vec3(.19,.39,.60),uDay);
    vec3 hor=mix(vec3(.025,.04,.085),mix(vec3(.73,.82,.78),vec3(1.,.66,.35),gold*.7),uDay);
    vec3 col=mix(hor,zen,pow(h,.48));
    float sun=max(dot(d,uSun),0.);col+=vec3(1.,.75,.35)*pow(sun,1600.)*8.*uDay;
    col+=vec3(1.,.69,.34)*pow(sun,10.)*.3*uDay;
    vec2 p=d.xz/max(.1,d.y+.13)*2.6+vec2(uTime*.003,uTime*.001);
    float n=fbm(p);float cl=smoothstep(.72-uCloud*.45,.82-uCloud*.4,n)*smoothstep(.0,.14,d.y);
    vec3 clouds=mix(vec3(.025,.04,.07),mix(vec3(.95,.91,.79),vec3(.35,.42,.47),uRain),uDay);
    clouds*=.76+.36*fbm(p+vec2(.8,-.2));col=mix(col,clouds,cl*.92);
    col=mix(col,col*vec3(.65,.78,.9),uRain*.5);
    float stars=step(.9987,hash(floor(d.xz/(d.y+.15)*400.)))*(1.-uDay)*smoothstep(.0,.2,d.y);col+=stars*.65;
    float moon=max(dot(d,normalize(vec3(.35,.52,-.6))),0.);col+=vec3(.6,.75,1.)*pow(moon,2400.)*(1.-uDay);
    col+=uFlash*.65;gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
  }));
  this.sky.frustumCulled=false;this.sky.renderOrder=-10;render.scene.add(this.sky);
 }
 update(dt:number,time:number,target:THREE.Vector3,crosswind=false){
  this.weather.update(dt,crosswind);this.day.update(dt);
  const {weather:w,day:d,render:r}=this;
  const angle=(d.hour-6)/24*Math.PI*2;
  this.sunDirection.set(-Math.cos(angle)*.65,Math.sin(angle),-.45).normalize();
  r.sun.position.copy(target).addScaledVector(this.sunDirection,230);
  r.sun.target.position.copy(target);
  r.sun.intensity=(.08+d.daylight*4)*(1-w.rain*.77)+this.flash*6;
  r.sun.color.set(d.hour>15&&d.hour<19?0xffd49b:0xffefda);
  r.hemisphere.intensity=(.25+d.daylight*1.15)*(1-w.rain*.42);
  r.scene.environmentIntensity=.15+d.daylight*.3;
  r.renderer.toneMappingExposure=.84+d.daylight*.24;
  const fog=r.scene.fog as THREE.Fog;
  fog.color.copy(this.fogNight).lerp(this.fogDay,d.daylight).lerp(this.fogRain,w.rain*.78);
  fog.near=190-w.rain*125;fog.far=660-w.rain*320;
  if(d.hour>5&&d.hour<8){fog.near=80;fog.far=390;}
  this.lightningTimer-=dt;
  if(w.rain>.8&&this.lightningTimer<0){this.flash=1;this.lightningTimer=12+Math.random()*15;}
  this.flash=Math.max(0,this.flash-dt*4);
  const u=this.sky.material.uniforms;
  u.uTime.value=time;u.uSun.value.copy(this.sunDirection);u.uDay.value=d.daylight;u.uCloud.value=w.clouds;u.uRain.value=w.rain;u.uFlash.value=this.flash;
  this.sky.position.set(target.x,0,target.z);
 }
}
