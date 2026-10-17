# Hustle battle stage — builder handoff

Package: `@hustle/battle-stage`
Game: [JeffcoInc/hustle-american-nights](https://github.com/JeffcoInc/hustle-american-nights)

Admin field `system` chooses the resolver. Default is `entry-clash-escape`, the live combat engine (`worker/combat-engine.ts`, `resolveFlips`, rules version `entry-clash-escape-cleanup-2`). The other value is `gauntlet-2d10`, the older duel (`worker/gauntlet-engine.ts`). The stage does not roll either. The host reads the policy and calls the matching resolver, then `readFlips` or `readBattle`.

```ts
const policy = stageConfig(saved);
const battle =
  policy.system === "gauntlet-2d10"
    ? readBattle(gauntletLog, { place, objective, rules, ruleFor })
    : readFlips(flipLog);
return <BattleStage key={policy.system + ":" + battle.seed} battle={battle} config={policy} />;
```

`readFlips` takes the log from `stageBattle` / `resolveFlips`: three phase rolls, the Entry / Clash / Escape reports, poses, and the outcome. The lower rail shows those three phases and the unit roll against the weight. Crew cards show power, stealth, tech, charisma, and loyalty. There is no 2d10 on that tape.

`readBattle` is only used when an admin switches the policy to `gauntlet-2d10`. The same picture plays that log: 2d10 pips, duel order, attack mods. Switching back does not require a second component.

Put the switch on the Stage section of `AdminCenter`, first control on the form, saved with the rest of `StageConfig`. Economist, admin, and owner (`roleCan(role, "config")`). A viewer can see which system is live and cannot change it. Write an audit row when it changes, same as a gauntlet policy save.

## What you are adding

A full-bleed street under the South Gate underpass. Two crews stand in profile. The active duelists step forward. Attacks are staged as gunshots when the fighter is armed. A dropped fighter lies on the ground. Docks show the live HP, shield, mods, and class rule that came in on the log. The lower rail shows the 2d10 exchange that the battle system already rolled.

Play starts on its own. When the last beat finishes, the stage holds on the result. To play it again, the battle system passes a new log (or the same log with a new `key` on the React element). The stage does not offer a replay button.

## Where it sits

```
battle system                         this package
worker/gauntlet-engine.ts             packages/battle-stage
  resolveBattleDice()                   readBattle(log) -> StageBattle
  gauntletResult()                      <BattleStage battle={...} config={admin} />
  seed, fortification, injuries
admin panel
  AdminCenter section "stage"
  stage policy JSON (same pattern as gauntlet-policy.ts)
```

The browser port used to prove the picture is `reference/combat.ts` in this zip. Do not ship that port. Wire the real resolver.

Real entry points in the game repo:

- `worker/gauntlet-engine.ts` — `beginGauntlet`, `stepGauntlet`, `gauntletResult`, `resolveBattleDice`
- `src/nation/gauntlet-types.ts` — `GauntletResult`, `GauntletRound`, `GauntletFighter`
- `src/nation/gauntlet.config.json` — rules numbers, version `gauntlet-1`
- `src/nation/gauntlet-policy.ts` — `validateGauntletRules`, the pattern to copy for the stage policy
- `src/nation/AdminCenter.tsx` — sections array. Add a `stage` section next to Mechanics
- `src/nation/admin-permissions.ts` — `config` is economist/admin/owner. Stage presentation uses `config`. Do not let a viewer write it
- `src/nation/GauntletPresentation.tsx` — current text presentation. The stage replaces the picture, not the rules

## Public API

```ts
import { BattleStage, readBattle, stageConfig, DEFAULT_STAGE_CONFIG } from "@hustle/battle-stage";
import type { BattleLog, StageBattle, StageConfig } from "@hustle/battle-stage";

const battle = readBattle(log, {
  place: "South Gate Underpass",
  objective: "Defeat Rico's crew.",
  rules: {
    version: "gauntlet-1",
    dodgeThreshold: 19,
    critThreshold: 19,
    baseDamage: 16,
    maximumMarginDamage: 6,
  },
  ruleFor: (className) => classRuleFromGauntlet(className),
});

<BattleStage key={battle.seed} battle={battle} config={stageConfig(adminPolicy)} />
```

`readBattle` checks that every HP entry names a fighter on the log. It does not roll. `stageConfig` merges a partial admin payload onto `DEFAULT_STAGE_CONFIG` and clamps numbers. Unknown keys are ignored.

`BattleStage` props:

| Prop | Required | Meaning |
| --- | --- | --- |
| `battle` | yes | The tape from `readBattle`. |
| `config` | no | Admin policy. Defaults are `DEFAULT_STAGE_CONFIG`. The component currently plays with its built-in timing and chrome. Pass `config` from the panel once the builder threads it (see the wiring list below). The schema and the clamp already exist in `src/config.ts`. |

Load the stylesheet once, from the app root, not twice:

```ts
import "@hustle/battle-stage/stage.css";
```

The file in this package is `src/stage.css`. It is Tailwind v4 (`@import "tailwindcss"` plus `@theme`). Fonts used: Oswald and Barlow.

## Battle log the stage reads

`BattleLog` in `src/read.ts`. This is the only shape the package accepts. Map `GauntletResult` into it. Do not import the worker into the package.

```ts
interface BattleLog {
  seed: string;
  attacker: { name: string; tag: string; fighters: BattleFighter[] };
  defender: { name: string; tag: string; fighters: BattleFighter[] };
  beats: StageBeat[];
  winner: "attacker" | "defender" | null;
  injuries: { side; id; name; kind }[];
}
```

Each fighter:

```ts
interface BattleFighter {
  id: string;
  name: string;
  class: "security" | "scout" | "negotiator" | "hacker" | "driver" | "fixer";
  role: string;
  quote: string;
  hp: number;       // max HP
  shield: number;   // max shield
  attack: number;   // 2d10 attack mod
  dodge: number;
  crit: number;
  counter: number;
  look: {
    art: string;    // folder name under assets/puppets
    skin: string;
    cloth: string;
    trim: string;
    hair: string;
    top: string;
    build: "heavy" | "lean";
    beard?: boolean;
    ink?: boolean;
    gun?: boolean;  // landed swing is staged as a shot
  };
}
```

Each beat:

```ts
interface StageBeat {
  round: number;
  caption: string;
  verb: "faceoff" | "opening" | "exchange" | "dodge" | "crit" | "counter" | "tie" | "heal" | "end";
  poses: Record<fighterId, "idle" | "guard" | "strike" | "shoot" | "dodge" | "hit" | "down" | "heal">;
  hp: Record<fighterId, { hp: number; shield: number }>; // remaining, after the beat
  fort: { attacker: number; defender: number };
  active: { attacker: fighterId; defender: fighterId } | null;
  rolls: {
    attacker?: { dice: [number, number]; modifier: number; total: number };
    defender?: { dice: [number, number]; modifier: number; total: number };
    dodge?: DiceRoll;
    crit?: DiceRoll;
    counter?: DiceRoll;
  };
  striker: "attacker" | "defender" | null;
  damage: number;
  counterDamage: number;
  riposte: number;
  reflected: number;
}
```

Dice on the street are whatever is already on the beat. The stage prints `dice[0]`, `dice[1]`, the modifier, and the total. It does not add them again.

### Mapping a real gauntlet result

`gauntletResult()` returns `teams`, `duels[].rounds[]`, `winner`, `rounds`, `injuries`, `final`.

Build beats in this order:

1. Faceoff beat. `verb: "faceoff"`. Both leads active. Poses idle. HP at the opening totals. No rolls.
2. One beat per `GauntletRound` in duel order. Caption from the round (who struck, the two totals, damage, crit, counter, riposte, reflect, heal, who fell). Verb from the round: no striker → `tie`; avoided → `dodge`; countered → `counter`; critical → `crit`; opening swing → `opening`; otherwise `exchange`.
3. End beat. `verb: "end"`. Caption `{winner crew} takes the street.` Poses: HP 0 → `down`, everyone else `idle`. `active: null`.

Pose rules, matching the picture that already ships:

- Striker with `look.gun` and a landed hit → `shoot`.
- Striker without a gun → `strike`.
- Target who took the hit → `hit`.
- Target who dodged and did not riposte → `dodge`.
- Target who dodged and riposted, or who countered → their attack pose (`shoot` if armed).
- HP already 0 at the start of the beat → `down` (body on the ground, not kneeling).
- Fixer heal on that side → `heal` if they are still up.

`look.art` must be one of the folders in `assets/puppets`: `king`, `reed`, `nova`, `jax`, `rico`, `spade`, `lobo`, `crow`, `june`. Map roster portraits onto those ids in the admin policy (see Art). Do not generate a new fighter at runtime.

Injuries use the kinds the resolver already emits: `standing`, `tired`, `wounded`, `critical`, `dead`. The end banner lists anyone who is not standing and not tired. A dead or knocked-out body uses the `down` frame, which is a body lying on the street.

Class rule text comes from the battle system through `ruleFor`. The stage does not contain the rule table. Current lines, from `gauntlet-1`:

| Class | Name | What to show |
| --- | --- | --- |
| security | Hold | Hits cannot be dodged. |
| negotiator | Pressure | Hits ignore shield and fortification. |
| driver | Opening | First swing of their duel is a flat 16. |
| fixer | Patch | After a win, heals the fighter ahead for 40% of missing HP. |
| hacker | Plated | Tech becomes a large personal shield. |
| scout | Read | Dodge bonus is stealth ÷ 3, capped at +6. |

## How a beat is played

Holds, in seconds, before the next beat. Divide by `config.playback.speed`.

| Verb | Hold |
| --- | --- |
| faceoff | 2.4 |
| tie | 1.8 |
| dodge | 2.4 |
| exchange, opening | 2.6 |
| crit | 2.8 |
| counter | 3.0 |
| heal | 2.2 |
| end | 3.2 |

A shoot pose waits `timing.aimMs` (700) before the muzzle, the camera kick, the floater, and the gunshot. The bang is a crack plus a short echo. The body hit follows about 80ms later. Dodge is a whoosh. A tie is only dice. A crit adds a high sting. Heal is a chime. The end beat is a low sting. Rain loops for the whole fight.

Audio starts suspended until the first pointer or key on the page. That is a browser rule, not a control. `config.playback.sound: false` mutes the stage. Do not add a mute button.

The fight plays once. `prefers-reduced-motion` starts paused on the first beat.

## Files in this package

```
package.json
HANDOFF.md                  this document
src/index.ts                exports
src/stage.tsx               the picture. No control bar.
src/read.ts                 readBattle
src/types.ts                StageBattle, StageBeat, poses, looks
src/config.ts               StageConfig, DEFAULT_STAGE_CONFIG, stageConfig()
src/puppet.tsx              frame player
src/sfx.ts                  procedural gunshot, impact, dice, rain
src/stage.css               layout. Load once.
assets/puppets/{id}/*.png   keyed sprites, feet on the bottom
assets/fx/blood-spray.png
assets/fx/blood-stain.png
assets/stage/underpass.jpg
reference/combat.ts         browser port of the resolver. Reference only.
reference/sha256.ts         HMAC dice sampler used by that port.
reference/stage-host.tsx    the one-line host: simulate, readBattle, render.
```

Copy `assets/` into the game's `public/` so the URLs stay `/puppets/...`, `/fx/...`, `/stage/underpass.jpg`.

### Frames, per fighter

`idle`, `idle-b`, `idle-c`, `strike`, `strike-b`, `shoot`, `shoot-recoil`, `dodge`, `dodge-b`, `hit`, `hit-b`, `heal`, `down`.

The player uses one frame for idle (no color swap). Shoot plays `shoot` then `shoot-recoil`. `down` is the body on the ground. Defenders are mirrored with `scaleX(-1)`. Every sprite faces right, gun included. Do not draw a left-facing gun.

The gun is part of the shoot painting. It is that fighter's own arm, from the shoulder, into the hand on the pistol. Do not stamp a separate hand or a CSS gun on top.

## Admin panel

Add a section to `AdminCenter`, id `stage`, label `Stage`, next to Mechanics (`economy`). Same shell: scope select, change note, `run("stage", body)`, audit row, unsaved warning.

Permission: `roleCan(role, "config")`. Economist, admin, and owner can save. Viewer can read. Store one JSON document per game scope, the same way gauntlet rules are stored. Validate with a sibling of `validateGauntletRules` that calls `stageConfig()` and rejects anything outside the clamps in `src/config.ts`.

The panel edits `StageConfig`. Every field:

### Playback

| Field | Default | Clamp | What it does |
| --- | --- | --- | --- |
| `playback.speed` | 1 | 0.25–3 | Divides every hold. |
| `playback.sound` | true | bool | Mute, no button on the stage. |
| `playback.autoplay` | true | bool | False holds the faceoff until the battle system says play. |

Seed, fortification, which crews, and which preset are not stage fields. They are arguments to `resolveBattleDice` / `beginGauntlet`. Put seed and fort on the battle record, not on this form.

### Chrome

| Field | Default |
| --- | --- |
| `chrome.title` | 2d10 Gauntlet |
| `chrome.subtitle` | Same streets. The dice call it. |
| `chrome.brand` | Hustle |
| `chrome.brandNote` | People · Territory · Power |
| `chrome.tagline` | More than money. |
| `chrome.neonLeft` | Territory / pays |
| `chrome.neonRight` | Hustle / lives here |
| `chrome.backdrop` | `/stage/underpass.jpg` |

The title, subtitle, and "More than money." are currently not rendered. The policy still carries them so the panel can turn the header back on without a code change. Wire `chrome.*` into the top bar only if the flag `show.header` is added. Do not put them back by default.

### Show

All default true.

`docks`, `exchange`, `queue`, `rules`, `result`, `banner`, `rain`, `neon`, `blood`, `muzzle`, `shake`, `floater`.

`docks` is the two crew cards. `exchange` is the 2d10 / save / wound rail. `queue` is the gauntlet order. `rules` is the three rule lines. `result` is objective, outcome, round. `banner` is the winner plate at the end. `blood` and `muzzle` are drawn by the puppet. `shake` is the street kick on a hit. `floater` is the Hit / Crit / Counter word.

### Timing

Seconds, each clamped 0.2–8, except `aimMs` 0–2000. Defaults are the table above. `aimMs` must match the gunshot delay in `src/sfx.ts` (today 700). If the panel changes `aimMs`, pass it into `setAim` (add that setter; the crack is currently a constant 0.7s).

### Audio mix

| Field | Default | Clamp |
| --- | --- | --- |
| `audio.master` | 0.85 | 0–1 |
| `audio.sfx` | 0.9 | 0–1 |
| `audio.rain` | 0.22 | 0–1 |

Gains live on the AudioContext in `src/sfx.ts` (`master`, `sfxBus`, `rainBus`). Add `setMix(config.audio)` and call it when the policy changes. Do not ship a slider on the stage.

### Art

| Field | Default |
| --- | --- |
| `art.root` | `/puppets` |
| `art.fx` | `/fx` |

Plus a map the panel owns, not hardcoded in the picture:

```ts
portraitToArt: Record<string, "king" | "reed" | "nova" | "jax" | "rico" | "spade" | "lobo" | "crow" | "june">
```

The battle system sets `look.art` from that map when it builds the log. The stage only reads `look.art`.

Also on the panel, because they change the picture and are easy to get wrong:

- Per-fighter `look.gun`. False uses the strike frames instead of the pistol.
- `look.build` `heavy` or `lean`. Changes the standing height.
- Replacement backdrop upload. Write the file, store the URL in `chrome.backdrop`.
- Replacement blood spray and stain. URLs under `art.fx`.

Do not put a color picker on the body. The sprites are painted. Recoloring means new PNGs.

## Wiring the config (still to do in the component)

`src/config.ts` is the contract. `stage.tsx` does not yet read every flag. When you connect the panel, thread them like this:

- `playback.speed` → the hold divisor (today a local `speed` state stuck at 1).
- `playback.sound` → `setMuted(!sound)` from `sfx.ts`.
- `playback.autoplay` → the effect that sets `playing`.
- `show.docks / exchange / queue / rules / result` → wrap those sections.
- `show.banner / rain / neon / floater` → the matching nodes in `stage.tsx`.
- `show.blood` and `show.muzzle` → props on `Puppet`.
- `show.shake` → skip the street `animate()` call.
- `chrome.backdrop` and the neon strings → the `<img class="plate">` and `.neon` nodes.
- `timing.*` → `holdFor`.
- `timing.aimMs` → the 700ms camera delay and the 0.7s delay inside `playBeat`.
- `audio.*` → `setMix`.
- `art.root` and `art.fx` → the image URLs in `puppet.tsx` (today `/puppets` and `/fx`).

Do not add the controls back onto the stage while you do this. The panel is the only editor.

## Rules the picture is allowed to mention

Shown as text, never recomputed:

- Attack, dodge, crit, and counter are each 2d10 plus a mod.
- Higher attack total strikes. Margin adds damage, up to `maximumMarginDamage`, on a base of `baseDamage`.
- Dodge and counter need `dodgeThreshold` or better. Security cannot be dodged.
- Crit at `critThreshold` or better multiplies the hit.
- A counter returns half. A dodge with loyalty can riposte.

Numbers come from `battle.rules`, which the host copies off `GAUNTLET`. If an admin changes `gauntlet.config.json` through the existing policy editor, the host must pass the new numbers. The stage will not notice a rules change on its own.

## Host, the whole of it

```tsx
const log = /* GauntletResult mapped to BattleLog, or the reference simulate() */;
const battle = readBattle(log, { place, objective, rules, ruleFor });
return <BattleStage key={log.seed + ":" + playId} battle={battle} config={stageConfig(policy)} />;
```

`playId` increments when an admin or the battle system asks for another play. That is the replay.

## Out of scope

- Rolling dice, HMAC, or rejection sampling.
- Choosing the winner, injuries, or fortification.
- Accounts, mail, warden, economy. Do not hang this off those admin sections.
- A control bar on the stage.

## Check

1. Seed `south-gate` through `resolveFlips` produces the same Entry, Clash, and Escape booleans on two runs.
2. The stage shows those three phases and the rolls from the log, not a second roll.
3. Setting the admin `system` to `gauntlet-2d10` plays a 2d10 tape instead, and setting it back plays Entry / Clash / Escape again.
4. No pause, step, replay, sound, speed, stage, seed, or fort control is visible.
4. Saving the stage policy as an economist writes an audit row and a viewer cannot.
5. `playback.sound: false` is silent. `show.blood: false` draws no spray. `aimMs` and the gunshot land together.
6. A fighter at 0 HP is the prone `down` frame, on the ground.
7. The gun arm on `shoot.png` is that fighter's arm. No second hand.
