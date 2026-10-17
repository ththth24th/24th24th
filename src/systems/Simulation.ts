import { FIELD_DEFS, PAD, PUMP, clamp, randHash, type FieldDef, type FlightTelemetry, type Tool } from '../core/config';
import { SaveManager, type StorageLike } from './SaveManager';

export type UpgradeKey = 'battery' | 'engines' | 'tank' | 'spray' | 'scanner' | 'stability';
export const UPGRADE_DEFS: Record<UpgradeKey, { name: string; description: string; baseCost: number }> = {
  battery: { name: 'Энергоячейки', description: '+25% к времени полёта за уровень', baseCost: 420 },
  engines: { name: 'Бесколлекторные двигатели', description: '+12% к скорости за уровень', baseCost: 480 },
  tank: { name: 'Композитный бак', description: '+35 л за уровень', baseCost: 360 },
  spray: { name: 'Широкий распылитель', description: '+1,5 м к радиусу обработки', baseCost: 400 },
  scanner: { name: 'Мультиспектральный сканер', description: '+4 м к радиусу сканирования', baseCost: 340 },
  stability: { name: 'Умная стабилизация', description: 'Меньше снос дрона и капель', baseCost: 440 },
};
const KEYS = Object.keys(UPGRADE_DEFS) as UpgradeKey[];
const MAX_LEVEL = 3;
const CONFIGURATION_COST = 1250;
export interface FieldCell { moisture: number; health: number; growth: number; seeded: boolean; scanned: boolean; coverage: number; }
export interface SimField { def: FieldDef; cols: 10; rows: 8; cells: FieldCell[]; }
export interface MissionResult { title: string; reward: number; penalty: number; seconds: number; }
export interface Objective { label: string; progress: number; target: number; complete: boolean; }
interface MissionState { takeoff: boolean; camera: boolean; initialCamera: number; landed: boolean; elapsed: number; windCells: number[]; penalty: number; result: MissionResult | null; }
export interface DroneStats { batteryCapacity: number; speedMultiplier: number; stability: number; tankCapacity: number; sprayRadius: number; scannerRadius: number; }
export interface FieldSnapshot { id: number; name: string; crop: FieldDef['crop']; moisture: number; health: number; growth: number; scanned: number; coverage: number; seeded: number; }
export interface SimulationSnapshot {
  currency: number; battery: number; water: number; capacity: number;
  upgrades: Record<UpgradeKey, number>; upgradeCosts: Record<UpgradeKey, number>; configuration: 0 | 1; configurationCost: number;
  mission: { index: number; title: string; description: string; targetFieldId: number | null; objectives: Objective[]; progress: number; status: 'active' | 'complete'; reward: number; result: MissionResult | null; };
  campaignComplete: boolean; prompt: string; warning: string; techOnline: boolean; emergency: boolean; stats: DroneStats; fields: FieldSnapshot[];
}
interface SavedGame { fields: FieldCell[][]; currency: number; battery: number; water: number; upgrades: Record<UpgradeKey, number>; configuration: 0 | 1; missionIndex: number; missionData: MissionState; techOnline: boolean; totalSeconds: number; flight: FlightTelemetry; }

const CONTRACTS = [
  { title: 'Первый вылет', description: 'Взлетите до 5 м, смените камеру клавишей C и мягко вернитесь на посадочную площадку.', field: null, reward: 350 },
  { title: 'Спасение урожая', description: 'Просканируйте и оросите не менее 65% пшеничного поля «Золотой колос». Рабочая высота орошения: 1–12 м.', field: 0, reward: 900 },
  { title: 'Земля после засухи', description: 'Засейте не менее 65% участка «Новая земля». Пролетайте полосами на высоте 1–12 м с активным посевом.', field: 3, reward: 1100 },
  { title: 'Сложный ветер', description: 'Оросите 65% кукурузного поля в боковой ветер. Точная обработка засчитывается на скорости до 11 м/с; капли сносит вправо.', field: 1, reward: 1300 },
  { title: 'Возрождение долины', description: 'Просканируйте и восстановите 65% подсолнечников. Вернитесь на базу и нажмите F на площадке, чтобы запустить агрокомплекс.', field: 2, reward: 1800 },
] as const;

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
function newMission(): MissionState { return { takeoff: false, camera: false, initialCamera: 0, landed: false, elapsed: 0, windCells: Array(80).fill(0), penalty: 0, result: null }; }
function makeFields(): SimField[] {
  return FIELD_DEFS.map(def => ({ def, cols: 10, rows: 8, cells: Array.from({ length: 80 }, (_, i) => {
    const noise = randHash(def.id * 13 + i, def.id * 37 + i * 0.2);
    return { moisture: .17 + noise * .18, health: def.crop === 'bare' ? .2 : .43 + noise * .2, growth: def.crop === 'bare' ? 0 : .42 + noise * .23, seeded: def.crop !== 'bare', scanned: false, coverage: 0 };
  }) }));
}

export class Simulation {
  fields: SimField[] = makeFields();
  currency = 0;
  battery = 100;
  water = 120;
  upgrades: Record<UpgradeKey, number> = { battery: 0, engines: 0, tank: 0, spray: 0, scanner: 0, stability: 0 };
  configuration: 0 | 1 = 0;
  missionIndex = 0;
  techOnline = false;
  totalSeconds = 0;
  readonly saves: SaveManager;
  private missionData: MissionState = newMission();
  private lastFlight: FlightTelemetry | null = null;
  private notice = '';
  private warningText = '';

  constructor(storage?: StorageLike | null) { this.saves = new SaveManager(storage); }
  get capacity(): number { return 120 + this.upgrades.tank * 35 + this.configuration * 30; }
  get sprayRadius(): number { return 8.5 + this.upgrades.spray * 1.5 + this.configuration; }
  get scannerRadius(): number { return 16 + this.upgrades.scanner * 4; }
  get stats(): DroneStats { return { batteryCapacity: 100 + this.upgrades.battery * 25 + this.configuration * 20, speedMultiplier: 1 + this.upgrades.engines * .12 + this.configuration * .08, stability: this.upgrades.stability + this.configuration * .6, tankCapacity: this.capacity, sprayRadius: this.sprayRadius, scannerRadius: this.scannerRadius }; }
  get emergency(): boolean { return this.battery <= .5; }
  get mission(): SimulationSnapshot['mission'] { return this.missionSnapshot(); }
  get missionProgress(): number { return this.missionSnapshot().progress; }
  upgradeCost(key: UpgradeKey): number { return Math.round(UPGRADE_DEFS[key].baseCost * (1 + this.upgrades[key] * .65)); }

  update(dt: number, flight: FlightTelemetry, weather: { rain: number; wind: number }, activeTool: Tool, usingTool: boolean): void {
    if (!Number.isFinite(dt) || dt <= 0 || !validFlight(flight)) return;
    dt = Math.min(dt, .25); // No tab-away catch-up; root also uses fixed small substeps.
    const rain = clamp(Number.isFinite(weather.rain) ? weather.rain : 0, 0, 1);
    const wind = clamp(Number.isFinite(weather.wind) ? weather.wind : 0, 0, 1);
    this.totalSeconds += dt;
    if (!this.missionData.result) this.missionData.elapsed += dt;
    this.lastFlight = { ...flight };
    const onPad = flight.grounded && flight.speed < 2.5 && distance(flight, PAD) < 9;
    if (onPad) this.battery = Math.min(100, this.battery + dt * 14);
    else if (!flight.grounded) {
      const drain = (.105 + Math.min(flight.speed, 25) * .002 + (usingTool ? .018 : 0)) / (this.stats.batteryCapacity / 100);
      this.battery = Math.max(0, this.battery - dt * drain);
    }
    this.warningText = this.emergency ? 'Энергия исчерпана. Мягко приземлитесь; F — аварийная эвакуация.' : this.battery < 20 ? 'Низкий заряд. Вернитесь на площадку для зарядки.' : '';
    if (!this.missionData.result && this.missionIndex === 0) {
      if (flight.altitude >= 5) this.missionData.takeoff = true;
      if (this.missionData.takeoff && flight.camera !== this.missionData.initialCamera) this.missionData.camera = true;
      if (this.missionData.takeoff && this.missionData.camera && onPad) this.missionData.landed = true;
    }

    let toolFactor = 0;
    const altitudeValid = flight.altitude >= .8 && flight.altitude <= (activeTool === 'scan' ? 40 : 12);
    const toolOn = usingTool && !flight.grounded && !this.emergency && altitudeValid;
    if (toolOn) {
      if (activeTool === 'scan') toolFactor = 1;
      else if (this.water > 0) {
        const amount = Math.min(this.water, dt * (activeTool === 'seed' ? .30 : .8));
        toolFactor = amount / (dt * (activeTool === 'seed' ? .30 : .8));
        this.water -= amount;
      }
    }
    if (usingTool && !altitudeValid && !flight.grounded) this.warningText = activeTool === 'scan' ? 'Сканер: держите высоту 1–40 м.' : 'Для обработки снизьте высоту до 1–12 м.';
    if (usingTool && activeTool !== 'scan' && this.water <= 0) this.warningText = 'Бак пуст. Насосная станция к востоку от площадки; F — пополнить.';
    const radius = activeTool === 'scan' ? this.scannerRadius : this.sprayRadius;
    const drift = activeTool === 'water' ? wind * flight.altitude * .24 / (1 + this.stats.stability * .4) : 0;
    const toolX = flight.x + drift;
    let hit = false;
    for (const field of this.fields) {
      const near = toolFactor > 0 && Math.abs(toolX - field.def.x) < field.def.w / 2 + radius && Math.abs(flight.z - field.def.z) < field.def.d / 2 + radius;
      for (let i = 0; i < 80; i++) {
        const c = field.cells[i];
        c.moisture = clamp(c.moisture + dt * (rain * .022 - .00016 * (1 - rain)), 0, 1);
        if (c.seeded) {
          const healthy = c.moisture > .40;
          c.health = clamp(c.health + dt * (healthy ? .0035 : -.00012), 0, 1);
          c.growth = clamp(c.growth + dt * (healthy ? .0008 : .00004), 0, 1);
        }
        if (!near) continue;
        const cx = field.def.x - field.def.w / 2 + (i % 10 + .5) * field.def.w / 10;
        const cz = field.def.z - field.def.d / 2 + (Math.floor(i / 10) + .5) * field.def.d / 8;
        const d = Math.hypot(toolX - cx, flight.z - cz);
        if (d > radius) continue;
        const strength = toolFactor * (1 - .35 * d / radius);
        hit = true;
        if (activeTool === 'scan') c.scanned = true;
        if (activeTool === 'water') {
          c.moisture = clamp(c.moisture + dt * .22 * strength, 0, 1);
          c.health = clamp(c.health + dt * .13 * strength, 0, 1);
          c.coverage = clamp(c.coverage + dt * .6 * strength, 0, 1);
          if (field.def.id === 1 && this.missionIndex === 3 && wind >= .25 && flight.speed <= 11) this.missionData.windCells[i] = clamp(this.missionData.windCells[i] + dt * .6 * strength, 0, 1);
        }
        if (activeTool === 'seed' && field.def.crop === 'bare') {
          c.coverage = clamp(c.coverage + dt * .8 * strength, 0, 1);
          if (c.coverage >= .55) { c.seeded = true; c.moisture = Math.max(c.moisture, .46); c.health = Math.max(c.health, .6); c.growth = Math.max(c.growth, .08); }
        }
      }
    }
    if (toolFactor > 0 && activeTool !== 'scan' && !hit && !this.missionData.result) this.missionData.penalty += dt * .8;
    this.checkMission();
  }

  interact(flight: FlightTelemetry): string {
    this.lastFlight = { ...flight };
    if (distance(flight, PUMP) < 10 && flight.altitude < 4 && flight.speed < 3) {
      this.water = this.capacity;
      return this.notice = `Бак заправлен: ${this.capacity} л. Вода и посевная смесь готовы.`;
    }
    if (flight.grounded && distance(flight, PAD) < 12) {
      this.battery = 100;
      if (this.missionIndex === 4 && this.restored(2) >= .65 && this.scanned(2) >= .65 && !this.techOnline) {
        this.techOnline = true;
        this.checkMission();
        return this.notice = 'АГРОКОМПЛЕКС ЗАПУЩЕН. Долина снова живёт!';
      }
      return this.notice = 'Аккумулятор заряжен. В ангаре доступны улучшения.';
    }
    if (flight.grounded && this.battery < 1) {
      this.battery = 25;
      this.currency = Math.max(0, this.currency - 120);
      this.missionData.penalty += 120;
      return this.notice = 'ЭВАКУАЦИЯ: дрон возвращён на базу. Сервисный сбор 120 ₽.';
    }
    return this.notice = 'Для заправки зависните ниже 4 м у насосной станции. Для зарядки и улучшений приземлитесь на базе.';
  }

  purchase(key: UpgradeKey | 'configuration'): { ok: boolean; message: string } {
    if (!this.lastFlight?.grounded || distance(this.lastFlight, PAD) >= 14) return { ok: false, message: 'Приземлитесь на площадку базы, чтобы установить оборудование.' };
    if (key === 'configuration') {
      if (this.configuration) return { ok: false, message: 'NOVA X2 уже установлена.' };
      if (this.missionIndex < 2) return { ok: false, message: 'NOVA X2 откроется после первых двух контрактов.' };
      if (this.currency < CONFIGURATION_COST) return { ok: false, message: 'Недостаточно средств.' };
      this.currency -= CONFIGURATION_COST;
      this.configuration = 1;
      return { ok: true, message: 'NOVA X2 установлена: усиленное шасси, увеличенный бак и запас энергии.' };
    }
    if (!KEYS.includes(key)) return { ok: false, message: 'Неизвестное оборудование.' };
    if (this.upgrades[key] >= MAX_LEVEL) return { ok: false, message: 'Достигнут максимальный уровень.' };
    const cost = this.upgradeCost(key);
    if (this.currency < cost) return { ok: false, message: 'Недостаточно средств.' };
    this.currency -= cost;
    this.upgrades[key]++;
    return { ok: true, message: `${UPGRADE_DEFS[key].name}: уровень ${this.upgrades[key]}.` };
  }

  nextMission(): void {
    if (!this.missionData.result || this.missionIndex >= CONTRACTS.length - 1) return;
    this.missionIndex++;
    this.missionData = newMission();
    this.missionData.initialCamera = this.lastFlight?.camera ?? 0;
    this.notice = '';
    this.checkMission();
  }

  reset(): void {
    this.fields = makeFields(); this.currency = 0; this.battery = 100; this.water = 120;
    this.upgrades = { battery: 0, engines: 0, tank: 0, spray: 0, scanner: 0, stability: 0 };
    this.configuration = 0; this.missionIndex = 0; this.techOnline = false; this.totalSeconds = 0;
    this.missionData = newMission(); this.lastFlight = null; this.notice = ''; this.warningText = '';
  }

  save(flight: FlightTelemetry): boolean {
    const data: SavedGame = { fields: this.fields.map(f => f.cells.map(c => ({ ...c }))), currency: this.currency, battery: this.battery, water: this.water, upgrades: { ...this.upgrades }, configuration: this.configuration, missionIndex: this.missionIndex, missionData: structuredClone(this.missionData), techOnline: this.techOnline, totalSeconds: this.totalSeconds, flight: { ...flight } };
    return this.saves.save(data, validSavedGame);
  }

  load(): FlightTelemetry | null {
    const data = this.saves.load(validSavedGame);
    if (!data) return null;
    this.fields = makeFields(); data.fields.forEach((cells, i) => { this.fields[i].cells = cells.map(c => ({ ...c })); });
    this.currency = data.currency; this.battery = data.battery; this.water = data.water; this.upgrades = { ...data.upgrades }; this.configuration = data.configuration;
    this.missionIndex = data.missionIndex; this.missionData = structuredClone(data.missionData); this.techOnline = data.techOnline; this.totalSeconds = data.totalSeconds;
    this.lastFlight = { ...data.flight }; this.notice = 'Прогресс восстановлен.'; this.warningText = '';
    return { ...data.flight };
  }

  snapshot(): SimulationSnapshot {
    const fields: FieldSnapshot[] = this.fields.map(f => ({ id: f.def.id, name: f.def.name, crop: f.def.crop, moisture: average(f, 'moisture'), health: average(f, 'health'), growth: average(f, 'growth'), scanned: this.scanned(f.def.id), coverage: this.covered(f.def.id), seeded: f.cells.filter(c => c.seeded).length / 80 }));
    const upgradeCosts = Object.fromEntries(KEYS.map(key => [key, this.upgradeCost(key)])) as Record<UpgradeKey, number>;
    const prompt = this.lastFlight && distance(this.lastFlight, PUMP) < 15 ? 'F · Заправить бак у насосной станции' : this.lastFlight && distance(this.lastFlight, PAD) < 16 ? 'F · Зарядить дрон / запустить агрокомплекс' : this.notice;
    return { currency: this.currency, battery: this.battery, water: this.water, capacity: this.capacity, upgrades: { ...this.upgrades }, upgradeCosts, configuration: this.configuration, configurationCost: CONFIGURATION_COST, mission: this.missionSnapshot(), campaignComplete: this.techOnline && !!this.missionData.result && this.missionIndex === 4, prompt, warning: this.warningText, techOnline: this.techOnline, emergency: this.emergency, stats: this.stats, fields };
  }

  private scanned(id: number): number { const f = this.fields[id]; return f ? f.cells.filter(c => c.scanned).length / 80 : 0; }
  private covered(id: number): number { const f = this.fields[id]; return f ? f.cells.filter(c => c.coverage >= .55).length / 80 : 0; }
  private restored(id: number): number { const f = this.fields[id]; return f ? f.cells.filter(c => c.coverage >= .55 && c.health >= .62 && c.moisture >= .4).length / 80 : 0; }
  private objectives(): Objective[] {
    const percent = (label: string, value: number): Objective => ({ label, progress: clamp(value, 0, 1), target: .65, complete: value >= .65 });
    const flag = (label: string, done: boolean): Objective => ({ label, progress: done ? 1 : 0, target: 1, complete: done });
    if (this.missionIndex === 0) return [flag('Взлететь на высоту 5 м', this.missionData.takeoff), flag('Сменить камеру · C', this.missionData.camera), flag('Мягко сесть на площадку базы', this.missionData.landed)];
    if (this.missionIndex === 1) return [percent('Сканирование пшеницы', this.scanned(0)), percent('Орошение пшеницы', this.covered(0))];
    if (this.missionIndex === 2) return [percent('Посев новой земли', this.fields[3].cells.filter(c => c.seeded).length / 80)];
    if (this.missionIndex === 3) return [percent('Орошение кукурузы', this.covered(1)), percent('Точно в ветер · скорость ≤11 м/с', this.missionData.windCells.filter(v => v >= .55).length / 80)];
    return [percent('Сканирование подсолнечников', this.scanned(2)), percent('Восстановление подсолнечников', this.restored(2)), flag('Вернуться на базу и запустить комплекс · F', this.techOnline)];
  }
  private missionSnapshot(): SimulationSnapshot['mission'] {
    const contract = CONTRACTS[this.missionIndex];
    const objectives = this.objectives();
    return { index: this.missionIndex, title: contract.title, description: contract.description, targetFieldId: contract.field, objectives, progress: objectives.reduce((sum, o) => sum + Math.min(o.progress / o.target, 1), 0) / objectives.length, status: this.missionData.result ? 'complete' : 'active', reward: contract.reward, result: this.missionData.result ? { ...this.missionData.result } : null };
  }
  private checkMission(): void {
    if (this.missionData.result || !this.objectives().every(o => o.complete)) return;
    const contract = CONTRACTS[this.missionIndex];
    const penalty = Math.min(Math.round(this.missionData.penalty), Math.round(contract.reward * .3));
    const reward = contract.reward - penalty;
    this.currency += reward;
    this.missionData.result = { title: contract.title, reward, penalty, seconds: Math.round(this.missionData.elapsed) };
    this.notice = `Контракт выполнен. Начислено ${reward} ₽.`;
  }
}

function average(field: SimField, key: 'moisture' | 'health' | 'growth'): number { return field.cells.reduce((sum, c) => sum + c[key], 0) / 80; }
function numberIn(value: unknown, low: number, high: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high; }
function validFlight(data: unknown): data is FlightTelemetry {
  if (!data || typeof data !== 'object') return false;
  const f = data as FlightTelemetry;
  return numberIn(f.x, -10000, 10000) && numberIn(f.y, -1000, 10000) && numberIn(f.z, -10000, 10000) && numberIn(f.altitude, 0, 2000) && numberIn(f.speed, 0, 1000) && numberIn(f.heading, -1e6, 1e6) && typeof f.grounded === 'boolean' && numberIn(f.camera, 0, 10) && Number.isInteger(f.camera);
}
function validSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== 'object') return false;
  const d = value as SavedGame;
  if (!Array.isArray(d.fields) || d.fields.length !== FIELD_DEFS.length || !d.fields.every(cells => Array.isArray(cells) && cells.length === 80 && cells.every(c => c && numberIn(c.moisture, 0, 1) && numberIn(c.health, 0, 1) && numberIn(c.growth, 0, 1) && numberIn(c.coverage, 0, 1) && typeof c.seeded === 'boolean' && typeof c.scanned === 'boolean'))) return false;
  if (!d.upgrades || !KEYS.every(key => numberIn(d.upgrades[key], 0, MAX_LEVEL) && Number.isInteger(d.upgrades[key]))) return false;
  if (!numberIn(d.currency, 0, 1e9) || !numberIn(d.battery, 0, 100) || !numberIn(d.water, 0, 120 + d.upgrades.tank * 35 + d.configuration * 30) || (d.configuration !== 0 && d.configuration !== 1) || !numberIn(d.missionIndex, 0, 4) || !Number.isInteger(d.missionIndex) || typeof d.techOnline !== 'boolean' || !numberIn(d.totalSeconds, 0, 1e10) || !validFlight(d.flight)) return false;
  const m = d.missionData;
  if (!m || typeof m.takeoff !== 'boolean' || typeof m.camera !== 'boolean' || typeof m.landed !== 'boolean' || !numberIn(m.initialCamera, 0, 10) || !Number.isInteger(m.initialCamera) || !numberIn(m.elapsed, 0, 1e10) || !numberIn(m.penalty, 0, 1e10) || !Array.isArray(m.windCells) || m.windCells.length !== 80 || !m.windCells.every(c => numberIn(c, 0, 1))) return false;
  if (m.result !== null && (!m.result || typeof m.result.title !== 'string' || !numberIn(m.result.reward, 0, 10000) || !numberIn(m.result.penalty, 0, 10000) || !numberIn(m.result.seconds, 0, 1e10))) return false;
  return true;
}
