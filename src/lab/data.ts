export type PlatformId =
  "agro" | "cargo" | "geo" | "rescue" | "inspect" | "wing" | "hybrid" | "eco";
export type Vec3 = [number, number, number];
export interface Component {
  id: string;
  name: string;
  category: string;
  mass: number;
  dimensions: Vec3;
  power: number;
  compatible: PlatformId[];
  description: string;
  voltage?: number;
  capacity?: number;
  resolution?: string;
  volume?: number;
  density?: number;
  mount?: string;
}
export interface Platform {
  id: PlatformId;
  name: string;
  label: string;
  category: string;
  type: string;
  motors: number;
  frameMass: number;
  maxMass: number;
  maxPayload: number;
  size: Vec3;
  power: number;
  color: string;
  description: string;
  features: string[];
}
export const platforms: Platform[] = [
  {
    id: "geo",
    name: "GEO MAPPER",
    label: "Картография",
    category: "ГЕОДЕЗИЯ",
    type: "Квадрокоптер",
    motors: 4,
    frameMass: 1.7,
    maxMass: 5.5,
    maxPayload: 1.8,
    size: [1.5, 0.65, 1.5],
    power: 480,
    color: "#C4FF6B",
    description:
      "Точность начинается с деталей. Компактная платформа для фотограмметрии и пространственного анализа.",
    features: ["Камера на подвесе", "GNSS-приёмник", "Опциональный LiDAR"],
  },
  {
    id: "agro",
    name: "AGRO A6",
    label: "Агромониторинг",
    category: "СЕЛЬСКОЕ ХОЗЯЙСТВО",
    type: "Гексакоптер",
    motors: 6,
    frameMass: 6.4,
    maxMass: 32,
    maxPayload: 19,
    size: [2.8, 1.25, 2.8],
    power: 1800,
    color: "#C4FF6B",
    description:
      "Модульная платформа для изучения точного земледелия: от бака и насоса до системы распыления.",
    features: ["Шесть несущих винтов", "Бак 5–15 литров", "Насос и форсунки"],
  },
  {
    id: "cargo",
    name: "CARGO X8",
    label: "Грузовая платформа",
    category: "ЛОГИСТИКА",
    type: "Октокоптер",
    motors: 8,
    frameMass: 7.8,
    maxMass: 35,
    maxPayload: 15,
    size: [2.9, 1.6, 2.9],
    power: 2100,
    color: "#FFB454",
    description:
      "Усиленная рама, восемь силовых модулей и сменная платформа для исследования полезной нагрузки.",
    features: ["Восемь двигателей", "Высокое шасси", "Грузовая площадка"],
  },
  {
    id: "rescue",
    name: "RESCUE R4",
    label: "Поиск и спасение",
    category: "ПОИСК И СПАСЕНИЕ",
    type: "Квадрокоптер",
    motors: 4,
    frameMass: 2.5,
    maxMass: 8,
    maxPayload: 2.8,
    size: [1.8, 0.9, 1.8],
    power: 650,
    color: "#FFB454",
    description:
      "Тепловизионное обследование и освещение территории на одной защищённой учебной платформе.",
    features: ["Тепловизор", "Поворотный прожектор", "Защищённый корпус"],
  },
  {
    id: "inspect",
    name: "INSPECT S4",
    label: "Техническая инспекция",
    category: "ИНСПЕКЦИЯ",
    type: "Квадрокоптер",
    motors: 4,
    frameMass: 1.2,
    maxMass: 4.5,
    maxPayload: 1.2,
    size: [1.25, 0.55, 1.25],
    power: 350,
    color: "#74D6FF",
    description:
      "Компактная конструкция с защитой винтов и датчиками расстояния для изучения сложных объектов.",
    features: ["Защита винтов", "Поворотная камера", "Дальномеры"],
  },
  {
    id: "wing",
    name: "WING SURVEY",
    label: "Аэросъёмка",
    category: "ГЕОДЕЗИЯ",
    type: "Самолёт",
    motors: 1,
    frameMass: 2.3,
    maxMass: 7,
    maxPayload: 1.5,
    size: [3, 0.65, 1.8],
    power: 220,
    color: "#D5DCE4",
    description:
      "Самолётная платформа с толкающим винтом, сменным крылом и встроенной съёмочной системой.",
    features: ["Размах 2,4–3,6 м", "Толкающий винт", "Хвостовое оперение"],
  },
  {
    id: "hybrid",
    name: "HYBRID V1",
    label: "Гибридная платформа",
    category: "ИССЛЕДОВАНИЯ",
    type: "VTOL",
    motors: 5,
    frameMass: 4.2,
    maxMass: 12,
    maxPayload: 3,
    size: [3.2, 0.8, 2.2],
    power: 450,
    color: "#74D6FF",
    description:
      "Крыло самолёта, четыре подъёмных двигателя и отдельная маршевая силовая установка.",
    features: ["Вертикальный подъём", "Маршевый двигатель", "Самолётное крыло"],
  },
  {
    id: "eco",
    name: "ECO SENSOR",
    label: "Экологический мониторинг",
    category: "ИССЛЕДОВАНИЯ",
    type: "Квадрокоптер",
    motors: 4,
    frameMass: 1.8,
    maxMass: 6,
    maxPayload: 2,
    size: [1.6, 0.8, 1.6],
    power: 460,
    color: "#74D6FF",
    description:
      "Летающий измерительный комплекс для изучения температуры, влажности и качества воздуха.",
    features: ["Измерительный блок", "Сменные датчики", "RGB-камера"],
  },
];
const all = platforms.map((p) => p.id);
const light: PlatformId[] = [
  "geo",
  "rescue",
  "inspect",
  "wing",
  "hybrid",
  "eco",
];
export const library: Component[] = [
  {
    id: "bat-light",
    name: "Li-ion 6S · 6 А·ч",
    category: "battery",
    mass: 0.85,
    dimensions: [0.3, 0.12, 0.18],
    power: 0,
    compatible: light,
    voltage: 22.2,
    capacity: 6,
    description: "Лёгкий аккумуляторный модуль. Учебные номинальные параметры.",
  },
  {
    id: "bat-medium",
    name: "Li-ion 6S · 10 А·ч",
    category: "battery",
    mass: 1.3,
    dimensions: [0.38, 0.15, 0.22],
    power: 0,
    compatible: all,
    voltage: 22.2,
    capacity: 10,
    description:
      "Баланс массы и запаса энергии. Доступная энергия принята равной 80% номинальной.",
  },
  {
    id: "bat-heavy",
    name: "LiPo 12S · 22 А·ч",
    category: "battery",
    mass: 4.6,
    dimensions: [0.52, 0.23, 0.35],
    power: 0,
    compatible: ["agro", "cargo", "hybrid"],
    voltage: 44.4,
    capacity: 22,
    description:
      "Силовой блок для тяжёлых платформ; номинальное напряжение 44,4 В.",
  },
  {
    id: "rgb",
    name: "RGB-камера",
    category: "camera",
    mass: 0.18,
    dimensions: [0.15, 0.16, 0.17],
    power: 6,
    compatible: all,
    resolution: "20 Мп",
    description: "Видимый диапазон, обзор и документирование.",
  },
  {
    id: "photo",
    name: "Фотограмметрическая камера",
    category: "camera",
    mass: 0.48,
    dimensions: [0.22, 0.22, 0.22],
    power: 12,
    compatible: ["geo", "wing", "hybrid"],
    resolution: "42 Мп",
    description:
      "Съёмка перекрывающихся кадров для последующей фотограмметрии.",
  },
  {
    id: "zoom",
    name: "Камера с зумом",
    category: "camera",
    mass: 0.36,
    dimensions: [0.2, 0.22, 0.25],
    power: 14,
    compatible: ["rescue", "inspect", "cargo", "agro"],
    resolution: "24 Мп",
    description: "Поворотный модуль для детального визуального обследования.",
  },
  {
    id: "thermal",
    name: "Тепловизор",
    category: "module",
    mass: 0.32,
    dimensions: [0.18, 0.18, 0.2],
    power: 12,
    compatible: ["rescue", "inspect"],
    resolution: "640 × 512",
    description:
      "Изучение тепловых контрастов. Модель не генерирует фиктивные измерения.",
  },
  {
    id: "lidar",
    name: "LiDAR-модуль",
    category: "module",
    mass: 0.65,
    dimensions: [0.2, 0.24, 0.2],
    power: 22,
    compatible: ["geo", "hybrid"],
    description:
      "Лазерный измерительный модуль для пространственного сканирования.",
  },
  {
    id: "spot",
    name: "Прожектор",
    category: "module",
    mass: 0.4,
    dimensions: [0.25, 0.2, 0.22],
    power: 40,
    compatible: ["rescue"],
    description: "Направленное освещение исследуемой территории.",
  },
  {
    id: "gnss",
    name: "GNSS-навигация",
    category: "sensor",
    mass: 0.08,
    dimensions: [0.16, 0.06, 0.16],
    power: 3,
    compatible: all,
    description: "Учебный спутниковый навигационный приёмник.",
  },
  {
    id: "rtk",
    name: "Геодезический GNSS",
    category: "sensor",
    mass: 0.19,
    dimensions: [0.2, 0.08, 0.2],
    power: 5,
    compatible: ["geo", "agro", "cargo", "wing", "hybrid"],
    description: "Дифференциальный приёмник; точность здесь не моделируется.",
  },
  {
    id: "range",
    name: "Датчики расстояния",
    category: "sensor",
    mass: 0.12,
    dimensions: [0.16, 0.08, 0.08],
    power: 4,
    compatible: ["inspect", "rescue", "cargo", "agro"],
    description:
      "Оптические дальномеры для изучения компоновки системы наблюдения.",
  },
  {
    id: "temperature",
    name: "Температура и влажность",
    category: "sensor",
    mass: 0.09,
    dimensions: [0.12, 0.2, 0.12],
    power: 2,
    compatible: ["eco"],
    description: "Комбинированный метеорологический сенсор.",
  },
  {
    id: "air",
    name: "Датчик качества воздуха",
    category: "sensor",
    mass: 0.24,
    dimensions: [0.2, 0.15, 0.15],
    power: 5,
    compatible: ["eco"],
    description:
      "Пробоотборный измерительный модуль. Данные с реального датчика не подключены.",
  },
  {
    id: "logger",
    name: "Измерительный регистратор",
    category: "module",
    mass: 0.28,
    dimensions: [0.26, 0.12, 0.18],
    power: 8,
    compatible: ["eco"],
    description: "Компоновочный пример блока регистрации измерений.",
  },
  ...[5, 10, 15].map((volume) => ({
    id: `tank-${volume}`,
    name: `Бак ${volume} л`,
    category: "tank",
    mass: 0.4 + volume * 0.055,
    dimensions: [
      0.35 + volume * 0.022,
      0.35 + volume * 0.025,
      0.35 + volume * 0.022,
    ] as Vec3,
    power: 0,
    compatible: ["agro"] as PlatformId[],
    volume,
    density: 1,
    description: "Бак для воды. Учебное приближение плотности: 1 кг/л.",
  })),
  {
    id: "pump",
    name: "Насос",
    category: "module",
    mass: 0.55,
    dimensions: [0.22, 0.15, 0.15],
    power: 60,
    compatible: ["agro"],
    description: "Подача жидкости к распылительным магистралям.",
  },
  {
    id: "nozzle",
    name: "Распылительная форсунка",
    category: "module",
    mass: 0.06,
    dimensions: [0.05, 0.1, 0.05],
    power: 2,
    compatible: ["agro"],
    description: "Один распылительный узел с креплением.",
  },
  {
    id: "tray",
    name: "Открытая грузовая платформа",
    category: "cargo",
    mass: 0.7,
    dimensions: [0.85, 0.08, 0.65],
    power: 0,
    compatible: ["cargo"],
    mount: "Стропы",
    description: "Плоская площадка с креплениями полезной нагрузки.",
  },
  {
    id: "box",
    name: "Закрытый грузовой контейнер",
    category: "cargo",
    mass: 1.3,
    dimensions: [0.75, 0.5, 0.6],
    power: 0,
    compatible: ["cargo"],
    mount: "Жёсткое крепление",
    description: "Защитный короб для груза.",
  },
  {
    id: "guards",
    name: "Защита пропеллеров",
    category: "protection",
    mass: 0.3,
    dimensions: [1.25, 0.06, 1.25],
    power: 0,
    compatible: ["inspect", "rescue"],
    description: "Лёгкие кольцевые ограждения винтов.",
  },
];
export interface Config {
  platform: PlatformId;
  battery: string;
  camera: string;
  sensors: string[];
  modules: string[];
  tank: number;
  fill: number;
  nozzles: number;
  cargo: number;
  cargoMount: string;
  wingSpan: number;
  guards: boolean;
  scenario: number;
}
export function defaults(id: PlatformId): Config {
  const heavy = id === "agro" || id === "cargo";
  return {
    platform: id,
    battery: heavy ? "bat-heavy" : "bat-medium",
    camera: id === "geo" ? "photo" : "rgb",
    sensors: id === "eco" ? ["gnss", "temperature", "air"] : ["gnss"],
    modules:
      id === "rescue" ? ["thermal", "spot"] : id === "eco" ? ["logger"] : [],
    tank: 10,
    fill: 100,
    nozzles: 4,
    cargo: id === "cargo" ? 3 : 0,
    cargoMount: "tray",
    wingSpan: id === "hybrid" ? 3.2 : 3,
    guards: id === "inspect",
    scenario: 1,
  };
}
export function platformOf(c: Config) {
  return platforms.find((p) => p.id === c.platform)!;
}
export function componentOf(id: string) {
  return library.find((c) => c.id === id)!;
}
export interface Part {
  key: string;
  component: Component;
  position: Vec3;
  visual: string;
}
export function partsOf(c: Config): Part[] {
  const p = platformOf(c);
  const parts: Part[] = [];
  const add = (id: string, position: Vec3, visual = id, key = id) =>
    parts.push({ key, component: componentOf(id), position, visual });
  const custom = (
    key: string,
    name: string,
    category: string,
    mass: number,
    dimensions: Vec3,
    position: Vec3,
    visual: string,
    power = 0,
    description = "Учебный конструктивный элемент платформы.",
  ) =>
    parts.push({
      key,
      component: {
        id: key,
        name,
        category,
        mass,
        dimensions,
        power,
        compatible: [p.id],
        description,
      },
      position,
      visual,
    });
  const plane = p.id === "wing" || p.id === "hybrid";
  custom(
    "frame",
    plane ? "Фюзеляж и крыло" : "Центральная рама",
    "structure",
    p.frameMass * (plane ? c.wingSpan / p.size[0] : 1),
    plane ? [c.wingSpan, 0.25, p.size[2]] : [0.6, 0.22, 0.6],
    [0, 0, 0],
    "frame",
  );
  const radius = p.size[0] * 0.35;
  const count = plane ? (p.id === "hybrid" ? 4 : 0) : p.motors;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI / 4 + (i * Math.PI * 2) / count;
    const pos: Vec3 = plane
      ? [(i % 2 === 0 ? 1 : -1) * 0.8, 0.07, i < 2 ? -0.55 : 0.55]
      : [Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius];
    custom(
      `motor-${i}`,
      "Двигатель " + (i + 1),
      "motor",
      p.id === "agro" || p.id === "cargo" ? 0.32 : 0.13,
      [0.13, 0.15, 0.13],
      pos,
      "motor",
    );
    custom(
      `prop-${i}`,
      "Пропеллер " + (i + 1),
      "propeller",
      0.035,
      [radius * (count === 8 ? 0.65 : count === 6 ? 0.9 : 1.1), 0.025, 0.06],
      [pos[0], pos[1] + 0.13, pos[2]],
      "prop",
    );
  }
  if (plane) {
    custom(
      "cruise",
      "Маршевый двигатель",
      "motor",
      0.22,
      [0.16, 0.16, 0.2],
      [0, 0.02, 0.92],
      "cruise",
    );
    custom(
      "pusher",
      "Толкающий винт",
      "propeller",
      0.045,
      [0.7, 0.7, 0.03],
      [0, 0.02, 1.06],
      "pusher",
    );
  }
  custom(
    "gear",
    "Посадочные опоры",
    "structure",
    heavyPlatform(c) ? 0.65 : 0.2,
    [p.size[0] * 0.45, 0.4, p.size[2] * 0.55],
    [0, -0.4, 0],
    "gear",
  );
  add(c.battery, [0, 0.24, plane ? 0.1 : 0], "battery");
  if (c.camera !== "none") add(c.camera, [0, -0.25, -0.3], "camera");
  c.sensors.forEach((id, i) =>
    add(id, [0.22 * (i % 2 === 0 ? 1 : -1), 0.25 + i * 0.1, -0.08], "sensor"),
  );
  c.modules.forEach((id, i) =>
    add(id, [i % 2 === 0 ? -0.26 : 0.26, -0.28, -0.02 + i * 0.2], id),
  );
  if (c.guards) add("guards", [0, 0.13, 0], "guards");
  if (c.platform === "agro") {
    add(`tank-${c.tank}`, [0, -0.38, 0.12], "tank");
    add("pump", [0.27, -0.29, 0.18], "pump");
    for (let i = 0; i < c.nozzles; i++)
      add(
        "nozzle",
        [(i - (c.nozzles - 1) / 2) * 0.25, -0.66, -0.12],
        "nozzle",
        `nozzle-${i}`,
      );
    custom(
      "water",
      "Жидкость в баке",
      "payload",
      (c.tank * c.fill) / 100,
      [0.5, 0.4, 0.5],
      [0, -0.38, 0.12],
      "water",
      0,
      "Вода: 1 литр ≈ 1 килограмм. Масса зависит от заполнения бака.",
    );
  }
  if (c.platform === "cargo") {
    add(c.cargoMount, [0, -0.65, 0], "cargoMount");
    custom(
      "payload",
      "Учебный груз",
      "payload",
      c.cargo,
      [0.55, 0.35, 0.45],
      [0, -0.43, 0],
      "payload",
      0,
      "Регулируемая масса груза; размеры условные, крепление — " +
        componentOf(c.cargoMount).mount,
    );
  }
  return parts;
}
export function heavyPlatform(c: Config) {
  return c.platform === "agro" || c.platform === "cargo";
}
export function calculate(c: Config) {
  const p = platformOf(c),
    parts = partsOf(c),
    mass = parts.reduce((s, x) => s + x.component.mass, 0);
  const battery = componentOf(c.battery),
    energy = battery.voltage! * battery.capacity!,
    available = energy * 0.8;
  const payload = parts
    .filter((x) =>
      ["camera", "sensor", "module", "tank", "cargo", "payload"].includes(
        x.component.category,
      ),
    )
    .reduce((s, x) => s + x.component.mass, 0);
  const aux = parts.reduce((s, x) => s + x.component.power, 0);
  const dry =
    mass -
    (c.platform === "agro"
      ? (c.tank * c.fill) / 100
      : c.platform === "cargo"
        ? c.cargo
        : 0);
  // Explicit pedagogical model: reference power scaled by mass; airplane cruise uses a linear exponent.
  const referenceMass = p.frameMass + (heavyPlatform(c) ? 6 : 2);
  const propulsion =
    p.power *
    Math.pow(
      mass / referenceMass,
      p.id === "wing" || p.id === "hybrid" ? 1 : 1.5,
    ) *
    c.scenario;
  const power = propulsion + aux,
    minutes = (available / power) * 60;
  const center = parts
    .reduce(
      (s, x) => s.map((v, i) => v + x.component.mass * x.position[i]) as Vec3,
      [0, 0, 0] as Vec3,
    )
    .map((v) => v / mass) as Vec3;
  const warnings: string[] = [];
  if (mass > p.maxMass)
    warnings.push(
      `Превышена учебная взлётная масса на ${(mass - p.maxMass).toFixed(2)} кг`,
    );
  if (payload > p.maxPayload)
    warnings.push(
      `Превышена допустимая полезная нагрузка на ${(payload - p.maxPayload).toFixed(2)} кг`,
    );
  return {
    parts,
    mass,
    dry,
    payload,
    aux,
    batteryMass: battery.mass,
    energy,
    available,
    power,
    propulsion,
    minutes,
    center,
    reserve: Math.max(0, Math.min(p.maxMass - mass, p.maxPayload - payload)),
    fullTank: c.platform === "agro" ? dry + c.tank : 0,
    warnings,
    size: [
      p.id === "wing" || p.id === "hybrid" ? c.wingSpan : p.size[0],
      p.size[1],
      p.size[2],
    ] as Vec3,
  };
}
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== "object") throw Error("Нет конфигурации");
  const c = value as Config;
  if (!platforms.some((p) => p.id === c.platform))
    throw Error("Неизвестная платформа");
  const allowed = (id: string, category: string) =>
    library.some(
      (x) =>
        x.id === id &&
        x.category === category &&
        x.compatible.includes(c.platform),
    );
  if (
    !allowed(c.battery, "battery") ||
    !(c.camera === "none" || allowed(c.camera, "camera"))
  )
    throw Error("Несовместимый аккумулятор или камера");
  for (const [list, cat] of [
    [c.sensors, "sensor"],
    [c.modules, "module"],
  ] as const) {
    if (
      !Array.isArray(list) ||
      list.length > 10 ||
      new Set(list).size !== list.length ||
      !list.every((id) => allowed(id, cat) && id !== "pump" && id !== "nozzle")
    )
      throw Error("Некорректное оборудование");
  }
  for (const [n, min, max] of [
    [c.fill, 0, 100],
    [c.cargo, 0, 20],
    [c.scenario, 0.6, 1.5],
  ] as const)
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      throw Error("Параметры вне допустимого диапазона");
  if (
    ![5, 10, 15].includes(c.tank) ||
    ![2, 4, 6].includes(c.nozzles) ||
    ![2.4, 3, 3.2, 3.6].includes(c.wingSpan) ||
    !["tray", "box"].includes(c.cargoMount) ||
    typeof c.guards !== "boolean"
  )
    throw Error("Некорректные настройки конструкции");
  if (![0.8, 1, 1.3].includes(c.scenario))
    throw Error("Неизвестный сценарий потребления");
  if (c.guards && !["inspect", "rescue"].includes(c.platform))
    throw Error("Защита несовместима с платформой");
  if (
    (c.platform === "wing" && ![2.4, 3, 3.6].includes(c.wingSpan)) ||
    (c.platform === "hybrid" && ![2.4, 3.2, 3.6].includes(c.wingSpan))
  )
    throw Error("Несовместимое крыло");
  return {
    platform: c.platform,
    battery: c.battery,
    camera: c.camera,
    sensors: [...c.sensors],
    modules: [...c.modules],
    tank: c.tank,
    fill: c.fill,
    nozzles: c.nozzles,
    cargo: c.cargo,
    cargoMount: c.cargoMount,
    wingSpan: c.wingSpan,
    guards: c.guards,
    scenario: c.scenario,
  };
}
