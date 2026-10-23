// La carte du monde (#25) : l'ouvrir, choisir un lieu, enchaîner le suivant. Pendant un essai qui a sa progression
// fictive, la carte se regarde sans qu'on puisse y choisir un lieu (cela quitterait l'essai).
import { LIEUX, graineDuLieu } from "../jeu/carte";
import { S } from "../jeu/etat";
import { carteDisponible, prochainLieu } from "./ecran-carte";
import { show } from "./ecrans";
import { diffDuJoueur, load } from "./reglages";

/* ---------- Carte ---------- */
export function ouvrirCarte() {
  if (!carteDisponible()) return;
  S.mode = "carte";
  show("carte");
}
/** Revient de la carte à l'écran de départ de la chanson en cours */
export function fermerCarte() {
  S.mode = "title";
  show("title");
}
/** Le n-ième lieu de la carte, à partir de 1 : les chiffres du clavier */
export const lieuNumero = (n: number) => LIEUX[n - 1];

/** Prépare la chanson d'un lieu, sur son écran de départ, dans la difficulté du joueur. Pas pendant un essai. */
export function choisirLieu(lieu: string) {
  if (S.essai || !LIEUX.includes(lieu)) return false;
  load(graineDuLieu(lieu), diffDuJoueur());
  return true;
}
/** Enchaîne avec le lieu suivant : c'est ici qu'un entracte entre deux souvenirs pourra se glisser (#27) */
export const enchainer = () => choisirLieu(prochainLieu());
