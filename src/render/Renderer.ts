import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Settings } from '../core/config';

const PRESETS = {
 LOW: {ratio:1,shadow:512,ao:false,bloom:false},
 MEDIUM: {ratio:1.25,shadow:1024,ao:false,bloom:true},
 HIGH: {ratio:1.6,shadow:2048,ao:true,bloom:true},
 ULTRA: {ratio:2,shadow:4096,ao:true,bloom:true}
};

/** Contact shadows belong to the nearby scene; distant haze must stay unoccluded. */
class LocalSSAOPass extends SSAOPass {
 override render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget){
  const camera=this.camera as THREE.PerspectiveCamera,far=camera.far;
  camera.far=110;camera.updateProjectionMatrix();
  this.ssaoMaterial.uniforms.cameraFar.value=camera.far;
  this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
  this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
  try{super.render(renderer,writeBuffer,readBuffer,0,false);}
  finally{camera.far=far;camera.updateProjectionMatrix();}
 }
}

export class Renderer {
 readonly renderer: THREE.WebGLRenderer;
 readonly scene = new THREE.Scene();
 readonly camera = new THREE.PerspectiveCamera(57, innerWidth/innerHeight, 0.15, 1800);
 readonly sun = new THREE.DirectionalLight(0xffe4b0, 3.2);
 readonly hemisphere = new THREE.HemisphereLight(0xc5e0ed,0x605944,2);
 readonly composer: EffectComposer;
 readonly ao: SSAOPass;
 readonly bloom: UnrealBloomPass;
 readonly grade: ShaderPass;
 private output: OutputPass;
 private environment: THREE.WebGLRenderTarget;
 private settings!: Settings;
 private resize = () => this.setSize();

 constructor(canvas: HTMLCanvasElement, settings: Settings) {
  this.renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure = 1.05;
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  this.renderer.info.autoReset=false;
  this.renderer.setClearColor(0xbed3d2);
  this.scene.fog = new THREE.Fog(0xc6d2c0, 160, 660);
  this.scene.add(this.hemisphere,this.sun,this.sun.target);
  this.sun.position.set(-150,120,-160);
  this.sun.castShadow=true;
  const s=this.sun.shadow;
  s.camera.left=-105;s.camera.right=105;s.camera.top=105;s.camera.bottom=-105;
  s.camera.near=1;s.camera.far=420;s.bias=-0.0002;s.normalBias=0.12;s.radius=2;
  const pmrem=new THREE.PMREMGenerator(this.renderer);
  const room=new RoomEnvironment();
  this.environment=pmrem.fromScene(room,0.04);
  this.scene.environment=this.environment.texture;
  this.scene.environmentIntensity=0.5;
  room.dispose();pmrem.dispose();
  this.composer = new EffectComposer(this.renderer);
  this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.ao = new LocalSSAOPass(this.scene,this.camera,innerWidth/2,innerHeight/2,16);
  this.ao.kernelRadius=2.4;this.ao.minDistance=0.0005;this.ao.maxDistance=0.035;
  this.ao.output=SSAOPass.OUTPUT.Default;
  this.composer.addPass(this.ao);
  this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.18,0.5,1.2);
  this.composer.addPass(this.bloom);
  this.grade=new ShaderPass({
   uniforms:{tDiffuse:{value:null},uScan:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform sampler2D tDiffuse;uniform float uScan;varying vec2 vUv;
   void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;
    float vignette=smoothstep(.83,.20,length((vUv-.5)*vec2(1.,.85)));
    c*=mix(.82,1.,vignette);c=mix(c,c*vec3(.88,1.06,1.02),uScan*.4);
    gl_FragColor=vec4(c,1.);}`
  });
  this.composer.addPass(this.grade);
  this.output=new OutputPass();this.composer.addPass(this.output);
  this.applySettings(settings);
  addEventListener('resize',this.resize);
 }
 applySettings(settings:Settings){
  const old=this.settings?.quality;
  this.settings={...settings};
  const p=PRESETS[settings.quality];
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,p.ratio));
  this.ao.enabled=p.ao&&settings.ao;this.bloom.enabled=p.bloom&&settings.bloom;
  this.bloom.strength=settings.quality==='ULTRA'?.23:.16;
  if(old!==settings.quality){
   this.sun.shadow.mapSize.set(p.shadow,p.shadow);
   this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
   this.sun.shadow.needsUpdate=true;
  }
  this.setSize();
 }
 setSize(){
  const w=innerWidth,h=innerHeight;
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.setSize(w,h);this.composer.setPixelRatio(this.renderer.getPixelRatio());
  this.composer.setSize(w,h);
  this.ao.setSize(Math.ceil(w*this.renderer.getPixelRatio()/2),Math.ceil(h*this.renderer.getPixelRatio()/2));
 }
 render(scan:boolean){
  this.renderer.info.reset();this.grade.uniforms.uScan.value=scan?1:0;
  // Chase/FPV cameras animate FOV. AO reconstruction must use this frame's projection.
  this.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
  this.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
  this.composer.render();
 }
 dispose(){
  removeEventListener('resize',this.resize);
  this.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();if(m.material){const materials=Array.isArray(m.material)?m.material:[m.material];materials.forEach(v=>v.dispose());}});
  this.environment.dispose();this.composer.dispose();this.renderer.dispose();
 }
}
