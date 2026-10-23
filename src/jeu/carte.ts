/* ---------- Carte du monde (#25) ---------- */
// Logique pure (ADR-0007). Chaque univers a six lieux, un par progression d'accords : les quartiers de la Ville,
// les souvenirs de la Boîte (ADR-0006 : mêmes lieux, mêmes chansons, habillage différent). Un lieu se joue sur sa
// chanson, toujours la même ; il est réussi dès qu'une chanson de sa progression l'est, dans cet univers.
import { progressionDe } from "../chanson/generateur";
import { PROGS } from "../chanson/theorie";

/** Les lieux de la carte, dans l'ordre où on les enchaîne : les noms des progressions */
export const LIEUX = PROGS.map((p) => p.name);

const graines = new Map<string, number>();
/**
 * La chanson d'un lieu : la plus petite graine dont la chanson joue sa progression. Elle ne dépend pas de la
 * difficulté (la progression est tirée avant tout le reste), et ne change que si le générateur change.
 */
export function graineDuLieu(lieu: string): number {
  if (!LIEUX.includes(lieu)) throw new Error(`Lieu inconnu : ${lieu}`);
  if (!graines.has(lieu)) {
    let graine = 1;
    while (progressionDe(graine).name !== lieu) graine++;
    graines.set(lieu, graine);
  }
  return graines.get(lieu);
}

/**
 * Le lieu à jouer après celui-ci : le prochain encore à faire dans l'ordre de la carte, en revenant au début ;
 * quand tout est réussi, simplement le suivant. C'est l'enchaînement des niveaux (les souvenirs, #27).
 */
export function lieuSuivant(reussis: string[], lieu: string): string {
  const i = Math.max(0, LIEUX.indexOf(lieu)),
    suite = [...LIEUX.slice(i + 1), ...LIEUX.slice(0, i + 1)];
  return suite.find((l) => !reussis.includes(l)) ?? suite[0];
}
