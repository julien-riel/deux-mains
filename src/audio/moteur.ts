/* ---------- Audio ---------- */
import { S, spb } from "../jeu/etat";

export const lat = () => (AC && (AC.outputLatency || AC.baseLatency)) || 0;
// Le temps de la chanson tel que le joueur l'entend, corrigé du décalage mesuré par le calibrage (#30).
// Le jugement et l'image le suivent ; la programmation des sons (timeOfBeat) ne le suit pas.
export const songNow = () => AC.currentTime - lat() - S.decalage - S.t0 + S.startBeat * spb();
export const timeOfBeat = (b) => S.t0 + (b - S.startBeat) * spb();

export let AC = null,
  B = null,
  NOISE = null;
export const live = new Set<OscillatorNode>();

export function initAudio() {
  if (AC) return;
  AC = new (
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  )({ latencyHint: "interactive" });
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  comp.connect(AC.destination);
  const master = AC.createGain();
  master.gain.value = 0.8;
  master.connect(comp);
  const filt = AC.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 18000;
  filt.Q.value = 0.8;
  filt.connect(master);
  const dry = AC.createGain();
  dry.connect(filt);
  const verb = AC.createConvolver();
  verb.buffer = impulse(2.4);
  const vOut = AC.createGain();
  vOut.gain.value = 0.3;
  verb.connect(vOut).connect(filt);
  const delay = AC.createDelay(2);
  delay.delayTime.value = 0.45;
  const fb = AC.createGain();
  fb.gain.value = 0.33;
  const tone = AC.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2800;
  delay.connect(tone);
  tone.connect(fb);
  fb.connect(delay);
  const dOut = AC.createGain();
  dOut.gain.value = 0.5;
  tone.connect(dOut).connect(filt);
  B = { master, filt, dry, verb, delay };
  NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = NOISE.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function impulse(sec) {
  const len = Math.floor(AC.sampleRate * sec),
    b = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return b;
}
export function send(node, verb, delay) {
  node.connect(B.dry);
  if (verb) {
    const v = AC.createGain();
    v.gain.value = verb;
    node.connect(v);
    v.connect(B.verb);
  }
  if (delay) {
    const d = AC.createGain();
    d.gain.value = delay;
    node.connect(d);
    d.connect(B.delay);
  }
}
// Sous 25 % d'harmonie, chaque voix naît légèrement désaccordée
export const wobble = () => (S.health < 25 && S.mode === "play" ? (Math.random() * 2 - 1) * 38 : 0);
export function osc(type, f, t, stop, det = 0) {
  const o = AC.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = det + wobble();
  o.start(t);
  o.stop(stop);
  live.add(o);
  o.onended = () => live.delete(o);
  return o;
}
export function noise(t, dur) {
  const n = AC.createBufferSource();
  n.buffer = NOISE;
  n.start(t, Math.random() * 0.5);
  n.stop(t + dur);
  return n;
}
export function decayGain(t, v, dec) {
  const gn = AC.createGain();
  gn.gain.setValueAtTime(v, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dec);
  return gn;
}
