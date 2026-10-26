"""AEROLAB end-to-end checks. Run npm run dev, then python3 scripts/browser-smoke.py.
Requires Python Playwright and Chromium. Uses isolated browser storage, no external APIs.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'aerolab'
OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('AEROLAB_TEST_URL','http://127.0.0.1:5173/')
checks=[]
def passed(text):
 checks.append(text)
 print('PASS '+text,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.set_default_timeout(60000)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def nav(label):page.get_by_role('navigation').get_by_role('button',name=label).click()
 def stat(label):return page.locator('.metric').filter(has=page.locator('span',has_text=label)).locator('strong').first.inner_text()
 page.goto(URL,wait_until='networkidle')
 page.get_by_role('heading',name='АЭРОЛАБ',exact=True).wait_for()
 page.locator('.hero-visual .scene[data-ready=true]').wait_for()
 page.locator('main').evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))')
 page.screenshot(path=str(OUT/'home-desktop.png'),timeout=120000)
 passed('Home and interactive WebGL canvas load')
 nav('Каталог БПЛА')
 assert page.locator('.catalog-card').count()==8
 page.get_by_label('Поиск БПЛА').fill('AGRO')
 assert page.locator('.catalog-card').count()==1
 page.get_by_role('button',name='Сбросить',exact=True).click()
 page.get_by_label('Тип конструкции').select_option('Самолёт')
 assert page.locator('.catalog-card').count()==1
 assert 'WING SURVEY' in page.locator('.catalog-card').inner_text()
 page.get_by_role('button',name='Сбросить',exact=True).click()
 passed('Eight platforms, search and construction filters')
 page.get_by_role('button',name='Открыть AGRO A6',exact=True).click()
 page.get_by_role('button',name='Настроить конфигурацию').click()
 page.get_by_role('heading',name='AGRO A6').wait_for()
 canvas=page.locator('.viewport canvas')
 canvas.wait_for()
 original=stat('Общая масса')
 image1=canvas.screenshot(timeout=120000)
 page.get_by_label('Объём бака').select_option('15')
 assert stat('Общая масса')!=original
 image2=canvas.screenshot(timeout=120000)
 assert hashlib.sha256(image1).digest()!=hashlib.sha256(image2).digest()
 assert '15' in page.locator('.special-stats').inner_text()
 page.get_by_label('Заполнение бака').fill('50')
 assert stat('Общая масса')!=original
 passed('Agro tank changes rendered pixels, water mass and full-tank calculation')
 page.get_by_role('button',name='Сохранить проект',exact=True).click()
 page.get_by_label('Название проекта').fill('Агро · 15 литров')
 page.get_by_role('button',name='Сохранить',exact=True).click()
 nav('Мои проекты')
 assert page.locator('.project-card').count()==1
 page.reload(wait_until='networkidle')
 nav('Мои проекты')
 page.get_by_role('heading',name='Агро · 15 литров').wait_for()
 passed('Saved configuration survives reload')
 page.get_by_role('button',name='Открыть Агро · 15 литров',exact=True).click()
 assert page.get_by_label('Объём бака').input_value()=='15'
 assert page.get_by_label('Заполнение бака').input_value()=='50'
 page.get_by_label('Базовая платформа').select_option('cargo')
 original=stat('Общая масса')
 page.get_by_label('Масса груза',exact=True).fill('10')
 assert stat('Общая масса')!=original
 assert '10,00' in page.locator('.special-stats').inner_text()
 energy=stat('Доступная энергия')
 page.get_by_label('Аккумулятор',exact=True).select_option('bat-medium')
 assert stat('Доступная энергия')!=energy
 page.get_by_role('button',name='Сохранить проект',exact=True).click()
 page.get_by_label('Название проекта').fill('Груз · 10 кг')
 page.get_by_role('button',name='Сохранить',exact=True).click()
 passed('Cargo platform, payload, battery energy and endurance update')
 page.get_by_role('button',name='Исследовать',exact=True).click()
 page.locator('.parts-list button').filter(has_text='Учебный груз').click()
 assert '10,00 кг' in page.locator('.inspector').inner_text()
 for mode in ['X-Ray','Разнесённый','Масса','Схема','3D-вид']:
  page.locator('.mode-toolbar').get_by_role('button',name=mode,exact=True).click()
  assert 'active' in page.locator('.mode-toolbar').get_by_role('button',name=mode,exact=True).get_attribute('class')
 page.get_by_role('button',name='Закрыть инспектор').click()
 for label in ['Сверху','Сбоку','Спереди','3/4']:
  page.locator('.camera-toolbar').get_by_role('button',name=label,exact=True).click()
 page.get_by_role('button',name='Полноэкранный вид',exact=True).click()
 assert page.locator('.workbench.cinematic').count()==1
 page.keyboard.press('Escape')
 assert page.locator('.workbench.cinematic').count()==0
 # Real orbit and zoom events on the WebGL viewport.
 box=canvas.bounding_box()
 page.mouse.move(box['x']+box['width']*.4,box['y']+box['height']*.5)
 page.mouse.down();page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.55,steps=12);page.mouse.up();page.mouse.wheel(0,200)
 passed('Component inspector, all model modes, camera presets, cinematic view, orbit and zoom')
 nav('Мои проекты')
 page.get_by_role('button',name='Сравнить Агро · 15 литров',exact=True).click()
 page.get_by_role('button',name='Сравнить Груз · 10 кг',exact=True).click()
 nav('Сравнение')
 assert page.locator('.comparison-table thead th').count()==3
 massrow=page.locator('.comparison-table tbody tr').filter(has=page.get_by_role('rowheader',name='Общая масса, кг',exact=True))
 assert massrow.locator('td').nth(0).inner_text()!=massrow.locator('td').nth(1).inner_text()
 all_rows=page.locator('.comparison-table tbody tr').count()
 page.get_by_label('Показать только различия').check()
 assert page.locator('.comparison-table tbody tr').count()<all_rows
 page.get_by_label('Показатель диаграммы').select_option('available')
 page.screenshot(path=str(OUT/'compare-desktop.png'),timeout=120000)
 passed('Saved agro and cargo comparison, differences filter and interactive chart')
 nav('Мои проекты')
 page.get_by_role('button',name='Переименовать Груз · 10 кг',exact=True).click()
 page.get_by_label('Название',exact=True).fill('Грузовой проект')
 page.get_by_role('button',name='Сохранить название',exact=True).click()
 page.get_by_role('heading',name='Грузовой проект',exact=True).wait_for()
 page.get_by_role('button',name='Дублировать Грузовой проект',exact=True).click()
 assert page.locator('.project-card').count()==3
 with page.expect_download() as download:
  page.get_by_role('button',name='Экспортировать Грузовой проект',exact=True).click()
 download.value.save_as(str(OUT/'project.json'))
 exported=json.loads((OUT/'project.json').read_text())
 assert exported['config']['cargo']==10
 page.get_by_label('Импорт проекта JSON').set_input_files(str(OUT/'project.json'))
 assert page.locator('.project-card').count()==4
 page.get_by_label('Импорт проекта JSON').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"config":{"platform":"fake"}}'})
 page.get_by_role('status').filter(has_text='Не удалось импортировать').wait_for()
 assert page.locator('.project-card').count()==4
 page.get_by_role('button',name='Удалить Грузовой проект · копия',exact=True).click()
 page.get_by_role('button',name='Удалить',exact=True).click()
 assert page.locator('.project-card').count()==3
 nav('Сравнение')
 assert 'Грузовой проект' in page.locator('.comparison-table').inner_text()
 passed('Rename, duplicate, export, valid import, invalid import rejection, delete and live comparison names')
 # Mobile adaptation, independent view, menu, functional configurator, overflow.
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Меню',exact=True).click();nav('Главная')
 page.locator('.hero-visual .scene[data-ready=true]').wait_for()
 page.locator('main').evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))')
 if page.get_by_role('status').count():page.get_by_role('button',name='Закрыть уведомление').click()
 page.screenshot(path=str(OUT/'home-mobile.png'),timeout=120000)
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 page.get_by_role('button',name='Изучить БПЛА',exact=True).click()
 assert page.locator('.catalog-card').count()==8
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 page.get_by_role('button',name='Открыть AGRO A6',exact=True).click()
 page.get_by_role('button',name='Настроить конфигурацию').click()
 page.get_by_label('Объём бака').select_option('15')
 page.get_by_role('heading',name='AGRO A6').scroll_into_view_if_needed()
 page.locator('.viewport .scene[data-ready=true]').wait_for()
 page.screenshot(path=str(OUT/'config-mobile.png'),timeout=120000)
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 passed('390px mobile menu, catalog, model and functional configuration without horizontal overflow')
 assert not errors,errors
 (OUT/'browser-results.json').write_text(json.dumps({'passed':checks,'errors':errors,'browser':'Chromium + SwiftShader','url':URL},ensure_ascii=False,indent=2))
 print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False),flush=True)
 browser.close()
