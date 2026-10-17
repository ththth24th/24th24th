import { FIELD_DEFS, clamp } from '../core/config';

/** Shared terrain equation, used by both rendering and flight collision. */
export function riverCenter(z: number): number {
  return 95 + Math.sin(z * 0.02) * 14 - 30 * Math.exp(-((z - 65) ** 2) / 2400);
}
export function riverWidth(z: number): number { return 9.5 + Math.sin(z * .037) * 1.6; }
const smooth = (a: number, b: number, v: number) => { const t = clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
export function heightAt(x: number, z: number): number {
  const edge = smooth(130, 300, Math.hypot(x * .9,z));
  let h = 2 + Math.sin(x*.026)*Math.cos(z*.021)*2.8 + Math.sin((x+z)*.061)*.55;
  h += edge * (12 + Math.sin(x*.018+1)*Math.cos(z*.014)*17 + Math.sin(z*.028)*7);
  for(const f of FIELD_DEFS) {
    const d = Math.max(Math.abs(x-f.x)-f.w*.5, Math.abs(z-f.z)-f.d*.5);
    h = 2 + (h-2)*smooth(2,15,d);
  }
  // A level farmyard, wide enough for buildings, the drone pad and access lanes.
  const farmD = Math.max(Math.abs(x-24)-65,Math.abs(z-87)-42);
  h = 2 + (h-2)*smooth(0,16,farmD);
  const rd=Math.abs(x-riverCenter(z));
  const rw=riverWidth(z);
  if(rd<rw+9) h=h+( -2.2 - h )*(1-smooth(rw-4,rw+9,rd));
  const pond=Math.sqrt(((x-120)/34)**2+((z-145)/24)**2);
  if(pond<1.24) h=h+(-2.5-h)*(1-smooth(.78,1.24,pond));
  const pumpBank=Math.hypot(x-65,z-65);
  h += (2-h)*(1-smooth(4,7.5,pumpBank));
  return h;
}
