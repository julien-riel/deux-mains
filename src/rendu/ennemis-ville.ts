/* Les ennemis de la Ville Muette : un agent du Bureau du Silence par lieu de la carte, chacun gardant un son
   capturé (la couleur de sa note) quelque part dans son corps. Tous suivent la même règle que le drone
   (`villeEnemy`) : vivants loin de la ligne de tir, ils se tournent vers le joueur, s'ouvrent, s'emballent et
   tremblent à mesure que la menace `m` monte. */
import { clamp } from "../outils";
import { GY, PX, g, hh, reduced, rr, type DessinEnnemi, type Palette } from "./outils";

const TOUR = Math.PI * 2;
// La partie fractionnaire d'un nombre, de 0 à 1
const frac = (v: number) => v - Math.floor(v);
// L'angle sous lequel un ennemi en (x, y) voit le joueur, compté vers le bas depuis la gauche
const visee = (x: number, y: number) => clamp(Math.atan2(GY - 34 - y, x - PX), 0, 0.9);

// La pose commune : l'ennemi tremble à l'approche (sauf en mouvement réduit), penche de `rot` et grossit avec la
// menace, d'un tiers de plus au refrain. À refermer par `g.restore()`.
function poser(x: number, y: number, ev: { kind: string; beat: number }, nb: number, m: number, rot = 0) {
  const k = (ev.kind === "refrain" ? 1.3 : 1) * (1 + 0.2 * m),
    tremble = reduced ? 0 : 1.6 * m * m;
  g.save();
  g.translate(x + tremble * Math.sin(nb * 53 + ev.beat), y + tremble * Math.cos(nb * 41 + ev.beat));
  g.rotate(rot);
  g.scale(k, k);
}
// Le son capturé : un disque de la couleur de la note, qui bat au temps, dans sa lueur
function son(cx: number, cy: number, r: number, col: string, pouls: number) {
  const rb = r * (1 + 0.22 * pouls);
  g.save();
  g.globalAlpha *= 0.28 + 0.27 * pouls;
  g.beginPath();
  g.arc(cx, cy, rb * 1.7, 0, TOUR);
  g.fillStyle = col;
  g.fill();
  g.restore();
  g.beginPath();
  g.arc(cx, cy, rb, 0, TOUR);
  g.fillStyle = col;
  g.fill();
}
// Un œil ou une lumière rouge : faible loin de la ligne, éclatant tout près, dans un halo au-delà d'un tiers
function oeil(cx: number, cy: number, r: number, m: number, a: number, hsl: Palette) {
  if (m > 0.3) {
    g.beginPath();
    g.arc(cx, cy, r * (2.2 + 1.4 * m), 0, TOUR);
    g.fillStyle = hsl(355, 90, 60, ((0.4 * (m - 0.3)) / 0.7) * a);
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, r * (1 + 0.5 * m), 0, TOUR);
  g.fillStyle = hsl(355, 90, 45 + 20 * m, (0.35 + 0.65 * m) * a);
  g.fill();
}
// Une petite hélice vue de côté : sa pale s'allonge et se raccourcit en tournant, son moyeu au milieu
function helice(cx: number, cy: number, l: number, vit: number, nb: number, beat: number, a: number, hsl: Palette) {
  const spin = Math.abs(Math.sin(nb * vit + beat));
  g.fillStyle = hsl(250, 10, 82, 0.65 * a);
  g.fillRect(cx - l * spin - 1, cy - 1, 2 * l * spin + 2, 2);
  g.beginPath();
  g.arc(cx, cy, 1.6, 0, TOUR);
  g.fillStyle = hsl(250, 12, 55, a);
  g.fill();
}

// Pigeon espion des Ruelles : un pigeon de tôle rivetée, aux ailes mécaniques qui battent, un objectif d'appareil
// photo pour œil et le son capturé dans un hublot du ventre. À l'approche, sa tête fait les à-coups d'un pigeon vers
// le joueur, ses ailes s'emballent, son objectif rougeoie et ses serres s'ouvrent.
export const pigeon: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    ph = frac(nb * (1 + m) + ev.beat * 0.37),
    // Les à-coups : la tête file en avant d'un coup puis attend ; en mouvement réduit, elle avance en douceur
    coup = reduced ? 0.5 - 0.5 * Math.cos(ph * TOUR) : ph < 0.12 ? ph / 0.12 : ph < 0.6 ? 1 : 1 - (ph - 0.6) / 0.4,
    hx = -8 - (1.5 + 4 * m) * coup,
    hy = -6 + 3.5 * m * coup,
    serre = 0.15 + 0.85 * m;
  poser(x, y, ev, nb, m, -0.1 * m);
  g.lineCap = "round";
  g.lineJoin = "round";
  // Une aile : trois plumes de tôle en éventail autour de leur charnière
  const aile = (cx: number, cy: number, dec: number, lum: number) => {
    const base = -1.15 - 0.55 * Math.sin(nb * Math.PI * (2 + 4 * m) + ev.beat * 2 + dec);
    for (let i = 2; i >= 0; i--) {
      g.save();
      g.translate(cx, cy);
      g.rotate(base + i * 0.34);
      rr(0, -1.7, 13 - 1.5 * i, 3.4, 1.7);
      g.fillStyle = hsl(250, 12, lum - 7 * i, a);
      g.fill();
      g.strokeStyle = hsl(250, 30, 8, 0.7 * a);
      g.lineWidth = 0.8;
      g.stroke();
      g.restore();
    }
  };
  aile(7, -4, 0.5, 44);
  // La queue
  g.beginPath();
  g.moveTo(9, -1);
  g.lineTo(18, -4);
  g.lineTo(19, 1);
  g.lineTo(10, 5);
  g.closePath();
  g.fillStyle = hsl(250, 12, 38, a);
  g.fill();
  // Les pattes et leurs serres, qui s'ouvrent vers le joueur
  g.strokeStyle = hsl(250, 10, 72, a);
  g.lineWidth = 1.3;
  for (const px of [-1, 5]) {
    g.beginPath();
    g.moveTo(px, 6);
    g.lineTo(px - 1, 11);
    g.stroke();
    for (const s of [-1, 0, 1]) {
      const an = Math.PI / 2 + 0.35 + s * (0.25 + 0.65 * serre);
      g.beginPath();
      g.moveTo(px - 1, 11);
      g.lineTo(px - 1 + 3.5 * Math.cos(an), 11 + 3.5 * Math.sin(an));
      g.stroke();
    }
  }
  // Le corps de tôle, sa couture rivetée et le hublot du son capturé
  g.beginPath();
  g.ellipse(2, 1, 10, 7.5, -0.1, 0, TOUR);
  g.fillStyle = hsl(250, 14, 52, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 78, a);
  g.lineWidth = 1.1;
  g.stroke();
  g.fillStyle = hsl(250, 20, 82, 0.7 * a);
  for (let i = 0; i < 4; i++) g.fillRect(-5 + 4 * i, -4.5 + 0.3 * i, 1.2, 1.2);
  g.beginPath();
  g.arc(2, 2, 4.8, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  son(2, 2, 3.6, col, pouls);
  // Le cou, avec son reflet de néon, et la tête
  g.strokeStyle = hsl(250, 14, 56, a);
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(-3, -1);
  g.lineTo(hx + 1, hy + 1);
  g.stroke();
  g.strokeStyle = hsl(330, 90, 66, 0.55 * a);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-5.5, -3.5);
  g.lineTo(-2.5, 1);
  g.stroke();
  g.beginPath();
  g.arc(hx, hy, 5, 0, TOUR);
  g.fillStyle = hsl(250, 14, 62, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 80, a);
  g.lineWidth = 1;
  g.stroke();
  // Le bec
  g.beginPath();
  g.moveTo(hx - 4.2, hy - 0.5);
  g.lineTo(hx - 8.5, hy + 1.5 + m);
  g.lineTo(hx - 4, hy + 2);
  g.closePath();
  g.fillStyle = hsl(250, 10, 80, a);
  g.fill();
  // L'objectif, qui rougeoie à l'approche
  g.beginPath();
  g.arc(hx - 0.8, hy - 1, 3, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 82, a);
  g.lineWidth = 1;
  g.stroke();
  oeil(hx - 0.8, hy - 1, 1.3, m, a, hsl);
  aile(4, -3, 0, 70);
  g.restore();
};

// Méduse néon du Quartier néon : une enseigne en forme de méduse, ombrelle et tentacules tracés en tubes
// lumineux, le son capturé brillant sous l'ombrelle. À l'approche, elle grésille comme un néon qui flanche, ses
// yeux rouges s'allument, et ses tentacules s'allongent et se tendent vers le joueur.
export const meduse: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    // Le néon qui flanche : des éclipses brèves, de plus en plus fréquentes ; aucune en mouvement réduit
    vacille = !reduced && m > 0.15 && hh(Math.floor(nb * 14), Math.floor(ev.beat * 12)) < 0.5 * m,
    lum = vacille ? 0.22 : 1,
    rx = 14 + 1.2 * pouls,
    ry = 12 - 1.6 * pouls,
    L = 14 + 7 * m;
  poser(x, y - 4, ev, nb, m, 0.22 * m);
  g.lineCap = "round";
  g.lineJoin = "round";
  // Un tube de néon : un trait épais et pâle, puis son filament clair
  const tube = (larg: number) => {
    g.strokeStyle = hsl(330, 90, 66, 0.42 * lum * a);
    g.lineWidth = larg;
    g.stroke();
    g.strokeStyle = hsl(330, 70, 90, lum * a);
    g.lineWidth = 1.3;
    g.stroke();
  };
  // Les tentacules, qui ondulent, s'allongent et se tendent vers le joueur
  for (let i = 0; i < 4; i++) {
    const x0 = -9 + 6 * i;
    g.beginPath();
    for (let k = 0; k <= 8; k++) {
      const t = k / 8,
        onde = (2.4 - 1.4 * m) * Math.sin(nb * Math.PI * (1 + m) + ev.beat + i * 1.7 + t * 4) * t;
      g.lineTo(x0 + onde - m * (6 + 1.5 * i) * t * t, 2 + L * t);
    }
    tube(3.2);
  }
  // L'ombrelle, qui bat au temps, voilée de la couleur du son capturé
  g.beginPath();
  g.ellipse(0, 1, rx, ry, 0, Math.PI, TOUR);
  for (let k = 0; k < 4; k++) {
    const xa = rx - (k * rx) / 2;
    g.quadraticCurveTo(xa - rx / 4, 4.5, xa - rx / 2, 1);
  }
  g.closePath();
  g.save();
  g.globalAlpha *= 0.22;
  g.fillStyle = col;
  g.fill();
  g.restore();
  tube(4.5);
  // Le liseré intérieur
  g.beginPath();
  g.ellipse(0, 1, rx - 5, ry - 4.5, 0, Math.PI * 1.1, Math.PI * 1.9);
  tube(2.6);
  son(0, -4, 4.4, col, pouls);
  // Les yeux, deux ampoules rouges sous l'ombrelle
  oeil(-6.5, -1, 1.2, m, lum * a, hsl);
  oeil(6.5, -1, 1.2, m, lum * a, hsl);
  g.restore();
};

// Lanterne espionne du Marché de nuit : une lanterne de papier rouge orangé, côtes visibles, suspendue à une petite
// hélice, le son capturé brillant dedans. À l'approche, elle s'ouvre en gueule dentée sur le son qu'elle serre, un
// œil rouge s'ouvre sur son papier et elle se balance vers le joueur.
export const lanterne: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    balance = 0.14 * Math.sin(nb * Math.PI * 0.5 + ev.beat) * (1 - 0.5 * m) + 0.3 * m,
    ouvre = clamp((m - 0.12) / 0.88, 0, 1) * (0.75 + 0.25 * pouls),
    // Chaque moitié pivote autour de la charnière, à droite, et la gueule s'ouvre à gauche, vers le joueur
    jaw = 0.34 * ouvre,
    papier = hsl(12, 80, 46 + 8 * pouls, a),
    cote = hsl(12, 60, 28, 0.8 * a);
  poser(x, y + 2, ev, nb, m);
  helice(0, -16, 11, 14 + 12 * m, nb, ev.beat, a, hsl);
  // Le fil et le balancement, autour du crochet sous l'hélice
  g.translate(0, -15);
  g.rotate(balance);
  g.strokeStyle = hsl(250, 10, 60, a);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 5);
  g.stroke();
  g.translate(0, 15);
  // Dessine dans le repère d'une moitié de la lanterne, ouverte autour de la charnière
  const dans = (bas: boolean, f: (s: number) => void) => {
    g.save();
    g.translate(12, 1);
    g.rotate(bas ? jaw : -jaw);
    g.translate(-12, -1);
    f(bas ? 1 : -1);
    g.restore();
  };
  // Une moitié de papier, ses côtes et son capuchon noir
  const moitie = (s: number) => {
    const de = s > 0 ? 0 : Math.PI;
    g.beginPath();
    g.ellipse(0, 1, 12, 10, 0, de, de + Math.PI);
    g.closePath();
    g.fillStyle = papier;
    g.fill();
    g.strokeStyle = cote;
    g.lineWidth = 1;
    for (const k of [0.4, 0.75]) {
      const w = 12 * Math.sqrt(1 - k * k);
      g.beginPath();
      g.moveTo(-w, 1 + s * 10 * k);
      g.lineTo(w, 1 + s * 10 * k);
      g.stroke();
    }
    g.beginPath();
    g.ellipse(0, 1, 5, 10, 0, de, de + Math.PI);
    g.stroke();
    rr(-6, s > 0 ? 10 : -10.5, 12, 2.6, 1);
    g.fillStyle = hsl(250, 30, 8, a);
    g.fill();
  };
  // Les crocs d'une moitié, qui sortent avec la gueule
  const crocs = (s: number) => {
    g.fillStyle = hsl(250, 10, 86, a);
    for (let i = 0; i < 4; i++) {
      const tx = -10.5 + 4 * i,
        h = (1.2 + 3.4 * ouvre) * (1 - 0.15 * i);
      g.beginPath();
      g.moveTo(tx - 1.5, 1);
      g.lineTo(tx, 1 - s * h);
      g.lineTo(tx + 1.5, 1);
      g.closePath();
      g.fill();
    }
  };
  // La gorge noire, entre les deux moitiés
  g.beginPath();
  g.moveTo(12, 1);
  g.lineTo(12 - 24 * Math.cos(jaw), 1 - 24 * Math.sin(jaw));
  g.lineTo(12 - 24 * Math.cos(jaw), 1 + 24 * Math.sin(jaw));
  g.closePath();
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  dans(true, moitie);
  // Le gland qui pend sous la lanterne
  dans(true, () => {
    g.strokeStyle = hsl(48, 85, 55, a);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, 12.5);
    g.lineTo(0, 16);
    g.stroke();
  });
  dans(false, moitie);
  // Le son capturé, serré dans la gueule, puis les crocs par-dessus
  son(-1 - 3 * ouvre, 1, 4.4, col, pouls);
  if (ouvre > 0.02) {
    dans(true, crocs);
    dans(false, crocs);
  }
  // L'œil, une fente fermée loin de la ligne, qui s'ouvre sur le joueur
  dans(false, () => {
    g.beginPath();
    g.ellipse(3, -5, 3.4, 0.6 + 2 * m, 0, 0, TOUR);
    g.fillStyle = hsl(250, 30, 8, a);
    g.fill();
    oeil(2.4, -4.8 + 0.3 * m, 1.1 + 0.3 * m, m, a, hsl);
  });
  g.restore();
};

// Mouette d'acier du Port : un goéland aux ailes en M qui plane, bec en crochet, le son capturé dans le poitrail.
// À l'approche, son bec s'ouvre sur un cri au temps, ses ailes se replient pour piquer sur le joueur et son œil
// rougeoie.
export const mouette: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    plane = Math.sin(nb * Math.PI * (0.5 + m) + ev.beat),
    pique = m * m,
    bec = m * (0.35 + 0.65 * pouls),
    // Le coude et le bout des ailes, de la plané en M au piqué replié
    ex = 8 - 1 * pique,
    ey = -8 + 1.5 * plane * (1 - pique) - 4 * pique,
    tx = 18 - 6 * pique,
    ty = -2 + 2.5 * plane * (1 - pique) - 12 * pique,
    // Au piqué, les deux ailes se rabattent vers l'arrière
    dos = 6 * pique;
  poser(x, y + 2, ev, nb, m, -0.08 - 0.45 * m);
  g.lineJoin = "round";
  // La queue
  g.beginPath();
  g.moveTo(8, -1);
  g.lineTo(15, -3);
  g.lineTo(15.5, 2.5);
  g.lineTo(8, 4);
  g.closePath();
  g.fillStyle = hsl(250, 10, 58, a);
  g.fill();
  // Les ailes en M, et leurs pointes noires
  for (const s of [1, -1]) {
    g.beginPath();
    g.moveTo(1 + s * 2, -1.5);
    g.lineTo(1 + s * ex + dos, ey);
    g.lineTo(1 + s * tx + dos * 1.5, ty);
    g.lineTo(1 + s * (ex + (tx - ex) * 0.2) + dos, ey + 3.8);
    g.lineTo(1 + s * 2, 2.5);
    g.closePath();
    g.fillStyle = hsl(250, 8, s > 0 ? 76 : 84, a);
    g.fill();
    g.strokeStyle = hsl(250, 20, 55, a);
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    g.moveTo(1 + s * tx + dos * 1.5, ty);
    g.lineTo(1 + s * (tx - 0.38 * (tx - ex)) + dos * 1.3, ty - 0.38 * (ty - ey));
    g.lineTo(1 + s * (tx - 0.3 * (tx - ex)) + dos * 1.3, ty + 0.3 * (ey + 3.8 - ty));
    g.closePath();
    g.fillStyle = hsl(250, 30, 8, a);
    g.fill();
  }
  // Le corps d'acier et le hublot du son capturé
  g.beginPath();
  g.ellipse(1, 1.5, 9, 5.5, 0, 0, TOUR);
  g.fillStyle = hsl(250, 8, 84, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 55, a);
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.arc(2, 2.2, 4.2, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  son(2, 2.2, 3.2, col, pouls);
  // La tête et le bec en crochet, qui s'ouvre sur le cri
  g.beginPath();
  g.arc(-8, -1, 4.4, 0, TOUR);
  g.fillStyle = hsl(250, 8, 88, a);
  g.fill();
  g.stroke();
  g.fillStyle = hsl(48, 85, 55, a);
  g.save();
  g.translate(-11.5, 0.3);
  g.rotate(0.55 * bec);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-5, 0.6);
  g.lineTo(0, 1.8);
  g.closePath();
  g.fill();
  g.restore();
  g.save();
  g.translate(-11.5, 0);
  g.rotate(-0.25 * bec);
  g.beginPath();
  g.moveTo(0, -2.2);
  g.quadraticCurveTo(-5, -2.4, -7, -0.6);
  g.quadraticCurveTo(-7.2, 1.2, -6.2, 1.6);
  g.lineTo(-5.6, 0.2);
  g.lineTo(0, 0.4);
  g.closePath();
  g.fill();
  g.restore();
  // L'œil, et le sourcil qui se fronce au piqué
  g.beginPath();
  g.arc(-8.6, -2.2, 1.7, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  oeil(-8.6, -2.2, 1.1, m, a, hsl);
  g.strokeStyle = hsl(250, 30, 8, (0.25 + 0.75 * m) * a);
  g.lineWidth = 1;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-11, -4.3 + 0.6 * m);
  g.lineTo(-7, -4.9 - 0.6 * m);
  g.stroke();
  g.restore();
};

// Gargouille de la Cathédrale : une tête de pierre à cornes qui vole sur des ailes de chauve-souris de pierre, le son
// capturé serré dans sa gueule de gouttière. À l'approche, elle déploie ses ailes, ouvre grand la mâchoire et ses
// yeux s'embrasent.
export const gargouille: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    bat = Math.sin(nb * Math.PI * (1 + 1.5 * m) + ev.beat),
    d = 0.25 + 0.75 * m,
    gueule = 1 + 6 * m * (0.7 + 0.3 * pouls),
    pierre = hsl(250, 8, 44, a),
    arete = hsl(250, 10, 70, a);
  poser(x, y, ev, nb, m, -0.16 * m);
  g.lineJoin = "round";
  // Les ailes de pierre, repliées loin de la ligne, déployées à l'approche
  for (const s of [-1, 1]) {
    const wy = -11 - 3 * d + 2.5 * bat;
    g.beginPath();
    g.moveTo(s * 6, -3);
    g.lineTo(s * (9 + 7 * d), wy);
    g.lineTo(s * (12 + 8 * d), -2 + bat);
    g.quadraticCurveTo(s * (9 + 5 * d), -2, s * (10 + 5 * d), 3);
    g.quadraticCurveTo(s * (8 + 2 * d), 2, s * 7, 6);
    g.closePath();
    g.fillStyle = hsl(250, 10, 30, a);
    g.fill();
    g.strokeStyle = arete;
    g.lineWidth = 0.9;
    g.stroke();
    // Les doigts de l'aile
    g.beginPath();
    g.moveTo(s * (9 + 7 * d), wy);
    g.lineTo(s * (10 + 5 * d), 3);
    g.stroke();
  }
  // Les cornes
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 2.5, -8.5);
    g.quadraticCurveTo(s * 9, -10, s * 9.5, -17);
    g.quadraticCurveTo(s * 7, -12, s * 6.5, -6.5);
    g.closePath();
    g.fillStyle = hsl(250, 10, 62, a);
    g.fill();
  }
  // La mâchoire de gouttière, qui tombe à l'approche, et ses crocs
  g.save();
  g.translate(0, gueule);
  rr(-6.5, 2, 13, 6, 2.5);
  g.fillStyle = pierre;
  g.fill();
  g.strokeStyle = arete;
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = hsl(250, 10, 84, a);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 5, 2.4);
    g.lineTo(s * 4, -0.6);
    g.lineTo(s * 3, 2.4);
    g.closePath();
    g.fill();
  }
  g.restore();
  // La tête, sa gueule noire et le son capturé entre ses crocs
  rr(-8, -9, 16, 13, 5);
  g.fillStyle = pierre;
  g.fill();
  g.strokeStyle = arete;
  g.stroke();
  rr(-5.5, 1.5, 11, 1.5 + gueule, 1.5);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  son(0, 3.4 + gueule * 0.5, 3.5, col, pouls);
  g.fillStyle = hsl(250, 10, 84, a);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 5.2, 1.4);
    g.lineTo(s * 4.2, 4.6);
    g.lineTo(s * 3.2, 1.4);
    g.closePath();
    g.fill();
  }
  // Le museau, les sourcils froncés et les yeux de braise
  g.fillStyle = hsl(250, 10, 34, a);
  g.fillRect(-1.5, -4, 3, 3.5);
  g.strokeStyle = hsl(250, 30, 8, a);
  g.lineWidth = 1.4;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 6.5, -7.5 + 0.8 * m);
    g.lineTo(s * 1.2, -5.2);
    g.stroke();
    g.beginPath();
    g.arc(s * 3.6, -3.8, 1.6, 0, TOUR);
    g.fillStyle = hsl(250, 30, 8, a);
    g.fill();
    oeil(s * 3.6, -3.8, 1.1, m, a, hsl);
  }
  g.restore();
};

// Sourdine du Club de jazz : un pavillon de trompette en laiton qui flotte sous une petite hélice, une sourdine-
// ventouse qui s'ouvre et se ferme devant lui au temps (wah-wah), le son capturé brillant au fond du pavillon. À
// l'approche, le pavillon se tourne vers le joueur, la sourdine claque plus fort et plus vite, un œil rouge s'ouvre
// au fond.
export const trompette: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    // Le wah-wah : la sourdine s'écarte sur le temps, puis revient ; deux fois par temps tout près de la ligne
    wah = (1 - frac(nb * (m > 0.6 ? 2 : 1))) ** 2,
    ecart = 0.6 + (2.2 + 4 * m) * wah,
    rot = 0.08 * Math.sin(nb * Math.PI * 0.5 + ev.beat) * (1 - m) - 0.42 * m,
    laiton = hsl(45, 70, 46, a),
    reflet = hsl(45, 80, 78, a);
  poser(x + 2, y + 1, ev, nb, m, rot);
  g.lineCap = "round";
  g.lineJoin = "round";
  // Le mât et l'hélice
  g.strokeStyle = hsl(250, 10, 60, a);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(7, -7);
  g.lineTo(7, -13);
  g.stroke();
  helice(7, -13, 10, 14 + 12 * m, nb, ev.beat, a, hsl);
  // La boucle de la coulisse et ses pistons
  rr(1, -8, 13, 6, 3);
  g.strokeStyle = laiton;
  g.lineWidth = 2;
  g.stroke();
  for (let k = 0; k < 3; k++) {
    rr(3.6 + 3 * k, -10.5, 2, 4, 0.8);
    g.fillStyle = reflet;
    g.fill();
  }
  // Le tube et le pavillon
  g.beginPath();
  g.moveTo(16, -2);
  g.lineTo(0, -2);
  g.quadraticCurveTo(-6, -3, -10, -10);
  g.lineTo(-10, 10);
  g.quadraticCurveTo(-6, 3, 0, 2);
  g.lineTo(16, 2);
  g.closePath();
  g.fillStyle = laiton;
  g.fill();
  g.strokeStyle = reflet;
  g.lineWidth = 1;
  g.stroke();
  rr(15, -3, 3, 6, 1);
  g.fillStyle = reflet;
  g.fill();
  // L'embouchure du pavillon : le son capturé au fond, et l'œil qui s'y ouvre
  g.beginPath();
  g.ellipse(-10, 0, 4.5, 10, 0, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  g.strokeStyle = reflet;
  g.lineWidth = 1.4;
  g.stroke();
  son(-10, 0, 4, col, pouls);
  if (m > 0.05) oeil(-10, 0, 1.3, m, a, hsl);
  // La sourdine-ventouse, qui claque devant le pavillon
  const sx = -14.5 - ecart;
  g.beginPath();
  g.ellipse(sx + 4, 0, 4, 9, 0, Math.PI / 2, (Math.PI * 3) / 2);
  g.closePath();
  g.fillStyle = hsl(250, 18, 26, a);
  g.fill();
  g.strokeStyle = hsl(250, 18, 58, a);
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = hsl(250, 10, 70, a);
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(sx, 0);
  g.lineTo(sx - 3, 0);
  g.stroke();
  g.restore();
};

// Caméra de surveillance du Métro : un boîtier sur un bras articulé, accroché à un petit rotor, un objectif à iris,
// un voyant REC, et le son capturé dans la lucarne de sa cassette. À l'approche, elle pivote vers le joueur, son
// iris se resserre sur une pupille rouge, son objectif s'allonge et REC clignote plus vite.
export const camera: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    vise = -((1 - m) * 0.28 * Math.sin(nb * 0.6 + ev.beat) + m * 0.8 * visee(x, y)),
    objectif = 3 + 6 * m,
    iris = 3.2 - 1.8 * m,
    rec = frac(nb * (1 + 3 * m) + ev.beat * 0.5) < 0.5;
  poser(x, y + 2, ev, nb, m);
  g.lineCap = "round";
  // Le rotor et le bras articulé
  helice(4, -16, 11, 14 + 12 * m, nb, ev.beat, a, hsl);
  g.strokeStyle = hsl(250, 12, 50, a);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(4, -16);
  g.lineTo(8, -11);
  g.lineTo(3, -6);
  g.stroke();
  g.fillStyle = hsl(250, 12, 70, a);
  g.beginPath();
  g.arc(8, -11, 1.5, 0, TOUR);
  g.fill();
  g.beginPath();
  g.arc(3, -6, 1.8, 0, TOUR);
  g.fill();
  // Le boîtier, qui pivote autour de son attache
  g.translate(3, -6);
  g.rotate(vise);
  g.translate(-3, 6);
  rr(-6, -4.5, 20, 11, 2.5);
  g.fillStyle = hsl(250, 12, 64, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 82, a);
  g.lineWidth = 1;
  g.stroke();
  // La visière
  g.fillStyle = hsl(250, 15, 40, a);
  g.fillRect(-9, -6.5, 24, 2.2);
  // La lucarne de la cassette, où bat le son capturé
  g.beginPath();
  g.arc(6, 1, 4.3, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  son(6, 1, 3.4, col, pouls);
  // Le voyant REC
  g.beginPath();
  g.arc(12, -2.5, 1.2, 0, TOUR);
  g.fillStyle = rec ? hsl(355, 90, 50 + 15 * m, (0.55 + 0.45 * m) * a) : hsl(250, 20, 25, a);
  g.fill();
  // L'objectif, qui s'allonge, et son iris
  rr(-6 - objectif, -3.5, objectif + 1, 7, 1);
  g.fillStyle = hsl(250, 15, 34, a);
  g.fill();
  g.beginPath();
  g.ellipse(-6 - objectif, 0, 2.6, 4.4, 0, 0, TOUR);
  g.fillStyle = hsl(250, 20, 72, a);
  g.fill();
  g.beginPath();
  g.ellipse(-6 - objectif, 0, 1.9 * (iris / 3.2), iris, 0, 0, TOUR);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  oeil(-6 - objectif, 0, 0.9, m, a, hsl);
  g.restore();
};

// Satellite espion de l'Observatoire : une parabole et deux panneaux solaires qui tournent lentement, le son capturé
// au foyer de la parabole. À l'approche, la parabole se braque sur le joueur et émet des arcs rouges concentriques.
export const satellite: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const pouls = (1 - (nb - Math.floor(nb))) ** 3,
    tourne = Math.cos(nb * 0.45 + ev.beat),
    w = 15 * (0.25 + 0.75 * Math.abs(tourne)),
    braque = (1 - m) * 0.3 * Math.sin(nb * 0.35 + ev.beat * 1.3) - m * visee(x, y);
  poser(x + 3, y, ev, nb, m, 0.08 * Math.sin(nb * 0.25 + ev.beat) * (1 - m));
  // Le mât et les panneaux solaires, qui tournent autour de lui
  g.strokeStyle = hsl(250, 10, 66, a);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(4, -15);
  g.lineTo(4, 15);
  g.stroke();
  for (const s of [-1, 1]) {
    const py = s > 0 ? 8.5 : -14.5;
    g.fillStyle = hsl(250, 35, tourne > 0 ? 28 : 18, a);
    g.fillRect(4 - w / 2, py, w, 6);
    g.strokeStyle = hsl(250, 25, 62, 0.7 * a);
    g.lineWidth = 0.7;
    g.strokeRect(4 - w / 2, py, w, 6);
    g.beginPath();
    for (let k = 1; k < 4; k++) {
      g.moveTo(4 - w / 2 + (k * w) / 4, py);
      g.lineTo(4 - w / 2 + (k * w) / 4, py + 6);
    }
    g.moveTo(4 - w / 2, py + 3);
    g.lineTo(4 + w / 2, py + 3);
    g.stroke();
  }
  // Le corps doré
  rr(0, -4.5, 9, 9, 1.5);
  g.fillStyle = hsl(45, 70, 46, a);
  g.fill();
  g.strokeStyle = hsl(45, 80, 76, a);
  g.lineWidth = 1;
  g.stroke();
  // La parabole, qui se braque sur le joueur
  g.rotate(braque);
  // Les arcs rouges qu'elle émet, au-delà d'un tiers de la menace
  if (m > 0.3) {
    const k = (m - 0.3) / 0.7;
    g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const p = reduced ? i / 3 + 0.15 : frac(nb * (1 + m) + i / 3),
        r = 6 + 20 * p;
      g.strokeStyle = hsl(355, 90, 60, (1 - p) * 0.85 * k * a);
      g.beginPath();
      g.arc(-13, 0, r, Math.PI - 0.5, Math.PI + 0.5);
      g.stroke();
    }
  }
  // Le dos de la coupe, puis sa face creuse tournée vers la cible
  g.beginPath();
  g.ellipse(-6, 0, 6, 10, 0, -Math.PI / 2, Math.PI / 2);
  g.closePath();
  g.fillStyle = hsl(250, 12, 52, a);
  g.fill();
  g.beginPath();
  g.ellipse(-6, 0, 3.6, 10, 0, 0, TOUR);
  g.fillStyle = hsl(250, 12, 82, a);
  g.fill();
  g.strokeStyle = hsl(250, 20, 50, a);
  g.lineWidth = 0.9;
  g.stroke();
  g.beginPath();
  g.ellipse(-5.5, 0, 2.2, 6.5, 0, 0, TOUR);
  g.fillStyle = hsl(250, 12, 66, a);
  g.fill();
  // Les bras du foyer et le son capturé
  g.strokeStyle = hsl(250, 10, 70, a);
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(-6, -9.5);
  g.lineTo(-13, 0);
  g.lineTo(-6, 9.5);
  g.stroke();
  son(-13, 0, 3.6, col, pouls);
  oeil(-5.5, 0, 1.2, m, a, hsl);
  g.restore();
};

export const ENNEMIS_VILLE: Record<string, DessinEnnemi> = {
  pigeon,
  meduse,
  lanterne,
  mouette,
  gargouille,
  trompette,
  camera,
  satellite,
};
