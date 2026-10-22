// Simulateur de daltonisme : ce que voit une personne protanope ou deutéranope.
//
// Matrices de Machado, Oliveira et Fernandes (2009), sévérité maximale, appliquées en RVB linéaire.
// L'écart entre deux couleurs se mesure en ΔE (CIE 1976, espace Lab) : sous 2, on ne voit pas la différence ;
// au-delà de 10, on la voit d'un coup d'œil.

export type Vision = "normale" | "protanopie" | "deuteranopie";
type Rvb = [number, number, number];

const MATRICES: Record<Vision, number[][]> = {
  normale: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopie: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopie: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

const lineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const borne = (c: number) => Math.min(1, Math.max(0, c));

/** Une couleur #rrggbb, en RVB de 0 à 1 */
export const hex = (h: string): Rvb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rvb;

/** Une couleur hsl(h, s %, l %), en RVB de 0 à 1 */
export function hsl(h: number, s: number, l: number): Rvb {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** La couleur telle que la voit une personne avec cette vision */
export function simuler(c: Rvb, vision: Vision): Rvb {
  const l = c.map(lineaire);
  return MATRICES[vision].map((r) => gamma(borne(r[0] * l[0] + r[1] * l[1] + r[2] * l[2]))) as Rvb;
}

function lab(c: Rvb) {
  const [r, v, b] = c.map(lineaire);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * v + 0.1805 * b) / 0.95047),
    y = f(0.2126 * r + 0.7152 * v + 0.0722 * b),
    z = f((0.0193 * r + 0.1192 * v + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** L'écart perçu entre deux couleurs, pour une vision donnée */
export function ecart(a: Rvb, b: Rvb, vision: Vision) {
  const [la, lb] = [lab(simuler(a, vision)), lab(simuler(b, vision))];
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}
