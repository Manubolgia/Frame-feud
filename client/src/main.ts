import { Application } from 'pixi.js';
import { Game } from './app';
import { unlockAudio } from './audio/sfx';
import './style.css';

async function boot() {
  const app = new Application();
  await app.init({
    background: '#0a0a16',
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  const canvasHost = document.getElementById('canvas-host')!;
  canvasHost.appendChild(app.canvas);

  // Unlock WebAudio on first user gesture.
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  new Game(app);

  const loader = document.getElementById('loader');
  if (loader) loader.remove();
}

boot();
