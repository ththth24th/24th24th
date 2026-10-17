import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, damp, PAD, type FlightTelemetry, type Settings } from '../core/config';
import type { InputManager } from './InputManager';

export interface FlightCollider { x: number; z: number; r: number; height: number; }

/** Position is the airframe centre; skids touch terrain at centre height 1.4m. */
export class DroneController {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  readonly velocity = new THREE.Vector3();
  readonly telemetry: FlightTelemetry = { x: 0, y: 0, z: 0, altitude: 0, speed: 0, heading: 0, grounded: true, camera: 0 };
  yaw = 0;
  private readonly rig = new THREE.Group();
  private readonly rotors: THREE.Group[] = [];
  private readonly rotorDiscs: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly rearKit = new THREE.Group();
  private readonly tank: THREE.Mesh;
  private readonly accents: THREE.MeshStandardMaterial;
  private readonly leds: THREE.Mesh[] = [];
  private flightTime = 0;
  private rpm = 0;
  private targetAltitude = 0;
  private configuration: 0 | 1 = 0;

  constructor(scene: THREE.Scene, private readonly heightAt: (x: number, z: number) => number, private readonly colliders: FlightCollider[] = []) {
    this.group.name = 'AGRO NOVA X4 agricultural drone';
    this.group.add(this.rig);
    scene.add(this.group);

    const carbon = new THREE.MeshStandardMaterial({ color: '#1a2426', metalness: 0.55, roughness: 0.37 });
    const dark = new THREE.MeshStandardMaterial({ color: '#303b3c', metalness: 0.45, roughness: 0.44 });
    const white = new THREE.MeshStandardMaterial({ color: '#e6e9df', metalness: 0.2, roughness: 0.32 });
    const steel = new THREE.MeshStandardMaterial({ color: '#a5afad', metalness: 0.83, roughness: 0.25 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#111a1b', roughness: 0.91 });
    const glass = new THREE.MeshStandardMaterial({ color: '#10272d', metalness: 0.65, roughness: 0.12 });
    this.accents = new THREE.MeshStandardMaterial({ color: '#a2c087', metalness: 0.3, roughness: 0.38 });
    const liquid = new THREE.MeshStandardMaterial({ color: '#b8d3bf', metalness: 0.05, roughness: 0.3, transparent: true, opacity: 0.87 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.rig) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
    const tube = (from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material, parent: THREE.Object3D = this.rig) => {
      const delta = to.clone().sub(from);
      const mesh = add(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material, 0, 0, 0, parent);
      mesh.position.copy(from).add(to).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
    };

    // Layered shell, structural frame, vented battery cassette and visible fasteners.
    box(1.68, 0.31, 2.03, carbon, 0, 0.1, 0);
    const shell = box(1.58, 0.31, 1.72, white, 0, 0.35, -0.03); shell.rotation.z = 0.012;
    box(1.29, 0.13, 0.73, white, 0, 0.53, -0.18);
    box(0.68, 0.12, 0.65, carbon, 0, 0.62, 0.18);
    box(0.48, 0.025, 0.38, glass, 0, 0.69, 0.18);
    const screen = new THREE.MeshBasicMaterial({ color: '#a8e4b1' });
    for (let i = 0; i < 3; i++) box(0.27 - i * 0.055, 0.027, 0.018, screen, -0.025, 0.707, 0.09 + i * 0.065);
    for (const side of [-1, 1]) {
      box(0.11, 0.12, 1.34, this.accents, side * 0.76, 0.47, -0.1);
      box(0.14, 0.3, 0.8, dark, side * 0.87, 0.08, 0.12);
      for (let i = 0; i < 7; i++) box(0.018, 0.13, 0.047, rubber, side * 0.948, 0.1, -0.15 + i * 0.088);
      for (const z of [-0.65, 0.62]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 8), steel, side * 0.6, 0.515, z);
    }
    // Translucent low-slung spray tank with braces and filler cap.
    this.tank = add(new THREE.CylinderGeometry(0.67, 0.48, 0.83, 12), liquid, 0, -0.56, 0.11);
    for (const side of [-1, 1]) {
      box(0.07, 0.81, 0.83, carbon, side * 0.49, -0.53, 0.1);
      box(0.05, 0.05, 1.17, steel, side * 0.51, -0.89, 0.08);
    }
    add(new THREE.CylinderGeometry(0.14, 0.14, 0.13, 16), this.accents, 0.44, -0.07, 0.47);
    box(0.42, 0.04, 0.39, dark, 0, -1.01, 0.08);
    // Four double-spar arms, brushless motors and actual rotating propellers.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 2.12, z = sz * 1.63;
      tube(new THREE.Vector3(sx * 0.57, 0.18, sz * 0.58), new THREE.Vector3(x, 0.21, z), 0.115, carbon);
      tube(new THREE.Vector3(sx * 0.59, 0.1, sz * 0.28), new THREE.Vector3(x, 0.14, z), 0.052, steel);
      tube(new THREE.Vector3(sx * 0.74, 0.28, sz * 0.51), new THREE.Vector3(x, 0.29, z), 0.019, rubber);
      const motor = add(new THREE.CylinderGeometry(0.25, 0.2, 0.33, 16), dark, x, 0.33, z);
      motor.name = 'Brushless motor';
      add(new THREE.CylinderGeometry(0.25, 0.25, 0.055, 16), this.accents, x, 0.23, z);
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2;
        const vent = box(0.045, 0.15, 0.02, rubber, x + Math.sin(angle) * 0.235, 0.35, z + Math.cos(angle) * 0.235);
        vent.rotation.y = angle;
      }
      const rotor = new THREE.Group(); rotor.position.set(x, 0.54, z); this.rig.add(rotor); this.rotors.push(rotor);
      const propShape = new THREE.Shape();
      propShape.moveTo(0.09, -0.055); propShape.bezierCurveTo(0.35, -0.18, 0.95, -0.2, 1.18, -0.04); propShape.lineTo(1.17, 0.075); propShape.bezierCurveTo(0.75, 0.095, 0.35, 0.09, 0.09, 0.055);
      const propGeometry = new THREE.ShapeGeometry(propShape, 5); propGeometry.rotateX(-Math.PI / 2);
      const bladeMaterial = new THREE.MeshStandardMaterial({ color: '#283638', metalness: 0.32, roughness: 0.5, side: THREE.DoubleSide });
      for (const angle of [0, Math.PI]) { const blade = new THREE.Mesh(propGeometry, bladeMaterial); blade.rotation.y = angle; rotor.add(blade); }
      add(new THREE.CylinderGeometry(0.105, 0.13, 0.11, 12), steel, 0, 0.025, 0, rotor);
      const discMaterial = new THREE.MeshBasicMaterial({ color: '#b6c5ba', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.18, 48), discMaterial); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.555, z); this.rig.add(disc); this.rotorDiscs.push(disc);
      const ledMaterial = new THREE.MeshBasicMaterial({ color: sz < 0 ? '#82fbc6' : '#fc795f' });
      this.leds.push(add(new THREE.SphereGeometry(0.067, 8, 6), ledMaterial, x, 0.21, z + sz * 0.23));
    }
    // Shock-mounted landing gear; lowest skid point is exactly -1.4m.
    for (const side of [-1, 1]) {
      for (const z of [-0.63, 0.7]) {
        tube(new THREE.Vector3(side * 0.59, -0.08, z), new THREE.Vector3(side * 0.97, -1.27, z + 0.08), 0.055, carbon);
        tube(new THREE.Vector3(side * 0.72, -0.43, z), new THREE.Vector3(side * 0.87, -0.9, z + 0.04), 0.07, steel);
      }
      tube(new THREE.Vector3(side * 0.98, -1.32, -1.04), new THREE.Vector3(side * 0.98, -1.32, 1.18), 0.08, rubber);
    }
    // Gimballed front camera and obstacle sensors.
    box(0.23, 0.25, 0.15, steel, 0, -0.36, -0.94);
    const camera = add(new THREE.SphereGeometry(0.25, 14, 10), dark, 0, -0.57, -1.01); camera.scale.set(1, 0.9, 0.86);
    const lens = add(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 18), glass, 0, -0.58, -1.22); lens.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) { const sensor = add(new THREE.CylinderGeometry(0.075, 0.085, 0.045, 12), glass, side * 0.53, 0.28, -0.91); sensor.rotation.x = Math.PI / 2; }
    // Antennas, paired spray booms, thin feed pipes and brass spray nozzles.
    for (const side of [-1, 1]) {
      tube(new THREE.Vector3(side * 0.52, 0.5, 0.55), new THREE.Vector3(side * 0.57, 1.1, 0.68), 0.018, carbon);
      add(new THREE.SphereGeometry(0.045, 8, 6), rubber, side * 0.57, 1.1, 0.68);
      tube(new THREE.Vector3(side * 0.28, -0.78, 0.34), new THREE.Vector3(side * 1.79, -0.8, 0.36), 0.036, steel);
      tube(new THREE.Vector3(side * 0.16, -0.9, 0.12), new THREE.Vector3(side * 1.77, -0.77, 0.38), 0.02, rubber);
      for (const x of [0.93, 1.67]) {
        add(new THREE.CylinderGeometry(0.035, 0.055, 0.12, 8), this.accents, side * x, -0.87, 0.36);
        add(new THREE.ConeGeometry(0.065, 0.06, 8), steel, side * x, -0.96, 0.36).rotation.z = Math.PI;
      }
    }
    // Configuration two is visibly different: orange trims, twin seed canisters and rear spreader.
    this.rig.add(this.rearKit);
    for (const side of [-1, 1]) {
      const canister = add(new THREE.CylinderGeometry(0.29, 0.18, 0.77, 10), white, side * 0.64, -0.39, 1.1, this.rearKit);
      canister.rotation.x = -0.12;
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10), this.accents, side * 0.64, 0.04, 1.04, this.rearKit);
      tube(new THREE.Vector3(side * 0.64, -0.73, 1.14), new THREE.Vector3(side * 0.47, -0.94, 0.9), 0.06, rubber, this.rearKit);
    }
    add(new THREE.CylinderGeometry(0.4, 0.31, 0.085, 14), steel, 0, -1.08, 0.89, this.rearKit);
    this.rearKit.visible = false;
    // One static mesh per material keeps the detailed airframe inexpensive in every render pass.
    // Animated rotors, warning lights, fluid tank and configuration attachments stay independent.
    this.batchStaticMeshes(this.rig, new Set<THREE.Object3D>([this.tank, ...this.rotorDiscs, ...this.leds]));
    this.batchStaticMeshes(this.rearKit);
    this.reset();
  }

  private batchStaticMeshes(parent: THREE.Group, keep = new Set<THREE.Object3D>()) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh) || keep.has(child) || Array.isArray(child.material)) continue;
      const batch = batches.get(child.material) ?? [];
      batch.push(child);
      batches.set(child.material, batch);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const transformed = meshes.map(mesh => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        return geometry.applyMatrix4(mesh.matrix);
      });
      const geometry = mergeGeometries(transformed, false);
      transformed.forEach(source => source.dispose());
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const merged = new THREE.Mesh(geometry, material);
      merged.name = 'Batched static airframe';
      merged.castShadow = true;
      merged.receiveShadow = true;
      for (const mesh of meshes) { parent.remove(mesh); mesh.geometry.dispose(); }
      parent.add(merged);
    }
  }

  setConfiguration(configuration: 0 | 1) {
    this.configuration = configuration;
    this.rearKit.visible = configuration === 1;
    this.accents.color.set(configuration === 1 ? '#df9e5b' : '#a2c087');
    this.tank.scale.x = configuration === 1 ? 0.83 : 1;
    this.tank.scale.z = configuration === 1 ? 0.83 : 1;
  }

  reset(position?: { x: number; y: number; z: number }) {
    const x = position?.x ?? PAD.x, z = position?.z ?? PAD.z;
    this.position.set(x, position?.y ?? this.heightAt(x, z) + 1.4, z);
    this.velocity.set(0, 0, 0); this.yaw = 0; this.group.rotation.set(0, 0, 0); this.rig.rotation.set(0, 0, 0);
    this.targetAltitude = this.position.y;
    this.updateTelemetry();
  }

  update(dt: number, input: InputManager, settings: Settings, wind: THREE.Vector2, tankFraction: number, upgrades: Record<string, number>, battery: number) {
    dt = clamp(dt, 0, 0.05); this.flightTime += dt;
    const keys = input.keys;
    const active = input.enabled;
    input.sensitivity = settings.sensitivity;
    const simulation = settings.mode === 'SIMULATION';
    const massFactor = 1 + clamp(tankFraction, 0, 1) * 0.24 + this.configuration * 0.04;
    const motorLevel = upgrades.engines ?? upgrades.motor ?? upgrades.motors ?? upgrades.speed ?? upgrades.propulsion ?? 0;
    const stabilityLevel = (upgrades.stability ?? 0) + this.configuration * 0.6;
    const speed = (simulation ? 15.5 : 13.5) * (1 + motorLevel * 0.12 + this.configuration * 0.08);
    const forward = active ? Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) : 0;
    const right = active ? Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) : 0;
    const vertical = active ? Number(keys.has('Space')) - Number(keys.has('ShiftLeft') || keys.has('ShiftRight')) : 0;
    const length = Math.max(1, Math.hypot(forward, right));
    const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
    let desiredX = (-sy * forward + cy * right) * speed / length;
    let desiredZ = (-cy * forward - sy * right) * speed / length;
    const ground = this.heightAt(this.position.x, this.position.z) + 1.4;
    const inAir = this.position.y > ground + 0.13 || vertical > 0;
    if (inAir) {
      const windStrength = (simulation ? 0.45 : 0.15) / (1 + stabilityLevel * 0.4);
      desiredX += wind.x * windStrength; desiredZ += wind.y * windStrength;
    } else if (vertical <= 0) { desiredX = 0; desiredZ = 0; }
    const response = (simulation ? 1.32 : 2.4) * (1 + stabilityLevel * 0.08) / massFactor;
    const maxAcceleration = (simulation ? 8.2 : 11.8) * (1 + motorLevel * 0.06) / massFactor;
    this.velocity.x += clamp((desiredX - this.velocity.x) * response, -maxAcceleration, maxAcceleration) * dt;
    this.velocity.z += clamp((desiredZ - this.velocity.z) * response, -maxAcceleration, maxAcceleration) * dt;
    let targetVertical = 0;
    if (battery <= 0) {
      // Battery reserve performs a controlled descent; the skids never pass through terrain.
      targetVertical = this.position.y > ground + 2.5 ? -2.1 : -0.75;
      this.velocity.x = damp(this.velocity.x, 0, 1.8, dt); this.velocity.z = damp(this.velocity.z, 0, 1.8, dt);
      this.targetAltitude = this.position.y;
    } else if (vertical) {
      targetVertical = vertical * (vertical > 0 ? 6.0 : 4.3) / Math.sqrt(massFactor);
      this.targetAltitude = this.position.y + this.velocity.y / 3.5;
    } else {
      targetVertical = clamp((this.targetAltitude - this.position.y) * 2.4, -3.5, 3.5);
    }
    this.velocity.y = damp(this.velocity.y, targetVertical, simulation ? 2.6 : 4.0, dt);
    this.position.addScaledVector(this.velocity, dt);

    // Cylinder collision gently slides the craft around farm structures.
    for (const collider of this.colliders) {
      const base = this.heightAt(collider.x, collider.z);
      if (this.position.y - 1.2 >= base + collider.height) continue;
      const dx = this.position.x - collider.x, dz = this.position.z - collider.z;
      const distance = Math.hypot(dx, dz), radius = collider.r + 2.2;
      if (distance >= radius) continue;
      const nx = distance > 0.001 ? dx / distance : 1, nz = distance > 0.001 ? dz / distance : 0;
      this.position.x = collider.x + nx * radius; this.position.z = collider.z + nz * radius;
      const intoWall = this.velocity.x * nx + this.velocity.z * nz;
      if (intoWall < 0) { this.velocity.x -= nx * intoWall * 1.12; this.velocity.z -= nz * intoWall * 1.12; }
    }
    const floor = this.heightAt(this.position.x, this.position.z) + 1.4;
    if (this.position.y <= floor) {
      this.position.y = floor; this.velocity.y = Math.max(0, this.velocity.y); this.targetAltitude = floor;
      this.velocity.x = damp(this.velocity.x, 0, 5, dt); this.velocity.z = damp(this.velocity.z, 0, 5, dt);
    }
    const ceiling = this.heightAt(this.position.x, this.position.z) + 100;
    if (this.position.y > ceiling) { this.position.y = ceiling; this.velocity.y = Math.min(0, this.velocity.y); this.targetAltitude = ceiling; }
    for (const axis of ['x', 'z'] as const) {
      const bound = clamp(this.position[axis], -282, 282);
      if (bound !== this.position[axis]) { this.position[axis] = bound; this.velocity[axis] *= -0.14; }
    }
    const yawDelta = Math.atan2(Math.sin(input.yaw - this.yaw), Math.cos(input.yaw - this.yaw));
    this.yaw += yawDelta * (1 - Math.exp(-5 * dt)); this.group.rotation.y = this.yaw;
    const localForward = -Math.sin(this.yaw) * this.velocity.x - Math.cos(this.yaw) * this.velocity.z;
    const localRight = Math.cos(this.yaw) * this.velocity.x - Math.sin(this.yaw) * this.velocity.z;
    const lift = this.position.y > floor + 0.07;
    const vibration = lift ? Math.sin(this.flightTime * 31) * 0.0024 : 0;
    this.rig.rotation.x = damp(this.rig.rotation.x, lift ? -localForward * 0.018 + vibration : 0, 4, dt);
    this.rig.rotation.z = damp(this.rig.rotation.z, lift ? -localRight * 0.021 - yawDelta * 0.025 : 0, 4, dt);
    this.rig.position.y = lift ? Math.sin(this.flightTime * 15) * 0.007 : 0;
    this.rpm = damp(this.rpm, battery <= 0 && !lift ? 0 : lift || vertical > 0 ? 1 : 0.13, 3.8, dt);
    this.rotors.forEach((rotor, i) => { rotor.rotation.y += dt * (3 + this.rpm * 100) * (i % 2 ? 1 : -1); });
    this.rotorDiscs.forEach(disc => { disc.material.opacity = this.rpm * 0.11; });
    this.leds.forEach((led, i) => { led.visible = i < 2 || Math.sin(this.flightTime * 4) > -0.5; });
    this.updateTelemetry();
  }

  private updateTelemetry() {
    const ground = this.heightAt(this.position.x, this.position.z);
    Object.assign(this.telemetry, { x: this.position.x, y: this.position.y, z: this.position.z, altitude: Math.max(0, this.position.y - ground - 1.4), speed: Math.hypot(this.velocity.x, this.velocity.z), heading: ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360, grounded: this.position.y <= ground + 1.46 });
  }
}
