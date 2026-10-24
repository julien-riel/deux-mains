/* ---------- Les mesures de la scène de côté (ADR-0019) ---------- */
// À part de `cote.ts`, pour que son décor en papier découpé (#78) les lise sans boucle d'imports.
import { PW } from "../outils";

/** Le sol, la place du personnage, la ligne de tir et la vitesse de défilement, en pixels par temps */
export const GY = 505,
  PX = 210,
  HITX = 300,
  PPB = 150;
/** La hauteur de chaque couloir, de la fondamentale à l'octave. Le tactile (ADR-0008) s'y aligne encore (#79). */
export const LANE_Y = [395, 315, 235, 155];
/** Le personnage se tient au milieu de sa largeur */
export const X_BASSE = PX + PW / 2;
