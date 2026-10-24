/* ---------- Les ennemis de la Boîte à musique ---------- */
// Un ennemi par souvenir de la carte. Dans le grenier de la boîte, des créatures de papier, de laiton, de porcelaine
// et d'horlogerie ont avalé les notes : la note (sa couleur `col`) brille dans leur corps et bat au temps. Toutes
// regardent vers la gauche, d'où elles viennent, et se tournent vers le joueur, en bas à gauche, quand la menace
// monte. Les autres couleurs passent toutes par la palette, pour qu'une silhouette reste grise.
import { clamp } from "../outils";
import { CIBLE_Y, PW, PX, g, reduced, type DessinEnnemi } from "./outils";

const TAU = Math.PI * 2;
const mix = (u: number, v: number, t: number) => u + (v - u) * t;
/** Le battement de la note : 1 pile sur le temps, qui retombe aussitôt */
const battement = (nb) => (1 - (nb - Math.floor(nb))) ** 3;
/** L'angle sous lequel on voit le joueur depuis (x, y) : entre la gauche (π) et presque le bas */
const visee = (x, y) => clamp(Math.atan2(CIBLE_Y - y, PX + PW / 2 - x), Math.PI * 0.55, Math.PI);
/** De combien tourner un ennemi tourné vers la gauche pour qu'il fasse face au joueur, à la part `k` près */
const pencher = (x, y, m, k) => m * k * (visee(x, y) - Math.PI);
/**
 * Le déplacement d'un ennemi qui volette : une ondulation douce d'amplitude `lisse`, et des sursauts d'amplitude
 * `sursaut`, `vif` fois par temps. Rien en mouvement réduit.
 */
function saccade(nb, ev, lisse, sursaut, vif = 6): [number, number] {
  if (reduced) return [0, 0];
  const pas = Math.floor(nb * vif + ev.beat * 7);
  return [
    lisse * Math.sin(nb * 5.3 + ev.beat * 2) + sursaut * Math.sin(pas * 12.99),
    lisse * Math.sin(nb * 7.7 + ev.beat) + sursaut * Math.sin(pas * 78.23),
  ];
}
/** Ouvre le dessin d'un ennemi centré en (x, y), grossi au refrain et par la menace ; à refermer par `g.restore()` */
function poser(x, y, ev, m) {
  const k = (ev.kind === "refrain" ? 1.3 : 1) * (1 + 0.2 * m);
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.lineCap = "round";
  g.lineJoin = "round";
}
/** Trace un polygone fermé */
function trace(pts) {
  g.beginPath();
  for (const [px, py] of pts) g.lineTo(px, py);
  g.closePath();
}
/** La lueur de la note autour de (x, y), qui enfle au temps */
function lueur(x, y, r, col, p) {
  g.save();
  g.globalAlpha = 0.25 + 0.25 * p;
  g.beginPath();
  g.arc(x, y, r * (1 + 0.25 * p), 0, TAU);
  g.fillStyle = col;
  g.fill();
  g.restore();
}
/** Des yeux rouges de rayon r, qui s'allument avec la menace (`base` : leur éclat à m = 0), d'un halo au-delà de 0,3 */
function yeux(pts, r, m, a, hsl, base = 0.4) {
  for (const [ex, ey] of pts)
    if (m > 0.3) {
      g.beginPath();
      g.arc(ex, ey, r * 2 + 1.5 * m, 0, TAU);
      g.fillStyle = hsl(355, 90, 60, 0.3 * m * a);
      g.fill();
    }
  g.fillStyle = hsl(355, 90, 45 + 20 * m, (base + (1 - base) * m) * a);
  for (const [ex, ey] of pts) {
    g.beginPath();
    g.arc(ex, ey, r * (1 + 0.4 * m), 0, TAU);
    g.fill();
  }
}
/** Trace un engrenage de rayon r, à `dents` dents, tourné de `rot` */
function engrenage(r, dents, rot) {
  g.beginPath();
  for (let i = 0; i < dents; i++) {
    const a0 = rot + (i * TAU) / dents,
      d = TAU / dents;
    for (const [t, rad] of [
      [0, r * 0.78],
      [0.18, r],
      [0.5, r],
      [0.68, r * 0.78],
    ])
      g.lineTo(rad * Math.cos(a0 + t * d), rad * Math.sin(a0 + t * d));
  }
  g.closePath();
}
/** Des ailes translucides qui vibrent : chaque aile part de (ax, ay) sous l'angle `ang` ; en vol, des copies
 * décalées font le flou, écartées de `vibre` */
function ailesVibrantes(ailes, long, larg, vibre, ph, a, hsl) {
  const copies = reduced ? 1 : 3;
  g.lineWidth = 0.6;
  for (const [ax, ay, ang] of ailes)
    for (let c = 0; c < copies; c++) {
      g.save();
      g.translate(ax, ay);
      g.rotate(ang + (reduced ? 0 : vibre * (c - 1 + 0.6 * Math.sin(ph + c * 2.1))));
      g.beginPath();
      g.ellipse(long / 2, 0, long / 2, larg, 0, 0, TAU);
      g.fillStyle = hsl(45, 55, 80, (reduced ? 0.4 : 0.2) * a);
      g.fill();
      g.strokeStyle = hsl(42, 60, 62, (reduced ? 0.8 : 0.4) * a);
      g.stroke();
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(long * 0.9, 0);
      g.stroke();
      g.restore();
    }
}

// Hirondelle de papier plié (souvenir : un départ ; flûte à bec) : des facettes de papier, des plis, une queue
// fourchue, et la note qui brille dans le pli de sa poitrine. La menace rabat ses ailes en flèche le long du dos,
// resserre sa queue, allonge et pointe son bec sur le joueur, accélère ses battements, la fait voleter par saccades
// et allume ses yeux.
export const hirondelle: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    u = 0.5 + 0.5 * Math.sin(nb * Math.PI * 2 * (1 + m) + ev.beat * 3),
    [dx, dy] = saccade(nb, ev, 0.8, 2.5 * m),
    fourche = 7 - 3.5 * m,
    bec = 16 + 3 * m;
  poser(x + dx, y + dy, ev, m);
  g.rotate(pencher(x, y, m, 0.75) + (reduced ? 0 : 0.07 * Math.sin(nb * 2.3 + ev.beat)));
  g.lineWidth = 0.6;
  const pli = hsl(30, 25, 42, 0.8 * a);
  const facette = (pts, fond) => {
    trace(pts);
    g.fillStyle = fond;
    g.fill();
    g.strokeStyle = pli;
    g.stroke();
  };
  // Une aile : deux facettes de part et d'autre de son pli, levée et baissée au battement, en flèche à la menace
  const aile = (tx, ty, clair) => {
    facette(
      [
        [-4, -1],
        [tx, ty],
        [1, -1],
      ],
      hsl(40, 40, clair, a),
    );
    facette(
      [
        [1, -1],
        [tx, ty],
        [6, -1],
      ],
      hsl(34, 30, clair - 14, a),
    );
  };
  // L'aile du fond, plus sombre, puis la queue
  aile(mix(5, 16, m), mix(-2 - 11 * u, 0, m), 70);
  facette(
    [
      [5, -1],
      [19, -fourche],
      [12, 0.5],
      [19, fourche],
      [5, 2],
    ],
    hsl(36, 30, 74, a),
  );
  // Le corps : une facette claire au-dessus du pli, une plus sombre dessous
  facette(
    [
      [-13, -1],
      [-10, -4],
      [6, -2],
      [7, 1],
      [-3, 0],
    ],
    hsl(40, 40, 85, a),
  );
  facette(
    [
      [-13, -1],
      [-3, 0],
      [7, 1],
      [-2, 5],
      [-11, 2],
    ],
    hsl(32, 28, 64, a),
  );
  // Le bec, qui s'allonge vers le joueur
  facette(
    [
      [-12, -2.6],
      [-bec, -1],
      [-12, 0.8],
    ],
    hsl(28, 35, 42, a),
  );
  // La note, dans le pli de la poitrine
  const k = 1 + 0.2 * p;
  lueur(-5, 2.5, 5, col, p);
  trace([
    [-5 - 4 * k, 2.3],
    [-5, 2.5 - 2.4 * k],
    [-5 + 4 * k, 2.6],
    [-5, 2.5 + 2.4 * k],
  ]);
  g.fillStyle = col;
  g.fill();
  yeux([[-9.5, -1.6]], 1, m, a, hsl);
  // L'aile de devant, par-dessus le corps
  aile(mix(1, 15, m), mix(-4 - 13 * u, -4, m), 88);
  g.restore();
};

// Libellule de laiton (souvenir : une première danse ; violon) : quatre ailes fines qui vibrent, un long abdomen de
// segments, et la note dans le thorax. La menace recourbe l'abdomen en dard vers le joueur, fait bourdonner les
// ailes plus vite et plus large, la fait foncer par saccades et allume ses gros yeux.
export const libellule: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    [dx, dy] = saccade(nb, ev, 0.6, 2 * m, 4),
    ph = nb * Math.PI * 2 * (5 + 6 * m) + ev.beat;
  poser(x + dx, y + dy, ev, m);
  g.rotate(pencher(x, y, m, 0.4));
  ailesVibrantes(
    [
      [-6, -1, -1.78],
      [-6, 1, 1.78],
      [-3, -1, -1.3],
      [-3, 1, 1.3],
    ],
    13.5,
    2.2,
    0.08 + 0.2 * m,
    ph,
    a,
    hsl,
  );
  // L'abdomen : huit segments qui se recourbent vers le bas et l'avant, jusqu'au dard
  let sx = -2.5,
    sy = 0,
    ang = 0;
  for (let i = 0; i < 8; i++) {
    ang += m * 0.34 + 0.04 * Math.sin(nb * Math.PI + ev.beat - i * 0.6);
    const nx = sx + 2.4 * Math.cos(ang),
      ny = sy + 2.4 * Math.sin(ang);
    g.beginPath();
    g.ellipse((sx + nx) / 2, (sy + ny) / 2, 1.7, 1.6 - i * 0.06, ang, 0, TAU);
    g.fillStyle = hsl(42, 60, i % 2 ? 40 : 54, a);
    g.fill();
    sx = nx;
    sy = ny;
  }
  const dard = 1.5 + 4.5 * m;
  g.save();
  g.translate(sx, sy);
  g.rotate(ang);
  trace([
    [0, -1],
    [dard, 0],
    [0, 1],
  ]);
  g.fillStyle = hsl(20, 60, 50, a);
  g.fill();
  g.restore();
  // Le thorax et sa note
  lueur(-7, 0, 5.5, col, p);
  g.beginPath();
  g.ellipse(-7, 0, 4.4 * (1 + 0.12 * p), 3.5, 0, 0, TAU);
  g.fillStyle = col;
  g.fill();
  g.strokeStyle = hsl(42, 60, 55, a);
  g.lineWidth = 0.8;
  g.stroke();
  // La tête et ses gros yeux
  g.beginPath();
  g.arc(-12.6, 0, 2.8, 0, TAU);
  g.fillStyle = hsl(42, 55, 46, a);
  g.fill();
  yeux(
    [
      [-13.6, -1.7],
      [-13.6, 1.7],
    ],
    1.25,
    m,
    a,
    hsl,
  );
  g.restore();
};

// Araignée d'horlogerie (souvenir : un après-midi de pluie ; kalimba) : suspendue à son fil de soie, un abdomen en
// engrenage qui tourne par crans et où brille la note, huit pattes articulées. La menace ouvre et tend ses pattes
// vers le joueur, la fait descendre et remonter le long du fil par à-coups, et allume ses huit yeux.
export const araignee: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    pas = Math.floor(nb * 4 + ev.beat * 3),
    d = m * (reduced ? 4 : 2 + 6 * (0.5 + 0.5 * Math.sin(pas * 2.4))),
    swing = reduced ? 0 : 0.07 * Math.sin(nb * Math.PI * 0.5 + ev.beat);
  poser(x, y, ev, m);
  // Elle se balance au bout de son fil, accroché une trentaine de pixels plus haut
  g.translate(0, -30);
  g.rotate(swing);
  g.translate(0, 30 + d);
  g.strokeStyle = hsl(40, 30, 82, 0.6 * a);
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(0, -30 - d);
  g.lineTo(0, -9);
  g.stroke();
  // Les pattes : cuisse puis jambe, qui battent la mesure, s'ouvrent et se tendent à la menace
  g.strokeStyle = hsl(40, 45, 44, a);
  g.lineWidth = 1.2;
  for (const s of [-1, 1])
    for (let k = 0; k < 4; k++) {
      const hx = s * 2.2,
        hy = 2.5 + k * 1.3,
        vie = 0.12 * Math.sin(nb * Math.PI + k * 1.3 + s + ev.beat) + 0.12 * m * p,
        t1 = -1.05 + k * 0.5 - 0.35 * m - vie,
        t2 = t1 + 1.3 - 0.8 * m,
        kx = hx + s * 7 * Math.cos(t1),
        ky = hy + 7 * Math.sin(t1);
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(kx, ky);
      g.lineTo(kx + s * 8 * Math.cos(t2), ky + 8 * Math.sin(t2));
      g.stroke();
    }
  // L'abdomen en engrenage, qui tourne d'un cran à chaque demi-temps, et la note en son moyeu
  engrenage(6.8, 8, Math.floor(nb * 2 + ev.beat) * (Math.PI / 8));
  g.fillStyle = hsl(42, 60, 52, a);
  g.fill();
  g.strokeStyle = hsl(40, 45, 30, a);
  g.lineWidth = 0.6;
  g.stroke();
  g.beginPath();
  g.arc(0, -3, 4.6, 0, TAU);
  g.fillStyle = hsl(30, 40, 22, a);
  g.fill();
  lueur(0, -3, 4.5, col, p);
  g.beginPath();
  g.arc(0, -3, 3.6 * (1 + 0.15 * p), 0, TAU);
  g.fillStyle = col;
  g.fill();
  // La tête de cuivre, ses crochets qui s'écartent et ses huit yeux
  g.strokeStyle = hsl(20, 50, 35, a);
  g.lineWidth = 1;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 1, 8.5);
    g.lineTo(s * (1.3 + 1.2 * m), 11 + m);
    g.lineTo(s * 0.4, 12 + 1.2 * m);
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 6, 3.8, 0, TAU);
  g.fillStyle = hsl(20, 60, 45, a);
  g.fill();
  yeux(
    [
      [-2.1, 5.8],
      [-0.75, 5.2],
      [0.75, 5.2],
      [2.1, 5.8],
      [-1.6, 7.5],
      [-0.55, 8],
      [0.55, 8],
      [1.6, 7.5],
    ],
    0.55,
    m,
    a,
    hsl,
    0.3,
  );
  g.restore();
};

// Guêpe de cuivre (souvenir : une dispute ; mandoline) : un abdomen rayé de laiton et de noir où la note fait une
// bande de lumière, un dard, des ailes vibrantes. La menace replie l'abdomen sous elle et braque le dard sur le
// joueur, ouvre ses mandibules, rend son bourdonnement nerveux (des saccades rapides) et allume ses yeux.
export const guepe: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    [dx, dy] = saccade(nb, ev, 0.7, 0.6 + 2.6 * m, 10),
    braque = m * 1.95 + 0.12 * p + (reduced ? 0 : 0.05 * Math.sin(nb * 6 + ev.beat)),
    ph = nb * Math.PI * 2 * (6 + 6 * m) + ev.beat;
  poser(x + dx, y + dy, ev, m);
  g.rotate(pencher(x, y, m, 0.45));
  // Les pattes, sous le thorax, qui griffent au temps à la menace
  const griffe = 1.5 * m * p;
  g.strokeStyle = hsl(20, 50, 32, a);
  g.lineWidth = 1;
  for (const [hx, kx, fx] of [
    [-6, -8, -10],
    [-4, -4.5, -6],
    [-2, 0, 1],
  ]) {
    g.beginPath();
    g.moveTo(hx, 2.5);
    g.lineTo(kx, 6.5 + griffe);
    g.lineTo(fx - griffe, 8.5);
    g.stroke();
  }
  // L'abdomen, rattaché à la taille, qui se replie pour braquer le dard
  g.save();
  g.translate(0.5, 0.5);
  g.rotate(braque);
  lueur(8, 0, 6.5, col, p);
  g.beginPath();
  g.ellipse(8, 0, 8.5, 5.2, 0, 0, TAU);
  g.fillStyle = hsl(42, 65, 55, a);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = hsl(250, 30, 8, a);
  for (const [bx, bw] of [
    [2.3, 2.2],
    [11, 2],
    [15, 3],
  ])
    g.fillRect(bx, -6, bw, 12);
  g.fillStyle = col;
  g.fillRect(5.4 - 0.6 * p, -6, 4.4 + 1.2 * p, 12);
  g.restore();
  g.strokeStyle = hsl(20, 55, 30, a);
  g.lineWidth = 0.8;
  g.stroke();
  trace([
    [16, -1.3],
    [18.5 + 3.5 * m, 0],
    [16, 1.3],
  ]);
  g.fillStyle = hsl(40, 20, 88, a);
  g.fill();
  g.restore();
  // Le thorax et la tête de cuivre
  g.beginPath();
  g.ellipse(-4, -0.5, 4.8, 4, 0, 0, TAU);
  g.fillStyle = hsl(20, 60, 45, a);
  g.fill();
  g.beginPath();
  g.ellipse(-4.5, -2, 2.6, 1.3, -0.2, 0, TAU);
  g.fillStyle = hsl(25, 60, 64, 0.6 * a);
  g.fill();
  g.beginPath();
  g.arc(-10.5, 0.5, 3.8, 0, TAU);
  g.fillStyle = hsl(20, 55, 36, a);
  g.fill();
  // Les mandibules, qui s'ouvrent
  g.strokeStyle = hsl(20, 60, 58, a);
  g.lineWidth = 0.9;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(-13, 2.6);
    g.lineTo(-15 - m, 2.8 + s * (0.4 + 1.6 * m));
    g.stroke();
  }
  yeux([[-11.6, -0.6]], 1.6, m, a, hsl, 0.45);
  // Les antennes, qui frémissent
  g.strokeStyle = hsl(20, 50, 40, a);
  g.lineWidth = 0.8;
  for (const s of [0, 1]) {
    const fr = reduced ? 0 : (0.6 + 1.4 * m) * Math.sin(nb * 13 + s * 2 + ev.beat);
    g.beginPath();
    g.moveTo(-12 + s, -2.8);
    g.lineTo(-14 + s * 1.5, -8 + fr * 0.4);
    g.lineTo(-17.5 + s * 1.5, -8.5 + fr);
    g.stroke();
  }
  // Les ailes, par-dessus, qui vibrent
  ailesVibrantes(
    [
      [-4, -3.5, -0.5],
      [-3, -3, -0.15],
    ],
    13,
    2.4,
    0.1 + 0.25 * m,
    ph,
    a,
    hsl,
  );
  g.restore();
};

// Colombe de porcelaine fêlée (souvenir : un mariage ; clavecin) : blanche, parcourue de fêlures fines qui partent
// de son cœur, où bat la note. La menace fait rougeoyer les fêlures, dresse ses ailes au-dessus du dos, ouvre son
// bec, la penche vers le joueur et fait passer son œil noir au rouge.
export const colombe: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    bat = Math.sin(nb * Math.PI * 2 + ev.beat * 3),
    [dx, dy] = saccade(nb, ev, 0.5, 1.5 * m),
    dresse = mix(0.12 + 0.18 * bat, -1.25 + 0.12 * bat, m);
  poser(x + dx, y + dy, ev, m);
  g.rotate(pencher(x, y, m, 0.45));
  // Une aile : un éventail de porcelaine, pivotant à l'épaule
  const aile = (rot, clair) => {
    g.save();
    g.translate(-1, -3);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(7, -5.5, 16, -2.5);
    for (const [px, py] of [
      [13.5, -0.5],
      [15, 1],
      [11.5, 2],
      [12.5, 3.6],
      [8, 3.5],
    ])
      g.lineTo(px, py);
    g.quadraticCurveTo(3, 4, 0, 0);
    g.fillStyle = hsl(40, 18, clair, a);
    g.fill();
    g.strokeStyle = hsl(35, 15, 58, a);
    g.lineWidth = 0.7;
    g.stroke();
    g.beginPath();
    g.moveTo(4, 0.5);
    g.lineTo(12, -0.8);
    g.moveTo(5, 2);
    g.lineTo(10.5, 2);
    g.stroke();
    g.restore();
  };
  aile(dresse - 0.3, 74);
  // La queue en éventail
  trace([
    [8, 0],
    [19, -3.5],
    [20, 1],
    [18.5, 5],
    [8, 4.5],
  ]);
  g.fillStyle = hsl(40, 15, 80, a);
  g.fill();
  g.strokeStyle = hsl(35, 15, 58, a);
  g.lineWidth = 0.7;
  g.stroke();
  // Le corps et la tête : le trait du bord, puis la porcelaine par-dessus
  const silhouette = () => {
    g.beginPath();
    g.ellipse(1, 1.5, 10.5, 6.8, -0.1, 0, TAU);
    g.moveTo(-3.9, -4.5);
    g.arc(-8.5, -4.5, 4.6, 0, TAU);
  };
  silhouette();
  g.lineWidth = 1.4;
  g.stroke();
  silhouette();
  g.fillStyle = hsl(40, 20, 90, a);
  g.fill();
  // Le bec, qui s'ouvre
  g.fillStyle = hsl(20, 40, 62, a);
  trace([
    [-12.5, -5.6],
    [-16.2, -4.4 - 0.8 * m],
    [-12.6, -3.8],
  ]);
  g.fill();
  trace([
    [-12.6, -3.8],
    [-15.4, -3.4 + 1.6 * m],
    [-12.4, -2.8],
  ]);
  g.fill();
  // Les fêlures, grises, qui rougeoient à la menace
  const felures = () => {
    g.beginPath();
    for (const ligne of [
      [
        [-4, 2],
        [-1, -1],
        [2, -0.5],
        [4, -4],
        [7, -3],
      ],
      [
        [-4, 2],
        [-6.5, 4.5],
        [-5, 7],
      ],
      [
        [-4, 2],
        [0, 4.2],
        [3, 3.2],
        [6.5, 6.5],
      ],
      [
        [-8, -9],
        [-7.2, -6.5],
        [-9, -3.5],
      ],
    ]) {
      g.moveTo(ligne[0][0], ligne[0][1]);
      for (const [px, py] of ligne) g.lineTo(px, py);
    }
  };
  felures();
  g.strokeStyle = hsl(30, 12, 50, 0.9 * a);
  g.lineWidth = 0.6;
  g.stroke();
  if (m > 0.3) {
    g.strokeStyle = hsl(355, 90, 60, 0.35 * m * a);
    g.lineWidth = 2.2;
    g.stroke();
  }
  if (m > 0) {
    g.strokeStyle = hsl(355, 90, 50 + 15 * m, m * a);
    g.lineWidth = 0.8;
    g.stroke();
  }
  // Le cœur, où bat la note
  const c = 3 * (1 + 0.2 * p);
  lueur(-4, 2, 5, col, p);
  g.beginPath();
  g.moveTo(-4, 2 + 0.9 * c);
  g.bezierCurveTo(-4 - 1.4 * c, 2 - 0.1 * c, -4 - 0.6 * c, 2 - 1.1 * c, -4, 2 - 0.4 * c);
  g.bezierCurveTo(-4 + 0.6 * c, 2 - 1.1 * c, -4 + 1.4 * c, 2 - 0.1 * c, -4, 2 + 0.9 * c);
  g.fillStyle = col;
  g.fill();
  // L'œil noir, qui passe au rouge
  g.beginPath();
  g.arc(-9.5, -5.5, 1.3, 0, TAU);
  g.fillStyle = hsl(250, 30, 8, a);
  g.fill();
  if (m > 0) yeux([[-9.5, -5.5]], 1.1, m, m * a, hsl, 1);
  // L'aile de devant, qui se dresse
  aile(dresse, 86);
  g.restore();
};

// Masque de bal vénitien (souvenir : un bal masqué ; piano jouet) : il flotte, ses rubans ondulent derrière lui, et
// la note est la pierre précieuse de son front. La menace étire un sourire denté sous le masque, fait apparaître des
// yeux rouges dans les orbites vides, fait fouetter les rubans et le penche vers le joueur.
export const masque: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    [dx, dy] = saccade(nb, ev, 0.5, 1.5 * m),
    vite = nb * Math.PI * 2 * (0.5 + (reduced ? 0 : 1.3 * m)) + ev.beat,
    ample = 1.4 + (reduced ? 1 : 3.5) * m;
  poser(x + dx, y + dy, ev, m);
  g.rotate(pencher(x, y, m, 0.3) + (reduced ? 0 : 0.06 * Math.sin(nb * Math.PI * 0.5 + ev.beat)));
  // Les rubans, noués aux tempes, qui flottent derrière le masque
  for (const [ox, oy, dec, long, ep, teinte, clair] of [
    [11, -3, 0, 13, 2.2, 20, 45],
    [10, 0, 2.2, 10, 1.7, 42, 58],
  ]) {
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      g.lineTo(ox + long * t, oy + 4 * t + ample * t * Math.sin(vite - t * 5 + dec));
    }
    g.strokeStyle = hsl(teinte, 60, clair, a);
    g.lineWidth = ep;
    g.stroke();
  }
  // Le masque de porcelaine bordé de laiton
  g.beginPath();
  g.moveTo(0, -3.5);
  g.bezierCurveTo(-4, -7, -9, -6, -14, -10);
  g.bezierCurveTo(-13, -4, -14, 1, -10, 4);
  g.bezierCurveTo(-7, 6.5, -3, 5, 0, 2.5);
  g.bezierCurveTo(3, 5, 7, 6.5, 10, 4);
  g.bezierCurveTo(14, 1, 13, -4, 14, -10);
  g.bezierCurveTo(9, -6, 4, -7, 0, -3.5);
  g.closePath();
  g.fillStyle = hsl(40, 20, 90, a);
  g.fill();
  g.strokeStyle = hsl(42, 65, 55, a);
  g.lineWidth = 1.3;
  g.stroke();
  // Les arabesques de laiton autour des orbites, et les orbites vides
  g.lineWidth = 0.7;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 6, -1.2, 5.4, 3.5, -s * 0.15, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
  }
  g.fillStyle = hsl(250, 30, 8, a);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 6, -1, 3.6, 1.7 + 0.5 * m, -s * 0.15, 0, TAU);
    g.fill();
  }
  // Les yeux qui apparaissent au fond des orbites et regardent le joueur
  yeux(
    [
      [-6 - m, -1 + 0.5 * m],
      [6 - m, -1 + 0.5 * m],
    ],
    1,
    m,
    a,
    hsl,
    0.1,
  );
  // La pierre du front, sertie de laiton sur un petit cimier
  const k = 1 + 0.15 * p;
  g.strokeStyle = hsl(42, 65, 55, a);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, -3.5);
  g.lineTo(0, -5);
  g.stroke();
  lueur(0, -8, 5, col, p);
  trace([
    [0, -8 - 3.4 * k],
    [2.6 * k, -8],
    [0, -8 + 3.4 * k],
    [-2.6 * k, -8],
  ]);
  g.fillStyle = col;
  g.fill();
  g.stroke();
  // Le sourire denté, qui s'étire sous le masque
  if (m > 0.02) {
    const w = 3 + 8 * m,
      h = 1.5 + 3.5 * m,
      gy = 7.5,
      haut = (u) => gy + 0.5 * h * (1 - (u / w) ** 2),
      bas = (u) => gy + 1.7 * h * (1 - (u / w) ** 2);
    g.beginPath();
    for (let i = 0; i <= 12; i++) g.lineTo(-w + (i * w) / 6, haut(-w + (i * w) / 6));
    for (let i = 12; i >= 0; i--) g.lineTo(-w + (i * w) / 6, bas(-w + (i * w) / 6));
    g.fillStyle = hsl(355, 50, 14, m * a);
    g.fill();
    g.fillStyle = hsl(40, 20, 90, Math.min(1, 1.5 * m) * a);
    const n = 7,
      tw = w / n;
    for (let i = 0; i < n; i++) {
      const u = -w + (i + 0.5) * 2 * tw,
        h1 = haut(u),
        h2 = bas(u),
        dent = (h2 - h1) * 0.6;
      trace([
        [u - tw * 0.8, h1],
        [u + tw * 0.8, h1],
        [u, h1 + dent],
      ]);
      g.fill();
      trace([
        [u - tw * 0.6, h2],
        [u + tw * 0.6, h2],
        [u, h2 - dent * 0.7],
      ]);
      g.fill();
    }
  }
  g.restore();
};

// Chauve-souris de papier découpé (souvenir : un train de nuit ; orgue de Barbarie) : des ailes festonnées qui
// battent, la note dans son ventre. La menace lui fait ouvrir grand les ailes et battre plus vite, montrer ses
// crocs, allumer ses yeux, la penche vers le joueur et la fait voleter par saccades.
export const chauvesouris: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    ph = Math.sin(nb * Math.PI * 2 * (1 + 1.2 * m) + ev.beat * 3),
    ouv = mix(0.65 + 0.35 * ph, 0.9 + 0.1 * ph, m),
    W = 5 + 12 * ouv + 3 * m,
    ty = mix(-3 - 5 * ph, -8 + 1.5 * ph, m),
    [dx, dy] = saccade(nb, ev, 1, 2.5 * m);
  poser(x + dx, y + dy, ev, m);
  g.rotate(pencher(x, y, m, 0.35));
  // Les ailes : le bord d'attaque jusqu'à la pointe, puis des festons creusés entre les doigts
  for (const s of [-1, 1]) {
    const doigts = [
      [s * W, ty],
      [s * W * 0.72, ty * 0.3 + 4],
      [s * W * 0.45, 5.5],
      [s * 2.5, 5],
    ];
    g.beginPath();
    g.moveTo(s * 2, -3);
    g.quadraticCurveTo(s * W * 0.45, ty - 3, s * W, ty);
    for (let i = 1; i < doigts.length; i++) {
      const [ax, ay] = doigts[i - 1],
        [bx, by] = doigts[i];
      g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 2.6, bx, by);
    }
    g.closePath();
    g.fillStyle = hsl(28, 32, 32, a);
    g.fill();
    g.strokeStyle = hsl(32, 35, 60, a);
    g.lineWidth = 0.8;
    g.stroke();
    // Les doigts, depuis le poignet
    const px = s * (2 + 0.38 * (W - 2)),
      py = ty * 0.6 - 2.5;
    g.beginPath();
    for (const [fx, fy] of doigts.slice(0, 3)) {
      g.moveTo(px, py);
      g.lineTo(fx, fy);
    }
    g.strokeStyle = hsl(30, 30, 50, 0.8 * a);
    g.lineWidth = 0.6;
    g.stroke();
  }
  // Le corps et la note dans son ventre
  g.beginPath();
  g.ellipse(0, 1, 3.4, 5.6, 0, 0, TAU);
  g.fillStyle = hsl(26, 30, 22, a);
  g.fill();
  g.strokeStyle = hsl(32, 35, 60, a);
  g.lineWidth = 0.8;
  g.stroke();
  lueur(0, 1.5, 4.5, col, p);
  g.beginPath();
  g.ellipse(0, 1.5, 2.2 * (1 + 0.15 * p), 3.4, 0, 0, TAU);
  g.fillStyle = col;
  g.fill();
  // Les pieds, en crochets
  g.strokeStyle = hsl(30, 30, 50, a);
  g.lineWidth = 0.7;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 1.2, 6.4);
    g.lineTo(s * 1.6, 8.4);
    g.lineTo(s * 0.8, 8.8);
    g.stroke();
  }
  // La tête et ses oreilles pointues
  g.fillStyle = hsl(26, 30, 22, a);
  g.strokeStyle = hsl(32, 35, 60, a);
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(0, -5.5, 3.3, 0, TAU);
  for (const s of [-1, 1]) {
    g.moveTo(s * 0.6, -7.8);
    g.lineTo(s * 3.2, -12.5);
    g.lineTo(s * 3.2, -6);
  }
  g.stroke();
  g.fill();
  yeux(
    [
      [-1.3, -6],
      [1.3, -6],
    ],
    0.85,
    m,
    a,
    hsl,
  );
  // La gueule et ses crocs, qui sortent à la menace
  if (m > 0.05) {
    g.beginPath();
    g.ellipse(0, -3.4, 1.7 * m, 0.9 * m, 0, 0, TAU);
    g.fillStyle = hsl(355, 50, 14, a);
    g.fill();
    g.fillStyle = hsl(40, 20, 90, a);
    for (const s of [-1, 1]) {
      trace([
        [s * 0.35, -3.9],
        [s * 1.4, -3.9],
        [s * 0.85, -3.9 + 2.4 * m],
      ]);
      g.fill();
    }
  }
  g.restore();
};

// Chouette automate (souvenir : un rêve ; harmonica de verre) : un plumage en écailles de laiton, des aigrettes,
// de grands yeux dont les iris sont des engrenages qui tournent, et la note dans la lucarne de sa poitrine. Au
// repos, sa tête bascule par petits crans d'horloge. La menace tourne sa tête vers le joueur, change ses iris en
// spirales rouges qui tournent de plus en plus vite et entrouvre ses ailes.
export const chouette: DessinEnnemi = (x, y, ev, col, a, nb, hsl, m = 0) => {
  const p = battement(nb),
    [dx, dy] = saccade(nb, ev, 0, 1.2 * m, 4),
    tic = reduced ? 0 : 0.14 * Math.sin(Math.floor(nb * 2 + ev.beat) * 2.1) * (1 - m),
    fx = -2.2 * m,
    fy = 1.4 * m,
    ouvre = 0.1 + 0.75 * m + 0.05 * p,
    rot = nb * (0.7 + 2.5 * m);
  poser(x + dx, y + dy - 0.8 * p, ev, m);
  g.scale(0.92, 0.92);
  g.rotate(pencher(x, y, m, 0.12));
  // Les ailes, derrière le corps, qui s'entrouvrent
  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * 7.5, -2);
    g.rotate(-s * ouvre);
    g.beginPath();
    g.ellipse(0, 7, 3.8, 8.5, 0, 0, TAU);
    g.fillStyle = hsl(40, 50, 40, a);
    g.fill();
    g.strokeStyle = hsl(42, 60, 58, a);
    g.lineWidth = 0.7;
    g.stroke();
    g.beginPath();
    for (const py of [6, 9.5, 13]) {
      g.moveTo(-3, py - 1);
      g.quadraticCurveTo(0, py + 1.5, 3, py - 1);
    }
    g.stroke();
    g.restore();
  }
  // Le corps, en écailles de laiton
  g.beginPath();
  g.ellipse(0, 4, 10, 11, 0, 0, TAU);
  g.fillStyle = hsl(42, 55, 50, a);
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = hsl(40, 50, 34, a);
  g.lineWidth = 0.7;
  g.beginPath();
  for (let r = 0; r < 6; r++)
    for (let sx = -10 + (r % 2) * 1.7; sx < 11; sx += 3.4) {
      g.moveTo(sx + 1.9, -2 + r * 3.2);
      g.arc(sx, -2 + r * 3.2, 1.9, 0, Math.PI);
    }
  g.stroke();
  g.restore();
  g.strokeStyle = hsl(40, 45, 30, a);
  g.lineWidth = 0.8;
  g.stroke();
  // Les serres de cuivre
  g.strokeStyle = hsl(20, 60, 45, a);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 3, 14.5);
    g.lineTo(s * 2, 16.5);
    g.moveTo(s * 3, 14.5);
    g.lineTo(s * 4, 16.5);
    g.stroke();
  }
  // La lucarne de la poitrine et sa note
  g.beginPath();
  g.arc(0, 7.5, 4.6, 0, TAU);
  g.fillStyle = hsl(45, 70, 64, a);
  g.fill();
  lueur(0, 7.5, 4.5, col, p);
  g.beginPath();
  g.arc(0, 7.5, 3.6 * (1 + 0.12 * p), 0, TAU);
  g.fillStyle = col;
  g.fill();
  // La tête, qui bascule par crans au repos et se tourne vers le joueur à la menace
  g.save();
  g.translate(0, -7);
  g.rotate(pencher(x, y, m, 0.3) + tic);
  g.fillStyle = hsl(40, 45, 38, a);
  g.strokeStyle = hsl(42, 60, 58, a);
  g.lineWidth = 0.7;
  for (const s of [-1, 1]) {
    trace([
      [s * 4.5, -5.5],
      [s * 8.5 + fx * 0.3, -12.5],
      [s * 8.8, -2.5],
    ]);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, 0, 9.5, 7.5, 0, 0, TAU);
  g.fillStyle = hsl(44, 55, 56, a);
  g.fill();
  g.strokeStyle = hsl(40, 45, 30, a);
  g.stroke();
  g.beginPath();
  g.ellipse(fx * 0.6, 0.3 + fy * 0.5, 8.4 - Math.abs(fx) * 0.3, 6, 0, 0, TAU);
  g.fillStyle = hsl(40, 20, 86, a);
  g.fill();
  // Les yeux : un anneau de laiton, un iris en engrenage, puis la spirale rouge de la menace
  for (const s of [-1, 1]) {
    const ex = fx + s * 4.3,
      ey = fy - 0.3;
    g.beginPath();
    g.arc(ex, ey, 4, 0, TAU);
    g.fillStyle = hsl(45, 70, 58, a);
    g.fill();
    g.beginPath();
    g.arc(ex, ey, 3.3, 0, TAU);
    g.fillStyle = hsl(250, 30, 8, a);
    g.fill();
    g.save();
    g.translate(ex, ey);
    engrenage(2.9, 8, s * rot);
    g.fillStyle = hsl(42, 60, 60, (1 - 0.8 * m) * a);
    g.fill();
    g.beginPath();
    g.arc(0, 0, 1.4, 0, TAU);
    g.fillStyle = hsl(250, 30, 8, a);
    g.fill();
    if (m > 0) {
      g.beginPath();
      for (let t = 0; t < 3 * Math.PI; t += 0.25) {
        const r = 0.3 + t * 0.29;
        g.lineTo(r * Math.cos(t - s * rot * 2), r * Math.sin(t - s * rot * 2));
      }
      g.strokeStyle = hsl(355, 90, 50 + 15 * m, m * a);
      g.lineWidth = 0.8;
      g.stroke();
    }
    g.restore();
    yeux([[ex, ey]], 0.8, m, a, hsl);
  }
  // Le bec de cuivre
  trace([
    [fx - 1.3, fy + 1.5],
    [fx + 1.3, fy + 1.5],
    [fx, fy + 4.5],
  ]);
  g.fillStyle = hsl(20, 60, 45, a);
  g.fill();
  g.restore();
  g.restore();
};

/** Les ennemis de la Boîte, par identifiant de souvenir */
export const ENNEMIS_BOITE: Record<string, DessinEnnemi> = {
  hirondelle,
  libellule,
  araignee,
  guepe,
  colombe,
  masque,
  chauvesouris,
  chouette,
};
