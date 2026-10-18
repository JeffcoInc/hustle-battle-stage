import type { Look } from "./combat.ts";
import type { CastMember } from "./engine.ts";

/** Same shape as RolledFighter in src/nation/crew-roster.ts. */
export interface CrewCard {
  id: string;
  name: string;
  gender: "female" | "male";
  portrait: string;
  class: "security" | "scout" | "negotiator" | "hacker" | "driver" | "fixer";
  tier: "normal" | "uncommon" | "rare" | "legendary";
  stats: { power: number; stealth: number; tech: number; charisma: number; loyalty: number };
  hpPoints: number;
  role: string;
  quote: string;
  /** Painted puppet, when the card is not one of the seven published portraits. */
  art?: string;
}

/** Portrait file on the card, then the puppet that file already stands in for. */
const ART: Record<string, { art: string; build: Look["build"]; hair: Look["hair"]; top: Look["top"] }> = {
  "/crew/inez.jpg": { art: "nova", build: "lean", hair: "braids", top: "leather" },
  "/crew/june.jpg": { art: "june", build: "lean", hair: "ponytail", top: "coat" },
  "/crew/vega.jpg": { art: "king", build: "heavy", hair: "crown", top: "hoodie" },
  "/crew/sol.jpg": { art: "reed", build: "lean", hair: "hood", top: "hoodie" },
  "/crew/marsh.jpg": { art: "jax", build: "heavy", hair: "cap", top: "hoodie" },
  "/crew/wire.jpg": { art: "spade", build: "heavy", hair: "hood", top: "hoodie" },
  "/crew/pike.jpg": { art: "lobo", build: "lean", hair: "cap", top: "hoodie" },
};

/** Class baselines from crew-roster.config.json. Starter cards use these with no tier roll. */
const CLASS = {
  security: { stats: { power: 10, stealth: 3, tech: 2, charisma: 3, loyalty: 15 }, hpPoints: 16 },
  scout: { stats: { power: 5, stealth: 18, tech: 5, charisma: 6, loyalty: 8 }, hpPoints: 14 },
  negotiator: { stats: { power: 8, stealth: 6, tech: 2, charisma: 18, loyalty: 8 }, hpPoints: 16 },
  hacker: { stats: { power: 6, stealth: 6, tech: 20, charisma: 3, loyalty: 7 }, hpPoints: 14 },
  driver: { stats: { power: 8, stealth: 10, tech: 7, charisma: 4, loyalty: 8 }, hpPoints: 14 },
  fixer: { stats: { power: 4, stealth: 8, tech: 8, charisma: 8, loyalty: 14 }, hpPoints: 16 },
} as const;

function card(partial: Omit<CrewCard, "stats" | "hpPoints" | "tier" | "role"> & { role?: string; tier?: CrewCard["tier"]; stats?: CrewCard["stats"]; hpPoints?: number }): CrewCard {
  const base = CLASS[partial.class];
  const role = partial.role ?? partial.class[0].toUpperCase() + partial.class.slice(1);
  return {
    ...partial,
    role,
    tier: partial.tier ?? "normal",
    stats: partial.stats ?? { ...base.stats },
    hpPoints: partial.hpPoints ?? base.hpPoints,
  };
}

/** Published crew.config.json members, plus one starter card per class. Names and stats are the game's. */
export const DECK: CrewCard[] = [
  card({ id: "inez", name: "Inez", gender: "female", portrait: "/crew/inez.jpg", class: "scout", role: "Scout", quote: "A patient neighborhood observer who remembers faces, rhythms, and who needs a hand.", stats: { power: 4, stealth: 12, tech: 5, charisma: 6, loyalty: 8 }, hpPoints: 14 }),
  card({ id: "sol", name: "Sol", gender: "male", portrait: "/crew/sol.jpg", class: "driver", role: "Driver", quote: "A steady courier from the night shift. Calm behind the wheel, quiet when plans change.", stats: { power: 5, stealth: 12, tech: 7, charisma: 3, loyalty: 8 }, hpPoints: 14 }),
  card({ id: "june", name: "June", gender: "female", portrait: "/crew/june.jpg", class: "negotiator", role: "Negotiator", quote: "A former night-market broker who can settle a tense room with a few carefully chosen words.", stats: { power: 7, stealth: 7, tech: 2, charisma: 18, loyalty: 9 }, hpPoints: 16 }),
  card({ id: "marsh", name: "Marsh", gender: "male", portrait: "/crew/marsh.jpg", class: "security", role: "Security", quote: "A disciplined former venue guard. Holds formation and protects the team when a plan goes wrong.", stats: { power: 10, stealth: 3, tech: 2, charisma: 3, loyalty: 18 }, hpPoints: 16 }),
  card({ id: "vega", name: "Vega", gender: "female", portrait: "/crew/vega.jpg", class: "security", role: "Captain", quote: "A seasoned organizer with presence, strong instincts, and a long memory for loyalty.", stats: { power: 14, stealth: 6, tech: 5, charisma: 10, loyalty: 14 }, hpPoints: 16 }),
  card({ id: "wire", name: "Wire", gender: "male", portrait: "/crew/wire.jpg", class: "hacker", role: "Hacker", quote: "An electronics repair specialist who reads the city's fictional network of signals and rumors.", stats: { power: 2, stealth: 8, tech: 20, charisma: 2, loyalty: 7 }, hpPoints: 14 }),
  card({ id: "pike", name: "Pike", gender: "male", portrait: "/crew/pike.jpg", class: "fixer", role: "Fixer", quote: "A loyal behind-the-scenes connector who finds steady work and helps the crew recover its footing.", stats: { power: 3, stealth: 13, tech: 8, charisma: 9, loyalty: 17 }, hpPoints: 16 }),
  card({ id: "ada-banks", name: "Ada Banks", gender: "female", portrait: "/crew/inez.jpg", class: "scout", quote: "Starter scout. Stats are the class baseline." }),
  card({ id: "jace-holt", name: "Jace Holt", gender: "male", portrait: "/crew/marsh.jpg", class: "security", quote: "Starter security. Stats are the class baseline." }),
  card({ id: "lena-cruz", name: "Lena Cruz", gender: "female", portrait: "/crew/june.jpg", class: "negotiator", quote: "Starter negotiator. Stats are the class baseline." }),
  card({ id: "nico-chen", name: "Nico Chen", gender: "male", portrait: "/crew/wire.jpg", class: "hacker", quote: "Starter hacker. Stats are the class baseline." }),
  card({ id: "mara-reyes", name: "Mara Reyes", gender: "female", portrait: "/crew/vega.jpg", class: "driver", quote: "Starter driver. Stats are the class baseline." }),
  card({ id: "omar-santos", name: "Omar Santos", gender: "male", portrait: "/crew/pike.jpg", class: "fixer", quote: "Starter fixer. Stats are the class baseline." }),
  card({ id: "bo", name: "Bo", gender: "female", portrait: "/crew/vega.jpg", class: "security", art: "bo", quote: "Holds the block. Does not lend it out." }),
  card({ id: "sable", name: "Sable", gender: "female", portrait: "/crew/june.jpg", class: "fixer", art: "sable", quote: "Moves the product and keeps the names quiet." }),
  card({ id: "holt", name: "Holt", gender: "male", portrait: "/crew/marsh.jpg", class: "security", art: "holt", quote: "First one through when the street is contested." }),
  card({ id: "drea", name: "Drea", gender: "female", portrait: "/crew/inez.jpg", class: "driver", art: "drea", quote: "Gets the crew off the block before the street closes." }),
];

export function cardById(id: string) {
  const found = DECK.find((card) => card.id === id);
  if (!found) throw new Error(`Unknown crew card ${id}`);
  return found;
}

/** A recruiter card becomes the fighter the stage plays. Name and stats stay the card's. */
export function cardMember(card: CrewCard): CastMember {
  const face = ART[card.portrait] ?? ART["/crew/sol.jpg"];
  const look: Look = {
    art: card.art ?? face.art,
    skin: "#c48a62",
    cloth: "#161b24",
    trim: "#e7c56a",
    hair: face.hair,
    top: face.top,
    build: face.build,
    beard: card.gender === "male" && card.class === "security",
    gun: true,
  };
  return { id: card.id, name: card.name, role: card.role, stats: card.stats, look, quote: card.quote };
}
