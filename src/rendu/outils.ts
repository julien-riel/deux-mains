/* ---------- Outils de dessin ---------- */
import { S, auRepos } from "../jeu/etat";
import { clamp } from "../outils";

export const cv = document.querySelector<HTMLCanvasElement>("#game"),
  g = cv.getContext("2d");

export const W = 1200,
  H = 620;
export const GY = 505,
  PX = 210,
  PW = 38,
  PH = 68,
  HITX = 300,
  PPB = 150;
export const LANE_Y = [395, 315, 235, 155];
export const LANE_HUE = [198, 262, 320, 168];
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
