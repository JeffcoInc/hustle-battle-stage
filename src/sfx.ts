import type { Side } from "./types.ts";

type Audible = {
  verb?: string;
  sound?: string;
  poses: Record<string, string>;
  striker: Side | null;
  shot?: boolean;
  damage?: number;
  riposte?: number;
  counterDamage?: number;
};

/**
 * Procedural stage audio. Gunshots and body impacts are rendered once into
 * buffers so the crack and the hit stay sharp, then played in time with the
 * muzzle frame.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let rainBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let shots: AudioBuffer[] = [];
let hits: AudioBuffer[] = [];
let muted = false;
let rainOn = false;
let armed = false;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    rainBus = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    sfxBus.gain.value = 0.9;
    rainBus.gain.value = 0.22;
    sfxBus.connect(master);
    rainBus.connect(master);
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    shots = [0, 1, 2].map((n) => bake(ctx!, renderShot(ctx!.sampleRate, n)));
    hits = [0, 1, 2].map((n) => bake(ctx!, renderHit(ctx!.sampleRate, n)));
  }
  return ctx;
}

function burst(buffer: AudioBuffer, when: number, dur: number, gainPeak: number, pan: number, filter?: { type: BiquadFilterType; freq: number; q?: number }) {
  if (!ctx || !sfxBus) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak), when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  let node: AudioNode = src;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, when);
    f.Q.value = filter.q ?? 0.7;
    src.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(p);
  p.connect(sfxBus);
  src.start(when);
  src.stop(when + dur + 0.02);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
    p.disconnect();
  };
}

function tone(freq: number, when: number, dur: number, type: OscillatorType, gainPeak: number, pan: number, slideTo?: number) {
  if (!ctx || !sfxBus) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), when + dur);
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak), when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(p);
  p.connect(sfxBus);
  o.start(when);
  o.stop(when + dur + 0.02);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
    p.disconnect();
  };
}

function startRain() {
  if (!ctx || !rainBus || !noise || rainOn) return;
  rainOn = true;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 720;
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 180;
  const g = ctx.createGain();
  g.gain.value = 0.55;
  src.connect(high);
  high.connect(low);
  low.connect(g);
  g.connect(rainBus);
  src.start();
  const drip = () => {
    if (!ctx || muted || ctx.state !== "running") {
      window.setTimeout(drip, 900);
      return;
    }
    const when = ctx.currentTime + Math.random() * 0.2;
    burst(noise!, when, 0.09 + Math.random() * 0.08, 0.05 + Math.random() * 0.04, (Math.random() * 2 - 1) * 0.8, {
      type: "highpass",
      freq: 1800 + Math.random() * 2200,
      q: 0.6,
    });
    window.setTimeout(drip, 280 + Math.random() * 700);
  };
  window.setTimeout(drip, 400);
}

export function unlockAudio() {
  const audio = context();
  if (!audio) return;
  const pending = audio.state === "suspended" ? audio.resume() : Promise.resolve();
  void pending.then(() => {
    startRain();
    window.dispatchEvent(new Event("hustle-audio"));
  });
}

export function armAudio() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const go = () => unlockAudio();
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}

export function setMuted(next: boolean) {
  muted = next;
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(next ? 0 : 0.85, ctx.currentTime, 0.03);
}

export function audioRunning() {
  return ctx?.state ?? "closed";
}

function sidePan(side: Side | null, towardTarget: boolean) {
  if (!side) return (Math.random() - 0.5) * 0.2;
  const striker = side === "attacker" ? -0.55 : 0.55;
  return towardTarget ? -striker : striker;
}

function bake(audio: AudioContext, samples: Float32Array) {
  const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}

function normalize(data: Float32Array, peak: number) {
  let max = 0.0001;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  const gain = peak / max;
  for (let i = 0; i < data.length; i++) data[i] *= gain;
}

/** Wide bandpass. Q stays low so this is a blast, not a whistle. */
function bandpass(sample: number, freq: number, q: number, rate: number, s: { x1: number; x2: number; y1: number; y2: number }) {
  const w0 = (2 * Math.PI * freq) / rate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const y = (alpha / a0) * sample + ((-alpha) / a0) * s.x2 - ((-2 * Math.cos(w0)) / a0) * s.y1 - ((1 - alpha) / a0) * s.y2;
  s.x2 = s.x1;
  s.x1 = sample;
  s.y2 = s.y1;
  s.y1 = y;
  return y;
}

function renderShot(rate: number, variant: number) {
  const heavy = variant === 2;
  const n = Math.floor(rate * (heavy ? 0.42 : 0.3));
  const data = new Float32Array(n);
  const state = { x1: 0, x2: 0, y1: 0, y2: 0 };
  let low = 0;
  const start = heavy ? 4600 : 5200 - variant * 280;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    low += (white - low) * (heavy ? 0.035 : 0.05);
    const freq = start * Math.exp(-t * (heavy ? 18 : 26)) + (heavy ? 180 : 140);
    const blast = bandpass(white, Math.max(140, freq), heavy ? 0.55 : 0.62, rate, state);
    const crack = Math.exp(-t * (heavy ? 16 : 28));
    const body = Math.exp(-t * (heavy ? 7 : 11));
    const click = t < 0.0012 ? white : 0;
    data[i] = blast * crack * 0.95 + low * body * (heavy ? 1.2 : 0.8) + click * 0.65;
  }
  normalize(data, 0.95);
  return data;
}

function renderHit(rate: number, variant: number) {
  const hard = variant === 2;
  const n = Math.floor(rate * (hard ? 0.32 : 0.22));
  const data = new Float32Array(n);
  const state = { x1: 0, x2: 0, y1: 0, y2: 0 };
  let low = 0;
  const thumpHz = hard ? 86 : 118 + variant * 14;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    low += (white - low) * 0.04;
    const thump = Math.sin(2 * Math.PI * thumpHz * t) * Math.exp(-t * (hard ? 11 : 16));
    const body = low * Math.exp(-t * (hard ? 10 : 14));
    const tuck = bandpass(white, hard ? 340 : 480, 0.9, rate, state) * Math.exp(-t * (hard ? 32 : 46));
    data[i] = thump * (hard ? 0.9 : 0.72) + body * 0.85 + tuck * 0.42;
  }
  normalize(data, 0.9);
  return data;
}

function playBuf(buffer: AudioBuffer, when: number, gainPeak: number, pan: number, rate = 1) {
  if (!ctx || !sfxBus) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), when);
  g.gain.setValueAtTime(gainPeak, when);
  src.connect(g);
  g.connect(p);
  p.connect(sfxBus);
  src.start(when);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
    p.disconnect();
  };
}

/** Muzzle crack from the shooter, then the underpass slap. */
function report(when: number, pan: number, heavy: boolean) {
  const buf = shots[heavy ? 2 : (Math.random() * 2) | 0] ?? shots[0];
  if (!buf) return;
  const rate = (heavy ? 0.92 : 1) + (Math.random() - 0.5) * 0.06;
  playBuf(buf, when, heavy ? 0.95 : 0.8, pan, rate);
  playBuf(buf, when + (heavy ? 0.085 : 0.062), heavy ? 0.32 : 0.2, pan * -0.45, rate * 0.78);
}

/** Dull body impact on the person who was shot. */
function struck(when: number, pan: number, hard: boolean) {
  const buf = hits[hard ? 2 : (Math.random() * 2) | 0] ?? hits[0];
  if (!buf) return;
  playBuf(buf, when, hard ? 0.92 : 0.74, pan, 0.94 + Math.random() * 0.1);
}

function smack(beat: Audible, when: number, from: number, pan: number, heavy: boolean) {
  if (Object.values(beat.poses).includes("shoot")) {
    report(when, from, heavy);
    if (Object.values(beat.poses).includes("hit")) struck(when + 0.06, pan, heavy);
  } else punch(when, pan, heavy);
}

function punch(when: number, pan: number, heavy: boolean) {
  if (!noise) return;
  const rate = 0.92 + Math.random() * 0.16;
  tone(heavy ? 150 : 190, when, 0.16, "sine", heavy ? 0.55 : 0.38, pan, 46);
  tone((heavy ? 90 : 110) * rate, when, 0.1, "triangle", 0.22, pan, 40);
  burst(noise, when, heavy ? 0.12 : 0.08, heavy ? 0.42 : 0.28, pan, { type: "bandpass", freq: heavy ? 700 : 1200, q: 0.8 });
  burst(noise, when, 0.045, heavy ? 0.3 : 0.18, pan, { type: "highpass", freq: 2200, q: 0.4 });
}

function whoosh(when: number, pan: number) {
  if (!noise || !ctx) return;
  burst(noise, when, 0.22, 0.22, pan, { type: "highpass", freq: 900, q: 0.5 });
  tone(640, when, 0.16, "sine", 0.06, pan, 220);
}

function dice(when: number, pan: number) {
  if (!noise) return;
  for (let i = 0; i < 5; i++) {
    burst(noise, when + i * 0.045, 0.04, 0.16, pan + (Math.random() - 0.5) * 0.3, {
      type: "bandpass",
      freq: 1600 + Math.random() * 1800,
      q: 2.4,
    });
  }
}

function chime(when: number, pan: number) {
  tone(523, when, 0.28, "sine", 0.16, pan);
  tone(784, when + 0.06, 0.32, "sine", 0.1, pan);
  tone(1046, when + 0.12, 0.36, "triangle", 0.05, pan);
}

function sting(when: number) {
  tone(196, when, 0.45, "sawtooth", 0.08, 0, 98);
  tone(247, when + 0.08, 0.5, "triangle", 0.12, -0.2);
  tone(330, when + 0.16, 0.6, "sine", 0.14, 0.2);
  tone(392, when + 0.28, 0.7, "sine", 0.1, 0);
}

function bodyFall(when: number, pan: number) {
  if (!noise) return;
  tone(90, when, 0.28, "sine", 0.4, pan, 32);
  burst(noise, when + 0.05, 0.2, 0.28, pan, { type: "lowpass", freq: 400, q: 0.5 });
}

export function playBeat(beat: Audible, fell: boolean) {
  if (!ctx || ctx.state !== "running" || muted || !noise) return false;
  const now = ctx.currentTime + 0.02;
  const pan = sidePan(beat.striker, true);
  const from = sidePan(beat.striker, false);
  const verb = beat.sound ?? beat.verb;
  switch (verb) {
    case "faceoff":
      tone(110, now, 0.5, "sine", 0.22, 0, 55);
      tone(165, now + 0.08, 0.45, "triangle", 0.08, 0);
      burst(noise, now, 0.22, 0.12, 0, { type: "lowpass", freq: 420 });
      break;
    case "tension":
      tone(78, now, 0.7, "sine", 0.16, 0, 48);
      burst(noise, now, 0.25, 0.06, 0, { type: "lowpass", freq: 300 });
      break;
    case "slip":
      whoosh(now + 0.08, from);
      break;
    case "shot":
      report(now + 0.7, from, false);
      if (Object.values(beat.poses).includes("hit")) struck(now + 0.78, pan, false);
      break;
    case "heavy":
      report(now + 0.7, from, true);
      if (Object.values(beat.poses).includes("hit")) struck(now + 0.8, pan, true);
      break;
    case "entry":
    case "escape":
      if (beat.shot) {
        report(now + 0.7, from, false);
        if (Object.values(beat.poses).includes("hit")) struck(now + 0.78, pan, false);
      } else whoosh(now + 0.12, from);
      break;
    case "tie":
      dice(now, 0);
      break;
    case "opening":
    case "exchange":
      dice(now, from);
      if ((beat.damage ?? 0) > 0) smack(beat, now + (Object.values(beat.poses).includes("shoot") ? 0.7 : 0.2), from, pan, (beat.damage ?? 0) >= 24);
      break;
    case "dodge":
      dice(now, from);
      whoosh(now + 0.16, pan);
      if ((beat.riposte ?? 0) > 0) smack(beat, now + (Object.values(beat.poses).includes("shoot") ? 0.7 : 0.28), pan, from, false);
      break;
    case "crit":
      dice(now, from);
      smack(beat, now + (Object.values(beat.poses).includes("shoot") ? 0.7 : 0.18), from, pan, true);
      tone(880, now + 0.78, 0.12, "square", 0.05, pan, 1760);
      break;
    case "counter":
      dice(now, from);
      if ((beat.damage ?? 0) > 0) smack(beat, now + (Object.values(beat.poses).includes("shoot") ? 0.55 : 0.16), from, pan, false);
      smack(beat, now + (Object.values(beat.poses).includes("shoot") ? 0.85 : 0.32), pan, from, (beat.counterDamage ?? 0) >= 12);
      break;
    case "heal":
      chime(now, sidePan(beat.striker, false));
      break;
    case "end":
      sting(now);
      break;
    default:
      break;
  }
  if (Object.values(beat.poses).includes("heal") && verb !== "faceoff") chime(now + 0.05, 0);
  if (fell && verb !== "end" && verb !== "faceoff") bodyFall(now + 0.34, pan);
  return true;
}
