import { useEffect, useRef, useState } from "react";
import { Puppet } from "./puppet.tsx";
import { armAudio, audioRunning, playBeat, setMuted, unlockAudio } from "./sfx.ts";
import type { DiceRoll, Side, StageBattle, StageBeat, StageCrew, StageFighter } from "./types.ts";
import { CloudRain, Dices, Shield, Swords } from "lucide-react";

function reducedMotion() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function holdFor(beat: StageBeat) {
  if (beat.hold) return beat.hold;
  switch (beat.verb) {
    case "faceoff":
      return 2.4;
    case "end":
      return 3.2;
    case "tie":
      return 1.8;
    case "dodge":
      return 2.4;
    case "crit":
      return 2.8;
    case "counter":
      return 3;
    case "heal":
      return 2.2;
    default:
      return 2.6;
  }
}

function shotOf(beat: StageBeat) {
  return Object.values(beat.poses).includes("shoot");
}

function impactOf(beat: StageBeat): "" | "hit" | "dodge" | "crit" {
  if (beat.verb === "crit") return "crit";
  if (beat.verb === "dodge") return "dodge";
  if (beat.damage > 0 || beat.counterDamage > 0 || beat.riposte > 0) return "hit";
  return "";
}

function lead(side: Side, beat: StageBeat, crew: StageCrew) {
  const id = beat.active?.[side];
  return crew.fighters.find((f) => f.id === id) ?? crew.fighters.find((f) => (beat.hp[f.id]?.hp ?? 0) > 0) ?? crew.fighters[0];
}

function Pips({ roll, label }: { roll: DiceRoll; label: string }) {
  return (
    <span className="pips" title={label}>
      <i>{roll.dice[0]}</i>
      <i>{roll.dice[1]}</i>
      <em>{roll.modifier >= 0 ? `+${roll.modifier}` : roll.modifier}</em>
      <small>
        {label} {roll.total}
      </small>
    </span>
  );
}

function CrewCard({ side, crew, beat, fort, flips }: { side: Side; crew: StageCrew; beat: StageBeat; fort: number; flips: boolean }) {
  const f = lead(side, beat, crew);
  const pool = beat.hp[f.id] ?? { hp: f.hp, shield: f.shield };
  const down = pool.hp <= 0;
  return (
    <aside className={`dock dock-${side}`}>
      <header className="dock-kicker">
        <span>{side === "attacker" ? "Crew" : "Enemy crew"}</span>
        <b>{crew.name}</b>
      </header>
      <div className="boss">
        <div className="boss-bust" data-down={down} data-side={side}>
          <Puppet look={f.look} pose={down ? "down" : "guard"} live={false} />
        </div>
        <div className="boss-copy">
          <strong>{f.name}</strong>
          <em>
            {f.role} · {f.className}
          </em>
          <p className="tagline">{f.quote}</p>
        </div>
      </div>
      <div className="bar-label">
        <span>HP</span>
        <span>
          {pool.hp}/{f.hp}
        </span>
      </div>
      <div className="meter meter-hp">
        <span style={{ width: `${Math.max(0, Math.round((pool.hp / f.hp) * 100))}%` }} />
      </div>
      <div className="bar-label">
        <span>Shield</span>
        <span>
          {pool.shield}/{f.shield}
        </span>
      </div>
      <div className="meter meter-shield">
        <span style={{ width: `${f.shield ? Math.max(0, Math.round((pool.shield / f.shield) * 100)) : 0}%` }} />
      </div>
      {side === "defender" && fort > 0 && (
        <>
          <div className="bar-label">
            <span>Fort</span>
            <span>{fort}</span>
          </div>
          <div className="meter meter-fort">
            <span style={{ width: "100%" }} />
          </div>
        </>
      )}
      <dl className="mods">
        {(flips && f.stats
          ? [
              ["PWR", f.stats.power],
              ["STL", f.stats.stealth],
              ["TCH", f.stats.tech],
              ["CHR", f.stats.charisma],
              ["LOY", f.stats.loyalty],
            ]
          : [
              ["ATK", f.attack],
              ["DDG", f.dodge],
              ["CRT", f.crit],
              ["CTR", f.counter],
              ["SHD", f.shield],
            ]
        ).map(([k, n]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{Number(n) >= 0 ? `+${n}` : n}</dd>
          </div>
        ))}
      </dl>
      <p className="sources">
        {f.rule.name}. {f.rule.detail}
      </p>
      <ul className="roster">
        {crew.fighters.map((member) => {
          const hp = beat.hp[member.id] ?? { hp: member.hp, shield: member.shield };
          return (
            <li key={member.id} data-active={beat.active?.[side] === member.id} data-down={hp.hp <= 0}>
              <span className="who">
                {member.name}
                <small>{member.role}</small>
              </span>
              <span className="who-hp">
                {hp.hp}
                <small>/{member.hp}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function BattleStage({ battle }: { battle: StageBattle }) {
  const [speed, setSpeed] = useState(1);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMute] = useState(false);
  const [audioTick, setAudioTick] = useState(0);
  const [take, setTake] = useState(0);
  const heard = useRef("");
  const holdRef = useRef(2.2);
  const streetRef = useRef<HTMLElement>(null);
  const beat = battle.beats[Math.min(index, battle.beats.length - 1)];
  const finished = index >= battle.beats.length - 1;
  const shot = shotOf(beat);
  const impact = impactOf(beat);
  holdRef.current = holdFor(beat) / speed;
  const flips = battle.system === "entry-clash-escape";
  const fell = beat.verb !== "faceoff" && beat.verb !== "end" && / is down| are down/.test(beat.caption);

  const replay = () => {
    unlockAudio();
    setTake((n) => n + 1);
    setIndex(0);
    setPlaying(true);
  };

  useEffect(() => {
    setIndex(0);
    setPlaying(!reducedMotion());
  }, [battle]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc >= holdRef.current) {
        acc = 0;
        setIndex((n) => (n >= battle.beats.length - 1 ? n : n + 1));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, battle]);

  useEffect(() => {
    armAudio();
    const saved = localStorage.getItem("hustle-mute") === "1";
    setMute(saved);
    setMuted(saved);
    const onAudio = () => setAudioTick((n) => n + 1);
    window.addEventListener("hustle-audio", onAudio);
    return () => window.removeEventListener("hustle-audio", onAudio);
  }, []);

  useEffect(() => {
    const key = `${take}:${battle.seed}:${index}`;
    if (heard.current === key) return;
    if (muted) {
      heard.current = key;
      return;
    }
    if (!playBeat(beat, fell)) return;
    heard.current = key;
  }, [audioTick, beat, fell, index, muted, battle.seed, take]);

  useEffect(() => {
    const el = streetRef.current;
    if (!el || !impact || reducedMotion()) return;
    const amp = impact === "crit" ? 14 : impact === "dodge" ? 4 : 8;
    const wait = shot ? 700 : 0;
    let anim: Animation | undefined;
    const timer = window.setTimeout(() => {
      anim = el.animate(
        [
          { transform: "translate3d(0,0,0)" },
          { transform: `translate3d(${-amp}px, ${amp * 0.35}px, 0)`, offset: 0.18 },
          { transform: `translate3d(${amp * 0.75}px, ${-amp * 0.22}px, 0)`, offset: 0.42 },
          { transform: `translate3d(${-amp * 0.35}px, ${amp * 0.12}px, 0)`, offset: 0.7 },
          { transform: "translate3d(0,0,0)" },
        ],
        { duration: impact === "crit" ? 520 : 280, easing: "linear" },
      );
    }, wait);
    return () => {
      window.clearTimeout(timer);
      anim?.cancel();
    };
  }, [impact, index, shot]);

  useEffect(() => {
    if (index >= battle.beats.length - 1) setPlaying(false);
  }, [index, battle.beats.length]);

  useEffect(() => {
    const api = {
      seed: battle.seed,
      outcome: battle.winner ?? "unfinished",
      beats: battle.beats.length,
      get index() {
        return index;
      },
      caption: beat.caption,
      sound: audioRunning(),
    };
    (window as unknown as { __battle?: typeof api }).__battle = api;
  }, [battle, index, beat.caption, audioTick, finished]);

  const rolls = [beat.rolls.attacker, beat.rolls.defender, beat.rolls.dodge, beat.rolls.crit, beat.rolls.counter].filter(Boolean);
  const winnerName = battle.winner ? battle[battle.winner].name : "Neither crew";
  const hurt = battle.injuries.filter((item) => item.kind !== "standing" && item.kind !== "tired");

  return (
    <main className="show">
      <header className="topbar">
        <div className="brand">
          <span className="crown" aria-hidden="true">
            <Swords />
          </span>
          <div>
            <strong>Hustle</strong>
            <small>People · Territory · Power</small>
          </div>
        </div>
      </header>

      <section className="street" aria-label="Battle stage" ref={streetRef} data-impact={impact || undefined}>
        <img src="/stage/underpass.jpg" alt="" className="plate" />
        <div className="rain" />
        <div className="vignette" />
        <p className="neon neon-l">
          Territory
          <br />
          pays
        </p>
        <p className="neon neon-r">
          Hustle
          <br />
          lives here
        </p>
        <div className="versus">
          <b className="vs-mark">{flips ? (beat.phase === "faceoff" ? "vs" : (beat.phase ?? "vs")) : beat.verb === "faceoff" ? "vs" : beat.verb === "end" ? "end" : `r${beat.round}`}</b>
          {rolls.length > 0 && (
            <div className="dice-off">
              {beat.rolls.attacker && <Pips roll={beat.rolls.attacker} label="ATK" />}
              {beat.rolls.defender && <Pips roll={beat.rolls.defender} label="DEF" />}
              {beat.rolls.dodge && <Pips roll={beat.rolls.dodge} label="DDG" />}
              {beat.rolls.crit && <Pips roll={beat.rolls.crit} label="CRT" />}
              {beat.rolls.counter && <Pips roll={beat.rolls.counter} label="CTR" />}
            </div>
          )}
          <p>{beat.caption}</p>
        </div>
        {(impact === "hit" || impact === "crit") && <div key={index} className="shot-flash" />}
        <div className="cast">
          {(["attacker", "defender"] as const).map((side) => (
            <div key={side} className={`wing wing-${side}`}>
              {battle[side].fighters.map((f, i) => {
                const active = beat.active?.[side] === f.id;
                const pose = beat.poses[f.id] ?? "idle";
                return (
                  <div
                    key={f.id}
                    className="actor"
                    data-side={side}
                    data-active={active}
                    data-pose={pose}
                    data-build={f.look.build}
                    style={{ animationDelay: `${i * 140}ms` }}
                  >
                    <Puppet look={f.look} pose={pose} cue={pose === "idle" || pose === "down" ? pose : `${index}:${pose}`} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {shot && impact && (
          <b key={`hit-${index}`} className="floater">
            {impact === "crit" ? "Critical" : beat.verb === "counter" ? "Counter" : "Hit"}
          </b>
        )}
        {finished && (
          <div className="banner">
            <Shield />
            <strong>{winnerName}</strong>
            <span>{beat.caption}</span>
          </div>
        )}
      </section>

      <CrewCard side="attacker" crew={battle.attacker} beat={beat} fort={0} flips={flips} />
      <CrewCard side="defender" crew={battle.defender} beat={beat} fort={beat.fort.defender} flips={flips} />

      <section className="lower">
        <div className="panel verbs">
          <h2>
            <Dices /> {flips ? "Phases" : "Exchange"}
          </h2>
          <div className="verb-row">
            {flips
              ? (battle.phases ?? []).map((phase) => (
                  <article key={phase.id} className="verb" data-hot={beat.phase === phase.id}>
                    <b>{phase.id}</b>
                    <span>
                      {phase.success ? "Held" : "Failed"}. Roll {phase.roll.toFixed(2)} against {phase.weight.toFixed(2)}. {phase.detail}
                    </span>
                  </article>
                ))
              : (
                <>
                  <article className="verb" data-hot={beat.verb === "exchange" || beat.verb === "opening" || beat.verb === "crit"}>
                    <b>2d10</b>
                    <span>
                      {beat.rolls.attacker && beat.rolls.defender
                        ? `${beat.rolls.attacker.total} against ${beat.rolls.defender.total}. Higher roll strikes.`
                        : "Each fighter rolls 2d10 and adds their attack mod."}
                    </span>
                  </article>
                  <article className="verb" data-hot={beat.verb === "dodge" || beat.verb === "counter"}>
                    <b>Save</b>
                    <span>
                      {beat.rolls.dodge
                        ? `Dodge ${beat.rolls.dodge.total}${beat.rolls.counter ? ` · counter ${beat.rolls.counter.total}` : ""}.`
                        : `Dodge and counter need ${battle.rules.dodgeThreshold}+. Security cannot be dodged.`}
                    </span>
                  </article>
                  <article className="verb" data-hot={beat.verb === "crit" || beat.verb === "heal"}>
                    <b>Wound</b>
                    <span>
                      {beat.damage > 0
                        ? `${beat.damage} damage${beat.verb === "crit" ? " · critical" : ""}${beat.counterDamage ? ` · ${beat.counterDamage} back` : ""}.`
                        : `Crit at ${battle.rules.critThreshold}+ multiplies the hit.`}
                    </span>
                  </article>
                </>
              )}
          </div>
        </div>
        <div className="panel queue">
          <h2>{flips ? "Crew" : "Gauntlet"}</h2>
          <div className="queue-row">
            {battle.attacker.fighters.map((f) => (
              <QueueToken key={f.id} f={f} beat={beat} side="attacker" />
            ))}
            <span className="queue-gap" />
            {battle.defender.fighters.map((f) => (
              <QueueToken key={f.id} f={f} beat={beat} side="defender" />
            ))}
          </div>
          <p>{flips ? "Entry, then clash, then escape. One roll each." : "One duel at a time. The next fighter steps up when the one in front drops."}</p>
        </div>
        <div className="panel env">
          <h2>
            <CloudRain /> {battle.place}
          </h2>
          {flips ? (
            <ul>
              <li>Entry is the approach. Stealth and tech against the outpost.</li>
              <li>Clash is the fight. Power decides who holds the street.</li>
              <li>Escape is the way out. A failed escape raises heat.</li>
            </ul>
          ) : (
            <ul>
              <li>Attack, dodge, crit, and counter are each 2d10 plus a stat mod.</li>
              <li>Margin adds damage, up to +{battle.rules.maximumMarginDamage} on a base of {battle.rules.baseDamage}.</li>
              <li>A counter returns half. A dodge with loyalty can riposte.</li>
            </ul>
          )}
          <p className="fine">Rules {battle.rules.version}.{flips ? "" : " Dice are 2d10."}</p>
        </div>
        <div className="panel info">
          <h2>Result</h2>
          <dl>
            <div>
              <dt>Objective</dt>
              <dd>{battle.objective}</dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>{finished ? winnerName : "In the street"}</dd>
            </div>
            <div>
              <dt>Round</dt>
              <dd>
                {beat.round} · beat {index + 1}/{battle.beats.length}
              </dd>
            </div>
            {finished && hurt.length > 0 && (
              <div>
                <dt>Down</dt>
                <dd>{hurt.map((item) => `${item.name} ${item.kind}`).join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>
    </main>
  );
}

function QueueToken({ f, beat, side }: { f: StageFighter; beat: StageBeat; side: Side }) {
  const down = (beat.hp[f.id]?.hp ?? f.hp) <= 0;
  const now = beat.active?.[side] === f.id;
  return (
    <div className="token" data-side={side} data-down={down} data-now={now}>
      <Puppet look={f.look} pose={down ? "down" : "guard"} live={false} />
      <span>{f.name}</span>
      {now && <em>Now</em>}
    </div>
  );
}
