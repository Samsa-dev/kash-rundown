/**
 * Scene Lab — Isolated PixiJS scene viewer with live controls.
 * No game logic, no UI overlays — just the RoadScene canvas + tweakable state.
 */

import { Application } from 'pixi.js';
import { RoadScene } from './scenes/RoadScene';
import { createInitialState, type GameState, type GamePhase, type ChasePhase } from './game/types';
import { W, H } from './scenes/constants';

const roadScene = new RoadScene();
const state: GameState = {
  ...createInitialState(),
  phase: 'RUNNING',
  startTime: Date.now(),
};

// ── DOM helpers ──
const $ = (id: string) => document.getElementById(id)!;

async function init() {
  const app = new Application();
  await app.init({
    width: W,
    height: H,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  $('pixi-container').appendChild(app.canvas);
  app.stage.addChild(roadScene.container);

  // Render loop
  app.ticker.add(() => {
    roadScene.update(state);
    updateStateDisplay();
  });

  wireControls();
}

// ── Controls wiring ──
function wireControls() {
  // Chase phase buttons
  document.querySelectorAll('#phase-btns button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#phase-btns button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chasePhase = parseInt(btn.getAttribute('data-phase')!) as ChasePhase;

      // Auto-set related flags
      if (state.chasePhase >= 3) {
        state.helicopterActive = true;
        state.heliStartTime = Date.now();
        ($('toggle-heli') as HTMLInputElement).checked = true;
      }
      if (state.chasePhase >= 5) {
        state.ghostMode = true;
        ($('toggle-ghost') as HTMLInputElement).checked = true;
      }
    });
  });

  // Game phase buttons
  document.querySelectorAll('#game-phase-btns button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#game-phase-btns button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.phase = btn.getAttribute('data-gphase') as GamePhase;
      if (state.phase === 'RUNNING' && !state.startTime) {
        state.startTime = Date.now();
      }
    });
  });

  // Multiplier slider
  const multSlider = $('mult-slider') as HTMLInputElement;
  multSlider.addEventListener('input', () => {
    state.multiplier = parseFloat(multSlider.value);
    $('mult-val').textContent = state.multiplier.toFixed(2) + '×';
  });

  // Grid toggle
  ($('toggle-grid') as HTMLInputElement).addEventListener('change', (e) => {
    $('grid-overlay').classList.toggle('grid-visible', (e.target as HTMLInputElement).checked);
  });

  // UI zones toggle
  ($('toggle-zones') as HTMLInputElement).addEventListener('change', (e) => {
    $('ui-zones').classList.toggle('zones-visible', (e.target as HTMLInputElement).checked);
  });

  // Toggles
  ($('toggle-heli') as HTMLInputElement).addEventListener('change', (e) => {
    state.helicopterActive = (e.target as HTMLInputElement).checked;
    if (state.helicopterActive) state.heliStartTime = Date.now();
  });
  ($('toggle-ghost') as HTMLInputElement).addEventListener('change', (e) => {
    state.ghostMode = (e.target as HTMLInputElement).checked;
  });
  ($('toggle-roadblock') as HTMLInputElement).addEventListener('change', (e) => {
    state.roadblockActive = (e.target as HTMLInputElement).checked;
    if (state.roadblockActive) state.roadblockStart = Date.now();
  });

  // Spawn helpers
  const laneCenters = [-0.667, 0, 0.667];
  const randomLane = () => laneCenters[Math.floor(Math.random() * 3)];
  const spawnObs = (type: string, color = '#EF4444') => {
    roadScene.obstacles.push({
      type: type as any,
      rx: randomLane(),
      rz: 0.02,
      speed: 0,
      color,
      dodged: false,
    });
  };

  $('spawn-car').addEventListener('click', () => spawnObs('car', '#EF4444'));
  $('spawn-barricade').addEventListener('click', () => spawnObs('barricade'));
  $('spawn-spikes').addEventListener('click', () => spawnObs('spikes'));
  $('spawn-dumpster').addEventListener('click', () => spawnObs('dumpster'));
  $('spawn-cones').addEventListener('click', () => spawnObs('cones'));
  $('spawn-flipped').addEventListener('click', () => spawnObs('flipped_car'));
  $('spawn-electric').addEventListener('click', () => spawnObs('electric_puddle'));

  $('spawn-nitro').addEventListener('click', () => {
    roadScene.nitros.push({
      rx: randomLane(),
      rz: 0.02,
      collected: false,
      glow: 0,
    });
  });

  // Crash particles
  $('spawn-crash').addEventListener('click', () => {
    roadScene.spawnCrashParticles();
  });

  // Clear all
  $('clear-objects').addEventListener('click', () => {
    roadScene.clearGameObjects();
  });
}

// ── State display ──
function updateStateDisplay() {
  $('state-display').textContent =
    `phase: ${state.phase}\n` +
    `chasePhase: ${state.chasePhase}\n` +
    `multiplier: ${state.multiplier.toFixed(2)}×\n` +
    `helicopter: ${state.helicopterActive}\n` +
    `ghostMode: ${state.ghostMode}\n` +
    `roadblock: ${state.roadblockActive}\n` +
    `obstacles: ${roadScene.obstacles.length}\n` +
    `nitros: ${roadScene.nitros.length}`;
}

init().catch(console.error);
