/* ---------- Boss de fin (#26) ---------- */
// Un niveau à part, le même dans les deux univers (ADR-0006) : un drone géant dans la Ville, une mite reine dans la
// Boîte. Le boss joue une phrase d'une mesure ; le joueur la rejoue sur la mesure suivante, pendant que le boss
// enchaîne la phrase d'après : on entend un canon. Chaque voix joue les degrés de l'accord de sa mesure (ADR-0003) :
// superposées, les deux phrases ne font entendre que des notes de l'accord en cours.
//
// Le niveau se tire de la graine et de la difficulté (ADR-0005) : la tonalité, la progression et le tempo de la
// chanson de la même graine, et ses phrases avec leur propre suite de nombres. Les chansons ne changent pas.
import { clamp } from "../outils";
import { mulberry32 } from "./aleatoire";
import { DIFFS, type ReglagesBoss } from "./difficultes";
import { buildSong, finirLesNotes, noteDeMelodie, notesDeBasse } from "./generateur";
import { makeChord } from "./theorie";
import type { Accord, Chanson, Note, PhraseDuBoss, Section } from "./types";

/** Les mesures de chaque phase du niveau complet, et le nombre de phases */
export const BOSS_MESURES = 8;
export const BOSS_PHASES = 3;
/** La part des phrases du canon qu'il faut rejouer justes pour battre le boss : sa vie */
export const PART_DE_VIE = 0.9;
/** Le boss joue une octave sous la mélodie du joueur, pour que les deux voix du canon se distinguent */
export const OCTAVE_DU_BOSS = -12;

/**
 * Les croches d'un rythme (« x » une note) que garde une phrase du canon, d'après la basse de la mesure où le joueur
 * la rejoue : la phrase évite les notes de basse (et leurs tenues) comme la mélodie de la difficulté, toutes
 * (`all`), toutes sauf celle du premier temps, qui fait un accord à deux mains (`mostly`), ou aucune (`none`).
 */
export function crochesDuCanon(rythme: string, basse: string, avoid: string): number[] {
  const croches: number[] = [];
  for (let k = 0; k < 8; k++) {
    if (rythme[k] !== "x") continue;
    const occupee = basse[k] !== ".";
    if (occupee && (avoid === "all" || (avoid === "mostly" && k !== 0))) continue;
    croches.push(k);
  }
  return croches;
}

/** Le rythme d'une phrase : un des `rythmes` de la phase, tiré, qui garde au moins deux notes sur la basse de la
 * réponse ; à défaut, celui qui en garde le plus */
export function rythmeDuCanon(rng: () => number, rythmes: string[], basse: string, avoid: string): number[] {
  const depart = Math.floor(rng() * rythmes.length);
  let meilleur: number[] = [];
  for (let i = 0; i < rythmes.length; i++) {
    const croches = crochesDuCanon(rythmes[(depart + i) % rythmes.length], basse, avoid);
    if (croches.length >= 2) return croches;
    if (croches.length > meilleur.length) meilleur = croches;
  }
  return meilleur;
}

/** Les couloirs d'une phrase de `nb` notes, par degrés voisins à partir du couloir `depart` (la note d'avant),
 * entre les couloirs de la difficulté ; un saut de deux degrés une fois sur `saut` environ */
export function couloirsDuCanon(rng: () => number, nb: number, depart: number, couloirs: number[], saut: number) {
  const bas = Math.min(...couloirs),
    haut = Math.max(...couloirs),
    lanes: number[] = [];
  let lane = depart;
  for (let i = 0; i < nb; i++) {
    const r = rng(),
      pas = r < saut ? 2 : r < saut + (1 - saut) * 0.8 ? 1 : 0,
      sens = rng() < 0.5 ? -1 : 1;
    let l = lane + sens * pas;
    if (l < bas || l > haut) l = lane - sens * pas;
    lane = clamp(l, bas, haut);
    lanes.push(lane);
  }
  return lanes;
}

/** Les phases du boss : leur rang de 1 à `BOSS_PHASES`, la première sur la batterie d'un couplet, les suivantes sur
 * celle d'un refrain, qui s'ouvre sur une plaque à écraser (#8) */
const phase = (p: number, start: number, mesures: number): Section => ({
  name: `Phase ${p}`,
  kind: p === 1 ? "couplet" : "refrain",
  bars: mesures,
  start,
  boss: p,
});

/**
 * Le niveau du boss de fin pour cette graine et cette difficulté : une intro de deux mesures où il arrive, trois
 * phases de `mesures` mesures, puis une outro de deux mesures. Dans chaque phase, le boss joue une phrase sur chaque
 * mesure sauf la dernière, et le joueur la rejoue sur la mesure suivante (ses notes portent `canon`) : la première
 * mesure, on l'écoute seul ; la dernière, on lui répond seul. Les rythmes des phases se serrent (`DIFFS`), et la
 * dernière phrase d'une phase se pose sur la fondamentale. Sa vie : `PART_DE_VIE` des phrases du niveau.
 */
export function buildBoss(seed: number, diffKey: string, mesures = BOSS_MESURES): Chanson {
  const base = buildSong(seed, diffKey),
    D = DIFFS[diffKey],
    B: ReglagesBoss = D.boss,
    { prog, keyPc } = base;
  // Le boss a son propre tirage : la chanson de la graine ne change pas
  const rng = mulberry32(seed * 8191 + 131071);
  const sections: Section[] = [{ name: "Intro", kind: "intro", bars: 2, start: 0 }];
  for (let p = 1; p <= BOSS_PHASES; p++) sections.push(phase(p, 2 + (p - 1) * mesures, mesures));
  sections.push({ name: "Outro", kind: "outro", bars: 2, start: 2 + BOSS_PHASES * mesures });
  const totalBars = 4 + BOSS_PHASES * mesures,
    chords: Accord[] = [];
  for (const s of sections)
    for (let i = 0; i < s.bars; i++)
      chords.push(makeChord(keyPc, s.kind === "outro" ? prog.end : prog.chords[i % prog.chords.length]));

  const ev: Note[] = [],
    phrases: PhraseDuBoss[] = [];
  let lane = Math.floor(rng() * B.couloirs.length);
  for (const s of sections) {
    if (s.kind === "outro") {
      const motifs = D.bass.outro;
      for (let i = 0; i < s.bars; i++)
        ev.push(...notesDeBasse(motifs[i % motifs.length], s.start + i, chords[s.start + i], s.kind, false));
    }
    if (!s.boss) continue;
    const basse = (i: number) => B.basse[i % B.basse.length];
    for (let i = 0; i < s.bars; i++) {
      const bar = s.start + i;
      ev.push(...notesDeBasse(basse(i), bar, chords[bar], s.kind, s.kind === "refrain" && i === 0));
    }
    for (let k = 0; k < s.bars - 1; k++) {
      const bar = s.start + k,
        croches = rythmeDuCanon(rng, B.phases[s.boss - 1], basse(k + 1), D.mel.avoid),
        lanes = couloirsDuCanon(rng, croches.length, lane, B.couloirs, 0.1 * s.boss);
      // La phase se pose sur la fondamentale
      if (k === s.bars - 2) lanes[lanes.length - 1] = 0;
      lane = lanes[lanes.length - 1];
      phrases.push({
        bar,
        notes: croches.map((c, i) => ({
          beat: bar * 4 + c / 2,
          lane: lanes[i],
          midi: chords[bar].lanes[lanes[i]] + OCTAVE_DU_BOSS,
        })),
      });
      // La réponse : les mêmes degrés au même rythme, dans l'accord de sa mesure, sans harmonie (deux voix seulement)
      croches.forEach((c, i) => {
        const note = noteDeMelodie(lanes[i], (bar + 1) * 4 + c / 2, 0, bar + 1, chords[bar + 1], s.kind);
        delete note.harm;
        note.canon = bar;
        ev.push(note);
      });
    }
  }
  return {
    ...base,
    sections,
    totalBars,
    chords,
    ev: finirLesNotes(ev),
    chanteurs: [],
    boss: { phrases, vie: Math.round(phrases.length * PART_DE_VIE) },
    endBeat: totalBars * 4,
  };
}
