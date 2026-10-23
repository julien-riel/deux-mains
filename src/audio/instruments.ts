// Instruments synthétisés : tous les sons sont créés avec Web Audio, sans fichier (ADR-0007)
import { mtof } from "../chanson/theorie";
import { S, chordAtBeat, layers, spb } from "../jeu/etat";
import { AC, B, decayGain, live, noise, osc, send, timeOfBeat } from "./moteur";

export const leadTimbre = (kind) => (S.theme === "boite" ? "box" : kind === "refrain" ? "pluck" : "bell");

export const boite = () => S.theme === "boite";
export function kick(t, v = 0.85) {
  if (boite()) v *= 0.55;
  const o = osc("sine", 150, t, t + 0.45);
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  const gn = decayGain(t, v, 0.42);
  o.connect(gn);
  gn.connect(B.dry);
}
export function snare(t, v = 0.3) {
  if (boite()) return woodblock(t, v);
  clap(t, v * 0.8);
  const bp = AC.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.7;
  const gn = decayGain(t, v, 0.17);
  noise(t, 0.2).connect(bp);
  bp.connect(gn);
  send(gn, 0.25, 0);
  const body = decayGain(t, 0.16, 0.09);
  osc("triangle", 185, t, t + 0.12).connect(body);
  body.connect(B.dry);
}
export function hat(t, v, open) {
  if (boite()) return clockTick(t, v, open);
  const hp = AC.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7200;
  const gn = decayGain(t, v, open ? 0.2 : 0.045);
  noise(t, open ? 0.25 : 0.06).connect(hp);
  hp.connect(gn);
  gn.connect(B.dry);
}
export function crash(t, v = 0.2) {
  if (boite()) return chime(t, v);
  const hp = AC.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3500;
  const gn = decayGain(t, v, 1.8);
  noise(t, 1.9).connect(hp);
  hp.connect(gn);
  send(gn, 0.4, 0);
}
export function click(t, accent) {
  const gn = decayGain(t, accent ? 0.2 : 0.13, 0.05);
  osc("sine", accent ? 1700 : 1150, t, t + 0.07).connect(gn);
  gn.connect(B.dry);
}
// Ville : clap sous la caisse claire. Boîte : bloc de bois, tic-tac du mécanisme, petit carillon
export function clap(t, v) {
  const bp = AC.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1300;
  bp.Q.value = 1.2;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0, t);
  for (const o of [0, 0.011, 0.022]) {
    gn.gain.setValueAtTime(v * 0.9, t + o);
    gn.gain.setTargetAtTime(0, t + o + 0.001, 0.006);
  }
  gn.gain.setValueAtTime(v * 0.8, t + 0.033);
  gn.gain.setTargetAtTime(0, t + 0.034, 0.05);
  noise(t, 0.25).connect(bp);
  bp.connect(gn);
  send(gn, 0.2, 0);
}
export function woodblock(t, v) {
  const gn = decayGain(t, v * 1.1, 0.07);
  osc("sine", 820, t, t + 0.1).connect(gn);
  const g2 = decayGain(t, v * 0.5, 0.04);
  osc("triangle", 1670, t, t + 0.06).connect(g2);
  g2.connect(gn);
  send(gn, 0.3, 0);
}
export function clockTick(t, v, open) {
  const bp = AC.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = open ? 3200 : 4500;
  bp.Q.value = 4;
  const gn = decayGain(t, v * 1.6, open ? 0.05 : 0.02);
  noise(t, 0.06).connect(bp);
  bp.connect(gn);
  gn.connect(B.dry);
}
export function chime(t, v) {
  const gn = decayGain(t, v * 0.5, 2.2);
  for (const m of [91, 98, 103]) osc("sine", mtof(m), t, t + 2.3).connect(gn);
  send(gn, 0.6, 0.2);
}
export function padV(t, ch, dur) {
  const notes = [ch.root - 12, ...ch.ints.slice(1).map((i) => ch.root - 12 + i), ch.root];
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1100;
  lp.Q.value = 0.4;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.032, t + 0.35);
  gn.gain.setValueAtTime(0.032, t + dur - 0.1);
  gn.gain.linearRampToValueAtTime(0, t + dur + 0.5);
  lp.connect(gn);
  send(gn, 0.5, 0);
  // Boîte : harmonium doux (triangle) ; Ville : nappe de synthé (dents de scie)
  for (const m of notes)
    for (const det of [-7, 7]) osc(boite() ? "triangle" : "sawtooth", mtof(m), t, t + dur + 0.6, det).connect(lp);
}
// `fin` : sur une pente (#12), la fréquence glisse jusqu'à cette note, pour arriver au bout de la note tenue
export function bassV(t, m, dur, accent = 1, fin?: number) {
  const f = mtof(m),
    end = t + dur;
  const glisse = (o) => {
    if (fin === undefined) return o;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(mtof(fin), end);
    return o;
  };
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 6;
  // Boîte : contrebasse pincée, plus ronde ; Ville : basse synthé funk
  lp.frequency.setValueAtTime(200, t);
  lp.frequency.linearRampToValueAtTime(boite() ? 900 : 1700, t + 0.012);
  lp.frequency.setTargetAtTime(boite() ? 320 : 450, t + 0.015, 0.09);
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.5 * accent, t + 0.006);
  gn.gain.setTargetAtTime(0.36 * accent, t + 0.02, 0.12);
  gn.gain.setTargetAtTime(0, end, 0.03);
  glisse(osc(boite() ? "triangle" : "sawtooth", f, t, end + 0.4)).connect(lp);
  lp.connect(gn);
  const sub = AC.createGain();
  sub.gain.value = 0.6;
  glisse(osc("sine", f, t, end + 0.4)).connect(sub);
  sub.connect(gn);
  send(gn, 0, 0);
  return {
    stop(at) {
      gn.gain.cancelScheduledValues(at);
      gn.gain.setTargetAtTime(0, at, 0.03);
    },
  };
}
// La vitesse et la profondeur du vibrato : environ six oscillations par seconde, un tiers de demi-ton
export const VIBRATO_HZ = 5.5,
  VIBRATO_CENTS = 35;
export function leadV(t, m, dur, timbre, vel = 1) {
  const f = mtof(m),
    hold = dur > 0,
    end = t + dur,
    stop = end + 1.4;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.24 * vel, t + 0.005);
  if (hold) {
    gn.gain.setTargetAtTime(0.14 * vel, t + 0.01, 0.12);
    gn.gain.setTargetAtTime(0, end, 0.08);
  } else gn.gain.setTargetAtTime(0, t + 0.01, timbre === "box" ? 0.4 : timbre === "bell" ? 0.22 : 0.14);
  // Les oscillateurs de la voix : le vibrato fait osciller leur hauteur ensemble, le serpent la fait glisser
  const os: OscillatorNode[] = [],
    o = (type, fr, fin, det = 0) => {
      const n = osc(type, fr, t, fin, det);
      os.push(n);
      return n;
    };
  if (timbre === "box") {
    // Lame de boîte à musique : partiels inharmoniques très brefs, fondamentale qui tinte
    const f2 = f * 2;
    o("sine", f2, stop + 0.6).connect(gn);
    for (const [r, v, d] of [
      [2.76, 0.3, 0.06],
      [5.4, 0.12, 0.025],
    ]) {
      const p = AC.createGain();
      p.gain.setValueAtTime(v, t);
      p.gain.setTargetAtTime(0, t, d);
      o("sine", f2 * r, stop).connect(p);
      p.connect(gn);
    }
  } else if (timbre === "bell") {
    o("sine", f, stop).connect(gn);
    const p = AC.createGain();
    p.gain.setValueAtTime(0.35, t);
    p.gain.setTargetAtTime(0, t, 0.05);
    o("sine", f * 4, stop).connect(p);
    p.connect(gn);
    const tr = AC.createGain();
    tr.gain.value = 0.3;
    o("triangle", f * 2, stop).connect(tr);
    tr.connect(gn);
  } else {
    const lp = AC.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.setTargetAtTime(hold ? 1800 : 900, t + 0.01, 0.12);
    o("sawtooth", f, stop, -5).connect(lp);
    o("triangle", f, stop, 5).connect(lp);
    lp.connect(gn);
  }
  send(gn, 0.28, 0.32);
  // Les fréquences de départ des oscillateurs : le glissando du serpent (#16) les déplace toutes du même rapport
  const bases = os.map((n) => n.frequency.value);
  // Le vibrato (#17) : un oscillateur lent, créé au premier tapotement, module la hauteur de quelques centièmes
  // de demi-ton autour de la note, qui ne change pas de degré (ADR-0003). Chaque tapotement le ravive, puis il s'éteint.
  let vib: GainNode = null;
  return {
    stop(at) {
      gn.gain.cancelScheduledValues(at);
      gn.gain.setTargetAtTime(0, at, 0.04);
    },
    vibrer(at) {
      if (!vib) {
        vib = AC.createGain();
        vib.gain.value = 0;
        osc("sine", VIBRATO_HZ, at, stop).connect(vib);
        for (const n of os) vib.connect(n.detune);
      }
      vib.gain.cancelScheduledValues(at);
      vib.gain.setTargetAtTime(VIBRATO_CENTS, at, 0.03);
      vib.gain.setTargetAtTime(0, at + 0.35, 0.25);
    },
    // Le glissando (#16) : la hauteur glisse en quelques centièmes de seconde jusqu'à la note du nouveau couloir,
    // sans couper la voix, et un léger regain d'attaque fait entendre le passage
    glisser(midi, at) {
      const r = mtof(midi) / f;
      os.forEach((n, i) => n.frequency.setTargetAtTime(bases[i] * r, at, GLISSANDO));
      if (!hold || at >= end) return;
      gn.gain.setTargetAtTime(0.2 * vel, at, 0.01);
      gn.gain.setTargetAtTime(0.14 * vel, at + 0.04, 0.1);
    },
  };
}
// Le temps du glissando d'un serpent (#16) : la constante de temps de la montée vers la nouvelle note, en secondes
export const GLISSANDO = 0.035;
/** Fait glisser la voix d'un serpent (#16) jusqu'à la note de son couloir `k`, à l'heure `t` */
export function glisserVoix(ev, k, t) {
  ev.voice?.glisser?.(ev.midiSerpent[k], t);
}
export function harmV(t, m) {
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.08, t + 0.02);
  gn.gain.setTargetAtTime(0, t + 0.05, 0.25);
  osc("sine", mtof(m), t, t + 1.4).connect(gn);
  osc("sine", mtof(m), t, t + 1.4, 9).connect(gn);
  send(gn, 0.5, 0.2);
}
export function arpV(t, m) {
  const gn = decayGain(t, 0.05, 0.2);
  osc(boite() ? "sine" : "triangle", mtof(m), t, t + 0.25).connect(gn);
  send(gn, 0.2, 0.3);
}
export function stringsV(t, ch, dur) {
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(0.016, t + 0.8);
  gn.gain.setValueAtTime(0.016, t + dur - 0.2);
  gn.gain.linearRampToValueAtTime(0, t + dur + 0.8);
  lp.connect(gn);
  send(gn, 0.6, 0);
  for (const m of ch.lanes.slice(0, 3))
    for (const det of [-9, 9]) osc("sawtooth", mtof(m + 12), t, t + dur + 1, det).connect(lp);
}
export function thud() {
  const t = AC.currentTime;
  const o = osc("sine", 78, t, t + 0.3, 60);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.2);
  const gn = decayGain(t, 0.55, 0.26);
  o.connect(gn);
  gn.connect(B.dry);
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const ng = decayGain(t, 0.35, 0.14);
  noise(t, 0.16).connect(lp);
  lp.connect(ng);
  ng.connect(B.dry);
}
export function tick() {
  const t = AC.currentTime;
  const bp = AC.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 800;
  const gn = decayGain(t, 0.14, 0.035);
  noise(t, 0.05).connect(bp);
  bp.connect(gn);
  gn.connect(B.dry);
}
// Mort : tout ce qui sonne glisse de deux octaves vers le grave, comme une cassette qui s'arrête
export function tapeStop() {
  const t = AC.currentTime;
  live.forEach((o) => {
    try {
      o.detune.cancelScheduledValues(t);
      o.detune.setValueAtTime(o.detune.value, t);
      o.detune.linearRampToValueAtTime(o.detune.value - 2400, t + 1.5);
    } catch {
      /* voix déjà arrêtée */
    }
  });
  const ch = chordAtBeat(S.deathBeat);
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0.11, t);
  gn.gain.linearRampToValueAtTime(0, t + 1.6);
  for (const m of [ch.root - 12, ch.root - 12 + ch.ints[1], ch.root - 12 + ch.ints[2]]) {
    const o = osc("sawtooth", mtof(m), t, t + 1.7);
    o.detune.setValueAtTime(0, t);
    o.detune.linearRampToValueAtTime(-2400, t + 1.5);
    o.connect(lp);
  }
  lp.connect(gn);
  send(gn, 0.4, 0);
  B.filt.frequency.cancelScheduledValues(t);
  B.filt.frequency.setValueAtTime(B.filt.frequency.value, t);
  B.filt.frequency.exponentialRampToValueAtTime(220, t + 1.5);
}

// L'impact de l'écrasement (#8) : la cymbale (le carillon dans la Boîte) et un grave appuyé, qui tombe de l'octave
// sur la fondamentale de la basse
export function impact(t, m) {
  crash(t, 0.3);
  kick(t, 1);
  const o = osc("sine", mtof(m + 12), t, t + 1);
  o.frequency.setValueAtTime(mtof(m + 12), t);
  o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.25);
  const gn = decayGain(t, boite() ? 0.3 : 0.45, 0.5);
  o.connect(gn);
  gn.connect(B.dry);
}

// `lane` : pour une trille (#15), le couloir appuyé
export function playHit(ev, t, lane = ev.lane) {
  if (ev.trille !== undefined) {
    // Chaque appui de la trille fait sonner brièvement la note de son couloir, un peu moins fort que la mélodie
    leadV(t, lane === ev.lane ? ev.midi : ev.midiTrille, 0, leadTimbre(ev.kind), 0.85 * (ev.vel || 1));
  } else if (ev.hand === "L" && ev.lane === 3) {
    ev.voice = bassV(t, ev.midi, 0.9 * spb(), 1.5);
    impact(t, ev.midi);
  } else if (ev.hand === "L" && ev.fin !== undefined) {
    // La pente (#12) arrive sur sa note au bout de la rampe, même jouée un peu en retard
    ev.voice = bassV(t, ev.midi, Math.max(0.1, timeOfBeat(ev.beat + ev.dur) - t), 1, ev.fin);
  } else if (ev.hand === "L") ev.voice = bassV(t, ev.midi, ev.dur > 0 ? ev.dur * spb() : 0.42 * spb());
  else {
    ev.voice = leadV(t, ev.midi, ev.dur * spb(), leadTimbre(ev.kind), ev.vel || 1);
    if (layers().choir && ev.harm) harmV(t, ev.harm);
  }
}
