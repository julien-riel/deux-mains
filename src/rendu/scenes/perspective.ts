/* ---------- La perspective de la scène vers l'horizon (ADR-0019, #82) ---------- */
// La caméra est derrière le personnage, et le temps devient de la profondeur : ce qui se joue dans `dz` temps est
// `dz` temps plus loin sur la route. Une place se donne par son décalage à l'écran depuis le point de fuite, tel
// qu'on le voit sur le plan d'impact (là où l'on joue), puis se rapproche du point de fuite avec la profondeur.
// Le décor de chaque univers (`horizon-ville.ts`, `horizon-boite.ts`) et la scène (`horizon.ts`) en partagent la
// géométrie.
import { PAS_PAR_TEMPS } from "../../chanson/temps";
import { S, tracesAffichees } from "../../jeu/etat";
import { couleurDeLaTrace, pasDeLaTrace } from "../../jeu/traces";
import type { Voie } from "./contrat";

/** Le point de fuite, sur la ligne d'horizon */
export const VPX = 600,
  VPY = 236;
/**
 * La profondeur d'un temps : à un temps du point d'impact, tout est 3,6 fois plus petit et 3,6 fois plus près du point
 * de fuite. Assez forte pour que deux notes à un tiers de temps l'une de l'autre se séparent à un temps de l'impact
 * (les triolets et les petites notes de Difficile), assez douce pour qu'on les voie arriver.
 */
export const PROFONDEUR = 2.6;
/** L'échelle d'une chose posée sur le plan d'impact : le personnage et les ennemis y sont un peu plus grands que de côté */
export const ECHELLE = 1.3;
/** Ce que la scène montre à l'avance, en temps : au-delà, tout est un point sur l'horizon */
export const AVANCE = 4;
/** Le sol sous le personnage, sous le point de fuite, et la demi-largeur de la route, sur le plan d'impact */
export const SOL = 269,
  ROUTE = 230;
/**
 * Les quatre rails de la mélodie, de la fondamentale (J) à l'octave (;), de gauche à droite : leur point d'impact,
 * en arc au-dessus du personnage. Les deux du milieu sont plus hauts et plus écartés que dans la maquette, pour que
 * leur rail soit assez long à l'écran.
 */
export const RAILS: readonly (readonly [number, number])[] = [
  [-370, 84],
  [-230, -108],
  [230, -108],
  [370, 84],
];
/** La ligne du chanteur et du boss, au-dessus des deux rails du milieu */
export const CHANTEUR: readonly [number, number] = [0, -128];

/**
 * Le facteur de perspective à `dz` temps du plan d'impact : 1 sur le plan, vers 0 au loin. Ce qui est passé (dz < 0)
 * fonce vers la caméra à la même vitesse qu'au plan d'impact, et sort de l'écran.
 */
export const facteur = (dz: number) => (dz >= 0 ? 1 / (1 + PROFONDEUR * dz) : 1 - PROFONDEUR * dz);
/** La profondeur, en temps, d'un facteur de perspective : l'inverse de `facteur` */
export const profondeur = (s: number) => (s <= 1 ? (1 / s - 1) / PROFONDEUR : (1 - s) / PROFONDEUR);

/** La place à l'écran d'un point décalé de (ox, oy) sur le plan d'impact, à `dz` temps de profondeur, et son facteur */
export function projeter(ox: number, oy: number, dz: number): [number, number, number] {
  const s = facteur(dz);
  return [VPX + ox * s, VPY + oy * s, s];
}

/** Le décalage d'une voie sur le plan d'impact ; une voie entre deux rails (n + 0,5) est au milieu des deux */
export function decalage(voie: Voie): readonly [number, number] {
  if (voie === "basse") return [0, SOL];
  if (voie === "chanteur") return CHANTEUR;
  if (Number.isInteger(voie)) return RAILS[voie];
  const a = RAILS[Math.floor(voie)],
    b = RAILS[Math.ceil(voie)];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Une trace d'une note parfaite (#29) que le décor montre : la trace, sa couleur (`COULEUR_BASSE` ou un couloir),
 * le temps de sa note, et à quel point la partie vient de la peindre (de 1, à l'instant, à 0, un temps plus tard) */
export interface TraceVue {
  t: number;
  couleur: number;
  temps: number;
  frais: number;
}

/**
 * Les traces des notes parfaites de la chanson (#29), gardées et nouvelles, au format de toujours : la Ville en
 * rallume des immeubles le long de la route, la Boîte en fait des étoiles qui restent au ciel (ADR-0015).
 */
export function tracesVues(nb: number): TraceVue[] {
  return tracesAffichees().map((t) => {
    const temps = pasDeLaTrace(t) / PAS_PAR_TEMPS,
      age = nb - temps;
    return {
      t,
      couleur: couleurDeLaTrace(t),
      temps,
      frais: age >= 0 && age < 1 && S.traces.nouvelles.includes(t) ? 1 - age : 0,
    };
  });
}
