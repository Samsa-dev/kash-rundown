/**
 * Scene Lab — Isolated PixiJS scene viewer with live controls.
 * No game logic, no UI overlays — just the RoadScene canvas + tweakable state.
 */

import { Application } from 'pixi.js';
import { RoadScene } from './scenes/RoadScene';
import { createInitialState, type GameState, type GamePhase, type ChasePhase } from './game/types';
import { W, H, setHorizonWidth } from './scenes/constants';
import { getChasePhase, PHASE_BANNERS } from './game/Phases';

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

  await roadScene.loadVideoBackground();
  await roadScene.loadObstacleSprites();
  await roadScene.loadRiderSprite();
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
      if (state.chasePhase >= 5) {
        state.helicopterActive = true;
        state.heliStartTime = Date.now();
        ($('toggle-heli') as HTMLInputElement).checked = true;
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
  ($('toggle-video') as HTMLInputElement).addEventListener('change', (e) => {
    roadScene.useVideoBackground = (e.target as HTMLInputElement).checked;
  });
  ($('toggle-heli') as HTMLInputElement).addEventListener('change', (e) => {
    state.helicopterActive = (e.target as HTMLInputElement).checked;
    if (state.helicopterActive) state.heliStartTime = Date.now();
  });
  const horizonSlider = $('horizon-width') as HTMLInputElement;
  horizonSlider.addEventListener('input', () => {
    const val = parseInt(horizonSlider.value);
    setHorizonWidth(val);
    $('horizon-val').textContent = String(val);
  });

  ($('toggle-fog') as HTMLInputElement).addEventListener('change', (e) => {
    roadScene.skylineFog = (e.target as HTMLInputElement).checked;
  });
  ($('toggle-road-fog') as HTMLInputElement).addEventListener('change', (e) => {
    roadScene.roadFog = (e.target as HTMLInputElement).checked;
  });

  // Kash lane slider + buttons
  const laneSlider = $('lane-slider') as HTMLInputElement;
  const setLane = (val: number) => {
    roadScene.riderLane = val;
    laneSlider.value = String(val);
    $('lane-val').textContent = val.toFixed(2);
  };
  laneSlider.addEventListener('input', () => setLane(parseFloat(laneSlider.value)));
  document.querySelectorAll('#lane-btns button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#lane-btns button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLane(parseFloat(btn.getAttribute('data-lane')!));
    });
  });

  // Kash depth slider
  const depthSlider = $('depth-slider') as HTMLInputElement;
  depthSlider.addEventListener('input', () => {
    const val = parseFloat(depthSlider.value);
    roadScene.riderDepth = val;
    $('depth-val').textContent = val.toFixed(2);
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

      lanes: 1,
    });
  };

  $('spawn-barricade').addEventListener('click', () => spawnObs('barricade'));
  $('spawn-spikes').addEventListener('click', () => spawnObs('spikes'));
  $('spawn-dumpster').addEventListener('click', () => spawnObs('dumpster'));
  $('spawn-cones').addEventListener('click', () => spawnObs('cones'));
  $('spawn-flipped').addEventListener('click', () => spawnObs('flipped_car'));

  // 2-lane wide obstacle
  const wideTypes: Array<'barricade' | 'spikes' | 'flipped_car'> =
    ['barricade', 'spikes', 'flipped_car'];
  const dualLanePositions = [-0.333, 0.333];
  $('spawn-wide').addEventListener('click', () => {
    roadScene.obstacles.push({
      type: wideTypes[Math.floor(Math.random() * wideTypes.length)],
      rx: dualLanePositions[Math.floor(Math.random() * dualLanePositions.length)],
      rz: 0.02,
      speed: 0,
      color: '#EF4444',

      lanes: 2,
    });
  });

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

  // Obstacle sprite controls
  ($('toggle-obs-sprites') as HTMLInputElement).addEventListener('change', (e) => {
    roadScene.useObstacleSprites = (e.target as HTMLInputElement).checked;
  });
  ($('obs-scale') as HTMLInputElement).addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    roadScene.obstacleScale = val;
    $('obs-scale-val').textContent = val.toFixed(2);
  });

  // Kash video/image toggle
  ($('toggle-kash-video') as HTMLInputElement).addEventListener('change', (e) => {
    roadScene.setRiderVideo((e.target as HTMLInputElement).checked);
  });

  // Kash scale & offset
  ($('kash-scale') as HTMLInputElement).addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    roadScene.riderScale = val;
    $('kash-scale-val').textContent = val.toFixed(2);
  });
  ($('kash-yoff') as HTMLInputElement).addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    roadScene.riderYOffset = val;
    $('kash-yoff-val').textContent = String(val);
  });

  // Speed lines controls
  ($('sl-height') as HTMLInputElement).addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    roadScene.speedLineHeight = val;
    $('sl-height-val').textContent = val.toFixed(2);
  });
  ($('sl-inner') as HTMLInputElement).addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    roadScene.speedLineInner = val;
    $('sl-inner-val').textContent = String(val);
  });
  ($('sl-outer') as HTMLInputElement).addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    roadScene.speedLineOuter = val;
    $('sl-outer-val').textContent = String(val);
  });

  // ── Simulation controls ──
  const simCrashSlider = $('sim-crash') as HTMLInputElement;
  const simSpeedSlider = $('sim-speed') as HTMLInputElement;
  let simInterval: ReturnType<typeof setInterval> | null = null;
  let simElapsed = 0;
  let simCrashPoint = 10;
  let simSpeed = 1;
  let simLastPhase = 1;

  simCrashSlider.addEventListener('input', () => {
    simCrashPoint = parseFloat(simCrashSlider.value) || 10;
  });
  simSpeedSlider.addEventListener('input', () => {
    simSpeed = parseFloat(simSpeedSlider.value);
    $('sim-speed-val').textContent = simSpeed.toFixed(1) + '×';
  });

  const OBSTACLE_TYPES = ['barricade', 'spikes', 'dumpster', 'cones', 'manhole'];
  const OBSTACLE_LANES = [-0.667, 0, 0.667];
  const SIM_KASH_LANES = [-0.8, -0.05, 0.7];
  let simKashLane = -0.05;
  let simLastObstacleAt = 0;
  let simCrashing = false;

  $('sim-start').addEventListener('click', () => {
    if (simInterval) clearInterval(simInterval);
    simElapsed = 0;
    simLastPhase = 1;
    simKashLane = -0.05;
    simLastObstacleAt = 0;
    simCrashing = false;
    state.phase = 'RUNNING';
    state.startTime = Date.now();
    state.multiplier = 1.00;
    state.chasePhase = 1;
    roadScene.serverRoundRunning = true;
    roadScene.riderLane = simKashLane;
    roadScene.clearGameObjects();
    $('sim-log').textContent = 'Running... crash at ' + simCrashPoint.toFixed(1) + '×';

    simInterval = setInterval(() => {
      if (simCrashing) return;

      simElapsed += 80 * simSpeed;
      const mult = Math.max(1, Math.exp(0.000055 * simElapsed));
      state.multiplier = mult;

      // Phase change
      const newPhase = getChasePhase(mult);
      if (newPhase !== simLastPhase) {
        simLastPhase = newPhase;
        state.chasePhase = newPhase as ChasePhase;
        const banner = PHASE_BANNERS[newPhase];
        if (banner) $('sim-log').textContent = banner;
        if (newPhase >= 5) {
          state.helicopterActive = true;
          state.heliStartTime = Date.now();
        }
      }

      (multSlider as HTMLInputElement).value = String(mult);
      $('mult-val').textContent = mult.toFixed(2) + '×';

      // Spawn obstacles (same logic as server)
      const now = Date.now();
      const interval = [1200, 800, 500, 350, 250][state.chasePhase - 1];
      if (now - simLastObstacleAt >= interval && Math.random() < 0.7) {
        simLastObstacleAt = now;

        const multiChance = [0.15, 0.25, 0.35, 0.45, 0.5][state.chasePhase - 1];
        const count = Math.random() < multiChance ? 2 : 1;
        const usedLanes: number[] = [];
        for (let i = 0; i < count; i++) {
          const avail = OBSTACLE_LANES.filter(l => !usedLanes.some(u => Math.abs(u - l) < 0.3));
          if (avail.length === 0) break;
          usedLanes.push(avail[Math.floor(Math.random() * avail.length)]);
        }

        for (const l of usedLanes) {
          roadScene.obstacles.push({
            type: OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)] as any,
            rx: l, rz: 0.02, speed: 0, color: '#EF4444', lanes: 1,
          });
        }

        // Kash dodge
        const inDanger = usedLanes.some(l => Math.abs(simKashLane - l) < 0.4);
        if (inDanger) {
          const safeLanes = SIM_KASH_LANES.filter(kl => usedLanes.every(ol => Math.abs(kl - ol) > 0.3));
          if (safeLanes.length > 0) {
            const newLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
            const delay = state.chasePhase <= 2 ? 150 + Math.random() * 100 : 0;
            if (delay > 0) {
              setTimeout(() => { simKashLane = newLane; roadScene.riderLane = newLane; }, delay);
            } else {
              simKashLane = newLane;
              roadScene.riderLane = newLane;
            }
          }
        }
      }

      // Crash
      if (mult >= simCrashPoint) {
        simCrashing = true;

        if (simCrashPoint <= 1.00) {
          clearInterval(simInterval!);
          simInterval = null;
          state.phase = 'CRASHED';
          roadScene.serverRoundRunning = false;
          roadScene.spawnCrashParticles();
          $('sim-log').textContent = 'ENGINE STALLED';
          return;
        }

        // Spawn crash obstacle exactly in Kash's lane
        const crashLane = simKashLane;
        const crashType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        roadScene.obstacles.push({
          type: crashType as any, rx: crashLane, rz: 0, speed: 0, color: '#EF4444', lanes: 1,
        });

        const delay = [1000, 600, 380, 300, 200][state.chasePhase - 1];
        setTimeout(() => {
          clearInterval(simInterval!);
          simInterval = null;
          state.phase = 'CRASHED';
          roadScene.serverRoundRunning = false;
          // Keep only crash obstacle
          if (roadScene.obstacles.length > 0) {
            const last = roadScene.obstacles[roadScene.obstacles.length - 1];
            roadScene.obstacles.length = 0;
            roadScene.obstacles.push(last);
          }
          roadScene.spawnCrashParticles();
          $('sim-log').textContent = 'CRASHED at ' + mult.toFixed(2) + '×';
        }, delay);
      }
    }, 80);
  });

  $('sim-stop').addEventListener('click', () => {
    if (simInterval) {
      clearInterval(simInterval);
      simInterval = null;
    }
    roadScene.serverRoundRunning = false;
    state.phase = 'IDLE';
    $('sim-log').textContent = 'Stopped at ' + state.multiplier.toFixed(2) + '×';
  });
}

// ── State display ──
function updateStateDisplay() {
  $('state-display').textContent =
    `phase: ${state.phase}\n` +
    `chasePhase: ${state.chasePhase}\n` +
    `multiplier: ${state.multiplier.toFixed(2)}×\n` +
    `helicopter: ${state.helicopterActive}\n` +
    `obstacles: ${roadScene.obstacles.length}\n` +
    `nitros: ${roadScene.nitros.length}`;
}

init().catch(console.error);
