// Le répertoire (ADR-0018) : ouvrir la liste des chansons connues, en jouer une, l'ouvrir dans l'éditeur
import { REPERTOIRE, airDe, partitionDe } from "../chanson/repertoire";
import { S, airEnCours } from "../jeu/etat";
import { show } from "./ecrans";
import { diffDuRepertoire } from "./ecran-repertoire";
import { ouvrirEditeur } from "./editeur";
import { chargerAir } from "./reglages";

/** Ouvre la liste des airs ; pas pendant un essai, qui impose sa chanson */
export function ouvrirRepertoire() {
  if (S.essai) return;
  S.mode = "repertoire";
  show("repertoire");
}
/** Revient de la liste à l'écran de départ de la chanson en cours */
export function fermerRepertoire() {
  S.mode = "title";
  show("title");
}
/** Le numéro d'un air dans la liste, à partir de 1 */
export const airNumero = (n: number) => REPERTOIRE[n - 1];
/** Prépare la chanson de cet air dans la difficulté du joueur */
export function jouerAir(id: string) {
  const air = airDe(id);
  if (air) chargerAir(air, diffDuRepertoire());
}
/** Ouvre l'air joué dans l'éditeur : il y remplace le brouillon, qu'on peut modifier et ranger comme une composition */
export function editerAir() {
  const air = airDe(airEnCours() ?? "");
  if (air) ouvrirEditeur(partitionDe(air, diffDuRepertoire()));
}
