// Calibrage de la latence (#30, complète ADR-0004) : le joueur tape en rythme sur un métronome, et on mesure
// de combien il tape après (ou avant) le clic qu'il entend. Logique pure : les temps sont donnés en secondes.

/** Le métronome : 4 clics pour se caler, puis 16 clics mesurés */
export const METRONOME = { bpm: 100, decompte: 4, mesures: 16 };
/** Il faut au moins ce nombre de coups réguliers pour mesurer */
export const COUPS_MIN = 8;
// Un coup plus loin que ça de la médiane est un accident : il ne compte pas dans la moyenne
const ECART_MAX = 0.06;

/**
 * Le décalage moyen entre les coups et les clics, en secondes : positif quand le joueur tape après le clic.
 * Renvoie null s'il n'y a pas assez de coups réguliers.
 */
export function mesurerDecalage(coups: number[], clics: number[]): number | null {
  if (clics.length < 2) return null;
  const demiPeriode = (clics[1] - clics[0]) / 2;
  const ecarts = coups
    .map((t) => t - clics.reduce((proche, c) => (Math.abs(t - c) < Math.abs(t - proche) ? c : proche)))
    .filter((d) => Math.abs(d) < demiPeriode)
    .sort((a, b) => a - b);
  if (ecarts.length < COUPS_MIN) return null;
  const mediane = ecarts[Math.floor(ecarts.length / 2)];
  const reguliers = ecarts.filter((d) => Math.abs(d - mediane) <= ECART_MAX);
  if (reguliers.length < COUPS_MIN) return null;
  return reguliers.reduce((s, d) => s + d, 0) / reguliers.length;
}
