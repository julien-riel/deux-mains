/* ---------- Les cordes des couloirs (#78) ---------- */
// Ce que les coups font aux couloirs quand une scène les dessine en cordes : un tir réussi pince la corde de son
// couloir, qui vibre et s'apaise ; un raté la casse, puis elle se renoue en une demi-seconde, moins d'une mesure à
// tous les tempos du jeu. Chaque coup garde le temps de sa note : la scène sait ainsi où, le long de la corde, elle a
// été pincée ou cassée. Ce n'est qu'une image : le jugement n'en dépend pas.

/** Un pincement : le couloir, le temps de la note, l'heure (performance.now) et sa force (un « Parfait » pince fort) */
export interface Pincement {
  voie: number;
  beat: number;
  at: number;
  force: number;
}
/** Une casse : le couloir, le temps de la note ratée et l'heure du raté */
export interface Casse {
  voie: number;
  beat: number;
  at: number;
}

/** Combien de temps une corde vibre, et combien de temps elle reste cassée avant de se renouer, en ms */
export const VIBRE = 2000,
  CASSEE = 500;
const pincements: Pincement[] = [];
const casses: Casse[] = [];
/** Les nœuds des cordes renouées, qu'on voit encore passer : au plus `NOEUDS` */
const noeuds: Casse[] = [];
const NOEUDS = 24;

/** Un tir réussi pince la corde du couloir `voie` (les petites notes, entre deux couloirs, n'en pincent aucune) */
export function pincer(voie: number, beat: number, parfait: boolean) {
  if (!Number.isInteger(voie)) return;
  pincements.push({ voie, beat, at: performance.now(), force: parfait ? 1 : 0.6 });
  if (pincements.length > 24) pincements.shift();
}
/** Un raté casse la corde du couloir `voie` */
export function casser(voie: number, beat: number) {
  if (!Number.isInteger(voie)) return;
  const c = { voie, beat, at: performance.now() };
  casses.push(c);
  noeuds.push(c);
  if (casses.length > 8) casses.shift();
  if (noeuds.length > NOEUDS) noeuds.shift();
}

/** Les pincements de la corde `voie` qui vibrent encore à l'heure `pnow` */
export const vibrations = (voie: number, pnow: number) =>
  pincements.filter((p) => p.voie === voie && pnow - p.at >= 0 && pnow - p.at < VIBRE);
/** La casse de la corde `voie` à l'heure `pnow`, si elle n'est pas encore renouée */
export const casseDe = (voie: number, pnow: number) =>
  casses.find((c) => c.voie === voie && pnow - c.at >= 0 && pnow - c.at < CASSEE) ?? null;
/** Les nœuds des cordes renouées à l'heure `pnow` */
export const noeudsRenoues = (pnow: number) => noeuds.filter((c) => pnow - c.at >= CASSEE);

/** L'état de la corde d'un couloir : elle vibre, elle est cassée, ou elle est au calme */
export function etatDeLaCorde(voie: number, pnow: number): "cassee" | "vibre" | "calme" {
  if (casseDe(voie, pnow)) return "cassee";
  return vibrations(voie, pnow).length ? "vibre" : "calme";
}
