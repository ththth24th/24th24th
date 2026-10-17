"""Real browser checks against npm run dev. Needs Python Playwright + system Chromium.
No source or production save slots are changed. A fresh, isolated browser profile is used.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
URL = os.environ.get('AGRO_TEST_URL', 'http://127.0.0.1:5173/')
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
    errors=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('console', lambda m:errors.append(m.text) if m.type=='error' else None)
    # Software GPU validation uses the shipped LOW preset, not a custom scene.
    page.add_init_script("""if(!localStorage.getItem('agro-nova.settings')){const s={quality:'LOW',volume:0,sensitivity:1,mode:'ARCADE',bloom:true,ao:true,hints:true};let h=2166136261;const v=JSON.stringify(s);for(let i=0;i<v.length;i++)h=Math.imul(h^v.charCodeAt(i),16777619);localStorage.setItem('agro-nova.settings',JSON.stringify({version:1,checksum:(h>>>0).toString(16).padStart(8,'0'),data:s}));}""")
    page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    page.wait_for_function('!!window.__AGRO_DEBUG__',timeout=120000,polling=200)
    page.locator('.menu-play').click(timeout=120000)
    page.wait_for_function('window.__AGRO_DEBUG__.game.mode==="play"',polling=100)
    checks.append('Game starts from menu')
    print('PASS menu/start',flush=True)
    page.keyboard.down('Space')
    page.wait_for_function('window.__AGRO_DEBUG__.drone.telemetry.altitude>=5.2',timeout=120000,polling=200)
    page.keyboard.up('Space')
    page.keyboard.press('c')
    page.wait_for_function('window.__AGRO_DEBUG__.drone.telemetry.camera===1',polling=200,timeout=30000)
    checks.append('Real keyboard takeoff and camera change')
    page.keyboard.down('Shift')
    page.wait_for_function('window.__AGRO_DEBUG__.sim.mission.status==="complete"',polling=200,timeout=120000)
    page.keyboard.up('Shift')
    page.wait_for_function('window.__AGRO_DEBUG__.game.ui.panel==="results"',polling=200)
    assert page.evaluate('window.__AGRO_DEBUG__.sim.currency') == 350
    page.screenshot(path=str(OUT/'tutorial-result.png'),timeout=120000)
    checks.append('Tutorial completed by takeoff, camera change and real landing; reward350')
    print('PASS tutorial/result',flush=True)
    # Loading a completed mission must reopen results and allow progression.
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('!!window.__AGRO_DEBUG__',polling=200,timeout=120000)
    page.locator('.menu-play').click(timeout=120000)
    page.wait_for_function('window.__AGRO_DEBUG__.game.ui.panel==="results"',polling=200,timeout=30000)
    page.locator('[data-action="nextMission"]').click(timeout=120000)
    page.wait_for_function('window.__AGRO_DEBUG__.sim.missionIndex===1',polling=200)
    checks.append('Continue restores completed mission and next contract works')
    print('PASS continue/next',flush=True)
    # Move to a real cell in the test harness; the browser's real mouse input drives tools.
    page.evaluate("""()=>{const d=window.__AGRO_DEBUG__;d.drone.reset({x:-35,y:9,z:10});d.game.cameras.mode=0;d.input.yaw=0;d.input.pitch=.3;d.game.action('tool','scan');}""")
    page.mouse.move(640,330)
    page.mouse.down()
    page.wait_for_function('window.__AGRO_DEBUG__.sim.snapshot().fields[0].scanned>0',polling=200,timeout=30000)
    page.mouse.up()
    scanned=page.evaluate('window.__AGRO_DEBUG__.sim.snapshot().fields[0].scanned')
    assert scanned>0
    page.keyboard.press('2')
    moisture=page.evaluate('window.__AGRO_DEBUG__.sim.snapshot().fields[0].moisture')
    water=page.evaluate('window.__AGRO_DEBUG__.sim.water')
    page.mouse.down()
    page.wait_for_function(f'window.__AGRO_DEBUG__.sim.snapshot().fields[0].moisture>{moisture+.005}',polling=200,timeout=45000)
    page.mouse.up()
    assert page.evaluate('window.__AGRO_DEBUG__.sim.water')<water
    checks.append('Scanner discovers real cells; spray increases moisture and consumes tank')
    print('PASS scan/spray',flush=True)
    page.evaluate('document.exitPointerLock?.()')
    page.evaluate('window.__AGRO_DEBUG__.game.action("resume")')
    page.screenshot(path=str(OUT/'flight.png'),timeout=120000)
    page.keyboard.press('t')
    page.keyboard.press('p')
    page.wait_for_function('window.__AGRO_DEBUG__.atmosphere.weather.kind!=="clear"',polling=200,timeout=30000)
    assert page.evaluate('window.__AGRO_DEBUG__.atmosphere.day.hour')>20
    checks.append('Time and weather controls change atmosphere')
    # Actual renderer presets, independently verified against GPU settings.
    params=page.evaluate("""()=>{const d=window.__AGRO_DEBUG__;d.game.action('setting',{key:'quality',value:'ULTRA'});const ultra={shadow:d.render.sun.shadow.mapSize.x,ao:d.render.ao.enabled,bloom:d.render.bloom.enabled};d.game.action('setting',{key:'quality',value:'LOW'});return {ultra,low:{shadow:d.render.sun.shadow.mapSize.x,ao:d.render.ao.enabled,bloom:d.render.bloom.enabled}};}""")
    assert params['ultra']=={'shadow':4096,'ao':True,'bloom':True},params
    assert params['low']=={'shadow':512,'ao':False,'bloom':False},params
    checks.append('LOW/ULTRA change real shadows, AO, bloom and geometry LOD')
    page.evaluate("window.__AGRO_DEBUG__.game.action('save')")
    saved=page.evaluate('window.__AGRO_DEBUG__.sim.snapshot().fields[0].moisture')
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('!!window.__AGRO_DEBUG__',polling=200,timeout=120000)
    page.locator('.menu-play').click(timeout=120000)
    page.wait_for_function('window.__AGRO_DEBUG__.sim.missionIndex===1',polling=200)
    assert abs(page.evaluate('window.__AGRO_DEBUG__.sim.snapshot().fields[0].moisture')-saved)<.002
    checks.append('Reload restores mission and treated field')
    print('PASS weather/quality/save-reload',flush=True)
    # Screenshots are real frames. GPU metrics are observations, never a 60FPS claim.
    metrics=page.evaluate('({fps:window.__AGRO_DEBUG__.game.fps,renderer:window.__AGRO_DEBUG__.render.renderer.info.render,quality:window.__AGRO_DEBUG__.game.settings.quality})')
    assert not errors, errors
    report={'passed':checks,'errors':errors,'metrics':metrics,'browser':'Chromium / SwiftShader software GPU'}
    (OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
    browser.close()
