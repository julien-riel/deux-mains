/* ---------- La Boîte à musique sur la scène du disque (ADR-0019, #80) ---------- */
// Le disque est un disque de boîte à musique en laiton perforé : ses fentes tournent, et un peigne d'acier, à la
// verticale du personnage, porte la ligne de jugement ; ses dents vibrent quand on joue leur anneau. Au centre, une
// petite danseuse fait des pirouettes sur son pivot. Autour, le velours du couvercle, un cône de lumière chaude, des
// étoiles phosphorescentes cousues dans le tissu et le liseré doré de la boîte.
import { S } from "../../jeu/etat";
import { clamp } from "../../outils";
import { W, H, energy, g, hh, rr } from "../outils";
import type { VueDeScene } from "./contrat";
import type { DecorDuDisque } from "./disque";

const TOUR = 2 * Math.PI;

export function boiteDisqueFond(vue: VueDeScene, d: DecorDuDisque) {
  const { hsl, pnow } = vue,
    { cx, cy, rayon } = d;
  const velours = g.createRadialGradient(cx, cy - 120, 80, cx, cy - 120, 900);
  velours.addColorStop(0, hsl(335, 45, 18));
  velours.addColorStop(0.55, hsl(335, 50, 10));
  velours.addColorStop(1, hsl(330, 55, 4));
  g.fillStyle = velours;
  g.fillRect(-12, -12, W + 24, H + 24);
  // Le cône de lumière chaude, venu d'en haut à gauche
  const cone = g.createLinearGradient(180, -40, 640, 620);
  cone.addColorStop(0, hsl(38, 100, 80, 0.14));
  cone.addColorStop(0.6, hsl(38, 100, 80, 0.04));
  cone.addColorStop(1, hsl(38, 100, 80, 0));
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(90, -60);
  g.lineTo(330, -60);
  g.lineTo(930, H);
  g.lineTo(380, H + 60);
  g.closePath();
  g.fill();
  // Les étoiles phosphorescentes cousues dans le velours brillent plus fort quand la musique s'emballe
  const e = energy();
  for (let i = 0; i < 70; i++) {
    const r = 300 + hh(i, 20) * 560,
      a = hh(i, 21) * TOUR,
      x = cx + r * Math.cos(a),
      y = cy - 120 + r * 0.62 * Math.sin(a);
    if (x < -10 || x > W + 10 || y < -10 || y > H) continue;
    const scintille = d.reduit ? 0.7 : 0.45 + 0.55 * Math.sin(pnow / 770 + hh(i, 22) * 9),
      s = 1 + hh(i, 23) * 1.6,
      al = (0.25 + 0.4 * scintille) * (1 + 0.6 * e);
    g.fillStyle = hsl(hh(i, 24) < 0.7 ? 158 : 200, 90, 82, al * 0.25);
    g.beginPath();
    g.arc(x, y, s * 3, 0, TOUR);
    g.fill();
    g.fillStyle = hsl(hh(i, 24) < 0.7 ? 158 : 200, 90, 85, Math.min(1, al));
    g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  // Le liseré doré de la boîte
  g.strokeStyle = hsl(38, 60, 64, 0.22);
  g.lineWidth = 1.2;
  rr(14, 14, W - 28, H - 28, 18);
  g.stroke();
  // Le halo chaud du disque bat au temps
  const p = vue.pulsation,
    halo = g.createRadialGradient(cx, cy, rayon - 4, cx, cy, rayon + 80 + 16 * p);
  halo.addColorStop(0, hsl(38, 100, 74, 0.28 + 0.25 * p));
  halo.addColorStop(0.4, hsl(38, 100, 74, 0.07 + 0.08 * p));
  halo.addColorStop(1, hsl(38, 100, 74, 0));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(cx, cy, rayon + 100, 0, TOUR);
  g.fill();
}

export function boiteDisqueSol(vue: VueDeScene, d: DecorDuDisque) {
  const { hsl, pnow, nb } = vue,
    { cx, rayon } = d,
    cy = d.cy + d.vac.dy,
    rot = -d.rot + d.vac.a;
  g.fillStyle = "rgba(0,0,0,.45)";
  g.beginPath();
  g.ellipse(cx + 6, cy + 14, rayon + 4, rayon + 2, 0, 0, TOUR);
  g.fill();
  // Le laiton, éclairé d'en haut à gauche
  const laiton = g.createRadialGradient(cx - 30, cy - 40 - rayon / 2, 10, cx, cy, rayon);
  laiton.addColorStop(0, hsl(40, 68, 70));
  laiton.addColorStop(0.45, hsl(38, 52, 52));
  laiton.addColorStop(0.85, hsl(35, 56, 37));
  laiton.addColorStop(1, hsl(33, 60, 27));
  g.fillStyle = laiton;
  g.beginPath();
  g.arc(cx, cy, rayon, 0, TOUR);
  g.fill();
  g.save();
  g.translate(cx, cy);
  // Les sillons gravés, concentriques
  for (const [r, a] of [
    [44, 0.45],
    [50, 0.3],
    [rayon - 18, 0.45],
    [rayon - 23, 0.3],
  ]) {
    g.strokeStyle = hsl(30, 70, 12, a);
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(0, 0, r, 0, TOUR);
    g.stroke();
  }
  g.rotate(rot);
  // Les fentes du disque perforé, piste par piste : elles tournent avec lui (seule la moitié haute se voit)
  for (let k = 0; k < 11; k++) {
    const r = 58 + k * 10.5,
      n = 22 + k * 5;
    for (let i = 0; i < n; i++) {
      if (hh(k * 131 + i, 1) < 0.38) continue;
      const a = (i / n) * TOUR + hh(k, i) * 0.05;
      if (Math.sin(a + rot) > 0.35) continue;
      const long = 3 + hh(k * 131 + i, 2) * (hh(k * 131 + i, 3) < 0.3 ? 10 : 4);
      g.save();
      g.rotate(a);
      g.translate(r, 0);
      g.fillStyle = "rgba(28,10,4,.9)";
      g.fillRect(-2.2, 0, 4.4, long);
      g.fillStyle = hsl(42, 90, 80, 0.5);
      g.fillRect(2.2, 0, 0.8, long);
      g.restore();
    }
  }
  // Les trous d'entraînement, au bord
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TOUR;
    if (Math.sin(a + rot) > 0.35) continue;
    g.save();
    g.rotate(a);
    g.translate(rayon - 9, 0);
    g.fillStyle = "rgba(24,8,2,.95)";
    g.fillRect(-2.5, -2, 5, 4);
    g.restore();
  }
  g.restore();
  // Le reflet du métal brossé, qui ne tourne pas
  const reflet = g.createLinearGradient(cx - rayon, cy - rayon, cx + rayon, cy);
  reflet.addColorStop(0, hsl(45, 100, 92, 0.22 + 0.15 * energy()));
  reflet.addColorStop(0.4, "rgba(128,128,128,0)");
  reflet.addColorStop(1, "rgba(40,20,4,.3)");
  g.fillStyle = reflet;
  g.beginPath();
  g.arc(cx, cy, rayon, 0, TOUR);
  g.fill();
  g.strokeStyle = hsl(40, 90, 85, 0.5);
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(cx, cy, rayon - 1, Math.PI * 1.05, Math.PI * 1.75);
  g.stroke();
  danseuse(cx, cy - 46, nb, d.reduit, hsl);
  peigne(vue, d, pnow);
}

/**
 * La petite danseuse, sur son pivot au centre du disque : elle fait une pirouette par mesure (plus lentement avec
 * « Mouvement réduit »), les bras en couronne.
 */
function danseuse(x: number, y: number, nb: number, reduit: boolean, hsl) {
  // Le pivot, un ressort de laiton qui sort du moyeu
  g.strokeStyle = hsl(40, 60, 62);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y + 30);
  for (let k = 0; k <= 8; k++) g.lineTo(x + (k % 2 ? 3 : -3), y + 30 - k * 3.5);
  g.lineTo(x, y);
  g.stroke();
  g.fillStyle = hsl(40, 70, 70);
  g.beginPath();
  g.ellipse(x, y + 31, 9, 3, 0, 0, TOUR);
  g.fill();
  const c = Math.cos((nb * Math.PI) / (reduit ? 8 : 2)),
    l = Math.max(0.2, Math.abs(c)),
    peau = hsl(20, 60, 90),
    tutu = hsl(345, 80, 82);
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  // La jambe d'appui, en pointe, et l'autre repliée
  g.strokeStyle = hsl(345, 60, 80);
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(0, -14);
  g.lineTo(0, 0);
  g.moveTo(0, -14);
  g.lineTo(6 * c, -9);
  g.lineTo(0.6 * c, -6);
  g.stroke();
  // Le tutu
  g.fillStyle = tutu;
  g.beginPath();
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * TOUR,
      rx = 13 + (k % 2 ? 1.6 : 0),
      ry = 4 + (k % 2 ? 0.8 : 0);
    g.lineTo(rx * Math.cos(a), -15 + ry * Math.sin(a));
  }
  g.fill();
  // Le corsage, les bras en couronne et la tête
  g.fillStyle = hsl(345, 65, 66);
  g.beginPath();
  g.moveTo(-4, -16);
  g.lineTo(4, -16);
  g.lineTo(3.4, -25);
  g.lineTo(-3.4, -25);
  g.closePath();
  g.fill();
  g.strokeStyle = peau;
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(-3 * l, -24);
  g.quadraticCurveTo(-11 * l, -32, -1.5 * l, -38.5);
  g.moveTo(3 * l, -24);
  g.quadraticCurveTo(11 * l, -32, 1.5 * l, -38.5);
  g.stroke();
  g.fillStyle = peau;
  g.beginPath();
  g.arc(0, -29, 4.2, 0, TOUR);
  g.fill();
  g.fillStyle = hsl(20, 40, 18);
  g.beginPath();
  g.arc(-0.5 * c, -33.5, 2.2, 0, TOUR);
  g.fill();
  g.restore();
}

/**
 * Le peigne d'acier, à gauche de la ligne de jugement, du côté où les notes s'en vont : une lame verticale, et ses
 * dents qui s'avancent jusqu'aux points d'impact. Les dents d'un anneau vibrent quand on vient de le jouer.
 */
function peigne(vue: VueDeScene, d: DecorDuDisque, pnow: number) {
  const { hsl } = vue,
    { cx, cy, anneaux } = d,
    lame = cx - 34,
    haut = cy - anneaux[3] - 22,
    bas = cy - anneaux[0] + 22;
  const acier = g.createLinearGradient(lame - 4, 0, lame + 4, 0);
  acier.addColorStop(0, hsl(215, 10, 42));
  acier.addColorStop(0.5, hsl(215, 30, 94));
  acier.addColorStop(1, hsl(215, 10, 46));
  // Des dents fines tout du long, et une plus forte devant chaque anneau
  for (let i = 0; i < 24; i++) {
    const y = haut + 6 + (i * (bas - haut - 12)) / 23;
    let long = 8 + (i % 3) * 3,
      vib = 0,
      force = 0.45;
    for (let k = 0; k < 4; k++) {
      if (Math.abs(cy - anneaux[k] - y) >= 5) continue;
      const fl = clamp(1 - (pnow - S.laneFlash[k]) / 400, 0, 1);
      vib = d.reduit ? 0 : Math.sin(pnow / 12) * 3 * fl;
      long = cx - lame - 13;
      force = 0.85 + 0.15 * fl;
    }
    g.strokeStyle = hsl(215, 20, 88, force);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(lame + 3, y);
    g.quadraticCurveTo(lame + 3 + long * 0.6, y + vib * 0.5, lame + 3 + long, y + vib);
    g.stroke();
  }
  g.fillStyle = acier;
  rr(lame - 3.5, haut, 7, bas - haut, 3);
  g.fill();
  g.fillStyle = hsl(40, 55, 55);
  g.fillRect(lame - 6, haut - 4, 12, 6);
  g.fillRect(lame - 6, bas - 2, 12, 5);
}
