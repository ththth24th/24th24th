"""Capture real HIGH frames, then validate storm/night/seed shaders on software LOW."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
root=Path(__file__).resolve().parents[1]
out=root/'artifacts'
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    errors=[]
    # One native animation callback boots the app; subsequent real frames are explicit.
    page=b.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.add_init_script('const raf=window.requestAnimationFrame.bind(window);let booted=false;window.requestAnimationFrame=fn=>{if(booted)return 0;booted=true;return raf(fn)}')
    page.goto(os.environ.get('AGRO_TEST_URL','http://127.0.0.1:5173/'),wait_until='domcontentloaded',timeout=60000)
    page.wait_for_function('!!window.__AGRO_DEBUG__',polling=200,timeout=120000)
    page.evaluate('window.__AGRO_DEBUG__.game.frame(performance.now())')
    page.screenshot(path=str(out/'menu-high.png'),timeout=120000)
    print('PASS HIGH menu actual frame',flush=True)
    page.evaluate("""()=>{const d=window.__AGRO_DEBUG__;d.game.action('new');d.drone.reset({x:-35,y:9,z:10});d.input.pitch=.42;d.game.action('tool','water');d.input.mouseDown=true;const t=performance.now();d.game.frame(t+100);d.game.frame(t+180);d.game.frame(t+260)}""")
    page.screenshot(path=str(out/'flight-high.png'),timeout=120000)
    print('PASS HIGH flight/spray actual frames',flush=True)
    page.evaluate("""()=>{const d=window.__AGRO_DEBUG__;d.game.action('setting',{key:'quality',value:'LOW'});d.atmosphere.day.hour=22;d.atmosphere.weather.set('storm');d.atmosphere.weather.rain=.95;d.game.action('tool','seed');d.game.frame(performance.now()+350)}""")
    page.screenshot(path=str(out/'storm-night.png'),timeout=120000)
    state=page.evaluate('({daylight:window.__AGRO_DEBUG__.atmosphere.day.daylight,rain:window.__AGRO_DEBUG__.atmosphere.weather.rain,wind:window.__AGRO_DEBUG__.atmosphere.weather.wind.length(),field:window.__AGRO_DEBUG__.sim.snapshot().fields[0],aoLocalFar:window.__AGRO_DEBUG__.render.ao.ssaoMaterial.uniforms.cameraFar.value,beautyFar:window.__AGRO_DEBUG__.render.camera.far})')
    assert state['daylight']==0 and state['rain']>.9 and state['aoLocalFar']==110 and state['beautyFar']==1800,state
    assert not errors,errors
    (out/'render-results.json').write_text(json.dumps({'errors':errors,'observed':state,'frames':['menu-high.png','flight-high.png','storm-night.png'],'gpu':'SwiftShader; no hardware performance claim'},ensure_ascii=False,indent=2))
    print('PASS storm/night/seed shader rendering, local AO range and restored projection, no WebGL errors',flush=True)
    b.close()
