/**
 * RoadScene — Cinematic Cyberpunk Night City
 *
 * Visual direction: Cyberpunk 2077 / Arcane
 * - Deep purple night sky with distant neon city glow
 * - Japanese neon signs (katakana) on buildings
 * - Wet asphalt reflecting siren lights
 * - Street lamps with warm orange pools
 * - Kash as gorilla with snapback, hoodie, gafas on sport bike
 * - 5 phases: dry night → rain → storm → chaos → transcendence
 */

import { Container, Sprite, Texture, Graphics, BlurFilter, ColorMatrixFilter } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import type { GameState, Obstacle, NitroItem, Spark } from '../game/types';
import {
  W, H, HORIZON_Y,
  SIDE_W,
  ROAD_L_BOT, ROAD_R_BOT, ROAD_L_HOR, ROAD_R_HOR,
  roadToScreen,
} from './constants';

// ── Neon sign data (katakana-inspired shapes) ──
const NEON_SIGNS = [
  { text: 'カシュ', color: '#00FF66' },   // KASH
  { text: 'ゲーム', color: '#9945FF' },   // GAME
  { text: '賭け', color: '#00FFAA' },     // BET
  { text: 'ネオン', color: '#7B2FBE' },   // NEON
  { text: '夜', color: '#00FF66' },       // NIGHT
  { text: '速い', color: '#00DD88' },     // FAST
  { text: 'バー', color: '#9945FF' },     // BAR
  { text: '危険', color: '#00FF66' },     // DANGER
];

// ── Building definitions for side facades ──
interface FacadeBuilding {
  height: number;
  floors: number;
  windowCols: number;
  hasNeon: boolean;
  neonIdx: number;
  hasFireEscape: boolean;
  hasAC: boolean;
  baseColor: string;
}

const FACADES: FacadeBuilding[] = [
  { height: 260, floors: 8, windowCols: 4, hasNeon: true,  neonIdx: 0, hasFireEscape: true,  hasAC: false, baseColor: '#0e0520' },
  { height: 340, floors: 11, windowCols: 5, hasNeon: false, neonIdx: 1, hasFireEscape: false, hasAC: true,  baseColor: '#120428' },
  { height: 220, floors: 7, windowCols: 3, hasNeon: true,  neonIdx: 2, hasFireEscape: false, hasAC: false, baseColor: '#160530' },
  { height: 390, floors: 13, windowCols: 4, hasNeon: true,  neonIdx: 3, hasFireEscape: true,  hasAC: true,  baseColor: '#0a0318' },
  { height: 280, floors: 9, windowCols: 5, hasNeon: false, neonIdx: 4, hasFireEscape: true,  hasAC: false, baseColor: '#1a0640' },
  { height: 360, floors: 12, windowCols: 4, hasNeon: true,  neonIdx: 5, hasFireEscape: false, hasAC: true,  baseColor: '#100420' },
  { height: 240, floors: 8, windowCols: 3, hasNeon: true,  neonIdx: 6, hasFireEscape: false, hasAC: false, baseColor: '#180538' },
  { height: 310, floors: 10, windowCols: 5, hasNeon: false, neonIdx: 7, hasFireEscape: true,  hasAC: true,  baseColor: '#0c0320' },
];

const FOG_COLORS: Record<number, string> = {
  1: '#1a0835',
  2: '#1e0a3a',
  3: '#160630',
  4: '#220c40',
  5: '#1c0845',
};

interface RainDrop { x: number; y: number; speed: number; len: number; }

export class RoadScene {
  public container: Container;

  private backgroundSprite: Sprite;
  private videoBgSprite: Sprite | null = null;
  private bgVideoElement: HTMLVideoElement | null = null;
  private effectsBack: Graphics;
  private obstacleGfx: Graphics;
  private pursuerGfx: Graphics;
  private riderContainer: Container;
  private riderGfx: Graphics;
  private riderSprite: Sprite | null = null;
  private riderImageSprite: Sprite | null = null;
  private riderVideoSprite: Sprite | null = null;
  private obstacleTextures: Map<string, Texture> = new Map();
  private obstacleContainer: Container = new Container();
  public useObstacleSprites = true;
  public obstacleScale = 0.15;
  private heliGfx: Graphics;
  private rainGfx: Graphics;
  private sparkGfx: Graphics;
  private effectsFront: Graphics;

  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private bgTexture: Texture;

  private blurFilter: BlurFilter;
  private glowFilter: GlowFilter;
  private colorMatrix: ColorMatrixFilter;
  private currentPhase = 0;
  public skylineFog = true;
  public roadFog = true;

  private rainDrops: RainDrop[] = [];
  public obstacles: Obstacle[] = [];
  public nitros: NitroItem[] = [];
  public sparks: Spark[] = [];
  private crashParticles: Spark[] = [];
  private roadOffset = 0;
  private buildingOffset = 0;
  private sideFacadeOffset = 0;
  private starPositions: { x: number; y: number; size: number; brightness: number }[] = [];
  private lightningTimer = 0;
  private lightningAlpha = 0;
  private laneDashOffset = 0;
  private lampOffset = 0;
  public riderLane = 0;
  public riderDepth = 0.4;
  public serverRoundRunning = false;
  public useVideoBackground = true;
  public speedLineHeight = 5.5;
  public speedLineInner = 100;
  public speedLineOuter = 200;
  public riderScale = 1;
  public riderYOffset = 0;
  private riderLaneActual = 0;
  private riderDepthActual = 0.6;
  private riderLaneSpeed = 0.06;

  constructor() {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = W;
    this.bgCanvas.height = H;
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgTexture = Texture.from(this.bgCanvas);
    this.backgroundSprite = new Sprite(this.bgTexture);

    this.effectsBack = new Graphics();
    this.obstacleGfx = new Graphics();
    this.pursuerGfx = new Graphics();
    this.riderContainer = new Container();
    this.riderGfx = new Graphics();
    this.heliGfx = new Graphics();
    this.rainGfx = new Graphics();
    this.sparkGfx = new Graphics();
    this.effectsFront = new Graphics();

    this.riderContainer.addChild(this.riderGfx);

    // Kash sprite — loaded async via loadRiderSprite()

    this.effectsBack.blendMode = 'normal';
    this.heliGfx.blendMode = 'screen';

    this.blurFilter = new BlurFilter({ strength: 0 });
    this.glowFilter = new GlowFilter({ distance: 1, outerStrength: 0, color: 0x7B2FBE });
    this.colorMatrix = new ColorMatrixFilter();
    this.riderContainer.filters = [this.glowFilter];

    this.container = new Container();
    this.container.addChild(this.backgroundSprite);
    this.container.addChild(this.effectsBack);
    this.container.addChild(this.pursuerGfx);
    this.container.addChild(this.obstacleGfx);
    this.container.addChild(this.obstacleContainer);
    this.container.addChild(this.riderContainer);
    this.container.addChild(this.heliGfx);
    this.container.addChild(this.rainGfx);
    this.container.addChild(this.sparkGfx);
    this.container.addChild(this.effectsFront);

    // Init stars
    for (let i = 0; i < 60; i++) {
      this.starPositions.push({
        x: Math.random() * W,
        y: Math.random() * (HORIZON_Y - 40),
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }

    // Init rain pool
    for (let i = 0; i < 200; i++) {
      this.rainDrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 6 + Math.random() * 6,
        len: 8 + Math.random() * 14,
      });
    }
  }

  update(state: GameState): void {
    const phase = state.chasePhase;
    this.drawBackground(phase, state);
    this.bgTexture.source.update();
    this.updateFilters(phase);

    // Scale video playback speed with phase
    if (this.bgVideoElement) {
      const targetRate = [1.0, 1.2, 1.5, 2.0, 2.5][phase - 1];
      if (Math.abs(this.bgVideoElement.playbackRate - targetRate) > 0.05) {
        this.bgVideoElement.playbackRate = targetRate;
      }
    }
    this.drawEffectsBack(phase);
    this.drawObstaclesPixi(state);
    // this.drawPursuersPixi(phase, state);
    this.updateRiderSprite(state);
    this.drawHelicopterPixi(phase, state);
    this.drawRainPixi(phase, state);
    this.drawSparksPixi(state, phase);
    this.drawEffectsFront(phase, state);
  }

  // ═══════════════════════════════════════════════════════
  //  FILTERS
  // ═══════════════════════════════════════════════════════

  private updateFilters(phase: number): void {
    if (phase === this.currentPhase) return;
    this.currentPhase = phase;

    if (phase === 5) {
      this.backgroundSprite.filters = [this.blurFilter, this.colorMatrix];
      this.blurFilter.strength = 4;
    } else {
      this.backgroundSprite.filters = [this.colorMatrix];
      this.blurFilter.strength = 0;
    }

    this.colorMatrix.reset();
    switch (phase) {
      case 3: this.colorMatrix.tint(0x3355AA, false); break;
      case 4: this.colorMatrix.tint(0x883322, false); break;
      case 5:
        this.colorMatrix.tint(0x5511AA, false);
        this.colorMatrix.brightness(0.8, false);
        break;
    }

    // Colored glow border on Kash per phase
    if (phase >= 5) { this.glowFilter.color = 0xEF4444; this.glowFilter.distance = 20; this.glowFilter.outerStrength = 4; }
    else if (phase >= 4) { this.glowFilter.color = 0xEA580C; this.glowFilter.distance = 15; this.glowFilter.outerStrength = 3; }
    else if (phase >= 3) { this.glowFilter.color = 0xEAB308; this.glowFilter.distance = 10; this.glowFilter.outerStrength = 2; }
    else if (phase >= 2) { this.glowFilter.color = 0x16A34A; this.glowFilter.distance = 6; this.glowFilter.outerStrength = 1; }
    else { this.glowFilter.color = 0x2563EB; this.glowFilter.distance = 4; this.glowFilter.outerStrength = 0.6; }
  }

  // ═══════════════════════════════════════════════════════
  //  BACKGROUND — Canvas2D
  // ═══════════════════════════════════════════════════════

  private drawBackground(phase: number, state: GameState): void {
    const ctx = this.bgCtx;
    ctx.clearRect(0, 0, W, H);

    if (this.videoBgSprite) {
      this.videoBgSprite.visible = this.useVideoBackground;
    }
    if (this.videoBgSprite && this.useVideoBackground) {
      // Video handles sky, buildings, road — only draw overlays
      this.drawRoadOverlays(ctx, phase, state);
    } else {
      // Fallback: full canvas rendering
      this.drawSky(ctx, phase);
      this.drawStars(ctx, phase);
      this.drawDistantSkyline(ctx, phase);
      if (this.skylineFog) this.drawSkylineFog(ctx, phase);
      this.drawRoad(ctx, phase, state);
    }
    if (phase >= 2) this.drawPuddles(ctx, phase);
    if (this.serverRoundRunning) this.drawSirenGlow(phase);
  }

  /** Draw only the overlays on top of the video background */
  private drawRoadOverlays(ctx: CanvasRenderingContext2D, _phase: number, state: GameState): void {
    this.roadOffset = (this.roadOffset + (2 + state.chasePhase * 1.5)) % 60;
  }

  // ── Sky ──

  private drawSky(ctx: CanvasRenderingContext2D, phase: number): void {
    const palettes = [
      ['#020808', '#041210', '#06201a'],      // P1: dark tech night
      ['#030a08', '#051510', '#082818'],      // P2: systems warming
      ['#020610', '#040c18', '#081828'],      // P3: alert mode
      ['#080408', '#120810', '#1a0c18'],      // P4: overload
      ['#040210', '#0a0620', '#140a30'],      // P5: transcendence
    ];
    const colors = palettes[phase - 1] || palettes[0];
    const grd = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 20);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.5, colors[1]);
    grd.addColorStop(1, colors[2]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, HORIZON_Y + 20);

    // Neon green city glow on horizon
    const glowColors = [
      'rgba(0,255,100,0.1)', 'rgba(0,255,100,0.14)',
      'rgba(80,120,255,0.14)', 'rgba(200,50,255,0.16)', 'rgba(140,0,255,0.2)',
    ];
    const hGlow = ctx.createRadialGradient(W / 2, HORIZON_Y, 20, W / 2, HORIZON_Y, 250);
    hGlow.addColorStop(0, glowColors[phase - 1]);
    hGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = hGlow;
    ctx.fillRect(0, HORIZON_Y - 150, W, 200);

    // Lightning flash (Phase 4)
    if (phase === 4) {
      this.lightningTimer++;
      if (this.lightningTimer > 120 + Math.random() * 200) {
        this.lightningAlpha = 0.4 + Math.random() * 0.3;
        this.lightningTimer = 0;
      }
      if (this.lightningAlpha > 0) {
        ctx.fillStyle = `rgba(100,0,255,${this.lightningAlpha})`;
        ctx.fillRect(0, 0, W, HORIZON_Y);
        this.lightningAlpha *= 0.85;
        if (this.lightningAlpha < 0.01) this.lightningAlpha = 0;
      }
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, phase: number): void {
    if (phase >= 3) return; // Clouds hide stars in P3+
    const twinkle = Date.now() / 1000;
    ctx.save();
    for (const s of this.starPositions) {
      const alpha = s.brightness * (0.5 + 0.5 * Math.sin(twinkle * 2 + s.x * 0.1));
      ctx.fillStyle = `rgba(150,255,200,${alpha * (phase === 1 ? 0.5 : 0.25)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Distant Skyline ──

  private drawDistantSkyline(ctx: CanvasRenderingContext2D, phase: number): void {
    this.buildingOffset = (this.buildingOffset + (0.08 + phase * 0.04)) % 10000;

    // Layer 1: far silhouettes (dark, slow)
    this.drawSkylineLayer(ctx, phase, 0.3, 16, 0.4, -0.6);
    // Layer 2: mid buildings (neon accents)
    this.drawSkylineLayer(ctx, phase, 0.7, 20, 0.7, 0);
    // Layer 3: near buildings (detailed)
    this.drawSkylineLayer(ctx, phase, 1.0, 24, 1.0, 0.5);
  }

  /** Short fade at the bottom edge of the skyline so buildings don't cut hard against the road */
  private drawSkylineFog(ctx: CanvasRenderingContext2D, _phase: number): void {
    const grad = ctx.createLinearGradient(0, HORIZON_Y - 30, 0, HORIZON_Y);
    grad.addColorStop(0, 'rgba(4,12,8,0)');
    grad.addColorStop(1, 'rgba(4,12,8,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, HORIZON_Y - 30, W, 30);
  }

  private drawStreetLampsAnimated(ctx: CanvasRenderingContext2D, _phase: number, state: GameState): void {
    const spacing = 0.22;
    const obstacleSpeed = [0.007, 0.012, 0.018, 0.026, 0.042][state.chasePhase - 1];
    {
      const spd = (state.phase === 'RUNNING' || this.serverRoundRunning) ? obstacleSpeed : 0.005;
      this.lampOffset += spd;
      if (this.lampOffset >= spacing) this.lampOffset -= spacing;
    }

    const sides = [
      { topX: ROAD_L_HOR, botX: -200, dir: 1 },
      { topX: ROAD_R_HOR, botX: W + 200, dir: -1 },
    ];

    for (const side of sides) {
      let t = this.lampOffset;
      while (t < 1.05) {
        if (t > 0.05) {
          const x = side.topX + (side.botX - side.topX) * t;
          const y = HORIZON_Y + (H - HORIZON_Y) * t;
          const s = 0.3 + t * 1.2; // scale with perspective

          // Pole
          const poleH = 75 * s;
          ctx.save();
          ctx.strokeStyle = '#1a1a2a';
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - poleH);
          ctx.stroke();

          // Arm extending over road
          const armLen = 12 * s * side.dir;
          ctx.beginPath();
          ctx.moveTo(x, y - poleH);
          ctx.lineTo(x + armLen, y - poleH + 2 * s);
          ctx.stroke();

          // Light bulb glow
          const lx = x + armLen;
          const ly = y - poleH + 2 * s;
          const glowR = 8 * s;
          const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, glowR * 3);
          glow.addColorStop(0, 'rgba(255,180,60,0.35)');
          glow.addColorStop(0.4, 'rgba(255,150,30,0.12)');
          glow.addColorStop(1, 'rgba(255,120,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(lx, ly, glowR * 3, 0, Math.PI * 2);
          ctx.fill();

          // Bulb
          ctx.fillStyle = 'rgba(255,200,80,0.9)';
          ctx.beginPath();
          ctx.arc(lx, ly, 1.5 * s, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
        t += spacing;
      }
    }
  }

  private drawLaneDashes(ctx: CanvasRenderingContext2D, state: GameState): void {
    const obstacleSpeed = [0.007, 0.012, 0.018, 0.026, 0.042][state.chasePhase - 1];
    {
      const dashSpeed = (state.phase === 'RUNNING' || this.serverRoundRunning) ? obstacleSpeed : 0.005;
      this.laneDashOffset = (this.laneDashOffset + dashSpeed) % 1;
    }
    const dashT = 0.06;
    const gapT = 0.08;
    const cycleT = dashT + gapT;

    for (const frac of [1 / 3, 2 / 3]) {
      const topX = ROAD_L_HOR + (ROAD_R_HOR - ROAD_L_HOR) * frac;
      const botX = -200 + (W + 400) * frac;

      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,100,0.35)';

      let t = -(cycleT - this.laneDashOffset % cycleT);
      while (t < 1) {
        const t0 = Math.max(0, t);
        const t1 = Math.min(1, t + dashT);
        if (t1 > t0) {
          const x0 = topX + (botX - topX) * t0;
          const x1 = topX + (botX - topX) * t1;
          const y0 = HORIZON_Y + (H - HORIZON_Y) * t0;
          const y1 = HORIZON_Y + (H - HORIZON_Y) * t1;
          ctx.lineWidth = 0.5 + t0 * 2.5;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        t += cycleT;
      }
      ctx.restore();
    }
  }

  private drawSkylineLayer(ctx: CanvasRenderingContext2D, phase: number, parallax: number, count: number, brightness: number, baseShift: number): void {
    const offset = this.buildingOffset * parallax;
    const neonPalette = ['#00FF66', '#9945FF', '#7B2FBE', '#00FFAA', '#B44DFF', '#9945FF', '#00DD88'];
    const baseDark = Math.floor(brightness * 12);

    const spacing = W / count * 1.3;
    const totalWidth = count * spacing;
    for (let i = 0; i < count + 2; i++) {
      const rawX = i * spacing - offset + baseShift * 50;
      const x = ((rawX % totalWidth) + totalWidth) % totalWidth - spacing;
      const bw = 14 + (i * 7 + 3) % 20;
      const bh = (20 + (i * 13 + 7) % 50) * brightness + 15;
      const by = HORIZON_Y - bh;

      // Building body — dark with purple tint
      const r = baseDark + (i * 3) % 6 + 6;
      const g = baseDark + (i * 2) % 4;
      const b = baseDark + (i * 4) % 8 + 14;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x - bw / 2, by, bw, bh + 2);

      // Windows — green/cyan/purple tint
      if (brightness > 0.5) {
        const rows = Math.floor(bh / 10);
        const cols = Math.max(2, Math.floor(bw / 7));
        const winColors = ['rgba(0,255,100,0.4)', 'rgba(140,80,255,0.4)', 'rgba(180,60,255,0.35)', 'rgba(0,255,150,0.3)', 'rgba(100,0,200,0.4)'];
        for (let wr = 0; wr < rows; wr++) {
          for (let wc = 0; wc < cols; wc++) {
            if (((i * 31 + wr * 7 + wc * 13) % 100) > 45) {
              ctx.fillStyle = winColors[(i * 17 + wr * 11 + wc * 23) % winColors.length];
              const wx = x - bw / 2 + 2 + wc * (bw / cols);
              const wy = by + 3 + wr * 10;
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
      }

      // Neon accent on some buildings — green/purple glow
      if (brightness > 0.6 && i % 3 === 0) {
        const nc = neonPalette[i % neonPalette.length];
        ctx.save();
        // Soft glow halo (wider, transparent) instead of shadowBlur
        ctx.globalAlpha = 0.25 * brightness;
        ctx.fillStyle = nc;
        ctx.fillRect(x - bw / 2 - 1, by + 3, 6, Math.min(bh * 0.4, 25) + 4);
        // Bright core
        ctx.globalAlpha = 0.8 * brightness;
        ctx.fillRect(x - bw / 2 + 1, by + 5, 2, Math.min(bh * 0.4, 25));
        if (i % 2 === 0) {
          ctx.globalAlpha = 0.2 * brightness;
          ctx.fillRect(x - bw / 2, by + bh * 0.3 - 2, bw, 6);
          ctx.globalAlpha = 0.8 * brightness;
          ctx.fillRect(x - bw / 2 + 2, by + bh * 0.3, bw - 4, 2);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Antenna/spire on tall buildings
      if (bh > 55 && i % 4 === 0) {
        ctx.strokeStyle = `rgba(0,${150 + baseDark * 3},${80 + baseDark * 2},0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x, by - 12);
        ctx.stroke();
        // Blinking green light
        if (Math.floor(Date.now() / 800 + i * 100) % 3 === 0) {
          ctx.fillStyle = 'rgba(0,255,100,0.9)';
          ctx.beginPath();
          ctx.arc(x, by - 12, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Side Facades (scrolling buildings on left/right) ──

  private drawSideFacades(ctx: CanvasRenderingContext2D, phase: number, state: GameState): void {
    if (state.phase === 'RUNNING')
      this.sideFacadeOffset = (this.sideFacadeOffset + 1.6 + state.chasePhase * 0.85) % 400;

    this.drawFacadeColumn(ctx, 0, SIDE_W, phase);
    this.drawFacadeColumn(ctx, W - SIDE_W, SIDE_W, phase);
  }

  private drawFacadeColumn(ctx: CanvasRenderingContext2D, startX: number, colW: number, phase: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, 0, colW, H);
    ctx.clip();

    let cycleH = 0;
    for (const f of FACADES) cycleH += f.height + 4;

    for (let cycle = -1; cycle <= 1; cycle++) {
      let y = cycle * cycleH - (this.sideFacadeOffset % cycleH);
      for (let bi = 0; bi < FACADES.length; bi++) {
        const f = FACADES[bi];
        if (y + f.height < 0 || y > H) { y += f.height + 4; continue; }

        // Building body — gradient for depth
        const bodyGrad = ctx.createLinearGradient(startX, y, startX + colW, y);
        bodyGrad.addColorStop(0, f.baseColor);
        bodyGrad.addColorStop(1, this.lightenColor(f.baseColor, 10));
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(startX, y, colW, f.height);

        // Floor lines
        const floorH = f.height / f.floors;
        for (let fl = 1; fl < f.floors; fl++) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(startX, y + fl * floorH, colW, 1);
        }

        // Windows
        const wColStep = colW / f.windowCols;
        const ww = Math.max(4, Math.floor(wColStep * 0.5));
        const wh = Math.max(5, floorH * 0.45);
        const warmColors = ['rgba(255,210,100,0.7)', 'rgba(255,180,80,0.6)', 'rgba(200,230,255,0.5)'];
        const coldColors = ['rgba(80,120,200,0.4)', 'rgba(100,80,180,0.35)', 'rgba(60,60,80,0.2)'];

        for (let fl = 0; fl < f.floors; fl++) {
          for (let wc = 0; wc < f.windowCols; wc++) {
            const lit = ((bi * 31 + fl * 7 + wc * 13) % 100) > 35;
            if (!lit) continue;
            const warm = ((bi * 17 + fl * 11 + wc * 23) % 100) > 40;
            ctx.fillStyle = warm ? warmColors[(bi + fl + wc) % warmColors.length] : coldColors[(bi + fl) % coldColors.length];
            const wx = startX + wc * wColStep + (wColStep - ww) / 2;
            const wy = y + fl * floorH + (floorH - wh) / 2;
            ctx.fillRect(wx, wy, ww, wh);

            // Window glow bleed (warm windows only)
            if (warm && phase <= 2) {
              ctx.fillStyle = 'rgba(255,200,100,0.04)';
              ctx.fillRect(wx - 2, wy - 1, ww + 4, wh + 2);
            }
          }
        }

        // Neon sign
        if (f.hasNeon) {
          const sign = NEON_SIGNS[f.neonIdx % NEON_SIGNS.length];
          ctx.save();
          // Glow halo behind text
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = sign.color;
          ctx.fillRect(startX + 2, y + 6, colW - 4, 18);
          // Text
          ctx.globalAlpha = 1;
          ctx.fillStyle = sign.color;
          ctx.font = '700 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sign.text, startX + colW / 2, y + 16);
          // Glow bar under text
          ctx.fillStyle = sign.color + '66';
          ctx.fillRect(startX + 4, y + 20, colW - 8, 2);
          ctx.restore();
        }

        // Fire escape (zigzag lines)
        if (f.hasFireEscape) {
          ctx.strokeStyle = 'rgba(80,70,90,0.4)';
          ctx.lineWidth = 1;
          for (let fl = 1; fl < Math.min(f.floors, 6); fl++) {
            const fy = y + fl * floorH;
            const side = fl % 2 === 0 ? startX + 2 : startX + colW - 6;
            ctx.beginPath();
            ctx.moveTo(side, fy);
            ctx.lineTo(side + 4, fy + floorH * 0.5);
            ctx.lineTo(side, fy + floorH);
            ctx.stroke();
          }
        }

        // AC units
        if (f.hasAC) {
          ctx.fillStyle = 'rgba(60,55,70,0.6)';
          for (let fl = 2; fl < f.floors; fl += 3) {
            const ax = startX + (fl % 2 === 0 ? colW - 8 : 2);
            ctx.fillRect(ax, y + fl * floorH + 2, 6, 4);
          }
        }

        // Building gap
        ctx.fillStyle = '#030108';
        ctx.fillRect(startX, y + f.height, colW, 4);

        y += f.height + 4;
      }
    }

    // Perspective fade toward horizon
    const fadeGrd = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 60);
    fadeGrd.addColorStop(0, 'rgba(8,2,20,0.97)');
    fadeGrd.addColorStop(0.6, 'rgba(8,2,20,0.4)');
    fadeGrd.addColorStop(1, 'rgba(8,2,20,0)');
    ctx.fillStyle = fadeGrd;
    ctx.fillRect(startX, 0, colW, HORIZON_Y + 60);

    ctx.restore();
  }

  private lightenColor(hex: string, amount: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  // ── Road ──

  private drawRoad(ctx: CanvasRenderingContext2D, phase: number, state: GameState): void {
    // 3 lane trapezoids — dark asphalt with subtle green/purple tint
    const laneColors = ['#0a0e12', '#0c1014', '#0a0e12'];
    const topL = ROAD_L_HOR;
    const topR = ROAD_R_HOR;
    const botL = -200;
    const botR = W + 200;
    for (let i = 0; i < 3; i++) {
      const tL = topL + (topR - topL) * (i / 3);
      const tR = topL + (topR - topL) * ((i + 1) / 3);
      const bL = botL + (botR - botL) * (i / 3);
      const bR = botL + (botR - botL) * ((i + 1) / 3);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tL, HORIZON_Y); ctx.lineTo(tR, HORIZON_Y);
      ctx.lineTo(bR, H); ctx.lineTo(bL, H); ctx.closePath();
      ctx.fillStyle = laneColors[i];
      ctx.fill();
      ctx.restore();
    }

    // Road horizon fog — purple fade at the top of the road
    if (this.roadFog) {
      const fogBase = FOG_COLORS[phase] || FOG_COLORS[1];
      const roadFog = ctx.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + 40);
      roadFog.addColorStop(0, fogBase);
      roadFog.addColorStop(1, fogBase + '00');
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ROAD_L_HOR - 30, HORIZON_Y); ctx.lineTo(ROAD_R_HOR + 30, HORIZON_Y);
      ctx.lineTo(W + 200, HORIZON_Y + 40); ctx.lineTo(-200, HORIZON_Y + 40);
      ctx.closePath();
      ctx.fillStyle = roadFog;
      ctx.fill();
      ctx.restore();
    }

    // Sidewalks — slightly lighter with curb line
    ctx.save();
    const swGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    swGrad.addColorStop(0, '#0c0514');
    swGrad.addColorStop(1, '#08030e');
    ctx.fillStyle = swGrad;
    // Left sidewalk — converges to vanishing point
    const vpX = (ROAD_L_HOR + ROAD_R_HOR) / 2;
    ctx.beginPath(); ctx.moveTo(vpX, HORIZON_Y); ctx.lineTo(0, HORIZON_Y);
    ctx.lineTo(0, H); ctx.lineTo(-200, H); ctx.closePath(); ctx.fill();
    // Right sidewalk
    ctx.beginPath(); ctx.moveTo(vpX, HORIZON_Y); ctx.lineTo(W, HORIZON_Y);
    ctx.lineTo(W, H); ctx.lineTo(W + 200, H); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Curb lines (bright edge between road and sidewalk)
    ctx.save();
    // Soft glow line
    ctx.strokeStyle = 'rgba(0,255,100,0.15)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(-200, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_R_HOR, HORIZON_Y); ctx.lineTo(W + 200, H); ctx.stroke();
    // Bright core
    ctx.strokeStyle = 'rgba(0,255,100,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(-200, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_R_HOR, HORIZON_Y); ctx.lineTo(W + 200, H); ctx.stroke();
    ctx.restore();

    this.roadOffset = (this.roadOffset + (2 + state.chasePhase * 1.5)) % 60;

    // Street lamps along curbs — same speed as lane dashes
    this.drawStreetLampsAnimated(ctx, phase, state);

    // Wet road reflections (Phase 2+)
    if (phase >= 2) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(ROAD_R_HOR, HORIZON_Y);
      ctx.lineTo(ROAD_R_BOT, H); ctx.lineTo(ROAD_L_BOT, H); ctx.closePath();
      const refGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
      refGrad.addColorStop(0, 'transparent');
      const refIntensity = Math.min(0.18, (phase - 1) * 0.05);
      refGrad.addColorStop(0.4, phase >= 4 ? `rgba(140,0,255,${refIntensity})` : `rgba(0,200,100,${refIntensity})`);
      refGrad.addColorStop(0.7, `rgba(0,255,120,${refIntensity * 0.6})`);
      refGrad.addColorStop(1, `rgba(100,0,255,${refIntensity * 0.4})`);
      ctx.fillStyle = refGrad;
      ctx.fill();
      ctx.restore();
    }

    this.drawLaneDashes(ctx, state);

    // Horizon fog — road fades into the skyline
    if (this.roadFog) {
      ctx.save();
      const fogH = 45;
      const fogGrad = ctx.createLinearGradient(0, HORIZON_Y - 5, 0, HORIZON_Y + fogH);
      fogGrad.addColorStop(0, 'rgba(4,12,8,1)');
      fogGrad.addColorStop(0.4, 'rgba(4,12,8,0.85)');
      fogGrad.addColorStop(1, 'rgba(4,12,8,0)');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, HORIZON_Y - 5, W, fogH + 5);
      ctx.restore();
    }
  }

  // ── Street Lamps ──

  private drawStreetLamps(ctx: CanvasRenderingContext2D, phase: number): void {
    const lampPositions = [0.25, 0.45, 0.65, 0.85];
    const glowColor = phase === 5 ? 'rgba(123,47,190,' : 'rgba(255,180,80,';

    for (const rz of lampPositions) {
      for (const side of [-1, 1]) {
        const rx = side * 0.95;
        const { x, y, scale } = roadToScreen(rx, rz);
        if (scale < 0.15) continue;

        // Pole
        const poleH = 40 * scale;
        ctx.strokeStyle = 'rgba(100,90,110,0.6)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - poleH);
        ctx.stroke();

        // Lamp head
        ctx.fillStyle = phase === 5 ? '#7B2FBE' : '#FFB040';
        ctx.beginPath();
        ctx.arc(x + side * 4 * scale, y - poleH, 3 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Light pool on ground
        ctx.save();
        const poolRadius = 30 * scale;
        const poolGrad = ctx.createRadialGradient(x, y + 5, 0, x, y + 5, poolRadius);
        const glowAlpha = phase >= 3 ? 0.04 : 0.08;
        poolGrad.addColorStop(0, glowColor + glowAlpha + ')');
        poolGrad.addColorStop(1, glowColor + '0)');
        ctx.fillStyle = poolGrad;
        ctx.fillRect(x - poolRadius, y + 5 - poolRadius * 0.3, poolRadius * 2, poolRadius * 0.6);
        ctx.restore();
      }
    }
  }

  // ── Puddles ──

  private drawPuddles(ctx: CanvasRenderingContext2D, phase: number): void {
    const puddlePositions = [
      { rx: -0.3, rz: 0.5 }, { rx: 0.4, rz: 0.65 }, { rx: -0.1, rz: 0.8 },
      { rx: 0.25, rz: 0.4 }, { rx: -0.5, rz: 0.7 },
    ];
    const intensity = Math.min(1, (phase - 1) * 0.35);

    for (const p of puddlePositions) {
      const { x, y, scale } = roadToScreen(p.rx, p.rz);
      const pw = 25 * scale;
      const ph = 6 * scale;

      ctx.save();
      // Puddle reflection
      const pGrad = ctx.createRadialGradient(x, y, 0, x, y, pw);
      const sirenCycle = Math.floor(Date.now() / 400) % 2;
      const refColor = phase >= 3
        ? (sirenCycle === 0 ? `rgba(220,40,80,${0.15 * intensity})` : `rgba(37,99,235,${0.15 * intensity})`)
        : `rgba(160,120,200,${0.08 * intensity})`;
      pGrad.addColorStop(0, refColor);
      pGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.ellipse(x, y, pw, ph, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  PIXI LAYERS
  // ═══════════════════════════════════════════════════════

  private drawEffectsBack(phase: number): void {
    this.effectsBack.clear();
    if (!this.serverRoundRunning && phase < 2) return;
    if (phase < 1) return;

    // Siren flash overlay
    const cycle = Math.floor(Date.now() / 300) % 2;
    if (phase >= 2) {
      const color = cycle === 0 ? 0xDC1E50 : 0x2563EB;
      const alpha = phase >= 4 ? 0.1 : 0.06;
      this.effectsBack.rect(0, 0, W, H).fill({ color, alpha });
    }

  }

  private drawSirenGlow(phase: number): void {
    const ctx = this.bgCtx;
    const t = (Math.sin(Date.now() / 150) + 1) / 2;
    const intensity = Math.min(1, 0.5 + phase * 0.15);
    const cy = H * 0.72;
    const radius = 300;

    ctx.save();
    // Red glow — left
    const redGrad = ctx.createRadialGradient(W / 2 - 90, cy, 0, W / 2 - 90, cy, radius);
    redGrad.addColorStop(0, `rgba(239,68,68,${(t * intensity * 0.9).toFixed(2)})`);
    redGrad.addColorStop(0.2, `rgba(239,68,68,${(t * intensity * 0.4).toFixed(2)})`);
    redGrad.addColorStop(0.5, `rgba(239,68,68,${(t * intensity * 0.1).toFixed(2)})`);
    redGrad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = redGrad;
    ctx.fillRect(0, cy - radius, W, radius * 2);

    // Blue glow — right
    const blueGrad = ctx.createRadialGradient(W / 2 + 90, cy, 0, W / 2 + 90, cy, radius);
    blueGrad.addColorStop(0, `rgba(37,99,235,${((1 - t) * intensity * 0.9).toFixed(2)})`);
    blueGrad.addColorStop(0.2, `rgba(37,99,235,${((1 - t) * intensity * 0.4).toFixed(2)})`);
    blueGrad.addColorStop(0.5, `rgba(37,99,235,${((1 - t) * intensity * 0.1).toFixed(2)})`);
    blueGrad.addColorStop(1, 'rgba(37,99,235,0)');
    ctx.fillStyle = blueGrad;
    ctx.fillRect(0, cy - radius, W, radius * 2);
    ctx.restore();
  }

  private drawObstaclesPixi(state: GameState): void {
    this.obstacleGfx.clear();
    this.obstacleGfx.removeChildren();
    this.obstacleContainer.removeChildren();
    const speed = [0.007, 0.012, 0.018, 0.026, 0.042][state.chasePhase - 1];

    this.obstacles = this.obstacles.filter(o => o.rz < 1.15);
    this.obstacles.sort((a, b) => a.rz - b.rz);

    for (const o of this.obstacles) {
      if (state.phase === 'RUNNING' || this.serverRoundRunning) o.rz += speed * (0.2 + o.rz * 1.5);
      const { x, y, scale } = roadToScreen(o.rx, o.rz);

      // Try sprite-based rendering
      const texKey = o.lanes === 2 && o.type === 'flipped_car' ? 'truck' : o.type;
      const tex = this.useObstacleSprites ? this.obstacleTextures.get(texKey) : undefined;

      if (tex) {
        const spr = new Sprite(tex);
        spr.anchor.set(0.5, 0.5);
        spr.x = x;
        spr.y = y;
        const s = this.obstacleScale * scale * (o.lanes === 2 ? 1.6 : 1);
        spr.scale.set(s);
        this.obstacleContainer.addChild(spr);
      } else {
        // Fallback: procedural
        const wide = o.lanes === 2;
        if (o.type === 'police') this.drawPoliceCarPixi(x, y, scale, this.obstacleGfx, o.rx, o.rz);
        else if (o.type === 'barricade') wide ? this.drawBarricadeWidePixi(x, y, scale) : this.drawBarricadePixi(x, y, scale);
        else if (o.type === 'spikes') wide ? this.drawSpikesWidePixi(x, y, scale) : this.drawSpikesPixi(x, y, scale);
        else if (o.type === 'dumpster') this.drawDumpsterPixi(x, y, scale);
        else if (o.type === 'cones') this.drawConesPixi(x, y, scale);
        else if (o.type === 'flipped_car') wide ? this.drawFlippedTruckPixi(x, y, scale) : this.drawFlippedCarPixi(x, y, scale);
      }
    }
  }

  public drawPoliceCarPixi(x: number, y: number, scale: number, g = this.obstacleGfx, rx = 0, rz = 0.5): void {
    const carW = 85;
    const roadH = H - HORIZON_Y;

    // Car height in rz-space, derived from screen height and scale
    const screenH = 135 * scale;
    const halfRz = (screenH / roadH) / 2;
    const rzTop = Math.max(0.005, rz - halfRz);
    const rzBot = Math.min(1, rz + halfRz);

    // Sample the ACTUAL road perspective at top and bottom of car
    const pTop = roadToScreen(rx, rzTop);
    const pBot = roadToScreen(rx, rzBot);

    const wT = carW * pTop.scale / 2;
    const wB = carW * pBot.scale / 2;

    // Lerp helper: fraction 0=top, 1=bot
    const lerpX = (f: number) => pTop.x + (pBot.x - pTop.x) * f;
    const lerpY = (f: number) => pTop.y + (pBot.y - pTop.y) * f;
    const lerpW = (f: number) => wT + (wB - wT) * f;

    // 3D depth offset — side panel height
    const depth = 10 * pBot.scale;
    // Side direction: show the side facing center of road
    const sideDir = rx < -0.1 ? 1 : rx > 0.1 ? -1 : 0;
    const sideOff = depth * sideDir * 0.6;

    // ── Shadow on ground ──
    g.moveTo(pTop.x - wT + 4, pTop.y + 3);
    g.lineTo(pTop.x + wT + 4, pTop.y + 3);
    g.lineTo(pBot.x + wB + 4, pBot.y + 3);
    g.lineTo(pBot.x - wB + 4, pBot.y + 3);
    g.closePath();
    g.fill({ color: 0x000000, alpha: 0.25 });

    // ── Side panel (visible side of the car) ──
    if (sideDir !== 0) {
      const sign = sideDir > 0 ? 1 : -1;
      // Right side visible (sideDir=1) → draw on right edge
      // Left side visible (sideDir=-1) → draw on left edge
      const edgeTopX = sign > 0 ? pTop.x + wT : pTop.x - wT;
      const edgeBotX = sign > 0 ? pBot.x + wB : pBot.x - wB;
      g.moveTo(edgeTopX, pTop.y);
      g.lineTo(edgeTopX + sideOff, pTop.y - depth);
      g.lineTo(edgeBotX + sideOff, pBot.y - depth);
      g.lineTo(edgeBotX, pBot.y);
      g.closePath();
      g.fill({ color: 0x060614 });

      // Side windows
      const sw1f = 0.15, sw2f = 0.55;
      const seTop1 = sign > 0 ? lerpX(sw1f) + lerpW(sw1f) : lerpX(sw1f) - lerpW(sw1f);
      const seBot1 = sign > 0 ? lerpX(sw2f) + lerpW(sw2f) : lerpX(sw2f) - lerpW(sw2f);
      g.moveTo(seTop1 + 2 * sign, lerpY(sw1f));
      g.lineTo(seTop1 + sideOff * 0.8 + 2 * sign, lerpY(sw1f) - depth * 0.8);
      g.lineTo(seBot1 + sideOff * 0.8 + 2 * sign, lerpY(sw2f) - depth * 0.8);
      g.lineTo(seBot1 + 2 * sign, lerpY(sw2f));
      g.closePath();
      g.fill({ color: 0x88BBFF, alpha: 0.15 });
    }

    // ── Top face (roof) — offset upward for 3D ──
    g.moveTo(pTop.x - wT + sideOff, pTop.y - depth);
    g.lineTo(pTop.x + wT + sideOff, pTop.y - depth);
    g.lineTo(pBot.x + wB + sideOff, pBot.y - depth);
    g.lineTo(pBot.x - wB + sideOff, pBot.y - depth);
    g.closePath();
    g.fill({ color: 0x0A0A2A });

    // Front edge (connects top face to ground at front)
    g.moveTo(pTop.x - wT, pTop.y);
    g.lineTo(pTop.x + wT, pTop.y);
    g.lineTo(pTop.x + wT + sideOff, pTop.y - depth);
    g.lineTo(pTop.x - wT + sideOff, pTop.y - depth);
    g.closePath();
    g.fill({ color: 0x080820 });

    // ── Details on top face ──
    // Roof/cabin (frac 0.06 to 0.4)
    const r1 = 0.06, r2 = 0.4;
    const rw1 = lerpW(r1) * 0.7, rw2 = lerpW(r2) * 0.7;
    g.moveTo(lerpX(r1) - rw1 + sideOff, lerpY(r1) - depth);
    g.lineTo(lerpX(r1) + rw1 + sideOff, lerpY(r1) - depth);
    g.lineTo(lerpX(r2) + rw2 + sideOff, lerpY(r2) - depth);
    g.lineTo(lerpX(r2) - rw2 + sideOff, lerpY(r2) - depth);
    g.closePath();
    g.fill({ color: 0x000000, alpha: 0.3 });

    // White stripe (frac 0.35 to 0.42)
    const s1 = 0.35, s2 = 0.42;
    const sw1 = lerpW(s1) * 0.95, sw2 = lerpW(s2) * 0.95;
    g.moveTo(lerpX(s1) - sw1 + sideOff, lerpY(s1) - depth);
    g.lineTo(lerpX(s1) + sw1 + sideOff, lerpY(s1) - depth);
    g.lineTo(lerpX(s2) + sw2 + sideOff, lerpY(s2) - depth);
    g.lineTo(lerpX(s2) - sw2 + sideOff, lerpY(s2) - depth);
    g.closePath();
    g.fill({ color: 0xFFFFFF, alpha: 0.7 });

    // Light bar — flashing at front
    const sc = Math.floor(Date.now() / 150) % 2 === 0;
    const lbX = lerpX(0.01) + sideOff;
    const lbY = lerpY(0.01) - depth;
    const lbW = wT * 0.8;
    const lbH = 6 * pTop.scale;
    g.rect(lbX - lbW, lbY, lbW - 1, lbH)
      .fill({ color: sc ? 0xEF4444 : 0x2563EB });
    g.rect(lbX + 1, lbY, lbW - 1, lbH)
      .fill({ color: sc ? 0x2563EB : 0xEF4444 });

    // Tail lights at rear
    const tlS = pBot.scale * 3;
    g.rect(pBot.x - wB + 3 * pBot.scale + sideOff, pBot.y - 5 * pBot.scale - depth, tlS * 1.5, tlS)
      .fill({ color: 0xFF2200, alpha: 0.8 });
    g.rect(pBot.x + wB - 3 * pBot.scale - tlS * 1.5 + sideOff, pBot.y - 5 * pBot.scale - depth, tlS * 1.5, tlS)
      .fill({ color: 0xFF2200, alpha: 0.8 });

    // Headlights glow
    g.circle(pBot.x - wB + 5 * pBot.scale + sideOff, pBot.y - 3 * pBot.scale - depth, 3 * pBot.scale)
      .fill({ color: 0xFFFFCC, alpha: 0.6 });
    g.circle(pBot.x + wB - 5 * pBot.scale + sideOff, pBot.y - 3 * pBot.scale - depth, 3 * pBot.scale)
      .fill({ color: 0xFFFFCC, alpha: 0.6 });
  }

  /** Draw a car-type obstacle with perspective rotation using a child Graphics */
  private drawCarRotated(
    x: number, y: number, scale: number, angle: number,
    drawFn: (x: number, y: number, scale: number, g: Graphics) => void,
  ): void {
    const child = new Graphics();
    child.position.set(x, y);
    child.rotation = angle;
    drawFn(0, 0, scale, child);
    this.obstacleGfx.addChild(child);
  }

  // ══ 2-LANE VARIANTS ══

  // ── Barricada doble — longer, more stripes, 3 lights ──
  public drawBarricadeWidePixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 240 * scale, h = 45 * scale;
    g.roundRect(x - w / 2, y - h / 2, w, h, 4 * scale).fill({ color: 0xCC0000 });
    // White stripes — more of them
    for (let i = 0; i < 7; i++) {
      g.rect(x - w / 2 + (i * 2 + 1) * (w / 14), y - h / 2, w / 14, h)
        .fill({ color: 0xFFFFFF, alpha: 0.85 });
    }
    // 3 flashing lights
    const flash = Math.floor(Date.now() / 200) % 2 === 0;
    g.circle(x - w / 3, y - h / 2 - 5 * scale, 3.5 * scale)
      .fill({ color: flash ? 0xFF0000 : 0x330000 });
    g.circle(x, y - h / 2 - 5 * scale, 3.5 * scale)
      .fill({ color: flash ? 0x330000 : 0xFF0000 });
    g.circle(x + w / 3, y - h / 2 - 5 * scale, 3.5 * scale)
      .fill({ color: flash ? 0xFF0000 : 0x330000 });
    // Support legs — 3
    g.rect(x - w / 2 + 5 * scale, y + h / 2, 3 * scale, 9 * scale).fill({ color: 0x444444 });
    g.rect(x - 1.5 * scale, y + h / 2, 3 * scale, 9 * scale).fill({ color: 0x444444 });
    g.rect(x + w / 2 - 8 * scale, y + h / 2, 3 * scale, 9 * scale).fill({ color: 0x444444 });
  }

  // ── Spike strip doble — more spikes, wider ──
  public drawSpikesWidePixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 210 * scale, h = 14 * scale;
    g.roundRect(x - w / 2, y - h / 2, w, h, 2 * scale).fill({ color: 0x222222 });
    const spikeCount = 15;
    for (let i = 0; i < spikeCount; i++) {
      const sx = x - w / 2 + (i + 0.5) * (w / spikeCount);
      g.moveTo(sx - 2 * scale, y + h / 2);
      g.lineTo(sx, y - h * 1.3);
      g.lineTo(sx + 2 * scale, y + h / 2);
      g.fill({ color: 0xCCCCCC, alpha: 0.9 });
    }
    // Warning yellow edges + center marker
    g.rect(x - w / 2, y - h / 2, 4 * scale, h).fill({ color: 0xEAB308, alpha: 0.8 });
    g.rect(x + w / 2 - 4 * scale, y - h / 2, 4 * scale, h).fill({ color: 0xEAB308, alpha: 0.8 });
    g.rect(x - 2 * scale, y - h / 2, 4 * scale, h).fill({ color: 0xEAB308, alpha: 0.5 });
  }

  // ── Camión volcado (replaces flipped car at 2 lanes) ──
  public drawFlippedTruckPixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 220 * scale, h = 70 * scale;
    // Truck body on its side
    g.roundRect(x - w / 2, y - h / 2, w, h, 5 * scale).fill({ color: 0x2A2A3A });
    // Cargo area — darker panel
    g.rect(x - w / 2 + 8 * scale, y - h / 2 + 3 * scale, w * 0.55, h - 6 * scale)
      .fill({ color: 0x1A1A28 });
    // Cab section
    g.roundRect(x + w / 2 - 28 * scale, y - h / 2 + 2 * scale, 24 * scale, h - 4 * scale, 3 * scale)
      .fill({ color: 0x333345 });
    // Broken windshield on cab
    g.rect(x + w / 2 - 26 * scale, y - h / 2 + 5 * scale, 10 * scale, h * 0.5)
      .fill({ color: 0x88BBFF, alpha: 0.15 });
    // Undercarriage
    g.rect(x - w / 2 + 10 * scale, y + h / 2 - 3 * scale, w - 20 * scale, 5 * scale)
      .fill({ color: 0x111111 });
    // 3 pairs of wheels
    for (const wx of [-w / 3, 0, w / 3]) {
      g.circle(x + wx, y + h / 2 + 3 * scale, 8 * scale).fill({ color: 0x111111 });
      g.circle(x + wx, y + h / 2 + 3 * scale, 5 * scale).fill({ color: 0x2A2A2A });
    }
    // Smoke/fire
    const t = Date.now() / 300;
    g.circle(x - w / 4, y - h / 2 - 6 * scale, (5 + Math.sin(t) * 2) * scale)
      .fill({ color: 0x444444, alpha: 0.35 });
    g.circle(x - w / 4 + 8 * scale, y - h / 2 - 10 * scale, (4 + Math.sin(t + 1) * 2) * scale)
      .fill({ color: 0x333333, alpha: 0.25 });
    // Hazard stripes on cargo
    for (let i = 0; i < 3; i++) {
      g.rect(x - w / 2 + 12 * scale + i * 18 * scale, y - h / 2 + 4 * scale, 6 * scale, h - 8 * scale)
        .fill({ color: 0xEAB308, alpha: 0.15 });
    }
  }

  // ── Charco eléctrico grande — wider puddle, more sparks, downed power line ──
  public drawElectricPuddleWidePixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    // Larger puddle
    g.ellipse(x, y, 110 * scale, 30 * scale).fill({ color: 0x1A3050, alpha: 0.6 });
    g.ellipse(x, y, 88 * scale, 22 * scale).fill({ color: 0x2A5080, alpha: 0.4 });
    // Downed power line cable — jagged
    g.moveTo(x - 85 * scale, y - 3 * scale);
    g.lineTo(x - 45 * scale, y + 4 * scale);
    g.lineTo(x - 10 * scale, y - 2 * scale);
    g.lineTo(x + 30 * scale, y + 5 * scale);
    g.lineTo(x + 60 * scale, y - 1 * scale);
    g.lineTo(x + 90 * scale, y + 3 * scale);
    g.stroke({ color: 0x222222, width: 4 * scale });
    // Animated sparks — 9 points
    const t = Date.now() / 80;
    for (let i = 0; i < 9; i++) {
      const angle = (t + i * 40) % 360 * (Math.PI / 180);
      const dist = (30 + Math.sin(t * 0.1 + i) * 16) * scale;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist * 0.3;
      const sparkSize = (3 + Math.sin(t * 0.3 + i * 2) * 1.5) * scale;
      g.circle(sx, sy, sparkSize).fill({ color: 0x00DDFF, alpha: 0.7 + Math.sin(t * 0.2 + i) * 0.3 });
    }
    // Three glow points
    const glowAlpha = 0.3 + Math.sin(t * 0.15) * 0.2;
    g.circle(x - 35 * scale, y, 10 * scale).fill({ color: 0x00AAFF, alpha: glowAlpha });
    g.circle(x, y, 10 * scale).fill({ color: 0x00AAFF, alpha: glowAlpha * 0.9 });
    g.circle(x + 35 * scale, y, 10 * scale).fill({ color: 0x00AAFF, alpha: glowAlpha * 0.8 });
  }

  // ── Barricada policial ──
  public drawBarricadePixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 130 * scale, h = 40 * scale;
    // Base barrier — striped red/white
    g.roundRect(x - w / 2, y - h / 2, w, h, 3 * scale).fill({ color: 0xCC0000 });
    // White stripes
    for (let i = 0; i < 4; i++) {
      g.rect(x - w / 2 + (i * 2 + 1) * (w / 8), y - h / 2, w / 8, h)
        .fill({ color: 0xFFFFFF, alpha: 0.85 });
    }
    // Flashing lights on top
    const flash = Math.floor(Date.now() / 200) % 2 === 0;
    g.circle(x - w / 3, y - h / 2 - 4 * scale, 3 * scale)
      .fill({ color: flash ? 0xFF0000 : 0x330000 });
    g.circle(x + w / 3, y - h / 2 - 4 * scale, 3 * scale)
      .fill({ color: flash ? 0x330000 : 0xFF0000 });
    // Support legs
    g.rect(x - w / 2 + 4 * scale, y + h / 2, 3 * scale, 8 * scale).fill({ color: 0x444444 });
    g.rect(x + w / 2 - 7 * scale, y + h / 2, 3 * scale, 8 * scale).fill({ color: 0x444444 });
  }

  // ── Spike strip ──
  public drawSpikesPixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 110 * scale, h = 12 * scale;
    // Base strip
    g.roundRect(x - w / 2, y - h / 2, w, h, 2 * scale).fill({ color: 0x222222 });
    // Spikes
    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
      const sx = x - w / 2 + (i + 0.5) * (w / spikeCount);
      g.moveTo(sx - 2 * scale, y + h / 2);
      g.lineTo(sx, y - h * 1.2);
      g.lineTo(sx + 2 * scale, y + h / 2);
      g.fill({ color: 0xCCCCCC, alpha: 0.9 });
    }
    // Warning yellow edges
    g.rect(x - w / 2, y - h / 2, 4 * scale, h).fill({ color: 0xEAB308, alpha: 0.8 });
    g.rect(x + w / 2 - 4 * scale, y - h / 2, 4 * scale, h).fill({ color: 0xEAB308, alpha: 0.8 });
  }

  // ── Contenedor de basura ──
  public drawDumpsterPixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 75 * scale, h = 60 * scale;
    // Body — dark green metal
    g.roundRect(x - w / 2, y - h / 2, w, h, 3 * scale).fill({ color: 0x1A5C2A });
    // Lid — slightly lighter, tilted
    g.roundRect(x - w / 2 - 2 * scale, y - h / 2 - 4 * scale, w + 4 * scale, 6 * scale, 2 * scale)
      .fill({ color: 0x237A36 });
    // Side ridges
    g.rect(x - w / 2 + 3 * scale, y - h / 2 + 5 * scale, 2 * scale, h - 10 * scale)
      .fill({ color: 0x0F4A1E, alpha: 0.6 });
    g.rect(x + w / 2 - 5 * scale, y - h / 2 + 5 * scale, 2 * scale, h - 10 * scale)
      .fill({ color: 0x0F4A1E, alpha: 0.6 });
    // Wheels
    g.circle(x - w / 3, y + h / 2 + 2 * scale, 3 * scale).fill({ color: 0x111111 });
    g.circle(x + w / 3, y + h / 2 + 2 * scale, 3 * scale).fill({ color: 0x111111 });
  }

  // ── Conos de construcción ──
  public drawConesPixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const positions = [-45, -15, 15, 45];
    for (const off of positions) {
      const cx = x + off * scale;
      const coneH = 42 * scale;
      // Cone body — orange triangle
      g.moveTo(cx, y - coneH);
      g.lineTo(cx - 14 * scale, y);
      g.lineTo(cx + 14 * scale, y);
      g.fill({ color: 0xEA580C });
      // White stripe
      g.rect(cx - 10 * scale, y - coneH * 0.5, 20 * scale, 5 * scale)
        .fill({ color: 0xFFFFFF, alpha: 0.85 });
      // Base
      g.rect(cx - 16 * scale, y, 32 * scale, 5 * scale)
        .fill({ color: 0xEA580C, alpha: 0.7 });
    }
  }

  // ── Carro volcado ──
  public drawFlippedCarPixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    const w = 120 * scale, h = 55 * scale;
    // Car body on its side — tilted
    g.roundRect(x - w / 2, y - h / 2, w, h, 4 * scale).fill({ color: 0x3A3A4A });
    // Undercarriage visible
    g.rect(x - w / 2 + 6 * scale, y + h / 2 - 3 * scale, w - 12 * scale, 5 * scale)
      .fill({ color: 0x1A1A1A });
    // Exposed wheels (on side)
    g.circle(x - w / 4, y + h / 2 + 2 * scale, 7 * scale).fill({ color: 0x111111 });
    g.circle(x - w / 4, y + h / 2 + 2 * scale, 4 * scale).fill({ color: 0x333333 });
    g.circle(x + w / 4, y + h / 2 + 2 * scale, 7 * scale).fill({ color: 0x111111 });
    g.circle(x + w / 4, y + h / 2 + 2 * scale, 4 * scale).fill({ color: 0x333333 });
    // Broken windshield
    g.rect(x - w / 2 + 4 * scale, y - h / 2 + 3 * scale, w * 0.35, h - 6 * scale)
      .fill({ color: 0x88BBFF, alpha: 0.2 });
    // Smoke/damage marks
    g.circle(x + w / 4, y - h / 2 - 4 * scale, 5 * scale).fill({ color: 0x444444, alpha: 0.3 });
    g.circle(x + w / 4 + 3 * scale, y - h / 2 - 8 * scale, 4 * scale).fill({ color: 0x333333, alpha: 0.2 });
  }

  // ── Charco eléctrico ──
  public drawElectricPuddlePixi(x: number, y: number, scale: number, g = this.obstacleGfx): void {
    // Water puddle
    g.ellipse(x, y, 60 * scale, 22 * scale).fill({ color: 0x1A3050, alpha: 0.6 });
    g.ellipse(x, y, 48 * scale, 16 * scale).fill({ color: 0x2A5080, alpha: 0.4 });
    // Sparking cable
    g.rect(x - 30 * scale, y - 2 * scale, 60 * scale, 3 * scale)
      .fill({ color: 0x222222 });
    // Animated sparks
    const t = Date.now() / 80;
    for (let i = 0; i < 5; i++) {
      const angle = (t + i * 72) % 360 * (Math.PI / 180);
      const dist = (18 + Math.sin(t * 0.1 + i) * 10) * scale;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist * 0.4;
      const sparkSize = (2.5 + Math.sin(t * 0.3 + i * 2) * 1.5) * scale;
      g.circle(sx, sy, sparkSize).fill({ color: 0x00DDFF, alpha: 0.7 + Math.sin(t * 0.2 + i) * 0.3 });
    }
    // Central glow
    const glowAlpha = 0.3 + Math.sin(t * 0.15) * 0.2;
    g.circle(x, y, 10 * scale).fill({ color: 0x00AAFF, alpha: glowAlpha });
  }

  private drawPursuersPixi(phase: number, state: GameState): void {
    this.pursuerGfx.clear();
    if (phase < 4 || state.phase === 'IDLE' || state.phase === 'COUNTDOWN') return;

    const bounce = Math.sin(Date.now() / 180) * 3;
    const draw = (rx: number, rz: number, yOff: number) => {
      const p = roadToScreen(rx, rz);
      this.drawPoliceCarPixi(p.x, p.y + yOff, p.scale, this.pursuerGfx, rx, rz);
    };
    // Phase 3+: one car
    draw(0, 0.62, bounce);
  }

  // ── Kash Rider (sprite) ──

  async loadObstacleSprites(): Promise<void> {
    const { Assets } = await import('pixi.js');
    const map: Record<string, string> = {
      'barricade': '/assets/obstacle-barricade.webp',
      'dumpster': '/assets/obstacle-dumpster.webp',
      'cones': '/assets/obstacle-cones.webp',
      'flipped_car': '/assets/obstacle-flipped-car.webp',
      'spikes': '/assets/obstacle-spikes.webp',
      'police': '/assets/obstacle-police.webp',
      'truck': '/assets/obstacle-truck.webp',
      'manhole': '/assets/obstacle-manhole.webp',
      'police_alt': '/assets/obstacle-police-alt.webp',
    };
    for (const [key, src] of Object.entries(map)) {
      const tex = await Assets.load({ src, data: { scaleMode: 'linear', autoGenerateMipmaps: true } });
      this.obstacleTextures.set(key, tex);
    }
  }

  async loadVideoBackground(): Promise<void> {
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    // WebM for Chrome/Firefox, MP4 fallback for Safari
    const webm = video.canPlayType('video/webm; codecs="vp9"');
    video.src = webm ? '/assets/road-bg.webm' : '/assets/road-bg.mp4';
    await video.play();

    const { VideoSource } = await import('pixi.js');
    const videoSource = new VideoSource({ resource: video, autoPlay: true });
    const texture = new Texture({ source: videoSource });
    this.videoBgSprite = new Sprite(texture);
    this.videoBgSprite.width = W;
    this.videoBgSprite.height = H;
    this.bgVideoElement = video;
    this.container.addChildAt(this.videoBgSprite, 0);
  }

  async loadRiderSprite(): Promise<void> {
    const { Assets, VideoSource } = await import('pixi.js');

    // Detect Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Load image version (always needed as fallback)
    const imgTexture = await Assets.load({
      src: '/assets/kash-en-moto.webp',
      data: { scaleMode: 'linear', autoGenerateMipmaps: true },
    });
    this.riderImageSprite = new Sprite(imgTexture);
    this.riderImageSprite.anchor.set(0.5, 1);

    if (!isSafari) {
      // Load video version for Chrome/Firefox
      try {
        const video = document.createElement('video');
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        const webm = video.canPlayType('video/webm; codecs="vp9"');
        video.src = webm ? '/assets/kash-rider.webm' : '/assets/kash-rider.mp4';
        await video.play();
        const videoSource = new VideoSource({ resource: video, autoPlay: true });
        this.riderVideoSprite = new Sprite(new Texture({ source: videoSource }));
        this.riderVideoSprite.anchor.set(0.5, 0.5);
        // Alpha channel in WebM handles transparency

        this.riderImageSprite.visible = false;
        this.riderContainer.addChild(this.riderVideoSprite);
        this.riderContainer.addChild(this.riderImageSprite);
        this.riderSprite = this.riderVideoSprite;
      } catch {
        // Video failed — use image
        this.riderContainer.addChild(this.riderImageSprite);
        this.riderSprite = this.riderImageSprite;
      }
    } else {
      // Safari — use image only
      this.riderContainer.addChild(this.riderImageSprite);
      this.riderSprite = this.riderImageSprite;
    }
  }

  setRiderVideo(useVideo: boolean): void {
    if (!this.riderVideoSprite || !this.riderImageSprite) return;
    this.riderVideoSprite.visible = useVideo;
    this.riderImageSprite.visible = !useVideo;
    this.riderSprite = useVideo ? this.riderVideoSprite : this.riderImageSprite;
  }

  private updateRiderSprite(state: GameState): void {
    if (!this.riderSprite) return;

    // Animate toward target lane — faster in higher phases
    const laneSpeed = 0.08 + state.chasePhase * 0.03;
    const diff = this.riderLane - this.riderLaneActual;
    if (Math.abs(diff) > 0.001) {
      this.riderLaneActual += diff * laneSpeed;
    } else {
      this.riderLaneActual = this.riderLane;
    }

    // Animate toward target depth
    const depthDiff = this.riderDepth - this.riderDepthActual;
    if (Math.abs(depthDiff) > 0.001) {
      this.riderDepthActual += depthDiff * 0.04;
    } else {
      this.riderDepthActual = this.riderDepth;
    }

    const rz = this.riderDepthActual;
    const sway = Math.sin(Date.now() / 700) * 0.02;
    const p = roadToScreen(this.riderLaneActual + sway, rz);

    // Scale — normalize to 390px base width so image and video match
    const texW = this.riderSprite.texture.width || 390;
    const baseScale = 390 / texW;
    // Image is taller than video — scale down further if using image
    const heightFactor = this.riderSprite === this.riderImageSprite ? 0.5 : 1;
    const spriteScale = this.riderScale * p.scale * baseScale * heightFactor;

    // Tilt during lane change
    const tilt = -(this.riderLane - this.riderLaneActual) * 1.2;
    const maxTilt = 0.25;
    this.riderSprite.rotation = Math.max(-maxTilt, Math.min(maxTilt, tilt));

    this.riderSprite.x = p.x;
    this.riderSprite.y = p.y + this.riderYOffset;
    this.riderSprite.scale.set(spriteScale);

    // Darken Kash when it rains + siren color tint (phase 2+)
    const phase = state.chasePhase;
    if (phase >= 2) {
      const dim = 1 - Math.min(0.35, (phase - 1) * 0.1);
      const cycle = Math.floor(Date.now() / 300) % 2;
      const sirenStrength = phase >= 4 ? 0.15 : 0.08;
      let r = dim, g = dim, b = dim;
      if (cycle === 0) { r = Math.min(1, dim + sirenStrength); } // red flash
      else { b = Math.min(1, dim + sirenStrength); } // blue flash
      this.riderSprite.tint = (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
    } else {
      this.riderSprite.tint = 0xFFFFFF;
    }

    // Sparks from tire during lane change
    if (Math.abs(diff) > 0.01) {
      const sparkCount = Math.min(3, Math.ceil(Math.abs(diff) * 8));
      for (let i = 0; i < sparkCount; i++) {
        this.sparks.push({
          x: p.x + (Math.random() - 0.5) * 20 * p.scale,
          y: p.y - 2,
          vx: -diff * 15 + (Math.random() - 0.5) * 4,
          vy: (Math.random() * 3) - 1,
          life: 1,
          size: 1.5 + Math.random() * 2.5,
          color: ['#ff8800', '#ffaa00', '#ffdd00', '#ffffff'][Math.floor(Math.random() * 4)],
        });
      }
    }
  }

  // ── Kash Rider (old procedural — kept for reference) ──

  private drawRiderPixi_old(phase: number, state: GameState): void {
    this.riderGfx.clear();
    const cx = W / 2;
    const cy = 555;
    const S = 2.1;
    const sway = Math.sin(Date.now() / 700) * (phase === 1 ? 4 : 2);
    const px = cx + sway;

    // ── Motorbike ──
    // Rear tire
    this.riderGfx.ellipse(px, cy + 34 * S, 30 * S, 11 * S).fill({ color: 0x111111 });
    this.riderGfx.ellipse(px, cy + 34 * S, 30 * S, 11 * S).stroke({ color: 0x333333, width: 3 });
    this.riderGfx.ellipse(px, cy + 34 * S, 22 * S, 8 * S).stroke({ color: 0x222222, width: 1 });

    // Bike body — sport bike silhouette
    this.riderGfx.roundRect(px - 24 * S, cy - 16 * S, 48 * S, 50 * S, 8 * S).fill({ color: 0x0C0C1A });
    // Tank/seat area
    this.riderGfx.roundRect(px - 18 * S, cy - 12 * S, 36 * S, 38 * S, 6 * S).fill({ color: 0x151525 });
    // Orange accent stripe on bike
    this.riderGfx.rect(px - 20 * S, cy + 5 * S, 40 * S, 3 * S).fill({ color: 0xEA580C, alpha: 0.7 });

    // Exhaust pipes
    this.riderGfx.moveTo(px - 26 * S, cy + 10 * S).lineTo(px - 34 * S, cy + 30 * S)
      .stroke({ color: 0x555555, width: 5 * S, cap: 'round' });
    this.riderGfx.moveTo(px + 26 * S, cy + 10 * S).lineTo(px + 34 * S, cy + 30 * S)
      .stroke({ color: 0x555555, width: 5 * S, cap: 'round' });

    // Tail light — bright red glow
    this.riderGfx.rect(px - 14 * S, cy - 19 * S, 28 * S, 5 * S).fill({ color: 0xFF1100 });
    this.riderGfx.rect(px - 18 * S, cy - 20 * S, 36 * S, 7 * S).fill({ color: 0xFF0000, alpha: 0.15 });

    // ── Kash (gorilla) ──
    const lean = phase >= 3 ? 0.12 : phase >= 2 ? 0.06 : 0;

    // Torso — broad, gorilla proportions (hoodie)
    const torsoX = px + lean * 15;
    this.riderGfx.ellipse(torsoX, cy - 42 * S, 24 * S, 30 * S).fill({ color: 0x14101E });
    // Hoodie details — zipper line
    this.riderGfx.moveTo(torsoX, cy - 65 * S).lineTo(torsoX, cy - 15 * S)
      .stroke({ color: 0x333344, width: 1.5 });
    // Hoodie collar
    this.riderGfx.ellipse(torsoX, cy - 68 * S, 14 * S, 6 * S).fill({ color: 0x1A1630 });

    // Gold chain necklace
    this.riderGfx.ellipse(torsoX, cy - 62 * S, 10 * S, 5 * S)
      .stroke({ color: 0xEAB308, width: 1.5, alpha: 0.8 });

    // Arms — thick gorilla arms in hoodie sleeves
    // Left arm
    this.riderGfx.moveTo(torsoX - 22 * S, cy - 50 * S).lineTo(px - 24 * S, cy - 26 * S)
      .stroke({ color: 0x14101E, width: 12 * S, cap: 'round' });
    // Right arm
    this.riderGfx.moveTo(torsoX + 22 * S, cy - 50 * S).lineTo(px + 24 * S, cy - 26 * S)
      .stroke({ color: 0x14101E, width: 12 * S, cap: 'round' });

    // Hands — large gorilla hands (dark grey/brown)
    this.riderGfx.circle(px - 24 * S, cy - 24 * S, 7 * S).fill({ color: 0x2A2018 });
    this.riderGfx.circle(px + 24 * S, cy - 24 * S, 7 * S).fill({ color: 0x2A2018 });

    // Head — gorilla head shape (broad, flat on top)
    const headY = cy - 78 * S;
    // Neck (thick)
    this.riderGfx.rect(torsoX - 10 * S, headY + 14 * S, 20 * S, 12 * S).fill({ color: 0x1E1610 });
    // Head shape — broad with prominent brow ridge
    this.riderGfx.ellipse(torsoX, headY, 18 * S, 16 * S).fill({ color: 0x1E1610 });
    // Brow ridge (darker, prominent)
    this.riderGfx.ellipse(torsoX, headY - 4 * S, 18 * S, 8 * S).fill({ color: 0x181210, alpha: 0.6 });

    // Muzzle area (lighter)
    this.riderGfx.ellipse(torsoX + 2 * S, headY + 6 * S, 10 * S, 8 * S).fill({ color: 0x3A3028 });

    // Snapback cap (turned slightly)
    const capColor = phase === 5 ? 0x7B2FBE : 0xEAB308; // Gold normally, purple in ghost
    this.riderGfx.ellipse(torsoX, headY - 12 * S, 20 * S, 6 * S).fill({ color: capColor });
    this.riderGfx.rect(torsoX - 20 * S, headY - 14 * S, 40 * S, 6 * S).fill({ color: capColor });
    // Brim
    this.riderGfx.rect(torsoX + 8 * S, headY - 12 * S, 16 * S, 3 * S).fill({ color: capColor, alpha: 0.8 });

    // Gafas (round glasses — pink/rose lenses, signature look)
    const glassColor = phase === 5 ? 0xC084FC : 0xFF69B4;
    // Left lens
    this.riderGfx.circle(torsoX - 7 * S, headY - 1 * S, 6 * S).fill({ color: glassColor, alpha: 0.45 });
    this.riderGfx.circle(torsoX - 7 * S, headY - 1 * S, 6 * S).stroke({ color: 0xCCCCCC, width: 1.2 });
    // Right lens
    this.riderGfx.circle(torsoX + 7 * S, headY - 1 * S, 6 * S).fill({ color: glassColor, alpha: 0.45 });
    this.riderGfx.circle(torsoX + 7 * S, headY - 1 * S, 6 * S).stroke({ color: 0xCCCCCC, width: 1.2 });
    // Bridge
    this.riderGfx.moveTo(torsoX - 2 * S, headY - 1 * S).lineTo(torsoX + 2 * S, headY - 1 * S)
      .stroke({ color: 0xCCCCCC, width: 1 });

    // Mouth — subtle smirk (CHILLIN default)
    if (phase <= 1 || phase === 5) {
      // Smirk
      this.riderGfx.moveTo(torsoX - 4 * S, headY + 8 * S)
        .quadraticCurveTo(torsoX, headY + 10 * S, torsoX + 5 * S, headY + 7 * S)
        .stroke({ color: 0x0A0808, width: 1.5 });
    } else {
      // Locked in — clenched
      this.riderGfx.moveTo(torsoX - 5 * S, headY + 8 * S).lineTo(torsoX + 5 * S, headY + 8 * S)
        .stroke({ color: 0x0A0808, width: 2 });
    }

    // Ears (prominent gorilla ears)
    this.riderGfx.ellipse(torsoX - 18 * S, headY + 2 * S, 4 * S, 6 * S).fill({ color: 0x201810 });
    this.riderGfx.ellipse(torsoX + 18 * S, headY + 2 * S, 4 * S, 6 * S).fill({ color: 0x201810 });

    // ── Ghost mode lightning aura ──
    if (phase === 5) {
      const t = Date.now() / 500;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t;
        const r1 = 50 + Math.sin(t * 2 + i) * 15;
        const r2 = r1 + 25 + Math.random() * 30;
        const mx = Math.cos(angle) * (r1 + r2) / 2 + (Math.random() - 0.5) * 25;
        const my = Math.sin(angle) * (r1 + r2) / 2 - 40 + (Math.random() - 0.5) * 25;
        this.riderGfx
          .moveTo(px + Math.cos(angle) * r1, cy + Math.sin(angle) * r1 - 40)
          .lineTo(px + mx, cy + my)
          .lineTo(px + Math.cos(angle) * r2, cy + Math.sin(angle) * r2 - 40)
          .stroke({ color: 0xC084FC, width: 2, alpha: 0.3 + Math.random() * 0.5 });
      }
    }

    // ── Sparks from exhaust ──
    if (state.phase === 'RUNNING') {
      const sparkCount = phase >= 3 ? 12 : phase >= 2 ? 6 : 3;
      const spreadX = 20 + phase * 8;
      for (let i = 0; i < sparkCount; i++) {
        this.sparks.push({
          x: cx + (Math.random() - 0.5) * spreadX * S,
          y: cy + 34 * S + Math.random() * 10,
          vx: (Math.random() - 0.5) * (4 + phase * 1.5),
          vy: (2 + Math.random() * 5) * (1 + phase * 0.3),
          life: 1,
          size: 2 + Math.random() * (2 + phase),
          color: phase === 5 ? '#c084fc' : ['#ff8800', '#ffaa00', '#ff5500', '#ffdd00'][Math.floor(Math.random() * 4)],
        });
      }
    }
  }

  // ── Helicopter ──

  private drawHelicopterPixi(phase: number, state: GameState): void {
    this.heliGfx.clear();
    if (phase < 4 || !state.helicopterActive) return;

    const elapsed = (Date.now() - state.heliStartTime!) / 4000;
    const beamAngle = Math.sin(elapsed * Math.PI * 2) * 0.5;
    const originX = W / 2, originY = -10;
    const beamLen = 520;
    const endX = originX + Math.sin(beamAngle) * beamLen;
    const endY = originY + Math.cos(Math.abs(beamAngle)) * beamLen;
    const halfW = 60;
    const perpX = -Math.cos(beamAngle);
    const perpY = Math.sin(beamAngle);

    // Outer cone
    this.heliGfx.moveTo(originX, originY)
      .lineTo(endX + perpX * halfW, endY + perpY * halfW)
      .lineTo(endX - perpX * halfW, endY - perpY * halfW)
      .closePath().fill({ color: 0xB4D2FF, alpha: 0.15 });
    // Inner bright core
    this.heliGfx.moveTo(originX, originY)
      .lineTo(endX + perpX * halfW * 0.25, endY + perpY * halfW * 0.25)
      .lineTo(endX - perpX * halfW * 0.25, endY - perpY * halfW * 0.25)
      .closePath().fill({ color: 0xFFFFFF, alpha: 0.06 });

    // Helicopter body
    this.heliGfx.ellipse(W / 2, 20, 22, 10).fill({ color: 0x111111 });
    this.heliGfx.rect(W / 2 - 28, 17, 56, 3).fill({ color: 0x333333 });
    // Blinking light
    if (Math.floor(Date.now() / 500) % 2) {
      this.heliGfx.circle(W / 2, 8, 3).fill({ color: 0xEF4444 });
    }
  }

  // ── Rain ──

  private drawRainPixi(phase: number, state: GameState): void {
    this.rainGfx.clear();
    if (phase < 2) return;
    if (phase === 5) {
      // Ghost mode: no rain, just residual mist
      for (let i = 0; i < 15; i++) {
        const mx = Math.random() * W;
        const my = HORIZON_Y + Math.random() * (H - HORIZON_Y);
        this.rainGfx.circle(mx, my, 15 + Math.random() * 20).fill({ color: 0x7B2FBE, alpha: 0.02 });
      }
      return;
    }

    const intensity = Math.min(1, (phase - 1) * 0.4);
    const alpha = 0.15 + 0.15 * intensity;
    const speed = 1.5 + state.chasePhase * 0.6;
    const windAngle = phase >= 4 ? -4 : phase >= 3 ? -2 : 0;

    for (const d of this.rainDrops) {
      d.y = (d.y + d.speed * speed) % H;
      this.rainGfx.moveTo(d.x, d.y)
        .lineTo(d.x + windAngle, d.y + d.len)
        .stroke({ color: 0xAABEFF, width: phase >= 4 ? 1.5 : 1, alpha });
    }

    // Rain streaks on screen edges (Phase 3+)
    if (phase >= 3) {
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? 0 : 1;
        const sx = side === 0 ? Math.random() * 30 : W - Math.random() * 30;
        const sy = Math.random() * H;
        const sLen = 30 + Math.random() * 50;
        this.rainGfx.moveTo(sx, sy).lineTo(sx - 3, sy + sLen)
          .stroke({ color: 0x8899CC, width: 2, alpha: 0.08 });
      }
    }
  }

  // ── Sparks & Particles ──

  private drawSparksPixi(state: GameState, _phase: number): void {
    this.sparkGfx.clear();

    this.sparks = this.sparks.filter(s => s.life > 0);
    for (const s of this.sparks) {
      const color = parseInt(s.color.replace('#', ''), 16) || 0xFF8800;
      const r = s.size * s.life;
      this.sparkGfx.circle(s.x, s.y, r * 2.5).fill({ color, alpha: s.life * 0.1 });
      this.sparkGfx.circle(s.x, s.y, r).fill({ color, alpha: s.life * 0.8 });
      if (s.size > 3) this.sparkGfx.circle(s.x, s.y, r * 0.3).fill({ color: 0xFFFFFF, alpha: s.life * 0.5 });
      s.x += s.vx; s.y += s.vy; s.vy += 0.5; s.vx *= 0.96; s.life -= 0.045;
    }

    this.crashParticles = this.crashParticles.filter(p => p.life > 0);
    for (const p of this.crashParticles) {
      const color = parseInt(p.color.replace('#', ''), 16) || 0xEF4444;
      this.sparkGfx.circle(p.x, p.y, p.size * p.life).fill({ color, alpha: p.life });
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.vx *= 0.95; p.life -= 0.025;
    }
  }

  // ── Effects Front (speed lines, phase overlay) ──

  private drawEffectsFront(phase: number, state: GameState): void {
    this.effectsFront.clear();
    if (phase < 2 || !this.riderSprite) return;

    // Speed lines — radiate from Kash's current position
    const cx = this.riderSprite.x;
    const cy = this.riderSprite.y - this.riderSprite.height * this.riderSprite.scale.y * this.speedLineHeight;
    const intensity = (phase - 1) / 4;
    const lineCount = Math.min(25, 10 + phase * 3);
    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2 + (Date.now() / 5000);
      const r1 = this.speedLineInner + Math.random() * 30;
      const r2 = r1 + (this.speedLineOuter - this.speedLineInner) + Math.random() * 40;
      const lineAlpha = 0.02 + intensity * 0.04;
      this.effectsFront
        .moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1)
        .lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2)
        .stroke({ color: 0xFFFFFF, width: Math.random() * 2, alpha: lineAlpha });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════

  spawnCrashParticles(): void {
    const cx = W / 2, cy = 555;
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      this.crashParticles.push({
        x: cx + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4,
        size: 4 + Math.random() * 7,
        color: ['#EF4444', '#EA580C', '#ffffff', '#ffaa00', '#fca5a5'][Math.floor(Math.random() * 5)],
        life: 1,
      });
    }
  }

  clearGameObjects(): void {
    this.obstacles = []; this.nitros = []; this.sparks = []; this.crashParticles = [];
  }

  checkNitroHit(screenX: number, screenY: number): NitroItem | null {
    for (const n of this.nitros) {
      const { x, y, scale } = roadToScreen(n.rx, n.rz);
      if (Math.hypot(screenX - x, screenY - y) < 25 * scale) return n;
    }
    return null;
  }

  private spawnObstacle(): void {
    const types: Obstacle['type'][] = ['police', 'police', 'police'];
    const lanes = [-0.667, 0, 0.667];
    const colors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#7f8c8d', '#f39c12'];

    // Types that can span 2 lanes (wide obstacles)
    const widePossible: Obstacle['type'][] = ['barricade', 'spikes', 'flipped_car'];
    // 2-lane positions: centered between two adjacent lanes
    const dualLanePositions = [-0.333, 0.333]; // between left-center, between center-right

    const useWide = Math.random() < 0.25; // 25% chance of a 2-lane obstacle
    if (useWide) {
      this.obstacles.push({
        type: widePossible[Math.floor(Math.random() * widePossible.length)],
        rx: dualLanePositions[Math.floor(Math.random() * dualLanePositions.length)],
        rz: 0.02, speed: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
  
        lanes: 2,
      });
    } else {
      this.obstacles.push({
        type: types[Math.floor(Math.random() * types.length)],
        rx: lanes[Math.floor(Math.random() * 3)],
        rz: 0.02, speed: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
  
        lanes: 1,
      });
    }
  }

  private spawnNitro(): void {
    if (this.nitros.length >= 1) return;
    this.nitros.push({ rx: (Math.random() - 0.5) * 0.6, rz: 0.05, collected: false, glow: 0 });
  }
}
