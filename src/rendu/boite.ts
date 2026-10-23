import { S, progression } from "../jeu/etat";
import { clamp } from "../outils";
import { lieuxReussis } from "../sauvegarde/format";
import { COL, GY, HITX, LANE_Y, PPB, PX, W, energy, g, hexA, hh, rr } from "./outils";

/* La Boîte à musique */
export function boiteBack(nb, hsl, bp) {
  const wall = g.createLinearGradient(0, 0, 0, GY);
  wall.addColorStop(0, hsl(24, 40, 7));
  wall.addColorStop(1, hsl(28, 42, 16));
  g.fillStyle = wall;
  g.fillRect(-12, -12, W + 24, GY + 12);
  // Planches du grenier
  const woff = nb * PPB * 0.12,
    k0 = Math.floor(woff / 64);
  for (let k = k0; k < k0 + W / 64 + 2; k++) {
    const x = k * 64 - woff;
    g.fillStyle = hsl(26, 35, 9 + hh(k, 1) * 4, 0.6);
    g.fillRect(x, 0, 62, GY);
    g.fillStyle = hsl(26, 30, 4, 0.6);
    g.fillRect(x + 62, 0, 2, GY);
  }
  // Les souvenirs déjà retrouvés (#25) restent accrochés au mur : une photographie sépia de plus par souvenir
  const retrouves = lieuxReussis(progression(), "boite").length;
  if (retrouves)
    for (let k = k0; k < k0 + W / 64 + 2; k++) {
      if (hh(k, 30) >= 0.06 * retrouves) continue;
      const x = k * 64 - woff + 14,
        y = 60 + hh(k, 31) * 110,
        pente = (hh(k, 32) - 0.5) * 0.16;
      g.save();
      g.translate(x + 17, y + 13);
      g.rotate(pente);
      g.fillStyle = hsl(40, 45, 42);
      g.fillRect(-19, -15, 38, 30);
      g.fillStyle = hsl(34, 40, 68);
      g.fillRect(-15, -11, 30, 22);
      // Une silhouette, à peine dessinée
      g.fillStyle = hsl(28, 30, 40);
      g.beginPath();
      g.arc(0, -3, 4, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-6, 3, 12, 8);
      g.restore();
    }
  // Engrenages : ils tournent avec la musique, et brillent quand les engrenages jouent
  const e = energy();
  for (const [speed, slot, l, layer] of [
    [0.08, 300, 14, 0],
    [0.22, 240, 19, 1],
  ]) {
    const off = nb * PPB * speed,
      g0 = Math.floor(off / slot) - 1;
    for (let k = g0; k < g0 + W / slot + 3; k++) {
      if (hh(k, layer + 20) < 0.25) continue;
      const r = 40 + hh(k, layer + 21) * (layer ? 50 : 80);
      const cx = k * slot - off + slot / 2,
        cy = layer ? GY - 40 - hh(k, 22) * 120 : 120 + hh(k, 23) * 220;
      gear(
        cx,
        cy,
        r,
        Math.round(r / 6),
        (((k % 2 ? 1 : -1) * nb * Math.PI) / 8) * (60 / r),
        hsl(38, 40 + 25 * e, l + 6 * e),
      );
    }
  }
  // Lumière de la lucarne et poussière qui danse
  g.beginPath();
  g.moveTo(800, -12);
  g.lineTo(930, -12);
  g.lineTo(760, GY);
  g.lineTo(520, GY);
  g.closePath();
  g.fillStyle = hsl(42, 85, 75, 0.05 + 0.04 * bp + 0.05 * e);
  g.fill();
  for (let i = 0; i < 40; i++) {
    const v = (((hh(i, 6) - nb * 0.012 * (1 + hh(i, 7))) % 1) + 1) % 1,
      yy = v * GY;
    const left = 800 - 280 * v,
      right = 930 - 170 * v;
    const xx = left + hh(i, 5) * (right - left) + Math.sin(nb + i) * 4;
    g.fillStyle = hsl(45, 80, 85, 0.2 + 0.45 * bp * hh(i, 8));
    g.fillRect(xx, yy, 2, 2);
  }
}
export function gear(cx, cy, r, teeth, ang, color) {
  g.save();
  g.translate(cx, cy);
  g.rotate(ang);
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++)
    g.arc(0, 0, i % 2 ? r : r + 7, (i / (teeth * 2)) * Math.PI * 2, ((i + 1) / (teeth * 2)) * Math.PI * 2);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(0,0,0,.35)";
  g.beginPath();
  g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  for (let s = 0; s < 4; s++) {
    g.rotate(Math.PI / 2);
    g.fillRect(-3, 0, 6, r * 0.62);
  }
  g.beginPath();
  g.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
// Le peigne : chaque couloir est une lame, qui vibre quand on la joue
export function drawComb(pnow, hsl) {
  const bx = HITX - 46;
  rr(bx, 128, 14, 294, 4);
  g.fillStyle = hsl(40, 55, 36);
  g.fill();
  for (let i = 0; i < 4; i++) {
    const fl = clamp(1 - (pnow - S.laneFlash[i]) / 300, 0, 1),
      vib = Math.sin(pnow / 18) * 2.5 * fl;
    g.fillStyle = hsl(42, 65, 50 + 18 * fl);
    g.beginPath();
    g.moveTo(bx + 14, LANE_Y[i] - 4);
    g.lineTo(HITX - 17, LANE_Y[i] - 2 + vib);
    g.lineTo(HITX - 17, LANE_Y[i] + 2 + vib);
    g.lineTo(bx + 14, LANE_Y[i] + 4);
    g.closePath();
    g.fill();
  }
}
// Le sol est le cylindre de la boîte, hérissé de picots
export function boiteGround(nb, hsl) {
  const cyl = g.createLinearGradient(0, GY, 0, GY + 40);
  cyl.addColorStop(0, hsl(42, 60, 50));
  cyl.addColorStop(0.3, hsl(40, 55, 32));
  cyl.addColorStop(1, hsl(34, 50, 13));
  g.fillStyle = cyl;
  g.fillRect(-12, GY, W + 24, 45);
  const off = nb * PPB;
  for (let k = Math.floor((off - PX - 40) / 23); k * 23 - off + PX < W + 20; k++) {
    if (hh(k, 40) < 0.55) continue;
    g.fillStyle = hsl(45, 70, 72, 0.7);
    g.beginPath();
    g.arc(k * 23 - off + PX, GY + 9 + hh(k, 41) * 24, 1.8, 0, Math.PI * 2);
    g.fill();
  }
}
// Gros picot de laiton
export function boiteBlock(x, fill) {
  rr(x - 7, GY - 26, 14, 26, 3);
  g.fillStyle = fill;
  g.fill();
  g.beginPath();
  g.ellipse(x, GY - 27, 17, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(COL.fg, 0.35);
  g.beginPath();
  g.ellipse(x - 5, GY - 30, 5, 2.5, 0, 0, Math.PI * 2);
  g.fill();
}
// Picot double, deux fois plus haut, à franchir d'un double saut (#7)
export function boiteHaut(x, fill) {
  rr(x - 7, GY - 74, 14, 74, 3);
  g.fillStyle = fill;
  g.fill();
  for (const y of [GY - 27, GY - 75]) {
    g.fillStyle = fill;
    g.beginPath();
    g.ellipse(x, y, 17, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hexA(COL.fg, 0.35);
    g.beginPath();
    g.ellipse(x - 5, y - 3, 5, 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }
}
// Gros picot à enfoncer (#8) : large et bas, il rentre dans le cylindre une fois écrasé
export function boitePlaque(x, fill, enfoncee) {
  const h = enfoncee ? 3 : 12;
  rr(x - 16, GY - h, 32, h, 3);
  g.fillStyle = fill;
  g.fill();
  g.beginPath();
  g.ellipse(x, GY - h, 24, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(COL.fg, 0.35);
  g.beginPath();
  g.ellipse(x - 7, GY - h - 2, 7, 2.5, 0, 0, Math.PI * 2);
  g.fill();
}
// Levier du mécanisme
export function boiteBeam(x, fill) {
  g.fillStyle = hexA(COL.bass, 0.35);
  g.fillRect(x - 2, 250, 4, 188);
  rr(x - 18, 436, 36, 24, 11);
  g.fillStyle = fill;
  g.fill();
}
// Rail de laiton (#12) : une tringle inclinée sur ses montants, de la hauteur ya en a à la hauteur yb en b
export function boitePente(a, b, ya, yb, fill) {
  const y = (x) => ya + ((yb - ya) * (x - a)) / (b - a);
  g.fillStyle = hexA(COL.ink, 0.45);
  for (let x = a + 10; x < b - 4; x += 34) g.fillRect(x - 2, y(x), 4, GY - y(x));
  g.strokeStyle = fill;
  g.lineCap = "round";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(a, ya);
  g.lineTo(b, yb);
  g.stroke();
  g.strokeStyle = hexA(COL.fg, 0.4);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(a + 4, ya - 2);
  g.lineTo(b - 4, yb - 2);
  g.stroke();
  for (const [x, yy] of [
    [a, ya],
    [b, yb],
  ]) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, yy, 6, 0, Math.PI * 2);
    g.fill();
  }
}
// Le grand ressort, au-dessus de la tête
export function boiteTunnel(a, b, fill) {
  rr(a, 424, b - a, 34, 17);
  g.fillStyle = hexA(COL.ink, 0.5);
  g.fill();
  g.strokeStyle = fill;
  g.lineWidth = 3;
  for (let x = a + 8; x < b - 6; x += 9) {
    g.beginPath();
    g.ellipse(x, 441, 6, 17, 0.25, 0, Math.PI * 2);
    g.stroke();
  }
}
// Papillon de nuit qui a avalé une note : elle brille dans son ventre
export function boiteEnemy(x, y, ev, col, a, nb, hsl) {
  const big = ev.kind === "refrain",
    flap = 0.35 + 0.65 * Math.abs(Math.sin(nb * Math.PI * 2 + ev.beat * 3));
  const ww = big ? 17 : 13,
    wh = (big ? 15 : 11) * flap;
  g.fillStyle = hsl(32, 25, big ? 70 : 62, 0.9 * a);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * ww * 0.55, y - 3, ww * 0.6, wh, s * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  if (big) {
    g.fillStyle = col;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(x + s * ww * 0.6, y - 3, 1 + 3 * flap, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y + 2, 4, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hsl(32, 25, 72, a);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x - 1, y - 7);
  g.lineTo(x - 5, y - 15);
  g.moveTo(x + 1, y - 7);
  g.lineTo(x + 5, y - 15);
  g.stroke();
}
// La petite note (#14) : une mite de papier, deux fois plus petite que les papillons, qui bat vite des ailes
export function boitePetite(x, y, col, a, nb, hsl) {
  const flap = 0.3 + 0.7 * Math.abs(Math.sin(nb * Math.PI * 4 + x));
  g.fillStyle = hsl(32, 25, 66, 0.9 * a);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * 4, y - 2, 4, 6 * flap, s * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y + 1, 2.2, 5, 0, 0, Math.PI * 2);
  g.fill();
}
// La marche d'un escalier (#13) : une touche d'ivoire dressée à la hauteur de sa note, coiffée de laiton, avec
// un petit chevron qui monte ou descend dans le sens de l'escalier
export function boiteMarche(x, haut, fill, monte) {
  rr(x - 15, GY - haut, 30, haut, 4);
  g.fillStyle = hexA(COL.fg, 0.85);
  g.fill();
  g.strokeStyle = fill;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = fill;
  g.fillRect(x - 15, GY - haut, 30, 5);
  g.strokeStyle = hexA(COL.ink, 0.6);
  g.lineWidth = 2;
  g.beginPath();
  const y = GY - haut / 2 + (monte ? 3 : -3);
  g.moveTo(x - 6, y);
  g.lineTo(x, y + (monte ? -6 : 6));
  g.lineTo(x + 6, y);
  g.stroke();
}
// Le serpent (#16) : un ruban de papier cousu, porté par une file de papillons de nuit qui battent des ailes
export function boiteSerpent(troncons: { lane: number; pts: [number, number][] }[], couleur, nb) {
  const tracer = (pts: [number, number][]) => {
    g.beginPath();
    for (const [x, y] of pts) g.lineTo(x, y);
  };
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const { lane, pts } of troncons) {
    tracer(pts);
    g.strokeStyle = couleur(lane, 0.35);
    g.lineWidth = 8;
    g.stroke();
    g.setLineDash([3, 4]);
    g.strokeStyle = couleur(lane, 0.9);
    g.lineWidth = 1.5;
    g.stroke();
    g.setLineDash([]);
  }
  for (const { lane, pts } of troncons)
    pts.forEach(([x, y], i) => {
      if (i % 7 !== 3) return;
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(nb * Math.PI * 2 + x / 40));
      g.fillStyle = couleur(lane, 0.85);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(x + s * 4, y - 3, 4, 5 * flap, s * 0.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = hexA(COL.ink, 0.8);
      g.fillRect(x - 1, y - 6, 2, 7);
    });
  g.restore();
}
// Le chanteur (#18) : un oiseau mécanique sur son perchoir, remonté par une clé. `ouvert` : de 0 à 1, la note
// chantée en ce moment ; le bec s'ouvre et la tête se lève.
export function boiteChanteur(x, y, ouvert, a, nb, hsl) {
  // Perchoir et anneau
  g.strokeStyle = hsl(40, 45, 62, 0.8 * a);
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y - 4, 26, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x - 20, y + 14);
  g.lineTo(x + 20, y + 14);
  g.stroke();
  // Clé de remontoir qui tourne
  const ang = nb * Math.PI;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 12, y);
  g.lineTo(x + 20, y);
  g.stroke();
  g.beginPath();
  g.ellipse(x + 23, y, 3, 6 * Math.abs(Math.cos(ang)) + 1, 0, 0, Math.PI * 2);
  g.stroke();
  // Corps et queue
  g.fillStyle = hsl(40, 55, 58, a);
  g.beginPath();
  g.ellipse(x + 2, y + 2, 13, 9, -0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x + 12, y + 2);
  g.lineTo(x + 24, y + 10);
  g.lineTo(x + 20, y - 2);
  g.closePath();
  g.fill();
  // Tête, qui se lève sur la note, et bec ouvert
  const hy = y - 9 - 3 * ouvert;
  g.beginPath();
  g.arc(x - 9, hy, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hsl(30, 80, 70, a);
  g.beginPath();
  g.moveTo(x - 14, hy - 2);
  g.lineTo(x - 23, hy - 1 - 4 * ouvert);
  g.lineTo(x - 15, hy + 1);
  g.lineTo(x - 23, hy + 2 + 4 * ouvert);
  g.lineTo(x - 14, hy + 3);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(x - 10, hy - 2, 1.5, 0, Math.PI * 2);
  g.fillStyle = hsl(250, 30, 15, a);
  g.fill();
  // Aile, qui bat sur la note
  g.fillStyle = hsl(40, 40, 72, a);
  g.beginPath();
  g.ellipse(x + 4, y - 1 - 3 * ouvert, 8, 4, -0.5 - 0.5 * ouvert, 0, Math.PI * 2);
  g.fill();
  if (ouvert > 0) {
    g.strokeStyle = hsl(40, 90, 85, ouvert * a);
    g.lineWidth = 1.5;
    for (let k = 1; k <= 3; k++) {
      g.beginPath();
      g.arc(x - 23, hy, 4 + 6 * k * ouvert, Math.PI * 0.75, Math.PI * 1.25);
      g.stroke();
    }
  }
}

/* ---------- Remontage (#27, ADR-0015) ---------- */
// La boîte à musique vue de côté, sa clé de face : la clé tourne d'un quart de tour à chaque tour réussi, et le
// ressort spiral, derrière la vitre, se resserre avec la tension (de 0 à 1)
export function boiteCle(cx: number, cy: number, ang: number, tension: number) {
  // La boîte
  rr(cx - 150, cy - 70, 220, 140, 10);
  g.fillStyle = "#5a3a22";
  g.fill();
  g.strokeStyle = "#c79a5a";
  g.lineWidth = 3;
  g.stroke();
  // Le ressort, derrière une petite vitre
  g.save();
  g.beginPath();
  g.arc(cx - 60, cy, 52, 0, Math.PI * 2);
  g.fillStyle = "#2a1a10";
  g.fill();
  g.clip();
  const tours = 2.5 + 4 * tension,
    rmax = 46 - 10 * tension;
  g.beginPath();
  for (let i = 0; i <= 160; i++) {
    const k = i / 160,
      a = k * tours * Math.PI * 2 + ang * 0.25;
    g.lineTo(cx - 60 + Math.cos(a) * (4 + k * rmax), cy + Math.sin(a) * (4 + k * rmax));
  }
  g.strokeStyle = `hsl(42,70%,${Math.round(48 + 22 * tension)}%)`;
  g.lineWidth = 2.5;
  g.stroke();
  g.restore();
  gear(cx + 10, cy + 30, 18, 9, -ang * 2, "#8a6a3a");
  // L'axe, puis la clé papillon, de face
  g.fillStyle = "#c79a5a";
  g.fillRect(cx + 70, cy - 7, 40, 14);
  g.save();
  g.translate(cx + 130, cy);
  g.rotate(ang);
  g.strokeStyle = "#7a5520";
  g.lineWidth = 3;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(0, s * 40, 26, 34, 0, 0, Math.PI * 2);
    g.fillStyle = "#e0b45c";
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(0, s * 44, 10, 14, 0, 0, Math.PI * 2);
    g.fillStyle = "#5a3a22";
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 14, 0, Math.PI * 2);
  g.fillStyle = "#e0b45c";
  g.fill();
  g.stroke();
  g.restore();
}
