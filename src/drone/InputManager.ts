import { clamp } from '../core/config';

const ACTIONS: Record<string, string> = {
  Digit1: 'tool:scan', Digit2: 'tool:water', Digit3: 'tool:seed',
  KeyC: 'camera', KeyF: 'interact', KeyM: 'map', Tab: 'mission',
  Escape: 'pause', KeyH: 'hangar', KeyT: 'time', KeyP: 'weather',
};
const FLIGHT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Owns only gameplay input. Form fields and the rest of the HUD keep their native events. */
export class InputManager {
  readonly keys = new Set<string>();
  mouseDown = false;
  aiming = false;
  yaw = 0;
  pitch = 0.3;
  locked = false;
  sensitivity = 1;
  private active = true;
  private lastPause = 0;
  private disposed = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly onAction: (action: string) => void;

  constructor(canvas: HTMLCanvasElement, onAction: (action: string) => void) {
    this.canvas = canvas;
    this.onAction = onAction;
    document.addEventListener('keydown', this.keyDown);
    document.addEventListener('keyup', this.keyUp);
    document.addEventListener('mousemove', this.mouseMove);
    document.addEventListener('mouseup', this.mouseUp);
    document.addEventListener('pointerlockchange', this.lockChange);
    document.addEventListener('visibilitychange', this.visibilityChange);
    window.addEventListener('blur', this.blur);
    canvas.addEventListener('mousedown', this.mousePress);
    canvas.addEventListener('contextmenu', this.contextMenu);
  }

  get enabled() { return this.active; }
  set enabled(value: boolean) {
    this.active = value;
    if (!value) {
      this.clear();
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
  }

  requestLock() {
    if (!this.active || this.disposed || document.pointerLockElement === this.canvas) return;
    // Pointer lock is a convenience: keyboard flight still works if a browser refuses it.
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch { /* Browsers without pointer lock retain keyboard controls. */ }
  }

  clear() { this.keys.clear(); this.mouseDown = false; this.aiming = false; }

  private isEditing(target: EventTarget | null) {
    return target instanceof HTMLElement && (!!target.closest('input,textarea,select,[contenteditable="true"]'));
  }

  private pause() {
    const now = performance.now();
    if (now - this.lastPause > 160) { this.lastPause = now; this.onAction('pause'); }
  }

  private keyDown = (event: KeyboardEvent) => {
    if (this.isEditing(event.target)) return;
    if (!this.active) {
      if (event.code === 'Escape' && !event.repeat) this.pause();
      return;
    }
    if (!FLIGHT_KEYS.has(event.code) && !ACTIONS[event.code]) return;
    event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape') this.pause();
    else if (ACTIONS[event.code]) this.onAction(ACTIONS[event.code]);
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private mousePress = (event: MouseEvent) => {
    if (!this.active) return;
    event.preventDefault();
    if (!this.locked) this.requestLock();
    if (event.button === 0) this.mouseDown = true;
    if (event.button === 2) this.aiming = true;
  };
  private mouseUp = (event: MouseEvent) => {
    if (event.button === 0) this.mouseDown = false;
    if (event.button === 2) this.aiming = false;
  };
  private mouseMove = (event: MouseEvent) => {
    if (!this.active || !this.locked) return;
    this.yaw -= clamp(event.movementX, -180, 180) * 0.0022 * this.sensitivity;
    this.pitch = clamp(this.pitch + clamp(event.movementY, -180, 180) * 0.0018 * this.sensitivity, -0.65, 1.18);
  };
  private lockChange = () => {
    const wasLocked = this.locked;
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) {
      this.clear();
      if (wasLocked && this.active) this.pause();
    }
  };
  private blur = () => { this.clear(); };
  private visibilityChange = () => { if (document.hidden) this.clear(); };
  private contextMenu = (event: Event) => { if (this.active) event.preventDefault(); };

  dispose() {
    this.disposed = true;
    this.enabled = false;
    document.removeEventListener('keydown', this.keyDown);
    document.removeEventListener('keyup', this.keyUp);
    document.removeEventListener('mousemove', this.mouseMove);
    document.removeEventListener('mouseup', this.mouseUp);
    document.removeEventListener('pointerlockchange', this.lockChange);
    document.removeEventListener('visibilitychange', this.visibilityChange);
    window.removeEventListener('blur', this.blur);
    this.canvas.removeEventListener('mousedown', this.mousePress);
    this.canvas.removeEventListener('contextmenu', this.contextMenu);
  }
}
