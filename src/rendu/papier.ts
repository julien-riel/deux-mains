/* ---------- Le papier découpé (#78) ---------- */
// Les outils de l'habillage en papier découpé, communs à toutes les scènes : des toiles cuites une fois (pièces de
// papier aux bords déchirés, avec leur grain et leur ombre portée), l'encre qui bout à 12 images par seconde, et le
// papier froissé d'un raté. Rien ici ne lit la partie : on donne l'heure (`pnow`) et la place.
//
// Une toile cuite est à la résolution du canvas (jusqu'à deux pixels par pixel de la scène) : elle se recuit quand
// la fenêtre change de taille. Avec « Mouvement réduit », l'encre ne bout pas et le froissé reste près de la ligne
// de tir, sans flash plein écran.
import { clamp } from "../outils";
import { W, H, cv, g, hh, reduced } from "./outils";

export type Ctx = CanvasRenderingContext2D;
export type Point = [number, number];

/** Un générateur pseudo-aléatoire déterministe (mulberry32) : le même papier à chaque cuisson */
export function alea(graine: number) {
  let a = (graine * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Toiles cuites ---------- */
// La résolution des toiles : celle du canvas, par demi-pixel, entre 1 et 2
const resolution = () => clamp(Math.round((cv.width / W) * 2) / 2, 1, 2);
let RES = 0;
const cuits = new Map<string, unknown>();
/** Ce qui est cuit sous la clé `cle`, cuit maintenant s'il ne l'est pas encore (ou plus, à une autre résolution) */
export function cuit<T>(cle: string, cuire: () => T): T {
  const r = resolution();
  if (r !== RES) {
    cuits.clear();
    RES = r;
  }
  if (!cuits.has(cle)) cuits.set(cle, cuire());
  return cuits.get(cle) as T;
}
/** Une toile hors de l'écran de w × h pixels de la scène, à la résolution des toiles */
export function toile(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * RES));
  c.height = Math.max(1, Math.ceil(h * RES));
  const x = c.getContext("2d");
  x.scale(RES, RES);
  return [c, x];
}
/** Une ombre portée sur une toile cuite : les ombres ne suivent pas l'échelle, on les y ramène */
export function ombre(x: Ctx, dx: number, dy: number, flou: number, couleur: string) {
  x.shadowOffsetX = dx * RES;
  x.shadowOffsetY = dy * RES;
  x.shadowBlur = flou * RES;
  x.shadowColor = couleur;
}

// Le grain du papier : des points clairs et sombres, quelques fibres, et des marbrures douces
function cuireGrain() {
  const s = 256,
    c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"),
    r = alea(7),
    img = x.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = r(),
      clair = v > 0.5;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = clair ? 255 : 20;
    img.data[i * 4 + 3] = Math.pow(Math.abs(v - 0.5) * 2, 3) * 80;
  }
  x.putImageData(img, 0, 0);
  x.lineWidth = 0.7;
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = r() < 0.55 ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)";
    x.beginPath();
    let px = r() * s,
      py = r() * s;
    x.moveTo(px, py);
    for (let k = 0; k < 4; k++) x.lineTo((px += (r() - 0.5) * 22), (py += (r() - 0.5) * 22));
    x.stroke();
  }
  return c;
}
function cuireMarbrure() {
  const s = 384,
    c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d"),
    r = alea(11);
  for (let i = 0; i < 60; i++) {
    const px = r() * s,
      py = r() * s,
      rr = 20 + r() * 70,
      d = x.createRadialGradient(px, py, 0, px, py, rr),
      col = r() < 0.5 ? "255,255,255" : "0,0,0";
    d.addColorStop(0, `rgba(${col},.10)`);
    d.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = d;
    x.fillRect(0, 0, s, s);
  }
  return c;
}
const grain = () => cuit("grain", cuireGrain);
const marbrure = () => cuit("marbrure", cuireMarbrure);

/** Le grain du papier sur ce qui est déjà peint d'une toile cuite */
export function grainSur(x: Ctx, w: number, h: number, a = 0.55) {
  x.save();
  x.globalCompositeOperation = "source-atop";
  x.globalAlpha = a;
  x.fillStyle = x.createPattern(grain(), "repeat");
  x.fillRect(0, 0, w, h);
  x.globalAlpha = a * 0.9;
  x.fillStyle = x.createPattern(marbrure(), "repeat");
  x.fillRect(0, 0, w, h);
  x.restore();
}

/** Une pièce de papier cuite : son dessin (w × h), son grain, et son ombre portée dans une marge `pad` */
export interface Piece {
  c: HTMLCanvasElement;
  /** La taille de la pièce sans sa marge, et sa marge */
  w: number;
  h: number;
  pad: number;
}
export function piece(
  w: number,
  h: number,
  pad: number,
  dessin: (x: Ctx, w: number, h: number) => void,
  o: { grain?: number; ombre?: [number, number, number, string] } = {},
): Piece {
  const [a, ax] = toile(w, h);
  dessin(ax, w, h);
  if (o.grain !== 0) grainSur(ax, w, h, o.grain ?? 0.55);
  const [b, bx] = toile(w + 2 * pad, h + 2 * pad),
    [dx, dy, flou, couleur] = o.ombre ?? [3, 5, 10, "rgba(0,0,0,.42)"];
  ombre(bx, dx, dy, flou, couleur);
  bx.drawImage(a, pad, pad, w, h);
  return { c: b, w, h, pad };
}
/** Pose une pièce cuite sur la scène, son coin haut gauche (hors marge) en (x, y) */
export function poserPiece(p: Piece, x: number, y: number) {
  g.drawImage(p.c, x - p.pad, y - p.pad, p.w + 2 * p.pad, p.h + 2 * p.pad);
}

/** Un bord déchiré de (x0, y0) à (x1, y1), ajouté aux points `pts` : il zigzague de `amp` pixels, tous les `pas` */
export function dechire(
  pts: Point[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: () => number,
  amp: number,
  pas = 5,
) {
  const long = Math.hypot(x1 - x0, y1 - y0),
    n = Math.max(2, Math.floor(long / pas)),
    nx = -(y1 - y0) / long,
    ny = (x1 - x0) / long;
  let marche = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    marche = (marche + (r() - 0.5) * amp * 0.7) * 0.82;
    const j = marche + (r() - 0.5) * amp * 0.45;
    pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
  }
  return pts;
}
/** Remplit un polygone */
export function remplir(x: Ctx, pts: Point[], fond: string) {
  x.beginPath();
  x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath();
  x.fillStyle = fond;
  x.fill();
}
/** Un rectangle découpé aux ciseaux : ses coins bougent un peu */
export function rectDecoupe(
  x: Ctx,
  X: number,
  Y: number,
  w: number,
  h: number,
  r: () => number,
  fond: string,
  j = 1.4,
) {
  const c = () => (r() - 0.5) * j;
  remplir(
    x,
    [
      [X + c(), Y + c()],
      [X + w + c(), Y + c()],
      [X + w + c(), Y + h + c()],
      [X + c(), Y + h + c()],
    ],
    fond,
  );
}

/* ---------- L'encre qui bout ---------- */
/** L'image de l'encre : elle change 12 fois par seconde ; jamais avec « Mouvement réduit » */
export const bouillon = (pnow: number) => (reduced ? 0 : Math.floor(pnow * 0.012));
/** Un tremblement de -1 à 1, propre à `graine`, qui change à chaque image de l'encre */
export const tremble = (graine: number, image: number) => hh(Math.round(graine * 7.31), image) * 2 - 1;

/**
 * Trace sur la scène le contour à l'encre d'un polygone, dont chaque sommet tremble de `amp` pixels à l'image `image`
 * de l'encre ; `ferme` le referme.
 */
export function encre(pts: Point[], graine: number, image: number, amp = 1, ferme = true) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const X = x + tremble(graine + i, image) * amp,
      Y = y + tremble(graine + i + 57, image) * amp;
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  });
  if (ferme) g.closePath();
}
/** Trace une tache ronde à l'encre, de rayons rx et ry, dont le bord tremble */
export function tache(cx: number, cy: number, rx: number, ry: number, graine: number, image: number, amp = 1) {
  const n = 12,
    q: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    q.push([
      cx + Math.cos(a) * rx + tremble(graine + i, image) * amp,
      cy + Math.sin(a) * ry + tremble(graine + i + 31, image) * amp,
    ]);
  }
  const milieu = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = milieu(q[n - 1], q[0]);
  g.beginPath();
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = milieu(q[i], q[(i + 1) % n]);
    g.quadraticCurveTo(q[i][0], q[i][1], m[0], m[1]);
  }
  g.closePath();
}
/**
 * Peint le chemin tracé comme une pièce de papier : son ombre portée (le chemin décalé, en sombre, sans flou : c'est
 * bon marché), son aplat, puis son contour à l'encre s'il en a un.
 */
export function papier(fond: string, ink: string | null, lw = 2, ombreAussi = true) {
  if (ombreAussi) {
    g.save();
    g.translate(2, 3);
    g.fillStyle = "rgba(0,0,0,.3)";
    g.fill();
    g.restore();
  }
  g.fillStyle = fond;
  g.fill();
  if (ink) {
    g.lineWidth = lw;
    g.strokeStyle = ink;
    g.lineJoin = "round";
    g.stroke();
  }
}

/* ---------- Le froissé d'un raté ---------- */
// Une feuille froissée : des facettes claires et sombres, et quelques plis
function cuireFroisse() {
  const [c, x] = toile(640, 360),
    r = alea(31),
    nx = 11,
    ny = 7,
    P: Point[] = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const bord = i === 0 || j === 0 || i === nx || j === ny;
      P.push([(i * 640) / nx + (bord ? 0 : (r() - 0.5) * 50), (j * 360) / ny + (bord ? 0 : (r() - 0.5) * 44)]);
    }
  const facette = (a: Point, b: Point, d: Point) => {
    const v = r();
    remplir(x, [a, b, d], v < 0.5 ? `rgba(255,250,240,${0.05 + v * 0.22})` : `rgba(10,5,20,${(v - 0.5) * 0.36})`);
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = P[j * (nx + 1) + i],
        b = P[j * (nx + 1) + i + 1],
        d = P[(j + 1) * (nx + 1) + i],
        e = P[(j + 1) * (nx + 1) + i + 1];
      if (r() < 0.5) {
        facette(a, b, e);
        facette(a, e, d);
      } else {
        facette(a, b, d);
        facette(b, e, d);
      }
    }
  for (let k = 0; k < 26; k++) {
    const a = P[Math.floor(r() * P.length)],
      b = P[Math.floor(r() * P.length)];
    x.lineWidth = 1.2;
    x.strokeStyle = "rgba(0,0,0,.22)";
    x.beginPath();
    x.moveTo(a[0], a[1]);
    x.lineTo(b[0], b[1]);
    x.stroke();
    x.strokeStyle = "rgba(255,255,255,.3)";
    x.beginPath();
    x.moveTo(a[0] + 1.2, a[1] + 1.2);
    x.lineTo(b[0] + 1.2, b[1] + 1.2);
    x.stroke();
  }
  return c;
}
/** Le dernier froissé : son heure, et où il a déchiré la feuille */
const froisse = { at: -1e9, x: 0, y: 0 };
/** Un raté froisse le papier autour de (x, y) */
export function froisser(x: number, y: number, pnow: number) {
  Object.assign(froisse, { at: pnow, x, y });
}
const DUREE_FROISSE = 600;
/**
 * Le froissé du dernier raté, par-dessus la scène et sous le HUD : la feuille se plisse et se déchire près du raté,
 * puis se défroisse en 0,6 s. Avec « Mouvement réduit », il reste dans un cadre autour du raté, plus pâle.
 */
export function dessinerFroisse(pnow: number) {
  const t = pnow - froisse.at;
  if (t < 0 || t >= DUREE_FROISSE) return;
  const k = clamp(t < 80 ? t / 80 : 1 - (t - 80) / (DUREE_FROISSE - 80), 0, 1),
    texture = cuit("froisse", cuireFroisse);
  g.save();
  if (reduced) {
    g.beginPath();
    g.rect(froisse.x - 160, froisse.y - 160, 420, 320);
    g.clip();
  }
  g.globalAlpha = k * (reduced ? 0.45 : 0.85);
  g.globalCompositeOperation = "overlay";
  g.drawImage(texture, 0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = k * 0.45;
  g.drawImage(texture, 0, 0, W, H);
  // La déchirure, à côté du raté
  g.globalAlpha = k;
  const pts = dechire(
    [],
    froisse.x + 40,
    froisse.y - 150,
    froisse.x + 70,
    froisse.y + 150,
    alea(Math.floor(froisse.at)),
    16,
    10,
  );
  for (const [couleur, lw, dx] of [
    ["rgba(20,10,20,.55)", 7, 0],
    ["#f5eedd", 2.5, -3],
  ] as const) {
    g.strokeStyle = couleur;
    g.lineWidth = lw * k;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y)));
    g.stroke();
  }
  g.restore();
}

/** La fibre du papier sur toute la scène, très légère : le jeu entier a l'air imprimé sur une feuille */
export function fibre() {
  g.save();
  g.globalAlpha = 0.16;
  g.globalCompositeOperation = "overlay";
  g.fillStyle = g.createPattern(grain(), "repeat");
  g.fillRect(0, 0, W, H);
  g.restore();
}
