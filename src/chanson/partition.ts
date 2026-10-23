/* ---------- Partitions : les chansons écrites à la main (#28, ADR-0016) ---------- */
// Logique pure (ADR-0007). Une chanson vient d'une graine (ADR-0005) ou d'une partition. Une partition dit
// l'intention, pas les notes calculées : la tonalité, le tempo, la progression, la difficulté, puis des sections
// avec, pour chaque mesure, un motif de basse et un motif de mélodie dans la notation des essais et de `DIFFS`.
// `composer()` en fait une Chanson avec les fonctions de notes du générateur : une partition ne contient jamais de
// hauteur, les notes sont des degrés de l'accord (ADR-0003, ADR-0010). La fabrique des essais (`essais/fabrique.ts`)
// écrit ses mesures avec les mêmes fonctions (`notesDeMelodie`, `finaliser`).
//
// La notation (une mesure, 8 signes pour des croches ou 12 pour des triolets, ADR-0013) :
// - basse : S glisser, W sauter, D double saut, P plaque à écraser, T tunnel, M pente montante et B pente
//   descendante (tenus sur les « - »), . silence ;
// - mélodie : 0 à 3 le couloir, - prolonge la note en note tenue, ~ en trille avec le couloir au-dessus et _ avec
//   celui au-dessous, / et \ en serpent qui monte ou descend d'un couloir à chacun, a b c une petite note entre les
//   couloirs 0 et 1, 1 et 2, 2 et 3, qui mène à la note suivante de la mesure, . silence.
import { DIFFS } from "./difficultes";
import {
  NOM_CROISEE,
  NOM_POLYRYTHMIE,
  couloirsDuSerpent,
  noteDeMelodie,
  notesDeBasse,
  petiteNote,
  voisin,
} from "./generateur";
import { PAS_PAR_MESURE, enTemps, relierAccords } from "./temps";
import { NOTE_FR, PROGS, gammeDe, makeChord } from "./theorie";
import type { Accord, Chanson, Genre, Note, Section } from "./types";

/** La version de la notation. Un nouveau signe ou un nouveau champ l'augmente (ADR-0016). */
export const VERSION_PARTITION = 1;

export interface SectionDePartition {
  genre: Genre;
  mesures: number;
  /** Les motifs de basse et de mélodie, un par mesure, repris en boucle s'il y en a moins que de mesures ; une
   * liste vide : la main se tait */
  basse: string[];
  melodie: string[];
  /** Un pont en mains croisées (#21) : la scène s'y retourne, et sa mélodie est écrite */
  croisee?: true;
}

export interface Partition {
  v: number;
  titre: string;
  /** La tonique, en classe de hauteur (0 Do … 11 Si) */
  ton: number;
  bpm: number;
  /** Une clé de `DIFFS` : les fenêtres de jugement et les dégâts */
  diff: string;
  /** Le nom d'une progression de `PROGS` : les accords de chaque section la suivent depuis sa première mesure,
   * l'outro prend son accord de fin, comme dans le générateur */
  prog: string;
  sections: SectionDePartition[];
}

/* ---------- Ce qui est permis ---------- */
export const GENRES: Genre[] = ["intro", "couplet", "refrain", "pont", "polyrythmie", "outro"];
export const SIGNES_BASSE = ".-SWDPTMB";
export const SIGNES_MELODIE = ".-~_/\\0123abc";
/** Les signes qui prolongent la note d'avant */
export const SUITES_BASSE = "-";
export const SUITES_MELODIE = "-~_/\\";
/** Une mesure : 8 croches ou 12 triolets (ADR-0013) */
export const DIVISIONS = [8, 12];
export const LIMITES = { titre: 40, bpm: [60, 180], sections: 16, mesuresParSection: 32, mesures: 64 } as const;

/** Le solo libre : la mélodie y est à celui qui joue, une partition n'en écrit pas */
export const estSoloLibre = (s: SectionDePartition) => s.genre === "pont" && !s.croisee;

const motifValide = (m: unknown, signes: string) =>
  typeof m === "string" && DIVISIONS.includes(m.length) && [...m].every((c) => signes.includes(c));
const entierEntre = (x: unknown, min: number, max: number) =>
  Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** La même partition, champs dans un ordre fixe et sans rien d'autre : l'empreinte et le code en dépendent */
export function normaliser(p: Partition): Partition {
  return {
    v: p.v,
    titre: p.titre,
    ton: p.ton,
    bpm: p.bpm,
    diff: p.diff,
    prog: p.prog,
    sections: p.sections.map((s) => ({
      genre: s.genre,
      mesures: s.mesures,
      basse: [...s.basse],
      melodie: [...s.melodie],
      ...(s.croisee ? { croisee: true as const } : {}),
    })),
  };
}

/**
 * Lit une partition venue d'ailleurs (la sauvegarde, un code collé) : la partition normalisée, ou null si une seule
 * chose n'est pas permise. On ne répare pas : un code partagé doit recréer la chanson à l'identique, ou rien.
 */
export function lirePartition(brut: unknown): Partition | null {
  if (!estObjet(brut) || !entierEntre(brut.v, 1, VERSION_PARTITION)) return null;
  const { titre, ton, bpm, diff, prog, sections } = brut;
  if (typeof titre !== "string" || titre.length > LIMITES.titre) return null;
  if (!entierEntre(ton, 0, 11) || !entierEntre(bpm, LIMITES.bpm[0], LIMITES.bpm[1])) return null;
  if (typeof diff !== "string" || !(diff in DIFFS) || !PROGS.some((x) => x.name === prog)) return null;
  if (!Array.isArray(sections) || sections.length < 1 || sections.length > LIMITES.sections) return null;
  let total = 0;
  for (const s of sections) {
    if (!estObjet(s) || !GENRES.includes(s.genre as Genre)) return null;
    if (!entierEntre(s.mesures, 1, LIMITES.mesuresParSection)) return null;
    if (!Array.isArray(s.basse) || !Array.isArray(s.melodie)) return null;
    if (s.basse.length > LIMITES.mesuresParSection || s.melodie.length > LIMITES.mesuresParSection) return null;
    if (!s.basse.every((m) => motifValide(m, SIGNES_BASSE))) return null;
    if (!s.melodie.every((m) => motifValide(m, SIGNES_MELODIE))) return null;
    if (s.croisee !== undefined && (s.croisee !== true || s.genre !== "pont")) return null;
    // Le solo libre n'a pas de mélodie écrite : tout ce qu'on y joue sonne juste
    if (estSoloLibre(s as unknown as SectionDePartition) && s.melodie.some((m) => /[0-3abc]/.test(m))) return null;
    total += s.mesures as number;
  }
  if (total > LIMITES.mesures) return null;
  return normaliser(brut as unknown as Partition);
}

/* ---------- Empreinte et graine ---------- */
/**
 * L'empreinte d'une partition : 14 chiffres hexadécimaux, tirés de son texte normalisé (cyrb53). Elle désigne la
 * partition dans la sauvegarde (`p:empreinte`, ADR-0014) et donne sa graine.
 */
export function empreinteDe(p: Partition): string {
  const texte = JSON.stringify(normaliser(p));
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0) & 0x1fffff).toString(16).padStart(6, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** La graine d'une partition, tirée de son empreinte : le hasard de l'auto-play au solo en dépend (ADR-0012) */
export const graineDe = (empreinte: string) => 1 + (parseInt(empreinte.slice(-8), 16) % 99999);

/* ---------- Composer ---------- */
/** Le nom d'une section de partition, d'après son genre */
export function nomDeSection(s: SectionDePartition) {
  if (s.croisee) return NOM_CROISEE;
  const noms: Record<Genre, string> = {
    intro: "Intro",
    couplet: "Couplet",
    refrain: "Refrain",
    pont: "Solo libre",
    polyrythmie: NOM_POLYRYTHMIE,
    outro: "Outro",
  };
  return noms[s.genre];
}

/**
 * Les notes de mélodie d'une mesure, d'après un motif (voir la notation en tête du fichier), construites comme
 * celles du générateur (ADR-0003, ADR-0010). La longueur du motif donne sa division (ADR-0013) : chaque position
 * et chaque durée se calcule en pas de la grille de 12 par temps.
 */
export function notesDeMelodie(motif: string, bar: number, ch: Accord, kind: Genre, pentatonique: number[]): Note[] {
  const signe = PAS_PAR_MESURE / motif.length,
    temps = (k: number) => enTemps(bar * PAS_PAR_MESURE + k * signe),
    notes: Note[] = [];
  for (let k = 0; k < motif.length; k++) {
    const petite = "abc".indexOf(motif[k]);
    if (petite >= 0) {
      // Elle mène à la note suivante de la mesure : vers le haut si celle-ci est au-dessus
      const lane = petite + 0.5,
        suivante = motif.slice(k + 1).match(/[0-3]/),
        n = petiteNote(lane, !suivante || +suivante[0] > lane, temps(k), bar, ch, kind, pentatonique);
      if (n) notes.push(n);
      continue;
    }
    if (!/[0-3]/.test(motif[k])) continue;
    const lane = +motif[k],
      suite = motif[k + 1];
    let n = 1;
    while (k + n < motif.length && SUITES_MELODIE.includes(motif[k + n])) n++;
    const trille = suite === "~" ? voisin(lane, 1) : suite === "_" ? voisin(lane, -1) : undefined;
    // Un serpent (#16) : un couloir de plus par / (en montant) ou par \ (en descendant)
    const passages = [...motif.slice(k + 1, k + n)].filter((c) => c === "/" || c === "\\"),
      serpent = passages.length
        ? couloirsDuSerpent(lane, passages[0] === "/" ? 1 : -1, passages.length + 1)
        : undefined;
    notes.push(noteDeMelodie(lane, temps(k), n > 1 ? enTemps(n * signe) : 0, bar, ch, kind, 1, trille, serpent));
  }
  return notes;
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
  relierAccords(ev);
  return chanson;
}

/**
 * Compose la chanson d'une partition valide (voir `lirePartition`). Les accords suivent la progression, la basse
 * et la mélodie suivent les motifs ; aucune plaque n'est ajoutée d'office : une partition écrit la sienne (P). La
 * chanson porte sa source, l'empreinte de la partition, qui lui donne aussi sa graine.
 */
export function composer(p: Partition): Chanson {
  const prog = PROGS.find((x) => x.name === p.prog),
    sections: Section[] = [],
    chords: Accord[] = [],
    ev: Note[] = [];
  let bar = 0;
  for (const s of p.sections) {
    sections.push({
      name: nomDeSection(s),
      kind: s.genre,
      bars: s.mesures,
      start: bar,
      ...(s.croisee ? { croisee: true as const } : {}),
    });
    for (let i = 0; i < s.mesures; i++) {
      const ch = makeChord(p.ton, s.genre === "outro" ? prog.end : prog.chords[i % prog.chords.length]);
      chords.push(ch);
      if (s.basse.length) ev.push(...notesDeBasse(s.basse[i % s.basse.length], bar + i, ch, s.genre, false));
      if (s.melodie.length)
        ev.push(
          ...notesDeMelodie(s.melodie[i % s.melodie.length], bar + i, ch, s.genre, gammeDe(p.ton, prog, ch, true)),
        );
    }
    bar += s.mesures;
  }
  const empreinte = empreinteDe(p);
  return finaliser({
    seed: graineDe(empreinte),
    prog,
    keyPc: p.ton,
    bpm: p.bpm,
    sections,
    totalBars: bar,
    chords,
    ev,
    chanteurs: [],
    endBeat: bar * 4,
    keyName: `${NOTE_FR[p.ton]} ${prog.mode}`,
    progLabel: prog.chords.map((c) => makeChord(p.ton, c).name).join(" – "),
    source: { genre: "partition", empreinte, titre: p.titre },
  });
}
