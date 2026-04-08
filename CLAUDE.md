# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kash Rundown is a burst/crash casino game prototype — part of the Kash Games universe by Samsa Productions SAS. The player bets and cashes out before a crash. The game is themed as a police chase through a cyberpunk London, with a gorilla character named Kash on a motorcycle. **The player ONLY bets and cashes out** — all visual elements (obstacles, lane changes, Kash movement) are simulation driven by the server.

## Commands

```bash
npm run dev       # Vite dev server on localhost:3000 (frontend)
npm run server    # Game server on localhost:3001 (backend, WebSocket)
npm run build     # Production build → dist/
```

Both servers must run simultaneously for multiplayer. Without server, game auto-falls back to offline/local mode.

## Deployment

- **Vercel** — frontend (auto-deploys from main branch)
- **Railway** — WebSocket backend (auto-deploys from main branch)
- **Offline mode** — if WebSocket fails to connect in 3s, game runs locally with GameEngine
- **Environment variable**: `VITE_WS_URL` on Vercel points to Railway WSS URL
- Assets in `public/assets/` — served at `/assets/` in both dev and production

## Architecture

### Frontend (Vite + PixiJS)

- `index.html` → `src/main.ts` — main game
- `scene-lab.html` → `src/scene-lab.ts` — visual testing sandbox with simulation

**`src/main.ts`** — Connects to backend via WebSocket. Falls back to local GameEngine if offline. Single unified button with states: PLACE BET → BET PLACED (cancelable) → CASH OUT → QUEUED.

**`src/network/GameClient.ts`** — WebSocket client with auto-reconnect and offline detection.

**`src/scenes/RoadScene.ts`** — PixiJS rendering. Video background (`road-bg.webm/.mp4`), Kash rider video/image, obstacle sprites, rain, siren glows, speed lines.

**`src/scenes/constants.ts`** — Road perspective math. `roadToScreen(rx, rz)` maps road-space to screen. Horizon width = 0 (vanishing point).

### Backend (Node.js + TypeScript)

```
server/
  index.ts              — Express + WebSocket (PORT env, CORS, 0.0.0.0)
  game/
    Round.ts            — Round lifecycle, obstacle spawning, Kash dodge logic, crash sequence
    RNG.ts              — Provably fair SHA-256 hash chain
    Multiplier.ts       — Exponential growth curve
  ws/
    GameRoom.ts         — Multiplayer room, bet/cashout/cancel handling
    PlayerSession.ts    — Per-player state
```

### Key Game Logic (Round.ts)

**Obstacle spawning:**
- Normal obstacles: barricade, spikes, dumpster, cones, manhole (1 lane)
- Wide obstacles: police_alt (2 lanes, phase 3+, 20% chance)
- Obstacle lanes: -0.667, 0, 0.667
- Multi-obstacle chance scales with phase
- No obstacles spawn within 10% of crash point

**Kash dodge:**
- Kash lanes: -0.8, -0.05, 0.7
- Only moves when obstacle is in danger zone (0.4 radius normal, 0.7 for wide)
- Phase 1-2: dodge with 150-250ms delay for drama
- Phase 3+: instant dodge
- Pending dodge cancelled on crash

**Crash sequence:**
- Obstacle spawns at rz=0 (horizon) in Kash's exact lane
- Delay before crash event: [1000, 600, 380, 300, 200]ms per phase
- Crash point 1.00 = "ENGINE STALLED" (no obstacle)

### Video/Image Assets

**Current state — needs work on Mac:**
- `kash-rider.webm` — VP9 with alpha channel (works Chrome/Firefox, NOT Safari)
- `kash-rider.mp4` — H.264 no alpha (fallback, has black background)
- `kash-en-moto.webp` — static image (Safari fallback, works everywhere)
- `road-bg.webm` / `road-bg.mp4` — background video

**TODO on Mac (has VideoToolbox for HEVC):**
1. Convert `src/assets/Kash_Atrás Loop_Baja.mov` (has ARGB alpha!) to HEVC with alpha:
   ```bash
   ffmpeg -i "Kash_Atrás Loop_Baja.mov" -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.75 -tag:v hvc1 -b:v 1M -an public/assets/kash-rider-safari.mov
   ```
2. Update `src/scenes/RoadScene.ts` `loadRiderSprite()` to:
   - Safari: use `kash-rider-safari.mov` (HEVC alpha) instead of static image
   - Chrome/Firefox: keep `kash-rider.webm` (VP9 alpha) — already working
3. Test on Safari that the alpha transparency works with HEVC

**The original MOV has `pix_fmt: argb` (QuickTime Animation codec) — confirmed alpha channel exists.**

### Chase Phases & Timing

| Phase | Multiplier | Crash delay | Obstacles | Video speed |
|-------|-----------|-------------|-----------|-------------|
| 1 | <2× | 1000ms | Every 1.2s | 1.0x |
| 2 | 2×+ | 600ms | Every 0.8s | 1.2x |
| 3 | 5×+ | 380ms | Every 0.5s | 1.5x |
| 4 | 10×+ | 300ms | Every 0.35s | 2.0x |
| 5 | 50×+ | 200ms | Every 0.25s | 2.5x |

### Audio

- Engine: procedural sawtooth oscillator, pitch scales with multiplier
- Siren: sine wave + LFO sweep (1.5Hz, ±250Hz) — plays during round, stops on crash
- Crash SFX: descending sawtooth sweep
- Cashout SFX: ascending arpeggio (does NOT stop engine/siren)
- All audio stops on crash via `Audio.stopAll()`

### Visual Effects

- Siren glow: Canvas2D radial gradients, red left / blue right, alternating at 150ms
- Position: cy = H * 0.85, radius = 800
- Rain: PixiJS Graphics, phase 2+
- Kash tint: darkens in rain, red/blue siren tint alternating
- Glow filter border on Kash per phase
- Speed lines around Kash (height=5.5, inner=100, outer=200)
- Background video playback rate scales with phase

### Scene Lab

Full simulation environment at `/scene-lab.html`:
- Crash point input (text), speed slider
- All visual controls (fog, video, sprites, scale, position)
- Same obstacle/dodge/crash logic as server
- Phase buttons, Kash lane controls
