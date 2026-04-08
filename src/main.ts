import { Application } from 'pixi.js';
import { GameEngine } from './game/GameEngine';
import { RoadScene } from './scenes/RoadScene';
import { DialogueSystem } from './kash/DialogueSystem';
import { GameClient } from './network/GameClient';
import { W, H } from './scenes/constants';
import { getChasePhase, PHASE_BANNERS } from './game/Phases';
import * as Audio from './audio/AudioManager';
import './styles/main.css';

// ── Bootstrap ──
const engine = new GameEngine();
const roadScene = new RoadScene();
const dialogue = new DialogueSystem();
const WS_URL = import.meta.env.VITE_WS_URL || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3001';
const client = new GameClient(WS_URL);

// ── State ──
let autoCashOut = false;
let autoCashOutTarget = 2;
let pendingBet: number | null = null;
let serverRunning = false;   // is the server round currently running?
let playerInRound = false;   // did the player bet this round?

// ── Button state ──
type BtnState = 'bet' | 'cashout' | 'placed' | 'queued';
let btnState: BtnState = 'bet';

// ── Init ──
async function init() {
  const loadBar = document.getElementById('loading-bar')!;
  const loadText = document.getElementById('loading-text')!;

  loadBar.style.width = '20%';
  loadText.textContent = 'Initializing engine...';

  const app = new Application();
  await app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });

  loadBar.style.width = '40%';
  loadText.textContent = 'Loading assets...';

  document.getElementById('pixi-container')!.appendChild(app.canvas);
  app.stage.addChild(roadScene.container);
  await roadScene.loadVideoBackground();
  await roadScene.loadObstacleSprites();
  await roadScene.loadRiderSprite();

  loadBar.style.width = '70%';
  loadText.textContent = 'Connecting to server...';
  await client.connect();

  let offlineMode = client.offline;
  if (offlineMode) {
    console.log('[Main] Offline mode — using local game engine');
    wireLocalMode();
  } else {
    wireServerEvents();
  }

  loadBar.style.width = '90%';
  loadText.textContent = offlineMode ? 'Offline mode...' : 'Setting up...';

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

  // Audio needs user gesture
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

  // Show game
  loadBar.style.width = '100%';
  loadText.textContent = 'Ready';
  document.getElementById('wrap')!.style.visibility = 'visible';
  setTimeout(() => document.getElementById('loading-screen')!.classList.add('hidden'), 300);
}

// ══════════════════════════════════════
//  OFFLINE / LOCAL MODE
// ══════════════════════════════════════

const LOCAL_OBSTACLE_TYPES = ['barricade', 'spikes', 'dumpster', 'cones', 'manhole'];
const LOCAL_OBSTACLE_LANES = [-0.667, 0, 0.667];
const LOCAL_KASH_LANES = [-0.8, -0.05, 0.7];
let localKashLane = -0.05;
let localLastObstacleAt = 0;
let localRoundTimer: ReturnType<typeof setInterval> | null = null;
let localCountdownTimer: ReturnType<typeof setInterval> | null = null;

function wireLocalMode() {
  // Auto-start rounds
  startLocalRound();

  engine.on((event) => {
    switch (event.type) {
      case 'MULTIPLIER_UPDATE': {
        const mult = event.multiplier;
        engine.state.chasePhase = getChasePhase(mult);

        // Phase banners
        const newPhase = engine.state.chasePhase;
        const banner = PHASE_BANNERS[newPhase];
        if (banner && !shownBanners.has(newPhase)) {
          shownBanners.add(newPhase);
          showBanner(banner);
        }

        roadScene.serverRoundRunning = true;

        // Multiplier display
        const mEl = $('multiplier-display');
        mEl.textContent = mult.toFixed(2) + '×';
        mEl.className = '';
        if (newPhase >= 4) mEl.classList.add('phase4');
        else if (newPhase >= 3) mEl.classList.add('phase3');
        Audio.updateEngine(mult);

        if (engine.state.phase === 'RUNNING' && playerInRound) {
          const profit = engine.state.bet * mult - engine.state.bet;
          $('profit-display').textContent = '▲ +$' + profit.toFixed(2);
          setMainButton('cashout', engine.state.bet * mult);
          if (autoCashOut && mult >= autoCashOutTarget) localCashOut();
        }

        // Spawn obstacles locally
        localMaybeSpawnObstacle();
        break;
      }
      case 'CRASH':
        localOnCrash();
        break;
      case 'CASH_OUT':
        localOnCashOut(event.amount);
        break;
    }
  });
}

let shownBanners = new Set<number>();

function startLocalRound() {
  shownBanners.clear();
  setRoundStatus('waiting');
  resetUI();

  // Simulate bet ticker
  startBetTicker();

  // Countdown
  let n = 5;
  startCountdown(5);

  // After countdown, start engine
  setTimeout(() => {
    stopBetTicker();
    if (playerInRound) {
      engine.startRound();
      setRoundStatus('in-play');
      $('profit-display').classList.add('visible');
      showKashQuote(dialogue.getRundownLine('round_start'));
      Audio.initAudio();
      Audio.startEngine();
      Audio.startSiren();
    } else {
      // Even without bet, run the engine for spectating
      engine.state.crashPoint = engine.state.crashPoint; // already set by placeBet
      engine.startRound();
      setRoundStatus('in-play');
      Audio.initAudio();
      Audio.startEngine();
      Audio.startSiren();
    }
  }, 5000);
}

function localMaybeSpawnObstacle() {
  const now = Date.now();
  const phase = engine.state.chasePhase;
  const interval = [1200, 800, 500, 350, 250][phase - 1];
  if (now - localLastObstacleAt < interval || Math.random() > 0.7) return;
  localLastObstacleAt = now;

  const multiChance = [0.15, 0.25, 0.35, 0.45, 0.5][phase - 1];
  const count = Math.random() < multiChance ? 2 : 1;
  const usedLanes: number[] = [];
  for (let i = 0; i < count; i++) {
    const avail = LOCAL_OBSTACLE_LANES.filter(l => !usedLanes.some(u => Math.abs(u - l) < 0.3));
    if (avail.length === 0) break;
    usedLanes.push(avail[Math.floor(Math.random() * avail.length)]);
  }

  for (const l of usedLanes) {
    roadScene.obstacles.push({
      type: LOCAL_OBSTACLE_TYPES[Math.floor(Math.random() * LOCAL_OBSTACLE_TYPES.length)] as any,
      rx: l, rz: 0.02, speed: 0, color: '#EF4444', lanes: 1,
    });
  }

  const inDanger = usedLanes.some(l => Math.abs(localKashLane - l) < 0.4);
  if (inDanger) {
    const safeLanes = LOCAL_KASH_LANES.filter(kl => usedLanes.every(ol => Math.abs(kl - ol) > 0.3));
    if (safeLanes.length > 0) {
      const newLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
      const delay = phase <= 2 ? 150 + Math.random() * 100 : 0;
      if (delay > 0) {
        setTimeout(() => { localKashLane = newLane; roadScene.riderLane = newLane; }, delay);
      } else {
        localKashLane = newLane;
        roadScene.riderLane = newLane;
      }
    }
  }
}

function localCashOut() {
  engine.doCashOut();
}

function localOnCrash() {
  const crashPoint = engine.state.crashPoint!;
  roadScene.serverRoundRunning = false;

  // Spawn crash obstacle
  roadScene.obstacles.push({
    type: LOCAL_OBSTACLE_TYPES[Math.floor(Math.random() * LOCAL_OBSTACLE_TYPES.length)] as any,
    rx: localKashLane, rz: 0, speed: 0, color: '#EF4444', lanes: 1,
  });

  const delay = [1000, 600, 380, 300, 200][engine.state.chasePhase - 1];
  setTimeout(() => {
    setRoundStatus('crash');
    Audio.stopEngine();
    roadScene.spawnCrashParticles();
    if (roadScene.obstacles.length > 0) {
      const last = roadScene.obstacles[roadScene.obstacles.length - 1];
      roadScene.obstacles.length = 0;
      roadScene.obstacles.push(last);
    }
    Audio.playCrash();
    flashScreen('#EF4444', 600);
    showCrashDisplay(crashPoint);

    engine.state.history.unshift({ mult: crashPoint, result: 'LOST', bet: playerInRound ? engine.state.bet : 0 });
    if (engine.state.history.length > 20) engine.state.history.pop();

    setTimeout(() => {
      updateBalanceDisplay();
      updateHistory();
      updateStats();
    }, 800);

    // Next round after 3s
    setTimeout(() => startLocalRound(), 3000);
  }, delay);
}

function localOnCashOut(amount: number) {
  roadScene.serverRoundRunning = false;
  playerInRound = false;

  Audio.stopEngine();
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
//  SERVER EVENTS
// ══════════════════════════════════════

function wireServerEvents() {

  client.on('welcome', (msg) => {
    engine.state.balance = msg.balance as number;
    updateBalanceDisplay();
  });

  client.on('history', (msg) => {
    const entries = msg.entries as { roundId: number; crashPoint: number }[];
    for (const e of entries) engine.state.history.push({ mult: e.crashPoint, result: 'LOST', bet: 0 });
    if (engine.state.history.length > 20) engine.state.history.length = 20;
    updateHistory();
  });

  // ── New round about to start ──
  client.on('round:waiting', (_msg) => {
    // Nothing visual here, countdown follows immediately
  });

  // ── Countdown: bets are open ──
  client.on('round:countdown', (msg) => {
    serverRunning = false;
    roadScene.serverRoundRunning = false;
    setRoundStatus('waiting');

    // Reset UI if coming from crash/cashout
    if (engine.state.phase !== 'IDLE') resetUI();

    // Send queued bet
    if (pendingBet !== null) {
      client.placeBet(pendingBet);
      pendingBet = null;
    }

    // Clear crash obstacle and reset
    roadScene.clearGameObjects();

    // Ensure button is in bet mode and controls enabled
    setMainButton('bet');
    setBetControlsEnabled(true);

    startCountdown(msg.seconds as number);
    startBetTicker();
  });

  // ── Server accepted our bet ──
  client.on('bet:confirmed', (msg) => {
    engine.state.balance = msg.balance as number;
    engine.state.bet = msg.amount as number;
    engine.state.phase = 'COUNTDOWN';
    playerInRound = true;
    updateBalanceDisplay();
    roadScene.clearGameObjects();
    Audio.initAudio();
    setMainButton('placed', msg.amount as number);
    setBetControlsEnabled(false);
  });

  client.on('bet:cancelled', (msg) => {
    engine.state.balance = msg.balance as number;
    engine.state.phase = 'IDLE';
    playerInRound = false;
    updateBalanceDisplay();
    setMainButton('bet');
    setBetControlsEnabled(true);
  });

  client.on('bet:rejected', (msg) => {
    const reason = msg.reason as string;
    if (reason === 'Round not accepting bets') {
      // Auto-queue for next round instead of showing error
      const amount = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
      pendingBet = amount;
      setMainButton('queued', amount);
      setBetControlsEnabled(false);
    } else {
      showFloatingText(reason, '#EF4444', W / 2, 500);
    }
  });

  // ── Multiplier tick (round is running) ──
  client.on('round:tick', (msg) => {
    const mult = msg.multiplier as number;
    engine.state.multiplier = mult;

    // Phase banners
    const newPhase = getChasePhase(mult);
    if (newPhase !== engine.state.chasePhase) {
      engine.state.chasePhase = newPhase;
      const banner = PHASE_BANNERS[newPhase];
      if (banner) showBanner(banner);
    }

    // First tick of a new round
    if (!serverRunning) {
      serverRunning = true;
      roadScene.serverRoundRunning = true;
      setRoundStatus('in-play');
      stopBetTicker();
      Audio.initAudio();
      Audio.startEngine();
      Audio.startSiren();

      // Disable bet controls, switch button
      setBetControlsEnabled(false);
      if (playerInRound) {
        engine.state.phase = 'RUNNING';
        setMainButton('cashout', engine.state.bet * mult);
        $('profit-display').classList.add('visible');
        showKashQuote(dialogue.getRundownLine('round_start'));
      } else {
        // Spectating — button stays as bet but disabled, or they can queue
        setMainButton('bet');
      }
    }

    // Update multiplier display always
    const mEl = $('multiplier-display');
    mEl.textContent = mult.toFixed(2) + '×';
    mEl.className = '';
    if (engine.state.chasePhase >= 4) mEl.classList.add('phase4');
    else if (engine.state.chasePhase >= 3) mEl.classList.add('phase3');
    Audio.updateEngine(mult);

    // Update cashout button with current value
    if (playerInRound && engine.state.phase === 'RUNNING') {
      const profit = engine.state.bet * mult - engine.state.bet;
      $('profit-display').textContent = '▲ +$' + profit.toFixed(2);
      setMainButton('cashout', engine.state.bet * mult);

      if (autoCashOut && mult >= autoCashOutTarget) doCashOut();
    }
  });

  // ── Cashout confirmed ──
  client.on('cashOut:confirmed', (msg) => {
    const amount = msg.amount as number;
    const mult = msg.multiplier as number;
    engine.state.phase = 'CASHED_OUT';
    engine.state.balance = msg.balance as number;
    playerInRound = false;

    engine.state.sessionProfit += amount - engine.state.bet;
    engine.state.sessionRounds++;
    if (!engine.state.bestRun || mult > engine.state.bestRun) engine.state.bestRun = mult;
    engine.state.history.unshift({ mult, result: 'WON', bet: engine.state.bet });
    if (engine.state.history.length > 20) engine.state.history.pop();

    Audio.stopEngine();
    Audio.playCashOut();
    flashScreen('#16A34A', 500);
    showFloatingText('CASHED OUT! +$' + amount.toFixed(2), '#16A34A', W / 2, 350);

    // Switch button back — can queue for next round
    setMainButton('bet');
    setBetControlsEnabled(true);

    $('win-screen').classList.add('visible');
    $('win-amount').textContent = '$' + amount.toFixed(2);
    $('win-mult-val').textContent = mult.toFixed(2) + '×';
    updateBalanceDisplay();
    updateHistory();
    updateStats();

    setTimeout(() => $('win-screen').classList.remove('visible'), 2200);
  });

  // ── Round crashed ──
  client.on('round:crash', (msg) => {
    const crashPoint = msg.crashPoint as number;
    serverRunning = false;
    roadScene.serverRoundRunning = false;

    // Crash effects always (spectating or playing)
    setRoundStatus('crash');
    Audio.stopEngine();
    roadScene.spawnCrashParticles();
    // Keep only the crash obstacle (the last one spawned, closest to Kash)
    if (roadScene.obstacles.length > 0) {
      const last = roadScene.obstacles[roadScene.obstacles.length - 1];
      roadScene.obstacles.length = 0;
      roadScene.obstacles.push(last);
    }
    Audio.playCrash();
    flashScreen('#EF4444', 600);
    showCrashDisplay(crashPoint);

    // Always add crash to history strip
    if (playerInRound && engine.state.phase === 'RUNNING') {
      // Player lost
      engine.state.crashPoint = crashPoint;
      engine.state.phase = 'CRASHED';
      playerInRound = false;

      engine.state.sessionProfit -= engine.state.bet;
      engine.state.sessionRounds++;
      engine.state.history.unshift({ mult: crashPoint, result: 'LOST', bet: engine.state.bet });
    } else {
      // Spectating — still show in history
      engine.state.history.unshift({ mult: crashPoint, result: 'LOST', bet: 0 });
    }
    if (engine.state.history.length > 20) engine.state.history.pop();

    setTimeout(() => {
      updateBalanceDisplay();
      updateHistory();
      updateStats();
    }, 800);

    // Re-enable controls for next round
    if (pendingBet !== null) {
      // Keep queued state
      setMainButton('queued', pendingBet);
      setBetControlsEnabled(false);
    } else {
      setMainButton('bet');
      setBetControlsEnabled(true);
    }
  });

  // ── Obstacles & Kash movement from server ──
  client.on('obstacle:spawn', (msg) => {
    roadScene.obstacles.push({
      type: msg.obstacleType as any,
      rx: msg.lane as number,
      rz: (msg.rz as number) || 0.02,
      speed: 0, color: '#EF4444',
      lanes: msg.lanes as number,
    });
  });

  client.on('kash:move', (msg) => {
    roadScene.riderLane = msg.lane as number;
  });

  client.on('players', (msg) => {
    const realBet = msg.totalBet as number;
    const simBets = realBet + 3000 + Math.floor(Math.random() * 1000);
    $('total-bets').textContent = '$' + simBets.toLocaleString();
  });
}

// ══════════════════════════════════════
//  BUTTON LOGIC
// ══════════════════════════════════════

function onMainButtonClick(): void {
  switch (btnState) {
    case 'bet': placeBet(); break;
    case 'placed':
      // Cancel bet during countdown
      client.cancelBet();
      break;
    case 'cashout': doCashOut(); break;
    case 'queued':
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

  if (client.offline) {
    // Local mode — use engine directly
    if (engine.placeBet(amount)) {
      playerInRound = true;
      updateBalanceDisplay();
      setMainButton('placed', amount);
      setBetControlsEnabled(false);
    }
  } else if (serverRunning || engine.state.phase === 'CRASHED' || engine.state.phase === 'CASHED_OUT') {
    pendingBet = amount;
    setMainButton('queued', amount);
    setBetControlsEnabled(false);
  } else {
    client.placeBet(amount);
  }
}

function doCashOut(): void {
  if (engine.state.phase !== 'RUNNING') return;
  if (client.offline) {
    engine.doCashOut();
  } else {
    client.cashOut();
  }
}

function setMainButton(state: BtnState, amount?: number): void {
  const btn = $('place-bet-btn');
  btnState = state;
  btn.classList.remove('queued', 'cashout-mode', 'placed-mode', 'bet-next-mode');
  btn.style.opacity = '';
  btn.style.pointerEvents = '';

  switch (state) {
    case 'bet': {
      const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
      if (serverRunning) {
        btn.classList.add('bet-next-mode');
        btn.innerHTML = 'BET NEXT ROUND<span style="font-size:13px;font-weight:400;letter-spacing:1px;opacity:0.9;display:block" id="btn-bet-amount">$' + val.toFixed(2) + '</span>';
      } else {
        btn.innerHTML = 'PLACE BET<span style="font-size:13px;font-weight:400;letter-spacing:1px;opacity:0.9;display:block" id="btn-bet-amount">$' + val.toFixed(2) + '</span>';
      }
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
