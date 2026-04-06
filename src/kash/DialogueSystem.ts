import type { KashMood } from '../game/types';

interface DialogueBank {
  [trigger: string]: string[];
}

const ROUND_START: string[] = [
  "Bet's in. Clock's ticking. Let's see what you're made of.",
  "Ooooh you went big. I respect it. I also can't watch.",
  "The multiplier doesn't know you yet. Introduce yourself.",
  "Every legend started with one bet. No pressure though.",
  "I've seen this movie before. Sometimes it ends well.",
];

const CLIMBING_LOW: string[] = [
  "It's going up. Don't get greedy. ...Actually, get a little greedy.",
  "2x already. Your ancestors are watching.",
  "Easy money. Just don't blow it. You're gonna blow it aren't you.",
  "Hold. HOLD. I'm not telling you what to do. I'm just saying. Hold.",
  "The multiplier climbing is my cardio. I don't need the gym.",
];

const CLIMBING_MID: string[] = [
  "Okay NOW I'm invested. This is personal.",
  "Five x and rising. My palms are sweaty and I don't even have palms. I have paws.",
  "The crowd is going bananas. Literally. I'm the crowd.",
  "This is the part of the movie where the music gets louder.",
  "At this point the multiplier has a personality. Her name is Opportunity.",
];

const CLIMBING_HIGH: string[] = [
  "OKAY. OKAY. OKAY. I need a moment.",
  "Ten times. TEN TIMES. I'd hug you but I'd crush you.",
  "This is historic. Write this down. I'm serious, screenshot it.",
  "The gorilla is going feral. That's me. I'm the gorilla.",
  "If you cash out now I'll never talk to you again. (Please cash out.)",
];

const CASHOUT_BIG: string[] = [
  "YOOOO. You actually did it. I believed in you. (I did not believe in you.)",
  "Secured. The. Bag. Say it with me. SECURED. THE. BAG.",
  "That's what discipline looks like. Or luck. Probably luck. Either way, legendary.",
  "The people who left early are sick right now. You? You're eating.",
  "Kash approves this message. Frame it. Put it on the wall.",
];

const CASHOUT_SMALL: string[] = [
  "Smart. Boring, but smart. I respect the risk management.",
  "Took the 1.3x. The 1.3x guy. That's you. You're the 1.3x guy.",
  "Safe and steady. Like a savings account. At a casino.",
  "Your accountant would be proud. Your hype man less so.",
  "You played it safe. The multiplier went to 47x after. But you didn't know that.",
];

const CRASH: string[] = [
  "They got us. It happens to the best. I am the best. So this is fine.",
  "It crashed. As crashes do. This is the crash game. You knew the risks.",
  "The market spoke. It said no. Respectfully.",
  "One day you'll tell your grandkids about this bet. Leave out this part.",
  "That's not a loss. That's tuition. You're learning. Very expensively.",
];

const LOSING_STREAK: string[] = [
  "Three in a row. The algorithm is not your friend today.",
  "You're not on a losing streak. You're building a comeback story.",
  "I've seen worse. I've also seen better. Both are true.",
  "The next one's yours. I have no data to support that but I feel it.",
  "Deep breaths. In through the nose, out through the wallet.",
];

const WINNING_STREAK: string[] = [
  "Three for three. You're not lucky. You're CHOSEN.",
  "The multiplier respects you now. It's scared actually.",
  "I'm not saying you found the cheat code. I'm just saying. You found the cheat code.",
  "At what point do we call it skill? I think we're there.",
  "This is the run. THE run. Where you tell people 'I had a run once.'",
];

const DAD_JOKES: string[] = [
  "Why did the criminal fail his driving test? He couldn't stop breaking the law.",
  "I told my financial advisor I wanted to invest in crypto. He said 'Bitcoin?' I said 'No, I'll buy the whole coin.'",
  "What do you call a gorilla who wins at poker? A full house. Get it? Because I live here.",
  "Why don't multipliers ever go on vacation? They're always working overtime.",
  "I asked the multiplier for advice. It said 'go up.' Very inspiring. Very unhelpful.",
];

const RUNDOWN_SPECIFIC: Record<string, string> = {
  round_start: "They sent TWO cars. Two. Do they know who I am? Rhetorical question. Let's ride.",
  roadblock: "ROADBLOCK. LEFT OR RIGHT. I would suggest left but I'm not driving. You are. Technically.",
  helicopter: "The chopper's up. Don't look at the light. Whatever you do. Don't. Look. At. The. Light.",
  nitro: "NITROOOOO — okay we're going faster now. That's on you. I support it.",
  bribe_confirm: "Dispatcher's been handled. You didn't hear that from me. You heard it from me.",
  ghost_mode: "Five hundred times. FIVE HUNDRED. The whole city is looking for us and I have never felt more alive.",
  bust: "They got us. It happens to the best. I am the best. So this is fine.",
  big_cashout: "Into the alley. Gone. They never saw us. Nobody saw us. Screenshot this.",
};

const TRASH_TALK: string[] = [
  "Wow. The minimum. You really went for it.",
  "1.1x. Living on the edge I see. The very flat, very safe edge.",
  "My grandma plays higher than this. She's 84. She's also winning.",
  "I'd say you're playing it safe but I'm not sure that's a compliment.",
  "The leaderboard doesn't know your name yet. Fix that.",
  "You came all the way here to do... that? Interesting.",
  "I believe in you. Mostly. Like 60/40. Okay 55/45. The point is I believe.",
  "Other players are watching. No they're not. But what if they were?",
];

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export class DialogueSystem {
  getLine(trigger: string, multiplier?: number): string {
    // Rundown-specific lines first
    if (trigger in RUNDOWN_SPECIFIC) {
      return RUNDOWN_SPECIFIC[trigger];
    }

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
