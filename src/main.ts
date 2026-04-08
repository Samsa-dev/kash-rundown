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
const client = new GameClient('ws://localhost:3001');

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
  await roadScene.loadRiderSprite();

  loadBar.style.width = '70%';
  loadText.textContent = 'Connecting to server...';
  await client.connect();
  wireServerEvents();

  loadBar.style.width = '90%';
  loadText.textContent = 'Setting up...';

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

    // Ensure button is in bet mode and controls enabled
    setMainButton('bet');
    setBetControlsEnabled(true);

    startCountdown(msg.seconds as number);
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
    showFloatingText(msg.reason as string, '#EF4444', W / 2, 500);
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
      Audio.initAudio();
      Audio.startEngine();

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
    roadScene.clearGameObjects();
    Audio.playCrash();
    flashScreen('#EF4444', 600);

    // If player was betting and didn't cash out
    if (playerInRound && engine.state.phase === 'RUNNING') {
      engine.state.crashPoint = crashPoint;
      engine.state.phase = 'CRASHED';
      playerInRound = false;

      engine.state.sessionProfit -= engine.state.bet;
      engine.state.sessionRounds++;
      engine.state.history.unshift({ mult: crashPoint, result: 'LOST', bet: engine.state.bet });
      if (engine.state.history.length > 20) engine.state.history.pop();

      setTimeout(() => {
        $('bust-screen').classList.add('visible');
        $('bust-mult').textContent = crashPoint.toFixed(2) + '×';
        $('bust-crash-val').textContent = crashPoint.toFixed(2) + '×';
        $('bust-bet-val').textContent = '$' + engine.state.bet.toFixed(2);
        $('bust-result-val').textContent = '-$' + engine.state.bet.toFixed(2);
        $('bust-quote').textContent = '"' + dialogue.getBustQuote() + '"';
        updateBalanceDisplay();
        updateHistory();
        updateStats();
      }, 800);
    }

    // Re-enable controls for next round
    setMainButton('bet');
    setBetControlsEnabled(true);
  });

  // ── Obstacles & Kash movement from server ──
  client.on('obstacle:spawn', (msg) => {
    roadScene.obstacles.push({
      type: msg.obstacleType as any,
      rx: msg.lane as number,
      rz: 0.02, speed: 0, color: '#EF4444',
      lanes: msg.lanes as number,
    });
  });

  client.on('kash:move', (msg) => {
    roadScene.riderLane = msg.lane as number;
  });

  client.on('players', () => {});
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

  if (serverRunning) {
    // Round in progress — queue for next
    pendingBet = amount;
    setMainButton('queued', amount);
    setBetControlsEnabled(false);
  } else {
    // Send directly
    client.placeBet(amount);
  }
}

function doCashOut(): void {
  if (engine.state.phase !== 'RUNNING') return;
  client.cashOut();
}

function setMainButton(state: BtnState, amount?: number): void {
  const btn = $('place-bet-btn');
  btnState = state;
  btn.classList.remove('queued', 'cashout-mode', 'placed-mode');
  btn.style.opacity = '';
  btn.style.pointerEvents = '';

  switch (state) {
    case 'bet':
      if (serverRunning) {
        btn.classList.add('queued');
        const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
        btn.innerHTML = 'BET NEXT ROUND — $<span id="btn-bet-amount">' + val.toFixed(2) + '</span>';
      } else {
        const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
        btn.innerHTML = 'PLACE BET — $<span id="btn-bet-amount">' + val.toFixed(2) + '</span>';
      }
      break;
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
  const pnl = engine.state.sessionProfit;
  const pnlEl = $('session-pnl');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
  pnlEl.style.color = pnl >= 0 ? 'var(--go-green)' : 'var(--siren-red)';
  $('round-count').textContent = String(engine.state.sessionRounds);
}

function updateBetDisplay(): void {
  if (btnState === 'bet') {
    const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
    const el = document.getElementById('btn-bet-amount');
    if (el) el.textContent = val.toFixed(2);
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
