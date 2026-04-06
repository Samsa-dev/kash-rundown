# KASH RUNDOWN — Spec vs Prototype Audit

Comparación entre el Game Design Spec (PDF) y el prototipo actual (`kash-rundown (1).html`).

---

## RESUMEN

| Área | Implementado | Parcial | Faltante |
|---|---|---|---|
| Core gameplay loop | 7 | 2 | 3 |
| UI/Screens | 4 | 1 | 2 |
| Visual design | 6 | 2 | 3 |
| Audio | 3 | 1 | 4 |
| Kash integration | 1 | 1 | 2 |
| Technical | 4 | 1 | 4 |

---

## 1. CORE GAMEPLAY (Sección 02-04 del Spec)

### IMPLEMENTADO
- [x] Crash/burst core mechanic — multiplicador sube, jugador hace cash out o crash
- [x] RNG con house edge (4%) — distribución exponencial, media ~3x
- [x] 5 fases por umbral de multiplicador (1-3x, 3-10x, 10-50x, 50-500x, 500-8000x)
- [x] Roadblock events en umbrales 3x, 10x, 50x con ventana de 2 segundos
- [x] Dodge left/right con +1.5x bonus correcto / pausa 1s incorrecto / crash si timeout
- [x] Nitro boost — coleccionable random que da +0.5x a +1.5x (spec dice hasta +3x)
- [x] Auto cash-out configurable por el jugador

### PARCIAL
- [~] **Helicopter Spotlight** — Se muestra el beam y el warning card, pero NO hay spike de probabilidad de crash cuando el beam encuentra a Kash (spec: "crash probability spikes sharply for 3 seconds"). Actualmente es solo visual.
- [~] **Nitro range** — Implementado +0.5x a +2x, spec dice +0.5x a +3x. La frecuencia de spawn tampoco sigue la spec (~15%/seg en fases 1-2, ~4% en fases 4-5).

### FALTANTE
- [ ] **Bribe the Dispatcher (Buy Bonus)** — No existe. Spec define 3 tiers ($5/$25/$100) con efectos en probabilidad de crash y primer evento. Screen 6 completa del spec no está implementada.
- [ ] **Provably Fair / Hash verification** — No hay sistema de hash. El crash point se genera con Math.random(), no con SHA-256 hash chain. No hay server seed + client seed + nonce. No hay link de verificación on-chain en pantalla de resultado.
- [ ] **Nitro coleccionable con tap** — Funciona por click en canvas, pero la spec pide aparición en fases 4-5 al ~4% (actualmente solo aparece en fases 1-3: `G.chasePhase <= 3`). Ghost Mode con Kingpin bribe debería garantizar nitro al inicio (no hay bribe system).

---

## 2. UI & SCREENS (Sección 05 del Spec)

### Screen 1 — Main Game Screen
| Elemento | Status | Notas |
|---|---|---|
| Background cinematic city | **Implementado** | Canvas 2D con perspectiva, edificios, lluvia |
| Speedometer Arc | **NO** | Spec pide arco analógico centre screen. El prototipo muestra solo el número del multiplicador |
| Live Multiplier | **Implementado** | 80px bold, actualiza cada ~80ms (spec: 100ms) |
| Profit Indicator | **Implementado** | 13px green text debajo del multiplicador |
| Chase Intensity Bar | **Implementado** | 5 labels en barra horizontal con fase activa |
| Stat Cards (3) | **Implementado** | Best Run, Session P&L, Rounds |
| Nitro Bar | **NO** | Spec pide barra de carga de nitro con botón USE. No existe — nitro es solo tap-to-collect |
| Cash Out Button | **Implementado** | Full-width, orange gradient, cambia color por fase |
| Auto Cash-Out toggle | **Implementado** | Toggle con input de target |
| Phase Flash | **Implementado** | Flash de color en transiciones de fase |

### Screen 2 — Roadblock Dodge
| Elemento | Status | Notas |
|---|---|---|
| Overlay con dim + red tint | **Implementado** | |
| Warning Banner | **Implementado** | "ROADBLOCK AHEAD" con borde rojo |
| Timer Bar 2s | **Implementado** | Green→red gradient countdown |
| Dodge Buttons | **Implementado** | LEFT/RIGHT con borde azul y pulse |
| Cash Out Option | **Implementado** | Botón más pequeño debajo |
| Bonus Preview | **Implementado** | "+1.5x MULTIPLIER BONUS" |
| Timeout crash | **Implementado** | "TOO SLOW!" → crash inmediato |

### Screen 3 — Helicopter Spotlight
| Elemento | Status | Notas |
|---|---|---|
| Blue tint wash | **Parcial** | Beam se dibuja pero no hay wash azul general |
| Spotlight beam sweeping | **Implementado** | Cono animado left-right |
| Warning Card | **Implementado** | "SPOTLIGHT INCOMING" con borde azul |
| Multiplier reduced size | **NO** | Spec dice reducir a 42px — no cambia |
| Blue accent on multiplier | **Implementado** | `phase3` class cambia color |
| Cash Out blue variant | **Implementado** | Botón cambia a gradiente azul |

### Screen 4 — Ghost Mode (500x+)
| Elemento | Status | Notas |
|---|---|---|
| Entry animation (purple flash) | **Implementado** | Flash + badge aparece |
| Purple neon streaks | **Implementado** | Aura lightning + speed lines |
| Ghost Mode Badge | **Implementado** | Pill badge "GHOST MODE" |
| Multiplier 72px purple glow | **Implementado** | Pulse animation con clase `phase5` |
| Kash Quote | **Implementado** | "Five hundred times..." |
| Purple Cash Out | **Implementado** | Gradiente púrpura |
| Footer "You are in Ghost Mode..." | **NO** | Falta caption italic en footer |

### Screen 5 — Bust/Crash Screen
| Elemento | Status | Notas |
|---|---|---|
| Entry animation | **Parcial** | Partículas de crash, no animación cinemática de squad cars |
| "ROUND OVER" / "BUSTED" | **Implementado** | |
| Crash multiplier | **Implementado** | |
| Kash Quote por fase | **Parcial** | Hay 4 quotes fijas, spec pide que varíen por fase de crash |
| Result Card | **Implementado** | Bet, crash point, lost amount |
| On-chain hash | **NO** | No hay hash de verificación |
| RUN IT BACK button | **Implementado** | |
| History button | **NO** | Solo hay RUN IT BACK, falta botón de historial |

### Screen 6 — Bribe the Dispatcher (Buy Bonus)
**COMPLETAMENTE FALTANTE** — No existe ninguna pantalla de bribe. Todo el sistema de 3 tiers y la UI gold-tinted está pendiente.

---

## 3. VISUAL DESIGN (Sección 06 del Spec)

### IMPLEMENTADO
- [x] Paleta de color completa — todos los 9 colores del spec están en CSS variables
- [x] Deep Navy background
- [x] Chase Orange como color primario
- [x] Fases visuales diferenciadas — cielo, lluvia, overlays cambian por fase
- [x] Wet reflections en road (fase 2+)
- [x] Siren flash rojo/azul alternante

### PARCIAL
- [~] **Typography** — Usa Barlow Condensed + JetBrains Mono (spec dice system sans-serif para Pixi.js). Los tamaños son cercanos pero no exactos al spec.
- [~] **Environment por fase** — Sigue la dirección general pero faltan detalles: Phase 1 debería tener "warm orange street lamp glow", falta "puddle splash effects" en Phase 2.

### FALTANTE
- [ ] **Pixi.js rendering** — Todo el rendering usa Canvas 2D nativo, no Pixi.js/WebGL como indica el spec. Esto es significativo.
- [ ] **Bust screen backgrounds** — Spec pide imágenes de Kash por estado (LOCKED IN red-tinted para bust, CHILLIN' gold-tinted para bribe). No hay imágenes de personaje.
- [ ] **Kash visual on bike** — El rider es un dibujo genérico con casco. No es Kash (gorila con streetwear). No hay sprites/arte del personaje.

---

## 4. AUDIO (Sección 07 del Spec)

### IMPLEMENTADO
- [x] Engine sound — oscilador sawtooth que sube frecuencia con multiplicador
- [x] Crash SFX — sweep descendente
- [x] Cash out SFX — arpegio ascendente

### PARCIAL
- [~] **Countdown tick** — Implementado como tono simple, spec no lo detalla específicamente

### FALTANTE
- [ ] **Music tracks por fase** — No hay música. Spec pide lo-fi hip-hop base (85 BPM), trap escalando, 808 distorsionado en fase 4, EDM drop en Ghost Mode. Solo hay tones procedurales.
- [ ] **Roadblock SFX** — Hay un beep básico. Spec pide "tyre screech SFX, warning klaxon, beat pauses".
- [ ] **Nitro SFX** — Hay un beep. Spec pide "whoosh SFX + engine pitch spike".
- [ ] **Kash Voice acting** — No hay voiceover. Spec dice "Deep, slow, confident delivery. Full VO required for all lines in character bible."
- [ ] **Bribe screen audio** — No existe (no hay bribe screen). Spec pide "smooth jazz, phone ring, deal done chord".
- [ ] **Helicopter rotor sound** — No hay audio de helicóptero.

---

## 5. KASH AVATAR INTEGRATION (Sección 08 del Spec)

### IMPLEMENTADO
- [x] Kash quotes — Se muestran citas de Kash en overlay durante gameplay (roadblock, nitro, ghost mode, bust)

### PARCIAL
- [~] **3 mood states** — Los quotes están asociados a momentos pero no hay un sistema formal de estados CHILLIN'/LOCKED IN/BALLIN' que rote líneas del Character Bible. Solo hay líneas hardcodeadas.

### FALTANTE
- [ ] **Visual del personaje Kash** — El rider en la moto es genérico (casco + torso oscuro). No es un gorila con streetwear. No hay los 3 estados visuales del personaje.
- [ ] **Dialogue system completo** — El Character Bible tiene ~80+ líneas organizadas por trigger. El prototipo solo usa ~8 líneas fijas. Faltan: líneas de climbing por rango, reacciones a comportamiento del jugador (sesión larga, bet grande, racha), dad jokes aleatorios en idle, trash talk.

---

## 6. TECHNICAL REQUIREMENTS (Sección 09 del Spec)

### IMPLEMENTADO
- [x] HTML5 canvas rendering
- [x] Portrait 390x844 base resolution
- [x] Responsive en mobile (`@media max-width: 440px`)
- [x] Round state machine (IDLE → COUNTDOWN → RUNNING → CASHED_OUT/CRASHED)

### PARCIAL
- [~] **Multiplier update rate** — Spec dice 100ms. Prototipo usa `setInterval(gameTick, 80)` (80ms, ligeramente más rápido).

### FALTANTE
- [ ] **Pixi.js v7+ / WebGL** — Usa Canvas 2D nativo, no Pixi.js
- [ ] **60 FPS target** — Usa requestAnimationFrame (lo cual logra ~60fps), pero el rendering no está optimizado para dispositivos mid-range
- [ ] **Provably Fair RNG** — No hay SHA-256 hash chain, server seed, client seed, nonce. No hay on-chain verification.
- [ ] **Session persistence** — Spec dice "round history, best run, session P&L stored client-side per session". El prototipo mantiene datos en memoria pero no persiste (se pierde al refrescar).

---

## 7. PRIORIDADES DE IMPLEMENTACIÓN

### Prioridad Alta (Core del producto)
1. **Bribe the Dispatcher (Buy Bonus)** — Pantalla completa + mecánica de 3 tiers + efectos en gameplay. Es una de las métricas principales (KPI: >=15% conversion rate).
2. **Arte de Kash** — El personaje visible en la moto debe ser Kash (gorila con streetwear), no un rider genérico. Los 3 estados visuales son core del producto.
3. **Dialogue system** — Integrar las 80+ líneas del Character Bible con rotación por trigger y estado.
4. **Speedometer Arc** — UI element central del spec que no existe en el prototipo.

### Prioridad Media (Diferenciación)
5. **Música dinámica por fase** — Lo-fi → trap → EDM. Es lo que define la atmósfera del juego.
6. **Helicopter spotlight mechanic real** — Que el beam afecte la probabilidad de crash, no solo sea visual.
7. **Migración a Pixi.js** — El spec pide WebGL rendering. Canvas 2D es suficiente para prototipo pero no para producción.
8. **Nitro bar + USE button** — En vez de tap-to-collect, sistema de carga.
9. **History button + session history screen** — Falta en bust screen.
10. **Ghost Mode footer** — "You are in Ghost Mode. They cannot catch you."

### Prioridad Baja (Polish / Producción)
11. **Provably Fair (SHA-256 hash chain)** — Requiere backend. Para producción.
12. **Kash Voice acting** — Requiere grabación de VO.
13. **On-chain verification** — Requiere infraestructura blockchain.
14. **Bust screen cinemáticas** — Animaciones diferentes por fase de crash.
15. **Session persistence** — LocalStorage para historial.
16. **Splash effects** — Charcos en fase 2, detalles ambientales.

---

## 8. LO QUE EL PROTOTIPO HACE BIEN

- La estructura general del juego es sólida — el loop bet→countdown→run→crash/cashout funciona
- Las 5 fases con transiciones visuales son claras y dramáticas
- Los roadblocks son funcionales y tensos
- La paleta de color es 100% fiel al spec
- El rendering 3D perspectivo de la carretera es convincente
- Las mecánicas de nitro y dodge funcionan
- El UI bottom section con betting, quick bets, auto cashout está bien hecho
- El helicopter beam es visualmente efectivo
- Ghost Mode tiene impacto visual con lightning aura y purple palette

---

*Auditoría realizada el 6 de abril de 2026.*
