/* ---------- Le personnage en papier découpé (#78) ---------- */
// Le personnage de la basse, deux fois plus grand qu'avant, en pièces de papier cernées d'une encre qui bout :
// le coursier en patins de la Ville (bonnet, écharpe et mégaphone de la radio pirate), l'automate de la Boîte
// (chapeau haut de forme, clé de remontage dans le dos et pavillon doré). Il bat au temps, s'étire en sautant,
// s'écrase en retombant et se couche en glissant, assez bas pour passer sous les rideaux et les leviers.
// Ce module ne dessine qu'une pose qu'on lui donne ; `drawPlayer` (`scene.ts`) la calcule et place le personnage
// sur la scène (ADR-0019).
import { clamp } from "../outils";
import { COL, g } from "./outils";
import { bouillon, encre, papier, tache, type Point } from "./papier";

/** La pose du personnage à dessiner, ses pieds en (0, 0) */
export interface PoseDePapier {
  univers: string;
  /** Le temps de la chanson, et l'heure (performance.now) */
  nb: number;
  pnow: number;
  /** Il court (sur le sol, en partie), saute (`saut` : de 0 à 1 le long du saut, sinon -1), glisse, s'écrase (de 0 à 1) */
  court: boolean;
  saut: number;
  glisse: boolean;
  ecrase: number;
  /** Il vient de retomber : de 1 au contact du sol à 0 un instant après */
  atterrit: number;
  /** Il vient d'être touché */
  blesse: boolean;
  /** L'angle de son bras armé, en radians (0 : vers l'avant, négatif : vers le haut) */
  vise: number;
  /** Il vient de tirer : son bras recule */
  recul: number;
  /** L'angle de la clé de remontage de l'automate */
  cle: number;
}

const ENCRE = { ville: "#17142b", boite: "#2a0b12" };
// La taille du personnage : ses mesures sont celles de la maquette, à cette échelle
const TAILLE = 0.95;

/** L'étirement et l'inclinaison du personnage dans sa pose */
function forme(p: PoseDePapier) {
  let sx = 1,
    sy = 1,
    penche = 0;
  if (p.saut >= 0) {
    // Il s'étire en montant, se resserre au sommet, et s'allonge un peu en retombant
    sy = p.saut < 0.5 ? 1.18 - 0.36 * p.saut : 1 + 0.16 * (p.saut - 0.5);
    sx = 2 - sy;
    penche = -0.18 + 0.38 * p.saut;
  } else if (p.glisse) {
    // Couché en arrière, les pieds devant : il passe sous les obstacles hauts
    sy = 0.78;
    sx = 1.12;
    penche = -1.12;
  } else if (p.ecrase > 0) {
    sy = 1 - 0.35 * p.ecrase;
    sx = 1 + 0.35 * p.ecrase;
  } else if (p.atterrit > 0) {
    const w = Math.sin(p.atterrit * Math.PI) * p.atterrit;
    sy = 1 - 0.26 * w;
    sx = 1 + 0.2 * w;
  }
  // Il rebondit sur chaque temps
  if (p.saut < 0 && !p.glisse) {
    const f = ((p.nb % 1) + 1) % 1,
      b = Math.exp(-f * 9) * 0.06;
    sy *= 1 - b;
    sx *= 1 + b * 0.6;
  }
  return { sx, sy, penche };
}

/**
 * Dessine le personnage, ses pieds en (x, y) (le saut déjà compté), et renvoie le bout de son arme, d'où partent
 * les tirs, dans le même repère.
 */
export function dessinerPersonnage(x: number, y: number, sol: number, p: PoseDePapier): [number, number] {
  const ville = p.univers !== "boite",
    ink = ville ? ENCRE.ville : ENCRE.boite,
    im = bouillon(p.pnow),
    { sx, sy, penche } = forme(p),
    course = p.nb * Math.PI * 2,
    f = ((p.nb % 1) + 1) % 1,
    manteau = p.blesse ? COL.bad : ville ? "#e6a63a" : "#b3263a",
    pantalon = ville ? "#24306a" : "#f1e3c4",
    chaussure = ville ? "#c8443a" : "#2a0b12",
    peau = p.blesse ? "#f4a39a" : ville ? "#f2d2b0" : "#fbe7d0",
    contour = (pts: Point[], graine: number, fond: string, lw = 2, amp = 0.8) => {
      encre(pts, graine, im, amp);
      papier(fond, ink, lw);
    },
    rond = (cx: number, cy: number, rx: number, ry: number, graine: number, fond: string, lw = 2, ombre = true) => {
      tache(cx, cy, rx, ry, graine, im, 0.6);
      papier(fond, ink, lw, ombre);
    };
  // L'ombre au sol, plus petite quand il est en l'air
  const haut = Math.max(0, sol - y);
  g.fillStyle = `rgba(0,0,0,${0.32 - Math.min(0.2, haut / 600)})`;
  g.beginPath();
  g.ellipse(x + 4, sol + 4, 34 * (1 - Math.min(0.5, haut / 300)) * sx, 7, 0, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.translate(x, y - (p.glisse ? 14 : 0));
  g.rotate(penche);
  g.scale(sx * TAILLE, sy * TAILLE);
  g.lineCap = "round";
  g.lineJoin = "round";
  // Les jambes : elles courent au temps, se replient en l'air, se tendent en glissant
  const jambe = (cote: number) => {
    const a = p.glisse
      ? cote
        ? -1.45
        : -1.25
      : p.saut >= 0
        ? cote
          ? -0.7
          : 0.5
        : p.court
          ? Math.sin(course + (cote ? Math.PI : 0)) * 0.55
          : 0.08 * (cote ? 1 : -1);
    g.save();
    g.translate(cote ? 4 : -4, -38);
    g.rotate(-a);
    contour(
      [
        [-6, 0],
        [6, 0],
        [5.5, 32],
        [-5.5, 32],
      ],
      500 + cote * 9,
      cote ? pantalon : "#1b2450",
    );
    if (ville) {
      // Le patin et ses roues
      rond(4, 35, 11, 5, 520 + cote, chaussure);
      g.fillStyle = "#3a3346";
      g.fillRect(-6, 40, 20, 3);
      for (const rx of [-2, 10]) {
        g.beginPath();
        g.arc(rx, 45, 3, 0, Math.PI * 2);
        g.fillStyle = "#ff5fa2";
        g.fill();
      }
    } else rond(4, 35, 10, 5.5, 520 + cote, chaussure);
    g.restore();
  };
  jambe(0);
  // Le bras arrière, qui balance
  const balance = p.saut >= 0 ? -2.2 : p.glisse ? -2.6 : p.court ? Math.sin(course) * 0.6 + 0.2 : 0.25;
  g.save();
  g.translate(-8, -70);
  g.rotate(balance);
  contour(
    [
      [-5, 0],
      [5, 0],
      [4, 26],
      [-4, 26],
    ],
    540,
    ville ? "#b9832c" : "#7e1a2a",
  );
  rond(0, 28, 5.5, 5.5, 545, peau, 1.6);
  g.restore();
  if (ville) {
    // L'écharpe flotte derrière lui
    const v1 = Math.sin(p.pnow / 110) * 4,
      v2 = Math.sin(p.pnow / 110 + 1.2) * 6;
    contour(
      [
        [-6, -76],
        [-34, -74 + v1],
        [-50, -64 + v2],
        [-40, -60 + v2],
        [-26, -66 + v1],
        [-4, -68],
      ],
      560,
      "#d9483b",
      1.8,
    );
  } else {
    // La clé de remontage, dans le dos : elle tourne avec le ressort
    const k = Math.cos(p.cle);
    g.save();
    g.translate(-22, -58);
    g.fillStyle = "#d9a640";
    g.fillRect(-10, -2, 10, 4);
    g.scale(1, Math.abs(k) * 0.8 + 0.2);
    rond(-16, -8, 7, 7, 550, "#e8bf62", 1.6, false);
    rond(-16, 8, 7, 7, 551, "#e8bf62", 1.6, false);
    g.restore();
  }
  // Le torse
  contour(
    [
      [-18, -36],
      [18, -36],
      [15, -80],
      [-14, -80],
    ],
    570,
    manteau,
    2.4,
    0.9,
  );
  g.fillStyle = "rgba(255,255,255,.16)";
  g.fillRect(-14, -78, 9, 40);
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.arc(4, -46 - k * 10, 2.3, 0, Math.PI * 2);
    g.fillStyle = ville ? "#5a3a1f" : "#f0cd78";
    g.fill();
  }
  if (ville) rond(0, -80, 17, 6, 575, "#d9483b", 1.8);
  else
    contour(
      [
        [-10, -80],
        [10, -80],
        [0, -70],
      ],
      576,
      "#f6ecd6",
      1.4,
      0.5,
    );
  jambe(1);
  // La tête : elle hoche au temps ; les yeux suivent la visée, et clignent de temps en temps
  const hoche = p.saut >= 0 || p.glisse ? 0 : Math.exp(-f * 8) * 3;
  g.save();
  g.translate(2, -104 + hoche);
  g.rotate(p.saut >= 0 ? -0.1 : Math.sin(p.nb * Math.PI) * 0.05);
  rond(0, 0, 25, 24, 580, peau, 2.4);
  g.beginPath();
  g.arc(16, 9, 5, 0, Math.PI * 2);
  g.fillStyle = "rgba(240,110,110,.45)";
  g.fill();
  const cligne = p.pnow % 3700 < 120,
    regard = clamp((p.vise + 0.6) * 2, -2, 2);
  g.strokeStyle = ink;
  for (const ex of [6, 17]) {
    if (cligne) {
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(ex - 4, -2);
      g.lineTo(ex + 4, -2);
      g.stroke();
    } else {
      g.beginPath();
      g.ellipse(ex, -3, 4.5, 6, 0, 0, Math.PI * 2);
      g.fillStyle = "#fff";
      g.fill();
      g.lineWidth = 1.4;
      g.stroke();
      g.beginPath();
      g.arc(ex + 1.5, -4 + regard, 2.6, 0, Math.PI * 2);
      g.fillStyle = ink;
      g.fill();
    }
  }
  g.lineWidth = 2;
  if (p.recul > 0.2 || p.saut >= 0) {
    g.beginPath();
    g.ellipse(12, 11, 4, 4.5, 0, 0, Math.PI * 2);
    g.fillStyle = "#7a2230";
    g.fill();
    g.stroke();
  } else if (p.blesse) {
    g.beginPath();
    g.moveTo(7, 12);
    g.lineTo(17, 10);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(11, 7, 5, 0.3, 2.6);
    g.stroke();
  }
  if (ville) {
    // Le bonnet et son pompon, qui saute au temps
    contour(
      [
        [-25, -6],
        [-22, -20],
        [-10, -28],
        [8, -29],
        [22, -20],
        [26, -8],
      ],
      590,
      "#2f7f8a",
      2.2,
    );
    contour(
      [
        [-27, -10],
        [27, -10],
        [27, -3],
        [-27, -3],
      ],
      595,
      "#24646d",
      1.8,
      0.6,
    );
    rond(-4 + Math.sin(p.nb * Math.PI * 2 - 0.6) * 2, -33, 8, 8, 598, "#ffd35e", 1.8);
  } else {
    contour(
      [
        [-22, -12],
        [24, -12],
        [24, -7],
        [-22, -7],
      ],
      590,
      "#2a0b12",
      1.6,
      0.5,
    );
    contour(
      [
        [-14, -12],
        [16, -12],
        [14, -42],
        [-12, -42],
      ],
      591,
      "#2a0b12",
      1.8,
      0.6,
    );
    g.fillStyle = "#d9a640";
    g.fillRect(-13, -20, 28, 5);
  }
  g.restore();
  // Le bras armé et son mégaphone (ou son pavillon), tourné vers la note qui vient
  const vise = p.vise - penche;
  g.save();
  g.translate(8, -72);
  g.rotate(vise);
  g.translate(-6 * p.recul, 0);
  contour(
    [
      [0, -5],
      [26, -4],
      [26, 4],
      [0, 5],
    ],
    600,
    manteau,
    2,
    0.6,
  );
  rond(26, 0, 5.5, 5.5, 605, peau, 1.6);
  if (ville) {
    contour(
      [
        [26, -5],
        [58, -15],
        [60, 15],
        [26, 5],
      ],
      610,
      "#f4ead4",
      2.2,
      0.7,
    );
    g.fillStyle = "#d9483b";
    g.fillRect(40, -10, 7, 20);
    rond(59, 0, 4, 15, 615, "#d9483b", 1.8);
  } else {
    contour(
      [
        [26, -3],
        [44, -6],
        [58, -18],
        [60, 18],
        [44, 6],
        [26, 3],
      ],
      610,
      "#e8bf62",
      2,
      0.6,
    );
    rond(59, 0, 5, 18, 615, "#f6d78a", 1.8);
  }
  g.restore();
  g.restore();
  // Le bout de l'arme, ramené dans le repère de la scène
  const bx = 8 + Math.cos(vise) * 60,
    by = -72 + Math.sin(vise) * 60,
    c = Math.cos(penche),
    s = Math.sin(penche),
    X = bx * sx * TAILLE,
    Y = by * sy * TAILLE;
  return [x + c * X - s * Y, y - (p.glisse ? 14 : 0) + s * X + c * Y];
}
