/** What the stage needs to see. Produced by reading a finished gauntlet, never by rolling. */

export type Side = "attacker" | "defender";
export type Pose = "idle" | "guard" | "strike" | "shoot" | "dodge" | "hit" | "down" | "heal";

export interface Look {
  art: string;
  skin: string;
  cloth: string;
  trim: string;
  hair: string;
  top: string;
  build: "heavy" | "lean";
  beard?: boolean;
  ink?: boolean;
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
  role: string;
  className: string;
  quote: string;
  hp: number;
  shield: number;
  attack: number;
  dodge: number;
  crit: number;
  counter: number;
  look: Look;
  rule: { name: string; detail: string };
  /** Set by the Entry / Clash / Escape reader. The gauntlet reader leaves this off. */
  stats?: { power: number; stealth: number; tech: number; charisma: number; loyalty: number };
}

export interface StageCrew {
  name: string;
  tag: string;
  fighters: StageFighter[];
}

export interface StageBeat {
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
  /** Present on an Entry / Clash / Escape tape. */
  phase?: "faceoff" | "entry" | "clash" | "escape" | "end";
  hold?: number;
  sound?: string;
}

export interface StageRules {
  version: string;
  dodgeThreshold: number;
  critThreshold: number;
  baseDamage: number;
  maximumMarginDamage: number;
}

export type BattleSystem = "entry-clash-escape" | "gauntlet-2d10";

export interface StagePhase {
  id: "entry" | "clash" | "escape";
  label: string;
  success: boolean;
  detail: string;
  roll: number;
  weight: number;
}

/** A fight the battle system already resolved. */
export interface StageBattle {
  system: BattleSystem;
  seed: string;
  place: string;
  objective: string;
  rules: StageRules;
  attacker: StageCrew;
  defender: StageCrew;
  beats: StageBeat[];
  winner: Side | null;
  injuries: { side: Side; id: string; name: string; kind: string }[];
  phases?: StagePhase[];
}
