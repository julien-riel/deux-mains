/* ---------- La Ville Muette sur la scène du disque (ADR-0019, #80) ---------- */
// Le disque est une planète-quartier : des pâtés de maisons en anneaux, un parc au centre, un périphérique au bord,
// et des immeubles tout autour, dont les fenêtres se rallument avec le combo, comme dans la scène de côté. Autour,
// un ciel de nuit dont les étoiles tournent lentement, une lune imprimée en risographie, et l'antenne de la radio
// pirate, à la verticale du personnage, qui porte la ligne de jugement.
import { S, progression } from "../../jeu/etat";
import { lieuxReussis } from "../../sauvegarde/format";
import { W, H, energy, g, hh } from "../outils";
import type { VueDeScene } from "./contrat";
import type { DecorDuDisque } from "./disque";

const TOUR = 2 * Math.PI;

/** Les immeubles du bord de la planète : leur angle sur le disque, leur largeur et leur hauteur, en pixels */
const IMMEUBLES: { angle: number; l: number; h: number }[] = [];
for (let a = 0, k = 0; a < TOUR - 0.05; k++) {
  const l = 12 + hh(k, 1) * 14,
    h = hh(k, 2) < 0.18 ? 34 + hh(k, 3) * 12 : 12 + hh(k, 3) * 18;
  IMMEUBLES.push({ angle: a + l / 2 / 200, l, h });
  a += (l + 2 + hh(k, 4) * 7) / 200;
}

/** La part des fenêtres allumées : celles des quartiers déjà rallumés (#25), et le combo qui réveille les autres */
function allumees() {
  const veille = 0.08 + 0.05 * lieuxReussis(progression(), "ville").length;
  return Math.min(0.95, veille + (0.85 - veille) * energy());
}

export function villeDisqueFond(vue: VueDeScene, d: DecorDuDisque) {
  const { hsl, pnow } = vue,
    { cx, cy, rayon } = d;
  const ciel = g.createRadialGradient(cx, cy, rayon, cx, cy, 900);
  ciel.addColorStop(0, hsl(270, 45, 22));
  ciel.addColorStop(0.35, hsl(250, 45, 12));
  ciel.addColorStop(1, hsl(245, 50, 5));
  g.fillStyle = ciel;
  g.fillRect(-12, -12, W + 24, H + 24);
  // Les étoiles tournent lentement autour de la planète
  const derive = d.reduit ? 0 : d.rot * 0.08;
  for (let i = 0; i < 150; i++) {
    const r = 230 + Math.pow(hh(i, 10), 0.7) * 800,
      a = hh(i, 11) * TOUR - derive,
      x = cx + r * Math.cos(a),
      y = cy + r * Math.sin(a);
    if (x < -4 || x > W + 4 || y < -4 || y > H) continue;
    const scintille = d.reduit ? 0.7 : 0.5 + 0.5 * Math.sin(pnow / 500 + hh(i, 12) * 9),
      s = 1 + hh(i, 13) * 1.4;
    g.fillStyle = hsl(230, 60, 92, (0.25 + 0.5 * scintille) * (vue.solo ? 1.3 : 1));
    g.fillRect(x, y, s, s);
  }
  // Lune imprimée en risographie : deux passages d'encre légèrement décalés
  g.globalAlpha = 0.45;
  g.beginPath();
  g.arc(300, 200, 44, 0, TOUR);
  g.fillStyle = hsl(330, 90, 66);
  g.fill();
  g.globalAlpha = 0.3;
  g.beginPath();
  g.arc(306, 195, 44, 0, TOUR);
  g.fillStyle = hsl(50, 95, 65);
  g.fill();
  g.globalAlpha = 1;
  // Le halo de la planète bat au temps
  const p = vue.pulsation,
    halo = g.createRadialGradient(cx, cy, rayon - 4, cx, cy, rayon + 80 + 16 * p);
  halo.addColorStop(0, hsl(245, 80, 70, 0.3 + 0.25 * p));
  halo.addColorStop(0.4, hsl(245, 80, 70, 0.08 + 0.08 * p));
  halo.addColorStop(1, hsl(245, 80, 70, 0));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(cx, cy, rayon + 100, 0, TOUR);
  g.fill();
  // L'antenne de la radio pirate : un faisceau à la verticale du personnage, qui porte la ligne de jugement
  const haut = cy - d.anneaux[3] - 26,
    bas = cy - rayon - 78,
    faisceau = g.createLinearGradient(0, haut, 0, bas);
  faisceau.addColorStop(0, hsl(230, 90, 75, 0));
  faisceau.addColorStop(0.15, hsl(230, 90, 75, 0.5));
  faisceau.addColorStop(1, hsl(230, 90, 75, 0.2));
  g.fillStyle = hsl(230, 90, 70, 0.06);
  g.fillRect(cx - 16, haut, 32, bas - haut);
  g.fillStyle = faisceau;
  g.fillRect(cx - 1, haut, 2, bas - haut);
  g.fillStyle = hsl(350, 90, 65, 0.6 + 0.4 * (d.reduit ? 1 : Math.sin(pnow / 250)));
  g.beginPath();
  g.arc(cx, haut - 3, 3, 0, TOUR);
  g.fill();
}

export function villeDisqueSol(vue: VueDeScene, d: DecorDuDisque) {
  const { hsl } = vue,
    { cx, rayon } = d,
    cy = d.cy + d.vac.dy,
    rot = -d.rot + d.vac.a,
    lit = allumees(),
    vacille = S.mode === "play" && S.health < 40;
  // L'ombre portée, puis la planète, qui tourne
  g.fillStyle = "rgba(0,0,0,.4)";
  g.beginPath();
  g.ellipse(cx + 6, cy + 12, rayon + 4, rayon + 2, 0, 0, TOUR);
  g.fill();
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const sol = g.createRadialGradient(0, 0, 0, 0, 0, rayon);
  sol.addColorStop(0, hsl(240, 40, 22));
  sol.addColorStop(0.8, hsl(240, 42, 17));
  sol.addColorStop(1, hsl(240, 45, 10));
  g.fillStyle = sol;
  g.beginPath();
  g.arc(0, 0, rayon, 0, TOUR);
  g.fill();
  // Les pâtés de maisons, en trois anneaux de rues, et leurs fenêtres
  for (const [r1, r2, n, k0] of [
    [52, 86, 9, 0],
    [92, 128, 13, 20],
    [134, 170, 17, 40],
  ]) {
    for (let i = 0; i < n; i++) {
      const a1 = (i / n) * TOUR + 0.035,
        a2 = ((i + 1) / n) * TOUR - 0.035;
      g.fillStyle = hsl(242, 38, 19 + 4 * hh(k0 + i, 5));
      g.beginPath();
      g.arc(0, 0, r2, a1, a2);
      g.arc(0, 0, r1, a2, a1, true);
      g.closePath();
      g.fill();
      for (let j = 0; j < 5; j++) {
        if (hh(k0 + i, 30 + j) >= lit) continue;
        const a = a1 + (a2 - a1) * hh(k0 + i, 40 + j),
          r = r1 + 4 + (r2 - r1 - 8) * hh(k0 + i, 50 + j);
        g.fillStyle = hh(k0 + i, 60 + j) < 0.8 ? hsl(45, 90, 68, 0.85) : hsl(190, 90, 72, 0.85);
        g.fillRect(r * Math.cos(a) - 1.5, r * Math.sin(a) - 1.5, 3, 3);
      }
    }
  }
  // Le parc au centre
  g.fillStyle = hsl(150, 45, 22);
  g.beginPath();
  g.arc(0, 0, 44, 0, TOUR);
  g.fill();
  // Le périphérique, au bord
  g.strokeStyle = hsl(240, 25, 18);
  g.lineWidth = 12;
  g.beginPath();
  g.arc(0, 0, rayon - 8, 0, TOUR);
  g.stroke();
  g.strokeStyle = hsl(45, 80, 60, 0.35 + 0.4 * lit);
  g.lineWidth = 1.2;
  g.setLineDash([6, 7]);
  g.stroke();
  g.setLineDash([]);
  // Les immeubles du bord : seuls ceux de la moitié haute se voient
  for (const [k, b] of IMMEUBLES.entries()) {
    const th = b.angle + rot;
    if (Math.sin(th) > 0.3) continue;
    g.save();
    g.rotate(b.angle);
    g.translate(rayon - 2, 0);
    g.rotate(Math.PI / 2);
    g.fillStyle = hsl(245, 32, 15 + 6 * hh(k, 6));
    g.fillRect(-b.l / 2, -b.h, b.l, b.h + 2);
    g.fillStyle = hsl(240, 60, 70, 0.15);
    g.fillRect(-b.l / 2, -b.h, 1, b.h);
    // Les fenêtres se rallument avec le combo ; quand l'harmonie est basse, elles clignotent
    for (let wy = -b.h + 4, r = 0; wy < -5; wy += 7, r++)
      for (let wx = -b.l / 2 + 3, c = 0; wx < b.l / 2 - 4; wx += 5, c++) {
        const allumee = hh(k * 97 + r * 7 + c, 70) < lit && !(vacille && Math.random() < 0.3);
        g.fillStyle = allumee ? hsl(45, 90, 68, 0.9) : "rgba(8,10,28,.6)";
        g.fillRect(wx, wy, 2.4, 3.2);
      }
    g.restore();
  }
  g.restore();
  // L'atmosphère, qui ne tourne pas : un reflet en haut à gauche, l'ombre en bas
  const atmo = g.createRadialGradient(cx - rayon * 0.35, cy - rayon * 0.45, 10, cx, cy, rayon);
  atmo.addColorStop(0, hsl(230, 80, 80, 0.16));
  atmo.addColorStop(0.7, "rgba(0,0,0,0)");
  atmo.addColorStop(1, "rgba(0,0,20,.45)");
  g.fillStyle = atmo;
  g.beginPath();
  g.arc(cx, cy, rayon, 0, TOUR);
  g.fill();
}
