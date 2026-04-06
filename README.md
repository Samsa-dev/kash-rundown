# Kash Rundown

Burst/crash casino game prototype — part of the **Kash Games** universe by [Samsa Productions SAS](https://samsa.dev).

Kash is a streetwear gorilla navigating an alternate London under Japanese Imperial control. The game is a crash/burst mechanic where every cash-out decision mirrors Kash's core theme: risk as a language, agency in a rigged system.

---

## Stack

- [PixiJS v8](https://pixijs.com) — 2D WebGL renderer
- [Howler.js](https://howlerjs.com) — audio
- [TypeScript](https://typescriptlang.org)
- [Vite](https://vitejs.dev) — dev server & bundler

---

## Getting started

```bash
# npm
npm install
npm run dev

# bun
bun install
bun run dev
```

Opens at `http://localhost:3000`.

### Other commands

```bash
npm run build     # TypeScript check + production build → dist/
npm run preview   # Preview the production build locally
```

---

## Project structure

```
src/
  main.ts               # Entry point
  game/
    GameEngine.ts       # Core game loop & state machine
    Mechanics.ts        # Crash curve, multiplier logic
    Phases.ts           # Game phase transitions
    RNG.ts              # Provably fair RNG
    types.ts            # Shared types
  kash/
    DialogueSystem.ts   # Kash's reactive dialogue
    MoodState.ts        # BALLIN' / HUSTLIN' / REAL TALK mood tracking
  audio/
    AudioManager.ts     # Howler.js wrapper
  scenes/
    RoadScene.ts        # Main game scene (PixiJS)
    constants.ts        # Scene & layout constants
  styles/
    main.css
```

---

## Requirements

- Node.js 18+ or Bun 1.0+
- Modern browser with WebGL support

---

*UNLICENSED — Samsa Productions SAS, Colombia, 2026*
