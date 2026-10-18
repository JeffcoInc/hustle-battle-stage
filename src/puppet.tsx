import { useEffect, useState } from "react";
import { muzzleShot } from "./sfx.ts";
import type { Look, Pose } from "./types.ts";

/** Short clips. Action poses play once per cue; idle keeps breathing. */
const CLIPS: Record<Pose, { frames: string[]; ms: number; hold: number; loop: boolean }> = {
  idle: { frames: ["idle"], ms: 400, hold: 0, loop: true },
  guard: { frames: ["idle"], ms: 400, hold: 0, loop: true },
  strike: { frames: ["idle", "strike", "strike", "idle"], ms: 110, hold: 2, loop: false },
  shoot: { frames: ["shoot", "shoot-recoil", "shoot"], ms: 110, hold: 0, loop: false },
  dodge: { frames: ["idle", "dodge", "dodge", "idle"], ms: 120, hold: 2, loop: false },
  hit: { frames: ["hit"], ms: 160, hold: 0, loop: false },
  heal: { frames: ["heal", "idle", "heal", "idle"], ms: 220, hold: 0, loop: true },
  down: { frames: ["down"], ms: 400, hold: 0, loop: false },
};

function reducedMotion() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const PRELOAD = ["idle", "idle-b", "idle-c", "strike", "strike-b", "shoot", "shoot-recoil", "dodge", "dodge-b", "hit", "hit-b", "heal", "down"];

/** Painted side-view fighter. Faces +x. The enemy wing is mirrored in CSS. */
export function Puppet({ look, pose, cue = "", live = true }: { look: Look; pose: Pose; cue?: string; live?: boolean }) {
  const clip = CLIPS[pose] ?? CLIPS.idle;
  const [frame, setFrame] = useState(live ? 0 : clip.hold);
  useEffect(() => {
    for (const name of PRELOAD) {
      const img = new Image();
      img.src = `/puppets/${look.art}/${name}.png`;
    }
  }, [look.art]);
  useEffect(() => {
    if (!live || reducedMotion() || clip.frames.length < 2) {
      setFrame(clip.hold);
      return;
    }
    let cancel = false;
    let timer = 0;
    const start = () => {
      if (cancel) return;
      setFrame(0);
      let i = 0;
      timer = window.setInterval(() => {
        i += 1;
        if (!clip.loop && i >= clip.frames.length - 1) {
          setFrame(clip.frames.length - 1);
          window.clearInterval(timer);
          return;
        }
        setFrame(i % clip.frames.length);
      }, clip.ms);
    };
    if (pose === "shoot") {
      const img = new Image();
      img.src = `/puppets/${look.art}/shoot.png`;
      if (img.complete && img.naturalWidth > 0) start();
      else img.onload = start;
    } else start();
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [pose, cue, look.art, clip, live]);
  useEffect(() => {
    if (pose !== "shoot") return;
    let cancel = false;
    const go = () => {
      if (cancel) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancel) muzzleShot();
        });
      });
    };
    const img = new Image();
    img.src = `/puppets/${look.art}/shoot.png`;
    if (img.complete && img.naturalWidth > 0) go();
    else img.onload = go;
    return () => {
      cancel = true;
    };
  }, [pose, cue, look.art]);
  const name = clip.frames[Math.min(frame, clip.frames.length - 1)] ?? "idle";
  return (
    <span className="figure">
      <img className="puppet" src={`/puppets/${look.art}/${name}.png`} alt="" draggable={false} />
      {pose === "shoot" && frame === 0 && <span className="muzzle" />}
      {(pose === "hit" || pose === "down") && (
        <span className={pose === "down" ? "blood blood-stay" : "blood"} aria-hidden="true">
          <img className="spray" src="/fx/blood-spray.png" alt="" />
          <img className="stain" src="/fx/blood-stain.png" alt="" />
          <b /><b /><b /><b />
        </span>
      )}
    </span>
  );
}

