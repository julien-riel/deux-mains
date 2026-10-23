import { S, layers, progression } from "../jeu/etat";
import { lieuxReussis } from "../sauvegarde/format";
import { COL, GY, PPB, PW, PX, W, energy, g, hexA, hh, rr } from "./outils";

/* La Ville Muette */
export function villeBack(nb, hsl, bp) {
  const sky = g.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, hsl(250, 45, 8));
  sky.addColorStop(0.7, hsl(290, 38, 17));
  sky.addColorStop(1, hsl(320, 45, 24));
  g.fillStyle = sky;
  g.fillRect(-12, -12, W + 24, GY + 12);
  // Lune imprimée en risographie : deux passages d'encre légèrement décalés
  g.globalAlpha = 0.5;
  g.beginPath();
  g.arc(930, 170, 64, 0, Math.PI * 2);
  g.fillStyle = hsl(330, 90, 66);
  g.fill();
  g.globalAlpha = 0.3;
  g.beginPath();
  g.arc(938, 163, 64, 0, Math.PI * 2);
  g.fillStyle = hsl(50, 95, 65);
  g.fill();
  g.globalAlpha = 1;
  // Les fenêtres s'allument avec le combo : les habitants se réveillent. Ceux des quartiers déjà rallumés (#25)
  // restent réveillés : chaque quartier réussi garde des fenêtres allumées dès le départ
  const veille = 0.05 + 0.05 * lieuxReussis(progression(), "ville").length,
    lit = veille + (0.6 - veille) * energy(),
    flicker = S.mode === "play" && S.health < 40,
    strings = layers().strings;
  for (const [speed, slot, minH, maxH, l, layer] of [
    [0.1, 70, 130, 270, 13, 0],
    [0.28, 110, 90, 220, 9, 1],
  ]) {
    const off = nb * PPB * speed,
      k0 = Math.floor(off / slot) - 1;
    for (let k = k0; k < k0 + W / slot + 3; k++) {
      const x = k * slot - off,
        bw = slot - 8 - hh(k, layer) * 20,
        bh = minH + hh(k, layer + 7) * (maxH - minH),
        top = GY - bh;
      g.fillStyle = hsl(255, 28, l);
      g.fillRect(x, top, bw, bh);
      if (hh(k, layer + 3) < 0.3) g.fillRect(x + bw * 0.6, top - 18, 10, 18);
      for (let wy = top + 12, r = 0; wy < GY - 30; wy += 18, r++)
        for (let wx = x + 8, c = 0; wx < x + bw - 10; wx += 14, c++) {
          const v = hh(k * 977 + r * 31 + c, layer + 50);
          if (v < lit && !(flicker && Math.random() < 0.4)) {
            g.fillStyle = hsl(45, 90, 68, layer ? 0.85 : 0.5);
            g.fillRect(wx, wy, 6, 8);
          }
        }
      // Quand les cordes jouent, des musiciens apparaissent sur les toits
      if (layer === 1 && strings && hh(k, 11) < 0.45) {
        const fx = x + 14 + hh(k, 12) * (bw - 28),
          sway = Math.sin(nb * Math.PI + k) * 2;
        g.fillStyle = hsl(255, 28, 5);
        g.strokeStyle = hsl(255, 28, 5);
        g.lineWidth = 2;
        g.fillRect(fx, top - 16, 6, 16);
        g.beginPath();
        g.arc(fx + 3, top - 20, 4, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(fx + 6, top - 10);
        g.lineTo(fx + 17, top - 17 + sway);
        g.stroke();
      }
    }
  }
  // Lampadaires, un toutes les deux mesures
  for (let b = Math.floor((nb - 4) / 8) * 8; b < nb + 12; b += 8) {
    const x = PX + PW / 2 + (b - nb) * PPB + 60;
    const on = !(flicker && hh(b, Math.floor(nb * 4)) < 0.4);
    g.fillStyle = hsl(255, 15, 22);
    g.fillRect(x, GY - 150, 4, 150);
    g.fillRect(x - 20, GY - 150, 24, 4);
    if (on) {
      g.beginPath();
      g.moveTo(x - 18, GY - 146);
      g.lineTo(x - 64, GY);
      g.lineTo(x + 28, GY);
      g.closePath();
      g.fillStyle = hsl(45, 90, 70, 0.05 + 0.04 * bp);
      g.fill();
      g.fillStyle = hsl(45, 95, 75);
      g.fillRect(x - 20, GY - 146, 10, 4);
    }
  }
}
export function villeGround(nb, hsl) {
  g.fillStyle = hsl(250, 14, 12);
  g.fillRect(-12, GY, W + 24, 45);
  const off = (nb * PPB) % 80;
  g.fillStyle = hsl(50, 80, 70, 0.45);
  for (let x = -off; x < W; x += 80) g.fillRect(x, GY + 26, 40, 3);
}
// Barrière de chantier
export function villeBlock(x, fill) {
  g.save();
  rr(x - 18, GY - 34, 36, 22, 3);
  g.fillStyle = fill;
  g.fill();
  g.clip();
  g.fillStyle = hexA(COL.ink, 0.8);
  for (let s = -40; s < 50; s += 12) {
    g.beginPath();
    g.moveTo(x + s, GY - 34);
    g.lineTo(x + s + 6, GY - 34);
    g.lineTo(x + s - 16, GY - 12);
    g.lineTo(x + s - 22, GY - 12);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = fill;
  g.fillRect(x - 15, GY - 12, 4, 12);
  g.fillRect(x + 11, GY - 12, 4, 12);
}
// Pile de trois barrières, à franchir d'un double saut (#7)
export function villeHaut(x, fill) {
  for (let i = 0; i < 3; i++) {
    g.save();
    g.translate(0, -34 * i);
    villeBlock(x, fill);
    g.restore();
  }
}
// Plaque d'égout à écraser (#8) : vue de biais, elle s'enfonce une fois écrasée
export function villePlaque(x, fill, enfoncee) {
  const y = GY - (enfoncee ? 1 : 5);
  g.fillStyle = hexA(COL.ink, 0.7);
  g.beginPath();
  g.ellipse(x, GY, 30, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, 26, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hexA(COL.ink, 0.55);
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(x, y, 18, 4, 0, 0, Math.PI * 2);
  for (const d of [-9, 0, 9]) {
    g.moveTo(x + d - 3, y - 3);
    g.lineTo(x + d + 3, y + 3);
  }
  g.stroke();
}
// Rideau de fer suspendu
export function villeBeam(x, fill) {
  g.strokeStyle = hexA(COL.fg, 0.18);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x - 12, 280);
  g.lineTo(x - 12, 438);
  g.moveTo(x + 12, 280);
  g.lineTo(x + 12, 438);
  g.stroke();
  rr(x - 18, 436, 36, 24, 3);
  g.fillStyle = fill;
  g.fill();
  g.fillStyle = hexA(COL.ink, 0.3);
  for (let yy = 440; yy < 458; yy += 5) g.fillRect(x - 16, yy, 32, 1.5);
}
// Pont du métro
export function villeTunnel(a, b, fill) {
  g.save();
  rr(a, 420, b - a, 42, 4);
  g.fillStyle = fill;
  g.fill();
  g.clip();
  g.strokeStyle = hexA(COL.ink, 0.35);
  g.lineWidth = 2;
  g.beginPath();
  for (let rx = a; rx < b; rx += 24) {
    g.moveTo(rx, 422);
    g.lineTo(rx + 24, 460);
    g.moveTo(rx + 24, 422);
    g.lineTo(rx, 460);
  }
  g.stroke();
  g.restore();
  g.fillStyle = hexA(COL.fg, 0.3);
  g.fillRect(a, 414, b - a, 3);
}
// Rampe de rue (#12) : un plan incliné de béton rayé, de la hauteur ya en a à la hauteur yb en b, avec sa main
// courante
export function villePente(a, b, ya, yb, fill) {
  g.save();
  g.beginPath();
  g.moveTo(a, GY);
  g.lineTo(a, ya);
  g.lineTo(b, yb);
  g.lineTo(b, GY);
  g.closePath();
  g.fillStyle = hexA(COL.ink, 0.6);
  g.fill();
  g.clip();
  g.strokeStyle = hexA(COL.fg, 0.12);
  g.lineWidth = 2;
  g.beginPath();
  for (let x = a; x < b + 60; x += 18) {
    g.moveTo(x, GY);
    g.lineTo(x - 60, GY - 60);
  }
  g.stroke();
  g.restore();
  const y = (x) => ya + ((yb - ya) * (x - a)) / (b - a);
  g.strokeStyle = fill;
  g.lineCap = "round";
  g.lineWidth = 2;
  g.beginPath();
  for (let x = a + 14; x < b - 6; x += 46) {
    g.moveTo(x, y(x));
    g.lineTo(x, y(x) - 26);
  }
  g.moveTo(a + 8, y(a + 8) - 26);
  g.lineTo(b - 4, y(b - 4) - 26);
  g.stroke();
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(a, ya);
  g.lineTo(b, yb);
  g.stroke();
}
// Drone du Bureau du Silence : le son capturé brille dans son bocal
export function villeEnemy(x, y, ev, col, a, nb, hsl) {
  const big = ev.kind === "refrain",
    j = big ? 20 : 15,
    top = y - j / 2 + 4;
  rr(x - j / 2, top, j, j, 4);
  g.fillStyle = hsl(250, 20, 90, 0.12 * a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 90, 0.6 * a);
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.arc(x, y + 4, big ? 6 : 4.5, 0, Math.PI * 2);
  g.fillStyle = col;
  g.fill();
  rr(x - 16, top - 7, 32, 7, 3);
  g.fillStyle = hsl(250, 10, 62, a);
  g.fill();
  const spin = Math.abs(Math.sin(nb * 12 + ev.beat));
  g.fillStyle = hsl(250, 10, 82, 0.6 * a);
  g.fillRect(x - 14 - 9 * spin, top - 10, 18 * spin + 2, 2);
  g.fillRect(x + 14 - 9 * spin, top - 10, 18 * spin + 2, 2);
  if (big && Math.floor(nb * 2) % 2 === 0) {
    g.beginPath();
    g.arc(x, top - 10, 2.5, 0, Math.PI * 2);
    g.fillStyle = hexA(COL.bad, a);
    g.fill();
  }
}
// La petite note (#14) : un mini-drone de surveillance, un losange qui clignote sous deux hélices
export function villePetite(x, y, col, a, nb, hsl) {
  g.beginPath();
  g.moveTo(x, y - 6);
  g.lineTo(x + 6, y);
  g.lineTo(x, y + 6);
  g.lineTo(x - 6, y);
  g.closePath();
  g.fillStyle = hsl(250, 20, 90, 0.18 * a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 90, 0.7 * a);
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.arc(x, y, Math.floor(nb * 4) % 2 ? 2.5 : 1.8, 0, Math.PI * 2);
  g.fillStyle = col;
  g.fill();
  const spin = Math.abs(Math.sin(nb * 14 + x));
  g.fillStyle = hsl(250, 10, 82, 0.6 * a);
  g.fillRect(x - 9 - 4 * spin, y - 9, 8 * spin + 1, 1.5);
  g.fillRect(x + 9 - 4 * spin, y - 9, 8 * spin + 1, 1.5);
}
// La marche d'un escalier (#13) : un bloc de béton à la hauteur de sa note, avec son nez de marche et une rampe
// qui monte ou descend dans le sens de l'escalier
export function villeMarche(x, haut, fill, monte) {
  rr(x - 17, GY - haut, 34, haut, 2);
  g.fillStyle = fill;
  g.fill();
  g.fillStyle = hexA(COL.ink, 0.35);
  for (let yy = GY - haut + 8; yy < GY - 2; yy += 7) g.fillRect(x - 15, yy, 30, 1.5);
  g.fillStyle = hexA(COL.fg, 0.55);
  g.fillRect(x - 17, GY - haut, 34, 3);
  g.strokeStyle = hexA(COL.fg, 0.4);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x - 17, GY - haut - 14 + (monte ? 6 : -6));
  g.lineTo(x + 17, GY - haut - 14 + (monte ? -6 : 6));
  g.stroke();
}
// Le serpent (#16) : un câble lumineux tendu d'un couloir à l'autre, avec un halo, une âme claire et des
// étincelles qui courent le long du fil
export function villeSerpent(troncons: { lane: number; pts: [number, number][] }[], couleur, nb) {
  const tracer = (pts: [number, number][]) => {
    g.beginPath();
    for (const [x, y] of pts) g.lineTo(x, y);
  };
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const [largeur, alpha] of [
    [12, 0.16],
    [4, 0.95],
  ])
    for (const { lane, pts } of troncons) {
      tracer(pts);
      g.strokeStyle = couleur(lane, alpha);
      g.lineWidth = largeur;
      g.stroke();
    }
  for (const { pts } of troncons) {
    tracer(pts);
    g.strokeStyle = hexA(COL.fg, 0.5);
    g.lineWidth = 1.2;
    g.stroke();
  }
  // Les étincelles avancent d'un point par double-croche
  const decale = Math.floor(nb * 4);
  for (const { lane, pts } of troncons)
    pts.forEach(([x, y], i) => {
      if ((i + decale) % 7) return;
      g.fillStyle = couleur(lane, 1);
      g.fillRect(x - 2, y - 2, 4, 4);
    });
  g.restore();
}
// Le chanteur (#18) : un drone haut-parleur du Bureau du Silence, qui rejoue une voix capturée par son pavillon.
// `ouvert` : de 0 à 1, la note chantée en ce moment ; le pavillon s'éclaire et lâche des ondes.
export function villeChanteur(x, y, ouvert, a, nb, hsl) {
  // Hélices
  rr(x - 26, y - 22, 52, 6, 3);
  g.fillStyle = hsl(250, 10, 62, a);
  g.fill();
  const spin = Math.abs(Math.sin(nb * 12));
  g.fillStyle = hsl(250, 10, 82, 0.6 * a);
  g.fillRect(x - 22 - 12 * spin, y - 25, 24 * spin + 2, 2);
  g.fillRect(x + 22 - 12 * spin, y - 25, 24 * spin + 2, 2);
  // Caisson
  rr(x - 16, y - 16, 32, 28, 6);
  g.fillStyle = hsl(250, 18, 34, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 80, 0.7 * a);
  g.lineWidth = 1.5;
  g.stroke();
  for (let k = 0; k < 3; k++) {
    g.fillStyle = hsl(250, 20, 75, 0.5 * a);
    g.fillRect(x - 10, y - 9 + 7 * k, 20, 2);
  }
  // Pavillon tourné vers le joueur, qui s'ouvre sur la note
  const r = 13 + 4 * ouvert;
  g.beginPath();
  g.moveTo(x - 14, y - 4);
  g.lineTo(x - 30, y - r);
  g.lineTo(x - 30, y + r - 6);
  g.lineTo(x - 14, y + 4);
  g.closePath();
  g.fillStyle = hsl(45, 70, 50 + 20 * ouvert, a);
  g.fill();
  g.strokeStyle = hsl(45, 80, 80, a);
  g.stroke();
  if (ouvert > 0) {
    g.strokeStyle = hsl(45, 90, 80, ouvert * a);
    g.lineWidth = 2;
    for (let k = 1; k <= 3; k++) {
      g.beginPath();
      g.arc(x - 30, y - 3, 6 + 7 * k * ouvert, Math.PI * 0.75, Math.PI * 1.25);
      g.stroke();
    }
  }
  // Témoin d'enregistrement
  g.beginPath();
  g.arc(x + 9, y - 11, 2.5, 0, Math.PI * 2);
  g.fillStyle = hexA(COL.bad, (0.5 + 0.5 * ouvert) * a);
  g.fill();
}
