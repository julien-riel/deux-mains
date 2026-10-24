/* ---------- Les zones tactiles fixes (ADR-0019, question 4A) ---------- */
// En mode tactile, l'écran se partage en trois : une colonne à gauche pour la main gauche (sauter en haut, glisser en
// bas), une rangée en bas pour la main droite (quatre zones égales, de `couloir0` à `couloir3`), et la scène dans le
// rectangle qui reste. Les zones ne dépendent pas de la scène : le même geste joue le même couloir dans tous les lieux.
//
// La colonne et la rangée prennent la même part de la largeur et de la hauteur : la scène garde les proportions de
// l'écran, et son image n'est pas déformée. La rangée court sous la scène, de son bord gauche à son bord droit : la
// zone d'un couloir est sous le quart de la scène qui lui correspond (`zonesDansLaScene`).
//
// Logique pure : rien n'est dessiné ici, et rien ne lit l'écran. La géométrie se calcule pour une taille d'écran
// donnée, dans n'importe quelle unité (les pixels de la scène, W × H, ou ceux de la page).

import type { Action } from "../jeu/etat";
import type { Cadre } from "./scenes/contrat";

/** Les proportions des zones : la part de la largeur prise par la colonne, celle de la hauteur prise par la rangée,
 * et l'écart entre deux zones voisines, en part de la hauteur */
export const ZONES = { colonne: 0.2, rangee: 0.2, ecart: 0.016 };

/** Les zones de l'écran, telles qu'elles se dessinent (un écart les sépare), et le rectangle de la scène */
export interface ZonesTactiles {
  /** Le rectangle de la scène : ce que laissent la colonne et la rangée */
  scene: Cadre;
  /** La moitié haute de la colonne gauche : sauter */
  sauter: Cadre;
  /** La moitié basse de la colonne gauche : glisser, et tenir la glissade */
  glisser: Cadre;
  /** Les quatre zones de la rangée, de gauche à droite : index, majeur, annulaire, auriculaire */
  couloirs: Cadre[];
}

// Les limites de la colonne et de la rangée, pour un écran de cette taille
const limites = (largeur: number, hauteur: number) => ({
  colonne: largeur * ZONES.colonne,
  rangee: hauteur * (1 - ZONES.rangee),
  ecart: hauteur * ZONES.ecart,
});

/** Les zones tactiles et la scène pour un écran de cette taille, dans la même unité */
export function zonesTactiles(largeur: number, hauteur: number): ZonesTactiles {
  const { colonne, rangee, ecart: e } = limites(largeur, hauteur),
    pas = (largeur - colonne) / 4,
    moitie = hauteur / 2;
  return {
    scene: { x: colonne, y: 0, largeur: largeur - colonne, hauteur: rangee },
    sauter: { x: e, y: e, largeur: colonne - 1.5 * e, hauteur: moitie - 1.5 * e },
    glisser: { x: e, y: moitie + e / 2, largeur: colonne - 1.5 * e, hauteur: moitie - 1.5 * e },
    couloirs: [0, 1, 2, 3].map((i) => ({
      x: colonne + i * pas + e / 2,
      y: rangee + e / 2,
      largeur: pas - e,
      hauteur: hauteur - rangee - 1.5 * e,
    })),
  };
}

/**
 * L'action d'un doigt posé en (x, y), sur un écran de cette taille : la colonne gauche saute en haut et glisse en
 * bas, la rangée donne le couloir de sa zone. Les écarts entre les zones comptent pour la zone la plus proche ; un
 * doigt hors de l'écran est ramené à son bord. Un doigt posé sur la scène ne joue rien : null.
 */
export function actionAuPoint(x: number, y: number, largeur: number, hauteur: number): Action | null {
  const { colonne, rangee } = limites(largeur, hauteur);
  if (x < colonne) return y < hauteur / 2 ? "sauter" : "glisser";
  if (y < rangee) return null;
  const i = Math.floor(((x - colonne) / (largeur - colonne)) * 4);
  return `couloir${Math.min(3, Math.max(0, i))}` as Action;
}

/**
 * Les quatre zones de la rangée vues depuis la scène : dans l'espace de la scène (`largeur` × `hauteur`, W × H pour
 * le rendu), qui est ramené dans son rectangle à l'écran. Elles sont sous la scène (y ≥ hauteur) ; leur x et leur
 * largeur sont ceux des notes qu'une scène veut faire tomber sur les doigts (les colonnes, #81). Comme la scène
 * garde les proportions de l'écran, ce découpage ne dépend pas de la taille de l'écran.
 */
export function zonesDansLaScene(largeur: number, hauteur: number): Cadre[] {
  const z = zonesTactiles(largeur, hauteur),
    sx = largeur / z.scene.largeur,
    sy = hauteur / z.scene.hauteur;
  return z.couloirs.map((c) => ({
    x: (c.x - z.scene.x) * sx,
    y: (c.y - z.scene.y) * sy,
    largeur: c.largeur * sx,
    hauteur: c.hauteur * sy,
  }));
}
