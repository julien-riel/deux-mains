/* ---------- Traces des notes parfaites (#29) ---------- */
// Logique pure (ADR-0007). Chaque note « Parfait » laisse une trace sur le décor, là où elle a été jouée, et les
// traces d'une chanson sont gardées par la sauvegarde (ADR-0014) : au passage suivant sur la même chanson, elles
// sont toujours là, et les nouvelles s'y ajoutent. C'est une mécanique commune aux univers (ADR-0015) : la Ville
// l'habille de graffitis lumineux sur ses immeubles, la Boîte d'étoiles phosphorescentes collées aux planches du
// grenier (`rendu/ville.ts`, `rendu/boite.ts`). Ce module ne connaît que les traces elles-mêmes ; l'état de la
// partie les suit dans `jeu/etat.ts`, et le jugement les peint (`jeu/jugement.ts`).
//
// Une trace est un entier : le pas de la note sur la grille de douze pas par temps (ADR-0013), et sa couleur, celle
// de son couloir (ADR-0006) : `pas * 8 + couleur`. Les notes d'une chanson ne changent pas d'une partie à l'autre
// (ADR-0005) ; la trace retrouve donc sa place, sans rien garder de la géométrie du décor.
import type { Main } from "../chanson/types";
import { PAS_PAR_MESURE, pas as pasDe } from "../chanson/temps";

/**
 * Le plafond des traces, pour garder le jeu fluide et le code de sauvegarde court : au plus `parMesure` traces par
 * mesure (le décor n'en montre jamais plus que quelques dizaines à la fois), et au plus `max` par chanson.
 */
export const TRACES = { parMesure: 3, max: 120 };

/** La couleur de la main gauche, la basse ; celles de la main droite sont les couloirs 0 à 3 */
export const COULEUR_BASSE = 4;

/**
 * La trace d'une note jouée « Parfait » : son pas, et sa couleur. Une petite note (#14), entre deux couloirs, prend
 * la couleur du couloir du dessous.
 */
export const trace = (hand: Main, beat: number, lane: number) =>
  pasDe(beat) * 8 + (hand === "L" ? COULEUR_BASSE : Math.max(0, Math.min(3, Math.floor(lane))));

/** Le pas d'une trace, sur la grille de douze pas par temps */
export const pasDeLaTrace = (t: number) => Math.floor(t / 8);
/** La couleur d'une trace : un couloir de la main droite (0 à 3), ou la basse (`COULEUR_BASSE`) */
export const couleurDeLaTrace = (t: number) => t % 8;
/** La mesure d'une trace */
export const mesureDeLaTrace = (t: number) => Math.floor(pasDeLaTrace(t) / PAS_PAR_MESURE);

/** Une trace a la bonne forme : un entier positif, d'une couleur connue */
export const estTrace = (t: unknown): t is number =>
  Number.isSafeInteger(t) && (t as number) >= 0 && couleurDeLaTrace(t as number) <= COULEUR_BASSE;

/** On peut encore ajouter cette trace à celles-ci : elle n'y est pas, et ni sa mesure ni la chanson ne sont pleines */
export function peutAjouter(traces: readonly number[], t: number): boolean {
  if (traces.length >= TRACES.max || traces.includes(t)) return false;
  const m = mesureDeLaTrace(t);
  return traces.filter((x) => mesureDeLaTrace(x) === m).length < TRACES.parMesure;
}

/**
 * Réunit des listes de traces, dans l'ordre : les premières gardent leur place, les suivantes s'ajoutent tant que le
 * plafond le permet. Le résultat est trié par pas, pour que la sauvegarde soit la même quel que soit l'ordre du jeu.
 */
export function reunir(...listes: readonly (readonly number[])[]): number[] {
  const toutes: number[] = [];
  for (const liste of listes) for (const t of liste) if (estTrace(t) && peutAjouter(toutes, t)) toutes.push(t);
  return toutes.sort((a, b) => a - b);
}
