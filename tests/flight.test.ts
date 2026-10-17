import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector2 } from 'three';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/config';
import { DroneController, type FlightCollider } from '../src/drone/DroneController';
import type { InputManager } from '../src/drone/InputManager';

function flight(options: { heightAt?: (x: number, z: number) => number; colliders?: FlightCollider[]; upgrades?: Record<string, number>; settings?: Settings; wind?: Vector2 } = {}) {
  const heightAt = options.heightAt ?? (() => 0);
  const drone = new DroneController(new Scene(), heightAt, options.colliders);
  drone.reset({ x: 0, y: heightAt(0, 0) + 1.4, z: 0 });
  const input = { keys: new Set<string>(), enabled: true, yaw: 0, sensitivity: 1 } as InputManager;
  const advance = (seconds: number, battery = 100) => {
    for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
      drone.update(1 / 60, input, options.settings ?? DEFAULT_SETTINGS, options.wind ?? new Vector2(), 1, options.upgrades ?? {}, battery);
    }
  };
  return { drone, input, advance };
}

test('space takes off, releasing controls arrests climb and holds altitude', () => {
  const { drone, input, advance } = flight();
  assert.equal(drone.telemetry.grounded, true);
  input.keys.add('Space');
  advance(2);
  const climbingAltitude = drone.telemetry.altitude;
  assert.ok(climbingAltitude > 7, 'a normal takeoff gains usable working altitude');
  assert.equal(drone.telemetry.grounded, false);
  input.keys.clear();
  advance(4);
  const heldAltitude = drone.telemetry.altitude;
  assert.ok(heldAltitude > climbingAltitude && heldAltitude < climbingAltitude + 2, 'climb momentum arrests smoothly');
  advance(5);
  assert.ok(Math.abs(drone.telemetry.altitude - heldAltitude) < 0.05, 'height remains stable without vertical input');
});

test('horizontal flight accelerates progressively and brakes with inertia', () => {
  const { drone, input, advance } = flight();
  drone.reset({ x: 0, y: 12, z: 0 });
  input.keys.add('KeyW');
  advance(1 / 60);
  assert.ok(drone.telemetry.speed > 0 && drone.telemetry.speed < 1, 'velocity is accelerated rather than teleported');
  advance(3);
  assert.ok(drone.telemetry.speed > 12 && drone.telemetry.speed <= 13.5);
  const cruisingSpeed = drone.telemetry.speed;
  input.keys.clear();
  advance(1 / 60);
  assert.ok(drone.telemetry.speed > cruisingSpeed * 0.9, 'releasing controls preserves short-term momentum');
  advance(4);
  assert.ok(drone.telemetry.speed < 0.1, 'flight controller eventually arrests horizontal drift');
});

test('purchased engines increase cruise speed and stability reduces storm drift', () => {
  const basic = flight();
  const upgraded = flight({ upgrades: { engines: 2 } });
  for (const rig of [basic, upgraded]) {
    rig.drone.reset({ x: 0, y: 12, z: 0 });
    rig.input.keys.add('KeyW');
    rig.advance(6);
  }
  assert.ok(upgraded.drone.telemetry.speed > basic.drone.telemetry.speed * 1.2, 'the actual engines upgrade improves the flight controller');
  const settings = { ...DEFAULT_SETTINGS, mode: 'SIMULATION' as const };
  const standard = flight({ settings, wind: new Vector2(8, 0) });
  const stable = flight({ settings, wind: new Vector2(8, 0), upgrades: { stability: 3 } });
  for (const rig of [standard, stable]) { rig.drone.reset({ x: 0, y: 12, z: 0 }); rig.advance(5); }
  assert.ok(stable.drone.position.x < standard.drone.position.x * 0.6, 'stabilizer upgrades counter environmental wind');
});

test('battery reserve descends to a safe landing on uneven terrain', () => {
  const heightAt = (x: number, z: number) => 3 + x * 0.035 - z * 0.018;
  const { drone, input, advance } = flight({ heightAt });
  drone.reset({ x: 14, y: 25, z: -8 });
  input.keys.add('Space');
  advance(20, 0);
  assert.equal(drone.telemetry.grounded, true, 'exhausted batteries override ascent input');
  assert.ok(Math.abs(drone.position.y - (heightAt(drone.position.x, drone.position.z) + 1.4)) < 0.001);
  assert.ok(drone.velocity.y >= 0, 'safe landing removes downward velocity');
});

test('building collisions keep the airframe outside the wall and terrain remains solid', () => {
  const collider = { x: 0, z: -15, r: 4, height: 15 };
  const rig = flight({ colliders: [collider] });
  rig.drone.reset({ x: 0, y: 6, z: 0 });
  rig.input.keys.add('KeyW');
  rig.advance(4);
  const distance = Math.hypot(rig.drone.position.x - collider.x, rig.drone.position.z - collider.z);
  assert.ok(distance >= collider.r + 2.19, 'rotor clearance remains outside the collider');
  assert.ok(rig.drone.position.z > collider.z, 'the drone cannot tunnel through a building');

  const heightAt = (_x: number, z: number) => Math.max(0, -z * 0.6);
  const hillside = flight({ heightAt });
  hillside.drone.reset({ x: 0, y: 9, z: 0 });
  hillside.input.keys.add('KeyW');
  for (let i = 0; i < 180; i++) {
    hillside.advance(1 / 60);
    assert.ok(hillside.drone.position.y >= heightAt(hillside.drone.position.x, hillside.drone.position.z) + 1.4 - 1e-9);
  }
});
