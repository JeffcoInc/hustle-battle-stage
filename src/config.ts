/** Everything the admin panel is allowed to change. The stage never invents these. */

export interface StageConfig {
  /**
   * Which resolver the host runs before the stage plays.
   * `entry-clash-escape` is the live combat engine. `gauntlet-2d10` is the older duel.
   * The stage does not roll either one.
   */
  system: "entry-clash-escape" | "gauntlet-2d10";
  playback: {
    /** 0.5 to 2.5. The battle system or admin sets this. The stage has no slider. */
    speed: number;
    sound: boolean;
    /** Play the log once, then stop. Replay is a new battle object from the battle system. */
    autoplay: boolean;
  };
  chrome: {
    title: string;
    subtitle: string;
    brand: string;
    brandNote: string;
    tagline: string;
    neonLeft: string;
    neonRight: string;
    /** Public URL of the street plate. */
    backdrop: string;
  };
  show: {
    docks: boolean;
    exchange: boolean;
    queue: boolean;
    rules: boolean;
    result: boolean;
    banner: boolean;
    rain: boolean;
    neon: boolean;
    blood: boolean;
    muzzle: boolean;
    shake: boolean;
    floater: boolean;
  };
  timing: {
    faceoff: number;
    end: number;
    tie: number;
    dodge: number;
    crit: number;
    counter: number;
    heal: number;
    exchange: number;
    opening: number;
    /** Milliseconds from the shoot pose to the bang, flash, and camera kick. */
    aimMs: number;
  };
  audio: {
    master: number;
    sfx: number;
    rain: number;
  };
  art: {
    /** `/puppets` in this package. Each fighter is `{root}/{look.art}/{pose}.png`. */
    root: string;
    fx: string;
  };
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  system: "entry-clash-escape",
  playback: { speed: 1, sound: true, autoplay: true },
  chrome: {
    title: "2d10 Gauntlet",
    subtitle: "Same streets. The dice call it.",
    brand: "Hustle",
    brandNote: "People · Territory · Power",
    tagline: "More than money.",
    neonLeft: "Territory\npays",
    neonRight: "Hustle\nlives here",
    backdrop: "/stage/underpass.jpg",
  },
  show: {
    docks: true,
    exchange: true,
    queue: true,
    rules: true,
    result: true,
    banner: true,
    rain: true,
    neon: true,
    blood: true,
    muzzle: true,
    shake: true,
    floater: true,
  },
  timing: {
    faceoff: 2.4,
    end: 3.2,
    tie: 1.8,
    dodge: 2.4,
    crit: 2.8,
    counter: 3,
    heal: 2.2,
    exchange: 2.6,
    opening: 2.6,
    aimMs: 700,
  },
  audio: { master: 0.85, sfx: 0.9, rain: 0.22 },
  art: { root: "/puppets", fx: "/fx" },
};

function num(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Merge a partial admin payload onto the defaults. Unknown keys are ignored. */
export function stageConfig(input?: Partial<StageConfig> | null): StageConfig {
  const base = DEFAULT_STAGE_CONFIG;
  const p = input ?? {};
  const system = p.system === "gauntlet-2d10" ? "gauntlet-2d10" : "entry-clash-escape";
  return {
    system,
    playback: {
      speed: num(p.playback?.speed, 0.25, 3, base.playback.speed),
      sound: p.playback?.sound ?? base.playback.sound,
      autoplay: p.playback?.autoplay ?? base.playback.autoplay,
    },
    chrome: { ...base.chrome, ...p.chrome },
    show: { ...base.show, ...p.show },
    timing: {
      faceoff: num(p.timing?.faceoff, 0.2, 8, base.timing.faceoff),
      end: num(p.timing?.end, 0.2, 8, base.timing.end),
      tie: num(p.timing?.tie, 0.2, 8, base.timing.tie),
      dodge: num(p.timing?.dodge, 0.2, 8, base.timing.dodge),
      crit: num(p.timing?.crit, 0.2, 8, base.timing.crit),
      counter: num(p.timing?.counter, 0.2, 8, base.timing.counter),
      heal: num(p.timing?.heal, 0.2, 8, base.timing.heal),
      exchange: num(p.timing?.exchange, 0.2, 8, base.timing.exchange),
      opening: num(p.timing?.opening, 0.2, 8, base.timing.opening),
      aimMs: num(p.timing?.aimMs, 0, 2000, base.timing.aimMs),
    },
    audio: {
      master: num(p.audio?.master, 0, 1, base.audio.master),
      sfx: num(p.audio?.sfx, 0, 1, base.audio.sfx),
      rain: num(p.audio?.rain, 0, 1, base.audio.rain),
    },
    art: { ...base.art, ...p.art },
  };
}
