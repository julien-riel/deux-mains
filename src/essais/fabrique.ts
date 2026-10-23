/* ---------- Fabrique des chansons d'essai ---------- */
// Logique pure (ADR-0007). Une chanson d'essai est courte et fait revenir une fonctionnalité dès les premières
// mesures. On ne touche pas au générateur (ADR-0005) : on part de sa sortie, dont on réassemble des mesures
// (accords et mélodie), puis on réécrit la basse selon des motifs choisis, dans la notation des difficultés, et au
// besoin la mélodie.
import { DIFFS } from "../chanson/difficultes";
import { mulberry32 } from "../chanson/aleatoire";
import {
  buildSong,
  couloirsDuSerpent,
  escalier,
  notesDeBasse,
  noteDeMelodie,
  petiteNote,
  phraseDuChanteur,
  phraseEnRelais,
  voisin,
} from "../chanson/generateur";
import { gammeDe, makeChord } from "../chanson/theorie";
import type { Accord, Chanson, Genre, Note, Section } from "../chanson/types";

/** Des mesures de la chanson générée, recopiées dans la chanson d'essai comme une section */
export interface Morceau {
  nom: string;
  genre: Genre;
  /** La première mesure recopiée, dans la chanson générée (à partir de 0) */
  de: number;
  mesures: number;
  /** Des accords à la place de ceux de la chanson générée, en boucle (décalage depuis la tonique, qualité) : la
   * mélodie de ce genre doit alors être réécrite (`melodie`), pour jouer les degrés de ces accords */
  accords?: [number, string][];
  /** Un pont en mains croisées (#21) : la scène s'y retourne */
  croisee?: true;
}

/** Les motifs de basse par genre de section, comme dans `DIFFS` : S glisser, W sauter, D double saut, T tunnel,
 * M pente montante, B pente descendante. La plaque remplace la première note de la mesure qui ouvre un refrain (#8). */
export type MotifsDeBasse = Partial<Record<Genre, string[]>>;

/** Les motifs de mélodie par genre de section, une mesure en huit croches : 0 à 3 le couloir, - prolonge la note
 * en note tenue, ~ en trille (#15) avec le couloir au-dessus et _ avec celui au-dessous (retournés au bord),
 * / et \ en serpent (#16) qui monte ou descend d'un couloir à chacun (ses couloirs se partagent également sa
 * durée : « 1// » monte de 1 à 3 en trois croches, « 3-\-\- » descend de 3 à 1 en trois temps), a, b et c une
 * petite note (#14) entre les couloirs 0 et 1, 1 et 2, 2 et 3, qui mène à la note suivante de la mesure, . silence */
export type MotifsDeMelodie = Partial<Record<Genre, string[]>>;

// Les notes de mélodie d'une mesure, construites comme celles du générateur (ADR-0003, ADR-0010)
function mesureDeMelodie(motif: string, bar: number, ch: Accord, kind: Genre, pentatonique: number[]): Note[] {
  const notes: Note[] = [];
  for (let k = 0; k < 8; k++) {
    const petite = "abc".indexOf(motif[k]);
    if (petite >= 0) {
      // Elle mène à la note suivante de la mesure : vers le haut si celle-ci est au-dessus
      const lane = petite + 0.5,
        suivante = motif.slice(k + 1).match(/[0-3]/),
        n = petiteNote(lane, !suivante || +suivante[0] > lane, bar * 4 + k / 2, bar, ch, kind, pentatonique);
      if (n) notes.push(n);
      continue;
    }
    if (!/[0-3]/.test(motif[k])) continue;
    const lane = +motif[k],
      suite = motif[k + 1];
    let n = 1;
    while (k + n < 8 && "-~_/\\".includes(motif[k + n])) n++;
    const trille = suite === "~" ? voisin(lane, 1) : suite === "_" ? voisin(lane, -1) : undefined;
    // Un serpent (#16) : un couloir de plus par / (en montant) ou par \ (en descendant)
    const passages = [...motif.slice(k + 1, k + n)].filter((c) => c === "/" || c === "\\"),
      serpent = passages.length
        ? couloirsDuSerpent(lane, passages[0] === "/" ? 1 : -1, passages.length + 1)
        : undefined;
    notes.push(noteDeMelodie(lane, bar * 4 + k / 2, n > 1 ? n / 2 : 0, bar, ch, kind, 1, trille, serpent));
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
    sections.push({ name: m.nom, kind: m.genre, bars: m.mesures, start: bar, ...(m.croisee && { croisee: true }) });
    const decale = bar - m.de;
    for (let i = 0; i < m.mesures; i++)
      chords.push(m.accords ? makeChord(source.keyPc, m.accords[i % m.accords.length]) : source.chords[m.de + i]);
    const chant = melodie[m.genre];
    if (m.accords && !chant) throw new Error(`Morceau « ${m.nom} » : de nouveaux accords demandent une mélodie`);
    for (let i = 0; chant && i < m.mesures; i++) {
      const ch = chords[bar + i];
      ev.push(
        ...mesureDeMelodie(chant[i % chant.length], bar + i, ch, m.genre, gammeDe(source.keyPc, source.prog, ch, true)),
      );
    }
    for (const e of chant ? [] : source.ev)
      if (e.hand === "R" && e.bar >= m.de && e.bar < m.de + m.mesures)
        // Une réponse au chanteur (#18) recopiée sans lui redevient une note de mélodie ordinaire, et une note de
        // relais (#20) sans la basse qui le finit aussi : `relayer` en pose où l'on veut
        ev.push({
          ...e,
          beat: e.beat + 4 * decale,
          bar: e.bar + decale,
          kind: m.genre,
          grp: undefined,
          reponse: undefined,
          relais: undefined,
        });
    const a = motifs[m.genre];
    for (let i = 0; a && i < m.mesures; i++)
      ev.push(...notesDeBasse(a[i % a.length], bar + i, chords[bar + i], m.genre, m.genre === "refrain" && i === 0));
    bar += m.mesures;
  }
  // Les chanteurs de la chanson générée ne sont pas recopiés : `chanter` en pose où l'on veut
  return finaliser({ ...source, sections, totalBars: bar, chords, ev, chanteurs: [], endBeat: bar * 4 });
}

/**
 * Pose un chanteur (#18) sur chacune des `mesures` : il y chante sa phrase, construite comme dans le générateur
 * avec les réglages de la difficulté, et la mélodie de la mesure suivante devient sa réponse. La graine fixe le
 * tirage des phrases (ADR-0005).
 */
export function chanter(chanson: Chanson, diff: string, mesures: number[], graine = chanson.seed): Chanson {
  const rng = mulberry32(graine * 6151 + 811);
  for (const bar of mesures) {
    const sec = chanson.sections.find((s) => bar >= s.start && bar < s.start + s.bars),
      { chanteur, reponse } = phraseDuChanteur(rng, DIFFS[diff].chanteur, bar, chanson.chords, sec.kind);
    // Le chanteur chante seul, et la réponse remplace la mélodie de sa mesure
    chanson.ev = chanson.ev.filter((e) => e.hand === "L" || (e.bar !== bar && e.bar !== bar + 1));
    chanson.ev.push(...reponse);
    chanson.chanteurs = [...chanson.chanteurs.filter((c) => c.bar !== bar), chanteur].sort((a, b) => a.bar - b.bar);
  }
  return finaliser(chanson);
}

/**
 * Pose une phrase en relais (#20) sur chacune des mesures de `relais` et la suivante, montante (true) ou
 * descendante (false), construite comme dans le générateur : elle remplace les notes des deux mains de ces deux
 * mesures, et une note tenue d'avant qui déborderait dessus.
 */
export function relayer(chanson: Chanson, relais: [number, boolean][]): Chanson {
  for (const [bar, monte] of relais) {
    const sec = chanson.sections.find((s) => bar >= s.start && bar < s.start + s.bars);
    chanson.ev = chanson.ev.filter((e) => e.beat >= (bar + 2) * 4 || e.beat + Math.max(e.dur, 0.01) <= bar * 4);
    chanson.ev.push(...phraseEnRelais(monte, bar, chanson.chords, sec.kind));
  }
  return finaliser(chanson);
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

/**
 * Fait marcher la basse (#13) : chaque mesure des sections de ces genres finit en escalier de walking bass vers la
 * fondamentale de la mesure suivante, quand la gamme le permet (`escalier` du générateur, ADR-0010). La mesure
 * suivante peut être dans la section d'après. La basse est réécrite avec les motifs de la difficulté, remplacés
 * par `basse`, comme dans `assembler`.
 */
export function marcher(
  chanson: Chanson,
  diff: string,
  genres: Genre[] = ["couplet", "refrain"],
  basse: MotifsDeBasse = {},
): Chanson {
  const motifs: MotifsDeBasse = { ...DIFFS[diff].bass, ...basse },
    motifDe = (bar: number) => {
      const sec = chanson.sections.find((s) => bar >= s.start && bar < s.start + s.bars),
        a = sec && motifs[sec.kind];
      return a ? { sec, motif: a[(bar - sec.start) % a.length] } : null;
    };
  for (const sec of chanson.sections) {
    if (!genres.includes(sec.kind)) continue;
    for (let bar = sec.start; bar < sec.start + sec.bars; bar++) {
      const ici = motifDe(bar),
        suivante = motifDe(bar + 1),
        plaque = sec.kind === "refrain" && bar === sec.start;
      if (!ici || plaque) continue;
      const ch = chanson.chords[bar],
        e =
          suivante &&
          escalier(
            ici.motif,
            ch,
            chanson.chords[bar + 1],
            suivante.sec.kind === "refrain" && bar + 1 === suivante.sec.start ? "P" : suivante.motif,
            gammeDe(chanson.keyPc, chanson.prog, ch),
          );
      if (!e) continue;
      chanson.ev = chanson.ev.filter((n) => n.hand !== "L" || n.bar !== bar);
      chanson.ev.push(...notesDeBasse(e.motif, bar, ch, sec.kind, false, e.marches));
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
