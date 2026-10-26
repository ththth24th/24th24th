import { create } from "zustand";
import { calculate, defaults, validateConfig, type Config } from "./data";
export type Page =
  "home" | "catalog" | "config" | "twin" | "compare" | "projects";
export interface Project {
  id: string;
  name: string;
  config: Config;
  updated: string;
}
const KEY = "aerolab.projects.v1";
function read(): Project[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.map(validateProject);
  } catch {
    return [];
  }
}
export function validateProject(v: unknown): Project {
  if (!v || typeof v !== "object") throw Error("Неверный формат проекта");
  const p = v as Project;
  if (
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 100 ||
    typeof p.id !== "string" ||
    p.id.length > 100 ||
    typeof p.updated !== "string" ||
    !Number.isFinite(Date.parse(p.updated))
  )
    throw Error("Неверные метаданные проекта");
  return {
    id: p.id,
    name: p.name.trim(),
    updated: p.updated,
    config: validateConfig(p.config),
  };
}
interface State {
  page: Page;
  config: Config;
  projects: Project[];
  activeId: string | null;
  compare: string[];
  notice: string;
  storageError: string;
  go: (p: Page) => void;
  setConfig: (v: Partial<Config>) => void;
  choose: (c: Config) => void;
  save: (name: string) => void;
  open: (id: string) => void;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  importProject: (v: unknown) => void;
  toggleCompare: (id: string) => void;
  message: (s: string) => void;
}
function persist(projects: Project[]): string {
  try {
    localStorage.setItem(KEY, JSON.stringify(projects));
    return "";
  } catch {
    return "Хранилище недоступно или переполнено. Экспортируйте проект в JSON — изменения пока только в памяти.";
  }
}
export const useLab = create<State>((set, get) => ({
  page: "home",
  config: defaults("geo"),
  projects: read(),
  activeId: null,
  compare: [],
  notice: "",
  storageError: "",
  go: (page) => {
    set({ page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  setConfig: (v) => set((s) => ({ config: { ...s.config, ...v } })),
  choose: (config) => {
    set({ config, activeId: null, page: "config" });
    window.scrollTo({ top: 0 });
  },
  save: (name) => {
    const s = get();
    if (!name.trim()) return;
    const id = s.activeId || crypto.randomUUID();
    const p = {
      id,
      name: name.trim().slice(0, 100),
      config: structuredClone(s.config),
      updated: new Date().toISOString(),
    };
    const projects = [p, ...s.projects.filter((x) => x.id !== id)];
    set({
      projects,
      activeId: id,
      storageError: persist(projects),
      notice: "Конфигурация сохранена",
    });
  },
  open: (id) => {
    const p = get().projects.find((p) => p.id === id);
    if (p) {
      set({ config: structuredClone(p.config), activeId: id, page: "config" });
      window.scrollTo({ top: 0 });
    }
  },
  rename: (id, name) => {
    if (!name.trim()) return;
    const projects = get().projects.map((p) =>
      p.id === id
        ? {
            ...p,
            name: name.trim().slice(0, 100),
            updated: new Date().toISOString(),
          }
        : p,
    );
    set({ projects, storageError: persist(projects) });
  },
  duplicate: (id) => {
    const p = get().projects.find((p) => p.id === id);
    if (p) {
      const projects = [
        {
          ...structuredClone(p),
          id: crypto.randomUUID(),
          name: (p.name + " · копия").slice(0, 100),
          updated: new Date().toISOString(),
        },
        ...get().projects,
      ];
      set({
        projects,
        storageError: persist(projects),
        notice: "Копия создана",
      });
    }
  },
  remove: (id) => {
    const s = get(),
      projects = s.projects.filter((p) => p.id !== id);
    set({
      projects,
      compare: s.compare.filter((x) => x !== id),
      activeId: s.activeId === id ? null : s.activeId,
      storageError: persist(projects),
    });
  },
  importProject: (value) => {
    const p = validateProject(value);
    calculate(p.config);
    const projects = [
      { ...p, id: crypto.randomUUID(), updated: new Date().toISOString() },
      ...get().projects,
    ];
    set({
      projects,
      storageError: persist(projects),
      notice: "Проект импортирован",
    });
  },
  toggleCompare: (id) =>
    set((s) => ({
      compare: s.compare.includes(id)
        ? s.compare.filter((x) => x !== id)
        : s.compare.length < 4
          ? [...s.compare, id]
          : s.compare,
      notice:
        !s.compare.includes(id) && s.compare.length >= 4
          ? "Можно сравнить до четырёх конфигураций"
          : "",
    })),
  message: (notice) => set({ notice }),
}));
export function downloadProject(p: Project) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = p.name.replace(/[^а-яa-z0-9_-]/gi, "_") + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
