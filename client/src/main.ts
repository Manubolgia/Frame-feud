import '@fontsource/anton/400.css';
import '@fontsource/barlow-semi-condensed/400.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import './style.css';
import { Application } from 'pixi.js';
import { App } from './game/app';
import { inLibrary } from './library';

async function boot() {
  if (inLibrary) document.documentElement.classList.add('in-library');
  // Fonts must be ready before Pixi rasterises any text.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px Anton'), document.fonts.load('600 16px "Barlow Semi Condensed"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const pixi = new Application();
  await pixi.init({
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    background: '#07070c',
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
  });
  document.getElementById('stage')!.appendChild(pixi.canvas);
  const app = new App(pixi);
  if (import.meta.env.DEV) (window as unknown as { __ff: App }).__ff = app;
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 500);
  }
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loader');
  if (l) l.innerHTML = '<div class="boot-error">Frame Feud could not start on this device (WebGL is required).</div>';
});
