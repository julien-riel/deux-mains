/* ---------- Les ennemis en papier découpé (#78) ---------- */
// Ce que le papier découpé ajoute aux ennemis des neuf lieux, dans chaque univers, sans toucher à leurs dessins :
// ils sont plus grands, ils battent au temps (un saut sur le temps, un balancement d'une mesure à l'autre), et ils
// portent sur eux une médaille de papier à la forme et à la couleur de leur couloir (ADR-0006, #31), à la place
// du contour vide qui les entourait.
import { formeCouloir, g, reduced } from "./outils";

/** De combien les ennemis sont plus grands qu'avant */
export const GRANDEUR = 1.5;

/**
 * Dessine un ennemi (`dessin`, autour de (x, y)) plus grand et battant au temps nb : il saute sur chaque temps et
 * se balance, chacun à son rythme (`beat`, le temps de sa note). `e` est l'échelle de sa pose. Avec « Mouvement
 * réduit », il bat moins fort.
 */
export function aLaMesure(x: number, y: number, beat: number, nb: number, e: number, dessin: () => void) {
  const f = ((nb % 1) + 1) % 1,
    force = reduced ? 0.4 : 1,
    saut = Math.exp(-f * 7) * force,
    balance = Math.sin(nb * Math.PI + beat * 2.1) * 0.12 * force;
  g.save();
  g.translate(x, y - saut * 5 * e);
  g.rotate(balance);
  g.scale(GRANDEUR * (1 + saut * 0.06), GRANDEUR * (1 - saut * 0.08));
  g.translate(-x, -y);
  dessin();
  g.restore();
}

/**
 * La médaille d'un ennemi : la forme de son couloir découpée dans du papier de sa couleur, bordée de papier blanc
 * et cernée d'encre, posée sur son ventre, en (x, y), de rayon r.
 */
export function medaille(lane: number, x: number, y: number, r: number, couleur: string, a: number) {
  g.save();
  g.globalAlpha *= a;
  g.lineJoin = "round";
  formeCouloir(lane, x + 1.5, y + 2.5, r);
  g.fillStyle = "rgba(0,0,0,.35)";
  g.fill();
  formeCouloir(lane, x, y, r);
  g.lineWidth = r * 0.55;
  g.strokeStyle = "#fbf3df";
  g.stroke();
  g.fillStyle = couleur;
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = "#17142b";
  g.stroke();
  g.restore();
}
