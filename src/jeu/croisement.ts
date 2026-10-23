/* ---------- Mains croisées (#21) ---------- */
// Logique pure (ADR-0007). Pendant un pont en mains croisées, la scène se retourne : les obstacles de la basse
// passent en haut, les ennemis de la mélodie en bas. Ce n'est qu'un affichage, le même dans tous les univers
// (ADR-0006) : les touches, les fenêtres de jugement et les collisions, qui ne dépendent que du temps, ne changent pas.
import type { Section } from "../chanson/types";

/** La bascule dure deux temps : elle finit au début du pont et commence à sa fin, pour que toutes ses notes se
 * lisent à l'envers et que celles des sections voisines se lisent à l'endroit */
export const BASCULE = 2;
/** L'annonce de l'entrée commence une mesure avant le pont */
export const ANNONCE = 4;

export interface Retournement {
  /** L'échelle verticale de la scène : 1 à l'endroit, -1 retournée, entre les deux pendant la bascule */
  k: number;
  /** L'annonce à afficher : l'entrée dans les mains croisées, la sortie, ou rien */
  annonce: "entree" | "sortie" | null;
}

const A_L_ENDROIT: Retournement = { k: 1, annonce: null };

/**
 * Le retournement de la scène au temps `nb` de la partie. `boucle` : la section rejouée en boucle (ADR-0009). Seule
 * son entrée compte : un pont en mains croisées reste retourné d'un passage à l'autre, et une autre section ne se
 * retourne jamais, puisque le pont qui la suit ne vient pas.
 */
export function retournement(sections: Section[], nb: number, boucle?: Section | null): Retournement {
  const ponts = boucle ? [boucle] : sections;
  for (const sec of ponts) {
    if (!sec.croisee) continue;
    const debut = sec.start * 4,
      fin = boucle ? Infinity : (sec.start + sec.bars) * 4;
    if (nb < debut - ANNONCE || nb >= fin + BASCULE) continue;
    // La part de la bascule faite : 0 à l'endroit, 1 retournée
    const part = nb < debut ? Math.max(0, (nb - debut + BASCULE) / BASCULE) : nb <= fin ? 1 : 1 - (nb - fin) / BASCULE;
    return {
      k: Math.cos(Math.PI * part),
      annonce: nb < debut ? "entree" : nb >= fin - BASCULE ? "sortie" : null,
    };
  }
  return A_L_ENDROIT;
}
