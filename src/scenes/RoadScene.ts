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
  { text: 'カシュ', color: '#EA580C' },   // KASH
  { text: 'ゲーム', color: '#f472b6' },   // GAME
  { text: '賭け', color: '#7B2FBE' },     // BET
  { text: 'ネオン', color: '#06b6d4' },   // NEON
  { text: '夜', color: '#EF4444' },       // NIGHT
  { text: '速い', color: '#16A34A' },     // FAST
  { text: 'バー', color: '#EAB308' },     // BAR
  { text: '危険', color: '#EA580C' },     // DANGER
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

interface RainDrop { x: number; y: number; speed: number; len: number; }

export class RoadScene {
  public container: Container;

  private backgroundSprite: Sprite;
  private effectsBack: Graphics;
  private obstacleGfx: Graphics;
  private pursuerGfx: Graphics;
  private riderContainer: Container;
  private riderGfx: Graphics;
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
    this.effectsBack.blendMode = 'add';
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
    this.drawEffectsBack(phase);
    this.drawObstaclesPixi(state);
    this.drawPursuersPixi(phase, state);
    this.drawRiderPixi(phase, state);
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

    if (phase === 5) { this.glowFilter.color = 0x7B2FBE; this.glowFilter.distance = 25; this.glowFilter.outerStrength = 5; }
    else if (phase >= 4) { this.glowFilter.color = 0xEA580C; this.glowFilter.distance = 15; this.glowFilter.outerStrength = 3; }
    else if (phase >= 3) { this.glowFilter.color = 0x2563EB; this.glowFilter.distance = 10; this.glowFilter.outerStrength = 1.5; }
    else { this.glowFilter.distance = 1; this.glowFilter.outerStrength = 0; }
  }

  // ═══════════════════════════════════════════════════════
  //  BACKGROUND — Canvas2D
  // ═══════════════════════════════════════════════════════

  private drawBackground(phase: number, state: GameState): void {
    const ctx = this.bgCtx;
    ctx.clearRect(0, 0, W, H);
    this.drawSky(ctx, phase);
    this.drawStars(ctx, phase);
    this.drawDistantSkyline(ctx, phase);
    this.drawSideFacades(ctx, phase, state);
    this.drawRoad(ctx, phase, state);
    this.drawStreetLamps(ctx, phase);
    if (phase >= 2) this.drawPuddles(ctx, phase);
  }

  // ── Sky ──

  private drawSky(ctx: CanvasRenderingContext2D, phase: number): void {
    const palettes = [
      ['#08001a', '#140830', '#1a0535'],      // P1: deep clear night
      ['#0a0020', '#1a0838', '#2a0845'],      // P2: rain approaching
      ['#060025', '#0e0840', '#0a1050'],      // P3: overcast blue
      ['#150010', '#2a0818', '#3a0828'],      // P4: stormy red
      ['#0a0030', '#1a0055', '#2a0078'],      // P5: transcendent purple
    ];
    const colors = palettes[phase - 1] || palettes[0];
    const grd = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 20);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.5, colors[1]);
    grd.addColorStop(1, colors[2]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, HORIZON_Y + 20);

    // Ambient city glow on horizon
    const glowColors = ['rgba(234,88,12,0.08)', 'rgba(200,60,120,0.1)', 'rgba(37,99,235,0.12)', 'rgba(239,68,68,0.15)', 'rgba(123,47,190,0.2)'];
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
        ctx.fillStyle = `rgba(200,180,255,${this.lightningAlpha})`;
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
      ctx.fillStyle = `rgba(255,255,255,${alpha * (phase === 1 ? 0.6 : 0.3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Distant Skyline ──

  private drawDistantSkyline(ctx: CanvasRenderingContext2D, phase: number): void {
    this.buildingOffset = (this.buildingOffset + (0.08 + phase * 0.04)) % 200;

    // Layer 1: far silhouettes (dark, slow)
    this.drawSkylineLayer(ctx, phase, 0.3, 16, 0.4, -0.6);
    // Layer 2: mid buildings (neon accents)
    this.drawSkylineLayer(ctx, phase, 0.7, 20, 0.7, 0);
    // Layer 3: near buildings (detailed)
    this.drawSkylineLayer(ctx, phase, 1.0, 24, 1.0, 0.5);
  }

  private drawSkylineLayer(ctx: CanvasRenderingContext2D, phase: number, parallax: number, count: number, brightness: number, baseShift: number): void {
    const offset = this.buildingOffset * parallax;
    const neonPalette = ['#EA580C', '#f472b6', '#7B2FBE', '#06b6d4', '#EF4444', '#16A34A', '#EAB308'];
    const baseDark = Math.floor(brightness * 15);

    for (let i = 0; i < count; i++) {
      const spacing = W / count * 1.3;
      const x = ((i * spacing - offset + baseShift * 50) % (W + spacing)) - spacing / 2;
      const bw = 14 + (i * 7 + 3) % 20;
      const bh = (20 + (i * 13 + 7) % 50) * brightness + 15;
      const by = HORIZON_Y - bh;

      // Building body
      const r = baseDark + (i * 3) % 8;
      const g = Math.floor(baseDark * 0.3) + (i * 2) % 5;
      const b = baseDark + (i * 5) % 12 + 10;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x - bw / 2, by, bw, bh + 2);

      // Windows
      if (brightness > 0.5) {
        const rows = Math.floor(bh / 10);
        const cols = Math.max(2, Math.floor(bw / 7));
        const winColors = ['rgba(255,200,80,0.5)', 'rgba(120,180,255,0.4)', 'rgba(255,120,200,0.35)', 'rgba(80,255,200,0.3)'];
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

      // Neon accent on some buildings
      if (brightness > 0.6 && i % 3 === 0) {
        const nc = neonPalette[i % neonPalette.length];
        ctx.save();
        ctx.shadowColor = nc;
        ctx.shadowBlur = 10 * brightness;
        ctx.fillStyle = nc;
        ctx.globalAlpha = 0.7 * brightness;
        // Vertical neon strip
        ctx.fillRect(x - bw / 2 + 1, by + 5, 2, Math.min(bh * 0.4, 25));
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Antenna/spire on tall buildings
      if (bh > 55 && i % 4 === 0) {
        ctx.strokeStyle = `rgba(${100 + baseDark * 3},${50 + baseDark},${120 + baseDark * 3},0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x, by - 12);
        ctx.stroke();
        // Blinking red light
        if (Math.floor(Date.now() / 800 + i * 100) % 3 === 0) {
          ctx.fillStyle = 'rgba(255,0,0,0.8)';
          ctx.beginPath();
          ctx.arc(x, by - 12, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Side Facades (scrolling buildings on left/right) ──

  private drawSideFacades(ctx: CanvasRenderingContext2D, phase: number, state: GameState): void {
    if (state.phase === 'RUNNING' && !state.multiplierPaused)
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
          ctx.shadowColor = sign.color;
          ctx.shadowBlur = 12;
          ctx.fillStyle = sign.color;
          ctx.font = '700 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sign.text, startX + colW / 2, y + 16);
          // Glow bar under text
          ctx.fillStyle = sign.color + '66';
          ctx.fillRect(startX + 4, y + 20, colW - 8, 2);
          ctx.shadowBlur = 0;
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
    // Asphalt trapezoid
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(ROAD_R_HOR, HORIZON_Y);
    ctx.lineTo(ROAD_R_BOT, H); ctx.lineTo(ROAD_L_BOT, H); ctx.closePath();
    const roadGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    roadGrad.addColorStop(0, phase >= 4 ? '#100515' : '#0d081a');
    roadGrad.addColorStop(0.5, phase >= 4 ? '#0e040f' : '#0a0614');
    roadGrad.addColorStop(1, phase >= 4 ? '#0a0308' : '#08040e');
    ctx.fillStyle = roadGrad;
    ctx.fill();
    ctx.restore();

    // Sidewalks — slightly lighter with curb line
    ctx.save();
    const swGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    swGrad.addColorStop(0, '#10071a');
    swGrad.addColorStop(1, '#0a0512');
    ctx.fillStyle = swGrad;
    // Left sidewalk
    ctx.beginPath(); ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(SIDE_W, HORIZON_Y);
    ctx.lineTo(SIDE_W, H); ctx.lineTo(ROAD_L_BOT, H); ctx.closePath(); ctx.fill();
    // Right sidewalk
    ctx.beginPath(); ctx.moveTo(ROAD_R_HOR, HORIZON_Y); ctx.lineTo(W - SIDE_W, HORIZON_Y);
    ctx.lineTo(W - SIDE_W, H); ctx.lineTo(ROAD_R_BOT, H); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Curb lines (bright edge between road and sidewalk)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(ROAD_L_BOT, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_R_HOR, HORIZON_Y); ctx.lineTo(ROAD_R_BOT, H); ctx.stroke();
    ctx.restore();

    // Center dashed line (yellow)
    this.roadOffset = (this.roadOffset + (2 + state.chasePhase * 1.5)) % 60;
    for (let y = HORIZON_Y; y < H + 30; y += 60) {
      const yOff = (y + this.roadOffset) % 60 + HORIZON_Y - 60;
      const ts = Math.max(0, (yOff - HORIZON_Y) / (H - HORIZON_Y));
      const rLs = ROAD_L_HOR + (ROAD_L_BOT - ROAD_L_HOR) * ts;
      const rRs = ROAD_R_HOR + (ROAD_R_BOT - ROAD_R_HOR) * ts;
      const cx = (rLs + rRs) / 2;
      const dws = 1.5 + ts * 3;
      const dashHs = Math.max(3, 12 + ts * 22);
      ctx.fillStyle = `rgba(255,220,80,${0.12 + ts * 0.25})`;
      ctx.fillRect(cx - dws / 2, yOff, dws, dashHs);
    }

    // Lane dividers (white, thinner)
    for (const rxd of [-1 / 3, 1 / 3]) {
      for (let y = HORIZON_Y; y < H + 30; y += 60) {
        const yOff = (y + this.roadOffset) % 60 + HORIZON_Y - 60;
        const ts = Math.max(0, (yOff - HORIZON_Y) / (H - HORIZON_Y));
        const rLs = ROAD_L_HOR + (ROAD_L_BOT - ROAD_L_HOR) * ts;
        const rRs = ROAD_R_HOR + (ROAD_R_BOT - ROAD_R_HOR) * ts;
        const xs = (rLs + rRs) / 2 + rxd * (rRs - rLs) / 2;
        const dws = 0.8 + ts * 2;
        const dashHs = Math.max(2, 8 + ts * 16);
        ctx.fillStyle = `rgba(255,255,255,${0.06 + ts * 0.2})`;
        ctx.fillRect(xs - dws / 2, yOff, dws, dashHs);
      }
    }

    // Wet road reflections (Phase 2+)
    if (phase >= 2) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ROAD_L_HOR, HORIZON_Y); ctx.lineTo(ROAD_R_HOR, HORIZON_Y);
      ctx.lineTo(ROAD_R_BOT, H); ctx.lineTo(ROAD_L_BOT, H); ctx.closePath();
      const refGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
      refGrad.addColorStop(0, 'transparent');
      const refIntensity = Math.min(0.18, (phase - 1) * 0.05);
      refGrad.addColorStop(0.4, phase >= 4 ? `rgba(200,30,80,${refIntensity})` : `rgba(100,50,200,${refIntensity})`);
      refGrad.addColorStop(0.7, `rgba(234,88,12,${refIntensity * 0.6})`);
      refGrad.addColorStop(1, `rgba(37,99,235,${refIntensity * 0.4})`);
      ctx.fillStyle = refGrad;
      ctx.fill();
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
    if (phase < 2) return;
    const cycle = Math.floor(Date.now() / 300) % 2;
    const color = cycle === 0 ? 0xDC1E50 : 0x2563EB;
    const alpha = phase >= 4 ? 0.1 : 0.06;
    this.effectsBack.rect(0, 0, W, H).fill({ color, alpha });
  }

  private drawObstaclesPixi(state: GameState): void {
    this.obstacleGfx.clear();
    const speed = [0.007, 0.012, 0.018, 0.026, 0.042][state.chasePhase - 1];

    if (state.phase === 'RUNNING' && Math.random() < 0.02 + state.chasePhase * 0.005) this.spawnObstacle();
    if (state.phase === 'RUNNING' && state.chasePhase <= 3 && Math.random() < 0.003) this.spawnNitro();

    this.obstacles = this.obstacles.filter(o => o.rz < 1.15);
    this.obstacles.sort((a, b) => a.rz - b.rz);

    for (const o of this.obstacles) {
      if (state.phase === 'RUNNING' && !state.multiplierPaused) o.rz += speed;
      const { x, y, scale } = roadToScreen(o.rx, o.rz);
      if (o.type === 'police') this.drawPoliceCarPixi(x, y, scale);
      else if (o.type === 'car') this.drawCivilianCarPixi(x, y, scale, parseInt(o.color.slice(1), 16));
      else if (o.type === 'civilian') this.drawPedestrianPixi(x, y, scale);
      else if (o.type === 'cyclist') this.drawCyclistPixi(x, y, scale);
    }

    this.nitros = this.nitros.filter(n => n.rz < 1.1 && !n.collected);
    for (const n of this.nitros) {
      if (state.phase === 'RUNNING') n.rz += speed * 0.9;
      n.glow = (n.glow + 0.1) % (Math.PI * 2);
      const { x, y, scale } = roadToScreen(n.rx, n.rz);
      const glow = Math.sin(n.glow);
      const r = 8 * scale + glow * 3;
      this.obstacleGfx.circle(x, y, r * 2).fill({ color: 0xEA580C, alpha: 0.1 });
      this.obstacleGfx.circle(x, y, r).fill({ color: 0xEA580C, alpha: 0.9 });
      this.obstacleGfx.circle(x, y, r * 0.5).fill({ color: 0xFFFFFF, alpha: 0.5 });
    }
  }

  private drawCivilianCarPixi(x: number, y: number, scale: number, color: number): void {
    const w = 36 * scale, h = 58 * scale;
    const g = this.obstacleGfx;
    // Body with rounded top
    g.roundRect(x - w / 2, y - h / 2, w, h, 5 * scale).fill({ color });
    // Roof (darker)
    g.roundRect(x - w / 2 + 3 * scale, y - h / 2 + 8 * scale, w - 6 * scale, h * 0.3, 3 * scale)
      .fill({ color: 0x000000, alpha: 0.3 });
    // Windshield
    g.rect(x - w / 2 + 4 * scale, y - h / 2 + 12 * scale, w - 8 * scale, h * 0.15)
      .fill({ color: 0x88BBFF, alpha: 0.3 });
    // Tail lights
    g.rect(x - w / 2 + 2 * scale, y + h / 2 - 5 * scale, 4 * scale, 3 * scale).fill({ color: 0xFF2200, alpha: 0.8 });
    g.rect(x + w / 2 - 6 * scale, y + h / 2 - 5 * scale, 4 * scale, 3 * scale).fill({ color: 0xFF2200, alpha: 0.8 });
  }

  private drawPoliceCarPixi(x: number, y: number, scale: number): void {
    const w = 38 * scale, h = 60 * scale;
    const g = this.obstacleGfx;
    // Body — dark blue/black
    g.roundRect(x - w / 2, y - h / 2, w, h, 5 * scale).fill({ color: 0x0A0A2A });
    // White stripe
    g.rect(x - w / 2 + 2 * scale, y - h / 2 + h * 0.35, w - 4 * scale, h * 0.08).fill({ color: 0xFFFFFF, alpha: 0.7 });
    // Light bar — flashing
    const sc = Math.floor(Date.now() / 150) % 2 === 0;
    g.rect(x - w / 2 + 3 * scale, y - h / 2 + 2 * scale, w / 2 - 4 * scale, 6 * scale)
      .fill({ color: sc ? 0xEF4444 : 0x2563EB });
    g.rect(x + 1 * scale, y - h / 2 + 2 * scale, w / 2 - 4 * scale, 6 * scale)
      .fill({ color: sc ? 0x2563EB : 0xEF4444 });
    // Headlights glow
    g.circle(x - w / 2 + 5 * scale, y + h / 2 - 3 * scale, 3 * scale).fill({ color: 0xFFFFCC, alpha: 0.6 });
    g.circle(x + w / 2 - 5 * scale, y + h / 2 - 3 * scale, 3 * scale).fill({ color: 0xFFFFCC, alpha: 0.6 });
  }

  private drawPedestrianPixi(x: number, y: number, scale: number): void {
    const g = this.obstacleGfx;
    g.circle(x, y - 18 * scale, 6 * scale).fill({ color: 0xFFDDBB });
    const bodyColors = [0x3A5A8A, 0x8A3A5A, 0x3A8A5A, 0x6A4A2A];
    g.rect(x - 5 * scale, y - 12 * scale, 10 * scale, 16 * scale)
      .fill({ color: bodyColors[Math.floor(Date.now() / 2000) % 4] });
  }

  private drawCyclistPixi(x: number, y: number, scale: number): void {
    const g = this.obstacleGfx;
    g.circle(x - 8 * scale, y + 4 * scale, 6 * scale).stroke({ color: 0x888888, width: 1.5 * scale });
    g.circle(x + 8 * scale, y + 4 * scale, 6 * scale).stroke({ color: 0x888888, width: 1.5 * scale });
    g.circle(x, y - 14 * scale, 5 * scale).fill({ color: 0xDDDDDD });
  }

  private drawPursuersPixi(phase: number, state: GameState): void {
    this.pursuerGfx.clear();
    if (phase < 2 || state.phase === 'IDLE' || state.phase === 'COUNTDOWN') return;
    if (phase === 5) return;

    const bounce = Math.sin(Date.now() / 180) * 3;
    const draw = (rx: number, rz: number, yOff: number) => {
      const p = roadToScreen(rx, rz);
      this.drawPoliceCarPixi(p.x, p.y + yOff, p.scale);
    };
    draw(-0.667, 0.62, bounce);
    draw(0.667, 0.62, Math.sin(Date.now() / 180 + 1) * 3);
    if (phase >= 3) { draw(-0.667, 0.76, 0); draw(0.667, 0.76, 0); }
    if (phase >= 4) { draw(0, 0.87, 0); }
  }

  // ── Kash Rider (gorilla on motorbike) ──

  private drawRiderPixi(phase: number, state: GameState): void {
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
    if (phase < 3 || !state.helicopterActive) return;

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
    if (phase < 2) return;

    // Speed lines — radiate from rider
    const intensity = (phase - 1) / 4;
    const cx = W / 2, cy = 555;
    const lineCount = phase === 5 ? 35 : 22;
    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2 + (Date.now() / 5000);
      const r1 = 90 + Math.random() * 40;
      const r2 = r1 + 80 + Math.random() * 120;
      const lineAlpha = phase === 5 ? 0.06 + intensity * 0.08 : 0.02 + intensity * 0.04;
      const lineColor = phase === 5 ? 0xC084FC : 0xFFFFFF;
      this.effectsFront
        .moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1)
        .lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2)
        .stroke({ color: lineColor, width: Math.random() * 2, alpha: lineAlpha });
    }

    // Ghost mode: purple neon streaks replacing rain
    if (phase === 5) {
      for (let i = 0; i < 12; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H;
        const sLen = 40 + Math.random() * 80;
        this.effectsFront.moveTo(sx, sy).lineTo(sx - 5, sy + sLen)
          .stroke({ color: 0x7B2FBE, width: 2 + Math.random() * 2, alpha: 0.1 + Math.random() * 0.1 });
      }
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
    const types: Obstacle['type'][] = ['car', 'car', 'car', 'police', 'civilian', 'cyclist'];
    const lanes = [-0.667, 0, 0.667];
    const colors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#7f8c8d', '#f39c12'];
    this.obstacles.push({
      type: types[Math.floor(Math.random() * types.length)],
      rx: lanes[Math.floor(Math.random() * 3)],
      rz: 0.02, speed: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      dodged: false,
    });
  }

  private spawnNitro(): void {
    if (this.nitros.length >= 1) return;
    this.nitros.push({ rx: (Math.random() - 0.5) * 0.6, rz: 0.05, collected: false, glow: 0 });
  }
}
