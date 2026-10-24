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

/**
 * La scène d'une partie : celle que l'essai impose, sinon le disque pour le niveau du boss de fin (#26, #80), quel
 * que soit son lieu, sinon la scène de côté. Une scène ne change jamais en pleine chanson (ADR-0019). La scène de
 * chaque lieu et le réglage « Scène » (#83) viendront s'ajouter ici.
 */
export const sceneDeLaPartie = (essai?: { scene?: IdScene } | null, chanson?: { boss?: unknown } | null): IdScene =>
  essai?.scene ?? (chanson?.boss ? "disque" : "cote");
