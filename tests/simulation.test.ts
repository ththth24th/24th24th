import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/systems/Simulation';
import { SaveManager, type StorageLike } from '../src/systems/SaveManager';
import { DEFAULT_SETTINGS, PAD, PUMP, type FlightTelemetry, type Tool } from '../src/core/config';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
const flight = (overrides: Partial<FlightTelemetry> = {}): FlightTelemetry => ({ x: PAD.x, y: 0, z: PAD.z, altitude: 0, speed: 0, heading: 0, grounded: true, camera: 0, ...overrides });
function run(sim: Simulation, f: FlightTelemetry, seconds: number, tool: Tool = 'scan', using = false, wind = .6, step = .02) {
  for (let t = 0; t < seconds - 1e-8; t += step) sim.update(Math.min(step, seconds - t), f, { rain: 0, wind }, tool, using);
}
function firstMission(sim: Simulation) {
  run(sim, flight({ y: 8, altitude: 8, grounded: false }), .1);
  run(sim, flight({ y: 8, altitude: 8, grounded: false, camera: 1 }), .1);
  run(sim, flight({ camera: 1 }), .1);
}
function coverField(sim: Simulation, id: number, tool: Tool, seconds = 1.5, wind = .6) {
  const f = sim.fields[id];
  for (let i = 0; i < 80; i++) {
    const x = f.def.x - f.def.w / 2 + (i % 10 + .5) * f.def.w / 10;
    const z = f.def.z - f.def.d / 2 + (Math.floor(i / 10) + .5) * f.def.d / 8;
    // Correct the aim point for the same crosswind drift used by the water simulation.
    run(sim, flight({ x: x - (tool === 'water' ? wind * 4 * .24 : 0), z, y: 4, altitude: 4, grounded: false, speed: 4 }), seconds, tool, true, wind);
    if (sim.water < 3) sim.interact(flight({ x: PUMP.x, z: PUMP.z }));
  }
}

test('tutorial requires takeoff, camera change and a safe landing; rewards are paid once', () => {
  const sim = new Simulation(null);
  sim.nextMission();
  assert.equal(sim.missionIndex, 0);
  run(sim, flight(), 1);
  assert.equal(sim.mission.status, 'active');
  run(sim, flight({ altitude: 8, y: 8, grounded: false }), .1);
  run(sim, flight({ camera: 1, x: PAD.x + 40 }), .1);
  assert.equal(sim.mission.status, 'active');
  run(sim, flight({ camera: 1, speed: 8 }), .1);
  assert.equal(sim.mission.status, 'active');
  run(sim, flight({ camera: 1 }), .1);
  assert.equal(sim.mission.status, 'complete');
  assert.equal(sim.currency, 350);
  run(sim, flight({ camera: 1 }), 2);
  assert.equal(sim.currency, 350);
});

test('all five contracts need their real field operations and final activation', () => {
  const sim = new Simulation(null);
  firstMission(sim); sim.nextMission();
  coverField(sim, 0, 'scan', .02);
  assert.equal(sim.mission.status, 'active');
  coverField(sim, 0, 'water');
  assert.equal(sim.mission.status, 'complete');
  sim.nextMission();
  coverField(sim, 3, 'seed');
  assert.equal(sim.mission.status, 'complete');
  sim.nextMission();
  coverField(sim, 1, 'water', 1.5, 0);
  assert.equal(sim.mission.status, 'active', 'calm watering cannot complete the wind objective');
  coverField(sim, 1, 'water', 1.5, .6);
  assert.equal(sim.mission.status, 'complete');
  sim.nextMission();
  coverField(sim, 2, 'scan', .02);
  coverField(sim, 2, 'water', 2.4);
  assert.equal(sim.mission.status, 'active', 'restoration also needs activation back at base');
  assert.match(sim.interact(flight()), /ЗАПУЩЕН/);
  assert.equal(sim.mission.status, 'complete');
  assert.equal(sim.snapshot().campaignComplete, true);
  assert.ok(sim.currency > 5000);
});

test('tools require flight and a valid operating altitude; low tank never goes negative', () => {
  const sim = new Simulation(null);
  const f = sim.fields[0].def;
  run(sim, flight({ x: f.x, z: f.z }), 1, 'scan', true);
  run(sim, flight({ x: f.x, z: f.z, y: 50, altitude: 50, grounded: false }), 1, 'scan', true);
  assert.equal(sim.snapshot().fields[0].scanned, 0);
  const before = sim.water;
  run(sim, flight({ x: f.x, z: f.z, y: 20, altitude: 20, grounded: false }), 1, 'water', true);
  assert.equal(sim.water, before);
  sim.water = .01;
  run(sim, flight({ x: f.x, z: f.z, y: 4, altitude: 4, grounded: false }), 1, 'water', true);
  assert.equal(sim.water, 0);
  assert.match(sim.snapshot().warning, /Бак пуст/);
  sim.interact(flight({ x: PUMP.x, z: PUMP.z }));
  assert.equal(sim.water, sim.capacity);
});

test('upgrades charge the actual cost and change drone performance only at base', () => {
  const sim = new Simulation(null);
  sim.currency = 5000;
  const previous = sim.stats;
  assert.equal(sim.purchase('tank').ok, false);
  sim.interact(flight());
  const cost = sim.upgradeCost('tank');
  assert.equal(sim.purchase('tank').ok, true);
  assert.equal(sim.currency, 5000 - cost);
  assert.equal(sim.capacity, previous.tankCapacity + 35);
  assert.equal(sim.purchase('engines').ok, true);
  assert.ok(sim.stats.speedMultiplier > previous.speedMultiplier);
  assert.equal(sim.purchase('configuration').ok, false);
  sim.interact(flight({ x: PAD.x + 50 }));
  assert.equal(sim.purchase('battery').ok, false);
});

test('depletion allows emergency recovery and charging on the base', () => {
  const sim = new Simulation(null);
  sim.battery = 0;
  run(sim, flight({ x: 130, z: -70 }), .1);
  assert.equal(sim.emergency, true);
  assert.match(sim.interact(flight({ x: 130, z: -70 })), /^ЭВАКУАЦИЯ/);
  assert.equal(sim.battery, 25);
  run(sim, flight(), 5);
  assert.ok(Math.abs(sim.battery - 95) < 1e-8);
});

test('field simulation and consumption stay consistent across frame rates', () => {
  const a = new Simulation(null), b = new Simulation(null);
  const f = flight({ x: -35, z: 10, y: 5, altitude: 5, grounded: false });
  run(a, f, 4, 'water', true, .5, .01);
  run(b, f, 4, 'water', true, .5, .02);
  assert.ok(Math.abs(a.water - b.water) < 1e-8);
  assert.ok(Math.abs(a.battery - b.battery) < 1e-8);
  a.fields[0].cells.forEach((c, i) => {
    assert.ok(Math.abs(c.moisture - b.fields[0].cells[i].moisture) < 1e-6);
    assert.ok(Math.abs(c.health - b.fields[0].cells[i].health) < .001);
  });
});

test('save round trip preserves earned rewards and does not pay them twice', () => {
  const store = new MemoryStorage();
  const a = new Simulation(store);
  firstMission(a);
  assert.equal(a.save(flight({ camera: 1 })), true);
  assert.equal(a.saves.hasSave(), true);
  const b = new Simulation(store);
  assert.deepEqual(b.load(), flight({ camera: 1 }));
  assert.equal(b.currency, 350);
  assert.equal(b.mission.status, 'complete');
  run(b, flight({ camera: 1 }), .1);
  assert.equal(b.currency, 350);
  b.nextMission();
  assert.equal(b.missionIndex, 1);
});

test('corrupt and future saves are preserved, and invalid state cannot be saved', () => {
  const store = new MemoryStorage();
  const sim = new Simulation(store);
  store.setItem('agro-nova.save', '{truncated');
  assert.equal(sim.load(), null);
  assert.equal(sim.save(flight()), false);
  assert.equal(store.getItem('agro-nova.save'), '{truncated');
  const future = JSON.stringify({ version: 88, checksum: 'future', data: { future: true } });
  store.setItem('agro-nova.save', future);
  assert.equal(sim.load(), null);
  assert.equal(sim.save(flight()), false);
  assert.equal(store.getItem('agro-nova.save'), future);
  store.removeItem('agro-nova.save');
  sim.fields[0].cells[0].health = NaN;
  assert.equal(sim.save(flight()), false);
  assert.equal(store.getItem('agro-nova.save'), null);
});

test('settings persist independently and unavailable storage is handled', () => {
  const store = new MemoryStorage(), saves = new SaveManager(store);
  assert.equal(saves.saveSettings({ ...DEFAULT_SETTINGS, quality: 'LOW', sensitivity: 1.5 }), true);
  assert.equal(saves.loadSettings().quality, 'LOW');
  assert.equal(saves.hasSave(), false);
  const sim = new Simulation(null);
  assert.equal(sim.save(flight()), false);
  assert.equal(sim.load(), null);
});
