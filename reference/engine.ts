import type { Look, Pose } from "./combat.ts";
import { hmacSha256, readU32BE } from "./sha256.ts";

/**
 * Browser port of worker/combat-engine.ts resolveFlips and combat.config.json
 * version entry-clash-escape-cleanup-2. Crew totals follow teamStats in
 * src/nation/crew.ts: published member baselines, added once each.
 * Gear does not change stats. The stage does not invent a second fight.
 */

export const COMBAT = {
  version: "entry-clash-escape-cleanup-2",
  minimumChance: 0.2,
  maximumChance: 0.9,
  entryClashShift: 0.1,
  retaliationShift: 0.05,
  leaderBase: 12,
  leaderPerLevel: 3,
  leaderPerBase: 2,
  minimumIntegrityEffect: 0.25,
  entry: {
    base: 0.5,
    spread: 0.35,
    stealth: 1,
    tech: 0.3,
    loyalty: 0.1,
    defenderPower: 0.3,
    defenderTech: 0.4,
    securityRole: 6,
    wall: 0,
    heat: 0.12,
    blackout: 0,
    festival: 0,
  },
  clash: {
    power: 1,
    tech: 0.6,
    charisma: 0.2,
    wall: 0,
    facilityTier: 0,
    conditionPenalty: 0.08,
  },
  escape: {
    base: 0.78,
    spread: 0.15,
    stealth: 0.4,
    loyalty: 0.3,
    driverRole: 8,
    defenderStealth: 0.2,
    defenderDriver: 4,
    heat: 0.18,
    warrant: 0.04,
  },
} as const;

export type StatKey = "power" | "stealth" | "tech" | "charisma" | "loyalty";
export type Stats = Record<StatKey, number>;
export type Side = "attacker" | "defender";
export type Outcome = "victory" | "mixed" | "defended";
export type PhaseId = "faceoff" | "entry" | "clash" | "escape" | "end";

export interface Party {
  name: string;
  stats: Stats;
  leadership: number;
  roles: string[];
  heat: number;
  warrant: number;
  condition: boolean;
}

export interface BattleInput {
  attacker: Party;
  defender: Party;
  walls: number;
  tier: number;
  integrity: number;
  cityHeat: number;
  event: string | null;
  retaliation: boolean;
  rules: typeof COMBAT;
}

export interface FlipResult {
  entry: boolean;
  clash: boolean;
  escape: boolean;
  outcome: Outcome;
  weights: { entry: number; clash: number; escape: number };
  rolls: { entry: number; clash: number; escape: number };
}

export interface PhaseReport {
  phase: "Entry" | "Clash" | "Escape";
  success: boolean;
  label: string;
  detail: string;
}

export interface CastMember {
  id: string;
  name: string;
  role: string;
  stats: Stats;
  look: Look;
  quote: string;
}

export interface StageBeat {
  phase: PhaseId;
  caption: string;
  poses: Record<string, Pose>;
  active: Record<Side, string> | null;
  striker: Side | null;
  shot: boolean;
  /** Seconds to hold this moment before the next. */
  hold: number;
  impact: "" | "hit" | "dodge" | "crit";
  sound: "faceoff" | "tension" | "slip" | "shot" | "heavy" | "end";
}

export interface StagedBattle {
  version: string;
  seed: string;
  place: string;
  objective: string;
  attacker: { name: string; tag: string; fighters: CastMember[]; party: Party };
  defender: { name: string; tag: string; fighters: CastMember[]; party: Party };
  result: FlipResult;
  phases: PhaseReport[];
  summary: string;
  title: string;
  injury: string | null;
  territoryChanged: boolean;
  beats: StageBeat[];
}

const STATS: StatKey[] = ["power", "stealth", "tech", "charisma", "loyalty"];
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

const vega: Look = { art: "king", skin: "#8d5a3c", cloth: "#161b24", trim: "#e7c56a", hair: "crown", top: "hoodie", build: "heavy", beard: true, gun: true };
const marsh: Look = { art: "jax", skin: "#c48a62", cloth: "#1c2330", trim: "#9aa6b8", hair: "cap", top: "hoodie", build: "heavy", gun: true };
const inez: Look = { art: "nova", skin: "#6b3f2e", cloth: "#12161d", trim: "#d5dbe6", hair: "braids", top: "leather", build: "lean", gun: true };
const sol: Look = { art: "reed", skin: "#e0b08a", cloth: "#171c26", trim: "#8ea0b8", hair: "hood", top: "hoodie", build: "lean", gun: true };
const june: Look = { art: "june", skin: "#e0b08a", cloth: "#241016", trim: "#ff3355", hair: "ponytail", top: "coat", build: "lean", gun: true };
const wire: Look = { art: "spade", skin: "#3e2b24", cloth: "#160e12", trim: "#ff3355", hair: "hood", top: "hoodie", build: "heavy", gun: true };
const pike: Look = { art: "lobo", skin: "#8a5a3a", cloth: "#1c1016", trim: "#ff3355", hair: "cap", top: "hoodie", build: "lean", gun: true };
const rico: Look = { art: "rico", skin: "#8d5a3c", cloth: "#1a120f", trim: "#e7c56a", hair: "buzz", top: "tank", build: "heavy", beard: true, gun: true };
const crow: Look = { art: "crow", skin: "#3e2b24", cloth: "#10141c", trim: "#9aa6b8", hair: "hood", top: "hoodie", build: "lean", gun: true };
const nia: Look = { art: "nia", skin: "#6b3f2e", cloth: "#12161d", trim: "#e7c56a", hair: "braids", top: "leather", build: "lean", gun: true };
const holt: Look = { art: "holt", skin: "#c48a62", cloth: "#3a3428", trim: "#d8d2c6", hair: "buzz", top: "coat", build: "heavy", beard: true, gun: true };
const remy: Look = { art: "remy", skin: "#a56b45", cloth: "#3a1014", trim: "#e7c56a", hair: "buzz", top: "coat", build: "lean", gun: true };
const drea: Look = { art: "drea", skin: "#6b3f2e", cloth: "#3d4630", trim: "#d8d2c6", hair: "buzz", top: "coat", build: "lean", gun: true };
const moss: Look = { art: "moss", skin: "#e0b08a", cloth: "#12161d", trim: "#9aa6b8", hair: "buzz", top: "hoodie", build: "heavy", beard: true, gun: true };
const sable: Look = { art: "sable", skin: "#c48a62", cloth: "#1a1c22", trim: "#d5dbe6", hair: "ponytail", top: "coat", build: "lean", gun: true };
const cruz: Look = { art: "cruz", skin: "#a56b45", cloth: "#f2efe8", trim: "#ff3355", hair: "bandana", top: "tank", build: "lean", ink: true, gun: true };
const wynn: Look = { art: "wynn", skin: "#e0b08a", cloth: "#12161d", trim: "#3ee0ff", hair: "cap", top: "hoodie", build: "lean", gun: true };
const bo: Look = { art: "bo", skin: "#6b3f2e", cloth: "#3a3428", trim: "#e7c56a", hair: "braids", top: "coat", build: "heavy", gun: true };

/** Published crew.config.json members. Ids, roles, and stats are the game's. */
export const CREW: CastMember[] = [
  { id: "inez", name: "Inez", role: "Scout", stats: { power: 4, stealth: 12, tech: 5, charisma: 6, loyalty: 8 }, look: inez, quote: "She remembers faces and rhythms." },
  { id: "sol", name: "Sol", role: "Driver", stats: { power: 5, stealth: 12, tech: 7, charisma: 3, loyalty: 8 }, look: sol, quote: "Calm when the plan changes." },
  { id: "june", name: "June", role: "Negotiator", stats: { power: 7, stealth: 7, tech: 2, charisma: 18, loyalty: 9 }, look: june, quote: "Settles a room with a few words." },
  { id: "marsh", name: "Marsh", role: "Security", stats: { power: 10, stealth: 3, tech: 2, charisma: 3, loyalty: 18 }, look: marsh, quote: "Holds formation when the plan slips." },
  { id: "vega", name: "Vega", role: "Captain", stats: { power: 14, stealth: 6, tech: 5, charisma: 10, loyalty: 14 }, look: vega, quote: "A long memory for loyalty." },
  { id: "wire", name: "Wire", role: "Hacker", stats: { power: 2, stealth: 8, tech: 20, charisma: 2, loyalty: 7 }, look: wire, quote: "Reads the city's signals." },
  { id: "pike", name: "Pike", role: "Fixer", stats: { power: 3, stealth: 13, tech: 8, charisma: 9, loyalty: 17 }, look: pike, quote: "Finds the crew its footing again." },
  { id: "rico", name: "Rico", role: "Captain", stats: { power: 12, stealth: 6, tech: 5, charisma: 11, loyalty: 11 }, look: rico, quote: "The gate is his until someone takes it." },
  { id: "crow", name: "Crow", role: "Scout", stats: { power: 3, stealth: 13, tech: 11, charisma: 4, loyalty: 6 }, look: crow, quote: "Sees the street before it moves." },
  { id: "nia", name: "Nia", role: "Scout", stats: { power: 5, stealth: 15, tech: 6, charisma: 7, loyalty: 8 }, look: nia, quote: "Gets in quiet and leaves the door open." },
  { id: "holt", name: "Holt", role: "Security", stats: { power: 13, stealth: 2, tech: 3, charisma: 5, loyalty: 15 }, look: holt, quote: "Does not step off the line." },
  { id: "remy", name: "Remy", role: "Negotiator", stats: { power: 6, stealth: 5, tech: 3, charisma: 17, loyalty: 9 }, look: remy, quote: "Talks until the room picks a side." },
  { id: "drea", name: "Drea", role: "Driver", stats: { power: 6, stealth: 11, tech: 8, charisma: 5, loyalty: 9 }, look: drea, quote: "Knows which road is still open." },
  { id: "moss", name: "Moss", role: "Security", stats: { power: 15, stealth: 2, tech: 2, charisma: 4, loyalty: 12 }, look: moss, quote: "Stands where he was told." },
  { id: "sable", name: "Sable", role: "Fixer", stats: { power: 4, stealth: 9, tech: 7, charisma: 12, loyalty: 14 }, look: sable, quote: "Settles the bill before it becomes a war." },
  { id: "cruz", name: "Cruz", role: "Security", stats: { power: 11, stealth: 8, tech: 3, charisma: 8, loyalty: 6 }, look: cruz, quote: "Hits first when the talk fails." },
  { id: "wynn", name: "Wynn", role: "Hacker", stats: { power: 3, stealth: 10, tech: 18, charisma: 4, loyalty: 7 }, look: wynn, quote: "Opens the lock and leaves no name." },
  { id: "bo", name: "Bo", role: "Captain", stats: { power: 9, stealth: 4, tech: 4, charisma: 8, loyalty: 16 }, look: bo, quote: "The crew stays if she stays." },
];

const member = (id: string) => {
  const found = CREW.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown crew member ${id}`);
  return found;
};

export interface Preset {
  id: string;
  label: string;
  place: string;
  objective: string;
  attackerName: string;
  defenderName: string;
  attacker: string[];
  defender: string[];
}

export const PRESETS: Preset[] = [
  {
    id: "phoenix",
    label: "Phoenix outpost",
    place: "Phoenix",
    objective: "Take the outpost.",
    attackerName: "Sol's crew",
    defenderName: "The outpost",
    attacker: ["sol", "wire"],
    defender: ["marsh", "inez"],
  },
  {
    id: "books",
    label: "Published crews",
    place: "Phoenix",
    objective: "Take the outpost.",
    attackerName: "Vega's crew",
    defenderName: "Night market",
    attacker: ["vega", "marsh", "inez", "sol"],
    defender: ["june", "wire", "pike"],
  },
];

function fighterById(id: string, roster?: CastMember[]) {
  return roster?.find((fighter) => fighter.id === id) ?? member(id);
}

export function teamStats(ids: string[], roster?: CastMember[]): Stats {
  const result = { power: 0, stealth: 0, tech: 0, charisma: 0, loyalty: 0 };
  for (const id of new Set(ids)) {
    const stats = fighterById(id, roster).stats;
    for (const key of STATS) result[key] += stats[key];
  }
  return result;
}

export function party(name: string, ids: string[], level: number, heat: number, roster?: CastMember[]): Party {
  const people = [...new Set(ids)].map((id) => fighterById(id, roster));
  return {
    name,
    stats: teamStats(ids, roster),
    leadership: COMBAT.leaderBase + COMBAT.leaderPerLevel * level + COMBAT.leaderPerBase * 0,
    roles: people.map((p) => p.role),
    heat,
    warrant: 0,
    condition: false,
  };
}

/** Same HMAC unit roll as resolveFlips: sha256(seed).update(phase).readUInt32BE(0) / 2^32. */
export function phaseRoll(seed: string, phase: string) {
  return readU32BE(hmacSha256(seed, phase)) / 4294967296;
}

export function resolveFlips(input: BattleInput, seed: string): FlipResult {
  const r = input.rules;
  const a = input.attacker;
  const d = input.defender;
  const count = (p: Party, role: string) => p.roles.filter((x) => x === role).length;
  const ratio = (x: number, y: number) => (x - y) / Math.max(1, x + y);
  const bounded = (x: number) => clamp(x, r.minimumChance, r.maximumChance);
  const roll = (phase: string) => phaseRoll(seed, phase);
  const e = r.entry;
  const c = r.clash;
  const x = r.escape;
  const adv = input.retaliation ? r.retaliationShift : 0;
  const entryChance = bounded(
    e.base +
      e.spread *
        ratio(
          8 + a.stats.stealth * e.stealth + a.stats.tech * e.tech + a.stats.loyalty * e.loyalty,
          8 + d.stats.power * e.defenderPower + d.stats.tech * e.defenderTech + count(d, "Security") * e.securityRole + input.walls * e.wall,
        ) -
      (input.cityHeat / 100) * e.heat +
      (/blackout/i.test(input.event ?? "") ? e.blackout : /festival|rush/i.test(input.event ?? "") ? e.festival : 0) +
      adv,
  );
  const entryRoll = roll("entry");
  const entry = entryRoll < entryChance;
  const strength = (p: Party) => p.leadership + p.stats.power * c.power + p.stats.tech * c.tech + p.stats.charisma * c.charisma;
  const attack = strength(a);
  const defend = strength(d) + (input.walls * c.wall + input.tier * c.facilityTier) * Math.max(r.minimumIntegrityEffect, input.integrity / 100);
  const clashChance = bounded(
    attack / Math.max(1, attack + defend) + (entry ? r.entryClashShift : -r.entryClashShift) - (a.condition ? c.conditionPenalty : 0) + (d.condition ? c.conditionPenalty : 0) + adv,
  );
  const clashRoll = roll("clash");
  const clash = clashRoll < clashChance;
  const escapeChance = bounded(
    x.base +
      x.spread *
        ratio(
          8 + a.stats.stealth * x.stealth + a.stats.loyalty * x.loyalty + count(a, "Driver") * x.driverRole,
          8 + d.stats.stealth * x.defenderStealth + count(d, "Driver") * x.defenderDriver,
        ) -
      (Math.max(a.heat, input.cityHeat) / 100) * x.heat -
      a.warrant * x.warrant +
      adv,
  );
  const escapeRoll = roll("escape");
  const escape = escapeRoll < escapeChance;
  return {
    entry,
    clash,
    escape,
    outcome: clash && escape ? "victory" : !clash && !escape ? "defended" : "mixed",
    weights: { entry: entryChance, clash: clashChance, escape: escapeChance },
    rolls: { entry: entryRoll, clash: clashRoll, escape: escapeRoll },
  };
}

export function phaseReports(result: FlipResult): PhaseReport[] {
  return [
    {
      phase: "Entry",
      success: result.entry,
      label: result.entry ? "Clean entry" : "Detected",
      detail: result.entry ? "The attacking crew reached its objective unnoticed." : "The defenders spotted the approach.",
    },
    {
      phase: "Clash",
      success: result.clash,
      label: result.clash ? "Clash won" : "Defenders held",
      detail: result.clash ? "The attacking crew took the upper hand." : "The defending crew held its ground.",
    },
    {
      phase: "Escape",
      success: result.escape,
      label: result.escape ? "Clean escape" : "Costly escape",
      detail: result.escape ? "The attacking crew got away without an escape heat spike." : "The attacking crew got away under pressure; heat rose and any loot was reduced.",
    },
  ];
}

function summaryFor(result: FlipResult, territoryChanged: boolean) {
  if (territoryChanged) return "Outpost secured.";
  if (result.clash && result.escape) return "Your crew prevailed and secured its available loot.";
  if (result.clash) return "You won the clash, but the escape cost you.";
  if (result.escape) return "The defenders held; your crew escaped safely.";
  return "The defenders held. Your crew can recover and try a different target.";
}

function posesOf(people: CastMember[], injured?: string) {
  const poses: Record<string, Pose> = {};
  for (const f of people) poses[f.id] = f.id === injured ? "down" : "idle";
  return poses;
}

export function stageBattle(preset: Preset, seed: string, level = 1, heat = 0, defenderLevel = 1, roster?: CastMember[]): StagedBattle {
  const attackerIds = preset.attacker;
  const defenderIds = preset.defender;
  const attackerParty = party(preset.attackerName, attackerIds, level, heat, roster);
  const defenderParty = party(preset.defenderName, defenderIds, defenderLevel, 0, roster);
  const input: BattleInput = {
    attacker: attackerParty,
    defender: defenderParty,
    walls: 0,
    tier: 0,
    integrity: 100,
    cityHeat: 0,
    event: null,
    retaliation: false,
    rules: COMBAT,
  };
  const result = resolveFlips(input, seed.trim() || "south-gate");
  const territoryChanged = result.clash && result.escape;
  const phases = phaseReports(result);
  const injury = !result.clash && !result.escape ? (attackerIds[0] ?? null) : null;
  const attackers = attackerIds.map((id) => fighterById(id, roster));
  const defenders = defenderIds.map((id) => fighterById(id, roster));
  const all = [...attackers, ...defenders];
  const lead = { attacker: attackers[0].id, defender: defenders[0].id };
  const sideOf = (side: Side) => (side === "attacker" ? attackers : defenders);
  const volley = (from: Side, onto: Side, slot: number) => {
    const poses = posesOf(all);
    const shooter = sideOf(from)[slot] ?? sideOf(from)[0];
    const target = sideOf(onto)[slot] ?? sideOf(onto)[0];
    if (shooter) poses[shooter.id] = "shoot";
    if (target) poses[target.id] = "hit";
    return poses;
  };
  const focus = (from: Side, onto: Side, slot: number) => {
    const shooter = sideOf(from)[slot] ?? sideOf(from)[0];
    const target = sideOf(onto)[slot] ?? sideOf(onto)[0];
    return {
      attacker: (from === "attacker" ? shooter : target).id,
      defender: (from === "defender" ? shooter : target).id,
    };
  };
  const slip = () => {
    const poses = posesOf(all);
    for (const f of attackers) poses[f.id] = "dodge";
    return poses;
  };
  const idle = () => posesOf(all);
  const winner: Side = result.clash ? "attacker" : "defender";
  const loser: Side = result.clash ? "defender" : "attacker";
  const beats: StageBeat[] = [
    { phase: "faceoff", caption: `${preset.attackerName} and ${preset.defenderName}. Same city. Neither side blinks.`, poses: idle(), active: lead, striker: null, shot: false, hold: 2.6, impact: "", sound: "faceoff" },
    { phase: "entry", caption: "They leave the avenue and move on the outpost.", poses: slip(), active: lead, striker: null, shot: false, hold: 1.8, impact: "dodge", sound: "slip" },
    {
      phase: "entry",
      caption: phases[0].detail,
      poses: result.entry ? slip() : volley("defender", "attacker", 0),
      active: result.entry ? lead : focus("defender", "attacker", 0),
      striker: result.entry ? null : "defender",
      shot: !result.entry,
      hold: 2.4,
      impact: result.entry ? "dodge" : "hit",
      sound: result.entry ? "slip" : "shot",
    },
    { phase: "clash", caption: "The street goes quiet.", poses: idle(), active: lead, striker: null, shot: false, hold: 1.7, impact: "", sound: "tension" },
    {
      phase: "clash",
      caption: result.clash ? `${preset.attackerName} pushes in.` : `${preset.defenderName} answers.`,
      poses: volley(winner, loser, 0),
      active: focus(winner, loser, 0),
      striker: winner,
      shot: true,
      hold: 2.6,
      impact: "hit",
      sound: "shot",
    },
    {
      phase: "clash",
      caption: phases[1].detail,
      poses: volley(winner, loser, 1),
      active: focus(winner, loser, 1),
      striker: winner,
      shot: true,
      hold: 2.5,
      impact: "crit",
      sound: "heavy",
    },
    { phase: "escape", caption: "Then they break for the way out.", poses: slip(), active: lead, striker: null, shot: false, hold: 1.6, impact: "dodge", sound: "slip" },
    {
      phase: "escape",
      caption: phases[2].detail,
      poses: result.escape ? slip() : volley("defender", "attacker", 0),
      active: result.escape ? lead : focus("defender", "attacker", 0),
      striker: result.escape ? null : "defender",
      shot: !result.escape,
      hold: 2.5,
      impact: result.escape ? "dodge" : "hit",
      sound: result.escape ? "slip" : "shot",
    },
    {
      phase: "end",
      caption: summaryFor(result, territoryChanged),
      poses: posesOf(all, injury ?? undefined),
      active: null,
      striker: null,
      shot: false,
      hold: 3,
      impact: "",
      sound: "end",
    },
  ];
  return {
    version: COMBAT.version,
    seed: seed.trim() || "south-gate",
    place: preset.place,
    objective: preset.objective,
    attacker: { name: preset.attackerName, tag: "Published crew stats", fighters: attackers, party: attackerParty },
    defender: { name: preset.defenderName, tag: "Published crew stats", fighters: defenders, party: defenderParty },
    result,
    phases,
    summary: summaryFor(result, territoryChanged),
    title: result.outcome === "victory" ? "Your crew prevailed" : result.outcome === "defended" ? "Defenders held" : "Mixed outcome",
    injury,
    territoryChanged,
    beats,
  };
}
