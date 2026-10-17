import * as THREE from 'three';
import { FIELD_DEFS, PAD, type Settings, type Tool } from './config';
import { Renderer } from '../render/Renderer';
import { Atmosphere } from '../render/Atmosphere';
import { SpraySystem, RainSystem, ScannerSystem } from '../render/Particles';
import { AudioManager } from '../render/AudioManager';
import { World } from '../world/World';
import { heightAt } from '../world/Terrain';
import { DroneController } from '../drone/DroneController';
import { CameraController } from '../drone/CameraController';
import { InputManager } from '../drone/InputManager';
import { Simulation, type UpgradeKey } from '../systems/Simulation';
import { UIManager } from '../ui/UIManager';

export class Game {
 readonly sim=new Simulation();
 readonly render:Renderer;readonly world:World;readonly drone:DroneController;
 readonly input:InputManager;readonly cameras:CameraController;readonly atmosphere:Atmosphere;
 readonly audio=new AudioManager();readonly ui:UIManager;
 private spray:SpraySystem;private rain:RainSystem;private scanner:ScannerSystem;
 settings:Settings;tool:Tool='scan';mode:'menu'|'play'|'pause'='menu';
 private started=false;private saveBlocked=false;private time=0;private last=performance.now();private accumulator=0;
 private uiTimer=0;private saveTimer=0;private lastResult=-1;private fps=0;private fpsFrames=0;private fpsTime=0;
 private lastWarning='';private waypoint=document.createElement('div');private waypointPosition=new THREE.Vector3();
 private animation=0;

 constructor(canvas:HTMLCanvasElement,root:HTMLElement){
  this.settings=this.sim.saves.loadSettings();
  this.render=new Renderer(canvas,this.settings);
  this.atmosphere=new Atmosphere(this.render);
  this.world=new World(this.render.scene);
  this.world.setQuality(this.settings.quality);
  this.drone=new DroneController(this.render.scene,heightAt,this.world.colliders);
  this.input=new InputManager(canvas,(name)=>this.action(name));this.input.enabled=false;
  this.cameras=new CameraController(this.render.camera,heightAt,this.world.colliders);
  this.spray=new SpraySystem(this.render.scene,heightAt);
  this.rain=new RainSystem(this.render.scene);
  this.scanner=new ScannerSystem(this.render.scene,heightAt);
  this.ui=new UIManager(root,{action:(name,payload)=>this.action(name,payload)},this.settings,this.sim.saves.hasSave());
  this.ui.setMode('menu');this.audio.setVolume(this.settings.volume);
  this.waypoint.className='world-waypoint';document.body.append(this.waypoint);
  this.world.updateFields(this.sim.fields);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started){this.save(false);this.pause();}});
  addEventListener('pagehide',()=>{if(this.started)this.save(false);});
  this.animation=requestAnimationFrame(this.frame);
  if(import.meta.env.DEV)(window as unknown as Record<string,unknown>).__AGRO_DEBUG__={game:this,sim:this.sim,drone:this.drone,input:this.input,render:this.render,world:this.world,atmosphere:this.atmosphere};
 }

 private begin(continuing:boolean){
  this.saveBlocked=false;
  if(continuing){
   const flight=this.sim.load();
   if(!flight){this.ui.toast(this.sim.saves.lastError||'Сохранение не найдено.');return;}
   this.drone.reset(flight);this.cameras.mode=flight.camera as 0|1|2;
   this.input.yaw=-flight.heading*Math.PI/180;this.drone.yaw=this.input.yaw;
   this.drone.group.rotation.y=this.input.yaw;
  }else{
   if(!this.sim.saves.clear())this.saveBlocked=true;
   this.sim.reset();this.drone.reset();this.cameras.mode=0;this.input.yaw=0;this.input.pitch=.3;
   this.atmosphere.day.hour=16.6;
  }
  this.started=true;this.tool='scan';this.lastResult=-1;
  this.drone.setConfiguration(this.sim.configuration);
  this.world.updateFields(this.sim.fields);
  this.resume();this.audio.start();this.save(false);
  this.ui.toast(continuing?'Прогресс восстановлен. Долина ждёт.':'Добро пожаловать в долину. Удерживайте Пробел для взлёта.');
  if(this.saveBlocked)this.ui.toast('Прежнее сохранение имеет другой формат и сохранено без изменений. Новый полёт доступен без автосохранения.');
 }

 private pause(panel='pause'){
  if(!this.started)return;
  this.mode='pause';this.input.enabled=false;this.ui.setMode('pause');this.ui.openPanel(panel);
 }
 private resume(){
  this.mode='play';this.ui.closePanel();this.ui.setMode('play');this.input.enabled=true;
  this.audio.start();
 }
 private panel(name:string){
  if(this.started)this.pause(name);
  else this.ui.openPanel(name);
 }
 private closePanel(){if(this.started)this.resume();else{this.ui.closePanel();this.ui.setMode('menu');}}
 private save(notify=true){
  if(this.saveBlocked){if(notify)this.ui.toast('Автосохранение отключено: прежние данные сохранены без изменений.');return false;}
  const ok=this.sim.save(this.drone.telemetry);
  if(ok)this.ui.setHasSave(true);
  if(notify)this.ui.toast(ok?'Прогресс сохранён.':this.sim.saves.lastError||'Не удалось сохранить прогресс.');
  return ok;
 }

 action(name:string,payload?:any){
  if(name.startsWith('tool:')){payload=name.slice(5);name='tool';}
  if(name==='new'){this.begin(false);return;}
  if(name==='continue'){this.begin(true);return;}
  if(name==='resume'||name==='close'){this.closePanel();return;}
  if(name==='pause'){
   if(this.mode==='play')this.pause();else if(this.started)this.resume();else this.ui.closePanel();return;
  }
  if(name==='settings'||name==='controls'){this.panel(name);return;}
  if(name==='setting'){
   const allowed=['quality','volume','sensitivity','mode','bloom','ao','hints'];
   if(!payload||!allowed.includes(payload.key))return;
   const candidate={...this.settings,[payload.key]:payload.value};
   if(!this.sim.saves.saveSettings(candidate)){this.ui.toast('Не удалось сохранить настройку.');return;}
   this.settings=candidate;this.ui.updateSettings(this.settings);
   this.render.applySettings(this.settings);this.world.setQuality(this.settings.quality);this.audio.setVolume(this.settings.volume);this.audio.cue('click');return;
  }
  if(name==='menu'){
   if(this.started)this.save(false);
   this.started=false;this.mode='menu';this.input.enabled=false;this.ui.closePanel();this.ui.setMode('menu');return;
  }
  if(!this.started)return;
  if(name==='tool'&&['scan','water','seed'].includes(payload)){this.tool=payload;this.audio.cue('click');return;}
  if(name==='camera'){this.cameras.cycle();this.audio.cue('click');return;}
  if(name==='save'){this.save();return;}
  if(name==='map'||name==='mission'){this.panel(name);return;}
  if(name==='hangar'){
   if(!this.drone.telemetry.grounded||Math.hypot(this.drone.position.x-PAD.x,this.drone.position.z-PAD.z)>14){this.ui.toast('Для доступа в ангар приземлитесь на площадку базы.');return;}
   this.panel('hangar');return;
  }
  if(name==='interact'){
   const message=this.sim.interact(this.drone.telemetry);
   if(message.startsWith('ЭВАКУАЦИЯ'))this.drone.reset();
   this.ui.toast(message);this.audio.cue('click');return;
  }
  if(name==='upgrade'||name==='configure'){
   const result=this.sim.purchase(name==='configure'?'configuration':payload as UpgradeKey);
   this.ui.toast(result.message);this.audio.cue(result.ok?'success':'error');
   if(result.ok){this.drone.setConfiguration(this.sim.configuration);this.save(false);}return;
  }
  if(name==='nextMission'){
   if(this.sim.snapshot().campaignComplete){this.ui.closePanel();this.resume();return;}
   this.sim.nextMission();this.closePanel();this.save(false);
   this.ui.toast(`Контракт ${this.sim.missionIndex+1}: ${this.sim.mission.title}`);return;
  }
  if(name==='time'){this.atmosphere.day.jump();this.ui.toast(`Время суток · ${this.atmosphere.day.label}`);return;}
  if(name==='weather'){this.ui.toast(`Погода · ${this.atmosphere.weather.cycleWeather()}`);return;}
 }

 private frame=(now:number)=>{
  this.animation=requestAnimationFrame(this.frame);
  const elapsed=Math.max(0,(now-this.last)/1000),dt=Math.min(.08,elapsed);this.last=now;this.time+=dt;
  const active=this.mode==='play';
  this.fpsFrames++;this.fpsTime+=elapsed;if(this.fpsTime>.7){this.fps=this.fpsFrames/this.fpsTime;this.fpsFrames=0;this.fpsTime=0;}
  const envdt=this.mode==='pause'?0:dt;
  this.atmosphere.update(envdt,this.time,this.drone.position,this.sim.missionIndex===3);
  const weather=this.atmosphere.weather,day=this.atmosphere.day;
  if(active){
   this.accumulator+=dt;
   while(this.accumulator>=1/60){
    this.drone.update(1/60,this.input,this.settings,weather.wind,this.sim.water/this.sim.capacity,this.sim.upgrades,this.sim.battery);
    this.drone.telemetry.camera=this.cameras.mode;
    this.sim.update(1/60,this.drone.telemetry,{rain:weather.rain,wind:weather.windStrength},this.tool,this.input.mouseDown);
    this.accumulator-=1/60;
   }
   this.saveTimer+=dt;if(this.saveTimer>12){this.saveTimer=0;this.save(false);}
  }else{this.accumulator=0;if(this.mode==='menu')this.drone.update(dt,this.input,this.settings,new THREE.Vector2(),this.sim.water/this.sim.capacity,this.sim.upgrades,100);}
  this.cameras.update(dt,this.drone,this.input,this.mode==='menu',this.time);
  this.world.update(envdt,this.time,this.drone.position,{rain:weather.rain,wind:weather.wind,daylight:day.daylight},this.sim.fields);
  this.world.setScanner(active&&this.tool==='scan');
  const using=active&&this.input.mouseDown&&!this.sim.emergency;
  const spraying=using&&this.tool!=='scan'&&this.sim.water>0&&this.drone.telemetry.altitude>=.8&&this.drone.telemetry.altitude<=12;
  this.spray.update(envdt,this.drone.position,this.drone.velocity,weather.wind,spraying,this.drone.telemetry.altitude,day.daylight,weather.rain,this.tool==='seed');
  this.rain.update(envdt,this.drone.position,weather.rain,weather.wind);
  this.scanner.update(envdt,this.drone.position,active&&this.tool==='scan',using,this.sim.scannerRadius);
  this.audio.update(dt,{speed:this.drone.telemetry.speed,throttle:this.drone.telemetry.grounded?.05:.4+this.drone.telemetry.speed/35,rain:weather.rain,wind:weather.windStrength,spraying,playing:active,daylight:day.daylight});
  this.uiTimer+=dt;
  if(this.uiTimer>.1){
   this.uiTimer=0;const snapshot=this.sim.snapshot();
   this.ui.update({...snapshot,flight:this.drone.telemetry,tool:this.tool,weather:{label:weather.label,wind:weather.wind.length(),temp:Math.round(22-weather.rain*7),rain:weather.rain},time:day.label,settings:this.settings,fps:this.fps});
   if(this.started&&snapshot.warning&&snapshot.warning!==this.lastWarning)this.ui.toast(snapshot.warning);
   this.lastWarning=snapshot.warning;
   if(this.started&&snapshot.mission.status==='complete'&&this.lastResult!==this.sim.missionIndex){
    this.lastResult=this.sim.missionIndex;this.save(false);this.audio.cue('success');
    this.mode='pause';this.input.enabled=false;this.ui.setMode('pause');this.ui.showResult(snapshot.mission.result);
   }
   const extendedWorld=this.world as World&{setTechOnline?:(online:boolean)=>void};extendedWorld.setTechOnline?.(snapshot.techOnline);
  }
  this.updateWaypoint();
  this.render.render(active&&this.tool==='scan');
 };

 private updateWaypoint(){
  if(this.mode!=='play'){this.waypoint.style.display='none';return;}
  const mission=this.sim.mission,field=mission.targetFieldId===null?null:FIELD_DEFS[mission.targetFieldId];
  const point=field??PAD,dist=Math.hypot(point.x-this.drone.position.x,point.z-this.drone.position.z);
  this.waypointPosition.set(point.x,heightAt(point.x,point.z)+5,point.z).project(this.render.camera);
  if(this.waypointPosition.z>1||this.waypointPosition.z< -1||Math.abs(this.waypointPosition.x)>.92||Math.abs(this.waypointPosition.y)>.82||dist<14){this.waypoint.style.display='none';return;}
  this.waypoint.style.display='block';this.waypoint.style.left=`${(this.waypointPosition.x*.5+.5)*100}%`;this.waypoint.style.top=`${(-this.waypointPosition.y*.5+.5)*100}%`;
  this.waypoint.innerHTML=`<i>◇</i><span>${field?.name??'База NOVA'}<small>${Math.round(dist)} м</small></span>`;
 }
 dispose(){cancelAnimationFrame(this.animation);this.input.dispose();this.audio.dispose();this.render.dispose();}
}
