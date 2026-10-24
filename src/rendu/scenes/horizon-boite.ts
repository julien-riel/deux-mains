/* ---------- La Boîte à musique, vers l'horizon (ADR-0019, #82) ---------- */
// Un orgue de Barbarie : la route est le carton perforé qui file vers le cylindre, sur l'horizon, plié en
// accordéon à chaque mesure et percé de trous d'entraînement à chaque temps, entre deux rails de laiton. La mélodie
// arrive par quatre tiges de laiton, des engrenages tournent de chaque côté, des rideaux de velours encadrent la
// scène. Chaque note parfaite (#29) laisse au ciel une étoile qui y reste. Le personnage, un automate à remonter,
// est vu de dos.
import { clamp } from "../../outils";
import { COL, FONT, H, LANE_HUE, W, energy, g, hexA, hh, reduced, teinteDeTrace, txt } from "../outils";
import type { GesteDuPersonnage, VueDeScene } from "./contrat";
import { lignesDeVitesse } from "./horizon";
import { AVANCE, RAILS, ROUTE, SOL, VPX, VPY, projeter, tracesVues } from "./perspective";

const P = (x: number, y: number, dz: number) => projeter(x, SOL - y, dz);
const S_BAS = (H - VPY) / SOL;
const fondu = (dz: number, a: number, b: number) => clamp(1 - (dz - a) / (b - a), 0, 1);

export function fondBoite(vue: VueDeScene) {
  const { nb, hsl } = vue,
    e = energy();
  ciel(vue, e);
  carton(vue, e);
  // Les engrenages, deux par temps et demi de chaque côté, puis les poteaux de laiton, du plus loin au plus proche
  const plans: [number, () => void][] = [];
  for (let n = Math.floor((nb + AVANCE + 2) / 0.9); n >= Math.floor((nb - 0.4) / 0.9); n--)
    for (const cote of [-1, 1]) {
      const dz = n * 0.9 + (cote > 0 ? 0.45 : 0) - nb;
      if (dz >= -0.3) plans.push([dz, () => engrenage(cote, n, dz, nb, hsl, e)]);
    }
  for (let k = Math.floor(nb + AVANCE + 2); k >= Math.floor(nb - 0.3); k--) {
    const dz = k - nb;
    if (dz >= 0.12) for (const cote of [-1, 1]) plans.push([dz - 0.01, () => poteau(cote, dz, hsl)]);
  }
  plans.sort((a, b) => b[0] - a[0]);
  for (const [, dessiner] of plans) dessiner();
  tiges(vue);
}

export function solBoite(vue: VueDeScene) {
  const { nb, hsl } = vue;
  // Le nom de l'accord à la pliure de chaque mesure, imprimé au bord du carton
  for (let bar = Math.max(0, Math.floor(nb / 4)); bar * 4 < nb + AVANCE && bar < vue.fin; bar++) {
    const dz = bar * 4 - nb;
    if (dz < -0.15) continue;
    const [x, y, s] = P(-ROUTE - 22, 0, dz),
      c = vue.accord(bar),
      taille = Math.round(32 * s);
    if (taille >= 7)
      txt(c.name, x, y, `italic 700 ${taille}px ${FONT.display}`, hsl(c.hue, 70, 75, fondu(dz, 2.5, AVANCE)), "right");
  }
  // Les triolets de la basse en 3 contre 2 (#19) : deux trous de plus au bord du carton, dans le temps
  for (let b = Math.ceil(nb - 0.5); b < nb + AVANCE; b++) {
    if (!vue.polyrythmie(b)) continue;
    for (const k of [1, 2]) {
      const dz = b + k / 3 - nb;
      if (dz < -0.1) continue;
      for (const cote of [-1, 1]) {
        const [x, y, s] = P(cote * (ROUTE - 26), 0, dz);
        g.fillStyle = hexA(COL.bass, 0.8 * fondu(dz, 2, AVANCE));
        g.beginPath();
        g.ellipse(x, y, 7 * s, 3 * s + 0.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.lineCap = "round";
  for (const [x1, y1, x2, y2, a] of lignesDeVitesse(nb)) {
    g.strokeStyle = hsl(40, 100, 78, a);
    g.lineWidth = 1.2 + (Math.hypot(x1 - VPX, y1 - VPY) / 900) * 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  rideaux(vue);
}

function ciel(vue: VueDeScene, e: number) {
  const { nb, hsl, pulsation: bp, pnow } = vue;
  const velours = g.createLinearGradient(0, 0, 0, VPY);
  velours.addColorStop(0, hsl(342, 65, 4));
  velours.addColorStop(0.6, hsl(345, 68, 12));
  velours.addColorStop(1, hsl(20, 62, 36));
  g.fillStyle = velours;
  g.fillRect(-12, -12, W + 24, VPY + 14);
  // Les plis du velours
  for (let x = 0; x < W; x += 46) {
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.fillRect(x, 0, 16, VPY - 40);
    g.fillStyle = hsl(0, 80, 70, 0.03);
    g.fillRect(x + 22, 0, 10, VPY - 40);
  }
  // La lueur chaude du cylindre, sur l'horizon
  const halo = g.createRadialGradient(VPX, VPY - 30, 0, VPX, VPY - 30, 480);
  halo.addColorStop(0, hsl(28, 100, 64, 0.32 + 0.08 * bp + 0.1 * e));
  halo.addColorStop(1, hsl(28, 100, 64, 0));
  g.fillStyle = halo;
  g.fillRect(VPX - 480, VPY - 510, 960, 540);
  // Les étoiles des notes parfaites (#29) : chacune reste au ciel, à sa place, à la couleur de son couloir ; celle
  // qu'on vient d'allumer brille plus fort pendant un temps
  for (const { t, couleur, frais } of tracesVues(nb)) {
    const x = 130 + hh(t, 81) * 940,
      y = 102 + hh(t, 82) * 104,
      r = (1.4 + hh(t, 83) * 1.4) * (1 + 1.2 * frais),
      teinte = teinteDeTrace(couleur),
      luit = reduced ? 1 : 0.75 + 0.25 * Math.sin(pnow / 500 + t),
      lueur = g.createRadialGradient(x, y, 0, x, y, r * 7);
    lueur.addColorStop(0, hsl(teinte, 80, 75, (0.35 + 0.5 * frais) * luit));
    lueur.addColorStop(1, hsl(teinte, 80, 75, 0));
    g.fillStyle = lueur;
    g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    g.fillStyle = hsl(teinte, 70, 85, luit);
    g.beginPath();
    g.moveTo(x, y - r * 3);
    g.quadraticCurveTo(x, y, x + r * 3, y);
    g.quadraticCurveTo(x, y, x, y + r * 3);
    g.quadraticCurveTo(x, y, x - r * 3, y);
    g.quadraticCurveTo(x, y, x, y - r * 3);
    g.fill();
  }
  cylindre(nb, hsl, bp, e);
  const brume = g.createLinearGradient(0, VPY - 50, 0, VPY + 30);
  brume.addColorStop(0, hsl(28, 100, 64, 0));
  brume.addColorStop(0.7, hsl(28, 100, 64, 0.3));
  brume.addColorStop(1, hsl(28, 100, 64, 0));
  g.fillStyle = brume;
  g.fillRect(-12, VPY - 50, W + 24, 80);
}

// Le cylindre à picots, sur l'horizon, et son peigne d'acier : la lame qui sonne vibre au temps
function cylindre(nb: number, hsl, bp: number, e: number) {
  const cx = VPX,
    cy = VPY - 26,
    w = 230,
    h = 40;
  g.fillStyle = hsl(28, 35, 16);
  g.fillRect(cx - w / 2 - 10, cy - h / 2 - 32, w + 20, 11);
  for (let i = 0; i < 18; i++) {
    const x = cx - w / 2 + 8 + i * ((w - 16) / 17),
      sonne = clamp(1 - ((((nb - i * 0.13) % 1) + 1) % 1) * 4, 0, 1),
      vib = reduced ? 0 : Math.sin(nb * 40 + i) * sonne * 1.2;
    g.fillStyle = hsl(36, 12, 70 + 15 * sonne);
    g.fillRect(x - 2 + vib, cy - h / 2 - 21, 4, 20 - (i % 5) * 2);
  }
  const corps = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  corps.addColorStop(0, hsl(34, 60, 22));
  corps.addColorStop(0.3, hsl(38, 60, 62));
  corps.addColorStop(0.45, hsl(42, 75, 80));
  corps.addColorStop(0.7, hsl(34, 60, 44));
  corps.addColorStop(1, hsl(30, 70, 13));
  g.fillStyle = corps;
  g.fillRect(cx - w / 2, cy - h / 2, w, h);
  // Les picots, qui tournent avec la chanson
  const rot = nb * 0.9;
  g.fillStyle = hsl(45, 100, 92, 0.85);
  for (let i = 0; i < 40; i++) {
    const th = i * 0.61 + rot * 2.2,
      c = Math.cos(th);
    if (c < 0.2) continue;
    g.fillRect(
      cx - w / 2 + 8 + ((i * 37) % 40) * ((w - 16) / 40) - 1.2,
      cy + Math.sin(th) * (h / 2 - 3) - 1.2,
      2.6,
      2.6,
    );
  }
  for (const s of [-1, 1]) {
    g.fillStyle = hsl(36, 70, 40);
    g.beginPath();
    g.ellipse(cx + (s * w) / 2, cy, 12, h / 2 + 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  const lueur = g.createRadialGradient(cx, cy, 0, cx, cy, 190);
  lueur.addColorStop(0, hsl(38, 100, 72, 0.12 + 0.16 * bp + 0.08 * e));
  lueur.addColorStop(1, hsl(38, 100, 72, 0));
  g.fillStyle = lueur;
  g.fillRect(cx - 190, cy - 190, 380, 380);
}

// Le carton perforé : plié à chaque mesure, un panneau sur deux plus sombre, percé de trous d'entraînement à chaque
// temps, entre deux rails de laiton
function carton(vue: VueDeScene, e: number) {
  const { nb, hsl, pulsation: bp } = vue;
  const plancher = g.createLinearGradient(0, VPY, 0, H);
  plancher.addColorStop(0, hsl(355, 55, 18));
  plancher.addColorStop(0.2, hsl(350, 60, 9));
  plancher.addColorStop(1, hsl(345, 60, 4));
  g.fillStyle = plancher;
  g.fillRect(-12, VPY, W + 24, H - VPY + 12);
  const bas = ROUTE * S_BAS,
    bande = () => {
      g.beginPath();
      g.moveTo(VPX - 1, VPY);
      g.lineTo(VPX + 1, VPY);
      g.lineTo(VPX + bas, H);
      g.lineTo(VPX - bas, H);
      g.closePath();
    };
  bande();
  const papier = g.createLinearGradient(0, VPY, 0, H);
  papier.addColorStop(0, hsl(24, 50, 27));
  papier.addColorStop(0.2, hsl(30, 40, 44));
  papier.addColorStop(1, hsl(36, 40, 60 + 8 * e));
  g.fillStyle = papier;
  g.fill();
  g.save();
  g.clip();
  // L'accordéon : un panneau de deux temps sur deux, plus sombre
  for (let b = Math.floor(nb / 2) * 2; b < nb + AVANCE + 2; b += 2) {
    if (Math.round(b / 2) % 2) continue;
    const [, y1, s1] = P(0, 0, Math.max(b - nb, -0.3)),
      [, y2, s2] = P(0, 0, b + 2 - nb);
    g.fillStyle = "rgba(70,30,10,0.13)";
    g.beginPath();
    g.moveTo(VPX - ROUTE * s1, y1);
    g.lineTo(VPX + ROUTE * s1, y1);
    g.lineTo(VPX + ROUTE * s2, y2);
    g.lineTo(VPX - ROUTE * s2, y2);
    g.closePath();
    g.fill();
  }
  // Les plis de chaque mesure, et les trous d'entraînement de chaque temps
  for (let c = Math.ceil((nb - 0.45) * 2); c / 2 < nb + AVANCE + 1; c++) {
    const dz = c / 2 - nb,
      [, y, s] = P(0, 0, dz);
    if (y > H + 6) continue;
    const f = clamp((s - 0.03) / 0.22, 0, 1),
      l = ROUTE * s;
    if (c % 8 === 0) {
      g.fillStyle = `rgba(90,54,24,${(0.55 * f).toFixed(3)})`;
      g.fillRect(VPX - l, y - 1.2 * s, 2 * l, Math.max(1, 2.5 * s));
      g.fillStyle = `rgba(255,240,200,${(0.5 * f).toFixed(3)})`;
      g.fillRect(VPX - l, y + 1.5 * s, 2 * l, Math.max(1, 1.2 * s));
    }
    if (c % 2) continue;
    const [, y2, s2] = P(0, 0, dz + 0.07);
    g.fillStyle = `rgba(40,6,12,${(0.85 * f).toFixed(3)})`;
    g.beginPath();
    for (const cote of [-1, 1]) {
      const xa = VPX + cote * (ROUTE - 26) * s,
        xb = VPX + cote * (ROUTE - 26) * s2;
      g.moveTo(xa - 9 * s, y);
      g.lineTo(xa + 9 * s, y);
      g.lineTo(xb + 9 * s2, y2);
      g.lineTo(xb - 9 * s2, y2);
      g.closePath();
    }
    g.fill();
  }
  // Les lignes imprimées du carton, une par degré, aux couleurs des couloirs
  g.lineWidth = 1;
  for (let d = 0; d < 4; d++) {
    g.strokeStyle = hsl(LANE_HUE[d], 40, 30, 0.35);
    g.beginPath();
    g.moveTo(VPX, VPY);
    g.lineTo(VPX + (-150 + d * 100) * S_BAS, H);
    g.stroke();
  }
  // L'ombre des bords du carton
  const bords = g.createLinearGradient(VPX - bas, 0, VPX + bas, 0);
  bords.addColorStop(0, "rgba(60,20,10,0.55)");
  bords.addColorStop(0.18, "rgba(60,20,10,0)");
  bords.addColorStop(0.82, "rgba(60,20,10,0)");
  bords.addColorStop(1, "rgba(60,20,10,0.55)");
  g.fillStyle = bords;
  g.fillRect(VPX - bas, VPY, 2 * bas, H - VPY);
  g.restore();
  // Le carton s'éclaire au temps
  bande();
  g.fillStyle = hsl(38, 100, 72, 0.05 * bp);
  g.fill();
  // Les rails de laiton au bord du carton
  for (const cote of [-1, 1]) {
    g.beginPath();
    g.moveTo(VPX, VPY);
    g.lineTo(VPX + cote * (ROUTE + 8) * S_BAS, H);
    g.strokeStyle = hsl(30, 75, 16);
    g.lineWidth = 9;
    g.stroke();
    const laiton = g.createLinearGradient(0, VPY, 0, H);
    laiton.addColorStop(0, hsl(40, 100, 64, 0));
    laiton.addColorStop(1, hsl(40, 100, 70));
    g.strokeStyle = laiton;
    g.lineWidth = 3;
    g.stroke();
  }
}

// Un engrenage de laiton qui tourne avec la chanson, plus vite quand la partie a de l'énergie
function engrenage(cote: number, n: number, dz: number, nb: number, hsl, e: number) {
  const R = 110 + hh(n, 61 + cote) * 160,
    [x, y, s] = P(cote * (540 + R * 0.6 + hh(n, 62 + cote) * 130), 80 + hh(n, 63 + cote) * 240, dz),
    a = fondu(dz, AVANCE, AVANCE + 2) * clamp((dz + 0.3) / 0.12, 0, 1);
  if (a <= 0) return;
  const r = R * s,
    dents = Math.round(14 + R / 14),
    ang = nb * (reduced ? 0.05 : 0.22) * (n % 2 ? 1 : -1) * (140 / R) * (1 + e),
    da = (Math.PI * 2) / dents;
  g.globalAlpha = a;
  g.beginPath();
  for (let i = 0; i < dents; i++) {
    const a0 = ang + i * da;
    for (const [k, rr] of [
      [0, 0.88],
      [0.18, 1],
      [0.48, 1],
      [0.66, 0.88],
    ])
      g.lineTo(x + Math.cos(a0 + da * k) * r * rr, y + Math.sin(a0 + da * k) * r * rr);
  }
  g.closePath();
  for (let i = 0; i < 5; i++) {
    const a0 = ang + (i / 5) * Math.PI * 2;
    g.moveTo(x + Math.cos(a0 + 0.12) * r * 0.7, y + Math.sin(a0 + 0.12) * r * 0.7);
    g.arc(x, y, r * 0.7, a0 + 0.12, a0 + (Math.PI * 2) / 5 - 0.12);
    g.arc(x, y, r * 0.3, a0 + (Math.PI * 2) / 5 - 0.25, a0 + 0.25, true);
    g.closePath();
  }
  const metal = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  metal.addColorStop(0, hsl(40, 70, 40 + 25 * e));
  metal.addColorStop(0.6, hsl(32, 70, 22 + 12 * e));
  metal.addColorStop(1, hsl(28, 70, 9));
  g.fillStyle = metal;
  g.fill("evenodd");
  g.fillStyle = hsl(28, 70, 6);
  g.beginPath();
  g.arc(x, y, r * 0.12, 0, Math.PI * 2);
  g.fill();
  // La brume rouge du lointain
  g.globalAlpha = a * clamp((dz - 0.5) / 5, 0, 0.55);
  g.fillStyle = hsl(348, 65, 14);
  g.beginPath();
  g.arc(x, y, r * 1.02, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

// Un poteau de laiton de chaque côté, à chaque temps : ses bras tiennent les tiges de la mélodie
function poteau(cote: number, dz: number, hsl) {
  const [xb, yb, s] = P(cote * 410, 0, dz),
    [, yt] = P(cote * 410, SOL - RAILS[1][1] + 14, dz);
  // Il s'efface au loin, et juste avant de passer à côté de la caméra
  g.globalAlpha = fondu(dz, AVANCE - 1, AVANCE + 1) * clamp((dz - 0.12) / 0.3, 0, 1);
  g.fillStyle = hsl(40, 70, 52);
  g.fillRect(xb - 5 * s, yt, 10 * s, yb - yt);
  g.fillStyle = hsl(38, 60, 42);
  g.fillRect(xb - 11 * s, yb - 12 * s, 22 * s, 12 * s);
  g.beginPath();
  g.arc(xb, yt, 9 * s, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hsl(36, 60, 44);
  g.lineWidth = Math.max(1, 4 * s);
  g.beginPath();
  for (const [x, y] of [RAILS[1], RAILS[0]]) {
    const [x1, y1] = P(cote * 410, SOL - y, dz),
      [x2, y2] = P(cote * Math.abs(x), SOL - y, dz);
    g.moveTo(x1, y1);
    g.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 24 * s, x2, y2);
  }
  g.stroke();
  g.globalAlpha = 1;
}

// Les tiges de laiton de la mélodie, une par rail, avec une bague à chaque temps qui file vers le personnage
function tiges(vue: VueDeScene) {
  const { nb, hsl, pulsation: bp } = vue;
  for (let r = 0; r < 4; r++) {
    const [x, y] = RAILS[r],
      [ax, ay, as] = projeter(x, y, AVANCE + 4),
      [bx, by, bs] = projeter(x, y, -0.14),
      l = Math.hypot(bx - ax, by - ay),
      nx = -(by - ay) / l,
      ny = (bx - ax) / l,
      tige = g.createLinearGradient(ax, ay, bx, by);
    tige.addColorStop(0, hsl(34, 60, 30, 0));
    tige.addColorStop(0.25, hsl(34, 65, 33));
    tige.addColorStop(1, hsl(38, 65, 58));
    g.fillStyle = tige;
    g.beginPath();
    g.moveTo(ax + nx * 5 * as, ay + ny * 5 * as);
    g.lineTo(bx + nx * 5 * bs, by + ny * 5 * bs);
    g.lineTo(bx - nx * 5 * bs, by - ny * 5 * bs);
    g.lineTo(ax - nx * 5 * as, ay - ny * 5 * as);
    g.closePath();
    g.fill();
    g.strokeStyle = hsl(LANE_HUE[r], 70, 80, 0.35 + 0.25 * bp + (vue.solo ? 0.2 * bp : 0));
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(ax - nx * 2 * as, ay - ny * 2 * as);
    g.lineTo(bx - nx * 2 * bs, by - ny * 2 * bs);
    g.stroke();
    g.fillStyle = hsl(40, 100, 72, 0.8);
    for (let k = Math.ceil(nb); k < nb + AVANCE; k++) {
      const [px, py, s] = projeter(x, y, k - nb);
      g.globalAlpha = fondu(k - nb, 2, AVANCE);
      g.beginPath();
      g.ellipse(px, py, 3 + 6 * s, 3 + 9 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

// Les rideaux de velours, retenus par une embrasse dorée, et le lambrequin en haut
function rideaux(vue: VueDeScene) {
  const { pnow } = vue;
  for (const cote of [-1, 1]) {
    const w = 110,
      bord = cote < 0 ? w : W - w,
      ext = cote < 0 ? -12 : W + 12;
    g.beginPath();
    g.moveTo(ext, -12);
    g.lineTo(bord, -12);
    for (let y = 0; y <= H; y += 20) {
      const pince = Math.exp(-(((y - 430) / 120) ** 2)),
        houle = reduced ? 0 : Math.sin(pnow * 0.0012 + y * 0.02) * 3;
      g.lineTo(bord - cote * (pince * w * 0.45 - houle) + cote * Math.sin(y * 0.05) * 4, y);
    }
    g.lineTo(ext, H + 12);
    g.closePath();
    const plis = g.createLinearGradient(cote < 0 ? 0 : W - w, 0, cote < 0 ? w : W, 0);
    for (let i = 0; i <= 6; i++) plis.addColorStop(i / 6, i % 2 ? "#7a1222" : "#2a0309");
    g.fillStyle = plis;
    g.fill();
    const xe = cote < 0 ? w * 0.55 : W - w * 0.55;
    g.strokeStyle = "#d9a64a";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(xe - cote * 26, 422);
    g.quadraticCurveTo(xe, 442, xe + cote * 20, 426);
    g.stroke();
  }
  g.fillStyle = "#4a0812";
  g.beginPath();
  g.moveTo(-12, -12);
  g.lineTo(W + 12, -12);
  g.lineTo(W + 12, 12);
  for (let x = W; x >= 0; x -= 64) g.quadraticCurveTo(x - 32, 26, x - 64, 12);
  g.closePath();
  g.fill();
}

/**
 * L'automate vu de dos (#82) : manteau rouge en cloche, tête de porcelaine, haut-de-forme, et la clé de remontage
 * dans le dos qui tourne avec la chanson. Il court, saute (`haut`), glisse accroupi, s'écrase sur la plaque ; blessé,
 * il rougit. Dessiné dans le repère de sa pose, ses pieds en (x, sol) ; renvoie sa main levée, d'où partent les tirs.
 */
export function personnageBoite(p: GesteDuPersonnage): [number, number] {
  const { hsl } = p,
    gl = p.glisse ? 1 : 0,
    course = p.court ? p.phase / Math.PI : 0,
    bob = p.court ? -Math.abs(Math.sin(course * Math.PI)) * 4 : 0,
    saute = p.haut < -2 ? 1 : 0,
    hanche = -48 + 28 * gl + 8 * saute,
    epaule = -84 + 38 * gl + 6 * saute,
    tete = -98 + 38 * gl + 5 * saute,
    laiton = hsl(40, 65, 52),
    [sx, sy] = [1 + 0.22 * p.ecrase, 1 - 0.24 * p.ecrase];
  g.save();
  g.translate(p.x, p.sol + p.haut);
  g.scale(0.8 * sx, 0.8 * sy);
  g.lineCap = g.lineJoin = "round";
  const ph = Math.sin(course * Math.PI * 2);
  for (const s of [-1, 1]) {
    const fx = saute ? s * 13 : s * (9 + 21 * gl),
      fy = saute ? -26 : gl < 0.5 ? -Math.max(0, s * ph) * 16 : 0,
      kx = s * (14 + 20 * gl) + saute * s * 6,
      ky = gl ? -12 : (hanche + fy) / 2 - 2 - saute * 4;
    g.strokeStyle = laiton;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(s * 8, hanche + bob);
    g.lineTo(kx, ky + bob);
    g.lineTo(fx, fy - 4);
    g.stroke();
    g.fillStyle = hsl(20, 60, 6);
    g.beginPath();
    g.ellipse(fx, fy - 3, 7, 4.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  const main: [number, number] = [30, epaule - 30 + bob];
  for (const s of [-1, 1]) {
    const ex = s * 15,
      ey = epaule + 6 + bob,
      [hx, hy] = s > 0 ? main : gl ? [-40, -4] : [-24, ey + 26 + ph * 6];
    g.strokeStyle = laiton;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo((ex + hx) / 2 + s * 4, (ey + hy) / 2 + 4);
    g.lineTo(hx, hy);
    g.stroke();
    g.fillStyle = hsl(40, 60, 94);
    g.beginPath();
    g.arc(hx, hy, 4, 0, Math.PI * 2);
    g.fill();
  }
  // Le manteau en cloche, bordé d'or
  const manteau = g.createLinearGradient(-20, 0, 20, 0);
  manteau.addColorStop(0, p.blesse ? COL.bad : hsl(348, 75, 16));
  manteau.addColorStop(0.45, p.blesse ? COL.bad : hsl(350, 64, 39));
  manteau.addColorStop(1, p.blesse ? COL.bad : hsl(346, 80, 12));
  g.fillStyle = manteau;
  g.beginPath();
  g.moveTo(-14, epaule + 2 + bob);
  g.quadraticCurveTo(0, epaule - 6 + bob, 14, epaule + 2 + bob);
  g.lineTo(22, hanche + 6 + bob);
  g.quadraticCurveTo(0, hanche + 12 + bob, -22, hanche + 6 + bob);
  g.closePath();
  g.fill();
  g.strokeStyle = hsl(40, 65, 61);
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(22, hanche + 6 + bob);
  g.quadraticCurveTo(0, hanche + 12 + bob, -22, hanche + 6 + bob);
  g.stroke();
  // La clé de remontage, qui tourne (lentement en mouvement réduit)
  const ky = (epaule + hanche) / 2 + bob,
    c = Math.cos(p.phase * (reduced ? 0.6 : 2.4));
  g.fillStyle = hsl(36, 55, 48);
  g.fillRect(-2, ky - 3, 4, 6);
  g.fillStyle = hsl(42, 80, 62);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 11 * c, ky, 9 * Math.abs(c) + 1, 6.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // La tête de porcelaine, ses cheveux, et le haut-de-forme
  g.fillStyle = hsl(36, 40, 88);
  g.beginPath();
  g.arc(0, tete + bob, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hsl(24, 55, 15);
  g.beginPath();
  g.arc(0, tete + bob + 1, 13, Math.PI * 1.05, Math.PI * 1.95, true);
  g.fill();
  g.fillStyle = hsl(0, 40, 7);
  g.beginPath();
  g.ellipse(0, tete - 10 + bob, 15, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-9, tete - 28 + bob, 18, 18);
  g.fillStyle = hsl(40, 65, 61);
  g.fillRect(-9, tete - 15 + bob, 18, 3);
  g.restore();
  return [p.x + main[0] * 0.8 * sx, p.sol + p.haut + main[1] * 0.8 * sy];
}
