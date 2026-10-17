import { DEFAULT_SETTINGS, type Settings } from '../core/config';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const GAME_KEY = 'agro-nova.save';
const SETTINGS_KEY = 'agro-nova.settings';
const VERSION = 1;
type Validator<T> = (data: unknown) => data is T;

function browserStorage(): StorageLike | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

// A checksum detects truncated or accidentally edited storage. It is not a security boundary.
export function checksum(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function decode(raw: string): { data: unknown; version: number } {
  const record: unknown = JSON.parse(raw);
  if (!record || typeof record !== 'object') throw Error('Повреждён формат сохранения');
  const e = record as Record<string, unknown>;
  if (!Number.isInteger(e.version)) throw Error('Неизвестная версия сохранения');
  if (e.version !== VERSION) throw Error('Сохранение другой версии сохранено без изменений');
  if (typeof e.checksum !== 'string' || checksum(JSON.stringify(e.data)) !== e.checksum) throw Error('Проверка целостности сохранения не пройдена');
  return { data: e.data, version: e.version as number };
}

function encode(data: unknown): string {
  return JSON.stringify({ version: VERSION, checksum: checksum(JSON.stringify(data)), data });
}

export class SaveManager {
  lastError = '';
  constructor(private storage: StorageLike | null = browserStorage()) {}

  hasSave(): boolean {
    try { const raw = this.storage?.getItem(GAME_KEY); return !!raw && !!decode(raw); } catch { return false; }
  }

  save<T>(data: T, validate: Validator<T>): boolean {
    this.lastError = '';
    if (!this.storage) { this.lastError = 'Хранилище браузера недоступно'; return false; }
    try {
      if (!validate(data)) throw Error('Игровое состояние не прошло проверку');
      const old = this.storage.getItem(GAME_KEY);
      if (old !== null) {
        const previous = decode(old);
        if (!validate(previous.data)) throw Error('Прежнее сохранение повреждено и оставлено без изменений');
        this.storage.setItem(`${GAME_KEY}.backup`, old);
      }
      this.storage.setItem(GAME_KEY, encode(data));
      return true;
    } catch (e) { this.lastError = e instanceof Error ? e.message : 'Не удалось сохранить игру'; return false; }
  }

  load<T>(validate: Validator<T>): T | null {
    this.lastError = '';
    if (!this.storage) { this.lastError = 'Хранилище браузера недоступно'; return null; }
    try {
      const raw = this.storage.getItem(GAME_KEY);
      if (!raw) return null;
      const { data } = decode(raw);
      if (!validate(data)) throw Error('Сохранение содержит недопустимые данные');
      return data;
    } catch (e) { this.lastError = e instanceof Error ? e.message : 'Не удалось загрузить игру'; return null; }
  }

  // Explicit new-game intent may clear our current valid save, never an unknown version.
  clear(): boolean {
    this.lastError = '';
    if (!this.storage) return true;
    try {
      const raw = this.storage.getItem(GAME_KEY);
      if (raw) decode(raw);
      this.storage.removeItem(GAME_KEY);
      this.storage.removeItem(`${GAME_KEY}.backup`);
      return true;
    } catch (e) { this.lastError = e instanceof Error ? e.message : 'Не удалось удалить сохранение'; return false; }
  }

  loadSettings(): Settings {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const { data } = decode(raw);
      return validSettings(data) ? data : { ...DEFAULT_SETTINGS };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  saveSettings(settings: Settings): boolean {
    if (!this.storage || !validSettings(settings)) return false;
    try {
      const old = this.storage.getItem(SETTINGS_KEY);
      if (old) decode(old);
      this.storage.setItem(SETTINGS_KEY, encode(settings));
      return true;
    } catch { return false; }
  }
}

function validSettings(data: unknown): data is Settings {
  if (!data || typeof data !== 'object') return false;
  const s = data as Settings;
  return ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'].includes(s.quality)
    && Number.isFinite(s.volume) && s.volume >= 0 && s.volume <= 1
    && Number.isFinite(s.sensitivity) && s.sensitivity >= 0.1 && s.sensitivity <= 5
    && ['ARCADE', 'SIMULATION'].includes(s.mode)
    && typeof s.bloom === 'boolean' && typeof s.ao === 'boolean' && typeof s.hints === 'boolean';
}
