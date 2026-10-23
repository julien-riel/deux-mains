/* ---------- L'éditeur de partitions (#28, ADR-0016) ---------- */
// Logique pure (ADR-0007). L'éditeur montre une partition comme une grille : une colonne par signe d'un motif (8
// croches ou 12 triolets par mesure, ADR-0013), une ligne par geste, disposées comme sur la scène (les quatre
// couloirs de la mélodie en haut, puis sauter et glisser). Toucher une case pose ou retire une note ; l'outil
// « tenue » allonge la note de sa ligne jusqu'à la case. Chaque opération renvoie une nouvelle partition, l'ancienne
// n'est pas touchée. Le même éditeur sert aux deux univers, qui ne font que l'habiller (ADR-0006) : le cylindre à
// perforer de la Boîte, la console de la radio pirate de la Ville.
import { DIFFS } from "../chanson/difficultes";
import {
  LIMITES,
  SUITES_BASSE,
  SUITES_MELODIE,
  VERSION_PARTITION,
  estSoloLibre,
  normaliser,
  type Partition,
  type SectionDePartition,
} from "../chanson/partition";
import { PROGS } from "../chanson/theorie";
import type { Genre, Main } from "../chanson/types";

/** Une ligne de la grille : un couloir de la mélodie, ou un geste de la basse */
export interface Ligne {
  main: Main;
  nom: string;
  couloir?: number;
  /** Le signe que la ligne pose dans le motif de sa main */
  signe: string;
}
export const LIGNES: Ligne[] = [
  { main: "R", nom: "Octave", couloir: 3, signe: "3" },
  { main: "R", nom: "Quinte", couloir: 2, signe: "2" },
  { main: "R", nom: "Tierce", couloir: 1, signe: "1" },
  { main: "R", nom: "Fondamentale", couloir: 0, signe: "0" },
  { main: "L", nom: "Sauter", signe: "W" },
  { main: "L", nom: "Glisser", signe: "S" },
];

/** Les outils : poser ou retirer une note, ou allonger une note en note tenue */
export type Outil = "note" | "tenue";

/** Les genres qu'on choisit pour une section : le pont est un solo libre, ou un pont en mains croisées (#21) */
export type ChoixDeGenre = Genre | "croisee";
export const CHOIX_DE_GENRE: { choix: ChoixDeGenre; nom: string }[] = [
  { choix: "intro", nom: "Intro" },
  { choix: "couplet", nom: "Couplet" },
  { choix: "refrain", nom: "Refrain" },
  { choix: "pont", nom: "Solo libre" },
  { choix: "croisee", nom: "Mains croisées" },
  { choix: "polyrythmie", nom: "3 contre 2" },
  { choix: "outro", nom: "Outro" },
];
export const choixDe = (s: SectionDePartition): ChoixDeGenre => (s.croisee ? "croisee" : s.genre);

/* ---------- Une partition neuve ---------- */
const silence = (n = 8) => ".".repeat(n);
const sectionVide = (genre: Genre, mesures: number): SectionDePartition => ({
  genre,
  mesures,
  basse: Array.from({ length: mesures }, () => silence()),
  melodie: Array.from({ length: mesures }, () => silence()),
});

/** Un cylindre vide : une mesure d'intro pour le décompte, un couplet de quatre mesures, une mesure d'outro */
export function partitionNeuve(titre = ""): Partition {
  return {
    v: VERSION_PARTITION,
    titre,
    ton: 9,
    bpm: 96,
    diff: "normal",
    prog: PROGS[0].name,
    sections: [sectionVide("intro", 1), sectionVide("couplet", 4), sectionVide("outro", 1)],
  };
}

/* ---------- Lire la grille ---------- */
const suites = (main: Main) => (main === "L" ? SUITES_BASSE : SUITES_MELODIE);
const estDebut = (c: string, main: Main) => (main === "L" ? "SWDPTMB".includes(c) : /[0-3abc]/.test(c));
// Les notes qui se tiennent : le tunnel et les pentes de la basse, toute note de la mélodie sauf la petite note
const tenable = (c: string, main: Main) => (main === "L" ? "TMB".includes(c) : /[0-3]/.test(c));

/** La ligne d'un signe de début de note : le couloir pour la mélodie (la petite note, sur celui du dessous), le
 * geste pour la basse (la plaque et les pentes avec glisser, le double saut et la pente descendante avec sauter) */
export function ligneDuSigne(c: string, main: Main): number {
  if (main === "R") {
    const petite = "abc".indexOf(c);
    return 3 - (petite >= 0 ? petite : +c);
  }
  return "WDB".includes(c) ? 4 : 5;
}

/** Le début de la note qui occupe la case `k` du motif (k lui-même si une note y commence), ou -1 */
export function proprietaire(motif: string, k: number, main: Main): number {
  if (estDebut(motif[k], main)) return k;
  if (!suites(main).includes(motif[k])) return -1;
  let j = k - 1;
  while (j >= 0 && suites(main).includes(motif[j])) j--;
  return j >= 0 && tenable(motif[j], main) ? j : -1;
}

/** Ce que montre une case : vide, le début d'une note (son signe), ou la suite d'une note tenue */
export type Case = { etat: "vide" } | { etat: "note"; signe: string } | { etat: "suite" };

export function lireCase(motif: string, ligne: number, k: number): Case {
  const main = LIGNES[ligne].main,
    j = proprietaire(motif, k, main);
  if (j < 0 || ligneDuSigne(motif[j], main) !== ligne) return { etat: "vide" };
  return j === k ? { etat: "note", signe: motif[j] } : { etat: "suite" };
}

/** Les deux motifs d'une mesure d'une section, tels que la grille les montre : un motif repris en boucle est celui
 * de sa mesure, une main muette (ou la mélodie du solo libre) joue des silences de la longueur de l'autre */
export function motifsDeLaMesure(sec: SectionDePartition, i: number): { basse: string; melodie: string } {
  const b = sec.basse.length ? sec.basse[i % sec.basse.length] : null,
    m = sec.melodie.length ? sec.melodie[i % sec.melodie.length] : null;
  return { basse: b ?? silence(m?.length ?? 8), melodie: m ?? silence(b?.length ?? 8) };
}

/* ---------- Écrire dans la grille ---------- */
// Une copie de la partition où chaque mesure de la section `s` a ses deux motifs écrits (les motifs repris en boucle
// sont recopiés, une main muette reçoit des silences de la longueur de l'autre)
function deplier(p: Partition, s: number): Partition {
  const q = normaliser(p),
    sec = q.sections[s],
    motifs = Array.from({ length: sec.mesures }, (_, i) => motifsDeLaMesure(sec, i));
  sec.basse = motifs.map((m) => m.basse);
  // Le solo libre garde sa mélodie vide : elle est à celui qui joue
  sec.melodie = estSoloLibre(sec) ? [] : motifs.map((m) => m.melodie);
  return q;
}

// Efface les suites qui commencent à `k` : elles appartenaient à une note qu'on vient de couper ou de remplacer
function effacerSuites(m: string[], k: number, main: Main) {
  for (let i = k; i < m.length && suites(main).includes(m[i]); i++) m[i] = ".";
}

// Une note de basse qui ne se tient plus redevient un geste simple : le tunnel et la pente montante un glisser, la
// pente descendante un saut
function simplifierBasse(m: string[]) {
  m.forEach((c, i) => {
    if ("TMB".includes(c) && m[i + 1] !== "-") m[i] = c === "B" ? "W" : "S";
  });
}

/**
 * Touche la case `k` de la ligne `ligne`, dans la mesure `mesure` de la section `s`, avec un outil :
 * - `note` : pose une note de la ligne (elle remplace ce que la même main jouait à cet instant), retire la note qui
 *   commence là, ou coupe la note tenue qui passe par là ;
 * - `tenue` : allonge jusqu'à la case la note de la ligne qui la précède (une note de la mélodie, un glisser qui
 *   devient tunnel, une pente) ; sans note à allonger, pose une note.
 * Le solo libre n'a pas de mélodie écrite : y toucher une ligne de la mélodie ne change rien.
 */
export function toucher(p: Partition, s: number, mesure: number, ligne: number, k: number, outil: Outil): Partition {
  const L = LIGNES[ligne];
  if (L.main === "R" && estSoloLibre(p.sections[s])) return p;
  const q = deplier(p, s),
    sec = q.sections[s],
    liste = L.main === "L" ? sec.basse : sec.melodie,
    m = [...liste[mesure]],
    ici = lireCase(liste[mesure], ligne, k);
  const poser = () => {
    m[k] = L.signe;
    effacerSuites(m, k + 1, L.main);
  };
  if (outil === "tenue") {
    // La note de la ligne à allonger : celle de la case, ou la dernière avant elle, au-delà des silences
    let j = ici.etat === "vide" ? -1 : proprietaire(liste[mesure], k, L.main);
    for (let i = k - 1; j < 0 && i >= 0; i--) {
      if (m[i] === ".") continue;
      const d = proprietaire(liste[mesure], i, L.main);
      if (d >= 0 && ligneDuSigne(m[d], L.main) === ligne) j = d;
      break;
    }
    const allongeable = j >= 0 && (L.main === "R" ? /[0-3]/.test(m[j]) : "STMB".includes(m[j]));
    if (!allongeable || j === k) {
      if (ici.etat === "vide") poser();
    } else {
      if (m[j] === "S") m[j] = "T";
      for (let i = j + 1; i <= k; i++) if (!suites(L.main).includes(m[i])) m[i] = "-";
      effacerSuites(m, k + 1, L.main);
    }
  } else if (ici.etat === "note") {
    m[k] = ".";
    effacerSuites(m, k + 1, L.main);
  } else if (ici.etat === "suite") effacerSuites(m, k, L.main);
  else poser();
  if (L.main === "L") simplifierBasse(m);
  liste[mesure] = m.join("");
  return q;
}

/**
 * Passe une main d'une mesure des croches aux triolets, ou l'inverse (ADR-0013). Seules les notes qui tombent sur
 * les temps, communs aux deux divisions, sont gardées, en notes simples.
 */
export function changerDivision(p: Partition, s: number, mesure: number, main: Main): Partition {
  if (main === "R" && estSoloLibre(p.sections[s])) return p;
  const q = deplier(p, s),
    sec = q.sections[s],
    liste = main === "L" ? sec.basse : sec.melodie,
    ancien = liste[mesure],
    n = ancien.length === 8 ? 12 : 8,
    m = [...silence(n)];
  for (let i = 0; i < ancien.length; i++) {
    // Le rang du même instant dans la nouvelle division : entier sur les temps seulement
    const c = ancien[i],
      j = (i * n) / ancien.length;
    if (estDebut(c, main) && Number.isInteger(j))
      m[j] = main === "L" && "TMB".includes(c) ? (c === "B" ? "W" : "S") : c;
  }
  liste[mesure] = m.join("");
  return q;
}

/* ---------- Mesures et sections ---------- */
const totalDesMesures = (p: Partition) => p.sections.reduce((n, s) => n + s.mesures, 0);

/** Ajoute une mesure vide à la fin de la section, dans les limites de la notation */
export function ajouterMesure(p: Partition, s: number): Partition {
  if (p.sections[s].mesures >= LIMITES.mesuresParSection || totalDesMesures(p) >= LIMITES.mesures) return p;
  const q = deplier(p, s),
    sec = q.sections[s];
  sec.mesures++;
  sec.basse.push(silence());
  if (!estSoloLibre(sec)) sec.melodie.push(silence());
  return q;
}

/** Retire la dernière mesure de la section ; une section garde au moins une mesure */
export function retirerMesure(p: Partition, s: number): Partition {
  if (p.sections[s].mesures <= 1) return p;
  const q = deplier(p, s),
    sec = q.sections[s];
  sec.mesures--;
  sec.basse.pop();
  if (sec.melodie.length) sec.melodie.pop();
  return q;
}

/** Ajoute une section vide de ce genre après la section `apres` ; renvoie la partition inchangée sans place */
export function ajouterSection(p: Partition, apres: number, choix: ChoixDeGenre = "couplet"): Partition {
  const place = LIMITES.mesures - totalDesMesures(p);
  if (p.sections.length >= LIMITES.sections || place < 1) return p;
  const q = normaliser(p);
  q.sections.splice(apres + 1, 0, sectionVide("couplet", Math.min(4, place)));
  return changerGenre(q, apres + 1, choix);
}

/** Retire une section ; une partition en garde au moins une */
export function retirerSection(p: Partition, s: number): Partition {
  if (p.sections.length <= 1) return p;
  const q = normaliser(p);
  q.sections.splice(s, 1);
  return q;
}

/** Déplace une section d'un rang vers le début (-1) ou vers la fin (1) */
export function deplacerSection(p: Partition, s: number, sens: -1 | 1): Partition {
  const t = s + sens;
  if (t < 0 || t >= p.sections.length) return p;
  const q = normaliser(p);
  [q.sections[s], q.sections[t]] = [q.sections[t], q.sections[s]];
  return q;
}

/** Change le genre d'une section. Un solo libre n'a pas de mélodie écrite : elle est effacée en y passant. */
export function changerGenre(p: Partition, s: number, choix: ChoixDeGenre): Partition {
  const q = deplier(p, s),
    sec = q.sections[s];
  sec.genre = choix === "croisee" ? "pont" : choix;
  if (choix === "croisee") sec.croisee = true;
  else delete sec.croisee;
  if (estSoloLibre(sec)) sec.melodie = [];
  else if (!sec.melodie.length) sec.melodie = sec.basse.map((b) => silence(b.length));
  return q;
}

/* ---------- Réglages de la partition ---------- */
export type Reglage = "titre" | "ton" | "bpm" | "diff" | "prog";

/** Change un réglage de la partition ; une valeur hors des limites est ramenée dedans, une valeur inconnue ignorée */
export function regler(p: Partition, champ: Reglage, valeur: string): Partition {
  const q = normaliser(p),
    n = Math.round(Number(valeur));
  if (champ === "titre") q.titre = valeur.slice(0, LIMITES.titre);
  else if (champ === "ton" && Number.isFinite(n)) q.ton = ((n % 12) + 12) % 12;
  else if (champ === "bpm" && Number.isFinite(n)) q.bpm = Math.min(LIMITES.bpm[1], Math.max(LIMITES.bpm[0], n));
  else if (champ === "diff" && valeur in DIFFS) q.diff = valeur;
  else if (champ === "prog" && PROGS.some((x) => x.name === valeur)) q.prog = valeur;
  return q;
}
