import { S } from "../jeu/etat";
import { clamp } from "../outils";
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
