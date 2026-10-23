/* ---------- La note de style du solo libre (#22) ---------- */
// Logique pure (ADR-0007). Les notes jouées au solo sont celles que garde la reprise (#9, ADR-0012) : leur couloir
// et leur croche depuis le début du solo. Trois critères simples, d'une à trois étoiles chacun, et un conseil
// pour le plus faible : apprendre à improviser sans s'en rendre compte.
import type { NoteDuSolo } from "./variations";

export type Etoiles = 1 | 2 | 3;
export type Critere = "variete" | "respiration" | "resolution";

/** La note de style d'un solo : les étoiles de chaque critère, le critère le plus faible (null si tout est à
 * trois étoiles), et ce qu'on a compté pour les donner */
export interface Style {
  variete: Etoiles;
  respiration: Etoiles;
  resolution: Etoiles;
  faible: Critere | null;
  phrases: number;
  silences: number;
}

/** Dans l'ordre de l'affichage, qui départage aussi les critères les plus faibles */
export const CRITERES: { cle: Critere; nom: string; explication: string; conseil: string }[] = [
  {
    cle: "variete",
    nom: "Variété",
    explication: "plusieurs couloirs, pas toujours la même note",
    conseil: "Varie : monte et descends d'un couloir à l'autre au lieu de répéter la même note.",
  },
  {
    cle: "respiration",
    nom: "Respiration",
    explication: "des silences entre les phrases",
    conseil: "Respire : entre deux phrases, laisse passer au moins un temps sans jouer.",
  },
  {
    cle: "resolution",
    nom: "Résolution",
    explication: "des phrases qui finissent sur la fondamentale",
    conseil: "Conclus : finis tes phrases sur la fondamentale, le couloir du bas (ou son octave, tout en haut).",
  },
];
/** Le mot pour un solo à trois étoiles partout */
export const BRAVO = "Bel équilibre : ton solo varie, respire et se résout. Garde ce style !";

/** En dessous de trois notes, le solo n'est pas noté (comme pour sa reprise, ADR-0012) */
export const NOTES_MIN_STYLE = 3;
/** Un silence sépare deux phrases quand deux notes sont à au moins trois croches l'une de l'autre : un temps
 * entier sans jouer entre elles */
export const SILENCE = 3;
/** Points par étoile, gagnés par la main de la mélodie à la fin du solo */
export const POINTS_PAR_ETOILE = 50;

/** La fondamentale est le couloir du bas, ou son octave tout en haut (ADR-0003) */
const fondamentale = (couloir: number) => couloir === 0 || couloir === 3;

/** Les phrases du solo : les notes, dans l'ordre, coupées à chaque silence */
export function phrasesDuSolo(solo: NoteDuSolo[]): NoteDuSolo[][] {
  const phrases: NoteDuSolo[][] = [];
  let avant: NoteDuSolo = null;
  for (const n of [...solo].sort((a, b) => a.croche - b.croche)) {
    if (!avant || n.croche - avant.croche >= SILENCE) phrases.push([]);
    phrases.at(-1).push(n);
    avant = n;
  }
  return phrases;
}

/** Variété : trois couloirs dont aucun ne fait plus de la moitié des notes ; deux couloirs dont le plus joué ne
 * fait pas plus des trois quarts ; sinon une étoile (une seule note répétée, par exemple) */
export function variete(solo: NoteDuSolo[]): Etoiles {
  const parCouloir = new Map<number, number>();
  for (const n of solo) parCouloir.set(n.couloir, (parCouloir.get(n.couloir) ?? 0) + 1);
  const part = Math.max(...parCouloir.values()) / solo.length;
  if (parCouloir.size >= 3 && part <= 0.5) return 3;
  if (parCouloir.size >= 2 && part <= 0.75) return 2;
  return 1;
}

/** Respiration : aucun silence entre les phrases, une étoile ; un silence, deux ; deux ou plus, trois */
export const respiration = (silences: number): Etoiles => (silences >= 2 ? 3 : silences === 1 ? 2 : 1);

/** Résolution : au moins deux phrases sur trois finissent sur la fondamentale, trois étoiles ; au moins une sur
 * trois, deux ; sinon une */
export function resolution(phrases: NoteDuSolo[][]): Etoiles {
  const part = phrases.filter((p) => fondamentale(p.at(-1).couloir)).length / phrases.length;
  return part >= 2 / 3 ? 3 : part >= 1 / 3 ? 2 : 1;
}

/** La note de style du solo, ou null s'il a moins de `NOTES_MIN_STYLE` notes */
export function noterLeStyle(solo: NoteDuSolo[]): Style | null {
  if (solo.length < NOTES_MIN_STYLE) return null;
  const phrases = phrasesDuSolo(solo),
    silences = phrases.length - 1;
  const etoiles = { variete: variete(solo), respiration: respiration(silences), resolution: resolution(phrases) };
  const min = Math.min(...Object.values(etoiles)),
    faible = min === 3 ? null : CRITERES.find((c) => etoiles[c.cle] === min).cle;
  return { ...etoiles, faible, phrases: phrases.length, silences };
}

/** Le conseil pour le critère le plus faible, ou un bravo */
export const conseil = (style: Style) => CRITERES.find((c) => c.cle === style.faible)?.conseil ?? BRAVO;

/** Les points de style : 50 par étoile, de 150 à 450 */
export const pointsDeStyle = (style: Style) =>
  (style.variete + style.respiration + style.resolution) * POINTS_PAR_ETOILE;
