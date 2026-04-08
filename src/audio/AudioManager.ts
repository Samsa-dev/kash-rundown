/**
 * Audio manager — procedural Web Audio API sounds.
 * Structured for future Howler.js music track integration.
 */

let audioCtx: AudioContext | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let muted = false;

export function isMuted(): boolean { return muted; }

export function toggleMute(): boolean {
  muted = !muted;
  if (muted && engineGain) engineGain.gain.value = 0;
  if (!muted && engineGain) engineGain.gain.value = 0.03;
  return muted;
}

function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function initAudio(): void {
  getAudio();
}

function playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, delay = 0): void {
  if (muted) return;
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + dur + 0.05);
  } catch (_) { /* audio not available */ }
}

export function playCrash(): void {
  if (muted) return;
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ac.currentTime + 0.9);
    g.gain.setValueAtTime(0.25, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.9);
    osc.start();
    osc.stop(ac.currentTime + 1);
  } catch (_) { /* audio not available */ }
}

export function playCashOut(): void {
  [440, 554, 659, 880].forEach((f, i) => playTone(f, 0.18, 'sine', 0.1, i * 0.07));
}

export function playCountdownTick(n: number): void {
  playTone(n === 0 ? 880 : 440, 0.15, 'square', 0.07);
}

export function playNitro(): void {
  playTone(660, 0.12, 'square', 0.07);
  playTone(990, 0.2, 'sine', 0.08, 0.08);
}

export function playDodgeSuccess(): void {
  playTone(660, 0.1, 'sine', 0.1);
  playTone(880, 0.15, 'sine', 0.1, 0.08);
}

export function playRoadblock(): void {
  playTone(220, 0.08, 'square', 0.12);
  playTone(220, 0.08, 'square', 0.12, 0.12);
}

export function startEngine(): void {
  if (muted) return;
  try {
    const ac = getAudio();
    if (engineOsc) { engineOsc.stop(); engineOsc = null; }
    engineOsc = ac.createOscillator();
    engineGain = ac.createGain();
    engineOsc.connect(engineGain);
    engineGain.connect(ac.destination);
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 65;
    engineGain.gain.value = 0.03;
    engineOsc.start();
  } catch (_) { /* audio not available */ }
}

export function updateEngine(mult: number): void {
  if (!engineOsc || !audioCtx) return;
  try {
    const freq = 65 + Math.log(Math.max(1, mult)) * 35;
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.3);
  } catch (_) { /* audio not available */ }
}

export function stopEngine(): void {
  if (engineOsc) {
    try { engineOsc.stop(); } catch (_) { /* already stopped */ }
    engineOsc = null;
  }
  stopSiren();
}

// ── Siren SFX ──
let sirenOsc: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
let sirenLfo: OscillatorNode | null = null;

export function startSiren(): void {
  if (muted) return;
  try {
    const ac = getAudio();
    if (sirenOsc) stopSiren();

    // Main siren tone
    sirenOsc = ac.createOscillator();
    sirenGain = ac.createGain();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 600;
    sirenGain.gain.value = 0.04;

    // LFO to sweep frequency up/down (classic siren wail)
    sirenLfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 1.5; // sweep speed: 1.5 Hz
    lfoGain.gain.value = 250; // sweep range: ±250 Hz

    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ac.destination);

    sirenOsc.start();
    sirenLfo.start();
  } catch (_) { /* audio not available */ }
}

export function stopSiren(): void {
  try {
    if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; }
    if (sirenLfo) { sirenLfo.stop(); sirenLfo = null; }
    sirenGain = null;
  } catch (_) { /* already stopped */ }
}
