/* ---------- La scène de côté (ADR-0019) ---------- */
// Le temps défile de droite à gauche, `PPB` pixels par temps. La mélodie arrive sur quatre couloirs horizontaux,
// étagés de la fondamentale (en bas) à l'octave (en haut), jusqu'à la ligne de tir ; la basse arrive sur le sol,
// jusqu'au personnage, à gauche de la ligne de tir. Elle est habillée en papier découpé (#78) : son décor, un
// diorama dans chaque univers, ses couloirs en cordes et sa route sont dans `cote-papier.ts`, `cote-ville.ts` et
// `cote-boite.ts`, qui reçoivent la scène pour suivre son défilement ; ses mesures dans `cote-mesures.ts`.
import { PAS_PAR_TEMPS } from "../../chanson/temps";
import { S, tracesAffichees } from "../../jeu/etat";
import { COULEUR_BASSE, couleurDeLaTrace, pasDeLaTrace } from "../../jeu/traces";
import { W } from "../outils";
import type { Bord, Pose, Scene, Voie } from "./contrat";
import { GY, HITX, LANE_Y, PPB, X_BASSE } from "./cote-mesures";
import { fondPapier, solPapier } from "./cote-papier";

export { LANE_Y };
// Le chanteur et ses notes passent au-dessus des couloirs ; le boss plane à droite, à mi-hauteur des couloirs
const Y_CHANTEUR = LANE_Y[3] - 50,
  BOSS_X = W - 130,
  BOSS_Y = 275;

/** La hauteur d'un couloir, ou du milieu de deux couloirs voisins (n + 0,5) */
const yDeCouloir = (l: number) => (Number.isInteger(l) ? LANE_Y[l] : (LANE_Y[l - 0.5] + LANE_Y[l + 0.5]) / 2);
const yDeVoie = (voie: Voie) => (voie === "basse" ? GY : voie === "chanteur" ? Y_CHANTEUR : yDeCouloir(voie));
// De côté, tout est debout, à sa taille, et rien n'est caché : ce qui sort de l'écran est coupé par son bord
const debout = (x: number, y: number): Pose => ({ x, y, echelle: 1, angle: 0, visible: true });

/** La scène de côté, et ce qu'elle donne à son décor dans chaque univers */
export interface SceneDeCote extends Scene {
  /** Le chemin parcouru par les notes depuis le début de la chanson, en pixels : le décor en défile une part */
  defile(nb: number): number;
  /** Les traces des notes parfaites (#29) que le décor montre, sur un plan qui défile à `vitesse` fois les notes */
  traces(nb: number, vitesse: number): TraceVue[];
}

/** Une trace d'une note parfaite (#29) à l'écran : la trace, sa couleur (`COULEUR_BASSE` ou un couloir), sa place sur
 * le plan du décor, et à quel point la partie vient de la peindre (de 1, à l'instant, à 0, un temps plus tard) */
export interface TraceVue {
  t: number;
  couleur: number;
  x: number;
  frais: number;
}

export const COTE: SceneDeCote = {
  id: "cote",
  poser: (beat, voie, nb) => debout((voie === "basse" ? X_BASSE : HITX) + (beat - nb) * PPB, yDeVoie(voie)),
  impact: (voie) => debout(voie === "basse" ? X_BASSE : HITX, yDeVoie(voie)),
  // Les notes arrivent par la droite et s'en vont par la gauche
  horsChamp: (p: Pose, bord: Bord, marge: number) => (bord === "devant" ? p.x > W + marge : p.x < -marge),
  avance: (W - HITX) / PPB,
  // Un point tous les quatre pixels
  echantillon: 4 / PPB,
  boss: debout(BOSS_X, BOSS_Y),
  defile: (nb) => nb * PPB,
  traces: tracesVisibles,
  fond: (vue) => fondPapier(vue, COTE),
  sol: solPapier,
};

/**
 * Les traces que le décor montre (#29), sur un plan qui défile à `vitesse` fois celle des notes : chacune là où
 * passait ce plan quand sa note a été jouée, derrière le personnage pour la basse, derrière la ligne de tir pour la
 * mélodie. Seules celles qui tombent sur l'écran ; il n'y en a jamais plus que le plafond des traces (`TRACES`).
 */
function tracesVisibles(nb: number, vitesse: number): TraceVue[] {
  const vues: TraceVue[] = [];
  for (const t of tracesAffichees()) {
    const couleur = couleurDeLaTrace(t),
      temps = pasDeLaTrace(t) / PAS_PAR_TEMPS,
      x = (couleur === COULEUR_BASSE ? X_BASSE : HITX) + (temps - nb) * PPB * vitesse;
    if (x < -40 || x > W + 40) continue;
    const age = nb - temps,
      frais = age >= 0 && age < 1 && S.traces.nouvelles.includes(t) ? 1 - age : 0;
    vues.push({ t, couleur, x, frais });
  }
  return vues;
}
