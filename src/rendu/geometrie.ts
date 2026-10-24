/* ---------- La scène en cours (ADR-0019) ---------- */
// Le registre des scènes dessinées, et la géométrie de celle de la partie. Le rendu commun et les effets du
// jugement passent par ici, jamais par une scène en particulier : `jeu/` n'importe rien de `rendu/scenes/`.
import { S } from "../jeu/etat";
import type { IdScene } from "../jeu/scenes";
import { H, W } from "./outils";
import type { Cadre, Scene } from "./scenes/contrat";
import { COTE } from "./scenes/cote";

/**
 * Les scènes dessinées, par nom (ADR-0019). Une scène nouvelle est un module de `src/rendu/scenes/` qui respecte le
 * contrat (`contrat.ts`), enregistré ici ; un essai la choisit par son champ `scene`.
 */
export const SCENES_DESSINEES: Partial<Record<IdScene, Scene>> = { cote: COTE };

/** La scène de la partie ; la scène de côté si la sienne n'est pas encore dessinée */
export const scene = (): Scene => SCENES_DESSINEES[S.scene] ?? COTE;

/**
 * Le cadre de la scène à l'écran, dans l'espace de la scène (W × H) : tout l'écran pour l'instant. Les zones
 * tactiles fixes (#79, ADR-0019) en prendront une part ; le rendu ramène alors la scène et son HUD dans ce cadre.
 */
export const cadreDeLaScene = (): Cadre => ({ x: 0, y: 0, largeur: W, hauteur: H });
