import { Application } from 'pixi.js';
import { GameEngine } from './game/GameEngine';
import { RoadScene } from './scenes/RoadScene';
import { DialogueSystem } from './kash/DialogueSystem';
import { W, H } from './scenes/constants';
import { getChasePhase, PHASE_BANNERS } from './game/Phases';
import { initRNG, generateCrashPoint } from './game/RNG';
import * as Audio from './audio/AudioManager';
import './styles/main.css';

// ── Bootstrap ──
const engine = new GameEngine();
const roadScene = new RoadScene();
const dialogue = new DialogueSystem();

// ── State ──
let autoCashOut = false;
let autoCashOutTarget = 2;
let pendingBet: number | null = null;
let playerInRound = false;   // did the player bet this round?
let roundRunning = false;    // is a round currently in play?

// ── Button state ──
type BtnState = 'bet' | 'cashout' | 'placed' | 'queued';
let btnState: BtnState = 'bet';

// ── Intro video + Init ──
async function init() {
  const introScreen = document.getElementById('intro-screen')!;
  const introVideo = document.getElementById('intro-video') as HTMLVideoElement;
  const skipBtn = document.getElementById('intro-skip')!;

  const loadingBar = document.getElementById('intro-loading-bar')!;
  const loadingText = document.getElementById('intro-loading-text')!;
  const loadingWrap = document.getElementById('intro-loading')!;

  // Auto-reload if loading gets stuck (20s timeout)
  const loadingTimeout = setTimeout(() => location.reload(), 20000);

  // Show loading bar immediately
  loadingBar.style.width = '10%';
  loadingText.textContent = 'Initializing...';

  // Load game assets with progress
  const app = new Application();
  await app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  loadingBar.style.width = '25%';

  document.getElementById('pixi-container')!.appendChild(app.canvas);
  app.stage.addChild(roadScene.container);

  loadingText.textContent = 'Loading video...';
  await roadScene.loadVideoBackground();
  loadingBar.style.width = '50%';

  loadingText.textContent = 'Loading sprites...';
  await Promise.all([
    roadScene.loadObstacleSprites(),
    roadScene.loadRiderSprite(),
    initRNG(),
  ]);
  loadingBar.style.width = '90%';

  app.ticker.add(() => roadScene.update(engine.state));

  // ── Wire DOM ──
  $('place-bet-btn').addEventListener('click', onMainButtonClick);
  $('run-again').addEventListener('click', () => resetUI());
  $('bet-half').addEventListener('click', () => adjustBetFactor(0.5));
  $('bet-minus').addEventListener('click', () => addToBet(-1));
  $('bet-plus').addEventListener('click', () => addToBet(1));
  $('bet-double').addEventListener('click', () => adjustBetFactor(2));
  $('auto-slider').addEventListener('input', onAutoSlider);
  document.querySelectorAll('.qbet').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.getAttribute('data-amount');
      if (a === 'max') setBetMax();
      else if (a === 'min') setBet(1);
      else addToBet(parseFloat(a!));
    });
  });

  // Audio — also init on any click if not already
  const initAudioOnce = () => { Audio.initAudio(); document.removeEventListener('click', initAudioOnce); document.removeEventListener('touchstart', initAudioOnce); };
  document.addEventListener('click', initAudioOnce);
  document.addEventListener('touchstart', initAudioOnce);

  $('mute-btn').addEventListener('click', () => {
    const m = Audio.toggleMute();
    $('mute-btn').textContent = m ? '🔇' : '🔊';
    $('mute-btn').classList.toggle('muted', m);
  });

  updateBalanceDisplay();
  updateHistory();
  updateStats();

  // ── Loading done — cancel reload timeout, start video ──
  clearTimeout(loadingTimeout);
  loadingBar.style.width = '100%';
  loadingText.textContent = 'Ready';

  const unmuteBtn = document.getElementById('intro-unmute')!;

  // Keep game audio uninitialized during intro — no sounds leak

  const showReady = () => {
    loadingWrap.classList.remove('visible');
    skipBtn.classList.add('visible');
  };

  // Try autoplay with audio first
  introVideo.play().then(() => {
    // Autoplay with audio worked
    showReady();
  }).catch(() => {
    // Autoplay with audio blocked — try muted video + show unmute button
    introVideo.muted = true;
    introVideo.play().then(() => {
      showReady();
      unmuteBtn.classList.add('visible');
    }).catch(() => {
      // Can't play at all — skip to game
      showReady();
      showGame();
    });
  });

  // Unmute button — unmute video on tap
  const onUnmute = () => {
    introVideo.muted = false;
    unmuteBtn.classList.remove('visible');
  };
  unmuteBtn.addEventListener('click', (e) => { e.stopPropagation(); onUnmute(); });
  unmuteBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); onUnmute(); });

  // ── Skip intro / video end → start game ──
  let gameShown = false;
  const showGame = () => {
    if (gameShown) return;
    gameShown = true;
    introVideo.pause();
    // Init game audio now (user gesture context from skip/tap)
    Audio.initAudio();
    document.getElementById('wrap')!.style.visibility = 'visible';
    introScreen.classList.add('hidden');
    setTimeout(() => introScreen.remove(), 1000);
    // Start game loop after intro
    wireLocalMode();
  };

  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); showGame(); });
  // If video ends naturally, also show game
  introVideo.addEventListener('ended', showGame, { once: true });
  // Source errors — don't get stuck
  introVideo.querySelectorAll('source').forEach(s => s.addEventListener('error', () => {
    console.warn('[Intro] Source failed:', s.src);
    showGame();
  }));
}

// ══════════════════════════════════════
//  OFFLINE / LOCAL MODE
// ══════════════════════════════════════

const LOCAL_OBSTACLE_TYPES = ['barricade', 'spikes', 'dumpster', 'cones', 'manhole'];
const LOCAL_WIDE_TYPES = ['police_alt'];
const LOCAL_OBSTACLE_LANES = [-0.667, 0, 0.667];
const LOCAL_KASH_LANES = [-0.8, -0.05, 0.7];
let localKashLane = -0.05;
let localLastObstacleAt = 0;
let localLastObstacleLanes: number[] = [];
let crashObstacleSpawned = false;
let localRoundTimer: ReturnType<typeof setInterval> | null = null;
let localCountdownTimer: ReturnType<typeof setInterval> | null = null;

function wireLocalMode() {
  startLocalRound();
}

let shownBanners = new Set<number>();

function startLocalRound() {
  shownBanners.clear();
  roundRunning = false;
  crashObstacleSpawned = false;
  roadScene.clearGameObjects();
  setRoundStatus('waiting');
  resetUI();

  // Process queued bet from previous round
  if (pendingBet !== null) {
    const amount = pendingBet;
    pendingBet = null;
    if (amount <= engine.state.balance && amount >= 1) {
      engine.state.balance -= amount;
      engine.state.bet = amount;
      playerInRound = true;
      updateBalanceDisplay();
      setMainButton('placed', amount);
      setBetControlsEnabled(false);
    }
  }

  // Generate crash point from provably fair hash chain
  engine.state.crashPoint = generateCrashPoint();

  startBetTicker();
  startCountdown(5);

  setTimeout(() => {
    stopBetTicker();
    roundRunning = true;

    // Force engine into running state
    engine.state.phase = 'RUNNING';
    engine.state.startTime = Date.now();
    engine.state.multiplier = 1.00;
    engine.state.chasePhase = 1;
    engine.state.helicopterActive = false;

    setRoundStatus('in-play');
    Audio.initAudio();
    Audio.startEngine();
    Audio.startSiren();

    if (playerInRound) {
      $('profit-display').classList.add('visible');
      setMainButton('cashout', engine.state.bet);
      setBetControlsEnabled(false);
      showKashQuote(dialogue.getRundownLine('round_start'));
    } else {
      // Not betting — disable controls during round
      setBetControlsEnabled(false);
    }

    // Start local tick loop
    localTickLoop();
  }, 5000);
}

let localTick: ReturnType<typeof setInterval> | null = null;
let lastTickTime = 0;

function localTickLoop() {
  if (localTick) clearInterval(localTick);
  lastTickTime = Date.now();
  localTick = setInterval(() => {
    // Keep running even after cashout — round continues until crash
    if (engine.state.phase !== 'RUNNING' && engine.state.phase !== 'CASHED_OUT') {
      clearInterval(localTick!); localTick = null; return;
    }

    const now = Date.now();
    const tickGap = now - lastTickTime;
    lastTickTime = now;

    const elapsed = now - engine.state.startTime!;
    engine.state.multiplier = Math.max(1, Math.exp(0.000055 * elapsed));
    const mult = engine.state.multiplier;

    // Catch up on missed obstacle spawns after tab was in background
    if (tickGap > 200) {
      const missedTicks = Math.min(Math.floor(tickGap / 80), 10);
      for (let i = 0; i < missedTicks; i++) {
        if (mult < engine.state.crashPoint! * 0.9) localMaybeSpawnObstacle();
      }
    }

    // Phase change
    const newPhase = getChasePhase(mult);
    if (newPhase !== engine.state.chasePhase) {
      engine.state.chasePhase = newPhase;
      const banner = PHASE_BANNERS[newPhase];
      if (banner && !shownBanners.has(newPhase)) {
        shownBanners.add(newPhase);
        showBanner(banner);
      }
    }

    roadScene.serverRoundRunning = true;

    // Multiplier display
    const mEl = $('multiplier-display');
    mEl.textContent = mult.toFixed(2) + '×';
    mEl.className = '';
    if (newPhase >= 4) mEl.classList.add('phase4');
    else if (newPhase >= 3) mEl.classList.add('phase3');
    Audio.updateEngine(mult);

    // Cashout button update (only while still in round)
    if (playerInRound && engine.state.phase === 'RUNNING') {
      const profit = engine.state.bet * mult - engine.state.bet;
      $('profit-display').textContent = '▲ +$' + profit.toFixed(2);
      setMainButton('cashout', engine.state.bet * mult);
      if (autoCashOut && mult >= autoCashOutTarget) localCashOut();
    }

    // Pre-spawn crash obstacle from horizon when approaching crash point
    const crashSpawnAt = engine.state.chasePhase <= 2 ? 0.88 : 0.92;
    if (!crashObstacleSpawned && engine.state.crashPoint! > 1.00 && mult >= engine.state.crashPoint! * crashSpawnAt) {
      crashObstacleSpawned = true;
      roadScene.obstacles.push({
        type: LOCAL_OBSTACLE_TYPES[Math.floor(Math.random() * LOCAL_OBSTACLE_TYPES.length)] as any,
        rx: localKashLane, rz: 0.02, speed: 0, color: '#EF4444', lanes: 1, isCrash: true,
      });
    }

    // Crash check — wait for crash obstacle to reach Kash
    if (mult >= engine.state.crashPoint!) {
      const crashObs = roadScene.obstacles.find(o => o.isCrash);
      // If crash obstacle exists but hasn't reached Kash yet, keep ticking
      if (crashObs && crashObs.rz < 0.35) {
        // Freeze multiplier at crash point while obstacle approaches
        engine.state.multiplier = engine.state.crashPoint!;
      } else {
        clearInterval(localTick!);
        localTick = null;
        const wasCashedOut = engine.state.phase === 'CASHED_OUT';
        engine.state.phase = 'CRASHED';
        localOnCrash(wasCashedOut);
        return;
      }
    }

    // Spawn obstacles and dodge — stop both once crash obstacle is spawned
    if (!crashObstacleSpawned) {
      if (mult < engine.state.crashPoint! * 0.9) {
        localMaybeSpawnObstacle();
      }
      localCheckDodge();
    }
  }, 80);
}

let localDodgeCooldown = 0;

/** Check all active obstacles approaching Kash and dodge if needed */
function localCheckDodge() {
  const now = Date.now();
  if (now - localDodgeCooldown < 300) return;

  // Find non-crash obstacles in the danger zone (approaching Kash at rz=0.4)
  const approaching = roadScene.obstacles.filter(o => !o.isCrash && o.rz > 0.15 && o.rz < 0.5);
  if (approaching.length === 0) return;

  // Check if any approaching obstacle is in Kash's lane
  const inDanger = approaching.some(o => {
    const radius = o.lanes === 2 ? 0.7 : 0.4;
    return Math.abs(localKashLane - o.rx) < radius;
  });
  if (!inDanger) return;

  // Need to dodge — find safe lane considering ALL approaching obstacles (skip crash)
  const safeLanes = LOCAL_KASH_LANES.filter(kl =>
    approaching.every(o => {
      const safeR = o.lanes === 2 ? 0.6 : 0.3;
      return Math.abs(kl - o.rx) > safeR;
    })
  );

  if (safeLanes.length > 0) {
    localKashLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
    roadScene.riderLane = localKashLane;
    localDodgeCooldown = now;
  }
}

function localMaybeSpawnObstacle() {
  const now = Date.now();
  const phase = engine.state.chasePhase;
  const interval = [1200, 800, 500, 350, 250][phase - 1];
  if (now - localLastObstacleAt < interval || Math.random() > 0.7) return;
  localLastObstacleAt = now;

  const multiChance = [0.15, 0.25, 0.35, 0.45, 0.5][phase - 1];
  const count = Math.random() < multiChance ? 2 : 1;

  // Exclude lanes used in the previous spawn
  const excludePrev = (l: number) => !localLastObstacleLanes.some(p => Math.abs(p - l) < 0.3);

  const usedLanes: number[] = [];
  for (let i = 0; i < count; i++) {
    const avail = LOCAL_OBSTACLE_LANES.filter(l => excludePrev(l) && !usedLanes.some(u => Math.abs(u - l) < 0.3));
    if (avail.length === 0) break;
    usedLanes.push(avail[Math.floor(Math.random() * avail.length)]);
  }
  if (usedLanes.length === 0) return;

  // Wide obstacle chance (phase 3+)
  const wideChance = phase >= 3 ? 0.2 : 0;
  if (Math.random() < wideChance) {
    const wideLanes = [-0.333, 0.333].filter(l => excludePrev(l));
    if (wideLanes.length > 0) {
      const type = LOCAL_WIDE_TYPES[Math.floor(Math.random() * LOCAL_WIDE_TYPES.length)];
      const lane = wideLanes[Math.floor(Math.random() * wideLanes.length)];
      roadScene.obstacles.push({
        type: type as any, rx: lane, rz: 0.02, speed: 0, color: '#EF4444', lanes: 2,
      });
      localLastObstacleLanes = [lane];
    }
  } else {
    for (const l of usedLanes) {
      roadScene.obstacles.push({
        type: LOCAL_OBSTACLE_TYPES[Math.floor(Math.random() * LOCAL_OBSTACLE_TYPES.length)] as any,
        rx: l, rz: 0.02, speed: 0, color: '#EF4444', lanes: 1,
      });
    }
    localLastObstacleLanes = [...usedLanes];
  }
}

function localCashOut() {
  if (engine.state.phase !== 'RUNNING' || !playerInRound) return;
  const winAmt = engine.state.bet * engine.state.multiplier;
  engine.state.phase = 'CASHED_OUT';
  engine.state.balance += winAmt;
  engine.state.sessionProfit += winAmt - engine.state.bet;
  engine.state.sessionRounds++;
  if (!engine.state.bestRun || engine.state.multiplier > engine.state.bestRun) engine.state.bestRun = engine.state.multiplier;
  engine.state.history.unshift({ mult: engine.state.multiplier, result: 'WON', bet: engine.state.bet });
  if (engine.state.history.length > 20) engine.state.history.pop();
  localOnCashOut(winAmt);
}

function localOnCrash(alreadyCashedOut = false) {
  const crashPoint = engine.state.crashPoint!;
  roundRunning = false;
  roadScene.serverRoundRunning = false;

  // If player already cashed out, don't penalize — just show the crash and move on
  const playerLost = playerInRound && !alreadyCashedOut;

  if (crashPoint <= 1.00) {
    // Engine stalled — no obstacle
    setRoundStatus('crash');
    Audio.stopAll();
    Audio.playCrash();
    flashScreen('#EF4444', 600);
    showCrashDisplay(crashPoint);
    if (playerLost) {
      engine.state.balance -= engine.state.bet;
      engine.state.sessionProfit -= engine.state.bet;
      engine.state.sessionRounds++;
    }
    engine.state.history.unshift({ mult: crashPoint, result: 'LOST', bet: playerLost ? engine.state.bet : 0 });
    if (engine.state.history.length > 20) engine.state.history.pop();
    playerInRound = false;
    if (pendingBet === null) { setMainButton('bet'); setBetControlsEnabled(true); }
    setTimeout(() => { updateBalanceDisplay(); updateHistory(); updateStats(); }, 800);
    setTimeout(() => startLocalRound(), 3000);
    return;
  }

  // Crash obstacle already pre-spawned from horizon — trigger effects immediately
  // Keep only the crash obstacle visible
  const crashObs = roadScene.obstacles.find(o => o.isCrash);
  roadScene.obstacles = crashObs ? [crashObs] : [];

  setRoundStatus('crash');
  Audio.stopAll();
  roadScene.spawnCrashParticles();
  Audio.playCrash();
  flashScreen('#EF4444', 600);
  showCrashDisplay(crashPoint);

  if (playerLost) {
    engine.state.balance -= engine.state.bet;
    engine.state.sessionProfit -= engine.state.bet;
    engine.state.sessionRounds++;
  }
  engine.state.history.unshift({ mult: crashPoint, result: 'LOST', bet: playerLost ? engine.state.bet : 0 });
  if (engine.state.history.length > 20) engine.state.history.pop();
  playerInRound = false;
  if (pendingBet === null) { setMainButton('bet'); setBetControlsEnabled(true); }

  setTimeout(() => { updateBalanceDisplay(); updateHistory(); updateStats(); }, 800);
  setTimeout(() => startLocalRound(), 3000);
}

function localOnCashOut(amount: number) {
  roadScene.serverRoundRunning = false;
  playerInRound = false;

  // Don't stop engine/siren — round still running for others
  Audio.playCashOut();
  flashScreen('#16A34A', 500);
  showFloatingText('CASHED OUT! +$' + amount.toFixed(2), '#16A34A', W / 2, 350);

  setMainButton('bet');
  setBetControlsEnabled(true);

  $('win-screen').classList.add('visible');
  $('win-amount').textContent = '$' + amount.toFixed(2);
  $('win-mult-val').textContent = engine.state.multiplier.toFixed(2) + '×';
  updateBalanceDisplay();
  updateHistory();
  updateStats();

  setTimeout(() => $('win-screen').classList.remove('visible'), 2200);
}


// ══════════════════════════════════════
//  BUTTON LOGIC
// ══════════════════════════════════════

function onMainButtonClick(): void {
  switch (btnState) {
    case 'bet': placeBet(); break;
    case 'placed':
      // Cancel — refund
      engine.state.balance += engine.state.bet;
      playerInRound = false;
      updateBalanceDisplay();
      setMainButton('bet');
      setBetControlsEnabled(true);
      break;
    case 'cashout': doCashOut(); break;
    case 'queued':
      // Cancel queued bet
      pendingBet = null;
      setMainButton('bet');
      setBetControlsEnabled(true);
      break;
  }
}

function placeBet(): void {
  const amount = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
  if (amount > engine.state.balance) { showFloatingText('Insufficient balance', '#EF4444', W / 2, 500); return; }
  if (amount < 1) { showFloatingText('Minimum bet: $1.00', '#EF4444', W / 2, 500); return; }

  if (roundRunning || engine.state.phase === 'CRASHED' || engine.state.phase === 'CASHED_OUT') {
    // Round in play or crash animation — queue for next round
    pendingBet = amount;
    setMainButton('queued', amount);
    setBetControlsEnabled(false);
  } else {
    // Countdown phase — place bet now
    engine.state.balance -= amount;
    engine.state.bet = amount;
    playerInRound = true;
    updateBalanceDisplay();
    setMainButton('placed', amount);
    setBetControlsEnabled(false);
  }
}

function doCashOut(): void {
  if (engine.state.phase !== 'RUNNING') return;
  localCashOut();
}

function setMainButton(state: BtnState, amount?: number): void {
  const btn = $('place-bet-btn');
  btnState = state;
  btn.classList.remove('queued', 'cashout-mode', 'placed-mode');
  btn.style.opacity = '';
  btn.style.pointerEvents = '';

  switch (state) {
    case 'bet': {
      const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
      btn.innerHTML = 'PLACE BET<span style="font-size:13px;font-weight:400;letter-spacing:1px;opacity:0.9;display:block" id="btn-bet-amount">$' + val.toFixed(2) + '</span>';
      break;
    }
    case 'placed':
      btn.classList.add('placed-mode');
      btn.innerHTML = 'BET PLACED<span style="font-size:13px;font-weight:400;letter-spacing:1px;opacity:0.9;display:block">$' + (amount ?? 0).toFixed(2) + ' — tap to cancel</span>';
      break;
    case 'cashout':
      btn.classList.add('cashout-mode');
      btn.innerHTML = 'CASH OUT<span style="font-size:13px;font-weight:400;letter-spacing:1px;opacity:0.9;display:block">$' + (amount ?? 0).toFixed(2) + '</span>';
      break;
    case 'queued':
      btn.classList.add('queued');
      btn.innerHTML = 'QUEUED<span style="font-size:13px;font-weight:400;letter-spacing:1px;opacity:0.9;display:block">$' + (amount ?? 0).toFixed(2) + ' — tap to cancel</span>';
      break;
  }
}

function setBetControlsEnabled(enabled: boolean): void {
  const els: HTMLElement[] = [$('bet-half'), $('bet-minus'), $('bet-plus'), $('bet-double'), $('bet-input'), $('auto-slider')];
  document.querySelectorAll('.qbet').forEach(el => els.push(el as HTMLElement));
  for (const el of els) {
    el.style.opacity = enabled ? '' : '0.3';
    el.style.pointerEvents = enabled ? '' : 'none';
  }
}

// ══════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════

function $(id: string): HTMLElement { return document.getElementById(id)!; }

function resetUI(): void {
  engine.state.phase = 'IDLE';
  engine.state.multiplier = 1.00;
  engine.state.chasePhase = 1;
  engine.state.helicopterActive = false;
  playerInRound = false;
  roadScene.riderLane = 0;

  $('bust-screen').classList.remove('visible');
  $('win-screen').classList.remove('visible');
  $('profit-display').classList.remove('visible');
  $('multiplier-display').textContent = '1.00×';
  $('multiplier-display').className = '';
  $('kash-quote').classList.remove('visible');

  setMainButton('bet');
  setBetControlsEnabled(true);
  updateBalanceDisplay();
  updateHistory();
  updateStats();
}

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let betTickerInterval: ReturnType<typeof setInterval> | null = null;

function startBetTicker(): void {
  if (betTickerInterval) clearInterval(betTickerInterval);
  let simTotal = 2000 + Math.floor(Math.random() * 500);
  $('total-bets').textContent = '$' + simTotal.toLocaleString();
  betTickerInterval = setInterval(() => {
    simTotal += Math.floor(30 + Math.random() * 120);
    $('total-bets').textContent = '$' + simTotal.toLocaleString();
  }, 300 + Math.random() * 400);
}

function stopBetTicker(): void {
  if (betTickerInterval) { clearInterval(betTickerInterval); betTickerInterval = null; }
}

function startCountdown(seconds = 5): void {
  if (countdownInterval) clearInterval(countdownInterval);
  const overlay = $('countdown-overlay');
  const numEl = $('countdown-num');
  overlay.classList.add('visible');
  let n = seconds;
  numEl.textContent = String(n);
  Audio.playCountdownTick(n);

  countdownInterval = setInterval(() => {
    n--;
    numEl.style.animation = 'none';
    void numEl.offsetHeight;
    numEl.style.animation = 'count-pop 0.4s ease-out';
    numEl.textContent = n > 0 ? String(n) : 'GO!';
    Audio.playCountdownTick(n);
    if (n <= 0) {
      clearInterval(countdownInterval!);
      countdownInterval = null;
      setTimeout(() => overlay.classList.remove('visible'), 400);
    }
  }, 1000);
}

function setRoundStatus(status: '' | 'in-play' | 'waiting' | 'crash'): void {
  const el = $('round-status');
  el.className = '';
  if (status === 'in-play') { el.className = 'in-play'; el.textContent = 'IN PLAY'; }
  else if (status === 'waiting') { el.className = 'waiting'; el.textContent = 'BET NOW'; }
  else if (status === 'crash') { el.className = 'crashed'; el.textContent = 'CRASHED!'; }
}

function updateBalanceDisplay(): void {
  $('bal-num').textContent = engine.state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updatePhaseBar(_phase: number): void {}

function updateHistory(): void {
  const strip = $('history-strip');
  strip.innerHTML = '';
  engine.state.history.slice(0, 14).forEach(h => {
    const m = h.mult;
    const cls = m < 2 ? 'hist-red' : m < 3 ? 'hist-blue' : m < 10 ? 'hist-green' : 'hist-purple';
    const badge = document.createElement('div');
    badge.className = `hist-badge ${cls}`;
    badge.textContent = m.toFixed(2) + '×';
    strip.appendChild(badge);
  });
}

function updateStats(): void {
  $('best-run').textContent = engine.state.bestRun ? engine.state.bestRun.toFixed(2) + '×' : '—';
  $('round-count').textContent = String(engine.state.sessionRounds);
}

function updateBetDisplay(): void {
  if (btnState === 'bet') {
    const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
    const el = document.getElementById('btn-bet-amount');
    if (el) el.textContent = '$' + val.toFixed(2);
  }
}

function setBet(amount: number): void {
  ($('bet-input') as HTMLInputElement).value = Math.min(amount, engine.state.balance).toFixed(2);
  updateBetDisplay();
}

function setBetMax(): void { setBet(Math.min(engine.state.balance, 500)); }

function adjustBetFactor(factor: number): void {
  const cur = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
  ($('bet-input') as HTMLInputElement).value = Math.max(1, Math.min(500, Math.min(engine.state.balance, cur * factor))).toFixed(2);
  updateBetDisplay();
}

function addToBet(amount: number): void {
  const cur = parseFloat(($('bet-input') as HTMLInputElement).value) || 0;
  ($('bet-input') as HTMLInputElement).value = Math.max(1, Math.min(500, Math.min(engine.state.balance, cur + amount))).toFixed(2);
  updateBetDisplay();
}

function sliderToMultiplier(v: number): number {
  return v === 0 ? 0 : 1.1 * Math.pow(50 / 1.1, v / 100);
}

function onAutoSlider(): void {
  const v = parseInt(($('auto-slider') as HTMLInputElement).value);
  const mult = sliderToMultiplier(v);
  if (mult === 0) {
    autoCashOut = false;
    $('auto-target-val').textContent = 'OFF';
    $('auto-target-val').style.color = 'var(--muted)';
  } else {
    autoCashOut = true;
    autoCashOutTarget = mult;
    $('auto-target-val').textContent = mult.toFixed(2) + '×';
    $('auto-target-val').style.color = 'var(--chase-orange)';
  }
}

function showFloatingText(text: string, color: string, x: number, y: number): void {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.cssText = `color:${color};left:${x - 100}px;top:${y}px;width:200px;text-align:center`;
  $('wrap').appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function showCrashDisplay(crashPoint: number): void {
  const el = $('crash-display');
  el.textContent = crashPoint <= 1.00 ? "ENGINE STALLED" : "CRASHED";
  el.classList.remove('visible');
  void el.offsetWidth;
  el.classList.add('visible');
  $('wrap').classList.add('shake');
  setTimeout(() => $('wrap').classList.remove('shake'), 400);
  setTimeout(() => el.classList.remove('visible'), 2200);
}

function flashScreen(color: string, duration: number): void {
  const el = $('screen-flash');
  el.style.background = color;
  el.style.opacity = '0.35';
  setTimeout(() => { el.style.opacity = '0'; }, Math.min(duration, 300));
}

function showBanner(text: string): void {
  const b = $('phase-event-banner');
  $('banner-text').textContent = text;
  b.classList.add('visible');
  setTimeout(() => b.classList.remove('visible'), 2500);
}

let quoteTimer: ReturnType<typeof setTimeout> | null = null;
function showKashQuote(text: string): void {
  if (quoteTimer) clearTimeout(quoteTimer);
  const q = $('kash-quote');
  q.textContent = '💬 ' + text;
  q.classList.add('visible');
  quoteTimer = setTimeout(() => q.classList.remove('visible'), 4000);
}

// ── Start ──
init().catch(console.error);
