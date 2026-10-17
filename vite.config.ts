import { defineConfig } from 'vite';

export default defineConfig({
 base: './',
 server: { host:'0.0.0.0', port:5173 },
 preview: { host:'0.0.0.0', port:4173 },
 build: {
  target:'es2022',
  rollupOptions: {output: {manualChunks: {
   'three-core':['three'],
   'three-effects':[
    'three/addons/postprocessing/EffectComposer.js',
    'three/addons/postprocessing/SSAOPass.js',
    'three/addons/postprocessing/UnrealBloomPass.js',
    'three/addons/environments/RoomEnvironment.js'
   ]
  }}}
 }
});
