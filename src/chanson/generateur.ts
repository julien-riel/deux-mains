/* ---------- Générateur de chanson ---------- */
import { clamp } from "../outils";
import { mulberry32 } from "./aleatoire";
import { DIFFS, type ReglagesChanteur } from "./difficultes";
import { NOTE_FR, PROGS, makeChord } from "./theorie";
import type { Accord, Chanson, Chanteur, Genre, Note, Section } from "./types";

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
      // Une note longue peut devenir une trille (#15), avec le couloir au-dessus ou au-dessous
      if (n.dur > 0 && !n.cross && P.trilleP && rng() < P.trilleP) n.tr = rng() < 0.5 ? 1 : -1;
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
/**
 * Les serpents (#16) : dans une phrase, une suite de deux à quatre notes régulières qui montent ou descendent
 * couloir par couloir peut se fondre en un seul serpent, qu'on suit au rayon d'une touche à l'autre. Ses notes
 * gardent leurs temps ; il peut glisser un couloir ou deux plus loin, dans le silence qui suit. Il reste dans sa
 * mesure (un seul accord), son dernier couloir dure un pas, et il laisse au moins une croche avant la note
 * suivante. La dernière note de la phrase, qui la conclut, n'en fait jamais partie, ni les notes tenues, les
 * trilles ou les accords. Renvoie une copie de la phrase ; le hasard n'est tiré que pour une suite qui convient.
 */
export function fondreSerpents(rng, phrase, P) {
  const notes = phrase.map((n) => ({ ...n }));
  for (let i = 0; i < notes.length - 2; i++) {
    const a = notes[i],
      pas = notes[i + 1].s - a.s,
      sens = notes[i + 1].lane - a.lane;
    if (Math.abs(sens) !== 1 || !P.serpentPas.includes(pas)) continue;
    let j = i;
    while (j < i + 3 && j + 1 < notes.length - 1) {
      const n = notes[j + 1];
      if (n.s - notes[j].s !== pas || n.lane - notes[j].lane !== sens || n.cross) break;
      j++;
    }
    const suite = notes.slice(i, j + 1),
      mesure = Math.floor(a.s / 8),
      // Le serpent de nb couloirs tient dans sa mesure et laisse une croche avant la note suivante
      tient = (nb: number) => {
        const fin = a.s + nb * pas;
        return Math.floor((fin - 1) / 8) === mesure && notes[j + 1].s >= fin + 1;
      };
    if (j === i || !tient(j - i + 1) || suite.some((n) => n.dur > 0 || n.extra) || rng() >= P.serpentP) continue;
    // Il peut glisser plus loin, d'un couloir de l'accord à la fois, s'il a la place avant la note suivante
    let nb = j - i + 1;
    const dans = (lane: number) => lane >= 0 && lane <= 3;
    while (nb < 4 && tient(nb + 1) && dans(a.lane + nb * sens) && rng() < P.serpentP) nb++;
    a.sp = { sens, nb, pas };
    a.dur = nb * pas;
    notes.splice(i + 1, j - i);
  }
  return notes;
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
  // La fondamentale tenue peut se poser en trille avec la tierce (#15)
  c[L - 1].tr = c[L - 1].dur > 0 && P.trilleP && rng() < P.trilleP ? 1 : 0;
  if (P.triad && !c[L - 1].tr) c[L - 1].extra = [1, 2]; // la phrase se pose sur l'accord complet
  return c;
}

/**
 * Les notes de basse d'une mesure, d'après un motif de `DIFFS`. Glisser joue la fondamentale, sauter l'octave,
 * le double saut la quinte au-dessus de l'octave, et l'écrasement la fondamentale accentuée (ADR-0003). Le
 * tunnel et les pentes (#12) se tiennent sur les « - » : la pente montante glisse de la fondamentale à
 * l'octave, la descendante de l'octave à la fondamentale. `plaque` : la première note devient une plaque (#8).
 */
export function notesDeBasse(motif: string, bar: number, ch: Accord, kind: Genre, plaque: boolean): Note[] {
  const notes: Note[] = [];
  for (let k = 0; k < 8; k++) {
    const c = plaque && k === 0 ? "P" : motif[k];
    if (c === "." || c === "-") continue;
    let dur = 0;
    if (c === "T" || c === "M" || c === "B") {
      let n = 1;
      while (k + n < 8 && motif[k + n] === "-") n++;
      dur = n / 2;
    }
    const lane = c === "P" ? 3 : c === "W" ? 1 : c === "D" ? 2 : 0;
    const note: Note = {
      hand: "L",
      beat: bar * 4 + k / 2,
      dur,
      lane,
      bar,
      kind,
      midi: [ch.bass, ch.bass + 12, ch.bass + 12 + ch.ints[2], ch.bass][lane],
      state: "pending",
    };
    if (c === "M") note.fin = ch.bass + 12;
    if (c === "B") [note.midi, note.fin] = [ch.bass + 12, ch.bass];
    notes.push(note);
  }
  return notes;
}

/** Le couloir voisin d'une trille (#15), dans le sens `sens` (1 au-dessus, -1 au-dessous), retourné au bord */
export function voisin(lane: number, sens: number) {
  const v = lane + sens;
  return v < 0 || v > 3 ? lane - sens : v;
}

/**
 * Les couloirs d'un serpent (#16) de `nb` couloirs à partir de `lane`, dans le sens `sens` (1 monte, -1 descend).
 * S'il n'a pas la place, il part dans l'autre sens, ou raccourcit (quatre couloirs ne partent que d'un bord).
 */
export function couloirsDuSerpent(lane: number, sens: number, nb: number) {
  const place = (s: number) => (s > 0 ? 3 - lane : lane) + 1;
  if (place(sens) < nb && place(-sens) > place(sens)) sens = -sens;
  return Array.from({ length: Math.min(nb, place(sens)) }, (_, k) => lane + k * sens);
}

/**
 * Une note de la mélodie : le couloir joue son degré de l'accord, avec l'harmonie au degré au-dessus (ADR-0003).
 * `trille` : la note longue devient une trille (#15) avec ce couloir voisin, qui joue lui aussi son degré.
 * `serpent` : la note longue devient un serpent (#16) qui traverse ces couloirs, chacun sur son degré.
 */
export function noteDeMelodie(
  lane: number,
  beat: number,
  dur: number,
  bar: number,
  ch: Accord,
  kind: Genre,
  vel = 1,
  trille?: number,
  serpent?: number[],
): Note {
  const note: Note = {
    hand: "R",
    beat,
    dur,
    lane,
    bar,
    kind,
    vel,
    midi: ch.lanes[lane],
    harm: lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12,
    state: "pending",
  };
  if (trille !== undefined && dur > 0) [note.trille, note.midiTrille] = [trille, ch.lanes[trille]];
  if (serpent && serpent.length > 1 && dur > 0)
    [note.serpent, note.midiSerpent] = [serpent, serpent.map((l) => ch.lanes[l])];
  return note;
}

/**
 * Le chanteur (#18) de la mesure `bar` et la réponse du joueur sur la mesure suivante. Le chanteur chante quatre
 * notes, des degrés de l'accord de sa mesure (ADR-0003), sur un des rythmes de la difficulté ; chaque degré de
 * `couloirs` y revient au moins une fois. La réponse rejoue les mêmes degrés au même rythme, dans l'accord de
 * sa mesure : la mélodie se transpose comme partout ailleurs. Ses notes sont des silhouettes (`reponse`).
 */
export function phraseDuChanteur(
  rng: () => number,
  R: ReglagesChanteur,
  bar: number,
  chords: Accord[],
  kind: Genre,
): { chanteur: Chanteur; reponse: Note[] } {
  const rythme = R.rythmes[Math.floor(rng() * R.rythmes.length)],
    croches = [...rythme].flatMap((c, k) => (c === "x" ? [k] : [])),
    lanes = [...R.couloirs];
  while (lanes.length < croches.length) lanes.push(R.couloirs[Math.floor(rng() * R.couloirs.length)]);
  // Mélange de Fisher-Yates, tiré de la graine (ADR-0005)
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const notes = croches.map((k, i) => ({ beat: bar * 4 + k / 2, lane: lanes[i], midi: chords[bar].lanes[lanes[i]] }));
  const reponse = notes.map((n) => {
    const note = noteDeMelodie(n.lane, n.beat + 4, 0, bar + 1, chords[bar + 1], kind);
    note.reponse = true;
    return note;
  });
  return { chanteur: { bar, notes }, reponse };
}

export function buildSong(seed: number, diffKey: string): Chanson {
  const rng = mulberry32(seed * 9301 + 49297);
  // Les chanteurs (#18) ont leur propre tirage : le reste de la chanson ne change pas avec eux
  const rngChant = mulberry32(seed * 6151 + 811);
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
  // Les serpents (#16) se tirent avec leur propre suite de nombres, une fois par phrase (une phrase répétée garde
  // les siens) : le reste de la chanson ne change pas, et Débutant et Facile, qui n'en ont pas, n'y tirent rien
  if (D.mel.serpentP) {
    const rngSerpents = mulberry32(seed * 7919 + 104729),
      fondues = new Map();
    for (const k of Object.keys(phrases))
      phrases[k] = phrases[k].map((p) => {
        if (!fondues.has(p)) fondues.set(p, fondreSerpents(rngSerpents, p, D.mel));
        return fondues.get(p);
      });
  }

  const ev = [],
    chanteurs: Chanteur[] = [];
  for (const s of sections) {
    for (let i = 0; i < s.bars; i++) {
      const p = bassPat(s.kind, i);
      // La plaque à écraser (#8) remplace la première note de basse de chaque refrain
      if (p) ev.push(...notesDeBasse(p, s.start + i, chords[s.start + i], s.kind, s.kind === "refrain" && i === 0));
    }
    const ph = phrases[s.kind];
    if (!ph) continue;
    for (let k = 0; k < s.bars / 2; k++) {
      // L'avant-dernière phrase du couplet laisse la place au chanteur et à sa réponse (#18) : la dernière garde
      // sa cadence, et la réponse ne tombe pas dans le silence d'avant le refrain. Jamais au refrain : la reprise
      // du solo (#9) remplace des phrases du dernier refrain, elle ne croise pas le chanteur.
      if (D.chanteur && s.kind === "couplet" && k === s.bars / 2 - 2) {
        const { chanteur, reponse } = phraseDuChanteur(rngChant, D.chanteur, s.start + 2 * k, chords, s.kind);
        chanteurs.push(chanteur);
        ev.push(...reponse);
        continue;
      }
      for (const n of ph[k % 4]) {
        const barIdx = s.start + 2 * k + Math.floor(n.s / 8),
          ch = chords[barIdx];
        const beat = (s.start + 2 * k) * 4 + n.s / 2;
        const extra = [...new Set<number>(n.extra || [])].filter((l) => l !== n.lane);
        const vel = extra.length ? 0.75 : 1;
        // Pas de trille sur une note qui fait partie d'un accord de la main droite
        const trille = n.tr && !extra.length ? voisin(n.lane, n.tr) : undefined;
        // Le serpent (#16) garde son sens s'il a la place ; ses couloirs durent chacun un pas
        const serpent = n.sp && couloirsDuSerpent(n.lane, n.sp.sens, n.sp.nb);
        const dur = serpent ? (serpent.length * n.sp.pas) / 2 : n.dur / 2;
        ev.push(noteDeMelodie(n.lane, beat, dur, barIdx, ch, s.kind, vel, trille, serpent));
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
    chanteurs,
    endBeat: totalBars * 4,
    keyName: `${NOTE_FR[keyPc]} ${prog.mode}`,
    progLabel: names.join(" – "),
  };
}
