import { FIELD_DEFS, PAD, PUMP, WORLD_SIZE, type Settings, type Tool } from '../core/config';
import { riverCenter, riverWidth } from '../world/Terrain';

type Mode = 'menu' | 'play' | 'pause';
type Callbacks = { action: (name: string, payload?: any) => void };

const icons: Record<string, string> = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10m-5-5v10"/><circle cx="12" cy="12" r="3"/>',
  water: '<path d="M12 2C9 7 5 10 5 14a7 7 0 0 0 14 0c0-4-4-7-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  seed: '<path d="M12 21V10M12 15C4 16 3 10 3 7c7-1 10 2 9 8Zm0-4c0-6 4-8 9-8 0 5-2 8-9 8Z"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  controls: '<path d="M7 7h10c3 0 5 9 3 11-2 2-4-2-6-2h-4c-2 0-4 4-6 2C2 16 4 7 7 7Z"/><path d="M7 10v5m-2-2h4m7-2h.01m2 3h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  battery: '<rect x="2" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M6 10v4m4-4v4m4-4v4"/>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h17a2 2 0 1 1-2 2M3 16h7a3 3 0 1 1-3 3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
  hangar: '<path d="m3 8 9-5 9 5v13H3V8Zm4 13V11h10v10M7 15h10m-10 3h10"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  mission: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6m-6 4h6m-6 4h3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  speed: '<path d="M4 18a9 9 0 1 1 16 0M12 5v2M5 11l2 1m12-1-2 1m-5 2 5-5"/><circle cx="12" cy="14" r="2"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
  leaf: '<path d="M20 3C8 2 2 7 5 15c3 8 16 4 15-12ZM4 21 15 10"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
const icon = (name: string, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money = (n: number) => Math.round(n || 0).toLocaleString('ru-RU');
const percent = (v: number) => Math.round(Math.max(0, Math.min(1, v || 0)) * 100);
const toolNames: Record<Tool, string> = {scan: 'Сканер', water: 'Полив', seed: 'Посев'};
const upgrades = [
  {key:'battery', name:'Аккумулятор', description:'Больше времени в воздухе', icon:'battery', base:420},
  {key:'engines', name:'Двигатели', description:'Скорость и отзывчивость', icon:'speed', base:480},
  {key:'tank', name:'Бак для воды', description:'Увеличенный запас воды', icon:'water', base:360},
  {key:'spray', name:'Распылитель', description:'Шире полоса обработки', icon:'seed', base:400},
  {key:'scanner', name:'Мультисканер', description:'Больше охват, точнее данные', icon:'scan', base:340},
  {key:'stability', name:'Стабилизатор', description:'Устойчивость к порывам ветра', icon:'wind', base:440},
];

export class UIManager {
  public panel: string | null = null;
  private mode: Mode = 'menu';
  private settings: Settings;
  private snapshot: any = {};
  private callbacks: Callbacks;
  private root: HTMLElement;
  private menu: HTMLElement;
  private hud: HTMLElement;
  private overlay: HTMLElement;
  private toastNode: HTMLElement;
  private miniCanvas: HTMLCanvasElement;
  private toastTimer = 0;
  private lastRender = 0;
  private panelRenderKey = '';
  private result: any = null;

  constructor(root: HTMLElement, callbacks: Callbacks, settings: Settings, hasSave: boolean) {
    this.root = root;
    this.callbacks = callbacks;
    this.settings = {...settings};
    root.classList.add('agro-ui');
    root.classList.toggle('hints-off',!settings.hints);
    root.innerHTML = `
      <div class="menu-screen" id="menu-screen">
        <div class="menu-shade"></div>
        <header class="menu-header">
          <a class="brand" href="#" data-action="brand" aria-label="Agro Nova — главная">${this.logo()}<span>AGRO NOVA<span class="brand-sub">УМНОЕ ЗЕМЛЕДЕЛИЕ</span></span></a>
          <div class="header-location"><span class="status-dot"></span> ДОЛИНА ЗАРЕЧЬЕ <span class="header-divider"></span><span class="mono">52°14′ N &nbsp; 39°36′ E</span></div>
          <button class="icon-button menu-sound" data-action="mute" aria-label="Включить или выключить звук">${icon('sound')}</button>
        </header>
        <main class="menu-main">
          <div class="chapter"><span class="chapter-line"></span> ГЛАВА 01 <span class="chapter-slash">/</span> НОВОЕ НАЧАЛО</div>
          <h1>AGRO<span class="nova-word">NOVA<span class="title-mark">®</span></span></h1>
          <h2>Возрождение долины</h2>
          <p class="menu-description">Тихая земля. Большие перемены.<br>Поднимитесь над полями и верните<br>жизнь этой долине.</p>
          <div class="menu-actions">
            <button class="button button-primary menu-play" aria-label="${hasSave ? 'Продолжить игру' : 'Новая игра — Начать полёт'}" data-action="${hasSave ? 'continue' : 'new'}"><span class="button-start-icon">${icon('arrow')}</span><span>${hasSave ? 'Продолжить полёт' : 'Начать полёт'}</span><span class="button-key">↵</span></button>
            ${hasSave ? '<button class="new-flight" data-action="new">Начать заново</button>' : ''}
            <div class="menu-secondary"><button data-panel="controls">${icon('controls')} Управление</button><span></span><button data-panel="settings">${icon('settings')} Настройки</button></div>
          </div>
        </main>
        <div class="landmark"><span class="landmark-point"><i></i></span><div class="landmark-content"><span class="eyebrow">ВАША НОВАЯ ПЕРСПЕКТИВА</span><strong>Всё начинается с заботы.</strong><span>Четыре поля. Одна живая экосистема.</span></div></div>
        <div class="menu-footer"><div class="footer-descriptor"><span class="tiny-cross">+</span><span>СИМУЛЯТОР НОВОГО ЗЕМЛЕДЕЛИЯ</span></div><div class="footer-data"><span><b>04</b> ПОЛЯ</span><span><b>03</b> ИНСТРУМЕНТА</span><span><b>01</b> ДОЛИНА</span></div><span class="version-label">ПОЛЁТ БЕЗ СПЕШКИ <span class="small-dot"></span> V.1.0</span></div>
      </div>
      <div class="game-hud" id="game-hud" hidden>
        <header class="hud-header"><button class="hud-brand" data-action="pause" title="Пауза — Esc">${this.logo()}<span>AGRO NOVA<small>ПОЛЕВАЯ СИСТЕМА / 01</small></span></button><div class="compass-strip"><span>З</span><i></i><span>СЗ</span><i></i><b class="compass-heading" data-bind="heading">000°</b><i></i><span>СВ</span><i></i><span>В</span><div class="compass-notch"></div></div><div class="hud-weather"><span data-bind="weather">Ясно</span>${icon('sun')}<b data-bind="time">07:30</b><button class="icon-button" data-action="pause" aria-label="Пауза">${icon('pause')}</button></div></header>
        <aside class="mission-widget"><div class="widget-eyebrow"><span class="status-dot"></span> ТЕКУЩИЙ КОНТРАКТ <button data-panel="mission" aria-label="Подробнее о контракте">${icon('chevron')}</button></div><h3 data-bind="missionTitle">Первый вылет</h3><p data-bind="missionObjective">Поднимитесь над долиной</p><div class="mission-progress"><span data-bind="missionBar"></span></div><div class="mission-footer"><span data-bind="missionNumber">01 / 05</span><span class="reward" data-bind="missionReward">+ 300 ₽</span></div></aside>
        <div class="hud-quick"><button data-action="hangar" title="Ангар — H">${icon('hangar')}<span>Ангар</span><kbd>H</kbd></button><button data-panel="map" title="Карта — M">${icon('map')}<span>Карта долины</span><kbd>M</kbd></button><button data-action="camera" title="Камера — C">${icon('camera')}<span>Камера</span><kbd>C</kbd></button></div>
        <div class="world-status"><span class="status-dot"></span><span data-bind="flightStatus">СИСТЕМЫ В НОРМЕ</span></div>
        <div class="interaction-prompt" hidden><kbd>F</kbd><span data-bind="prompt">Взаимодействовать</span></div>
        <div class="flight-warning" hidden>${icon('battery')}<span data-bind="warning"></span></div>
        <aside class="telemetry"><div class="telemetry-top"><span>AN–01</span><span class="telemetry-flight-mode" data-bind="flightMode">ARCADE</span><span class="telemetry-state" data-bind="airState">НА ЗЕМЛЕ</span></div><div class="telemetry-values"><div><span class="telemetry-label">ВЫСОТА</span><strong><span data-bind="altitude">0.0</span><small>м</small></strong><span class="telemetry-rule"></span></div><div><span class="telemetry-label">СКОРОСТЬ</span><strong><span data-bind="speed">0</span><small>км/ч</small></strong><span class="telemetry-rule"></span></div></div><div class="resource-row">${icon('battery')}<span>Заряд</span><b data-bind="battery">100%</b></div><div class="resource-track"><span data-bind="batteryBar"></span></div><div class="resource-row">${icon('water')}<span>Вода</span><b data-bind="water">100 / 100 л</b></div><div class="resource-track water-track"><span data-bind="waterBar"></span></div><div class="telemetry-bottom"><span>${icon('wind')} <span data-bind="wind">2.4 м/с</span></span><span data-bind="fps"></span></div></aside>
        <div class="minimap-block"><div class="minimap-heading"><span>ЗАРЕЧЬЕ</span><span class="minimap-north">С ↑</span></div><canvas width="200" height="160" class="minimap-canvas" aria-label="Мини-карта долины"></canvas><div class="minimap-coords" data-bind="coordinates">X 025 &nbsp; Z 065</div></div>
        <div class="tool-dock" role="toolbar" aria-label="Инструменты дрона">${(['scan','water','seed'] as Tool[]).map((tool,i)=>`<button class="tool-button ${i===0?'active':''}" data-tool="${tool}" title="${toolNames[tool]} — ${i+1}"><kbd>${i+1}</kbd>${icon(tool)}<span>${toolNames[tool]}</span><i></i></button>`).join('')}<span class="tool-divider"></span><div class="tool-use"><span class="mouse-symbol"></span><span>Удерживайте<br><b>ЛКМ</b></span></div></div>
        <div class="hud-bottom-note"><span class="hint-main">W A S D <span>движение</span> <span class="hint-sep">/</span> SPACE <span>вверх</span> <span class="hint-sep">/</span> SHIFT <span>вниз</span></span><span class="balance">БАЛАНС <b data-bind="currency">0 ₽</b></span></div>
      </div>
      <div class="panel-overlay" id="panel-overlay" hidden></div>
      <div class="toast-message" role="status" aria-live="polite"></div>
      <div class="loading-screen" hidden><div class="loading-brand">${this.logo()}<span>AGRO NOVA</span></div><div class="loading-spinner"></div><p>Пробуждаем долину</p><small>Подготовка к вашему первому полёту</small></div>`;
    this.menu = root.querySelector('#menu-screen')!;
    this.hud = root.querySelector('#game-hud')!;
    this.overlay = root.querySelector('#panel-overlay')!;
    this.toastNode = root.querySelector('.toast-message')!;
    this.miniCanvas = root.querySelector('.minimap-canvas')!;
    root.addEventListener('click', e => this.handleClick(e));
    root.addEventListener('input', e => this.handleInput(e));
    root.addEventListener('change', e => this.handleInput(e));
    this.drawMap(this.miniCanvas, false);
    document.addEventListener('keydown',event=>{
      if(event.code==='Enter' && this.mode==='menu' && !this.panel && !(event.target instanceof HTMLInputElement)){
        event.preventDefault(); this.callbacks.action(this.menu.querySelector<HTMLElement>('.menu-play')?.dataset.action||'new');
      }
    });
  }

  private logo() { return '<svg class="agro-logo" viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M22 4 40 36H4L22 4Z" stroke="currentColor" stroke-width="1.7"/><path d="m22 15 12 21H10l12-21Z" fill="currentColor"/><path d="M4 36 22 26l18 10" stroke="currentColor" stroke-width="1.5"/><path d="M22 4v11" stroke="currentColor" stroke-width="1.5"/></svg>'; }

  private handleClick(event: Event) {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button,[data-action]');
    if (!target) return;
    if (target.hasAttribute('disabled')) return;
    event.preventDefault();
    const panel = target.dataset.panel;
    if (panel) { this.callbacks.action(panel); this.openPanel(panel); return; }
    if (target.dataset.tool) { this.callbacks.action('tool', target.dataset.tool as Tool); return; }
    if (target.dataset.upgrade) { this.callbacks.action('upgrade', target.dataset.upgrade); return; }
    if (target.dataset.quality) { this.changeSetting('quality',target.dataset.quality); return; }
    if (target.dataset.setting) {
      const key = target.dataset.setting as keyof Settings;
      this.changeSetting(key, typeof this.settings[key] === 'boolean' ? !this.settings[key] : target.dataset.value);
      return;
    }
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'close') { this.closePanel(); this.callbacks.action('close'); return; }
    if (action === 'brand') return;
    if (action === 'mute') { this.changeSetting('volume', this.settings.volume > 0 ? 0 : 0.35); this.toast(this.settings.volume > 0 ? 'Звук включён' : 'Звук выключен'); return; }
    if (action === 'configure') { this.callbacks.action('configure',1); return; }
    if (action === 'resume') this.closePanel();
    if (action === 'nextMission') this.closePanel();
    this.callbacks.action(action);
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.dataset.range) return;
    this.changeSetting(target.dataset.range as keyof Settings, Number(target.value), false);
    const output = target.parentElement?.querySelector('output');
    if (output) output.textContent = target.dataset.range === 'volume' ? `${Math.round(Number(target.value)*100)}%` : `${Number(target.value).toFixed(1)}×`;
  }

  private changeSetting(key: keyof Settings, value: any, render = true) {
    if (this.settings[key] === value) return;
    (this.settings as any)[key] = value;
    this.callbacks.action('setting', {key,value});
    if (render && this.panel === 'settings') this.renderPanel();
  }

  public setMode(mode: Mode) {
    this.mode = mode;
    this.menu.hidden = mode !== 'menu';
    this.hud.hidden = mode === 'menu';
    this.root.dataset.mode = mode;
    if (mode === 'menu') this.closePanel();
    else if (mode === 'pause') this.openPanel('pause');
    else if (this.panel === 'pause') this.closePanel();
  }

  public updateSettings(settings: Settings) {
    const changed = JSON.stringify(settings) !== JSON.stringify(this.settings);
    this.settings = {...settings};
    this.root.classList.toggle('hints-off', !settings.hints);
    if (changed && this.panel === 'settings') this.renderPanel();
  }

  public update(snapshot: any) {
    this.snapshot = snapshot;
    const now = performance.now();
    if (now-this.lastRender < 80) return;
    this.lastRender = now;
    const f = snapshot.flight || {};
    const m = snapshot.mission || {};
    const weather = snapshot.weather || {};
    const battery = (snapshot.battery ?? 100) / 100;
    const capacity = snapshot.capacity || snapshot.stats?.tankCapacity || 100;
    const water = snapshot.water ?? capacity;
    const objectives = m.objectives || [];
    const objective = objectives.find((o:any)=>!o.complete) || objectives[objectives.length-1];
    const progress = m.progress || 0;
    const heading = ((f.heading || 0)%360+360)%360;
    const values: Record<string,string> = {
      heading: `${Math.round(heading).toString().padStart(3,'0')}°`,
      weather: weather.label || 'Ясно', time: snapshot.time || '07:30',
      missionTitle:m.title || 'Первый вылет', missionObjective:objective ? `${objective.label}${objective.target>1 ? ` · ${Math.min(objective.progress,objective.target).toFixed(0)} / ${objective.target}` : ` · ${percent(objective.progress/objective.target)}%`}` : m.description || 'Исследуйте долину',
      missionNumber:`${String((m.index || 0)+1).padStart(2,'0')} / ${String(m.total || 5).padStart(2,'0')}`, missionReward:`+ ${money(m.reward || 0)} ₽`,
      altitude:Number(f.altitude || 0).toFixed(1), speed:Math.round((f.speed || 0)*3.6).toString(),
      battery:`${percent(battery)}%`, water:`${Math.round(water)} / ${Math.round(capacity)} л`,
      wind:`${Number(weather.wind ?? 2.4).toFixed(1)} м/с`,fps:snapshot.fps ? `${Math.round(snapshot.fps)} FPS` : '',
      coordinates:`X ${Math.round(f.x || 0).toString().padStart(3,'0')}   Z ${Math.round(f.z || 0).toString().padStart(3,'0')}`,
      currency:`${money(snapshot.currency)} ₽`, flightMode:snapshot.settings?.mode||this.settings.mode, airState:f.grounded ? 'НА ЗЕМЛЕ' : 'В ПОЛЁТЕ',
      flightStatus:snapshot.techOnline ? 'АГРОСЕТЬ АКТИВНА' : snapshot.emergency ? 'АВАРИЙНАЯ ПОСАДКА' : 'СИСТЕМЫ В НОРМЕ',
      prompt:snapshot.prompt || '', warning:snapshot.warning || '',
    };
    for (const [name,value] of Object.entries(values)) {
      this.root.querySelectorAll<HTMLElement>(`[data-bind="${name}"]`).forEach(el => {if(el.textContent !== value) el.textContent = value;});
    }
    for (const [name,value] of [['batteryBar',battery],['waterBar',water/capacity],['missionBar',progress]] as [string,number][]) {
      const node = this.root.querySelector<HTMLElement>(`[data-bind="${name}"]`);
      if (node) node.style.width = `${percent(value)}%`;
    }
    this.root.querySelector('.telemetry')?.classList.toggle('low-battery',battery<0.2);
    this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach(n=>n.classList.toggle('active', n.dataset.tool===snapshot.tool));
    const prompt = this.root.querySelector<HTMLElement>('.interaction-prompt')!;
    prompt.hidden = !snapshot.prompt || this.mode !== 'play';
    const warning = this.root.querySelector<HTMLElement>('.flight-warning')!;
    warning.hidden = !snapshot.warning || this.mode !== 'play';
    this.drawMap(this.miniCanvas,false);
    if(this.panel==='map') { const canvas=this.overlay.querySelector<HTMLCanvasElement>('canvas'); if(canvas) this.drawMap(canvas,true); }
    if(this.panel==='hangar' || this.panel==='mission') {
      const key=JSON.stringify({currency:snapshot.currency,upgrades:snapshot.upgrades,configuration:snapshot.configuration,objectives:m.objectives,status:m.status});
      if(key!==this.panelRenderKey){this.panelRenderKey=key;this.renderPanel();}
    }
  }

  public openPanel(name: string) {
    this.panel = name;
    this.overlay.hidden = false;
    this.renderPanel();
  }

  public closePanel() {
    this.panel = null;
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
  }

  public toast(message: string) {
    window.clearTimeout(this.toastTimer);
    this.toastNode.innerHTML = `${icon('check')}<span>${esc(message)}</span>`;
    this.toastNode.classList.add('visible');
    this.toastTimer = window.setTimeout(()=>this.toastNode.classList.remove('visible'),3600);
  }

  public showResult(result: any) { this.result = result; this.openPanel('results'); }

  public setHasSave(hasSave: boolean) {
    const button=this.menu.querySelector<HTMLButtonElement>('.menu-play')!;
    button.dataset.action=hasSave?'continue':'new';
    button.setAttribute('aria-label',hasSave?'Продолжить игру':'Новая игра — Начать полёт');
    const text=button.querySelector('span:nth-child(2)');
    if(text)text.textContent=hasSave?'Продолжить полёт':'Начать полёт';
    const old=this.menu.querySelector('.new-flight');
    if(hasSave&&!old){const fresh=document.createElement('button');fresh.className='new-flight';fresh.dataset.action='new';fresh.textContent='Новая игра';button.after(fresh);}
    else if(!hasSave)old?.remove();
  }

  public setLoading(loading: boolean) { this.root.querySelector<HTMLElement>('.loading-screen')!.hidden = !loading; }

  public showError(message: string) {
    this.panel='error'; this.overlay.hidden=false;
    this.overlay.innerHTML=`<section class="game-panel error-panel"><span class="eyebrow">НЕ УДАЛОСЬ НАЧАТЬ ПОЛЁТ</span><h2>Долина пока недоступна</h2><p>${esc(message)}</p><p class="panel-copy">Попробуйте обновить страницу и убедитесь, что аппаратное ускорение браузера включено.</p><button class="button button-primary" onclick="location.reload()">Обновить страницу ${icon('arrow')}</button></section>`;
    this.setLoading(false);
  }

  private shell(title: string, subtitle: string, content: string, cls='') {
    return `<section class="game-panel ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="panel-header"><div><span class="eyebrow">AGRO NOVA / ПОЛЕВАЯ СИСТЕМА</span><h2>${title}</h2><p>${subtitle}</p></div><button class="close-button" data-action="close" aria-label="Закрыть">${icon('close')}<kbd>ESC</kbd></button></header>${content}</section>`;
  }

  private renderPanel() {
    const name=this.panel;
    if (!name) return;
    this.overlay.dataset.panel=name;
    if(name==='settings') this.overlay.innerHTML=this.settingsPanel();
    else if(name==='controls') this.overlay.innerHTML=this.controlsPanel();
    else if(name==='hangar') this.overlay.innerHTML=this.hangarPanel();
    else if(name==='mission') this.overlay.innerHTML=this.missionPanel();
    else if(name==='map') {
      this.overlay.innerHTML=this.mapPanel();
      this.drawMap(this.overlay.querySelector('canvas')!,true);
    }
    else if(name==='results') this.overlay.innerHTML=this.resultsPanel();
    else if(name==='pause') this.overlay.innerHTML=this.pausePanel();
  }

  private settingsPanel() {
    const s=this.settings;
    const toggle=(key:keyof Settings,label:string,description:string)=>`<div class="setting-row"><div><b>${label}</b><small>${description}</small></div><button class="switch ${s[key]?'on':''}" data-setting="${key}" role="switch" aria-checked="${!!s[key]}" aria-label="${label}"><span></span></button></div>`;
    return this.shell('Настройки','Создайте своё ощущение полёта.',`
      <div class="settings-body"><div class="setting-section-label">01 &nbsp; ИЗОБРАЖЕНИЕ</div><div class="setting-row quality-row"><div><b>Качество графики</b><small>Детали мира, тени и дальность прорисовки</small></div><div class="segmented quality-options">${['LOW','MEDIUM','HIGH','ULTRA'].map(q=>`<button data-quality="${q}" class="${s.quality===q?'selected':''}">${q}</button>`).join('')}</div></div>
      ${toggle('bloom','Мягкое свечение','Солнечный свет и тёплая атмосфера')}${toggle('ao','Объёмное затенение','Глубина и естественные тени')}
      <div class="setting-section-label">02 &nbsp; ПОЛЁТ И ЗВУК</div><div class="setting-row"><div><b>Режим управления</b><small>Аркадный полёт или реалистичная инерция</small></div><div class="segmented"><button data-setting="mode" data-value="ARCADE" class="${s.mode==='ARCADE'?'selected':''}">ARCADE</button><button data-setting="mode" data-value="SIMULATION" class="${s.mode==='SIMULATION'?'selected':''}">SIMULATION</button></div></div>
      <label class="setting-row range-row"><div><b>Громкость</b><small>Звуки мира и двигателей</small></div><div class="range-control"><input type="range" min="0" max="1" step="0.01" value="${s.volume}" data-range="volume" aria-label="Громкость"><output>${Math.round(s.volume*100)}%</output></div></label>
      <label class="setting-row range-row"><div><b>Чувствительность</b><small>Скорость поворота дрона</small></div><div class="range-control"><input type="range" min="0.3" max="2" step="0.1" value="${s.sensitivity}" data-range="sensitivity" aria-label="Чувствительность"><output>${s.sensitivity.toFixed(1)}×</output></div></label>
      ${toggle('hints','Подсказки','Клавиши управления во время полёта')}</div><footer class="panel-footer"><span>${icon('check')} Изменения сохраняются автоматически</span><button class="button button-dark" data-action="close">Готово ${icon('arrow')}</button></footer>`,'settings-panel');
  }

  private controlsPanel() {
    const controls=[['W / S','Вперёд / назад'],['A / D','Влево / вправо'],['SPACE / SHIFT','Подняться / снизиться'],['МЫШЬ','Поворот и наклон камеры'],['ПКМ','Точное прицеливание'],['ЛКМ','Использовать инструмент'],['1 / 2 / 3','Сканер / полив / посев'],['C','Сменить камеру'],['F','Пополнение и взаимодействие'],['H / M','Ангар / карта'],['TAB','Текущий контракт'],['T / P','Время суток / погода'],['ESC','Пауза / закрыть окно']];
    return this.shell('Искусство полёта','Всё, что нужно для первого вылета.',`<div class="controls-layout"><div class="keyboard-illustration"><div class="key-top"><kbd></kbd><kbd>W</kbd><kbd></kbd></div><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><p>Двигайтесь плавно.<br>Хороший урожай не любит спешки.</p><div class="controls-tip">${icon('leaf')} Начните со сканирования: оно покажет, какая помощь нужна полям.</div></div><div class="controls-list">${controls.map(([key,label])=>`<div><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</div></div><footer class="panel-footer"><span>Полёт начинается с любопытства.</span><button class="button button-dark" data-action="close">Всё понятно ${icon('arrow')}</button></footer>`,'controls-panel');
  }

  private hangarPanel() {
    const snap=this.snapshot;
    const balance=snap.currency||0;
    const levels=snap.upgrades||{};
    const configurationCost=snap.configurationCost||1250;
    const configurationAvailable=(snap.mission?.index||0)>=2;
    return this.shell('Ангар','Небольшие улучшения. Новые возможности.',`<div class="hangar-summary"><div><span class="drone-model">AGRO NOVA <b>AN–01</b></span><span class="model-description">УНИВЕРСАЛЬНЫЙ АГРОДРОН</span></div><div class="hangar-balance"><span>ДОСТУПНО</span><b>${money(balance)} <small>₽</small></b></div></div><div class="upgrade-grid">${upgrades.map(u=>{const level=levels[u.key]||0;const cost=snap.upgradeCosts?.[u.key] ?? Math.round(u.base*(1+level*.65));return `<article class="upgrade-card"><div class="upgrade-top">${icon(u.icon)}<span>МОДУЛЬ ${String(upgrades.indexOf(u)+1).padStart(2,'0')}</span><div class="upgrade-level">${[0,1,2].map(i=>`<i class="${level>i?'filled':''}"></i>`).join('')}</div></div><h3>${u.name}</h3><p>${u.description}</p><button class="upgrade-buy" data-upgrade="${u.key}" ${level>=3||balance<cost?'disabled':''}><span>${level>=3?'Максимальный уровень':`${money(cost)} ₽`}</span>${level>=3?icon('check'):icon('arrow')}</button></article>`;}).join('')}</div><div class="configuration-row"><div class="configuration-icon">${icon('leaf')}</div><div><b>Конфигурация «Агроном»</b><p>Дополнительный запас воды и ширина обработки</p></div><button class="button ${snap.configuration?'button-subtle':'button-dark'}" data-action="configure" ${snap.configuration||balance<configurationCost||!configurationAvailable?'disabled':''}>${snap.configuration ? `${icon('check')} Установлена` : !configurationAvailable ? 'После 2 контрактов' : money(configurationCost)+' ₽ '+icon('arrow')}</button></div><footer class="panel-footer"><span>Улучшения применяются сразу после покупки</span><button class="button button-dark" data-action="close">К полёту ${icon('arrow')}</button></footer>`,'hangar-panel');
  }

  private missionPanel() {
    const m=this.snapshot.mission||{};
    const done=m.status==='complete';
    const objectives=m.objectives||[];
    return this.shell('Ваш контракт',`КОНТРАКТ ${String((m.index||0)+1).padStart(2,'0')} / 05`,`<div class="mission-detail"><div class="mission-detail-heading"><span class="mission-number">${String((m.index||0)+1).padStart(2,'0')}</span><div><span class="eyebrow">${done?'УСПЕШНО ЗАВЕРШЁН':'ЗАДАЧА ДЛЯ ДОЛИНЫ'}</span><h3>${esc(m.title||'Первый вылет')}</h3><p>${esc(m.description||'Поднимитесь над долиной и осмотрите поля.')}</p></div></div><div class="mission-objectives">${objectives.map((o:any)=>`<div class="objective ${o.complete?'complete':''}"><span class="objective-check">${o.complete?icon('check'):''}</span><div><b>${esc(o.label)}</b><div class="objective-track"><i style="width:${percent(o.progress/o.target)}%"></i></div></div><strong>${percent(o.progress/o.target)}<small>%</small></strong></div>`).join('')}</div><div class="mission-reward"><span>ВОЗНАГРАЖДЕНИЕ</span><strong>${money(m.reward)} <small>₽</small></strong></div></div><footer class="panel-footer"><span>Забота о полях меняет долину.</span><button class="button button-dark" data-action="${done?'nextMission':'close'}">${done?'Следующий контракт':'Продолжить полёт'} ${icon('arrow')}</button></footer>`,'mission-panel');
  }

  private mapPanel() {
    const fields=this.snapshot.fields||[];
    return this.shell('Карта долины','Заречье / 52°14′ N, 39°36′ E',`<div class="map-layout"><div class="large-map"><canvas width="620" height="480" aria-label="Карта полей и объектов долины"></canvas><span class="map-scale">0 ───────── 100 м</span></div><aside class="map-sidebar"><span class="setting-section-label">ПОЛЯ ДОЛИНЫ</span>${FIELD_DEFS.map((f,i)=>{const field=fields.find((v:any)=>v.id===f.id);return `<article class="map-field"><span class="map-field-id">0${i+1}</span><div><b>${f.name}</b><small>${({wheat:'Пшеница',corn:'Кукуруза',sunflower:'Подсолнечник',bare:'Почва для посева'})[f.crop]}</small>${field?`<div class="map-field-stats"><span>${icon('water')}${percent(field.moisture)}%</span><span>${icon('leaf')}${percent(field.health)}%</span></div>`:''}</div></article>`;}).join('')}<div class="map-legend"><span><i class="legend-drone"></i> Ваш дрон</span><span><i class="legend-pad"></i> Посадочная площадка</span><span><i class="legend-water"></i> Водонапорная станция</span></div></aside></div>`,'map-panel');
  }

  private resultsPanel() {
    const r=this.result||this.snapshot.mission?.result||{};
    const finished=this.snapshot.campaignComplete;
    return this.shell(finished?'Долина ожила':'Отличная работа','КОНТРАКТ ВЫПОЛНЕН',`<div class="result-content"><div class="result-seal">${icon('leaf')}</div><span class="eyebrow">${finished?'НОВОЕ НАЧАЛО УЖЕ ЗДЕСЬ':'ЕЩЁ ОДИН ШАГ К ЖИВОЙ ДОЛИНЕ'}</span><h3>${esc(r.title||this.snapshot.mission?.title||'Успешный вылет')}</h3><p>${finished?'Поля снова полны жизни. Продолжайте свободный полёт, исследуйте долину и совершенствуйте свой дрон.':'Вы помогли земле стать немного сильнее. Долина готова к следующему шагу.'}</p><div class="result-stats"><div><span>ВОЗНАГРАЖДЕНИЕ</span><b>+ ${money(r.reward||0)} <small>₽</small></b></div><div><span>ВРЕМЯ ВЫЛЕТА</span><b>${Math.floor((r.seconds||0)/60).toString().padStart(2,'0')}:${Math.floor((r.seconds||0)%60).toString().padStart(2,'0')}</b></div></div>${r.penalty ? `<p class="result-penalty">Штрафы по контракту: −${money(r.penalty)} ₽</p>`:''}<button class="button button-dark result-next" data-action="${finished?'resume':'nextMission'}">${finished?'Свободный полёт':'Следующий контракт'} ${icon('arrow')}</button></div>`,'results-panel');
  }

  private pausePanel() {
    return `<section class="game-panel pause-panel" role="dialog" aria-modal="true" aria-label="Пауза"><div class="pause-logo">${this.logo()}<span>AGRO NOVA</span></div><span class="eyebrow">МОМЕНТ ТИШИНЫ</span><h2>Долина подождёт.</h2><p>Продолжите, когда будете готовы.</p><div class="pause-actions"><button class="button button-dark" data-action="resume">Продолжить полёт ${icon('arrow')}</button><button class="pause-option" data-panel="settings">${icon('settings')} Настройки ${icon('chevron')}</button><button class="pause-option" data-panel="controls">${icon('controls')} Управление ${icon('chevron')}</button><button class="pause-option" data-action="save">${icon('check')} Сохранить полёт ${icon('chevron')}</button><button class="pause-option" data-action="menu">${icon('compass')} Главное меню ${icon('chevron')}</button></div><span class="pause-footnote">ESC — вернуться к полёту</span></section>`;
  }

  private drawMap(canvas: HTMLCanvasElement, large: boolean) {
    const ctx=canvas.getContext('2d'); if(!ctx)return;
    const w=canvas.width,h=canvas.height;
    const span=large?490:360;
    const cx=large?20:0,cz=large?-5:0;
    const scale=Math.min(w,h)/span;
    const px=(x:number)=>w/2+(x-cx)*scale;
    const py=(z:number)=>h/2+(z-cz)*scale;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle=large?'#dfe4d6':'#29372d';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=large?'rgba(57,79,50,.09)':'rgba(210,225,188,.07)';ctx.lineWidth=1;
    for(let n=-WORLD_SIZE/2;n<=WORLD_SIZE/2;n+=50){ctx.beginPath();ctx.moveTo(px(n),0);ctx.lineTo(px(n),h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,py(n));ctx.lineTo(w,py(n));ctx.stroke();}
    // Use the terrain's river banks, including the narrow bend beside the pump.
    ctx.fillStyle=large?'#a7c1bd':'#47656a';ctx.beginPath();
    for(let z=-350;z<=350;z+=5){const x=riverCenter(z)-riverWidth(z);if(z===-350)ctx.moveTo(px(x),py(z));else ctx.lineTo(px(x),py(z));}
    for(let z=350;z>=-350;z-=5)ctx.lineTo(px(riverCenter(z)+riverWidth(z)),py(z));
    ctx.closePath();ctx.fill();
    ctx.fillStyle=large?'#dfe4d6':'#29372d';ctx.beginPath();ctx.arc(px(PUMP.x),py(PUMP.z),4.5*scale,0,Math.PI*2);ctx.fill();
    const roads:{points:[number,number][];width:number}[]=[
      {points:[[-280,44],[-170,43],[-88,41],[-18,43],[24,44],[43,57],[45,94],[90,128],[170,210],[260,275]],width:5.6},
      {points:[[-85,42],[-80,9],[-68,-30],[-64,-75],[-60,-127],[-89,-192],[-151,-276]],width:4.1},
      {points:[[8,44],[9,-4],[9,-61],[0,-100],[-8,-145],[18,-200]],width:3.8},
      {points:[[44,45],[52,17],[78,-13],[107,-9],[156,-11],[208,-13],[275,-39]],width:4.2},
      {points:[[24,44],[24,65]],width:4.2}
    ];
    ctx.strokeStyle=large?'#c4c4b0':'#68705a';ctx.lineJoin='round';ctx.lineCap='round';
    for(const road of roads){ctx.lineWidth=Math.max(.7,road.width*scale);ctx.beginPath();road.points.forEach(([x,z],i)=>{if(i===0)ctx.moveTo(px(x),py(z));else ctx.lineTo(px(x),py(z));});ctx.stroke();}
    FIELD_DEFS.forEach((f,i)=>{
      const colors=large?['#b7bc7c','#98aa79','#d1bd76','#b6a58b']:['#747c46','#566d42','#9b8747','#72634e'];
      ctx.fillStyle=colors[i];ctx.fillRect(px(f.x-f.w/2),py(f.z-f.d/2),f.w*scale,f.d*scale);
      ctx.strokeStyle=large?'rgba(64,81,48,.3)':'rgba(218,228,188,.25)';ctx.lineWidth=1;ctx.strokeRect(px(f.x-f.w/2),py(f.z-f.d/2),f.w*scale,f.d*scale);
      if(large){ctx.fillStyle='#33452c';ctx.font='600 12px Arial';ctx.textAlign='center';ctx.fillText(`0${i+1}`,px(f.x),py(f.z)+4);}
    });
    // Sparse woodland marks.
    ctx.fillStyle=large?'rgba(75,105,70,.25)':'rgba(80,112,73,.4)';
    for(let i=0;i<40;i++){const x=Math.sin(i*34.7)*210,z=Math.cos(i*16.9)*180;if(FIELD_DEFS.some(f=>Math.abs(x-f.x)<f.w/2+15&&Math.abs(z-f.z)<f.d/2+15))continue;ctx.beginPath();ctx.arc(px(x),py(z),large?5:2,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=large?'#536344':'#bed589';ctx.fillRect(px(PAD.x)-4,py(PAD.z)-4,8,8);
    ctx.fillStyle=large?'#567c86':'#8ebcc5';ctx.beginPath();ctx.arc(px(PUMP.x),py(PUMP.z),large?5:3,0,Math.PI*2);ctx.fill();
    const f=this.snapshot.flight||{x:PAD.x,z:PAD.z,heading:0};
    const x=px(f.x||0),y=py(f.z||0);
    ctx.save();ctx.translate(x,y);ctx.rotate((f.heading||0)*Math.PI/180);ctx.fillStyle=large?'#283929':'#e1edbc';ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=5;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
    if(large){ctx.fillStyle='#536344';ctx.font='10px Arial';ctx.textAlign='left';ctx.fillText('БАЗА',px(PAD.x)+9,py(PAD.z)+4);ctx.fillStyle='#567c86';ctx.fillText('ВОДА',px(PUMP.x)+9,py(PUMP.z)+4);}
  }
}
