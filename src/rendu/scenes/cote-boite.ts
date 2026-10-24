/* ---------- La Boîte à musique en papier découpé (#78) ---------- */
// Le diorama de la Boîte dans la scène de côté : le fond marbré du couvercle et ses filets dorés, la poussière qui
// danse, des engrenages qui avancent d'un cran à chaque temps, une rangée de maisons de papier marbré au milieu et
// une rangée de tours, de bobines et d'engrenages au premier plan. Les souvenirs retrouvés (#25) pendent au mur en
// photographies ; les traces des notes parfaites (#29) y sont des étoiles phosphorescentes collées. Les cordes sont
// des cordes de harpe, tendues entre des colonnes dorées.
import { progression } from "../../jeu/etat";
import { COULEUR_BASSE } from "../../jeu/traces";
import { lieuxReussis } from "../../sauvegarde/format";
import { TH } from "../../univers/univers";
import { W, energy, g, hh, reduced, teinteDeTrace } from "../outils";
import { alea, cuit, grainSur, ombre, piece, poserPiece, rectDecoupe, remplir, toile, type Piece } from "../papier";
import type { VueDeScene } from "./contrat";
import type { SceneDeCote } from "./cote";
import { GY, LANE_Y } from "./cote-mesures";
import { banniere } from "./cote-ville";
import type { Diorama, Rebond } from "./cote-papier";

const ENCRE = "#2a0b12";

/** Une pièce de la rangée : sa pièce, sa largeur et sa hauteur, et ses fenêtres rondes (centre et rayon) */
interface Maison {
  p: Piece;
  w: number;
  h: number;
  fenetres: { x: number; y: number }[];
}
const RANGEES = {
  milieu: { vitesse: 0.3, pas: 150, pied: GY - 4, n: 7 },
  pres: { vitesse: 0.55, pas: 185, pied: GY + 4, n: 6 },
};

// Du papier marbré, cuit en carreau qui se répète
function marbre(graine: number, fond: string, couleurs: string[], s = 300) {
  const [c, x] = toile(s, s),
    r = alea(graine);
  x.fillStyle = fond;
  x.fillRect(0, 0, s, s);
  const f1 = 0.01 + r() * 0.02,
    f2 = 0.03 + r() * 0.03;
  for (let k = 0; k < 90; k++) {
    const y0 = (k / 90) * s * 1.3 - s * 0.15;
    x.strokeStyle = couleurs[k % couleurs.length];
    x.globalAlpha = 0.35 + r() * 0.4;
    x.lineWidth = 1 + r() * 4;
    x.beginPath();
    for (let px = -10; px <= s + 10; px += 8) {
      const yy = y0 + Math.sin(px * f1 * 3.14 + k * 0.15) * 26 + Math.sin(px * f2 + y0 * 0.05) * 9;
      if (px === -10) x.moveTo(px, yy);
      else x.lineTo(px, yy);
    }
    x.stroke();
  }
  x.globalAlpha = 1;
  grainSur(x, s, s, 0.4);
  return c;
}
const marbres = () =>
  cuit("boite-marbres", () => ({
    rose: marbre(21, "#e9d6bf", ["#c87a7a", "#f4e6cf", "#8a3b46", "#d9a640", "#ebc7b0"]),
    sarcelle: marbre(22, "#1e4b52", ["#2f6e72", "#d9c08a", "#123437", "#7fb0a8", "#244f55"]),
    creme: marbre(23, "#efe2c4", ["#d9c39a", "#f8efda", "#c9a46a", "#e7d4b0"]),
  }));

function cuireMur() {
  const [c, x] = toile(W, GY + 20),
    fond = marbre(24, "#3d0d19", ["#5c1627", "#7a2234", "#2a1018", "#9a6b33", "#4a1020", "#24464a"], 420);
  x.fillStyle = x.createPattern(fond, "repeat");
  x.fillRect(0, 0, W, GY + 20);
  x.fillStyle = "rgba(40,6,14,.55)";
  x.fillRect(0, 0, W, GY + 20);
  const v = x.createRadialGradient(600, 260, 120, 600, 300, 760);
  v.addColorStop(0, "rgba(255,190,120,.12)");
  v.addColorStop(1, "rgba(10,0,4,.7)");
  x.fillStyle = v;
  x.fillRect(0, 0, W, GY + 20);
  // Les filets dorés du couvercle
  x.save();
  ombre(x, 2, 3, 6, "rgba(0,0,0,.6)");
  x.strokeStyle = "#c99a43";
  x.lineWidth = 5;
  x.strokeRect(16, 16, W - 32, GY + 40);
  x.restore();
  x.strokeStyle = "rgba(255,225,150,.5)";
  x.lineWidth = 1;
  x.strokeRect(26, 26, W - 52, GY + 40);
  // Le grand médaillon
  x.save();
  ombre(x, 3, 6, 16, "rgba(0,0,0,.55)");
  x.beginPath();
  x.arc(880, 185, 78, 0, Math.PI * 2);
  x.fillStyle = "#4c1220";
  x.fill();
  x.restore();
  x.strokeStyle = "#d9a640";
  x.lineWidth = 4;
  x.beginPath();
  x.arc(880, 185, 68, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "#d9a640";
  x.font = "italic 700 46px Georgia, serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("♪", 878, 187);
  grainSur(x, W, GY + 20, 0.45);
  return c;
}

/** Un engrenage de papier ajouré, de rayon R ; `loin` : un grand, au fond */
function cuireEngrenage(v: number, loin: boolean) {
  const r = alea(300 + v),
    R = loin ? 90 + r() * 50 : 50 + r() * 24,
    dents = Math.round(R / (loin ? 10 : 8)),
    s = R * 2 + 20;
  const p = piece(
    s,
    s,
    22,
    (x) => {
      const c = s / 2,
        ri = R - (loin ? 14 : 10);
      x.beginPath();
      for (let k = 0; k < dents; k++) {
        const a = (k / dents) * Math.PI * 2,
          d = Math.PI / dents;
        x.lineTo(c + Math.cos(a - d * 0.55) * ri, c + Math.sin(a - d * 0.55) * ri);
        x.lineTo(c + Math.cos(a - d * 0.35) * R, c + Math.sin(a - d * 0.35) * R);
        x.lineTo(c + Math.cos(a + d * 0.35) * R, c + Math.sin(a + d * 0.35) * R);
        x.lineTo(c + Math.cos(a + d * 0.55) * ri, c + Math.sin(a + d * 0.55) * ri);
      }
      x.closePath();
      x.fillStyle = loin ? "#4e1322" : ["#8a2133", "#6e1a29", "#9a2a36"][v % 3];
      x.fill();
      x.strokeStyle = "#d9a640";
      x.lineWidth = loin ? 3 : 2.5;
      x.beginPath();
      x.arc(c, c, ri * 0.82, 0, Math.PI * 2);
      x.stroke();
      // Les découpes, à travers lesquelles on voit le fond
      x.save();
      x.globalCompositeOperation = "destination-out";
      const n = loin ? 6 : 5;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        x.beginPath();
        x.ellipse(c + Math.cos(a) * ri * 0.5, c + Math.sin(a) * ri * 0.5, ri * 0.17, ri * 0.22, a, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
      x.beginPath();
      x.arc(c, c, ri * 0.2, 0, Math.PI * 2);
      x.fillStyle = "#d9a640";
      x.fill();
    },
    { ombre: loin ? [4, 7, 16, "rgba(0,0,0,.55)"] : [4, 6, 10, "rgba(0,0,0,.5)"] },
  );
  return { p, dents };
}
const engrenages = () => cuit("boite-engrenages", () => [0, 1, 2, 3, 4, 5].map((v) => cuireEngrenage(v, v < 3)));

// Un engrenage avance d'un cran à chaque temps, d'un coup sec
function engrenage(e: ReturnType<typeof cuireEngrenage>, x: number, y: number, sens: number, nb: number) {
  const f = ((nb % 1) + 1) % 1,
    cran = ((Math.PI * 2) / e.dents) * (reduced ? 0.35 : 1),
    a = sens * (Math.floor(nb) + depasse(Math.min(1, f / 0.22))) * cran;
  g.save();
  g.translate(x, y);
  g.rotate(a);
  poserPiece(e.p, -e.p.w / 2, -e.p.h / 2);
  g.restore();
}
const depasse = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

function cuireMaison(v: number): Maison {
  const r = alea(700 + v),
    w = Math.round(76 + r() * 56),
    h = Math.round(130 + r() * 100),
    toit = Math.round(46 + r() * 36),
    cw = w + 12,
    ch = h + toit,
    fenetres: Maison["fenetres"] = [],
    M = marbres();
  const p = piece(
    cw,
    ch,
    16,
    (x) => {
      x.beginPath();
      x.rect(6, toit, w, h + 4);
      x.fillStyle = x.createPattern(v % 2 ? M.sarcelle : M.rose, "repeat");
      x.fill();
      x.fillStyle = "rgba(40,0,10,.3)";
      x.fillRect(6, toit, w, h + 4);
      x.save();
      ombre(x, 0, 3, 5, "rgba(0,0,0,.45)");
      x.beginPath();
      x.moveTo(0, toit + 2);
      if (v % 3 === 0) x.quadraticCurveTo(cw / 2, -toit * 0.4, cw, toit + 2);
      else {
        x.lineTo(cw / 2, 4);
        x.lineTo(cw, toit + 2);
      }
      x.closePath();
      x.fillStyle = "#7a1b2c";
      x.fill();
      x.restore();
      x.strokeStyle = "#d9a640";
      x.lineWidth = 2;
      x.stroke();
      const n = Math.max(1, Math.floor(w / 34)),
        rangs = Math.floor((h - 36) / 48);
      for (let j = 0; j < rangs; j++)
        for (let i = 0; i < n; i++) {
          const cx = 6 + (w / n) * (i + 0.5),
            cy = toit + 32 + j * 48;
          x.beginPath();
          x.arc(cx, cy, 11, 0, Math.PI * 2);
          x.fillStyle = "#d9a640";
          x.fill();
          x.beginPath();
          x.arc(cx, cy, 8, 0, Math.PI * 2);
          x.fillStyle = ENCRE;
          x.fill();
          fenetres.push({ x: cx, y: cy });
        }
    },
    { ombre: [3, 5, 12, "rgba(10,0,4,.55)"] },
  );
  return { p, w: cw, h: ch, fenetres };
}
// Le premier plan : une tour crème coiffée de rouge, ou une bobine de fil
function cuirePres(v: number): Maison {
  const r = alea(900 + v),
    M = marbres();
  if (v % 2 === 0) {
    const w = Math.round(70 + r() * 30),
      h = Math.round(120 + r() * 70),
      toit = 64,
      cw = w + 20,
      ch = h + toit;
    const p = piece(
      cw,
      ch,
      16,
      (x) => {
        x.beginPath();
        x.rect(10, toit, w, h + 4);
        x.fillStyle = x.createPattern(M.creme, "repeat");
        x.fill();
        const d = x.createLinearGradient(10, 0, 10 + w, 0);
        d.addColorStop(0, "rgba(255,255,255,.15)");
        d.addColorStop(1, "rgba(60,10,10,.25)");
        x.fillStyle = d;
        x.fillRect(10, toit, w, h + 4);
        x.save();
        ombre(x, 0, 4, 5, "rgba(0,0,0,.4)");
        remplir(
          x,
          [
            [0, toit + 4],
            [cw / 2, 0],
            [cw, toit + 4],
          ],
          "#9a2235",
        );
        x.restore();
        remplir(
          x,
          [
            [cw / 2, 0],
            [cw, toit + 4],
            [cw / 2, toit + 4],
          ],
          "rgba(0,0,0,.18)",
        );
        x.fillStyle = "#d9a640";
        x.fillRect(4, toit, cw - 8, 6);
        x.fillRect(10, toit + h - 14, w, 4);
        for (let j = 0; j < 3; j++) {
          const cy = toit + 32 + j * 42;
          if (cy > toit + h - 36) break;
          x.beginPath();
          x.ellipse(cw / 2, cy, 12, 16, 0, 0, Math.PI * 2);
          x.fillStyle = "#7a1b2c";
          x.fill();
          x.beginPath();
          x.ellipse(cw / 2, cy, 8, 12, 0, 0, Math.PI * 2);
          x.fillStyle = ENCRE;
          x.fill();
        }
      },
      { ombre: [4, 6, 12, "rgba(10,0,4,.55)"] },
    );
    return { p, w: cw, h: ch, fenetres: [] };
  }
  const w = 70 + r() * 20,
    h = 90 + r() * 36,
    cw = w + 8,
    fil = ["#5fd6c6", "#e86a7d", "#f1e1b6", "#b9a3ff"][v % 4];
  const p = piece(
    cw,
    h,
    16,
    (x) => {
      x.fillStyle = fil;
      x.fillRect(12, 14, cw - 24, h - 28);
      x.strokeStyle = "rgba(0,0,0,.25)";
      x.lineWidth = 1;
      for (let yy = 16; yy < h - 14; yy += 3) {
        x.beginPath();
        x.moveTo(12, yy);
        x.lineTo(cw - 12, yy + 1.5);
        x.stroke();
      }
      const d = x.createLinearGradient(12, 0, cw - 12, 0);
      d.addColorStop(0, "rgba(0,0,0,.25)");
      d.addColorStop(0.35, "rgba(255,255,255,.2)");
      d.addColorStop(1, "rgba(0,0,0,.35)");
      x.fillStyle = d;
      x.fillRect(12, 14, cw - 24, h - 28);
      x.save();
      ombre(x, 0, 3, 4, "rgba(0,0,0,.45)");
      rectDecoupe(x, 0, 0, cw, 16, r, "#b5824a");
      rectDecoupe(x, 0, h - 16, cw, 16, r, "#b5824a");
      x.restore();
    },
    { ombre: [4, 6, 10, "rgba(10,0,4,.55)"] },
  );
  return { p, w: cw, h, fenetres: [] };
}

const mur = () => cuit("boite-mur", cuireMur);
const maisons = (rangee: "milieu" | "pres") =>
  cuit(`boite-${rangee}`, () =>
    Array.from({ length: RANGEES[rangee].n }, (_, v) => (rangee === "pres" ? cuirePres(v) : cuireMaison(v))),
  );

// La poussière qui danse dans la lumière, en grains dorés
const POUSSIERE = Array.from({ length: 40 }, (_, i) => ({
  x: hh(i, 1) * 1300,
  y: 60 + hh(i, 2) * 420,
  v: 4 + hh(i, 3) * 10,
  p: hh(i, 4) * 6,
  s: 1 + hh(i, 5) * 2.2,
}));

function plans(vue: VueDeScene, cote: SceneDeCote, k: Rebond) {
  const { nb, hsl, pnow } = vue,
    t = pnow / 1000,
    defile = cote.defile(nb);
  g.drawImage(mur(), -12, -12, W + 24, GY + 32);
  // Les souvenirs déjà retrouvés (#25) restent accrochés au mur : une photographie sépia de plus par souvenir
  const retrouves = lieuxReussis(progression(), "boite").length,
    woff = defile * 0.12,
    k0 = Math.floor(woff / 64);
  if (retrouves)
    for (let i = k0; i < k0 + W / 64 + 2; i++) {
      if (hh(i, 30) >= 0.06 * retrouves) continue;
      const x = i * 64 - woff + 14,
        y = 60 + hh(i, 31) * 110;
      g.save();
      g.translate(x + 17, y + 13);
      g.rotate((hh(i, 32) - 0.5) * 0.16);
      g.fillStyle = "rgba(0,0,0,.35)";
      g.fillRect(-17, -12, 38, 30);
      g.fillStyle = hsl(40, 45, 42);
      g.fillRect(-19, -15, 38, 30);
      g.fillStyle = hsl(34, 40, 68);
      g.fillRect(-15, -11, 30, 22);
      g.fillStyle = hsl(28, 30, 40);
      g.beginPath();
      g.arc(0, -3, 4, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-6, 3, 12, 8);
      // Un morceau de ruban adhésif
      g.fillStyle = "rgba(244,227,161,.55)";
      g.fillRect(-8, -19, 16, 7);
      g.restore();
    }
  // La poussière
  g.fillStyle = "#f3cf74";
  for (const m of POUSSIERE) {
    const x = ((((m.x - (reduced ? 0 : t * m.v) - defile * 0.06) % 1300) + 1300) % 1300) - 10,
      y = m.y + Math.sin(t * 0.8 + m.p) * 8;
    g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + m.p);
    g.fillRect(x, y, m.s, m.s);
  }
  g.globalAlpha = 1;
  // Les grands engrenages du fond, qui avancent d'un cran à chaque temps
  const E = engrenages(),
    base = defile * 0.12;
  for (let i = Math.floor((base - 300) / 330); i <= Math.floor((base + W + 300) / 330); i++)
    engrenage(E[((i % 3) + 3) % 3], i * 330 - base + hh(i, 1) * 80, 330 + hh(i, 3) * 60, i % 2 ? 1 : -1, nb * 0.5);
  // Les maisons du milieu : leurs fenêtres rondes s'allument avec le combo
  const allumees = 0.08 + 0.5 * energy();
  rangee("milieu", vue, cote, k, (i, m) => {
    for (const [n, f] of m.fenetres.entries()) {
      if (hh(i * 977 + n, 50) >= allumees) continue;
      g.beginPath();
      g.arc(f.x - m.w / 2, f.y - m.h, 8, 0, Math.PI * 2);
      g.fillStyle = hsl(42, 90, 76, 0.9);
      g.fill();
    }
  });
  // Le premier plan : des tours et des bobines, et de temps en temps un engrenage
  rangee("pres", vue, cote, k, undefined, (i, x) => {
    if (hh(i, 9) >= 0.28) return false;
    engrenage(E[3 + (((i % 3) + 3) % 3)], x, RANGEES.pres.pied - 80, i % 2 ? 1 : -1, nb);
    return true;
  });
  etoiles(vue, cote);
}

function rangee(
  nom: "milieu" | "pres",
  vue: VueDeScene,
  cote: SceneDeCote,
  k: Rebond,
  dessus?: (i: number, m: Maison) => void,
  autre?: (i: number, x: number) => boolean,
) {
  const R = RANGEES[nom],
    base = cote.defile(vue.nb) * R.vitesse,
    sq = k(nom === "pres" ? 1.1 : 0.7, nom === "pres" ? 0 : 0.03),
    M = maisons(nom);
  for (let i = Math.floor((base - 260) / R.pas); i <= Math.floor((base + W + 260) / R.pas); i++) {
    const x = i * R.pas + hh(i, 7) * 50 - base;
    if (autre?.(i, x)) continue;
    const m = M[Math.floor(hh(i, 4) * R.n)];
    g.save();
    g.translate(x, R.pied);
    g.scale(sq.x, sq.y);
    poserPiece(m.p, -m.w / 2, -m.h);
    dessus?.(i, m);
    g.restore();
  }
}

/**
 * Les étoiles phosphorescentes des notes parfaites (#29, ADR-0015) : collées au premier plan, à la hauteur où la
 * note a été jouée (son couloir pour la mélodie, près du sol pour la basse), à la couleur de son couloir. Une
 * étoile de papier doré, son cœur de la couleur de la note ; elle luit au rythme, et celle qu'on vient de coller
 * se pose d'un coup et brille fort un instant.
 */
function etoiles(vue: VueDeScene, cote: SceneDeCote) {
  const { nb, hsl, pulsation: bp } = vue;
  for (const { t, couleur, x, frais } of cote.traces(nb, RANGEES.pres.vitesse)) {
    const y = (couleur === COULEUR_BASSE ? GY - 70 : LANE_Y[couleur]) + (hh(t, 71) - 0.5) * 50,
      r = 8 * (1 + 0.8 * frais),
      teinte = teinteDeTrace(couleur),
      tourne = hh(t, 72) * Math.PI,
      branches = (rr: number, dx = 0, dy = 0) => {
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = tourne + (k * Math.PI) / 5,
            d = k % 2 ? rr * 0.45 : rr;
          g.lineTo(x + dx + d * Math.cos(a), y + dy + d * Math.sin(a));
        }
        g.closePath();
      };
    g.beginPath();
    g.arc(x, y, r * 2.2, 0, Math.PI * 2);
    g.fillStyle = hsl(teinte, 80, 70, 0.1 + 0.08 * bp + 0.3 * frais);
    g.fill();
    branches(r, 1.5, 2.5);
    g.fillStyle = "rgba(0,0,0,.4)";
    g.fill();
    branches(r);
    g.fillStyle = "#e8b33c";
    g.fill();
    branches(r * 0.62);
    g.fillStyle = hsl(teinte, 80, 72 + 15 * frais, 0.95);
    g.fill();
  }
}

/* ---------- Le pop-up du refrain : rayons, manège, bannière ---------- */
function popup(): Piece[] {
  const rayons = piece(
    560,
    300,
    20,
    (x) => {
      for (let k = 0; k < 15; k++) {
        const a0 = Math.PI + (k / 15) * Math.PI,
          a1 = a0 + Math.PI / 15;
        remplir(
          x,
          [
            [280, 300],
            [280 + Math.cos(a0) * 300, 300 + Math.sin(a0) * 300],
            [280 + Math.cos(a1) * 300, 300 + Math.sin(a1) * 300],
          ],
          k % 2 ? "#e9b44c" : "#fff0c4",
        );
      }
    },
    { ombre: [3, 5, 14, "rgba(0,0,0,.5)"] },
  );
  const manege = piece(320, 260, 20, (x) => {
    const r = alea(16);
    rectDecoupe(x, 20, 226, 280, 34, r, "#d9a640");
    rectDecoupe(x, 30, 236, 260, 24, r, "#7a1b2c");
    for (let k = 0; k < 5; k++) rectDecoupe(x, 52 + k * 52, 96, 7, 132, r, "#f0cd78");
    for (let k = 0; k < 8; k++)
      remplir(
        x,
        [
          [160, 10],
          [20 + k * 35, 100],
          [55 + k * 35, 100],
        ],
        k % 2 ? "#f6ecd6" : "#b3263a",
      );
    for (let k = 0; k < 10; k++) {
      x.beginPath();
      x.arc(34 + k * 28, 100, 14, 0, Math.PI);
      x.fillStyle = k % 2 ? "#f6ecd6" : "#b3263a";
      x.fill();
    }
    x.beginPath();
    x.arc(160, 8, 8, 0, Math.PI * 2);
    x.fillStyle = "#d9a640";
    x.fill();
    // Des étoiles suspendues
    for (let k = 0; k < 4; k++) {
      const sx = 78 + k * 52,
        sy = 150 + (k % 2) * 26;
      x.strokeStyle = "#f0cd78";
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(sx, 114);
      x.lineTo(sx, sy - 10);
      x.stroke();
      x.beginPath();
      for (let j = 0; j < 10; j++) {
        const a = -Math.PI / 2 + (j * Math.PI) / 5,
          d = j % 2 ? 5.4 : 12;
        x.lineTo(sx + d * Math.cos(a), sy + d * Math.sin(a));
      }
      x.closePath();
      x.fillStyle = "#ffd34a";
      x.fill();
    }
  });
  return [rayons, manege, banniere(TH().refrain, "#f6ecd6", ENCRE, "#8e1d2e", "Georgia, serif")];
}

/* ---------- Les cordes de harpe, leurs colonnes, le cylindre ---------- */
function corde(ligne: () => void, voie: number) {
  g.save();
  g.lineCap = "round";
  g.translate(3, 6);
  ligne();
  g.strokeStyle = "rgba(0,0,0,.3)";
  g.lineWidth = 2.4;
  g.stroke();
  g.translate(-3, -6);
  g.strokeStyle = voie % 2 ? "#e8bf62" : "#f4d98c";
  g.stroke();
  g.lineWidth = 0.8;
  g.strokeStyle = "rgba(255,250,225,.9)";
  g.stroke();
  g.restore();
}
function poteau(x: number, sol: number, haut: number) {
  g.fillStyle = "rgba(0,0,0,.3)";
  g.fillRect(x - 1, sol + haut + 4, 10, -haut - 4);
  const d = g.createLinearGradient(x - 6, 0, x + 6, 0);
  d.addColorStop(0, "#8a6424");
  d.addColorStop(0.45, "#f6d78a");
  d.addColorStop(1, "#9a6e2a");
  g.fillStyle = d;
  g.fillRect(x - 5, sol, 10, haut);
  g.fillRect(x - 14, sol - 16, 28, 16);
  g.beginPath();
  g.arc(x, sol + haut, 13, 0, Math.PI * 2);
  g.fillStyle = "#d9a640";
  g.fill();
  g.beginPath();
  g.arc(x + 2, sol + haut, 6.5, 0, Math.PI * 2);
  g.fillStyle = "#7a1b2c";
  g.fill();
  // Les chevilles où s'accrochent les cordes
  g.fillStyle = "#f6d78a";
  for (const ly of LANE_Y) {
    g.beginPath();
    g.arc(x + 6, ly - GY - 9, 3, 0, Math.PI * 2);
    g.fill();
  }
}
function route(): Piece {
  const TW = 1200,
    TH = 70;
  return piece(
    TW,
    TH,
    0,
    (x) => {
      const r = alea(505),
        bord = (dy: number, amp: number) => {
          const pts = [] as [number, number][];
          for (let px = -10; px <= TW + 10; px += 6) pts.push([px, 8 + dy + (r() - 0.5) * amp]);
          pts.push([TW + 10, TH], [-10, TH]);
          return pts;
        };
      remplir(x, bord(-2.5, 4), "#f3dc9a");
      remplir(x, bord(0, 3), "#c99a43");
      remplir(x, bord(12, 2), "#4d2a18");
      x.strokeStyle = "rgba(255,210,150,.1)";
      x.lineWidth = 1.2;
      for (let k = 0; k < 14; k++) {
        const py = 26 + k * 3;
        x.beginPath();
        for (let px = 0; px <= TW; px += 40)
          x.lineTo(px, py + Math.sin(px * 0.01 + k) * 2 * Math.sin((px / TW) * Math.PI * 4));
        x.stroke();
      }
      // Les picots du cylindre
      for (let k = 0; k < 52; k++) {
        if (hh(k, 40) < 0.5) continue;
        x.beginPath();
        x.arc(k * 23, 24 + hh(k, 41) * 36, 1.8, 0, Math.PI * 2);
        x.fillStyle = "rgba(255,220,140,.7)";
        x.fill();
      }
      for (let k = 0; k < 11; k++) rectDecoupe(x, k * (TW / 11) + 20, 36, 54, 5, r, "#e2b552");
    },
    { grain: 0.6 },
  );
}

export const BOITE: Diorama = {
  plans,
  popup,
  chaud: ["#ffcf6a", "#ff8a5c"],
  voile: ["rgba(20,0,8,.12)", "rgba(20,0,8,.32)"],
  corde,
  poteau,
  route,
  encre: ENCRE,
  pancarte: "#f6ecd6",
};
