import { Application } from 'pixi.js';
import { GameEngine } from './game/GameEngine';
import { RoadScene } from './scenes/RoadScene';
import { DialogueSystem } from './kash/DialogueSystem';
import { W, H, roadToScreen } from './scenes/constants';
import * as Audio from './audio/AudioManager';
import './styles/main.css';

// ── Bootstrap ──
const engine = new GameEngine();
const roadScene = new RoadScene();
const dialogue = new DialogueSystem();

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

  const container = document.getElementById('pixi-container')!;
  container.appendChild(app.canvas);
  app.stage.addChild(roadScene.container);

  // ── Game loop ──
  app.ticker.add(() => {
    roadScene.update(engine.state);
  });

  // ── Nitro click on Pixi canvas ──
  app.canvas.addEventListener('click', (e: MouseEvent) => {
    if (engine.state.phase !== 'RUNNING') return;
    const rect = app.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);

    const hit = roadScene.checkNitroHit(mx, my);
    if (hit) {
      hit.collected = true;
      const bonus = engine.collectNitroBonus();
      const { x, y } = roadToScreen(hit.rx, hit.rz);
      showFloatingText(`⚡ NITRO +${bonus.toFixed(1)}×`, '#EA580C', x, y - 20);
      Audio.playNitro();
      flashScreen('#EA580C', 300);
      showKashQuote(dialogue.getRundownLine('nitro'));
    }
  });

  // ── Engine events ──
  engine.on((event) => {
    switch (event.type) {
      case 'MULTIPLIER_UPDATE':
        updateMultiplierUI(event.multiplier, event.profit);
        Audio.updateEngine(event.multiplier);
        break;
      case 'PHASE_CHANGE':
        onPhaseChange(event.phase);
        break;
      case 'BANNER':
        showBanner(event.text);
        break;
      case 'GHOST_MODE':
        flashScreen('#7B2FBE', 1200);
        $('ghost-badge').style.display = 'block';
        showKashQuote(dialogue.getRundownLine('ghost_mode'));
        break;
      case 'ROADBLOCK':
        showRoadblockOverlay();
        Audio.playRoadblock();
        break;
      case 'HELICOPTER_ACTIVATED':
        $('heli-warning').classList.add('visible');
        break;
      case 'CRASH':
        onCrash();
        break;
      case 'CASH_OUT':
        onCashOut(event.amount);
        break;
    }
  });

  // ── Wire up DOM buttons ──
  $('place-bet-btn').addEventListener('click', placeBet);
  $('cashout-btn').addEventListener('click', () => engine.doCashOut());
  $('rb-cashout').addEventListener('click', () => engine.doCashOut());
  $('dodge-left').addEventListener('click', () => onDodge('LEFT'));
  $('dodge-right').addEventListener('click', () => onDodge('RIGHT'));
  $('run-again').addEventListener('click', resetToIdle);
  $('bet-half').addEventListener('click', () => adjustBet(0.5));
  $('bet-double').addEventListener('click', () => adjustBet(2));
  $('auto-toggle').addEventListener('click', toggleAuto);
  $('auto-target').addEventListener('input', (e) => {
    engine.state.autoCashOutTarget = parseFloat((e.target as HTMLInputElement).value) || 2;
  });
  $('bet-input').addEventListener('input', updateBetDisplay);

  // Quick bets
  document.querySelectorAll('.qbet').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = btn.getAttribute('data-amount');
      if (amount === 'max') setBetMax();
      else setBet(parseFloat(amount!));
    });
  });

  // Init UI
  updateBalanceDisplay();
  updateHistory();
  updateStats();
  updateBetDisplay();
}

// ── DOM helpers ──
function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function placeBet(): void {
  const betInput = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
  if (!engine.placeBet(betInput)) {
    if (betInput > engine.state.balance) showFloatingText('Insufficient balance', '#EF4444', W / 2, 500);
    else showFloatingText('Minimum bet: $0.10', '#EF4444', W / 2, 500);
    return;
  }

  $('bet-area').style.display = 'none';
  $('bust-screen').classList.remove('visible');
  ($('place-bet-btn') as HTMLButtonElement).disabled = true;
  updatePhaseBar(1);
  roadScene.clearGameObjects();

  Audio.initAudio();
  startCountdown();
}

function startCountdown(): void {
  const overlay = $('countdown-overlay');
  const numEl = $('countdown-num');
  overlay.classList.add('visible');
  let n = 5;
  numEl.textContent = String(n);
  Audio.playCountdownTick(n);

  const interval = setInterval(() => {
    n--;
    numEl.style.animation = 'none';
    void numEl.offsetHeight;
    numEl.style.animation = 'count-pop 0.4s ease-out';
    numEl.textContent = n > 0 ? String(n) : 'GO!';
    Audio.playCountdownTick(n);

    if (n <= 0) {
      clearInterval(interval);
      setTimeout(() => {
        overlay.classList.remove('visible');
        startRound();
      }, 400);
    }
  }, 1000);
}

function startRound(): void {
  engine.startRound();
  $('cashout-area').style.display = 'block';
  $('profit-display').classList.add('visible');
  Audio.startEngine();
  showKashQuote(dialogue.getRundownLine('round_start'));
}

function onPhaseChange(phase: number): void {
  updatePhaseBar(phase);
  if (phase === 5) {
    $('ghost-badge').style.display = 'block';
  }
}

function onCrash(): void {
  Audio.stopEngine();
  roadScene.spawnCrashParticles();
  Audio.playCrash();
  flashScreen('#EF4444', 600);

  $('cashout-area').style.display = 'none';
  $('heli-warning').classList.remove('visible');
  $('ghost-badge').style.display = 'none';
  $('roadblock-overlay').classList.remove('visible');

  setTimeout(() => {
    $('bust-screen').classList.add('visible');
    $('bust-mult').textContent = engine.state.crashPoint!.toFixed(2) + '×';
    $('bust-crash-val').textContent = engine.state.crashPoint!.toFixed(2) + '×';
    $('bust-bet-val').textContent = '$' + engine.state.bet.toFixed(2);
    $('bust-result-val').textContent = '-$' + engine.state.bet.toFixed(2);
    $('bust-quote').textContent = '"' + dialogue.getBustQuote() + '"';
    updateBalanceDisplay();
    updateHistory();
    updateStats();
  }, 800);
}

function onCashOut(amount: number): void {
  Audio.stopEngine();
  Audio.playCashOut();
  flashScreen('#16A34A', 500);
  showFloatingText('CASHED OUT! +$' + amount.toFixed(2), '#16A34A', W / 2, 350);

  $('cashout-area').style.display = 'none';
  $('heli-warning').classList.remove('visible');
  $('ghost-badge').style.display = 'none';
  $('roadblock-overlay').classList.remove('visible');

  const ws = $('win-screen');
  ws.classList.add('visible');
  $('win-amount').textContent = '$' + amount.toFixed(2);
  $('win-mult-val').textContent = engine.state.multiplier.toFixed(2) + '×';
  updateBalanceDisplay();
  updateHistory();
  updateStats();

  setTimeout(() => {
    ws.classList.remove('visible');
    resetToIdle();
  }, 2200);
}

function onDodge(direction: 'LEFT' | 'RIGHT'): void {
  if (!engine.state.roadblockActive) return;
  clearRoadblockTimer();
  $('roadblock-overlay').classList.remove('visible');

  const success = engine.dodge(direction);
  if (success) {
    showFloatingText('+1.5× DODGE BONUS!', '#16A34A', W / 2, 400);
    Audio.playDodgeSuccess();
    flashScreen('#16A34A', 400);
  } else {
    showFloatingText('WRONG WAY! Penalty pause', '#EF4444', W / 2, 400);
  }
}

let roadblockInterval: ReturnType<typeof setInterval> | null = null;

function showRoadblockOverlay(): void {
  $('roadblock-overlay').classList.add('visible');
  $('rb-cashout-val').textContent = (engine.state.bet * engine.state.multiplier).toFixed(2);

  const timerBar = $('rb-timer-bar');
  const timerSec = $('rb-timer-sec');
  const start = Date.now();

  roadblockInterval = setInterval(() => {
    if (!engine.state.roadblockActive) { clearRoadblockTimer(); return; }
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 2000 - elapsed);
    timerBar.style.width = ((remaining / 2000) * 100) + '%';
    timerSec.textContent = (remaining / 1000).toFixed(1) + 's';
    if (remaining <= 0) {
      clearRoadblockTimer();
      if (engine.state.roadblockActive) {
        $('roadblock-overlay').classList.remove('visible');
        engine.state.roadblockActive = false;
        showFloatingText('TOO SLOW!', '#EF4444', W / 2, 400);
        // Force crash via state
        engine.state.crashPoint = engine.state.multiplier;
      }
    }
  }, 50);
}

function clearRoadblockTimer(): void {
  if (roadblockInterval) { clearInterval(roadblockInterval); roadblockInterval = null; }
}

function resetToIdle(): void {
  engine.resetToIdle();
  clearRoadblockTimer();

  $('bust-screen').classList.remove('visible');
  $('win-screen').classList.remove('visible');
  $('bet-area').style.display = 'flex';
  $('cashout-area').style.display = 'none';
  $('profit-display').classList.remove('visible');
  $('ghost-badge').style.display = 'none';
  $('heli-warning').classList.remove('visible');
  ($('place-bet-btn') as HTMLButtonElement).disabled = false;
  $('multiplier-display').textContent = '1.00×';
  $('multiplier-display').className = '';
  $('roadblock-overlay').classList.remove('visible');
  $('kash-quote').classList.remove('visible');
  updatePhaseBar(1);
  updateBalanceDisplay();
  updateHistory();
  updateStats();
}

// ── UI updates ──

function updateMultiplierUI(m: number, profit: number): void {
  const mEl = $('multiplier-display');
  mEl.textContent = m.toFixed(2) + '×';
  mEl.className = '';
  if (engine.state.chasePhase >= 5) mEl.classList.add('phase5');
  else if (engine.state.chasePhase === 4) mEl.classList.add('phase4');
  else if (engine.state.chasePhase === 3) mEl.classList.add('phase3');

  $('profit-display').textContent = '▲ +$' + profit.toFixed(2);

  const cashoutBtn = $('cashout-btn');
  const cashoutAmt = engine.state.bet * m;
  $('cashout-amount').textContent = '$' + cashoutAmt.toFixed(2);
  cashoutBtn.className = '';
  if (engine.state.chasePhase === 3) cashoutBtn.classList.add('phase3');
  else if (engine.state.chasePhase === 4) cashoutBtn.classList.add('phase4');
  else if (engine.state.chasePhase === 5) cashoutBtn.classList.add('phase5');

  $('rb-cashout-val').textContent = cashoutAmt.toFixed(2);
}

function updateBalanceDisplay(): void {
  $('bal-num').textContent = engine.state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updatePhaseBar(phase: number): void {
  const ids = ['pl1', 'pl2', 'pl3', 'pl4', 'pl5'];
  ids.forEach((id, i) => {
    const el = $(id);
    el.className = 'phase-label';
    if (i + 1 < phase) el.classList.add('done');
    else if (i + 1 === phase) {
      el.classList.add(phase === 5 ? 'ghost-active' : 'active');
    }
  });
}

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
  const val = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
  $('btn-bet-amount').textContent = val.toFixed(2);
}

function setBet(amount: number): void {
  const clamped = Math.min(amount, engine.state.balance);
  ($('bet-input') as HTMLInputElement).value = clamped.toFixed(2);
  updateBetDisplay();
}

function setBetMax(): void {
  setBet(Math.min(engine.state.balance, 500));
}

function adjustBet(factor: number): void {
  const current = parseFloat(($('bet-input') as HTMLInputElement).value) || 10;
  const newVal = Math.max(0.10, Math.min(500, current * factor));
  ($('bet-input') as HTMLInputElement).value = newVal.toFixed(2);
  updateBetDisplay();
}

let autoOn = false;
function toggleAuto(): void {
  autoOn = !autoOn;
  engine.state.autoCashOut = autoOn;
  $('auto-toggle').classList.toggle('on', autoOn);
  $('auto-target').classList.toggle('visible', autoOn);
  $('auto-target-label').classList.toggle('visible', autoOn);
  if (autoOn) engine.state.autoCashOutTarget = parseFloat(($('auto-target') as HTMLInputElement).value) || 2;
}

function showFloatingText(text: string, color: string, x: number, y: number): void {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.color = color;
  el.style.left = (x - 100) + 'px';
  el.style.top = y + 'px';
  el.style.width = '200px';
  el.style.textAlign = 'center';
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
