import { hmacSha256, readU32BE } from "./sha256.ts";

/**
 * Browser port of Hustle's visible gauntlet resolver
 * (worker/gauntlet-engine.ts + diceRoll in worker/dice-engine.ts).
 * Dice use the same HMAC-SHA256 rejection sampling as the game.
 * Rules numbers are gauntlet.config.json / the roster class baselines.
 */

export const GAUNTLET = {
  version: "gauntlet-1",
  statDivisors: { power: 5, stealth: 3, charisma: 3, loyalty: 3 },
  hpPerPoint: 8,
  shieldPerTech: 4,
  baseDamage: 16,
  maximumMarginDamage: 6,
  dodgeThreshold: 19,
  maximumDodgeBonus: 6,
  critThreshold: 19,
  critMultiplier: 1.5,
  counterThreshold: 19,
  counterFraction: 0.5,
  riposteFraction: 1,
  reflectBase: 0.6,
  reflectPerStealth: 0.05,
  driverDamage: 16,
  fixerHeal: 0.4,
  deathBase: 0.05,
  deathMinimum: 0.05,
  deathMaximum: 0.75,
  deathLoyaltyRelief: 0.005,
  deathSeverity: [0.09, 0.09, 0.06, 0.03, 0, 0],
  criticalChance: 0.3333333333333333,
  fatigueTicks: 6,
  criticalTicks: 24,
} as const;

export const CLASSES = {
  security: { stats: { power: 10, stealth: 3, tech: 2, charisma: 3, loyalty: 15 }, hpPoints: 16 },
  scout: { stats: { power: 5, stealth: 18, tech: 5, charisma: 6, loyalty: 8 }, hpPoints: 14 },
  negotiator: { stats: { power: 8, stealth: 6, tech: 2, charisma: 18, loyalty: 8 }, hpPoints: 16 },
  hacker: { stats: { power: 6, stealth: 6, tech: 20, charisma: 3, loyalty: 7 }, hpPoints: 14 },
  driver: { stats: { power: 8, stealth: 10, tech: 7, charisma: 4, loyalty: 8 }, hpPoints: 14 },
  fixer: { stats: { power: 4, stealth: 8, tech: 8, charisma: 8, loyalty: 14 }, hpPoints: 16 },
} as const;

export type Side = "attacker" | "defender";
export type CrewClass = keyof typeof CLASSES;
export type StatKey = "power" | "stealth" | "tech" | "charisma" | "loyalty";
export type Stats = Record<StatKey, number>;
export type Pose = "idle" | "guard" | "strike" | "shoot" | "dodge" | "hit" | "down" | "heal";
export type Hair = "crown" | "braids" | "cap" | "hood" | "bandana" | "buzz" | "ponytail";
export type Top = "hoodie" | "tank" | "leather" | "coat";

export interface Look {
  art: string;
  skin: string;
  cloth: string;
  trim: string;
  hair: Hair;
  top: Top;
  build: "heavy" | "lean";
  beard?: boolean;
  ink?: boolean;
  /** Sidearm. A landed swing is staged as a shot. */
  gun?: boolean;
}

export interface DiceRoll {
  dice: [number, number];
  modifier: number;
  total: number;
}

export interface StageFighter {
  id: string;
  name: string;
  class: CrewClass;
  stats: Stats;
  hpPoints: number;
  hp: number;
  shield: number;
  attack: number;
  dodge: number;
  crit: number;
  counter: number;
  look: Look;
  quote: string;
  role: string;
}

export interface CrewSide {
  name: string;
  tag: string;
  fighters: StageFighter[];
}

export interface GauntletRound {
  round: number;
  opening?: Side;
  attacker?: DiceRoll;
  defender?: DiceRoll;
  striker: Side | null;
  dodge?: DiceRoll;
  avoided?: boolean;
  crit?: DiceRoll;
  critical?: boolean;
  counter?: DiceRoll;
  countered?: boolean;
  damage: number;
  shieldLoss: number;
  riposteDamage: number;
  reflectedDamage: number;
  counterDamage: number;
  counterReflectedDamage: number;
}

interface Health {
  hp: number;
  shield: number;
  fought: boolean;
  knockedOut: boolean;
}

interface Checkpoint {
  teams: Record<Side, CrewSide & { fortification: number }>;
  remaining: Record<Side, Health[]>;
  fortification: Record<Side, number>;
  index: Record<Side, number>;
  round: number;
  opening: Side[];
  duel: number;
  duelStarted: boolean;
  done: boolean;
  winner?: Side;
  last?: GauntletRound;
  heal?: { side: Side; amount: number; fixer: string; fighter: string };
  fell?: string[];
}

export interface Beat {
  round: number;
  caption: string;
  verb: "faceoff" | "exchange" | "dodge" | "crit" | "counter" | "opening" | "tie" | "heal" | "end";
  poses: Record<string, Pose>;
  hp: Record<string, { hp: number; shield: number }>;
  fort: Record<Side, number>;
  active: Record<Side, string> | null;
  rolls: {
    attacker?: DiceRoll;
    defender?: DiceRoll;
    dodge?: DiceRoll;
    crit?: DiceRoll;
    counter?: DiceRoll;
  };
  striker: Side | null;
  damage: number;
  counterDamage: number;
  riposte: number;
  reflected: number;
}

export interface Sim {
  seed: string;
  attacker: CrewSide;
  defender: CrewSide;
  fort: Record<Side, number>;
  beats: Beat[];
  winner: Side | null;
  rounds: number;
  injuries: { side: Side; id: string; name: string; kind: string }[];
}

const sides: Side[] = ["attacker", "defender"];
const other = (side: Side): Side => (side === "attacker" ? "defender" : "attacker");
const floor = (n: number) => Math.floor(n + 1e-9);

export function diceRoll(seed: string, label: string, modifier: number): DiceRoll {
  const die = (n: number) => {
    for (let attempt = 0; ; attempt++) {
      const value = readU32BE(hmacSha256(seed, `${label}:${n}:${attempt}`));
      if (value < 4294967290) return (value % 10) + 1;
    }
  };
  const dice: [number, number] = [die(0), die(1)];
  return { dice, modifier, total: dice[0] + dice[1] + modifier };
}

export function gauntletRandom(seed: string, label: string) {
  return readU32BE(hmacSha256(seed, "gauntlet:" + label)) / 4294967296;
}

export function derive(stats: Stats, hpPoints: number) {
  const r = GAUNTLET;
  return {
    hp: hpPoints * r.hpPerPoint,
    shield: stats.tech * r.shieldPerTech,
    attack: Math.floor(stats.power / r.statDivisors.power),
    dodge: Math.min(r.maximumDodgeBonus, Math.floor(stats.stealth / r.statDivisors.stealth)),
    crit: Math.floor(stats.charisma / r.statDivisors.charisma),
    counter: Math.floor(stats.loyalty / r.statDivisors.loyalty),
  };
}

export function fromClass(
  id: string,
  name: string,
  cls: CrewClass,
  look: Look,
  quote: string,
  role: string = cls,
): StageFighter {
  const base = CLASSES[cls];
  const stats = { ...base.stats };
  return { id, name, class: cls, stats, hpPoints: base.hpPoints, ...derive(stats, base.hpPoints), look, quote, role };
}

export function fromStats(
  id: string,
  name: string,
  cls: CrewClass,
  stats: Stats,
  hpPoints: number,
  look: Look,
  quote: string,
  role: string,
): StageFighter {
  return { id, name, class: cls, stats: { ...stats }, hpPoints, ...derive(stats, hpPoints), look, quote, role };
}

const king: Look = { art: "king", skin: "#8d5a3c", cloth: "#161b24", trim: "#e7c56a", hair: "crown", top: "hoodie", build: "heavy", beard: true, gun: true };
const nova: Look = { art: "nova", skin: "#6b3f2e", cloth: "#12161d", trim: "#d5dbe6", hair: "braids", top: "leather", build: "lean", gun: true };
const jax: Look = { art: "jax", skin: "#c48a62", cloth: "#1c2330", trim: "#9aa6b8", hair: "cap", top: "hoodie", build: "heavy", gun: true };
const reed: Look = { art: "reed", skin: "#e0b08a", cloth: "#171c26", trim: "#8ea0b8", hair: "hood", top: "hoodie", build: "lean", gun: true };
const rico: Look = { art: "rico", skin: "#a56b45", cloth: "#241016", trim: "#ff3355", hair: "buzz", top: "tank", build: "heavy", ink: true, beard: true, gun: true };
const spade: Look = { art: "spade", skin: "#3e2b24", cloth: "#160e12", trim: "#ff3355", hair: "hood", top: "hoodie", build: "heavy", gun: true };
const lobo: Look = { art: "lobo", skin: "#8a5a3a", cloth: "#1c1016", trim: "#ff3355", hair: "cap", top: "hoodie", build: "lean", gun: true };
const crow: Look = { art: "crow", skin: "#d7a57a", cloth: "#120c10", trim: "#ff3355", hair: "bandana", top: "hoodie", build: "lean", gun: true };

export interface Preset {
  id: string;
  label: string;
  place: string;
  objective: string;
  attacker: CrewSide;
  defender: CrewSide;
}

export const PRESETS: Preset[] = [
  {
    id: "underpass",
    label: "South Gate underpass",
    place: "South Gate Underpass",
    objective: "Defeat Rico's crew.",
    attacker: {
      name: "The Block",
      tag: "The block never forgets",
      fighters: [
        fromClass("a-king", "King", "security", king, "Discipline builds empires.", "Captain"),
        fromClass("a-reed", "Reed", "fixer", reed, "I put people back on their feet."),
        fromClass("a-nova", "Nova", "scout", nova, "I already saw them coming."),
        fromClass("a-jax", "Jax", "driver", jax, "Say when. I'm already in gear."),
      ],
    },
    defender: {
      name: "South Gate Syndicate",
      tag: "This city always pays",
      fighters: [
        fromClass("d-rico", "Rico", "security", rico, "This city always pays.", "Boss"),
        fromClass("d-spade", "Spade", "hacker", spade, "Their phones told me everything."),
        fromClass("d-lobo", "Lobo", "driver", lobo, "We leave hotter than we came."),
        fromClass("d-crow", "Crow", "scout", crow, "Two of them. Alley on the left."),
      ],
    },
  },
  {
    id: "specialists",
    label: "Vega vs the night market",
    place: "Night Market",
    objective: "Vega's crew takes the corner.",
    attacker: {
      name: "Vega's crew",
      tag: "Published specialist baselines",
      fighters: [
        fromStats("a-vega", "Vega", "security", { power: 14, stealth: 6, tech: 5, charisma: 10, loyalty: 14 }, CLASSES.security.hpPoints, king, "A long memory for loyalty.", "Captain"),
        fromStats("a-marsh", "Marsh", "security", { power: 10, stealth: 3, tech: 2, charisma: 3, loyalty: 18 }, CLASSES.security.hpPoints, jax, "Holds formation when the plan slips.", "Security"),
        fromStats("a-inez", "Inez", "scout", { power: 4, stealth: 12, tech: 5, charisma: 6, loyalty: 8 }, CLASSES.scout.hpPoints, nova, "She remembers faces and rhythms.", "Scout"),
        fromStats("a-sol", "Sol", "driver", { power: 5, stealth: 12, tech: 7, charisma: 3, loyalty: 8 }, CLASSES.driver.hpPoints, reed, "Calm when the plan changes.", "Driver"),
      ],
    },
    defender: {
      name: "Night market",
      tag: "Published specialist baselines",
      fighters: [
        fromStats("d-june", "June", "negotiator", { power: 7, stealth: 7, tech: 2, charisma: 18, loyalty: 9 }, CLASSES.negotiator.hpPoints, { ...rico, art: "june", hair: "ponytail", top: "coat", ink: false, beard: false, skin: "#e0b08a" }, "Settles a room with a few words.", "Negotiator"),
        fromStats("d-wire", "Wire", "hacker", { power: 2, stealth: 8, tech: 20, charisma: 2, loyalty: 7 }, CLASSES.hacker.hpPoints, spade, "Reads the city's signals.", "Hacker"),
        fromStats("d-pike", "Pike", "fixer", { power: 3, stealth: 13, tech: 8, charisma: 9, loyalty: 17 }, CLASSES.fixer.hpPoints, lobo, "Finds the crew its footing again.", "Fixer"),
        fromClass("d-guard", "Guard", "scout", crow, "Outpost eyes. Class baseline.", "Scout"),
      ],
    },
  },
];

function begin(attacker: CrewSide, defender: CrewSide, fort: Record<Side, number>): Checkpoint {
  const teams = {
    attacker: { ...attacker, fighters: attacker.fighters.map((f) => ({ ...f, stats: { ...f.stats } })), fortification: fort.attacker },
    defender: { ...defender, fighters: defender.fighters.map((f) => ({ ...f, stats: { ...f.stats } })), fortification: fort.defender },
  };
  return {
    teams,
    remaining: {
      attacker: teams.attacker.fighters.map((f) => ({ hp: f.hp, shield: f.shield, fought: false, knockedOut: false })),
      defender: teams.defender.fighters.map((f) => ({ hp: f.hp, shield: f.shield, fought: false, knockedOut: false })),
    },
    fortification: { ...fort },
    index: { attacker: 0, defender: 0 },
    round: 0,
    opening: [],
    duel: 0,
    duelStarted: false,
    done: false,
  };
}

function current(s: Checkpoint, side: Side) {
  return s.teams[side].fighters[s.index[side]];
}
function health(s: Checkpoint, side: Side) {
  return s.remaining[side][s.index[side]];
}
function ending(s: Checkpoint) {
  if (sides.some((side) => s.index[side] >= s.teams[side].fighters.length)) {
    s.done = true;
    s.winner = s.index.attacker >= s.teams.attacker.fighters.length ? "defender" : "attacker";
    return true;
  }
  return false;
}
function hit(s: Checkpoint, target: Side, damage: number, ignoreShield = false) {
  const f = health(s, target);
  let absorbed = 0;
  if (!ignoreShield) {
    const fort = Math.min(s.fortification[target], damage);
    s.fortification[target] -= fort;
    absorbed = fort;
    const own = Math.min(f.shield, damage - fort);
    f.shield -= own;
    absorbed += own;
  }
  return { absorbed, hpDamage: damage - absorbed };
}
function unreflectedHit(s: Checkpoint, target: Side, damage: number, ignoreShield = false) {
  const h = hit(s, target, damage, ignoreShield);
  health(s, target).hp = Math.max(0, health(s, target).hp - h.hpDamage);
  return h;
}
function reflectedHit(s: Checkpoint, striker: Side, damage: number, ignoreShield = false) {
  const target = other(striker);
  const h = hit(s, target, damage, ignoreShield);
  const reflected = floor(
    h.absorbed * Math.max(0, GAUNTLET.reflectBase - current(s, striker).stats.stealth * GAUNTLET.reflectPerStealth),
  );
  if (reflected) unreflectedHit(s, striker, reflected);
  health(s, target).hp = Math.max(0, health(s, target).hp - h.hpDamage);
  return { absorbed: h.absorbed, reflected };
}
function strike(s: Checkpoint, seed: string, row: GauntletRound, striker: Side, base: number) {
  const r = GAUNTLET;
  const target = other(striker);
  const a = current(s, striker);
  const d = current(s, target);
  const label = `${s.round}`;
  if (a.class !== "security") {
    row.dodge = diceRoll(seed, `gauntlet:${label}:dodge`, d.dodge);
    row.avoided = row.dodge.total >= r.dodgeThreshold;
  }
  if (row.avoided) {
    row.riposteDamage = floor(base * r.riposteFraction);
    unreflectedHit(s, striker, row.riposteDamage, true);
    return;
  }
  row.crit = diceRoll(seed, `gauntlet:${label}:crit`, a.crit);
  row.critical = row.crit.total >= r.critThreshold;
  row.damage = floor(base * (row.critical ? r.critMultiplier : 1));
  const h = reflectedHit(s, striker, row.damage, a.class === "negotiator");
  row.shieldLoss = h.absorbed;
  row.reflectedDamage = h.reflected;
  if (health(s, striker).hp > 0 && health(s, target).hp > 0) {
    row.counter = diceRoll(seed, `gauntlet:${label}:counter`, d.counter);
    row.countered = row.counter.total >= r.counterThreshold;
    if (row.countered) {
      row.counterDamage = floor(base * r.counterFraction);
      row.counterReflectedDamage = reflectedHit(s, target, row.counterDamage).reflected;
    }
  }
}
function finishDuel(s: Checkpoint) {
  const knocked = sides.filter((side) => health(s, side).hp === 0);
  if (!knocked.length) return;
  s.heal = undefined;
  s.fell = knocked.map((side) => current(s, side).name);
  if (knocked.length === 1) {
    const side = other(knocked[0]);
    const next = s.teams[side].fighters[s.index[side] + 1];
    if (next?.class === "fixer") {
      const h = health(s, side);
      const amount = Math.min(current(s, side).hp - h.hp, floor(current(s, side).hp * GAUNTLET.fixerHeal));
      h.hp += amount;
      if (amount) s.heal = { side, amount, fixer: next.name, fighter: current(s, side).name };
    }
  }
  for (const side of knocked) health(s, side).knockedOut = true;
  for (const side of knocked) s.index[side]++;
  s.duelStarted = false;
  s.opening = [];
  ending(s);
}

function step(previous: Checkpoint, seed: string): Checkpoint {
  const s: Checkpoint = structuredClone(previous);
  s.heal = undefined;
  s.fell = undefined;
  s.last = undefined;
  if (s.done || ending(s)) return s;
  if (!s.duelStarted) {
    for (const side of sides) health(s, side).fought = true;
    s.duel += 1;
    s.opening = sides.filter((side) => current(s, side).class === "driver");
    if (s.opening.length === 2 && gauntletRandom(seed, `opening:${s.duel}`) < 0.5) s.opening.reverse();
    s.duelStarted = true;
  }
  s.round++;
  const opening = s.opening.shift();
  const row: GauntletRound = {
    round: s.round,
    ...(opening ? { opening } : {}),
    striker: opening ?? null,
    damage: 0,
    shieldLoss: 0,
    riposteDamage: 0,
    reflectedDamage: 0,
    counterDamage: 0,
    counterReflectedDamage: 0,
  };
  if (opening) strike(s, seed, row, opening, GAUNTLET.driverDamage);
  else {
    row.attacker = diceRoll(seed, `gauntlet:${s.round}:attacker:attack`, current(s, "attacker").attack);
    row.defender = diceRoll(seed, `gauntlet:${s.round}:defender:attack`, current(s, "defender").attack);
    const margin = row.attacker.total - row.defender.total;
    row.striker = margin === 0 ? null : margin > 0 ? "attacker" : "defender";
    if (row.striker) {
      strike(
        s,
        seed,
        row,
        row.striker,
        GAUNTLET.baseDamage + Math.min(GAUNTLET.maximumMarginDamage, Math.abs(margin)),
      );
    }
  }
  s.last = row;
  finishDuel(s);
  return s;
}

function snapHp(s: Checkpoint) {
  const hp: Beat["hp"] = {};
  for (const side of sides) {
    s.teams[side].fighters.forEach((f, i) => {
      const h = s.remaining[side][i];
      hp[f.id] = { hp: h.hp, shield: h.shield };
    });
  }
  return hp;
}

function basePoses(s: Checkpoint): Record<string, Pose> {
  const poses: Record<string, Pose> = {};
  for (const side of sides) {
    s.teams[side].fighters.forEach((f, i) => {
      poses[f.id] = s.remaining[side][i].hp <= 0 ? "down" : "idle";
    });
  }
  return poses;
}

function armed(f: StageFighter | null | undefined) {
  return !!f?.look.gun;
}

function attackPose(f: StageFighter): Pose {
  return f.look.gun ? "shoot" : "strike";
}

function captionFor(s: Checkpoint, actors: Record<Side, StageFighter>) {
  const row = s.last;
  if (!row) return "Crews square up.";
  const striker = row.striker ? actors[row.striker] : null;
  const target = row.striker ? actors[other(row.striker)] : null;
  const shot = armed(striker);
  let text = "";
  if (row.opening && striker) {
    text = row.avoided
      ? `${target?.name} slips ${striker.name}'s opening${row.riposteDamage ? ` and fires back for ${row.riposteDamage}` : ""}.`
      : `${striker.name} ${shot ? "opens fire" : "opens the duel"} for ${row.damage}${row.critical ? " · critical" : ""}${row.countered ? `. ${target?.name} ${armed(target) ? "fires back" : "counters"} for ${row.counterDamage}` : ""}.`;
  } else if (!row.striker && row.attacker && row.defender) {
    text = `Tied exchange ${row.attacker.total}–${row.defender.total}. Neither crew lands.`;
  } else if (striker && target && row.avoided) {
    text = `${target.name} dodges ${striker.name}${shot ? "'s shot" : ""}${row.riposteDamage ? ` and ${armed(target) ? "fires back" : "rips back"} for ${row.riposteDamage}` : ""}.`;
  } else if (striker && target) {
    const land = shot ? "shoots" : "hits";
    text = `${striker.name} ${row.attacker && row.defender ? `wins ${Math.max(row.attacker.total, row.defender.total)}–${Math.min(row.attacker.total, row.defender.total)} and ` : ""}${land} ${target.name} for ${row.damage}${row.critical ? " · critical" : ""}${row.reflectedDamage ? ` · ${row.reflectedDamage} reflects` : ""}${row.countered ? `. ${target.name} ${armed(target) ? "fires back" : "counters"} for ${row.counterDamage}` : ""}.`;
  }
  if (s.heal) text += ` ${s.heal.fixer} patches ${s.heal.fighter} for ${s.heal.amount}.`;
  if (s.fell?.length) text += ` ${s.fell.join(" and ")} ${s.fell.length > 1 ? "are" : "is"} down.`;
  return text;
}

function verbOf(row: GauntletRound | undefined): Beat["verb"] {
  if (!row) return "faceoff";
  if (!row.striker) return "tie";
  if (row.avoided) return "dodge";
  if (row.countered) return "counter";
  if (row.critical) return "crit";
  if (row.opening) return "opening";
  return "exchange";
}

function posesFor(s: Checkpoint, actors: Record<Side, StageFighter>): Record<string, Pose> {
  const poses = basePoses(s);
  const row = s.last;
  const hp = snapHp(s);
  if (!row?.striker) return poses;
  const striker = actors[row.striker];
  const target = actors[other(row.striker)];
  if (hp[striker.id].hp > 0) poses[striker.id] = row.avoided || row.countered ? "hit" : attackPose(striker);
  if (hp[target.id].hp > 0) {
    if (row.avoided) poses[target.id] = row.riposteDamage ? attackPose(target) : "dodge";
    else poses[target.id] = row.countered ? attackPose(target) : "hit";
  }
  if (s.heal && hp[actors[s.heal.side].id].hp > 0) poses[actors[s.heal.side].id] = "heal";
  return poses;
}

function injuries(s: Checkpoint, seed: string) {
  if (!s.done || !s.winner) return [];
  const r = GAUNTLET;
  const left = s.remaining[s.winner].filter((h) => h.hp > 0).length;
  const severity = r.deathSeverity[Math.min(left, r.deathSeverity.length - 1)];
  const list: Sim["injuries"] = [];
  for (const side of sides) {
    for (let i = 0; i < s.remaining[side].length; i++) {
      const f = s.teams[side].fighters[i];
      const h = s.remaining[side][i];
      let kind = "standing";
      if (h.knockedOut) {
        const deathChance =
          side === "attacker"
            ? Math.max(r.deathMinimum, Math.min(r.deathMaximum, r.deathBase + severity - f.stats.loyalty * r.deathLoyaltyRelief))
            : undefined;
        if (deathChance !== undefined && gauntletRandom(seed, `injury:${side}:${f.id}:death`) < deathChance) kind = "dead";
        else if (gauntletRandom(seed, `injury:${side}:${f.id}:critical`) < r.criticalChance) kind = "critical";
        else kind = "wounded";
      } else if (side === "attacker" && h.fought) kind = "tired";
      list.push({ side, id: f.id, name: f.name, kind });
    }
  }
  return list;
}

export function simulate(attacker: CrewSide, defender: CrewSide, seed: string, fortDefender = 0): Sim {
  const fort = { attacker: 0, defender: Math.max(0, Math.floor(fortDefender)) };
  let state = begin(attacker, defender, fort);
  const beats: Beat[] = [
    {
      round: 0,
      caption: "Different crews. Same city.",
      verb: "faceoff",
      poses: basePoses(state),
      hp: snapHp(state),
      fort: { ...state.fortification },
      active: { attacker: attacker.fighters[0].id, defender: defender.fighters[0].id },
      rolls: {},
      striker: null,
      damage: 0,
      counterDamage: 0,
      riposte: 0,
      reflected: 0,
    },
  ];
  let guard = 0;
  while (!state.done && guard < 400) {
    const actors = { attacker: current(state, "attacker"), defender: current(state, "defender") };
    state = step(state, seed);
    const row = state.last;
    beats.push({
      round: state.round,
      caption: captionFor(state, actors),
      verb: verbOf(row),
      poses: posesFor(state, actors),
      hp: snapHp(state),
      fort: { ...state.fortification },
      active: { attacker: actors.attacker.id, defender: actors.defender.id },
      rolls: {
        attacker: row?.attacker,
        defender: row?.defender,
        dodge: row?.dodge,
        crit: row?.crit,
        counter: row?.counter,
      },
      striker: row?.striker ?? null,
      damage: row?.damage ?? 0,
      counterDamage: row?.counterDamage ?? 0,
      riposte: row?.riposteDamage ?? 0,
      reflected: row?.reflectedDamage ?? 0,
    });
    guard++;
  }
  const winner = state.winner ?? null;
  if (winner) {
    const last = beats[beats.length - 1];
    beats.push({
      ...last,
      verb: "end",
      caption: `${state.teams[winner].name} takes the street.`,
      poses: basePoses(state),
      active: null,
      rolls: {},
      striker: null,
    });
  }
  return {
    seed,
    attacker,
    defender,
    fort,
    beats,
    winner,
    rounds: state.round,
    injuries: injuries(state, seed),
  };
}

export function classRule(cls: CrewClass) {
  switch (cls) {
    case "security":
      return { name: "Hold", detail: "This fighter's hits cannot be dodged." };
    case "negotiator":
      return { name: "Pressure", detail: "Hits ignore shield and fortification." };
    case "driver":
      return { name: "Opening", detail: `First swing of their duel is a flat ${GAUNTLET.driverDamage}.` };
    case "fixer":
      return { name: "Patch", detail: "After a win, heals the fighter ahead for 40% of missing HP." };
    case "hacker":
      return { name: "Plated", detail: "Tech becomes a large personal shield." };
    case "scout":
      return { name: "Read", detail: `Dodge bonus is stealth ÷ ${GAUNTLET.statDivisors.stealth}, capped at +${GAUNTLET.maximumDodgeBonus}.` };
  }
}

export const RULE_LINES = [
  `Dodge succeeds at ${GAUNTLET.dodgeThreshold}+ unless the striker is security.`,
  `Crit at ${GAUNTLET.critThreshold}+ multiplies damage ×${GAUNTLET.critMultiplier}.`,
  `Counter at ${GAUNTLET.counterThreshold}+ returns ${GAUNTLET.counterFraction * 100}% of the pre-crit hit.`,
  "Shield and fortification absorb before HP. A clean dodge rips the hit back.",
];
