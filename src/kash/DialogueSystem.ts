const ROUND_START: string[] = [
  "Let's ride. No brakes, no regrets.",
  "Engine's hot. So is the money.",
  "They don't know who they're chasing.",
  "One way in. Cash out is the only exit.",
  "Clock's ticking. Make it count.",
];

const CLIMBING_LOW: string[] = [
  "Easy money... for now.",
  "Keep going or keep it? Your call.",
  "The smart ones cash out here. The legends don't.",
  "Two x and climbing. Feel that?",
  "Don't look back. Only forward.",
];

const CLIMBING_MID: string[] = [
  "Now we're talking. FIVE TIMES.",
  "The road is yours. Own it.",
  "They're sending backup. Good.",
  "This is where it gets real.",
  "Your heart's racing. Mine doesn't. Gorilla thing.",
];

const CLIMBING_HIGH: string[] = [
  "TEN. TIMES. Say it again.",
  "The city's watching. Give them a show.",
  "I've seen players fold at 3×. You? Built different.",
  "At this point it's not money. It's a statement.",
  "Cash out or ride the lightning. No wrong answers. Okay maybe one.",
];

const CASHOUT_BIG: string[] = [
  "SECURED. Into the shadows. Gone.",
  "That's not a win. That's a heist.",
  "Screenshot that. Frame it. Retire it.",
  "The gorilla approves. And the gorilla is hard to impress.",
  "Clean getaway. They never saw us.",
];

const CASHOUT_SMALL: string[] = [
  "Smart. Boring. But smart.",
  "A win is a win. Even a tiny one.",
  "Safe hands. Your accountant would be proud.",
  "Small bag but it's YOUR bag.",
  "Calculated. I respect it. Barely.",
];

const CRASH: string[] = [
  "They got us. Next time we won't stop.",
  "The road always wins eventually. But so do we.",
  "Down but not out. Never out.",
  "That crash? Just a plot twist.",
  "Dust yourself off. The city never sleeps and neither do we.",
];

const LOSING_STREAK: string[] = [
  "Three in a row. The comeback is going to be insane.",
  "Bad luck or bad timing? Either way, it's temporary.",
  "Even legends have off days. This is yours.",
  "The road owes you one. Collect next round.",
  "Pain is temporary. The story is forever.",
];

const WINNING_STREAK: string[] = [
  "Three wins. You're not lucky, you're dangerous.",
  "They should name a street after this run.",
  "On fire. Literally, metaphorically, financially.",
  "The multiplier fears you now.",
  "Keep going. History is watching.",
];

const DAD_JOKES: string[] = [
  "Why did the gorilla cross the road? Because the multiplier was on the other side.",
  "My financial advisor said diversify. So I bet on red AND on crash games.",
  "I told the police they'd never catch me. Technically true at 500×.",
  "What's a gorilla's favorite investment? Banana splits. I'll see myself out.",
  "They say money can't buy happiness. They never hit 50×.",
];

const RUNDOWN_SPECIFIC: Record<string, string> = {
  round_start: "Engine on. Lights off. Let's go.",
  roadblock: "ROADBLOCK. But we don't stop.",
  helicopter: "Chopper's up. Stay cool. Stay fast.",
  nitro: "NITRO HIT — hold on tight.",
  ghost_mode: "500×. We're invisible now. INVISIBLE.",
  bust: "Caught. But the legend lives on.",
  big_cashout: "Gone. Vanished. Only the money proves we were here.",
};

const TRASH_TALK: string[] = [
  "That bet? My goldfish bets bigger.",
  "1.1×. The adrenaline must be unbearable.",
  "Playing it safe in a crash game. Bold strategy.",
  "The leaderboard doesn't even know your name.",
  "Go big or go home. You're almost home.",
  "I've seen more risk in a coin flip.",
  "Somewhere out there, someone just hit 100×. Not you though.",
  "Bet like nobody's watching. Because they're not.",
];

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export class DialogueSystem {
  getLine(trigger: string, multiplier?: number): string {
    if (trigger in RUNDOWN_SPECIFIC) return RUNDOWN_SPECIFIC[trigger];

    switch (trigger) {
      case 'round_start': return pickRandom(ROUND_START);
      case 'climbing':
        if (multiplier && multiplier >= 10) return pickRandom(CLIMBING_HIGH);
        if (multiplier && multiplier >= 5) return pickRandom(CLIMBING_MID);
        return pickRandom(CLIMBING_LOW);
      case 'cashout_big': return pickRandom(CASHOUT_BIG);
      case 'cashout_small': return pickRandom(CASHOUT_SMALL);
      case 'crash': return pickRandom(CRASH);
      case 'losing_streak': return pickRandom(LOSING_STREAK);
      case 'winning_streak': return pickRandom(WINNING_STREAK);
      case 'dad_joke': return pickRandom(DAD_JOKES);
      case 'trash_talk': return pickRandom(TRASH_TALK);
      default: return pickRandom(DAD_JOKES);
    }
  }

  getBustQuote(): string {
    return pickRandom(CRASH);
  }

  getRundownLine(key: string): string {
    return RUNDOWN_SPECIFIC[key] || pickRandom(DAD_JOKES);
  }
}
