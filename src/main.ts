import './ui/style.css';
import { Game } from './core/Game';

const root=document.querySelector<HTMLElement>('#app')!;
root.innerHTML='<div class="boot-screen"><span class="boot-mark">N</span><p>AGRO NOVA</p><small>Подготавливаем долину…</small><i></i></div>';
requestAnimationFrame(()=>setTimeout(()=>{
 try{new Game(document.querySelector<HTMLCanvasElement>('#scene')!,root);}
 catch(error){
  console.error(error);
  root.innerHTML='<div class="fatal-screen"><b>AGRO NOVA</b><h1>Не удалось открыть долину</h1><p>Для игры нужен браузер с WebGL 2 и включённым аппаратным ускорением. Обновите страницу или попробуйте актуальную версию Chrome, Edge или Firefox.</p><button onclick="location.reload()">Попробовать снова</button></div>';
 }
},30));
