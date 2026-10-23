/* ---------- Remontage entre deux lieux (#27, ADR-0015) ---------- */
// Logique pure (ADR-0007). Entre deux lieux de la carte, le joueur remonte le mécanisme en rythme : la clé de la boîte
// à musique dans la Boîte, la manivelle du groupe électrogène dans la Ville. C'est une seule mécanique, habillée par
// chaque univers (ADR-0015) : mêmes tours, même jugement, même effet.
// Une mesure de décompte, puis quatre mesures de tours, un tous les deux temps, à la main gauche puis à la main droite.
// Chaque tour réussi tend le ressort : l'harmonie de départ du lieu suivant va de 60 (aucun tour) à 100 (tous).
// Les temps sont en secondes depuis le premier clic du décompte, à l'heure où le joueur entend le son (ADR-0004).
import type { Main } from "../chanson/types";

export const REMONTAGE = {
  /** Les temps du décompte, avant le premier tour */
  decompte: 4,
  mesures: 4,
  /** Un tour tous les `ecart` temps : huit tours en quatre mesures */
  ecart: 2,
  /** L'harmonie de départ sans aucun tour réussi, et avec tous */
  min: 60,
  max: 100,
};

export type EtatTour = "attente" | "parfait" | "bien" | "rate";
export interface Tour {
  /** L'heure du tour, en secondes depuis le début du décompte */
  temps: number;
  main: Main;
  etat: EtatTour;
  /** Le tour a été joué par l'auto-play */
  auto?: boolean;
}
export interface Remontage {
  /** Secondes par temps : le tempo de la chanson du lieu suivant */
  spb: number;
  tours: Tour[];
  /** L'heure de la fin : une fois les quatre mesures passées */
  fin: number;
}

/** Les tours d'un remontage au tempo donné : alternativement main gauche et main droite, la gauche d'abord */
export function creerRemontage(spb: number): Remontage {
  const { decompte, mesures, ecart } = REMONTAGE,
    n = (mesures * 4) / ecart;
  return {
    spb,
    tours: Array.from({ length: n }, (_, k) => ({
      temps: (decompte + k * ecart) * spb,
      main: (k % 2 ? "R" : "L") as Main,
      etat: "attente" as EtatTour,
    })),
    fin: (decompte + mesures * 4) * spb,
  };
}

/**
 * Un appui de cette main, à l'heure `t`, avec les fenêtres de jugement de la difficulté ([parfait, bien], en
 * secondes, les mêmes que pendant la chanson). Il juge le tour en attente de cette main le plus proche, s'il est à
 * moins d'un temps : dans la fenêtre, le tour est réussi ; hors de la fenêtre, trop tôt ou trop tard, il est raté (on
 * ne remonte pas un ressort en tapant sans arrêt). Plus loin d'un temps, l'appui est ignoré. Renvoie le tour jugé.
 */
export function jugerTour(r: Remontage, main: Main, t: number, win: [number, number]): Tour | null {
  let proche: Tour | null = null;
  for (const tour of r.tours)
    if (tour.main === main && tour.etat === "attente" && Math.abs(t - tour.temps) < r.spb)
      if (!proche || Math.abs(t - tour.temps) < Math.abs(t - proche.temps)) proche = tour;
  if (!proche) return null;
  const ecart = Math.abs(t - proche.temps);
  proche.etat = ecart <= win[0] ? "parfait" : ecart <= win[1] ? "bien" : "rate";
  return proche;
}

/**
 * Le temps avance jusqu'à `t` : l'auto-play réussit à leur heure les tours des mains qui jouent toutes seules
 * (`auto`), et un tour que personne n'a joué à la fin de sa fenêtre est raté. Renvoie les tours joués par
 * l'auto-play et les tours ratés à cet instant, pour le son et l'image.
 */
export function avancerRemontage(r: Remontage, t: number, win: [number, number], auto: (main: Main) => boolean) {
  const joues: Tour[] = [],
    rates: Tour[] = [];
  for (const tour of r.tours) {
    if (tour.etat !== "attente") continue;
    if (auto(tour.main) && t >= tour.temps) {
      tour.etat = "parfait";
      tour.auto = true;
      joues.push(tour);
    } else if (t - tour.temps > win[1]) {
      tour.etat = "rate";
      rates.push(tour);
    }
  }
  return { joues, rates };
}

/** Le remontage est fini : les quatre mesures sont passées */
export const remontageFini = (r: Remontage, t: number) => t >= r.fin;

/** Passer le remontage : les tours qui restent sont ratés */
export function passerRemontage(r: Remontage) {
  for (const tour of r.tours) if (tour.etat === "attente") tour.etat = "rate";
}

/** L'harmonie de départ pour ce nombre de tours réussis sur le total : de 60 à 100, en ligne droite, arrondie */
export const harmonieDeDepart = (reussis: number, total: number) =>
  Math.round(REMONTAGE.min + ((REMONTAGE.max - REMONTAGE.min) * reussis) / Math.max(1, total));

/** Les tours réussis jusqu'ici, et l'harmonie de départ qu'ils donnent */
export function resultatRemontage(r: Remontage) {
  const reussis = r.tours.filter((t) => t.etat === "parfait" || t.etat === "bien").length,
    total = r.tours.length;
  return { reussis, total, harmonie: harmonieDeDepart(reussis, total) };
}
