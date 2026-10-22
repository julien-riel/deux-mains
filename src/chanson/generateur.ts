/* ---------- Générateur de chanson ---------- */
import { clamp } from "../outils";
import { mulberry32 } from "./aleatoire";
import { DIFFS } from "./difficultes";
import { NOTE_FR, PROGS, makeChord } from "./theorie";
import type { Chanson, Section } from "./types";

// Un motif de 2 mesures (16 croches) : rythme, puis contour en degrés voisins
export function genMotif(rng, P, occ, refrain) {
  for (let tries = 0; tries < 60; tries++) {
    const notes = [];
    let last = -99;
    // Accords à deux mains : une note forcée sur certains temps forts où la basse joue aussi
    const forced = new Set(P.cross.filter((s) => occ[s] && rng() < P.crossP));
    for (let s = 0; s < 16; s++) {
      if (forced.has(s)) {
        notes.push({ s, lane: 0, dur: 0, cross: true });
        last = s;
        continue;
      }
      if (s - last < P.gap) continue;
      if (P.surLesTemps && s % 2) continue;
      let p = s % 2 === 0 ? P.even : P.odd;
      if (s % 4 === 0) p += 0.1;
      if (refrain) p += 0.08;
      if (occ[s]) {
        if (P.avoid === "all") continue;
        if (P.avoid === "mostly" && !(s % 8 === 0 && rng() < 0.3)) continue;
      }
      if (rng() < p) {
        notes.push({ s, lane: 0, dur: 0 });
        last = s;
      }
    }
    if (notes.length < 3 || notes.length > P.max) continue;
    let lane = refrain ? 2 + Math.floor(rng() * 2) : Math.floor(rng() * 3);
    notes.forEach((n, i) => {
      if (i > 0) {
        const r = rng();
        let d = r < 0.35 ? -1 : r < 0.7 ? 1 : r < 0.85 ? 0 : rng() < 0.5 ? -2 : 2;
        if (n.s - notes[i - 1].s === 1 && Math.abs(d) > 1) d = Math.sign(d);
        lane = clamp(lane + d, 0, 3);
      }
      n.lane = lane;
    });
    notes[notes.length - 1].lane = 2; // la question finit sur la quinte
    notes.forEach((n, i) => {
      const next = i < notes.length - 1 ? notes[i + 1].s : 16;
      if (P.holdP && next - n.s >= 4 && rng() < P.holdP) n.dur = Math.min(next - n.s - 2, 4);
    });
    // Accords main droite : une deuxième note de l'accord, à deux degrés (fondamentale + quinte…) ou au degré voisin
    notes.forEach((n) => {
      const strong = n.s % 4 === 0;
      if (n.dur > 0 || (P.dyadStrong && (!strong || n.cross))) return;
      if (rng() < P.dyadP * (strong ? 1.5 : 1))
        n.extra = [rng() < 0.6 ? (n.lane <= 1 ? n.lane + 2 : n.lane - 2) : n.lane < 3 ? n.lane + 1 : n.lane - 1];
    });
    return notes;
  }
  return [
    { s: 2, lane: 1, dur: 0 },
    { s: 6, lane: 2, dur: 0 },
    { s: 10, lane: 1, dur: 0 },
    { s: 14, lane: 2, dur: 0 },
  ];
}
export function vary(rng, m, nMut) {
  const c = m.map((n) => ({ ...n }));
  for (let k = 0; k < nMut && c.length > 1; k++) {
    const i = Math.floor(rng() * (c.length - 1));
    c[i].lane = clamp(c[i].lane + (rng() < 0.5 ? -1 : 1), 0, 3);
  }
  return c;
}
// La réponse se résout sur la fondamentale
export function answer(rng, m, P) {
  const c = vary(rng, m, 1),
    L = c.length;
  c[L - 1].lane = 0;
  if (L > 1 && c[L - 2].lane === 0) c[L - 2].lane = 1;
  c[L - 1].dur = P.holdP > 0 && 16 - c[L - 1].s >= 4 ? Math.min(16 - c[L - 1].s - 2, 4) : 0;
  if (P.triad) c[L - 1].extra = [1, 2]; // la phrase se pose sur l'accord complet
  return c;
}

export function buildSong(seed: number, diffKey: string): Chanson {
  const rng = mulberry32(seed * 9301 + 49297);
  const D = DIFFS[diffKey];
  const prog = PROGS[Math.floor(rng() * PROGS.length)];
  const keyPc = Math.floor(rng() * 12);
  const bpm = 88 + 4 * Math.floor(rng() * 7);
  const sections = [
    ["Intro", "intro", 2],
    ["Couplet", "couplet", 8],
    ["Refrain", "refrain", 8],
    ["Solo libre", "pont", 4],
    ["Refrain", "refrain", 8],
    ["Outro", "outro", 2],
  ].map(([name, kind, bars]) => ({ name, kind, bars }) as Section);
  let bar = 0;
  for (const s of sections) {
    s.start = bar;
    bar += s.bars;
  }
  const totalBars = bar;
  const chords = [];
  for (const s of sections)
    for (let i = 0; i < s.bars; i++)
      chords.push(makeChord(keyPc, s.kind === "outro" ? prog.end : prog.chords[i % prog.chords.length]));

  const bassPat = (kind, i) => {
    const a = D.bass[kind];
    return a ? a[i % a.length] : null;
  };
  const occ = (kind) => {
    const o = [];
    for (let b = 0; b < 2; b++) {
      const p = bassPat(kind, b) || "........";
      for (let s = 0; s < 8; s++) o.push(p[s] !== ".");
    }
    return o;
  };
  const M = genMotif(rng, D.mel, occ("couplet"), false);
  const R = genMotif(rng, D.mel, occ("refrain"), true);
  const phrases = {
    couplet: [M, vary(rng, M, 1), M, answer(rng, M, D.mel)],
    refrain: [R, vary(rng, R, 2), R, answer(rng, R, D.mel)],
  };

  const ev = [];
  for (const s of sections) {
    for (let i = 0; i < s.bars; i++) {
      const p = bassPat(s.kind, i);
      if (!p) continue;
      const barIdx = s.start + i,
        ch = chords[barIdx];
      for (let k = 0; k < 8; k++) {
        const c = p[k];
        if (c === "." || c === "-") continue;
        let dur = 0;
        if (c === "T") {
          let n = 1;
          while (k + n < 8 && p[k + n] === "-") n++;
          dur = n / 2;
        }
        // Glisser joue la fondamentale, sauter l'octave, le double saut la quinte au-dessus de l'octave (ADR-0003)
        const lane = c === "W" ? 1 : c === "D" ? 2 : 0;
        ev.push({
          hand: "L",
          beat: barIdx * 4 + k / 2,
          dur,
          lane,
          bar: barIdx,
          kind: s.kind,
          midi: [ch.bass, ch.bass + 12, ch.bass + 12 + ch.ints[2]][lane],
        });
      }
    }
    const ph = phrases[s.kind];
    if (!ph) continue;
    for (let k = 0; k < s.bars / 2; k++) {
      for (const n of ph[k % 4]) {
        const barIdx = s.start + 2 * k + Math.floor(n.s / 8),
          ch = chords[barIdx];
        const beat = (s.start + 2 * k) * 4 + n.s / 2;
        const extra = [...new Set<number>(n.extra || [])].filter((l) => l !== n.lane);
        const vel = extra.length ? 0.75 : 1;
        ev.push({
          hand: "R",
          beat,
          dur: n.dur / 2,
          lane: n.lane,
          bar: barIdx,
          kind: s.kind,
          vel,
          midi: ch.lanes[n.lane],
          harm: n.lane < 3 ? ch.lanes[n.lane + 1] : ch.lanes[1] + 12,
        });
        for (const l of extra)
          ev.push({ hand: "R", beat, dur: n.dur / 2, lane: l, bar: barIdx, kind: s.kind, vel, midi: ch.lanes[l] });
      }
    }
  }
  ev.sort((a, b) => a.beat - b.beat || (a.hand < b.hand ? -1 : 1));
  const Ls = ev.filter((e) => e.hand === "L");
  Ls.forEach((e, i) => {
    const nx = Ls[i + 1];
    // Le saut qui précède un double saut dure un temps : le second appui doit venir en l'air, même en retard
    e.air = nx && nx.lane === 2 ? 1 : Math.min(0.85, (nx ? nx.beat - e.beat : 2) * 0.8);
  });
  ev.forEach((e) => (e.state = "pending"));
  // Notes simultanées = un accord : reliées à l'écran, bonus quand l'accord est complet
  for (let i = 0; i < ev.length;) {
    let j = i;
    while (j < ev.length && ev[j].beat === ev[i].beat) j++;
    if (j - i > 1) {
      const grp = ev.slice(i, j);
      grp.forEach((e) => (e.grp = grp));
    }
    i = j;
  }
  const names = prog.chords.map((c) => makeChord(keyPc, c).name);
  return {
    seed,
    prog,
    keyPc,
    bpm,
    sections,
    totalBars,
    chords,
    ev,
    endBeat: totalBars * 4,
    keyName: `${NOTE_FR[keyPc]} ${prog.mode}`,
    progLabel: names.join(" – "),
  };
}
