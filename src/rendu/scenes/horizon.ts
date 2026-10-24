/* ---------- La scène vers l'horizon (ADR-0019, #82) ---------- */
// La caméra est derrière le personnage, vu de dos, et le temps devient de la profondeur (`perspective.ts`). La basse
// est la route qui file vers le point de fuite : ses obstacles naissent à l'horizon et foncent vers le personnage.
// La mélodie arrive par quatre rails tendus dans le ciel, de gauche à droite comme J K L ;, jusqu'à quatre points
// d'impact en arc au-dessus de lui. Tout ce qui est commun (ennemis, obstacles, tenues, serpents, trilles…) se
// dessine à la pose donnée, de plus en plus petit au loin.
// Son décor dans chaque univers est dans `horizon-ville.ts` (synthwave, fils électriques, immeubles qui se
// rallument) et `horizon-boite.ts` (carton perforé d'orgue de Barbarie, rideaux de velours, étoiles qui restent au
// ciel), avec le personnage vu de dos.
import { H, W, energy, reduced } from "../outils";
import type { Bord, GesteDuPersonnage, Pose, Scene, VueDeScene, Voie } from "./contrat";
import { fondBoite, personnageBoite, solBoite } from "./horizon-boite";
import { fondVille, personnageVille, solVille } from "./horizon-ville";
import { AVANCE, ECHELLE, VPX, VPY, decalage, facteur, profondeur } from "./perspective";

/** Ce qui fonce vers la caméra grossit, mais jamais plus que d'une fois et demie sa taille au point d'impact */
const GROSSIT = 1.5;

/** La pose d'une chose de la voie `voie` à `dz` temps du plan d'impact : tout est debout, face à la caméra */
function poserA(dz: number, voie: Voie): Pose {
  const s = facteur(dz),
    [ox, oy] = decalage(voie);
  return { x: VPX + ox * s, y: VPY + oy * s, echelle: ECHELLE * Math.min(s, GROSSIT), angle: 0, visible: true };
}

export const HORIZON: Scene = {
  id: "horizon",
  poser: (beat, voie, nb) => poserA(beat - nb, voie),
  impact: (voie) => poserA(0, voie),
  // Ce qui arrive est trop loin au-delà de l'avance (une marge de 150 pixels vaut un temps, comme de côté) ; ce qui
  // est passé est sorti de l'écran, par un bord ou par le bas
  horsChamp(p: Pose, bord: Bord, marge: number) {
    if (bord === "devant") return p.echelle < ECHELLE && profondeur(p.echelle / ECHELLE) > AVANCE + marge / 150;
    return p.x < -marge || p.x > W + marge || p.y < -marge || p.y > H + marge;
  },
  avance: AVANCE,
  // Près du plan d'impact, un temps parcourt près de mille pixels : un point tous les 48es de temps
  echantillon: 1 / 48,
  // Le boss plane au-dessus de l'horizon, derrière les rails d'où sortent ses ennemis
  boss: { x: VPX, y: VPY - 70, echelle: 0.85, angle: 0, visible: true },
  // Les points d'impact ne sont pas étagés (les deux rails du milieu sont à la même hauteur) : la légende des
  // couloirs se range en colonne sur le rail de gauche, de la fondamentale (en bas) à l'octave
  etiquette: (couloir: number) => ({ x: 24, y: 395 - 80 * couloir }),
  fond: (vue: VueDeScene) => (vue.univers === "boite" ? fondBoite(vue) : fondVille(vue)),
  sol: (vue: VueDeScene) => (vue.univers === "boite" ? solBoite(vue) : solVille(vue)),
  personnage: (geste: GesteDuPersonnage) =>
    geste.univers === "boite" ? personnageBoite(geste) : personnageVille(geste),
};

/** Une ligne de vitesse : de (x1, y1) à (x2, y2), et son opacité */
export type LigneDeVitesse = [number, number, number, number, number];

/**
 * Les lignes de vitesse qui fusent du point de fuite quand le combo monte (`energie`, de 0 à 1) : aucune en
 * « Mouvement réduit », ni quand l'énergie est faible. Elles sont tirées du temps de la chanson, toujours les mêmes
 * au même temps.
 */
export function lignesDeVitesse(nb: number, energie = energy()): LigneDeVitesse[] {
  const intensite = Math.min(1, (energie - 0.45) / 0.45);
  if (reduced || intensite <= 0) return [];
  const lignes: LigneDeVitesse[] = [];
  for (let i = 0; i < 36; i++) {
    const graine = Math.sin(i * 12.9898) * 43758.5453,
      h1 = graine - Math.floor(graine),
      h2 = (i * 0.61803) % 1,
      angle = h1 * Math.PI * 2,
      // Chacune file du centre vers le bord, à sa vitesse, et recommence
      u = (h2 + nb * (0.35 + 0.3 * h1)) % 1,
      r = 180 + u * 720,
      l = (40 + 90 * h2) * intensite,
      c = Math.cos(angle),
      s = Math.sin(angle) * 0.7;
    lignes.push([
      VPX + c * r,
      VPY + s * r,
      VPX + c * (r + l),
      VPY + s * (r + l),
      0.45 * intensite * Math.min(1, u * 4),
    ]);
  }
  return lignes;
}
