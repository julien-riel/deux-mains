/* ---------- Ce qui dure, tendu le long d'une voie (ADR-0019) ---------- */
// Une chose qui dure (une tenue, une trille, un tunnel, une pente) se tend du début à la fin de sa note, le long de
// sa voie. Dans la scène de côté, une voie est une ligne droite : la chose s'y dessine d'un seul tenant, comme
// avant les scènes (`voieDroite`). Ailleurs (les colonnes, les anneaux du disque), on échantillonne ses poses tous
// les `echantillon` temps : une tenue ou une trille suit ses poses en ruban (`src/rendu/scene.ts`), et un dessin
// droit, le tunnel ou la pente, est découpé en tranches, chacune posée sur son bout de voie (`cintrer`).
import { g } from "./outils";
import type { Pose, Scene, Voie } from "./scenes/contrat";

/** Les temps de b1 à b2, tous les `pas` temps, bornes comprises */
function temps(b1: number, b2: number, pas: number): number[] {
  const n = Math.max(1, Math.ceil((b2 - b1) / pas - 1e-9));
  return Array.from({ length: n + 1 }, (_, k) => (k === n ? b2 : b1 + k * pas));
}

/** Une voie est droite à ces poses : à l'horizontale, debout et à sa taille, comme dans la scène de côté */
const droite = (poses: Pose[]) => poses.every((p) => p.angle === 0 && p.echelle === 1 && p.y === poses[0].y);

/** La direction de la voie en chaque pose (le sens où le temps avance), en radians */
function directions(poses: Pose[]): number[] {
  let derniere = 0;
  return poses.map((_, k) => {
    const a = poses[Math.max(0, k - 1)],
      b = poses[Math.min(poses.length - 1, k + 1)];
    if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-6) derniere = Math.atan2(b.y - a.y, b.x - a.x);
    return derniere;
  });
}

/**
 * La voie est-elle droite de b1 à b2, vue au temps nb : horizontale, debout et à sa taille, comme dans la scène de
 * côté ? Une tenue ou une trille s'y dessine alors d'un seul rectangle ; sinon, elle suit les poses de sa note, en
 * ruban (`rubanTenu`, `bandeDeTrille`, `src/rendu/scene.ts`).
 */
export const voieDroite = (sc: Scene, voie: Voie, b1: number, b2: number, nb: number) =>
  droite([b1, (b1 + b2) / 2, b2].map((b) => sc.poser(b, voie, nb)));

/**
 * Dessine une chose droite qui dure de b1 à b2 sur la voie : `dessin(x, sol)` la dessine comme dans la scène de
 * côté, debout sur la ligne horizontale `sol`, où `x(b)` est la place du temps b. Sur une voie droite, elle est
 * dessinée d'un seul tenant ; sinon, en tranches d'un `echantillon` de temps, chacune posée sur son bout de voie et
 * coupée par les normales de la voie à ses deux bords, `haut` pixels au-dessus de la voie et `bas` en dessous.
 * `marge` (en temps) prolonge les tranches de chaque côté, pour ce que la chose dessine au-delà de sa note.
 */
export function cintrer(
  sc: Scene,
  voie: Voie,
  b1: number,
  b2: number,
  nb: number,
  dessin: (x: (b: number) => number, sol: number) => void,
  { haut = 420, bas = 30, marge = 0.5 } = {},
) {
  const p1 = sc.poser(b1, voie, nb);
  if (droite([p1, sc.poser(b2, voie, nb), sc.impact(voie)])) return dessin((b) => sc.poser(b, voie, nb).x, p1.y);
  // Le chemin parcouru le long de la voie, de son début (ou du point d'impact) à sa fin, à la taille de référence
  const debut = Math.min(b1 - marge, nb),
    ts = temps(debut, Math.max(b2 + marge, nb), sc.echantillon),
    poses = ts.map((b) => sc.poser(b, voie, nb)),
    dir = directions(poses),
    long = [0];
  for (let k = 1; k < poses.length; k++) {
    const p = poses[k],
      q = poses[k - 1];
    long.push(long[k - 1] + Math.hypot(p.x - q.x, p.y - q.y) / ((p.echelle + q.echelle) / 2));
  }
  const pas = ts[1] - ts[0],
    u = (b: number) => {
      const i = Math.max(0, Math.min(ts.length - 2, Math.floor((b - debut) / pas)));
      return long[i] + ((long[i + 1] - long[i]) * (b - ts[i])) / (ts[i + 1] - ts[i]);
    };
  for (let k = 0; k < ts.length - 1; k++) {
    if (ts[k + 1] < b1 - marge || ts[k] > b2 + marge) continue;
    const p = poses[k],
      q = poses[k + 1];
    if (!p.visible && !q.visible) continue;
    // La tranche, entre les normales de la voie à ses deux bords, un peu prolongée pour ne pas laisser de jour
    const coin = (r: Pose, a: number, h: number, avant: number): [number, number] => [
      r.x + Math.sin(a) * h * r.echelle + Math.cos(a) * avant,
      r.y - Math.cos(a) * h * r.echelle + Math.sin(a) * avant,
    ];
    g.save();
    g.beginPath();
    g.moveTo(...coin(p, dir[k], -bas, 0));
    g.lineTo(...coin(p, dir[k], haut, 0));
    g.lineTo(...coin(q, dir[k + 1], haut, 0.6));
    g.lineTo(...coin(q, dir[k + 1], -bas, 0.6));
    g.closePath();
    g.clip();
    // Le dessin, posé au milieu de la tranche, dans la direction de la voie
    const m = (ts[k] + ts[k + 1]) / 2,
      mp = sc.poser(m, voie, nb),
      um = u(m);
    g.translate(mp.x, mp.y);
    g.rotate(Math.atan2(q.y - p.y, q.x - p.x));
    g.scale(mp.echelle, mp.echelle);
    dessin((b) => u(b) - um, 0);
    g.restore();
  }
}
