import { useMemo } from "react";
import { BattleStage, readFlips } from "@hustle/battle-stage";
import { PRESETS, stageBattle } from "@/game/engine";

/** Entry, Clash, Escape. The stage only plays the resolved log. */
export function StageHost() {
  const preset = PRESETS[0];
  const battle = useMemo(() => readFlips(stageBattle(preset, "south-gate", 1, 0)), [preset]);
  return <BattleStage battle={battle} />;
}
