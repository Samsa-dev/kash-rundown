# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kash Rundown is a burst/crash casino game prototype — part of the Kash Games universe by Samsa Productions SAS. The player bets and cashes out before a crash. The game is themed as a police chase through a cyberpunk London, with a gorilla character named Kash on a motorcycle. **The player ONLY bets and cashes out** — all visual elements (obstacles, lane changes, Kash movement) are simulation driven by the server.

The full game design spec is in `Kash_Rundown_Game_Spec.docx.pdf`. The narrative/business bible is `KASH_PROJECT_BIBLE.md`.

## Commands

```bash
npm run dev       # Vite dev server on localhost:3000 (frontend)
npm run server    # Game server on localhost:3001 (backend, WebSocket)
npm run build     # TypeScript check + production build → dist/
```

Both servers must run simultaneously for the game to work.

## Architecture

### Frontend (Vite + PixiJS)

Two HTML entry points in `vite.config.ts`:
- `index.html` → `src/main.ts` — the main game
- `scene-lab.html` → `src/scene-lab.ts` — visual testing sandbox

**`src/main.ts`** — Connects to backend via WebSocket, handles all UI state. Single unified button with 4 states: PLACE BET → BET PLACED (cancelable during countdown) → CASH OUT → QUEUED (for next round).

**`src/network/GameClient.ts`** — WebSocket client wrapper. Methods: `connect()`, `placeBet()`, `cashOut()`, `cancelBet()`, `on(type, handler)`.

**`src/game/GameEngine.ts`** — Local state container. No longer runs tick loop — receives state from server. Kept for balance/history tracking.

**`src/scenes/RoadScene.ts`** — Large file. All PixiJS rendering: road with perspective vanishing point, buildings, obstacles, rain, lightning, street lamps, Kash sprite. Key public properties: `serverRoundRunning`, `riderLane`, `riderDepth`, `skylineFog`, `roadFog`, `speedLineHeight/Inner/Outer`.

**`src/scenes/constants.ts`** — Road geometry. `roadToScreen(rx, rz)` maps road-space to screen coords. Horizon width is 8px (near vanishing point). `setHorizonWidth()` adjusts dynamically.

**`src/kash/DialogueSystem.ts`** — 80+ dialogue lines by trigger. `src/kash/MoodState.ts` — mood colors.

**`src/audio/AudioManager.ts`** — Procedural Web Audio API. `toggleMute()`, `isMuted()`.

### Backend (Node.js + TypeScript)

```
server/
  index.ts              — Express + WebSocket server (port 3001)
  types.ts              — Shared message types (ServerMessage, ClientMessage)
  game/
    Round.ts            — Round lifecycle, obstacle spawning, Kash auto-movement
    RNG.ts              — Provably fair SHA-256 hash chain (10k rounds per chain)
    Multiplier.ts       — Exponential growth curve (same as client)
  ws/
    GameRoom.ts         — Multiplayer room, broadcast, bet/cashout/cancel handling
    PlayerSession.ts    — Per-player state (balance, bet, cashout)
```

**Round flow:** Server generates crash point → 5s countdown (bets open) → ticks every 80ms → crash → 3s wait → next round. All players see the same multiplier.

**WebSocket messages:**
- Client → Server: `placeBet`, `cashOut`, `cancelBet`, `ping`
- Server → Client: `round:waiting`, `round:countdown`, `round:tick`, `round:crash`, `bet:confirmed`, `bet:cancelled`, `bet:rejected`, `cashOut:confirmed`, `obstacle:spawn`, `kash:move`, `players`, `welcome`, `history`

### Chase Phases

| Phase | Multiplier | Visual |
|-------|-----------|--------|
| 1 | <2× | Clean run, no effects |
| 2 | 2×+ | Rain starts, siren flash, green glow on Kash |
| 3 | 5×+ | Heavier rain, gold glow |
| 4 | 10×+ | Orange glow, more obstacles |
| 5 | 50×+ | Red glow, helicopter, max intensity |

### Kash Sprite
- Loaded from `/src/assets/kash-en-moto.webp` (gorilla on motorcycle, back view)
- Positioned via `roadToScreen()` at `riderDepth` (default 0.6)
- Lane change animation with tilt + tire sparks
- Darkens in rain, tinted by siren colors
- Glow border color changes per phase

### Obstacles
- Server-driven: `obstacle:spawn` messages with type, lane, and lane count
- 1-lane types: barricade, spikes, dumpster, cones, flipped_car, electric_puddle
- 2-lane types: wide barricade, wide spikes, flipped truck, wide electric puddle
- Obstacle lanes: -0.667, 0, 0.667 (1-lane) or -0.333, 0.333 (2-lane)
- Kash lanes: -0.5, 0, 0.5 (server decides movement)

### Key Design Decisions
- Portrait-first 390x844 (iPhone 14 viewport)
- Color palette: deep navy background, bribe gold (#EAB308) for UI accents, green for bet button
- Multiplier curve: `exp(0.000055 * elapsed_ms)` — same on client and server
- House edge: 4%, instant crash rate: 1.2%
- Provably fair: SHA-256 hash chain, revealed after each round
