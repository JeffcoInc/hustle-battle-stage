import type { Side, StageBattle, StageCrew, StageFighter, StageRules } from "./types.ts";

/** The gauntlet log this package knows how to read. It does not include presentation. */
export interface BattleFighter {
  id: string;
  name: string;
  class: string;
  role: string;
  quote: string;
  hp: number;
  shield: number;
  attack: number;
  dodge: number;
  crit: number;
  counter: number;
  look: StageFighter["look"];
}

export interface BattleLog {
  seed: string;
  attacker: { name: string; tag: string; fighters: BattleFighter[] };
  defender: { name: string; tag: string; fighters: BattleFighter[] };
  beats: StageBattle["beats"];
  winner: Side | null;
  injuries: StageBattle["injuries"];
}

export interface BattleReadOptions {
  place: string;
  objective: string;
  rules: StageRules;
  /** Class text from the battle system. The stage does not own the rule table. */
  ruleFor: (className: string) => { name: string; detail: string };
}

function crew(side: BattleLog["attacker"], ruleFor: BattleReadOptions["ruleFor"]): StageCrew {
  return {
    name: side.name,
    tag: side.tag,
    fighters: side.fighters.map((f) => ({
      id: f.id,
      name: f.name,
      role: f.role,
      className: f.class,
      quote: f.quote,
      hp: f.hp,
      shield: f.shield,
      attack: f.attack,
      dodge: f.dodge,
      crit: f.crit,
      counter: f.counter,
      look: f.look,
      rule: ruleFor(f.class),
    })),
  };
}

/** Turn a finished gauntlet into the tape the stage plays. No dice are rolled here. */
export function readBattle(log: BattleLog, options: BattleReadOptions): StageBattle {
  if (!log.beats.length) throw new Error("Battle log has no beats");
  const known = new Set([...log.attacker.fighters, ...log.defender.fighters].map((f) => f.id));
  for (const beat of log.beats) {
    for (const id of Object.keys(beat.hp)) {
      if (!known.has(id)) throw new Error(`Battle log hp for unknown fighter ${id}`);
    }
  }
  return {
    system: "gauntlet-2d10",
    seed: log.seed,
    place: options.place,
    objective: options.objective,
    rules: options.rules,
    attacker: crew(log.attacker, options.ruleFor),
    defender: crew(log.defender, options.ruleFor),
    beats: log.beats,
    winner: log.winner,
    injuries: log.injuries,
  };
}

/** Entry / Clash / Escape log from resolveFlips. The stage does not roll the three phases. */
export interface FlipFighter {
  id: string;
  name: string;
  role: string;
  quote: string;
  stats: { power: number; stealth: number; tech: number; charisma: number; loyalty: number };
  look: StageFighter["look"];
}

export interface FlipBeat {
  phase: "faceoff" | "entry" | "clash" | "escape" | "end";
  caption: string;
  poses: Record<string, StageBattle["beats"][number]["poses"][string]>;
  active: Record<Side, string> | null;
  striker: Side | null;
  shot: boolean;
  hold: number;
  impact: "" | "hit" | "dodge" | "crit";
  sound: string;
}

export interface FlipLog {
  seed: string;
  version: string;
  place: string;
  objective: string;
  attacker: { name: string; tag: string; fighters: FlipFighter[] };
  defender: { name: string; tag: string; fighters: FlipFighter[] };
  result: {
    entry: boolean;
    clash: boolean;
    escape: boolean;
    outcome: string;
    rolls: { entry: number; clash: number; escape: number };
    weights: { entry: number; clash: number; escape: number };
  };
  phases: { phase: string; success: boolean; label: string; detail: string }[];
  injury: string | null;
  beats: FlipBeat[];
}

const phaseIds = ["entry", "clash", "escape"] as const;

function flipFighter(f: FlipFighter): StageFighter {
  return {
    id: f.id,
    name: f.name,
    role: f.role,
    className: f.role.toLowerCase(),
    quote: f.quote,
    hp: 100,
    shield: f.stats.tech * 4,
    attack: 0,
    dodge: 0,
    crit: 0,
    counter: 0,
    look: f.look,
    stats: f.stats,
    rule: { name: f.role, detail: "Published crew baseline. The phase roll uses the crew total." },
  };
}

function verbOf(beat: FlipBeat): StageBattle["beats"][number]["verb"] {
  if (beat.phase === "faceoff") return "faceoff";
  if (beat.phase === "end") return "end";
  if (beat.impact === "crit") return "crit";
  if (beat.impact === "dodge") return "dodge";
  if (beat.sound === "tension") return "tie";
  return "exchange";
}

export function readFlips(log: FlipLog): StageBattle {
  if (!log.beats.length) throw new Error("Battle log has no beats");
  const fighters = [...log.attacker.fighters, ...log.defender.fighters];
  const known = new Set(fighters.map((f) => f.id));
  const shieldOf = (id: string) => (fighters.find((f) => f.id === id)?.stats.tech ?? 0) * 4;
  const beats = log.beats.map((beat, index) => {
    const hp: StageBattle["beats"][number]["hp"] = {};
    for (const id of known) {
      const down = beat.phase === "end" && log.injury === id;
      hp[id] = { hp: down ? 0 : 100, shield: shieldOf(id) };
    }
    return {
      round: index,
      caption: beat.caption,
      verb: verbOf(beat),
      poses: beat.poses,
      hp,
      fort: { attacker: 0, defender: 0 },
      active: beat.active,
      rolls: {},
      striker: beat.striker,
      damage: beat.impact === "crit" ? 24 : beat.impact === "hit" ? 16 : 0,
      counterDamage: 0,
      riposte: 0,
      reflected: 0,
      phase: beat.phase,
      hold: beat.hold,
      sound: beat.sound,
    };
  });
  const injured = log.injury ? fighters.find((f) => f.id === log.injury) : undefined;
  return {
    system: "entry-clash-escape",
    seed: log.seed,
    place: log.place,
    objective: log.objective,
    rules: { version: log.version, dodgeThreshold: 0, critThreshold: 0, baseDamage: 0, maximumMarginDamage: 0 },
    attacker: { name: log.attacker.name, tag: log.attacker.tag, fighters: log.attacker.fighters.map(flipFighter) },
    defender: { name: log.defender.name, tag: log.defender.tag, fighters: log.defender.fighters.map(flipFighter) },
    beats,
    winner: log.result.clash ? "attacker" : "defender",
    injuries: injured ? [{ side: log.attacker.fighters.some((f) => f.id === injured.id) ? "attacker" : "defender", id: injured.id, name: injured.name, kind: "wounded" }] : [],
    phases: phaseIds.map((id) => {
      const report = log.phases.find((item) => item.phase.toLowerCase() === id);
      return {
        id,
        label: report?.label ?? id,
        success: report?.success ?? false,
        detail: report?.detail ?? "",
        roll: log.result.rolls[id],
        weight: log.result.weights[id],
      };
    }),
  };
}

