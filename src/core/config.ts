export type Tool = 'scan' | 'water' | 'seed';
export type Quality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';
export interface Settings { quality: Quality; volume: number; sensitivity: number; mode: 'ARCADE' | 'SIMULATION'; bloom: boolean; ao: boolean; hints: boolean; }
export const DEFAULT_SETTINGS: Settings = {quality:'HIGH',volume:0.35,sensitivity:1,mode:'ARCADE',bloom:true,ao:true,hints:true};
export interface FieldDef { id: number; name: string; crop: 'wheat'|'corn'|'sunflower'|'bare'; x: number; z: number; w: number; d: number; }
export const FIELD_DEFS: FieldDef[] = [
 {id:0,name:'Золотой колос',crop:'wheat',x:-35,z:10,w:70,d:48},
 {id:1,name:'Холмистые поля',crop:'corn',x:-105,z:-75,w:65,d:50},
 {id:2,name:'Солнечный склон',crop:'sunflower',x:40,z:-115,w:74,d:44},
 {id:3,name:'Новая земля',crop:'bare',x:158,z:-40,w:62,d:42}
];
export const PAD = {x:25,z:65};
export const PUMP = {x:65,z:65};
export const HANGAR = {x:45,z:92};
export const WORLD_SIZE = 600;
export const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));
export const damp = (a:number,b:number,k:number,dt:number) => a+(b-a)*(1-Math.exp(-k*dt));
export const randHash = (x:number,z:number) => {const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
export interface FlightTelemetry { x:number;y:number;z:number;altitude:number;speed:number;heading:number;grounded:boolean;camera:number; }
