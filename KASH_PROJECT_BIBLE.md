# KASH PROJECT BIBLE

Documento consolidado de toda la documentación del proyecto Kash, extraído del shared drive `18 - Kash - Game Studio`.

---

## 1. RESUMEN EJECUTIVO

**Kash Games** es un estudio independiente de desarrollo de juegos para casinos online (B2B) con un diferenciador estructural: todos sus títulos forman parte de un **universo narrativo conectado**, protagonizado por **Kash**, un gorila callejero con estética streetwear.

El estudio combina dos pilares:
- **Juegos de casino** (crash, arcade, slots) distribuidos a operadores globales vía aggregators
- **Canal de YouTube** con contenido animado CGI que narra la historia de Kash en sincronía con cada lanzamiento

**Empresa:** SAMSA PRODUCTIONS SAS (Colombia)
**Categoría Crea Digital:** Desarrollo de Narrativas Transmedia
**Versión:** 1.0 - Marzo 2026

---

## 2. EL UNIVERSO NARRATIVO

### Premisa Central

Londres, 2026. El Imperio Japonés lleva ochenta años controlando el mundo no con tanques sino con tecnología, deuda y cultura. En los márgenes vive **Kash**: un primate de segunda generación que creció sin bando, sin certezas y con una habilidad natural para leer las reglas de cualquier juego.

### Ejes Temáticos

- **Identidad vs. sistema:** Kash no encaja en ninguna categoría — demasiado primate para los humanos, demasiado occidental para el Imperio
- **El riesgo como lenguaje:** El juego es el idioma del underground, cada apuesta es un acto de agencia
- **La herencia como carga:** Su padre fue un veterano del Proyecto Komori que desertó
- **Control a través de la dependencia:** El Imperio controla con deuda, tecnología y dependencia cultural — metáfora del colonialismo económico

### Arquitectura Transmedia (3 capas)

| Formato | Función | Diferencial |
|---|---|---|
| **10 juegos interactivos** (crash, arcade, slot) | Núcleo de experiencia. Cada título es un mundo que el usuario habita y domina | Agencia — la mecánica ES la metáfora narrativa |
| **Web series vertical** (21 eps, 3 temporadas, <60 seg) | Capa narrativa. Narra las decisiones de Kash en tiempo real | Profundidad de personaje y contexto emocional |
| **Canal YouTube** | Fidelización. Vlogs en personaje, documentales, cortometrajes | Audiencia propia independiente de operadores |

---

## 3. PERSONAJES PRINCIPALES

### KASH — Protagonista

- **Especie:** Gorila — but make it streetwear
- **Rol:** In-game host, hype man, comedian, companion
- **Personalidad:** Un gorila grande e intimidante que cuenta dad jokes. Ese contraste ES el chiste.
- **Voz:** Profunda, confiada, laid-back — como si fuera el dueño del lugar
- **Rasgos:** Nunca se altera. Nunca desesperado. Disfruta genuinamente la compañía del jugador. Roast con amor.
- **Look:** Hoodie, pantalones cargo, cadena de oro, snapback dorado, gafas de lentes rosas
- **Arco (21 eps):** De superviviente reactivo a outsider que construye su propia posición. No derrota al Imperio: aprende a volverse indispensable a pesar de él.

### Tres Estados Emocionales de Kash

| Estado | Trigger | Energía |
|---|---|---|
| **BALLIN'** | Big win, cash-out, jackpot, leaderboard, Ghost Mode (500x+) | Explosivo, celebratorio, ligeramente caótico |
| **CHILLIN'** | Entre rondas, baja actividad, lobby, inicio sesión | Smooth, unbothered, laid-back — modo entertainer default |
| **LOCKED IN** | Ronda activa, multiplicador >2x, bet grande, racha, roadblock | Intenso, enfocado, competitivo. Trash talk al máximo |

### YORI — Antagonista Cercano
Primate de primera generación, veterano del Proyecto Komori. Cree en el Imperio con convicción casi religiosa. Envidia la libertad de Kash.

### REX — Aliado
Humano americano, descendiente de los derrotados de 1945. Conectado a una resistencia que Kash rechaza. Representa la trampa ideológica de elegir bando.

### MINISTRO TANAKA — Antagonista Sistémico
Representante del Imperio en Europa. Elegante, frío. No amenaza: ofrece. El antagonista más peligroso porque opera desde una lógica impecable.

---

## 4. KASH RUNDOWN — GAME 1 (Especificación Completa)

### Overview

| Campo | Valor |
|---|---|
| **Título completo** | Kash Rundown |
| **Tipo** | Burst / Crash Game |
| **Tema** | Urban Street, Night City, Police Chase |
| **Avatar** | Kash en una moto robada |
| **Premisa** | Kash es perseguido por una ciudad de neón bajo la lluvia. El multiplicador es su velocímetro. |
| **Plataforma** | Mobile first (portrait 390x844), responsive desktop |
| **Frontend** | Pixi.js, WebGL rendering, HTML5 |
| **Licencia** | Curazao B2B (LOK framework) |
| **Provably Fair** | Sí — hash on-chain verificable |

### Parámetros Matemáticos

| Parámetro | Valor |
|---|---|
| **RTP objetivo** | 95-97% |
| **Volatilidad** | Alta |
| **Min Bet** | $0.10 |
| **Max Bet** | $500 |
| **Max Multiplier** | x8,000 |
| **Duración de ronda** | 10-35 seg |
| **House Edge** | 3-5% según district y bribe tier |
| **Distribución de crash** | Exponencial, media ~3x |

### Sistema de 5 Fases (Chase Intensity)

| Fase | Nombre | Multiplicador | Mood de Kash | Entorno |
|---|---|---|---|---|
| 1 | **Clean Run** | 1x - 3x | CHILLIN' | Calle seca, sirenas lejanas, ritmo relajado |
| 2 | **First Siren** | 3x - 10x | LOCKED IN | Lluvia comienza. Un carro policial. Luces rojas/azules |
| 3 | **Chopper Up** | 10x - 50x | LOCKED IN | Lluvia fuerte. Helicóptero con reflector. Dos carros |
| 4 | **Full Pursuit** | 50x - 500x | LOCKED IN | Tormenta. Tres carros. Helicóptero fijo. Roadblocks frecuentes |
| 5 | **Ghost Mode** | 500x - 8,000x | BALLIN' | Lluvia para. Aura púrpura neón. Ciudad borrosa. Policía desapareció |

### Mecánicas Principales

#### Roadblock Events (3x, 10x, 50x)
- Ventana de 2 segundos: DODGE LEFT o DODGE RIGHT
- Dodge correcto: +1.5x bonus
- Dodge incorrecto: pausa de 1 segundo
- Sin respuesta: crash inmediato
- Más frecuentes y rápidos en fases 4-5

#### Helicopter Spotlight (desde fase 3)
- Reflector barre la pantalla aleatoriamente (seed provably fair)
- Si encuentra a Kash: probabilidad de crash sube drásticamente por 3 seg
- El jugador decide: cash out o apostar a que no lo encuentra

#### Corrupt Cop Bribe / Buy Bonus (pre-ronda, 3 tiers)

| Tier | Costo | Efecto |
|---|---|---|
| **Small** | $5 | Retrasa primer evento 10%, 1 ventana segura garantizada |
| **Medium** | $25 | Retrasa + menor probabilidad de crash, mejor valor |
| **Kingpin** | $100 | Blackout total del dispatcher + nitro garantizado al inicio |

#### Nitro Boost
- Canister aparece aleatoriamente en la carretera
- Tap = salto instantáneo de +0.5x a +3x
- Frecuencia: ~15%/seg en fases 1-2, baja a ~4% en fases 4-5
- Ghost Mode con Kingpin: nitro garantizado al inicio

### Paleta de Color

| Color | Hex | Uso |
|---|---|---|
| Deep Navy | `#0F0F1E` | Background principal, superficies UI oscuras |
| Chase Orange | `#EA580C` | CTA principal, multiplicador, velocímetro |
| Siren Red | `#EF4444` | Roadblocks, crash/bust, lavado de sirena |
| Police Blue | `#2563EB` | Fase helicóptero, botones dodge |
| Ghost Purple | `#7B2FBE` | Ghost Mode (500x+), fase 5 |
| Go Green | `#16A34A` | Indicadores de profit, nitro ready |
| Bribe Gold | `#EAB308` | Pantalla de bribe, mecánica corrupt cop |
| White | `#FFFFFF` | Texto principal, dígitos del multiplicador |
| Muted Grey | `#505064` | Texto secundario, labels, UI inactiva |

### Audio

| Elemento | Especificación |
|---|---|
| Fase 1 | Lo-fi hip-hop / trap, ~85 BPM, groove urbano relajado |
| Fase 2 | Bass drop, ~100 BPM, capa de sirena, engine roar |
| Fase 3 | Full trap beat, rotor de helicóptero, sirenas intensas |
| Fase 4 | Máxima intensidad, 808 distorsionado, múltiples sirenas |
| Ghost Mode | 1.5 seg silencio, luego: EDM drop eufórico, synth arpeggios púrpura |
| Cash Out | SFX caja registradora + sting celebratorio + reacción de Kash |
| Crash/Bust | Screech + impacto, música corta abruptamente, radio policial |
| Bribe Screen | Smooth jazz / lo-fi, ring de teléfono, acorde "deal done" |

### KPIs a 6 Meses

| KPI | Target |
|---|---|
| Monthly GGR | $100,000 - $200,000 |
| Distributing Operators | 10-20 vía Hub88 |
| D7 Player Retention | >= 28% |
| Average Session Length | 18-25 min |
| Time to First Revenue | <= 90 días post-launch |
| Bribe Conversion Rate | >= 15% de rondas |
| Ghost Mode Trigger Rate | < 0.5% de rondas |

---

## 5. PORTFOLIO COMPLETO — 10 JUEGOS

| # | Título | Tipo | Concepto |
|---|---|---|---|
| 01 | **Kash Rundown** | Crash game | Persecución policial en moto por ciudad cyberpunk. Multiplicador = velocímetro |
| 02 | **Plinko Urbano** | Ball drop (Plinko) | Bola cae por tablero con obstáculos urbanos. Zonas = barrios con multiplicadores distintos |
| 03 | **Chain Reaction** | Crash (skin crypto) | Multiplicador = gráfico de velas. Cash out antes del rug pull. Hash on-chain |
| 04 | **Kash: Origin** | Slot narrativo (6x4 cascading) | Historia de origen en 5 actos. Bonus desbloquea capítulos |
| 05 | **Genesis Protocol** | Slot moderno (5x5 ways-to-win) | Minería de nodos. Cada giro genera hash real. Fork Mode, Consensus Wilds, Genesis Block jackpot |
| 06 | **Black Market** | Arcade | Mesa de intercambio underground. Compra/vende info contra el reloj imperial |
| 07 | **Ronin** | Crash (duelo 1v1) | Kash vs Yori. Dos multiplicadores simultáneos. Cash out antes de que Yori te elimine |
| 08 | **Tokyo Underground** | Slot (4x5 cascading con expansión) | Kash llega al Imperio. Reels se expanden revelando capas: fachada, mercado negro, túneles |
| 09 | **Komori Files** | Slot narrativo (3x3 progresivo) | Descifra archivos del Proyecto Komori. Combinaciones ganadoras revelan la historia del padre |
| 10 | **The House** | Crash (torneo multiplayer) | Casa de juego imperial. Multiplicador colectivo. Si alguien sale, el de todos colapsa |

---

## 6. WEB SERIES — 21 EPISODIOS

### Temporada 1 — El Fugitivo (Eps 01-08)

| Ep. | Título | Sinopsis |
|---|---|---|
| 01 | The Odds | Kash gana apuesta callejera en Londres. Alguien lo observa desde lejos |
| 02 | The Letter | Recibe orden de conscripción imperial. La quema. Rex lo ve |
| 03 | Old Blood | Visita el cuarto de su padre. Encuentra algo que no debería existir |
| 04 | Yori | Yori aparece en su puerta. Primera confrontación |
| 05 | Double or Nothing | Apuesta con la info del cuarto. Sale mal |
| 06 | Rex Knows | Rex revela su conexión con la resistencia americana |
| 07 | Tanaka | Primera aparición del Ministro. No amenaza: ofrece |
| 08 | The House Always Wins | Kash toma una decisión. Abre la Temporada 2 |

### Temporada 2 — El Precio (Eps 09-16)

| Ep. | Título | Sinopsis |
|---|---|---|
| 09 | Consequences | Descubre qué activó su decisión de S1. Alguien más busca lo mismo |
| 10 | The Veteran | Encuentra sobreviviente del Proyecto Komori que conoció a su padre |
| 11 | Yori's Terms | Yori regresa con propuesta concreta. Negocia, no amenaza |
| 12 | The Network | Rex muestra el borde de la red de resistencia. Alguien lo reconoce |
| 13 | Underground | Mercado negro del Imperio. Transacción sale mal |
| 14 | Tanaka's Office | Kash busca al Ministro. Tanaka ya lo sabía |
| 15 | The File | Accede a archivos del Proyecto Komori. Lo de su padre no es heroico ni simple |
| 16 | Burn It Down | Elige entre lo encontrado y lo posible. Acción irreversible. El Imperio responde |

### Temporada 3 — La Leyenda (Eps 17-21)

| Ep. | Título | Sinopsis |
|---|---|---|
| 17 | Wanted | Kash se vuelve objetivo visible. El underground lo mira |
| 18 | Alliances | Negocia con tres partes que se excluyen mutuamente |
| 19 | Komori's Son | El Imperio usa la historia de su padre contra él. Kash responde con narrativa |
| 20 | The Offer | Tanaka hace la oferta definitiva. Es genuinamente buena. Ese es el problema |
| 21 | Underground Legend | Kash rechaza la oferta. No por idealismo. Construye algo propio en las grietas del sistema |

---

## 7. LÍNEAS DE DIÁLOGO DE KASH (Selección)

### Gameplay — Round Start (LOCKED IN)
- "Bet's in. Clock's ticking. Let's see what you're made of."
- "Every legend started with one bet. No pressure though."

### Multiplier 2x-5x (LOCKED IN)
- "It's going up. Don't get greedy. ...Actually, get a little greedy."
- "Hold. HOLD. I'm not telling you what to do. I'm just saying. Hold."

### Multiplier >10x (BALLIN')
- "OKAY. OKAY. OKAY. I need a moment."
- "If you cash out now I'll never talk to you again. (Please cash out.)"

### Big Win Cash Out (BALLIN')
- "YOOOO. You actually did it. I believed in you. (I did not believe in you.)"
- "SECURED. THE. BAG."

### Crash/Loss (CHILLIN')
- "That's not a loss. That's tuition. You're learning. Very expensively."
- "The market spoke. It said no. Respectfully."

### Kash Rundown Specific
- **Round start:** "They sent TWO cars. Two. Do they know who I am? Rhetorical question. Let's ride."
- **Roadblock:** "ROADBLOCK. LEFT OR RIGHT. I would suggest left but I'm not driving. You are. Technically."
- **Helicopter:** "The chopper's up. Don't look at the light. Whatever you do. Don't. Look. At. The. Light."
- **Nitro:** "NITROOOOO — okay we're going faster now. That's on you. I support it."
- **Ghost Mode:** "Five hundred times. FIVE HUNDRED. The whole city is looking for us and I have never felt more alive."
- **Bust:** "They got us. It happens to the best. I am the best. So this is fine."
- **Big cash-out:** "Into the alley. Gone. They never saw us. Nobody saw us. Screenshot this."
- **Dad joke (idle):** "Why did the criminal fail his driving test? He couldn't stop breaking the law." [complete silence]

### Trash Talk (selección)
- "Wow. The minimum. You really went for it."
- "1.1x. Living on the edge I see. The very flat, very safe edge."
- "My grandma plays higher than this. She's 84. She's also winning."
- "I believe in you. Mostly. Like 60/40. Okay 55/45. The point is I believe."

---

## 8. DISEÑO VISUAL

### Opciones de Personaje (en evaluación)

#### Opcion A — Gorila ("Cashing Out")
- Semi-realista, concept art AAA, iluminación volumétrica
- Ventaja: silueta que domina el frame, contraste máximo con el humor
- Referencia crypto: King Kong, BAYC, Gorillaz

#### Opcion B — Chimpance ("Street")
- Flat/vectorial, arte urbano, comic book, hip-hop poster
- Ventaja: mayor rango expresivo facial, mejor para animación 2D
- Referencia cultural: Supreme, BAPE, Stussy, Hebru Brantley

**Nota:** No son excluyentes. El canon puede establecer gorila como primario y estilo street como skin alternativa.

### Referencias Visuales Generales
- **Cyberpunk 2077** — Night City aesthetic, contraste neon/dark
- **Arcane / League of Legends** — Stylized 3D con detalle pictórico
- **Stake.com** — UX crypto-native minimalista
- **Nike x Off-White** — Streetwear premium, tipo industrial

### Estilo de la Web Series
- Londres gris y húmedo intervenido por neón japonés
- Formato 9:16 nativo (no adaptación de horizontal)
- Cada episodio < 60 segundos, una sola escena continua
- Cortes duros, sin transiciones decorativas

---

## 9. MODELO DE NEGOCIO

### Revenue Model
- **B2B:** Juegos licenciados a operadores de casino online vía aggregators
- **Revenue share** sobre GGR: ~8-16% neto vía aggregator
- **Canal YouTube:** Monetización directa + pipeline de adquisición de jugadores

### Distribución (3 fases)

| Fase | Periodo | Aggregator | Operadores | Foco |
|---|---|---|---|---|
| **Entrada** | 0-6 meses | Hub88 | Stake.com, Sportsbet.io, 1xBet | 2-3 títulos, validación |
| **Expansión** | 6-12 meses | + Relax Gaming, SOFTSWISS, Slotegrator | Betsson, Pinnacle | Aplicación MGA |
| **Consolidación** | 12-24 meses | MGA activa | LeoVegas, Betsson directo, tier-1 EU | 6-8 títulos, LatAm localizado |

### Socios Establecidos
- **The Fortune Engine (Australia):** Backend validado. Representante con todos los juegos de Kash
- **Dante Media (España):** Red de relaciones con principales operadores
- **Whale.io y Stake.com:** Acuerdo en proceso

### Ruta Regulatoria
- **Fase 1:** Curazao B2B (LOK) — ~€24,000/año, 4-8 semanas aprobación
- **Fase 2 (12 meses):** Solicitud MGA para operadores tier-1 europeos

---

## 10. ANÁLISIS COMPETITIVO

### Nichos Sin Dueño (oportunidad Kash)

1. **Crash games con estética urbana/street culture** — Segmento dominado por metáforas genéricas (Aviator, JetX, SpaceMan)
2. **Narrativa story-driven en iGaming** — No existe universo transmedial en el sector
3. **Contenido viral / streamer-first** — Nadie ha construido canal propio para complementar
4. **LatAm-first localizado** — Títulos en español/portugués con referencias culturales regionales son escasos
5. **Tournament-native design** — Ninguno ha construido torneos como pilar de diseño central

### Benchmarks de la Industria (Top 15 estudios B2B)

| Posición | Estudio | Revenue Est. (USD M) |
|---|---|---|
| 1 | IGT | 2,512 |
| 2 | Playtech | 1,960 |
| 3 | Play'n GO | 750 |
| 6 | Hacksaw Gaming | 150 |
| 11 | Nolimit City | 70 |
| 15 | Quickspin | 35 |
| **Total Top 15** | | **~6,822** |

**Contexto de adquisiciones:** Nolimit City fue adquirido por 340M EUR, BTG por 172M GBP, Red Tiger por 200M GBP — múltiplos de 5x a 15x revenue.

---

## 11. AUDIENCIA OBJETIVO

### Perfil Primario
- Hombres y mujeres de **18-35 años**
- Nativos digitales, consumo vertical, cripto-native
- Consume streetwear, hip-hop, cultura urbana y cripto simultáneamente
- No encuentra ese universo representado en iGaming

### Perfil Secundario
- **Streamers y creadores de contenido** que necesitan productos con personalidad propia y momentos compartibles

### Perfil Terciario
- **Operadores y agregadores** que buscan diferenciación y una IP con audiencia propia

---

## 12. ROADMAP

### Q2 2026 (Abril-Mayo) — Fundamentos
- Constitución legal y cuenta bancaria corporativa
- Solicitud licencia Curazao B2B
- Desarrollo completo de Kash Rundown (Game 1)
- Style Guide, Brand Guidelines, Character Bible
- Primer cortometraje YouTube (sincronizado con Game 1)
- Outreach a Hub88, Relax Silver Bullet, SOFTSWISS

### Q3 2026 — Primer Lanzamiento
- Lanzamiento Kash Rundown en Hub88 (ecosistema Stake.com)
- Canal YouTube con primeros 4 episodios
- Inicio desarrollo Game 2
- Primera iteración basada en datos de Game 1

### Q4 2026 — Expansión Inicial
- Lanzamiento Game 2
- Expansión a Relax Gaming y SOFTSWISS
- Canal YouTube consolidado: 2-3 piezas/semana
- Inicio solicitud MGA

### 2027 — Escala
- Games 3-5 en desarrollo y lanzamiento
- MGA activa — operadores EU tier-1
- Expansión LatAm con títulos localizados
- Canal YouTube con comunidad establecida

---

## 13. EQUIPO DE PRODUCCIÓN (21 personas)

| Área | Rol | Cantidad |
|---|---|---|
| **Dirección** | Director Creativo | 1 |
| | Director de Animación | 1 |
| | Director de Desarrollo | 1 |
| **Producción AV** | Animadores CGI | 4 |
| | Diseñadores Gráficos | 3 |
| | Sonidista/Diseñador Audio | 1 |
| | Posproductor | 1 |
| **Desarrollo Juegos** | Programadores Frontend (Pixi.js) | 3 |
| | Programadores Backend | 2 |
| **Gestión** | Project Managers | 2 |
| | Contador | 1 |
| **Contenido** | Content Planner | 1 |
| | Community Manager | 1 |

---

## 14. GESTIÓN DE RIESGOS

- **Regulación:** Operación bajo Curazao (LOK), estructura B2B distribuye riesgo
- **Concentración en pocos operadores:** Canal YouTube genera audiencia independiente
- **Saturación estética:** La diferenciación cultural es estructural, no replicable con cambio de paleta
- **Riesgo de extensión:** Biblia del universo y sistema de estados documentado mitigan dispersión creativa

---

## 15. IMPACTO (ODS)

- **ODS 8:** Trabajo decente — 21 empleos especializados en industria creativa digital en Colombia
- **ODS 9:** Innovación — Pixi.js/WebGL, provably fair on-chain, pipeline CGI + flat design
- **ODS 10:** Reducción desigualdades — Personaje outsider y marginal como protagonista de IP global
- **ODS 17:** Alianzas — Coproducción con socios en España, Australia y mercado global

---

## 16. ESTRUCTURA DE ARCHIVOS (Shared Drive)

```
18 - Kash - Game Studio/
├── kash_ficha_v4.docx              — Ficha Crea Digital (versión principal)
├── kash_ficha_v2.gdoc              — Ficha v2 (Google Docs)
├── kash_ficha_v6.gdoc              — Ficha v6 (Google Docs)
├── 01 - Materiales/
│   ├── Kash_Character_Bible_1.docx — Character Bible v1 (inglés)
│   ├── Kash_Character_Bible_2.docx — Character Bible v2 (inglés + visual spec)
│   ├── Multipliers.gdoc
│   └── Setup/
│       ├── Kash_Rundown_Game_Spec.docx         — Game Design Spec completo
│       ├── Game Design Brief.docx               — Template brief de diseño
│       ├── Kash_Games_Brief_General.docx        — Brief general del estudio
│       ├── X1Games_Game_Design_Brief_Completed.docx — Brief completado
│       ├── XGames_Game_Concept_Compendium.docx  — Compendio 5 juegos
│       ├── XGames_Industry_Competitive_Analysis_Completed.docx
│       ├── Industry & Competitive Analysis Brief.docx
│       ├── Analisis_Competencia_iGaming_2026.pdf
│       └── proveedores_casino_db.xlsx
├── 02 - Narrativo/
│   ├── Co_crea Kash_Game_Studio.gdoc
│   ├── Kash_Game_Studio_Creative_Brief.gdoc
│   └── Story Cinematica 1/                     — Bocetos de personaje (PNG)
├── 03 - Producción/
│   └── Creadigital/
│       ├── articles-428441_recurso_1.docx       — Doc Crea Digital
│       ├── articles-428442_recurso_1.xlsx       — Plantilla presupuesto + cronograma
│       ├── Cronograma_Produccion_Abril_Mayo_2026.xlsx
│       ├── Production_Schedule_April_May_2026.xlsx
│       ├── Arte/Referencias/
│       ├── Game 1/Prototype/
│       └── En formulario.gdoc
└── 04 - Motion/
    └── kash_rundown_script.gdoc
```

---

*Documento generado el 6 de abril de 2026. Fuente: Shared Drive "18 - Kash - Game Studio", SAMSA PRODUCTIONS SAS.*
