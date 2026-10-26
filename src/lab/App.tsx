import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  MoveUpRight,
  Box,
  SlidersHorizontal,
  Layers3,
  GitCompareArrows,
  FolderOpen,
  Menu,
  X,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Check,
  Rotate3D,
  Maximize,
  Minimize,
  Expand,
  Eye,
  ScanLine,
  Weight,
  Battery,
  Camera,
  Radio,
  Thermometer,
  Download,
  Upload,
  Copy,
  Pencil,
  Trash2,
  Save,
  AlertTriangle,
  Info,
  MousePointer2,
  RotateCcw,
  Compass,
  Move3D,
  CheckCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  calculate,
  componentOf,
  defaults,
  library,
  platformOf,
  platforms,
  type Config,
  type Part,
  type PlatformId,
} from "./data";
import { downloadProject, useLab, type Page, type Project } from "./store";
import { Scene, type ViewMode, type CameraView } from "./Scene";
const nav: { page: Page; label: string; short: string }[] = [
  { page: "home", label: "Главная", short: "Главная" },
  { page: "catalog", label: "Каталог БПЛА", short: "Каталог" },
  { page: "config", label: "Конфигуратор", short: "Сборка" },
  { page: "twin", label: "Цифровой двойник", short: "Модель" },
  { page: "compare", label: "Сравнение", short: "Сравнение" },
  { page: "projects", label: "Мои проекты", short: "Проекты" },
];
const fmt = (n: number, d = 2) =>
  n.toLocaleString("ru-RU", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
const icons = [Rotate3D, Layers3, Compass, GitCompareArrows];
function surveyModes(c: Config) {
  return (
    [
      c.camera === "photo"
        ? "Фотограмметрия"
        : c.camera === "none"
          ? null
          : "Визуальная съёмка",
      c.modules.includes("lidar") ? "Лазерное сканирование" : null,
      c.modules.includes("thermal") ? "Тепловизионное обследование" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Съёмочное оборудование не установлено"
  );
}
function Tag({
  children,
  green = false,
}: {
  children: ReactNode;
  green?: boolean;
}) {
  return <span className={"tag " + (green ? "green" : "")}>{children}</span>;
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className={"metric " + (accent ? "accent" : "")}>
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function Home() {
  const { go, choose } = useLab();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> ОТ ИДЕИ — К УСТРОЙСТВУ
          </div>
          <h1>
            АЭРО<span>ЛАБ</span>
          </h1>
          <h2>
            Исследуй. Проектируй.
            <br />
            <em>Анализируй.</em>
          </h2>
          <p>
            Интерактивная образовательная платформа для изучения конструкции и
            технических характеристик беспилотных авиационных систем.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => go("catalog")}>
              Изучить БПЛА <ArrowUpRight size={18} />
            </button>
            <button
              className="text-button"
              onClick={() => choose(defaults("geo"))}
            >
              Создать конфигурацию <ArrowRight size={17} />
            </button>
          </div>
          <div className="hero-note">
            <Box size={15} />
            <span>Настоящая инженерия. Учебные модели.</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-top">
            <span>ОБЪЕКТ 01 / GEO MAPPER</span>
            <span>
              <span className="status-dot" /> 3D LIVE
            </span>
          </div>
          <Scene config={defaults("geo")} hero />
          <div className="annotation annotation-one">
            <span className="crosshair" />
            <div>
              Модульная конструкция
              <small>Каждый компонент имеет значение</small>
            </div>
          </div>
          <div className="annotation annotation-two">
            <span className="line-dot" />
            Камера на 3-осевом подвесе
          </div>
          <div className="visual-bottom">
            <span>
              <MousePointer2 size={14} /> Вращайте, чтобы исследовать
            </span>
            <span>
              01 <i>/ 08</i>
            </span>
          </div>
        </div>
      </section>
      <div className="home-divider">
        <span>ИНТЕРАКТИВНАЯ ЛАБОРАТОРИЯ БЕСПИЛОТНЫХ АВИАЦИОННЫХ СИСТЕМ</span>
        <span>
          ПРОКРУТИТЕ, ЧТОБЫ ОТКРЫТЬ <ChevronDown size={14} />
        </span>
      </div>
      <section className="home-catalog section-space">
        <div className="section-title">
          <div>
            <div className="eyebrow">01 / ИССЛЕДУЙТЕ ПЛАТФОРМЫ</div>
            <h2>
              Разные задачи.
              <br />
              <span>Разная инженерия.</span>
            </h2>
          </div>
          <div className="section-right">
            <p>
              От компактного исследователя до грузового октокоптера.
              Познакомьтесь с конструкцией каждого.
            </p>
            <button className="text-button" onClick={() => go("catalog")}>
              Весь каталог <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
        <div className="featured-grid">
          {(["agro", "cargo", "wing"] as PlatformId[]).map((id, i) => {
            const p = platforms.find((p) => p.id === id)!;
            return (
              <button
                className="feature-card"
                key={id}
                onClick={() => choose(defaults(id))}
              >
                <div className="card-top">
                  <span>0{i + 1}</span>
                  <Tag>{p.category}</Tag>
                </div>
                <Scene config={defaults(id)} thumbnail />
                <div className="feature-card-bottom">
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.type}</p>
                  </div>
                  <span className="circle-arrow">
                    <ArrowUpRight size={21} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <section className="capabilities section-space">
        <div className="eyebrow">02 / ИНСТРУМЕНТЫ ДЛЯ ВАШИХ ИДЕЙ</div>
        <h2>Понять. Собрать. Проверить.</h2>
        <div className="capability-grid">
          {[
            {
              title: "3D-визуализация",
              text: "Рассматривайте детали, открывайте корпус и исследуйте конструкцию.",
              page: "twin",
            },
            {
              title: "Модульная сборка",
              text: "Выбирайте совместимые камеры, аккумуляторы и оборудование.",
              page: "config",
            },
            {
              title: "Инженерные расчёты",
              text: "Изучайте массу, энергию, центр масс и ограничения платформы.",
              page: "twin",
            },
            {
              title: "Сравнение конфигураций",
              text: "Находите различия и сохраняйте свои инженерные решения.",
              page: "compare",
            },
          ].map((item, i) => {
            const Icon = icons[i];
            return (
              <button key={item.title} onClick={() => go(item.page as Page)}>
                <Icon size={26} />
                <span className="capability-index">0{i + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <ArrowUpRight size={18} />
              </button>
            );
          })}
        </div>
      </section>
      <section className="callout">
        <div>
          <div className="eyebrow">ВАША СЛЕДУЮЩАЯ ИДЕЯ НАЧИНАЕТСЯ ЗДЕСЬ</div>
          <h2>Соберите свою конфигурацию.</h2>
          <p>Без регистрации. Без установки сложного ПО. Прямо в браузере.</p>
        </div>
        <button className="primary" onClick={() => choose(defaults("geo"))}>
          Открыть конструктор <ArrowUpRight size={18} />
        </button>
      </section>
    </>
  );
}
function Catalog() {
  const { choose, toggleCompare, compare, go } = useLab();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("Все направления"),
    [type, setType] = useState("Все конструкции"),
    [motors, setMotors] = useState("Все"),
    [maxMass, setMaxMass] = useState(40),
    [minPayload, setMinPayload] = useState(0),
    [detail, setDetail] = useState<PlatformId | null>(null);
  const filtered = platforms.filter((p) => {
    const m = calculate(defaults(p.id));
    return (
      (p.name + " " + p.description + " " + p.category)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (category === "Все направления" || p.category === category) &&
      (type === "Все конструкции" || p.type === type) &&
      (motors === "Все" || p.motors === Number(motors)) &&
      m.mass <= maxMass &&
      p.maxPayload >= minPayload
    );
  });
  return (
    <div className="page-content">
      <PageTitle
        eyebrow="01 / БИБЛИОТЕКА ПЛАТФОРМ"
        title="Каталог БПЛА"
        description="Восемь конструкций. Восемь способов исследовать мир."
        action={<Tag green>УЧЕБНЫЕ МОДЕЛИ</Tag>}
      />
      <div className="catalog-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Поиск БПЛА"
            placeholder="Название, назначение, оборудование…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Тип конструкции"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {["Все конструкции", ...new Set(platforms.map((p) => p.type))].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        <label className="inline-field">
          Двигатели{" "}
          <select
            aria-label="Число двигателей"
            value={motors}
            onChange={(e) => setMotors(e.target.value)}
          >
            {["Все", "1", "4", "5", "6", "8"].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-chips">
        {["Все направления", ...new Set(platforms.map((p) => p.category))].map(
          (s) => (
            <button
              key={s}
              className={category === s ? "active" : ""}
              onClick={() => setCategory(s)}
            >
              {s}
            </button>
          ),
        )}
      </div>
      <div className="range-filters">
        <label>
          Масса до <strong>{maxMass} кг</strong>
          <input
            aria-label="Максимальная масса"
            type="range"
            min="2"
            max="40"
            step="1"
            value={maxMass}
            onChange={(e) => setMaxMass(+e.target.value)}
          />
        </label>
        <label>
          Предел нагрузки от <strong>{minPayload} кг</strong>
          <input
            aria-label="Минимальная грузоподъёмность"
            type="range"
            min="0"
            max="15"
            step=".5"
            value={minPayload}
            onChange={(e) => setMinPayload(+e.target.value)}
          />
        </label>
        <span>{filtered.length} / 8 платформ</span>
        <button
          className="text-button"
          onClick={() => {
            setSearch("");
            setCategory("Все направления");
            setType("Все конструкции");
            setMotors("Все");
            setMaxMass(40);
            setMinPayload(0);
          }}
        >
          <RotateCcw size={14} /> Сбросить
        </button>
      </div>
      <div className="catalog-grid">
        {filtered.map((p) => {
          const m = calculate(defaults(p.id));
          return (
            <article className="catalog-card" key={p.id}>
              <div className="card-top">
                <Tag>{p.category}</Tag>
                <button
                  className={
                    "icon-button " +
                    (compare.includes("base:" + p.id) ? "selected" : "")
                  }
                  aria-label={"Сравнить " + p.name}
                  title="Добавить к сравнению"
                  onClick={() => toggleCompare("base:" + p.id)}
                >
                  {compare.includes("base:" + p.id) ? (
                    <Check size={18} />
                  ) : (
                    <GitCompareArrows size={18} />
                  )}
                </button>
              </div>
              <button
                className="model-button"
                aria-label={"Открыть " + p.name}
                onClick={() => setDetail(p.id)}
              >
                <Scene config={defaults(p.id)} thumbnail />
              </button>
              <div className="catalog-card-content">
                <div className="card-type">
                  {p.type} · {p.motors}{" "}
                  {p.motors === 1
                    ? "двигатель"
                    : p.motors < 5
                      ? "двигателя"
                      : "двигателей"}
                </div>
                <h2>{p.name}</h2>
                <p>{p.description}</p>
                <div className="card-metrics">
                  <div>
                    <span>Базовая масса</span>
                    <strong>
                      {fmt(m.mass)} <small>кг</small>
                    </strong>
                  </div>
                  <div>
                    <span>Предел нагрузки</span>
                    <strong>
                      {fmt(p.maxPayload, 1)} <small>кг</small>
                    </strong>
                  </div>
                </div>
                <button className="card-open" onClick={() => setDetail(p.id)}>
                  Исследовать платформу <ArrowUpRight size={18} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty">
          <Search />
          <h2>Ничего не найдено</h2>
          <p>Измените запрос или ослабьте фильтры.</p>
        </div>
      )}
      {compare.length > 0 && (
        <button
          className="compare-floating primary"
          onClick={() => go("compare")}
        >
          <GitCompareArrows size={18} /> Сравнить · {compare.length}
          <ArrowRight size={17} />
        </button>
      )}
      {detail &&
        (() => {
          const p = platforms.find((x) => x.id === detail)!,
            m = calculate(defaults(detail));
          return (
            <Modal title={p.name} onClose={() => setDetail(null)} wide>
              <div className="detail-grid">
                <div className="detail-model">
                  <Scene config={defaults(detail)} />
                </div>
                <div>
                  <Tag green>{p.type}</Tag>
                  <h3>{p.label}</h3>
                  <p>{p.description}</p>
                  <ul className="feature-list">
                    {p.features.map((x) => (
                      <li key={x}>
                        <Check size={16} />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <div className="metrics-grid">
                    <Metric
                      label="Масса конфигурации"
                      value={fmt(m.mass)}
                      unit="кг"
                    />
                    <Metric
                      label="Предел взлётной массы"
                      value={fmt(p.maxMass, 1)}
                      unit="кг"
                    />
                  </div>
                  <p className="muted-note">
                    Демонстрационная платформа. Не является серийным аппаратом;
                    характеристики заданы для обучения.
                  </p>
                  <button
                    className="primary"
                    onClick={() => choose(defaults(detail))}
                  >
                    Настроить конфигурацию <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button aria-label="Закрыть" className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}
function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field range-field">
      <span>
        {label}
        <strong>
          {fmt(value, step < 1 ? 1 : 0)} {unit}
        </strong>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <small>
        {min} {unit}
        <span>
          {max} {unit}
        </span>
      </small>
    </label>
  );
}
function ConfigControls() {
  const { config: c, setConfig, choose } = useLab();
  const choices = (cat: string) =>
    library
      .filter((x) => x.category === cat && x.compatible.includes(c.platform))
      .map((x) => ({ value: x.id, label: x.name }));
  const toggle = (key: "modules" | "sensors", id: string) =>
    setConfig({
      [key]: c[key].includes(id)
        ? c[key].filter((x) => x !== id)
        : [...c[key], id],
    });
  const modules = library.filter(
    (x) =>
      x.category === "module" &&
      x.compatible.includes(c.platform) &&
      !["pump", "nozzle"].includes(x.id),
  );
  return (
    <>
      <div className="panel-heading">
        <SlidersHorizontal size={16} /> КОМПЛЕКТАЦИЯ <span>01</span>
      </div>
      <div className="panel-body">
        <SelectField
          label="Базовая платформа"
          value={c.platform}
          options={platforms.map((p) => ({ value: p.id, label: p.name }))}
          onChange={(v) => choose(defaults(v as PlatformId))}
        />
        <div className="control-section">
          <h3>
            <Battery size={16} /> Энергосистема
          </h3>
          <SelectField
            label="Аккумулятор"
            value={c.battery}
            options={choices("battery")}
            onChange={(battery) => setConfig({ battery })}
          />
          <div className="component-spec">
            {fmt(componentOf(c.battery).voltage!, 1)} В <span>·</span>{" "}
            {componentOf(c.battery).capacity} А·ч <span>·</span>{" "}
            {fmt(componentOf(c.battery).mass)} кг
          </div>
        </div>
        <div className="control-section">
          <h3>
            <Camera size={16} /> Оборудование
          </h3>
          <SelectField
            label="Камера"
            value={c.camera}
            options={[
              { value: "none", label: "Без камеры" },
              ...choices("camera"),
            ]}
            onChange={(camera) => setConfig({ camera })}
          />
          {modules.map((x) => (
            <label className="checkbox" key={x.id}>
              <input
                type="checkbox"
                checked={c.modules.includes(x.id)}
                onChange={() => toggle("modules", x.id)}
              />
              <span>
                {x.name}
                <small>
                  {fmt(x.mass)} кг · {x.power} Вт
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="control-section">
          <h3>
            <Radio size={16} /> Датчики
          </h3>
          {choices("sensor").map((x) => (
            <label className="checkbox" key={x.value}>
              <input
                type="checkbox"
                checked={c.sensors.includes(x.value)}
                onChange={() => toggle("sensors", x.value)}
              />
              <span>
                {x.label}
                <small>
                  {componentOf(x.value).power} Вт ·{" "}
                  {fmt(componentOf(x.value).mass)} кг
                </small>
              </span>
            </label>
          ))}
        </div>
        {c.platform === "agro" && (
          <div className="control-section">
            <h3>
              <Layers3 size={16} /> Система распыления
            </h3>
            <SelectField
              label="Объём бака"
              value={String(c.tank)}
              options={[5, 10, 15].map((n) => ({
                value: String(n),
                label: n + " литров",
              }))}
              onChange={(v) => setConfig({ tank: +v })}
            />
            <RangeField
              label="Заполнение бака"
              value={c.fill}
              min={0}
              max={100}
              unit="%"
              onChange={(fill) => setConfig({ fill })}
            />
            <SelectField
              label="Количество форсунок"
              value={String(c.nozzles)}
              options={[2, 4, 6].map((n) => ({
                value: String(n),
                label: String(n),
              }))}
              onChange={(v) => setConfig({ nozzles: +v })}
            />
            <p className="muted-note">
              Насос установлен. Жидкость: вода, 1 л ≈ 1 кг.
            </p>
          </div>
        )}
        {c.platform === "cargo" && (
          <div className="control-section">
            <h3>
              <Box size={16} /> Полезная нагрузка
            </h3>
            <RangeField
              label="Масса груза"
              value={c.cargo}
              min={0}
              max={20}
              step={0.5}
              unit="кг"
              onChange={(cargo) => setConfig({ cargo })}
            />
            <SelectField
              label="Крепление груза"
              value={c.cargoMount}
              options={choices("cargo")}
              onChange={(cargoMount) => setConfig({ cargoMount })}
            />
          </div>
        )}
        {(c.platform === "wing" || c.platform === "hybrid") && (
          <div className="control-section">
            <h3>
              <Expand size={16} /> Планер
            </h3>
            <SelectField
              label="Размах крыла"
              value={String(c.wingSpan)}
              options={(c.platform === "hybrid"
                ? [2.4, 3.2, 3.6]
                : [2.4, 3, 3.6]
              ).map((n) => ({ value: String(n), label: fmt(n, 1) + " м" }))}
              onChange={(v) => setConfig({ wingSpan: +v })}
            />
          </div>
        )}
        {["inspect", "rescue"].includes(c.platform) && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={c.guards}
              onChange={(e) => setConfig({ guards: e.target.checked })}
            />
            <span>
              Защита пропеллеров<small>+0,30 кг</small>
            </span>
          </label>
        )}
        <div className="control-section">
          <h3>
            <Compass size={16} /> Расчётный сценарий
          </h3>
          <SelectField
            label="Режим потребления"
            value={String(c.scenario)}
            options={[
              { value: "0.8", label: "Экономичный · 80%" },
              {
                value: "1",
                label:
                  c.platform === "wing" || c.platform === "hybrid"
                    ? "Крейсерский · 100%"
                    : "Номинальный · 100%",
              },
              { value: "1.3", label: "Повышенный · 130%" },
            ]}
            onChange={(v) => setConfig({ scenario: +v })}
          />
          <small className="muted-note">
            Коэффициент мощности учебной модели. Это не управление полётом.
          </small>
        </div>
      </div>
    </>
  );
}
function StatsPanel() {
  const c = useLab((s) => s.config),
    m = calculate(c),
    p = platformOf(c);
  return (
    <>
      <div className="panel-heading">
        <ScanLine size={16} /> РАСЧЁТНЫЕ ПАРАМЕТРЫ <span>03</span>
      </div>
      <div className="panel-body stats-body">
        <div className="status-label">
          <span
            className={"status-dot " + (m.warnings.length ? "warning" : "")}
          />
          {m.warnings.length
            ? "ПРОВЕРЬТЕ ОГРАНИЧЕНИЯ"
            : "В ПРЕДЕЛАХ УЧЕБНЫХ ОГРАНИЧЕНИЙ"}
        </div>
        <Metric label="Общая масса" value={fmt(m.mass)} unit="кг" accent />
        <div className="mass-meter">
          <span
            style={{
              width: Math.min(100, (m.mass / p.maxMass) * 100) + "%",
              background: m.warnings.length ? "#FFB454" : undefined,
            }}
          />
        </div>
        <div className="meter-caption">
          Предел платформы <span>{p.maxMass} кг</span>
        </div>
        <div className="stats-pairs">
          <Metric label="Полезная нагрузка" value={fmt(m.payload)} unit="кг" />
          <Metric label="Аккумулятор" value={fmt(m.batteryMass)} unit="кг" />
          <Metric
            label="Доступная энергия"
            value={fmt(m.available, 1)}
            unit="Вт·ч"
          />
          <Metric
            label="Системы / оборудование"
            value={fmt(m.aux, 0)}
            unit="Вт"
          />
          <Metric label="Средняя мощность" value={fmt(m.power, 0)} unit="Вт" />
          <Metric label="Оценка времени" value={fmt(m.minutes, 1)} unit="мин" />
        </div>
        {c.platform === "agro" && (
          <div className="special-stats">
            <span>
              Масса без жидкости <b>{fmt(m.dry)} кг</b>
            </span>
            <span>
              Жидкость сейчас <b>{fmt((c.tank * c.fill) / 100)} кг</b>
            </span>
            <span>
              С полным баком <b>{fmt(m.fullTank)} кг</b>
            </span>
          </div>
        )}
        {c.platform === "cargo" && (
          <div className="special-stats">
            <span>
              Аппарат без груза <b>{fmt(m.dry)} кг</b>
            </span>
            <span>
              Груз <b>{fmt(c.cargo)} кг</b>
            </span>
            <span>
              Доступный резерв <b>{fmt(m.reserve)} кг</b>
            </span>
          </div>
        )}
        {m.warnings.map((w) => (
          <div className="warning-box" key={w}>
            <AlertTriangle size={16} />
            {w}
          </div>
        ))}
        <div className="equipment-summary">
          <h4>Оснащение и назначение</h4>
          <p>{surveyModes(c)}</p>
          {c.platform === "eco" && (
            <p>
              {[...c.sensors, ...c.modules]
                .map((id) => componentOf(id).name)
                .join(" · ") || "Измерительные модули не установлены"}
            </p>
          )}
          <p>
            Габариты платформы: {m.size.map((n) => fmt(n, 1)).join(" × ")} м
          </p>
          <p>
            Двигатели:{" "}
            {c.platform === "hybrid"
              ? "4 подъёмных + 1 маршевый"
              : c.platform === "wing"
                ? "1 маршевый"
                : p.motors + " подъёмных"}
          </p>
        </div>
        <div className="center-mass">
          <h4>
            Центр масс <span>м</span>
          </h4>
          <div>
            {m.center.map((v, i) => (
              <span key={i}>
                <small>{["X", "Y", "Z"][i]}</small>
                {fmt(v, 3)}
              </span>
            ))}
          </div>
        </div>
        <details className="assumptions">
          <summary>
            <Info size={14} /> Как это рассчитано <ChevronDown size={14} />
          </summary>
          <p>
            Учебная модель, не подтверждённый двойник серийного БПЛА. Масса —
            сумма всех компонентов, включая{" "}
            {c.platform === "agro" ? "воду" : "полезную нагрузку"}. Координаты
            заданы в метрах относительно центра рамы.
          </p>
          <p>E = U × C; доступно 80% энергии. t = Eдоступная / P × 60 минут.</p>
          <p>
            P = Pбаз × (масса / масса опорной конфигурации)
            <sup>
              {c.platform === "wing" || c.platform === "hybrid" ? "1" : "1,5"}
            </sup>{" "}
            × коэффициент сценария + мощность оборудования. Базовая мощность:{" "}
            {p.power} Вт, опорная масса:{" "}
            {fmt(
              p.frameMass + (["agro", "cargo"].includes(c.platform) ? 6 : 2),
              1,
            )}{" "}
            кг.
          </p>
          <p>
            {c.platform === "wing" || c.platform === "hybrid"
              ? "Самолёт: оценка крейсерского потребления. Взлёт, переход VTOL, аэродинамика и подъёмная сила не моделируются."
              : "Мультикоптер: условный номинальный режим. Ветер, КПД винтов и температура не моделируются."}{" "}
            Системы и оборудование считаются постоянно включёнными.
          </p>
          <p>
            Нагрузка включает съёмочные, измерительные и рабочие модули. Резерв
            ограничен как взлётной массой, так и пределом нагрузки. Размеры —
            условные габариты платформы; смена модулей может потребовать
            проверки зазоров.
          </p>
        </details>
      </div>
    </>
  );
}
function SaveDialog({ onClose }: { onClose: () => void }) {
  const { activeId, projects, config, save } = useLab();
  const [name, setName] = useState(
    projects.find((p) => p.id === activeId)?.name ||
      platformOf(config).name + " · моя сборка",
  );
  return (
    <Modal title="Сохранить конфигурацию" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(name);
          onClose();
        }}
      >
        <label className="field">
          <span>Название проекта</span>
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted-note">
          Проект хранится в этом браузере. Для резервной копии используйте
          экспорт JSON.
        </p>
        <button className="primary" type="submit">
          <Save size={16} /> Сохранить
        </button>
      </form>
    </Modal>
  );
}
const modes: { id: ViewMode; label: string; icon: typeof Eye }[] = [
  { id: "normal", label: "3D-вид", icon: Box },
  { id: "xray", label: "X-Ray", icon: Eye },
  { id: "exploded", label: "Разнесённый", icon: Expand },
  { id: "mass", label: "Масса", icon: Weight },
  { id: "technical", label: "Схема", icon: ScanLine },
];
function Workbench({ twin = false }: { twin?: boolean }) {
  const {
    config: c,
    go,
    activeId,
    projects,
    compare,
    toggleCompare,
    message,
  } = useLab();
  const [mode, setMode] = useState<ViewMode>("normal"),
    [view, setView] = useState<CameraView>("iso"),
    [cameraReset, setCameraReset] = useState(0),
    [cinematic, setCinematic] = useState(false),
    [selection, setSelection] = useState(""),
    [saving, setSaving] = useState(false);
  const m = calculate(c),
    p = platformOf(c),
    part = m.parts.find((x) => x.key === selection);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCinematic(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => setSelection(""), [c.platform]);
  const selectedProject = projects.find((x) => x.id === activeId);
  return (
    <div className={"workbench " + (cinematic ? "cinematic" : "")}>
      <div className="workbench-heading">
        <div>
          <div className="breadcrumb">
            <button onClick={() => go("catalog")}>Каталог БПЛА</button>
            <ChevronRight size={12} />
            <span>{twin ? "Цифровой двойник" : "Конфигуратор"}</span>
          </div>
          <h1>
            {p.name}
            <Tag green>{p.type}</Tag>
          </h1>
          <p>
            {selectedProject?.name || "Новая конфигурация"} <span>·</span>{" "}
            Учебная инженерная модель
          </p>
        </div>
        <div className="workbench-actions">
          <button
            className="secondary"
            onClick={() => go(twin ? "config" : "twin")}
          >
            {twin ? <SlidersHorizontal size={16} /> : <Layers3 size={16} />}{" "}
            {twin ? "Комплектация" : "Исследовать"}
          </button>
          <button className="primary" onClick={() => setSaving(true)}>
            <Save size={16} /> Сохранить проект
          </button>
        </div>
      </div>
      <div className="workspace">
        <aside className="control-panel">
          {twin ? (
            <>
              <div className="panel-heading">
                <Layers3 size={16} /> СОСТАВ КОНФИГУРАЦИИ <span>01</span>
              </div>
              <div className="panel-body">
                <p className="muted-note">
                  Нажмите на компонент в списке или на 3D-модели, чтобы
                  исследовать его.
                </p>
                <div className="parts-list">
                  {m.parts
                    .filter((x) => x.component.mass > 0)
                    .map((x) => (
                      <button
                        key={x.key}
                        className={selection === x.key ? "selected" : ""}
                        onClick={() => setSelection(x.key)}
                      >
                        <span>
                          {x.component.name}
                          <small>{x.component.category}</small>
                        </span>
                        <b>{fmt(x.component.mass)} кг</b>
                      </button>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <ConfigControls />
          )}
        </aside>
        <section className="viewport">
          <div className="viewport-header">
            <span>
              <span className="status-dot" />{" "}
              {twin ? "ТЕХНИЧЕСКАЯ МОДЕЛЬ" : "ПРЕДПРОСМОТР КОНФИГУРАЦИИ"}
            </span>
            <div>
              <button
                className="icon-button"
                title="Сбросить ракурс"
                aria-label="Сбросить ракурс"
                onClick={() => {
                  setView("iso");
                  setCameraReset((n) => n + 1);
                  setMode("normal");
                  setSelection("");
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={
                  cinematic
                    ? "Выйти из полноэкранного вида"
                    : "Полноэкранный вид"
                }
                title="Кинематографический вид"
                onClick={() => setCinematic(!cinematic)}
              >
                {cinematic ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </div>
          <Scene
            config={c}
            mode={mode}
            view={view}
            resetKey={cameraReset}
            selected={selection}
            onSelect={(part: Part) => setSelection(part.key)}
          />
          <div className="mode-toolbar">
            {modes.map((v) => (
              <button
                className={mode === v.id ? "active" : ""}
                key={v.id}
                title={v.label}
                onClick={() => setMode(v.id)}
              >
                <v.icon size={16} />
                <span>{v.label}</span>
              </button>
            ))}
          </div>
          <div className="camera-toolbar">
            <span>РАКУРС</span>
            {(
              [
                { id: "iso", label: "3/4" },
                { id: "top", label: "Сверху" },
                { id: "front", label: "Спереди" },
                { id: "side", label: "Сбоку" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                className={view === v.id ? "active" : ""}
                onClick={() => {
                  setView(v.id);
                  setCameraReset((n) => n + 1);
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="viewport-footer">
            <span>
              <MousePointer2 size={14} /> Вращение · прокрутка для масштаба
            </span>
            <span>WebGL 2</span>
          </div>
          {mode === "mass" && (
            <div className="mass-legend">
              <span>
                <i style={{ background: "#C4FF6B" }} /> Аккумулятор
              </span>
              <span>
                <i style={{ background: "#74D6FF" }} /> Двигатели
              </span>
              <span>
                <i style={{ background: "#FFB454" }} /> Нагрузка
              </span>
              <span>
                <i style={{ background: "#fff" }} /> Центр масс
              </span>
            </div>
          )}
          {part && (
            <div className="inspector">
              <div className="inspector-title">
                <span>COMPONENT INSPECTOR</span>
                <button
                  className="icon-button"
                  aria-label="Закрыть инспектор"
                  onClick={() => setSelection("")}
                >
                  <X size={14} />
                </button>
              </div>
              <h3>{part.component.name}</h3>
              <p>{part.component.description}</p>
              <div>
                <span>
                  Масса <b>{fmt(part.component.mass)} кг</b>
                </span>
                <span>
                  Мощность <b>{part.component.power} Вт</b>
                </span>
                <span>
                  Размеры{" "}
                  <b>
                    {part.component.dimensions
                      .map((x) => fmt(x, 2))
                      .join(" × ")}{" "}
                    м
                  </b>
                </span>
                <span>
                  Положение{" "}
                  <b>{part.position.map((x) => fmt(x, 2)).join(" / ")} м</b>
                </span>
                {part.component.resolution && (
                  <span>
                    Разрешение <b>{part.component.resolution}</b>
                  </span>
                )}
                {part.component.voltage && (
                  <span>
                    Энергия{" "}
                    <b>
                      {fmt(
                        part.component.voltage * part.component.capacity!,
                        1,
                      )}{" "}
                      Вт·ч
                    </b>
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
        <aside className="stats-panel">
          <StatsPanel />
        </aside>
      </div>
      <div className="workbench-bottom">
        <span>
          <Info size={15} /> Изменения сразу обновляют геометрию и расчёты.
          Сохранение — вручную.
        </span>
        <button
          className="text-button"
          onClick={() => {
            if (activeId) {
              if (!compare.includes(activeId)) toggleCompare(activeId);
              go("compare");
            } else {
              message(
                "Сначала сохраните конфигурацию, чтобы сравнить именно вашу сборку",
              );
              setSaving(true);
            }
          }}
        >
          Сравнить эту сборку <ArrowUpRight size={16} />
        </button>
      </div>
      {saving && <SaveDialog onClose={() => setSaving(false)} />}
    </div>
  );
}
function Compare() {
  const { projects, compare, toggleCompare, go } = useLab();
  const [onlyDiff, setOnlyDiff] = useState(false),
    [metric, setMetric] = useState("mass");
  const options = [
    ...platforms.map((p) => ({
      id: "base:" + p.id,
      name: p.name + " · базовая",
      config: defaults(p.id),
    })),
    ...projects.map((p) => ({ id: p.id, name: p.name, config: p.config })),
  ];
  const selected = compare
    .map((id) => options.find((x) => x.id === id))
    .filter((x): x is (typeof options)[number] => !!x);
  const values = selected.map((x) => ({
    ...x,
    p: platformOf(x.config),
    m: calculate(x.config),
  }));
  const rows: {
    label: string;
    value: (x: (typeof values)[number]) => string;
  }[] = [
    { label: "Конструкция", value: (x) => x.p.type },
    { label: "Назначение", value: (x) => x.p.category },
    { label: "Двигатели", value: (x) => String(x.p.motors) },
    { label: "Общая масса, кг", value: (x) => fmt(x.m.mass) },
    { label: "Полезная нагрузка, кг", value: (x) => fmt(x.m.payload) },
    { label: "Предел нагрузки, кг", value: (x) => fmt(x.p.maxPayload) },
    {
      label: "Габариты, м",
      value: (x) => x.m.size.map((n) => fmt(n, 1)).join(" × "),
    },
    { label: "Аккумулятор", value: (x) => componentOf(x.config.battery).name },
    { label: "Энергия, Вт·ч", value: (x) => fmt(x.m.energy, 1) },
    { label: "Доступная энергия, Вт·ч", value: (x) => fmt(x.m.available, 1) },
    { label: "Вспомогательные системы, Вт", value: (x) => fmt(x.m.aux, 0) },
    { label: "Средняя мощность, Вт", value: (x) => fmt(x.m.power, 0) },
    { label: "Оценка времени, мин", value: (x) => fmt(x.m.minutes, 1) },
    { label: "Виды съёмки", value: (x) => surveyModes(x.config) },
    {
      label: "Оборудование",
      value: (x) =>
        [
          x.config.camera === "none"
            ? "Без камеры"
            : componentOf(x.config.camera).name,
          ...x.config.sensors.map((id) => componentOf(id).name),
          ...x.config.modules.map((id) => componentOf(id).name),
          ...(x.config.platform === "agro"
            ? [
                `Бак ${x.config.tank} л · ${x.config.fill}% · ${x.config.nozzles} форсунок`,
              ]
            : []),
          ...(x.config.platform === "cargo"
            ? [
                `${componentOf(x.config.cargoMount).name} · груз ${x.config.cargo} кг`,
              ]
            : []),
        ].join(", "),
    },
  ];
  const chartDefs: Record<string, { label: string; unit: string }> = {
    mass: { label: "Общая масса", unit: "кг" },
    power: { label: "Средняя мощность", unit: "Вт" },
    available: { label: "Доступная энергия", unit: "Вт·ч" },
    minutes: { label: "Оценка времени", unit: "мин" },
  };
  return (
    <div className="page-content">
      <PageTitle
        eyebrow="04 / НАЙДИТЕ РАЗЛИЧИЯ"
        title="Сравнение конфигураций"
        description="Один масштаб. Прозрачные допущения. Только вычисляемые характеристики."
      />
      <div className="compare-controls">
        <SelectField
          label="Добавить платформу или проект"
          value=""
          options={[
            {
              value: "",
              label: `Выберите конфигурацию · ${selected.length} из 4`,
            },
            ...options
              .filter((x) => !compare.includes(x.id))
              .map((x) => ({ value: x.id, label: x.name })),
          ]}
          onChange={(v) => {
            if (v) toggleCompare(v);
          }}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyDiff}
            onChange={(e) => setOnlyDiff(e.target.checked)}
          />
          <span>Показать только различия</span>
        </label>
        <button className="secondary" onClick={() => go("projects")}>
          <FolderOpen size={16} /> Мои проекты
        </button>
      </div>
      {values.length ? (
        <>
          <div className="comparison-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>
                    <span className="eyebrow">ТЕХНИЧЕСКИЙ ПРОФИЛЬ</span>
                    <p>{values.length} / 4 конфигурации</p>
                  </th>
                  {values.map((x) => (
                    <th key={x.id}>
                      <button
                        className="remove-compare icon-button"
                        aria-label={"Убрать " + x.name}
                        onClick={() => toggleCompare(x.id)}
                      >
                        <X size={15} />
                      </button>
                      <Scene config={x.config} thumbnail />
                      <h3>{x.name}</h3>
                      <span className="muted-note">{x.p.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter(
                    (row) =>
                      !onlyDiff || new Set(values.map(row.value)).size > 1,
                  )
                  .map((row) => (
                    <tr key={row.label}>
                      <th>{row.label}</th>
                      {values.map((x) => (
                        <td key={x.id}>{row.value(x)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {onlyDiff && values.length === 1 && (
            <p className="info-box">
              <Info size={16} /> Добавьте ещё одну конфигурацию, чтобы увидеть
              различия.
            </p>
          )}
          <div className="chart-panel">
            <div className="section-title">
              <div>
                <div className="eyebrow">ВИЗУАЛЬНЫЙ АНАЛИЗ</div>
                <h2>{chartDefs[metric].label}</h2>
              </div>
              <select
                aria-label="Показатель диаграммы"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {Object.entries(chartDefs).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.label}, {v.unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={values.map((x) => ({
                    name: x.name,
                    value: Number(x.m[metric as keyof typeof x.m]),
                  }))}
                  margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#26313A" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8C99A8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8C99A8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#19232E",
                      border: "1px solid #34414E",
                      borderRadius: 8,
                      color: "#F5F7FA",
                    }}
                    formatter={(v) => [
                      `${fmt(Number(v))} ${chartDefs[metric].unit}`,
                      chartDefs[metric].label,
                    ]}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={90}>
                    {values.map((x, i) => (
                      <Cell
                        key={x.id}
                        fill={["#C4FF6B", "#74D6FF", "#FFB454", "#C2B4F5"][i]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="info-box">
            <Info size={17} /> Учебные данные. Оценка времени зависит от
            сценария и массы, не заменяет испытания. Сохранённые проекты
            сравниваются по их последней сохранённой версии.
          </p>
        </>
      ) : (
        <div className="empty">
          <GitCompareArrows size={36} />
          <h2>Добавьте первую конфигурацию</h2>
          <p>Выберите платформу или сохранённый проект в списке выше.</p>
        </div>
      )}
    </div>
  );
}
function Projects() {
  const {
    projects,
    open,
    duplicate,
    remove,
    rename,
    go,
    importProject,
    toggleCompare,
    compare,
    message,
  } = useLab();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Project | null>(null),
    [name, setName] = useState(""),
    [deleting, setDeleting] = useState<Project | null>(null);
  return (
    <div className="page-content">
      <PageTitle
        eyebrow="05 / ВАША РАБОЧАЯ КОЛЛЕКЦИЯ"
        title="Мои проекты"
        description="Ваши идеи и инженерные решения. Сохранены в этом браузере."
        action={
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => input.current?.click()}
            >
              <Upload size={16} /> Импорт JSON
            </button>
            <button className="primary" onClick={() => go("catalog")}>
              <Plus size={17} /> Создать проект
            </button>
          </div>
        }
      />
      <input
        ref={input}
        className="file-input"
        type="file"
        accept=".json,application/json"
        aria-label="Импорт проекта JSON"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 100000)
              throw Error("Максимальный размер JSON — 100 КБ");
            importProject(JSON.parse(await file.text()));
          } catch (err) {
            message(
              "Не удалось импортировать: " +
                (err instanceof Error ? err.message : "проверьте JSON"),
            );
          }
          e.target.value = "";
        }}
      />
      {!projects.length ? (
        <div className="empty projects-empty">
          <div className="empty-icon">
            <FolderOpen size={38} />
          </div>
          <Tag>ПРОСТРАНСТВО ДЛЯ ИДЕЙ</Tag>
          <h2>Первая сборка — начало исследования.</h2>
          <p>
            Выберите платформу, настройте оборудование и сохраните свою
            конфигурацию. Она появится здесь.
          </p>
          <button className="primary" onClick={() => go("catalog")}>
            Выбрать платформу <ArrowUpRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="project-count">
            <span>{projects.length} сохранённых конфигураций</span>
            <span>
              <CheckCheck size={15} /> Локальное хранение
            </span>
          </div>
          <div className="project-grid">
            {projects.map((p) => {
              const m = calculate(p.config);
              return (
                <article className="project-card" key={p.id}>
                  <div className="card-top">
                    <Tag>{platformOf(p.config).name}</Tag>
                    <button
                      className={
                        "icon-button " +
                        (compare.includes(p.id) ? "selected" : "")
                      }
                      aria-label={"Сравнить " + p.name}
                      onClick={() => toggleCompare(p.id)}
                    >
                      {compare.includes(p.id) ? (
                        <Check size={18} />
                      ) : (
                        <GitCompareArrows size={18} />
                      )}
                    </button>
                  </div>
                  <button
                    className="model-button"
                    onClick={() => open(p.id)}
                    aria-label={"Открыть " + p.name}
                  >
                    <Scene config={p.config} thumbnail />
                  </button>
                  <div className="project-card-body">
                    <h2>{p.name}</h2>
                    <time>{new Date(p.updated).toLocaleString("ru-RU")}</time>
                    <div className="project-metrics">
                      <span>{fmt(m.mass)} кг</span>
                      <span>{fmt(m.available, 1)} Вт·ч</span>
                      <span>{fmt(m.minutes, 1)} мин*</span>
                    </div>
                    <div className="project-actions">
                      <button className="secondary" onClick={() => open(p.id)}>
                        Открыть <ArrowUpRight size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={"Переименовать " + p.name}
                        onClick={() => {
                          setEditing(p);
                          setName(p.name);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={"Дублировать " + p.name}
                        onClick={() => duplicate(p.id)}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={"Экспортировать " + p.name}
                        onClick={() => downloadProject(p)}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={"Удалить " + p.name}
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="muted-note">
            * Расчётная оценка по учебной модели. Экспортируйте важные проекты:
            очистка данных браузера удаляет локальные сохранения.
          </p>
          {compare.length > 0 && (
            <button
              className="compare-floating primary"
              onClick={() => go("compare")}
            >
              <GitCompareArrows size={16} /> Перейти к сравнению ·{" "}
              {compare.length}
            </button>
          )}
        </>
      )}
      {editing && (
        <Modal title="Переименовать проект" onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rename(editing.id, name);
              setEditing(null);
            }}
          >
            <label className="field">
              <span>Название</span>
              <input
                autoFocus
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="primary">
              Сохранить название <Check size={16} />
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Удалить проект?" onClose={() => setDeleting(null)}>
          <p>«{deleting.name}» будет удалён из этого браузера.</p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => {
                downloadProject(deleting);
              }}
            >
              Экспортировать копию <Download size={15} />
            </button>
            <button
              className="primary danger-button"
              onClick={() => {
                remove(deleting.id);
                setDeleting(null);
              }}
            >
              Удалить <Trash2 size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  const { page, go, projects, notice, message, storageError } = useLab();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => message(""), 5500);
    return () => clearTimeout(t);
  }, [notice, message]);
  return (
    <>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="АЭРОЛАБ — главная"
        >
          <span className="brand-icon">
            <Move3D size={24} strokeWidth={1.5} />
          </span>
          <span>
            АЭРОЛАБ<span className="brand-sub">ИНТЕРАКТИВНАЯ ЛАБОРАТОРИЯ</span>
          </span>
        </button>
        <nav aria-label="Основная навигация" className={menu ? "open" : ""}>
          {nav.map((item, i) => (
            <button
              className={page === item.page ? "active" : ""}
              key={item.page}
              onClick={() => {
                go(item.page);
                setMenu(false);
              }}
            >
              <small>0{i + 1}</small>
              {item.label}
              {item.page === "projects" && projects.length > 0 && (
                <span className="nav-count">{projects.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="header-status">
          <span className="status-dot" /> УЧЕБНАЯ ПЛАТФОРМА
        </div>
        <button
          className="menu-toggle icon-button"
          aria-label="Меню"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      {storageError && (
        <div className="storage-error" role="alert">
          <AlertTriangle size={17} />
          {storageError}
        </div>
      )}
      <main key={page}>
        {page === "home" ? (
          <Home />
        ) : page === "catalog" ? (
          <Catalog />
        ) : page === "config" ? (
          <Workbench />
        ) : page === "twin" ? (
          <Workbench twin />
        ) : page === "compare" ? (
          <Compare />
        ) : (
          <Projects />
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <Move3D size={21} /> АЭРОЛАБ{" "}
          <span>Исследование начинается с любопытства.</span>
        </div>
        <span>Учебный проект · Все модели демонстрационные</span>
        <button
          className="text-button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Наверх <MoveUpRight size={15} />
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => message("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
