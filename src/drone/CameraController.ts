import * as THREE from 'three';
import { clamp } from '../core/config';
import type { DroneController, FlightCollider } from './DroneController';
import type { InputManager } from './InputManager';

export class CameraController {
  mode: 0 | 1 | 2 = 0;
  private readonly lookAt = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private readonly boom = new THREE.Vector3();
  private readonly sample = new THREE.Vector3();
  private initialized = false;
  private wasMenu = true;
  private previousMode: number = -1;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly heightAt: (x: number, z: number) => number, private readonly colliders: FlightCollider[] = []) {}

  cycle(): number { this.mode = ((this.mode + 1) % 3) as 0 | 1 | 2; return this.mode; }

  update(dt: number, drone: DroneController, input: InputManager, menu: boolean, time: number) {
    dt = clamp(dt, 0, 0.08);
    const target = this.target;
    const focus = this.focus.copy(drone.position);
    const speed = drone.telemetry.speed;
    if (menu) {
      const angle = time * 0.015;
      target.set(70 + Math.sin(angle) * 21, 48 + Math.sin(time * 0.07) * 2, 145 + Math.cos(angle) * 12);
      focus.set(-31, 2, -1);
    } else if (this.mode === 0) {
      const distance = input.aiming ? 7.8 : 11.8 + speed * 0.13;
      const pitch = clamp(input.pitch, -0.22, 1.15);
      target.set(
        drone.position.x + Math.sin(input.yaw) * Math.cos(pitch) * distance,
        drone.position.y + 2.2 + Math.sin(pitch) * distance,
        drone.position.z + Math.cos(input.yaw) * Math.cos(pitch) * distance,
      );
      focus.y += 0.4;
      focus.x -= Math.sin(input.yaw) * (input.aiming ? 6 : 2);
      focus.z -= Math.cos(input.yaw) * (input.aiming ? 6 : 2);
      this.avoidObstacles(drone.position, target);
    } else if (this.mode === 1) {
      const distance = input.aiming ? 25 : 38;
      target.set(drone.position.x + Math.sin(input.yaw) * 6, drone.position.y + distance, drone.position.z + Math.cos(input.yaw) * 6);
      focus.x -= Math.sin(input.yaw) * 3; focus.z -= Math.cos(input.yaw) * 3;
    } else {
      target.set(drone.position.x - Math.sin(drone.yaw) * 1.23, drone.position.y - 0.42, drone.position.z - Math.cos(drone.yaw) * 1.23);
      const pitch = clamp(input.pitch - 0.3, -0.9, 1.02);
      focus.set(target.x - Math.sin(input.yaw) * Math.cos(pitch) * 30, target.y - Math.sin(pitch) * 30, target.z - Math.cos(input.yaw) * Math.cos(pitch) * 30);
    }
    target.y = Math.max(target.y, this.heightAt(target.x, target.z) + 1.0);
    const snap = !this.initialized || this.wasMenu !== menu || this.previousMode !== this.mode;
    const smoothing = 1 - Math.exp(-(menu ? 1.2 : this.mode === 2 ? 18 : 5) * dt);
    if (snap) { this.camera.position.copy(target); this.lookAt.copy(focus); this.initialized = true; }
    else { this.camera.position.lerp(target, smoothing); this.lookAt.lerp(focus, smoothing); }
    this.camera.position.y = Math.max(this.camera.position.y, this.heightAt(this.camera.position.x, this.camera.position.z) + 0.8);
    this.camera.lookAt(this.lookAt);
    const fov = menu ? 48 : this.mode === 2 ? 82 : this.mode === 1 ? 48 : input.aiming ? 45 : 58 + speed * 0.3;
    const nextFov = this.camera.fov + (fov - this.camera.fov) * smoothing;
    if (Math.abs(nextFov - this.camera.fov) > 0.005) { this.camera.fov = nextFov; this.camera.updateProjectionMatrix(); }
    drone.group.visible = menu || this.mode !== 2;
    drone.telemetry.camera = this.mode;
    this.wasMenu = menu; this.previousMode = this.mode;
  }

  private avoidObstacles(origin: THREE.Vector3, target: THREE.Vector3) {
    // Shorten the boom before it can enter terrain or a farm building.
    const desired = this.boom.copy(target);
    for (let i = 1; i <= 20; i++) {
      const ratio = i / 20;
      const point = this.sample.lerpVectors(origin, desired, ratio);
      let blocked = point.y < this.heightAt(point.x, point.z) + 1;
      if (!blocked) for (const collider of this.colliders) {
        if (point.y < this.heightAt(collider.x, collider.z) + collider.height + 1 && Math.hypot(point.x - collider.x, point.z - collider.z) < collider.r + 0.9) { blocked = true; break; }
      }
      if (blocked) { target.copy(origin).lerp(desired, Math.max(0.16, ratio - 0.09)); target.y = Math.max(target.y, origin.y + 1.1); break; }
    }
  }
}
