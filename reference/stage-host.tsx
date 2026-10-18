import { useMemo, useState } from "react";
import { BattleStage, readFlips } from "@hustle/battle-stage";
import { stageBattle, type Preset } from "@/game/engine";
import { DECK, cardById, cardMember } from "@/game/cards";

const SPOTS = [
  { name: "South Gate", place: "South Gate underpass", objective: "Hold the gate.", plate: "/stage/underpass.jpg" },
  { name: "Phoenix outpost", place: "Phoenix", objective: "Take the outpost.", plate: "/stage/outpost.jpg" },
  { name: "Night market", place: "Night market", objective: "Clear the stalls.", plate: "/stage/market.jpg" },
  { name: "The canal", place: "Canal road", objective: "Take the service road.", plate: "/stage/canal.jpg" },
  { name: "The roof", place: "Parking deck", objective: "Hold the deck.", plate: "/stage/roof.jpg" },
  { name: "Rail spur", place: "Rail yard", objective: "Clear the spur.", plate: "/stage/yard.jpg" },
  { name: "The motel", place: "Strip motel", objective: "Take the lot.", plate: "/stage/motel.jpg" },
  { name: "The dock", place: "Loading dock", objective: "Hold the doors.", plate: "/stage/dock.jpg" },
  { name: "The columns", place: "Highway columns", objective: "Hold the shadow.", plate: "/stage/columns.jpg" },
  { name: "The lot", place: "Desert lot", objective: "Take the chain.", plate: "/stage/lot.jpg" },
];

const STATS = ["power", "stealth", "tech", "charisma", "loyalty"] as const;

function deal() {
  const ids = DECK.map((fighter) => fighter.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = ids[i];
    ids[i] = ids[j];
    ids[j] = swap;
  }
  return {
    yours: ids.slice(0, 3),
    theirs: ids.slice(3, 6),
    spot: Math.floor(Math.random() * SPOTS.length),
  };
}
function totals(ids: string[]) {
  const sum = { power: 0, stealth: 0, tech: 0, charisma: 0, loyalty: 0 };
  for (const id of ids) {
    const fighter = DECK.find((c) => c.id === id);
    if (!fighter) continue;
    for (const key of STATS) sum[key] += fighter.stats[key];
  }
  return sum;
}

/** Pick a crew, then watch the battle system play it once. */
export function StageHost() {
  const [opening] = useState(deal);
  const [yours, setYours] = useState<string[]>(opening.yours);
  const [theirs, setTheirs] = useState<string[]>(opening.theirs);
  const [heat, setHeat] = useState(8);
  const [level, setLevel] = useState(2);
  const [theirLevel, setTheirLevel] = useState(2);
  const [spot, setSpot] = useState(opening.spot);
  const [seed, setSeed] = useState("");
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [last, setLast] = useState("");

  const battle = useMemo(() => {
    if (!seed) return null;
    const place = SPOTS[spot] ?? SPOTS[0];
    const preset: Preset = {
      id: "pit",
      label: place.name,
      place: place.place,
      objective: place.objective,
      attackerName: "Your crew",
      defenderName: "Their crew",
      attacker: yours,
      defender: theirs,
    };
    const roster = [...yours, ...theirs].map((id) => cardMember(cardById(id)));
    return readFlips(stageBattle(preset, seed, level, heat, theirLevel, roster));
  }, [heat, level, seed, spot, theirLevel, theirs, yours]);

  const run = (fresh: boolean) => {
    setDone(false);
    setSeed(`${fresh ? "pit" : "back"}-${Date.now().toString(36)}`);
  };

  if (!battle) {
    return (
      <Pit
        yours={yours}
        theirs={theirs}
        heat={heat}
        level={level}
        theirLevel={theirLevel}
        spot={spot}
        plate={(SPOTS[spot] ?? SPOTS[0]).plate}
        streak={streak}
        last={last}
        onYours={setYours}
        onTheirs={setTheirs}
        onHeat={setHeat}
        onLevel={setLevel}
        onTheirLevel={setTheirLevel}
        onSpot={setSpot}
        onRandomFighters={() => {
          const next = deal();
          setYours(next.yours);
          setTheirs(next.theirs);
        }}
        onRandomStreet={() => {
          setSpot((current) => {
            if (SPOTS.length < 2) return current;
            let next = current;
            while (next === current) next = Math.floor(Math.random() * SPOTS.length);
            return next;
          });
        }}
        onRun={() => run(true)}
      />
    );
  }

  return (
    <>
      <BattleStage battle={battle} plate={(SPOTS[spot] ?? SPOTS[0]).plate} onDone={(winner) => {
          setDone(true);
          setLast(winner === "attacker" ? "Your crew holds it." : "They held the street.");
          setStreak((n) => (winner === "attacker" ? n + 1 : 0));
        }}
      />
      {done && (
        <div className="recap">
          <div>
            <strong>{last}</strong>
            <span>{streak > 1 ? `${streak} streets in a row.` : streak === 1 ? "First street." : "Streak broken."}</span>
          </div>
          <button type="button" onClick={() => run(false)}>
            Run it back
          </button>
          <button
            type="button"
            onClick={() => {
              const next = deal();
              setYours(next.yours);
              setTheirs(next.theirs);
              setSpot(next.spot);
              run(true);
            }}
          >
            Random fight
          </button>
          <button type="button" onClick={() => setSeed("")}>
            Change crews
          </button>
        </div>
      )}
    </>
  );
}

function Pit({
  yours,
  theirs,
  heat,
  level,
  theirLevel,
  spot,
  plate,
  streak,
  last,
  onYours,
  onTheirs,
  onHeat,
  onLevel,
  onTheirLevel,
  onSpot,
  onRandomFighters,
  onRandomStreet,
  onRun,
}: {
  yours: string[];
  theirs: string[];
  heat: number;
  level: number;
  theirLevel: number;
  spot: number;
  plate: string;
  streak: number;
  last: string;
  onYours: (ids: string[]) => void;
  onTheirs: (ids: string[]) => void;
  onHeat: (n: number) => void;
  onLevel: (n: number) => void;
  onTheirLevel: (n: number) => void;
  onSpot: (n: number) => void;
  onRandomFighters: () => void;
  onRandomStreet: () => void;
  onRun: () => void;
}) {
  const toggle = (id: string, side: "yours" | "theirs") => {
    const mine = side === "yours" ? yours : theirs;
    const other = side === "yours" ? theirs : yours;
    const setMine = side === "yours" ? onYours : onTheirs;
    const setOther = side === "yours" ? onTheirs : onYours;
    if (mine.includes(id)) {
      if (mine.length === 1) return;
      setMine(mine.filter((item) => item !== id));
      return;
    }
    setOther(other.filter((item) => item !== id));
    setMine([...mine, id].slice(-3));
  };
  const yourSum = totals(yours);
  const theirSum = totals(theirs);
  return (
    <main className="pit">
      <img src={plate} alt="" className="plate" />
      <div className="pit-shade" />
      <header className="pit-head">
        <p>The pit</p>
        <h1>Pick the street</h1>
        <span>{(SPOTS[spot] ?? SPOTS[0]).name}</span>
      </header>
      <div className="pit-spots">
        {SPOTS.map((item, index) => (
          <button key={item.name} type="button" data-on={index === spot} onClick={() => onSpot(index)}>
            {item.name}
          </button>
        ))}
        <button type="button" className="pit-random" onClick={onRandomStreet}>
          Random street
        </button>
      </div>
      <div className="pit-crews">
        <CrewPick title="Your crew" ids={yours} sum={yourSum} side="yours" onToggle={toggle} />
        <CrewPick title="Their crew" ids={theirs} sum={theirSum} side="theirs" onToggle={toggle} />
      </div>
      <div className="pit-dials">
        <label>
          Your level {level}
          <input type="range" min={1} max={5} value={level} onChange={(e) => onLevel(Number(e.target.value))} />
        </label>
        <label>
          Their level {theirLevel}
          <input type="range" min={1} max={5} value={theirLevel} onChange={(e) => onTheirLevel(Number(e.target.value))} />
        </label>
        <label>
          Heat {heat}
          <input type="range" min={0} max={40} step={4} value={heat} onChange={(e) => onHeat(Number(e.target.value))} />
        </label>
        <button type="button" className="pit-random" onClick={onRandomFighters}>
          Random fighters
        </button>
        <button type="button" className="pit-run" onClick={onRun} disabled={!yours.length || !theirs.length}>
          Run the street
        </button>
      </div>
    </main>
  );
}

function CrewPick({
  title,
  ids,
  sum,
  side,
  onToggle,
}: {
  title: string;
  ids: string[];
  sum: ReturnType<typeof totals>;
  side: "yours" | "theirs";
  onToggle: (id: string, side: "yours" | "theirs") => void;
}) {
  return (
    <section className="crew-pick" data-side={side}>
      <h2>{title}</h2>
      <p className="pit-sum">
        PWR {sum.power} · STL {sum.stealth} · TCH {sum.tech} · CHR {sum.charisma} · LOY {sum.loyalty}
      </p>
      <div className="pit-roster">
        {DECK.map((fighter) => (
          <button key={fighter.id} type="button" data-on={ids.includes(fighter.id)} onClick={() => onToggle(fighter.id, side)}>
            <img src={`/puppets/${cardMember(fighter).look.art}/idle.png`} alt="" />
            <b>{fighter.name}</b>
            <small>
              {fighter.role} · {fighter.tier}
            </small>
            <em>
              {fighter.stats.power}/{fighter.stats.stealth}/{fighter.stats.tech}/{fighter.stats.charisma}/{fighter.stats.loyalty}
            </em>
          </button>
        ))}
      </div>
    </section>
  );
}
