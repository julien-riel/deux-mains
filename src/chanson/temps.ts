/* ---------- Le temps de la chanson : une grille de référence de 12 pas par temps (ADR-0013) ---------- */
// Logique pure (ADR-0007). Une position (`Note.beat`) et une durée (`Note.dur`) restent des nombres en temps, mais
// toute position et toute durée de note est un multiple de 1/12 de temps : 12 pas donnent à la fois les croches
// (6 pas), les double-croches (3 pas) et les triolets de croches (4 pas, #19). En croches, ces temps sont des
// nombres exacts en binaire ; 1/3 ne l'est pas. Toute comparaison, tout regroupement et tout index de temps passe
// donc par `pas()`, jamais par === sur `beat`.
import type { Note } from "./types";

export const PAS_PAR_TEMPS = 12;
/** Une mesure de quatre temps, en pas */
export const PAS_PAR_MESURE = 4 * PAS_PAR_TEMPS;

/** Le pas (entier) d'un temps de la chanson */
export const pas = (beat: number) => Math.round(beat * PAS_PAR_TEMPS);

/** Le temps d'un pas : la seule façon d'écrire une position hors des croches, pour que tous les chemins de calcul
 * donnent le même nombre */
export const enTemps = (p: number) => p / PAS_PAR_TEMPS;

/** Deux temps sur le même pas */
export const memeTemps = (a: number, b: number) => pas(a) === pas(b);

/** Un temps sur la grille de 12 pas : la règle que le générateur et les essais respectent */
export const surLaGrille = (beat: number) => Math.abs(beat * PAS_PAR_TEMPS - pas(beat)) < 1e-6;

/** Un temps sur la grille des croches (6 pas) : la mélodie y reste, même en 3 contre 2 */
export const surLaCroche = (beat: number) => pas(beat) % (PAS_PAR_TEMPS / 2) === 0;

/** Relie les notes du même pas en accords (`grp`), dans des notes déjà triées par temps */
export function relierAccords(ev: Note[]) {
  for (let i = 0; i < ev.length;) {
    let j = i;
    while (j < ev.length && memeTemps(ev[j].beat, ev[i].beat)) j++;
    if (j - i > 1) {
      const grp = ev.slice(i, j);
      grp.forEach((e) => (e.grp = grp));
    }
    i = j;
  }
}
