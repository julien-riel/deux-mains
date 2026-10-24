/* ---------- Scènes (ADR-0019) ---------- */
// Logique pure (ADR-0007). Le jeu représente la musique de plusieurs façons, par des scènes interchangeables qui
// ne fournissent que leur géométrie et leur décor (`src/rendu/scenes/`). Ce module ne connaît que leurs noms, et
// choisit celle d'une partie : le jugement, les scores, les traces et les fantômes n'en dépendent jamais.

/**
 * Les scènes prévues par ADR-0019 : de côté (`cote`), la mélodie en colonnes (`colonnes`), sur un disque qui tourne
 * (`disque`), et en perspective vers l'horizon (`horizon`). Une scène qui n'est pas encore dessinée est remplacée
 * par la scène de côté (`SCENES_DESSINEES`, `src/rendu/geometrie.ts`).
 */
export const SCENES = ["cote", "colonnes", "disque", "horizon"] as const;
export type IdScene = (typeof SCENES)[number];

/** Les noms des scènes, pour la carte et le réglage « Scène » */
export const NOMS_SCENES: Record<IdScene, string> = {
  cote: "De côté",
  colonnes: "En colonnes",
  disque: "Le disque",
  horizon: "Vers l'horizon",
};

/**
 * La scène de chaque lieu de la carte (#83), par nom de progression (`LIEUX`, `src/jeu/carte.ts`), la même dans les
 * deux univers. Dans l'ordre de la carte : les deux premiers lieux de côté, pour apprendre la lecture de toujours ;
 * puis les colonnes, qui ne changent que la mélodie ; le disque et l'horizon sur des lieux dont la basse ne passe
 * jamais en triolets, même en Difficile (la basse se serre sur le bord du disque, et tout rapetisse vers l'horizon) ;
 * l'horizon sur le lieu qui a le moins de petites notes. Les colonnes, où la basse reste de côté, prennent les
 * lieux qui ont une section en 3 contre 2. `tests/scenes.test.ts` vérifie ces raisons sur les chansons des lieux.
 */
export const SCENES_DES_LIEUX: Readonly<Record<string, IdScene>> = {
  "I–V–vi–IV": "cote",
  "vi–IV–I–V": "cote",
  "Royal Road": "colonnes",
  "Vamp dorien": "disque",
  "Cadence andalouse": "colonnes",
  "Canon de Pachelbel": "cote",
  "ii–V–I": "horizon",
  Blues: "disque",
  "Vamp lydien": "colonnes",
};

/** La scène d'un lieu (un nom de progression) ; la scène de côté pour ce qui n'est pas un lieu de la carte */
export const sceneDuLieu = (lieu?: string): IdScene =>
  (Object.hasOwn(SCENES_DES_LIEUX, lieu ?? "") && SCENES_DES_LIEUX[lieu]) || "cote";

/** Le réglage « Scène » (#83) : celle du lieu (par défaut), ou une scène fixe pour toutes les chansons */
export const REGLAGES_SCENE = ["lieu", ...SCENES] as const;
export type ReglageScene = (typeof REGLAGES_SCENE)[number];
/** Lit le réglage retenu ; tout ce qui n'en est pas un vaut « celle du lieu » */
export const lireReglageScene = (v: unknown): ReglageScene =>
  REGLAGES_SCENE.includes(v as ReglageScene) ? (v as ReglageScene) : "lieu";

/**
 * La scène d'une partie, choisie quand sa chanson se met en place : elle ne change jamais en pleine chanson
 * (ADR-0019).
 * - Un essai garde sa scène, quel que soit le réglage du joueur : celle qu'il impose, sinon le disque pour un niveau
 *   de boss, sinon la scène de côté.
 * - Hors essai, une scène fixée par le réglage vaut pour toutes les chansons, boss, compositions et airs compris.
 * - Avec « celle du lieu », le niveau du boss de fin (#26, #80) se joue sur le disque, et toute autre chanson
 *   (générée, composée ou du répertoire) dans la scène du lieu de sa progression, ou de côté sans lieu.
 */
export function sceneDeLaPartie(
  essai?: { scene?: IdScene } | null,
  chanson?: { boss?: unknown; prog?: { name: string } } | null,
  reglage: ReglageScene = "lieu",
): IdScene {
  if (essai) return essai.scene ?? (chanson?.boss ? "disque" : "cote");
  if (reglage !== "lieu") return reglage;
  return chanson?.boss ? "disque" : sceneDuLieu(chanson?.prog?.name);
}
