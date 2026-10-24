/* ---------- Outils de dessin ---------- */
import { S, auRepos } from "../jeu/etat";
import { COULEUR_BASSE } from "../jeu/traces";
import { clamp } from "../outils";
import type { Pose } from "./scenes/contrat";

export const cv = document.querySelector<HTMLCanvasElement>("#game"),
  g = cv.getContext("2d");

/** L'espace de la scène, en pixels : le rendu le ramène dans son cadre à l'écran (`src/rendu/geometrie.ts`) */
export const W = 1200,
  H = 620;
/** La largeur et la hauteur du personnage, debout */
export const PW = 38,
  PH = 68;
/** Une palette : la teinte, la saturation et la luminosité d'une couleur, désaturée pour une silhouette */
export type Palette = (h: number, s: number, l: number, a?: number) => string;
/**
 * Le dessin d'un ennemi de la mélodie, centré en (x, y) : `ev` sa note (`kind === "refrain"` le grossit, `beat`
 * décale son animation), `col` la couleur de sa note, `a` son opacité, `nb` le temps de la chanson, `m` la menace
 * (de 0 à 1) qui monte à l'approche de la ligne de tir, `echelle` et `angle` ceux de sa pose dans la scène
 * (ADR-0019) : il grossit et tourne avec son couloir. Il vise le joueur là où la scène le place. Chaque lieu a le
 * sien, dans chaque univers.
 */
export type DessinEnnemi = (
  x: number,
  y: number,
  ev: { kind: string; beat: number },
  col: string,
  a: number,
  nb: number,
  hsl: Palette,
  m?: number,
  echelle?: number,
  angle?: number,
) => void;
/** Un ennemi raté plonge sur le joueur : il le frappe au bout de `PLONGEE` ms, à hauteur de poitrine, `POITRINE`
 * pixels au-dessus de ses pieds */
export const PLONGEE = 260,
  POITRINE = 44;
/** La pose d'un boss de fin (#26) pour son dessin : la note qu'il joue (de 0 à 1), le coup qu'il vient de recevoir
 * (de 0 à 1), sa phase (1 à 3), s'il est tombé, son opacité, l'heure en secondes et son inclinaison en radians */
export interface PoseDuBoss {
  ouvert: number;
  touche: number;
  phase: number;
  vaincu: boolean;
  a: number;
  t: number;
  rot: number;
}
export const LANE_HUE = [198, 262, 320, 168];
/** La teinte d'un couloir, ou du milieu de deux couloirs pour une petite note (#14, n + 0,5) */
export const teinteDeCouloir = (l: number) =>
  Number.isInteger(l) ? LANE_HUE[l] : (LANE_HUE[l - 0.5] + LANE_HUE[l + 0.5]) / 2;
export const HUE_BASS = 28,
  HUE_MEL = 198;

export const DEG = ["FONDAMENTALE", "TIERCE", "QUINTE", "OCTAVE"];
// Chaque couloir a sa forme, la même dans les deux univers (ADR-0006) : on le reconnaît sans sa couleur (#31)
export const FORMES = ["rond", "triangle", "carré", "losange"] as const;

export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const css = getComputedStyle(document.documentElement);
export const tok = (n) => css.getPropertyValue(n).trim();
export const COL: Record<string, string> = {};
["fg", "muted", "line", "panel", "ink", "sky1", "sky2", "ground", "bad", "good", "bass", "mel"].forEach(
  (k) => (COL[k] = tok("--" + k)),
);
export const FONT = { display: tok("--display"), body: tok("--body"), mono: tok("--mono") };

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function popup(text, x, y, color) {
  S.pops.push({ text, x, y, color, at: performance.now() });
}
export function burst(x, y, hue, n) {
  if (reduced) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2,
      v = 80 + Math.random() * 200;
    S.parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: 0.45 + Math.random() * 0.35,
      hue,
      size: 2 + Math.random() * 3,
    });
  }
}

export function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
// Trace la forme du couloir i, centrée en (x, y), de la taille d'un rond de rayon r ; sans le réglage, un rond
export function formeCouloir(i, x, y, r) {
  const forme = S.formes ? FORMES[i] : "rond";
  g.beginPath();
  if (forme === "rond") g.arc(x, y, r, 0, Math.PI * 2);
  else if (forme === "carré") {
    const c = r * 0.88;
    g.rect(x - c, y - c, 2 * c, 2 * c);
  } else {
    // Triangle pointe en haut, losange : des polygones réguliers un peu plus grands pour peser autant que le rond
    const n = forme === "triangle" ? 3 : 4,
      R = r * (n === 3 ? 1.35 : 1.25);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / n;
      g.lineTo(x + R * Math.cos(a), y + R * Math.sin(a) + (n === 3 ? R * 0.15 : 0));
    }
    g.closePath();
  }
}
export function txt(s, x, y, font, color, align: CanvasTextAlign = "left") {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.fillText(s, x, y);
}

// Hachage déterministe : le décor est toujours le même pour un même endroit de la chanson
export function hh(a, b = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Énergie de la scène : monte avec le combo, retombe quand l'harmonie baisse
export const energy = () => (auRepos() ? 0.35 : clamp(S.combo / 35, 0, 1) * (S.health >= 50 ? 1 : 0.35));

/** La teinte d'une trace : celle de son couloir, ou l'ambre de la basse (ADR-0006) */
export const teinteDeTrace = (couleur: number) => (couleur === COULEUR_BASSE ? HUE_BASS : LANE_HUE[couleur]);

/**
 * Dessine une chose à sa pose dans la scène (ADR-0019) : `dessin(x, y)` la dessine à sa taille de référence,
 * debout, autour de (x, y), et peut renvoyer un point de son dessin. Debout et à sa taille (la scène de côté), elle
 * est dessinée directement à sa place ; sinon le repère est déplacé sur la pose, tourné de son angle et mis à son
 * échelle, et elle est dessinée autour de l'origine (`versLEcran` ramène ses points à l'écran).
 */
export function aLaPose<T>(p: Pose, dessin: (x: number, y: number) => T): T {
  if (p.echelle === 1 && p.angle === 0) return dessin(p.x, p.y);
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.angle);
  g.scale(p.echelle, p.echelle);
  try {
    return dessin(0, 0);
  } finally {
    g.restore();
  }
}
/** Un point (x, y) d'un dessin fait à la pose `p` (`aLaPose`), ramené dans l'espace de la scène */
export function versLEcran(p: Pose, x: number, y: number): [number, number] {
  if (p.echelle === 1 && p.angle === 0) return [x, y];
  const c = Math.cos(p.angle) * p.echelle,
    s = Math.sin(p.angle) * p.echelle;
  return [p.x + c * x - s * y, p.y + s * x + c * y];
}
/** Un écart (dx, dy) pris dans le repère d'une pose, à son échelle et à son angle, ramené dans l'espace de la scène */
export function ecartALaPose(p: Pose, dx: number, dy: number): [number, number] {
  if (p.echelle === 1 && p.angle === 0) return [dx, dy];
  const c = Math.cos(p.angle) * p.echelle,
    s = Math.sin(p.angle) * p.echelle;
  return [c * dx - s * dy, s * dx + c * dy];
}
