/* ---------- Fabrique des chansons d'essai ---------- */
// Logique pure (ADR-0007). Une chanson d'essai est courte et fait revenir une fonctionnalité dès les premières
// mesures. On ne touche pas au générateur (ADR-0005) : on part de sa sortie, dont on réassemble des mesures
// (accords et mélodie), puis on réécrit la basse selon des motifs choisis, dans la notation des difficultés, et au
// besoin la mélodie.
import { DIFFS } from "../chanson/difficultes";
import { buildSong, notesDeBasse, noteDeMelodie, voisin } from "../chanson/generateur";
import type { Accord, Chanson, Genre, Note, Section } from "../chanson/types";

/** Des mesures de la chanson générée, recopiées dans la chanson d'essai comme une section */
export interface Morceau {
  nom: string;
  genre: Genre;
  /** La première mesure recopiée, dans la chanson générée (à partir de 0) */
  de: number;
  mesures: number;
}

/** Les motifs de basse par genre de section, comme dans `DIFFS` : S glisser, W sauter, D double saut, T tunnel,
 * M pente montante, B pente descendante. La plaque remplace la première note de la mesure qui ouvre un refrain (#8). */
export type MotifsDeBasse = Partial<Record<Genre, string[]>>;

/** Les motifs de mélodie par genre de section, une mesure en huit croches : 0 à 3 le couloir, - prolonge la note
 * en note tenue, ~ en trille (#15) avec le couloir au-dessus et _ avec celui au-dessous (retournés au bord),
 * . silence */
export type MotifsDeMelodie = Partial<Record<Genre, string[]>>;

// Les notes de mélodie d'une mesure, construites comme celles du générateur (ADR-0003)
function mesureDeMelodie(motif: string, bar: number, ch: Accord, kind: Genre): Note[] {
  const notes: Note[] = [];
  for (let k = 0; k < 8; k++) {
    if (!/[0-3]/.test(motif[k])) continue;
    const lane = +motif[k],
      suite = motif[k + 1];
    let n = 1;
    while (k + n < 8 && "-~_".includes(motif[k + n])) n++;
    const trille = suite === "~" ? voisin(lane, 1) : suite === "_" ? voisin(lane, -1) : undefined;
    notes.push(noteDeMelodie(lane, bar * 4 + k / 2, n > 1 ? n / 2 : 0, bar, ch, kind, 1, trille));
  }
  return notes;
}

/**
 * Assemble une chanson d'essai : les morceaux de la chanson générée par `graine` et `diff`, mis bout à bout.
 * Les accords et la mélodie viennent des mesures recopiées ; la basse est réécrite avec les motifs de la
 * difficulté, remplacés genre par genre par `basse`. Pour les genres de `melodie`, la mélodie est réécrite aussi.
 */
export function assembler(
  graine: number,
  diff: string,
  morceaux: Morceau[],
  basse: MotifsDeBasse = {},
  melodie: MotifsDeMelodie = {},
): Chanson {
  const source = buildSong(graine, diff),
    motifs: MotifsDeBasse = { ...DIFFS[diff].bass, ...basse },
    sections: Section[] = [],
    chords: Accord[] = [],
    ev: Note[] = [];
  let bar = 0;
  for (const m of morceaux) {
    sections.push({ name: m.nom, kind: m.genre, bars: m.mesures, start: bar });
    const decale = bar - m.de;
    for (let i = 0; i < m.mesures; i++) chords.push(source.chords[m.de + i]);
    const chant = melodie[m.genre];
    for (let i = 0; chant && i < m.mesures; i++)
      ev.push(...mesureDeMelodie(chant[i % chant.length], bar + i, chords[bar + i], m.genre));
    for (const e of chant ? [] : source.ev)
      if (e.hand === "R" && e.bar >= m.de && e.bar < m.de + m.mesures)
        ev.push({ ...e, beat: e.beat + 4 * decale, bar: e.bar + decale, kind: m.genre, grp: undefined });
    const a = motifs[m.genre];
    for (let i = 0; a && i < m.mesures; i++)
      ev.push(...notesDeBasse(a[i % a.length], bar + i, chords[bar + i], m.genre, m.genre === "refrain" && i === 0));
    bar += m.mesures;
  }
  return finaliser({ ...source, sections, totalBars: bar, chords, ev, endBeat: bar * 4 });
}

/**
 * Ajoute un accord à deux mains sur les `temps` de chaque mesure des couplets et refrains (le premier, par
 * défaut), là où la basse joue déjà : la main droite y joue la fondamentale et la quinte (ou complète sa note
 * d'un degré à deux pas).
 */
export function accorder(chanson: Chanson, temps: number[] = [0]): Chanson {
  for (const sec of chanson.sections) {
    if (sec.kind !== "couplet" && sec.kind !== "refrain") continue;
    for (let bar = sec.start; bar < sec.start + sec.bars; bar++)
      for (const t of temps) {
        const beat = bar * 4 + t,
          ch = chanson.chords[bar],
          ici = chanson.ev.filter((e) => e.beat === beat),
          droite = ici.filter((e) => e.hand === "R");
        // Pas d'accord sans basse, ni pendant une note tenue de la main droite
        const tenue = chanson.ev.some((e) => e.hand === "R" && e.beat < beat && e.beat + e.dur > beat);
        if (!ici.some((e) => e.hand === "L") || tenue || droite.length > 1) continue;
        const base = droite[0] ?? { lane: 0 },
          lanes = [base.lane, base.lane <= 1 ? base.lane + 2 : base.lane - 2];
        chanson.ev = chanson.ev.filter((e) => !droite.includes(e));
        lanes.forEach((lane, i) =>
          chanson.ev.push({
            hand: "R",
            beat,
            dur: 0,
            lane,
            bar,
            kind: sec.kind,
            vel: 0.75,
            midi: ch.lanes[lane],
            ...(i === 0 ? { harm: lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12 } : {}),
            state: "pending",
          }),
        );
      }
  }
  return finaliser(chanson);
}

/** Les mêmes finitions que le générateur : notes triées, durée des sauts, état neuf et accords reliés */
export function finaliser(chanson: Chanson): Chanson {
  const ev = chanson.ev;
  for (const e of ev) {
    delete e.grp;
    e.state = "pending";
  }
  ev.sort((a, b) => a.beat - b.beat || (a.hand < b.hand ? -1 : 1));
  const Ls = ev.filter((e) => e.hand === "L");
  Ls.forEach((e, i) => {
    const nx = Ls[i + 1];
    e.air = nx && nx.lane === 2 ? 1 : Math.min(0.85, (nx ? nx.beat - e.beat : 2) * 0.8);
  });
  for (let i = 0; i < ev.length;) {
    let j = i;
    while (j < ev.length && ev[j].beat === ev[i].beat) j++;
    if (j - i > 1) {
      const grp = ev.slice(i, j);
      grp.forEach((e) => (e.grp = grp));
    }
    i = j;
  }
  return chanson;
}
