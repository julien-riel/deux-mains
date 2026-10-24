/* ---------- Fabrique des chansons d'essai ---------- */
// Logique pure (ADR-0007). Une chanson d'essai est courte et fait revenir une fonctionnalité dès les premières
// mesures. On ne touche pas au générateur (ADR-0005) : on part de sa sortie, dont on réassemble des mesures
// (accords et mélodie), puis on réécrit la basse selon des motifs choisis, dans la notation des difficultés, et au
// besoin la mélodie. Les mesures réécrites le sont comme celles d'une partition (#28, ADR-0016) : mêmes motifs, mêmes
// fonctions (`notesDeMelodie`, `finaliser`).
import { DIFFS } from "../chanson/difficultes";
import { mulberry32 } from "../chanson/aleatoire";
import {
  buildSong,
  escalier,
  melodieEnPolyrythmie,
  notesDeBasse,
  phraseDuChanteur,
  phraseEnRelais,
} from "../chanson/generateur";
import { finaliser, notesDeMelodie } from "../chanson/partition";
import { memeTemps } from "../chanson/temps";
import { gammeDe, makeChord } from "../chanson/theorie";
import type { Accord, Chanson, Genre, Note, Section } from "../chanson/types";
import type { Coup } from "../jeu/enregistrement";
import type { Action } from "../jeu/etat";
import type { Fantome } from "../jeu/fantome";

/** Des mesures de la chanson générée, recopiées dans la chanson d'essai comme une section */
export interface Morceau {
  nom: string;
  genre: Genre;
  /** La première mesure recopiée, dans la chanson générée (à partir de 0, ou depuis la fin si négative : -2 pour
   * les deux dernières, l'outro, quelles que soient les sections ajoutées avant elle) */
  de: number;
  mesures: number;
  /** Des accords à la place de ceux de la chanson générée, en boucle (décalage depuis la tonique, qualité) : la
   * mélodie de ce genre doit alors être réécrite (`melodie`), pour jouer les degrés de ces accords */
  accords?: [number, string][];
}

/** Les motifs de basse par genre de section, comme dans `DIFFS` : S glisser, W sauter, D double saut, T tunnel,
 * M pente montante, B pente descendante. La plaque remplace la première note de la mesure qui ouvre un refrain (#8).
 * Un motif de 8 signes joue des croches, un motif de 12 signes des triolets (#19, ADR-0013). */
export type MotifsDeBasse = Partial<Record<Genre, string[]>>;

/** Les motifs de mélodie par genre de section, une mesure en huit croches : 0 à 3 le couloir, - prolonge la note
 * en note tenue, ~ en trille (#15) avec le couloir au-dessus et _ avec celui au-dessous (retournés au bord),
 * / et \ en serpent (#16) qui monte ou descend d'un couloir à chacun (ses couloirs se partagent également sa
 * durée : « 1// » monte de 1 à 3 en trois croches, « 3-\-\- » descend de 3 à 1 en trois temps), a, b et c une
 * petite note (#14) entre les couloirs 0 et 1, 1 et 2, 2 et 3, qui mène à la note suivante de la mesure, . silence */
export type MotifsDeMelodie = Partial<Record<Genre, string[]>>;

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
    const de = m.de < 0 ? source.totalBars + m.de : m.de,
      decale = bar - de;
    for (let i = 0; i < m.mesures; i++)
      chords.push(m.accords ? makeChord(source.keyPc, m.accords[i % m.accords.length]) : source.chords[de + i]);
    const chant = melodie[m.genre];
    if (m.accords && !chant) throw new Error(`Morceau « ${m.nom} » : de nouveaux accords demandent une mélodie`);
    for (let i = 0; chant && i < m.mesures; i++) {
      const ch = chords[bar + i];
      ev.push(
        ...notesDeMelodie(chant[i % chant.length], bar + i, ch, m.genre, gammeDe(source.keyPc, source.prog, ch, true)),
      );
    }
    for (const e of chant ? [] : source.ev)
      if (e.hand === "R" && e.bar >= de && e.bar < de + m.mesures)
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
  // Les chanteurs de la chanson générée ne sont pas recopiés : `chanter` en pose où l'on veut. La chanson d'essai
  // n'est plus celle de sa graine : elle n'a pas de source (ADR-0016)
  return finaliser({
    ...source,
    sections,
    totalBars: bar,
    chords,
    ev,
    chanteurs: [],
    endBeat: bar * 4,
    source: undefined,
  });
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
 * Écrit la mélodie des sections en 3 contre 2 (#19) comme le générateur : en croches, aux places de la difficulté,
 * par degrés voisins tirés de la graine (ADR-0005). Leur basse en triolets vient déjà des motifs (`assembler`).
 */
export function polyrythmer(chanson: Chanson, diff: string, graine = chanson.seed): Chanson {
  const rng = mulberry32(graine * 1693 + 2903);
  for (const sec of chanson.sections) {
    if (sec.kind !== "polyrythmie") continue;
    const dedans = (e: Note) => e.bar >= sec.start && e.bar < sec.start + sec.bars;
    chanson.ev = chanson.ev.filter((e) => e.hand === "L" || !dedans(e));
    chanson.ev.push(...melodieEnPolyrythmie(rng, DIFFS[diff].polyrythmie, sec.start, sec.bars, chanson.chords));
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
          ici = chanson.ev.filter((e) => memeTemps(e.beat, beat)),
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

// Le tir de chaque couloir de la mélodie ; une petite note (#14) se tire avec la touche du dessous
const COULOIRS_DE_TIR: Action[] = ["couloir0", "couloir1", "couloir2", "couloir3"];
/**
 * Un fantôme fictif (#32), pour l'essai du fantôme : la partie d'un joueur qui joue chaque note de la chanson à son
 * temps, d'un appui (tenu jusqu'au bout d'une note tenue), sauf une note sur `oubli`, qu'il laisse passer. Son score
 * au début de chaque temps compte les points d'une note réussie au temps près, multipliés par le combo comme dans le
 * jeu, mais sans les bonus (accords, phrases, style) : un joueur sans faute le dépasse.
 */
export function fantomeFictif(chanson: Chanson, diff: string, essai: string, oubli = 4): Fantome {
  const notes = [...chanson.ev].sort((a, b) => a.beat - b.beat),
    coups: Coup[] = [],
    gains: { beat: number; points: number }[] = [];
  let combo = 0;
  notes.forEach((ev, i) => {
    if (i % oubli === oubli - 1) {
      combo = 0;
      return;
    }
    const action: Action =
      ev.hand === "R"
        ? COULOIRS_DE_TIR[Math.floor(ev.lane)]
        : ev.lane === 3
          ? "ecraser"
          : ev.lane === 0 || ev.lane === 5
            ? "glisser"
            : "sauter";
    coups.push(
      { temps: ev.beat, geste: "appui", action, resultat: "parfait" },
      { temps: ev.beat + Math.max(ev.dur, 0.25), geste: "relache", action },
    );
    combo++;
    gains.push({ beat: ev.beat, points: Math.round(300 * (1 + Math.min(3, Math.floor(combo / 10)) * 0.5)) });
  });
  coups.sort((a, b) => a.temps - b.temps);
  const scores: number[] = [];
  for (let b = 0, k = 0, score = 0; b <= chanson.endBeat; b++) {
    while (k < gains.length && gains[k].beat < b) score += gains[k++].points;
    scores.push(score);
  }
  return {
    graine: chanson.seed,
    difficulte: diff,
    essai,
    mains: "both",
    vitesse: 1,
    auto: false,
    coups,
    scores,
    finie: true,
    le: 0,
  };
}
