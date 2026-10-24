/* ---------- La Ville Muette en papier découpé (#78) ---------- */
// Le diorama de la Ville dans la scène de côté : un ciel de nuit en bandes de papier avec sa lune, des nuages qui
// dérivent, l'horizon lointain, une rangée d'immeubles au milieu et une au premier plan, qui défilent chacun à sa
// vitesse et battent au temps. Les fenêtres s'allument avec le combo, et restent allumées dans les quartiers déjà
// rallumés (#25) ; les traces des notes parfaites (#29) allument une fenêtre et y bombent un graffiti lumineux.
// Les cordes sont des fils à linge, tendus entre des poteaux de bois.
import { S, layers, progression } from "../../jeu/etat";
import { COULEUR_BASSE } from "../../jeu/traces";
import { clamp } from "../../outils";
import { lieuxReussis } from "../../sauvegarde/format";
import { TH } from "../../univers/univers";
import { W, energy, formeCouloir, g, hh, reduced, teinteDeTrace } from "../outils";
import {
  alea,
  cuit,
  dechire,
  grainSur,
  ombre,
  piece,
  poserPiece,
  rectDecoupe,
  remplir,
  toile,
  type Ctx,
  type Piece,
  type Point,
} from "../papier";
import type { VueDeScene } from "./contrat";
import type { SceneDeCote } from "./cote";
import { GY, LANE_Y } from "./cote-mesures";
import type { Diorama, Rebond } from "./cote-papier";

const ENCRE = "#17142b";

/** Un immeuble cuit : sa pièce, sa largeur et sa hauteur (toit compris), sa hauteur de toit, et ses fenêtres */
interface Immeuble {
  p: Piece;
  w: number;
  h: number;
  toit: number;
  fenetres: { x: number; y: number; w: number; h: number }[];
}
// Les deux rangées d'immeubles : leur vitesse (une part de celle des notes), leur pas, leur pied et leurs variantes
const RANGEES = {
  milieu: { vitesse: 0.3, pas: 120, pied: GY - 4, n: 9 },
  pres: { vitesse: 0.55, pas: 178, pied: GY + 4, n: 9 },
};
type Rangee = keyof typeof RANGEES;

function cuireCiel() {
  const [c, x] = toile(W, GY + 20),
    r = alea(3),
    d = x.createLinearGradient(0, 0, 0, GY);
  d.addColorStop(0, "#0b1030");
  d.addColorStop(0.5, "#1f2858");
  d.addColorStop(0.85, "#38386a");
  d.addColorStop(1, "#4a3f6e");
  x.fillStyle = d;
  x.fillRect(0, 0, W, GY + 20);
  // Les bandes de papier du ciel
  for (let k = 0; k < 4; k++) {
    const y0 = 110 + k * 85,
      pts = dechire([], -20, y0, W + 20, y0 + 20 * (r() - 0.5), r, 7, 9);
    pts.push([W + 20, GY + 20], [-20, GY + 20]);
    x.save();
    ombre(x, 0, -2, 14, "rgba(0,0,10,.35)");
    remplir(x, pts, `rgba(${40 + k * 10},${48 + k * 8},${98 + k * 6},0.32)`);
    x.restore();
  }
  // La lune, deux disques de papier et ses cratères
  const mx = 860,
    my = 175,
    mr = 58;
  const halo = x.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.4);
  halo.addColorStop(0, "rgba(255,232,170,.26)");
  halo.addColorStop(1, "rgba(255,232,170,0)");
  x.fillStyle = halo;
  x.fillRect(0, 0, W, GY);
  const lune = (rayon: number, j: number): Point[] =>
    Array.from({ length: 90 }, (_, i) => {
      const a = (i / 90) * Math.PI * 2,
        rr = rayon + (r() - 0.5) * j;
      return [mx + Math.cos(a) * rr, my + Math.sin(a) * rr];
    });
  x.save();
  ombre(x, 3, 5, 16, "rgba(0,0,0,.5)");
  remplir(x, lune(mr + 3, 3.5), "#fff8e6");
  x.restore();
  remplir(x, lune(mr, 2), "#f2dfae");
  for (const [dx, dy, rr] of [
    [-16, -12, 13],
    [18, 9, 9],
    [-5, 24, 7],
    [22, -20, 5],
  ]) {
    x.beginPath();
    x.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
    x.fillStyle = "#e6cd92";
    x.fill();
  }
  // Des étoiles de papier
  for (let i = 0; i < 70; i++) {
    const sx = r() * W,
      sy = r() * 380,
      s = 1.2 + r() * r() * 4.5;
    if (Math.hypot(sx - mx, sy - my) < 100) continue;
    x.save();
    x.translate(sx, sy);
    x.rotate(r());
    x.fillStyle = `rgba(250,236,190,${0.45 + r() * 0.5})`;
    x.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2,
        rr = k % 2 ? s * 0.35 : s;
      x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.fill();
    x.restore();
  }
  grainSur(x, W, GY + 20, 0.6);
  return c;
}

function cuireNuages(): Piece[] {
  return [0, 1, 2, 3].map((v) => {
    const r = alea(50 + v),
      w = 200 + r() * 200,
      h = 42 + r() * 26;
    return piece(
      w,
      h,
      18,
      (x) => {
        const haut: Point[] = [];
        dechire(haut, 6, h * 0.55, w * 0.3, h * 0.12, r, 6);
        dechire(haut, w * 0.3, h * 0.12, w * 0.62, h * 0.3, r, 6);
        dechire(haut, w * 0.62, h * 0.3, w - 6, h * 0.62, r, 6);
        const pts = haut.concat(dechire([], w - 6, h * 0.62, 6, h * 0.8, r, 4));
        remplir(
          x,
          pts.map(([a, b]) => [a, b - 2]),
          "#5b64a0",
        );
        remplir(x, pts, "#2e3a74");
      },
      { ombre: [3, 5, 12, "rgba(0,0,10,.45)"] },
    );
  });
}

// L'horizon lointain : une bande d'immeubles qui se répète, avec quelques fenêtres allumées
function cuireLointain(): Piece {
  const TW = 2304,
    TH = 300,
    r = alea(91),
    B: [number, number, number, boolean][] = [];
  for (let xx = 0; xx < TW;) {
    const w = 38 + r() * 80;
    B.push([xx, Math.min(w, TW - xx), 60 + r() * 180, r() < 0.25]);
    xx += w;
  }
  return piece(
    TW,
    TH,
    0,
    (x) => {
      const pts: Point[] = [[0, TH]];
      for (const [bx, bw, bh, fleche] of B) {
        const Y = TH - bh;
        pts.push([bx, Y]);
        if (fleche) pts.push([bx + bw * 0.45, Y], [bx + bw * 0.5, Y - 26], [bx + bw * 0.55, Y]);
        dechire(pts, bx, Y, bx + bw, Y, r, 3, 6);
      }
      pts.push([TW, TH]);
      x.save();
      ombre(x, 3, -2, 14, "rgba(0,0,12,.55)");
      remplir(
        x,
        pts.map(([a, b]) => [a, b - 2.2]),
        "#3a4373",
      );
      x.restore();
      remplir(x, pts, "#1b2352");
      for (const [bx, bw, bh] of B)
        for (let yy = TH - bh + 14; yy < TH - 10; yy += 16)
          for (let wx = bx + 7; wx < bx + bw - 10; wx += 13)
            if (r() < 0.08) {
              x.fillStyle = "#edc35a";
              x.globalAlpha = 0.45 + r() * 0.4;
              x.fillRect(wx, yy, 5, 7);
              x.globalAlpha = 1;
            }
    },
    { grain: 0.5 },
  );
}

function cuireImmeuble(v: number, rangee: Rangee): Immeuble {
  const pres = rangee === "pres",
    r = alea((pres ? 1000 : 2000) + v * 17),
    w = Math.round(pres ? 100 + r() * 64 : 80 + r() * 60),
    h = Math.round(pres ? 100 + r() * 100 : 180 + r() * 120),
    col = (
      pres ? ["#9a6d43", "#8c623d", "#a7794b", "#7f5838", "#94693f"] : ["#2b3668", "#323e75", "#27315f", "#38407a"]
    )[v % (pres ? 5 : 4)],
    sombre = pres ? "#5e4128" : "#1c2348",
    forme = ["corniche", "pignon", "reservoir", "cheminee", "antenne"][Math.floor(r() * 5)],
    toit = { reservoir: 74, pignon: 46, antenne: 56, cheminee: 42, corniche: 16 }[forme],
    cw = w + 16,
    ch = h + toit,
    ox = 8,
    oy = toit,
    fenetres: Immeuble["fenetres"] = [];
  const p = piece(
    cw,
    ch,
    16,
    (x) => {
      if (forme === "reservoir") {
        const tx = ox + w * 0.5;
        x.strokeStyle = pres ? "#4a3020" : "#1a2048";
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(tx, oy);
        x.lineTo(tx + 6, oy - 30);
        x.moveTo(tx + 34, oy);
        x.lineTo(tx + 28, oy - 30);
        x.stroke();
        rectDecoupe(x, tx - 2, oy - 64, 38, 36, r, pres ? "#7d5233" : "#222b5c");
        x.fillStyle = "rgba(0,0,0,.25)";
        x.fillRect(tx - 2, oy - 52, 38, 3);
        x.fillRect(tx - 2, oy - 40, 38, 3);
        remplir(
          x,
          [
            [tx - 5, oy - 63],
            [tx + 17, oy - 76],
            [tx + 39, oy - 63],
          ],
          sombre,
        );
      }
      if (forme === "cheminee") {
        rectDecoupe(x, ox + w * 0.18, oy - 38, 18, 40, r, pres ? "#7e4a31" : "#1f2756");
        rectDecoupe(x, ox + w * 0.18 - 3, oy - 42, 24, 7, r, sombre);
      }
      if (forme === "antenne") {
        x.strokeStyle = pres ? "#3b281a" : "#121838";
        x.lineWidth = 2;
        x.beginPath();
        const ax = ox + w * 0.7;
        x.moveTo(ax, oy);
        x.lineTo(ax, oy - 52);
        x.moveTo(ax - 12, oy - 40);
        x.lineTo(ax + 12, oy - 40);
        x.moveTo(ax - 8, oy - 30);
        x.lineTo(ax + 8, oy - 30);
        x.stroke();
      }
      if (forme === "pignon")
        remplir(
          x,
          [
            [ox - 4, oy + 2],
            [ox + w / 2, oy - 42],
            [ox + w + 4, oy + 2],
          ],
          sombre,
        );
      rectDecoupe(x, ox, oy, w, h + 4, r, col);
      const d = x.createLinearGradient(ox, 0, ox + w, 0);
      d.addColorStop(0, "rgba(255,240,210,.16)");
      d.addColorStop(1, "rgba(30,10,0,.2)");
      x.fillStyle = d;
      x.fillRect(ox, oy, w, h + 4);
      x.save();
      ombre(x, 0, 3, 4, "rgba(0,0,0,.35)");
      rectDecoupe(x, 0, oy - 2, cw, 11, r, sombre);
      x.restore();
      x.fillStyle = "rgba(255,255,255,.14)";
      x.fillRect(0, oy - 2, cw, 2);
      // Des hachures de crayon pour les briques
      x.strokeStyle = pres ? "rgba(70,35,10,.28)" : "rgba(10,15,40,.35)";
      x.lineWidth = 0.9;
      for (let k = 0; k < 24; k++) {
        const bx = ox + 6 + r() * (w - 24),
          by = oy + 16 + r() * (h - 30);
        x.beginPath();
        x.moveTo(bx, by);
        x.lineTo(bx + 8 + r() * 6, by + (r() - 0.5));
        x.stroke();
      }
      const fw = pres ? 18 : 13,
        fh = pres ? 22 : 17,
        sx = pres ? 30 : 23,
        sy = pres ? 36 : 28,
        nc = Math.max(2, Math.floor((w - 18) / sx)),
        nr = Math.max(1, Math.floor((h - (pres ? 64 : 26)) / sy)),
        gw = (w - 18) / nc;
      for (let j = 0; j < nr; j++)
        for (let i = 0; i < nc; i++) {
          const wx = ox + 9 + i * gw + gw / 2 - fw / 2,
            wy = oy + 18 + j * sy;
          if (pres) {
            x.save();
            ombre(x, 1, 1, 1.5, "rgba(0,0,0,.4)");
            rectDecoupe(x, wx - 2, wy - 2, fw + 4, fh + 4, r, "#efe2c2", 0.8);
            x.restore();
            rectDecoupe(x, wx, wy, fw, fh, r, "#1e2346", 0.6);
            x.fillStyle = "#efe2c2";
            x.fillRect(wx + fw / 2 - 0.8, wy, 1.6, fh);
            x.fillRect(wx, wy + fh / 2 - 0.8, fw, 1.6);
          } else rectDecoupe(x, wx, wy, fw, fh, r, "#161c42", 0.6);
          fenetres.push({ x: wx, y: wy, w: fw, h: fh });
        }
      if (pres) {
        // Le rez-de-chaussée : une vitrine et son auvent rayé
        const y0 = oy + h - 44;
        rectDecoupe(x, ox + 10, y0 + 12, w - 20, 34, r, "#2a2440");
        x.fillStyle = "rgba(255,214,120,.18)";
        x.fillRect(ox + 14, y0 + 16, w - 28, 26);
        const n = Math.floor((w - 8) / 14),
          aw = (w - 8) / n;
        for (let k = 0; k < n; k++) {
          const ax = ox + 4 + k * aw;
          x.beginPath();
          x.moveTo(ax, y0);
          x.lineTo(ax + aw, y0);
          x.lineTo(ax + aw, y0 + 9);
          x.arc(ax + aw / 2, y0 + 9, aw / 2, 0, Math.PI);
          x.closePath();
          x.fillStyle = k % 2 ? "#f1e6cf" : v % 2 ? "#c8443a" : "#2f6f7a";
          x.fill();
        }
      }
    },
    { ombre: pres ? [4, 6, 12, "rgba(10,5,20,.5)"] : [3, 4, 12, "rgba(0,0,15,.5)"] },
  );
  return { p, w: cw, h: ch, toit, fenetres };
}

const ciel = () => cuit("ville-ciel", cuireCiel);
const immeubles = (rangee: Rangee) =>
  cuit(`ville-${rangee}`, () => Array.from({ length: RANGEES[rangee].n }, (_, v) => cuireImmeuble(v, rangee)));

/** L'immeuble de rang i d'une rangée : sa place dans le monde (son milieu) et sa variante */
function immeubleDeRang(rangee: Rangee, i: number) {
  const R = RANGEES[rangee];
  return {
    i,
    wx: i * R.pas + hh(i, rangee === "pres" ? 7 : 3) * 50,
    im: immeubles(rangee)[Math.floor(hh(i, 4) * R.n)],
  };
}

// Une rangée d'immeubles, qui défile et rebondit au temps ; `dessus` dessine sur chaque immeuble, dans son repère
function rangee(
  nom: Rangee,
  vue: VueDeScene,
  cote: SceneDeCote,
  k: Rebond,
  dessus?: (b: ReturnType<typeof immeubleDeRang>) => void,
) {
  const R = RANGEES[nom],
    base = cote.defile(vue.nb) * R.vitesse,
    sq = k(nom === "pres" ? 1.1 : 0.7, nom === "pres" ? 0 : 0.03);
  for (let i = Math.floor((base - 260) / R.pas); i <= Math.floor((base + W + 260) / R.pas); i++) {
    const b = immeubleDeRang(nom, i),
      { im } = b;
    g.save();
    g.translate(b.wx - base, R.pied);
    g.scale(sq.x, sq.y);
    poserPiece(im.p, -im.w / 2, -im.h);
    dessus?.(b);
    g.restore();
  }
}

function plans(vue: VueDeScene, cote: SceneDeCote, k: Rebond) {
  const { nb, hsl, pnow } = vue,
    t = pnow / 1000;
  g.drawImage(ciel(), -12, -12, W + 24, GY + 32);
  // Des étoiles qui clignent au temps
  const f = ((nb % 1) + 1) % 1;
  for (let i = 0; i < 7; i++) {
    const sx = 80 + hh(i, 1) * 820,
      sy = 110 + hh(i, 2) * 200,
      p = Math.exp(-((f + i * 0.25) % 1) * 5);
    g.save();
    g.translate(sx, sy);
    g.rotate(0.3);
    g.globalAlpha = 0.5 + 0.5 * p;
    g.beginPath();
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2,
        rr = j % 2 ? (3 + 3 * p) * 0.4 : 3 + 3 * p;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.fillStyle = "#fff1c4";
    g.fill();
    g.restore();
  }
  // Les nuages dérivent doucement
  cuit("ville-nuages", cuireNuages).forEach((n, i) => {
    const tour = W + 120 + n.w,
      x = ((((i * 420 - cote.defile(nb) * 0.05 - (reduced ? 0 : t * 7)) % tour) + tour) % tour) - n.w + 60;
    poserPiece(n, x, 120 + i * 52 + (i % 2) * 26);
  });
  // L'horizon lointain
  const loin = cuit("ville-loin", cuireLointain),
    dx = -((((cote.defile(nb) * 0.12) % loin.w) + loin.w) % loin.w),
    sq = k(0.35, 0.06);
  g.save();
  g.translate(0, GY - 6);
  g.scale(1, sq.y);
  poserPiece(loin, dx, -loin.h);
  poserPiece(loin, dx + loin.w, -loin.h);
  g.restore();
  // Les fenêtres s'allument avec le combo : les habitants se réveillent. Ceux des quartiers déjà rallumés (#25)
  // restent réveillés : chaque quartier réussi garde des fenêtres allumées dès le départ
  const veille = 0.05 + 0.05 * lieuxReussis(progression(), "ville").length,
    allumees = veille + (0.6 - veille) * energy(),
    vacille = S.mode === "play" && S.health < 40;
  rangee("milieu", vue, cote, k, ({ i, im }) => {
    for (const [n, fen] of im.fenetres.entries()) {
      if (hh(i * 977 + n, 50) >= allumees || (vacille && Math.random() < 0.4)) continue;
      g.fillStyle = hsl(45, 90, 68, 0.9);
      g.fillRect(fen.x - im.w / 2, fen.y - im.h, fen.w, fen.h);
    }
  });
  const cordes = layers().strings;
  rangee("pres", vue, cote, k, ({ i, im }) => {
    // Quand les cordes jouent, des musiciens apparaissent sur les toits
    if (!cordes || hh(i, 11) >= 0.45) return;
    const fx = -im.w / 2 + 20 + hh(i, 12) * (im.w - 40),
      top = -im.h + im.toit - 2,
      archet = Math.sin(nb * Math.PI + i) * 3;
    g.fillStyle = ENCRE;
    g.strokeStyle = ENCRE;
    g.lineWidth = 2.5;
    g.fillRect(fx - 4, top - 22, 9, 22);
    g.beginPath();
    g.arc(fx, top - 28, 6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(fx + 5, top - 16);
    g.lineTo(fx + 20, top - 24 + archet);
    g.stroke();
  });
  graffitis(vue, cote);
}

/**
 * Les traces des notes parfaites (#29, ADR-0015) : sur le mur de l'immeuble du premier plan qui passait derrière la
 * note, une fenêtre s'allume à la couleur de son couloir, et un graffiti lumineux à la forme du couloir (#31) y est
 * bombé à côté, avec sa coulure ; un éclair pour la basse. Plus la note est haute, plus la fenêtre est haute. Une
 * trace fraîche brille plus fort pendant un temps.
 */
function graffitis(vue: VueDeScene, cote: SceneDeCote) {
  const { nb, hsl, pulsation: bp } = vue,
    R = RANGEES.pres,
    base = cote.defile(nb) * R.vitesse;
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const { t, couleur, x, frais } of cote.traces(nb, R.vitesse)) {
    // L'immeuble sous la note, et la trace ramenée sur son mur
    const X = x + base,
      i0 = Math.round(X / R.pas),
      b = [i0 - 1, i0, i0 + 1]
        .map((i) => immeubleDeRang("pres", i))
        .sort((a, c) => Math.abs(a.wx - X) - Math.abs(c.wx - X))[0],
      gauche = b.wx - base - b.im.w / 2,
      cx = clamp(x, gauche + 22, gauche + b.im.w - 22),
      rang = couleur === COULEUR_BASSE ? 0 : couleur + 1,
      mur = b.im.h - b.im.toit,
      cy = R.pied - 54 - ((rang + 0.15 + 0.7 * hh(t, 61)) / 5) * (mur - 70),
      teinte = teinteDeTrace(couleur),
      r = 7 * (1 + 0.7 * frais);
    // La fenêtre allumée, qui déborde de lumière quand elle est fraîche
    g.fillStyle = hsl(teinte, 90, 70, 0.22 + 0.1 * bp + 0.4 * frais);
    g.fillRect(cx - 18 - 6 * frais, cy - 15 - 6 * frais, 22 + 12 * frais, 28 + 12 * frais);
    g.fillStyle = hsl(teinte, 85, 80, 0.95);
    g.fillRect(cx - 15, cy - 12, 16, 22);
    g.fillStyle = "rgba(80,50,20,.5)";
    g.fillRect(cx - 7.8, cy - 12, 1.6, 22);
    // Le graffiti, à côté : le halo de la peinture, le trait vif, puis la coulure
    const gx = cx + 14,
      gy = cy + 8,
      tracer = () => {
        if (couleur === COULEUR_BASSE) {
          g.beginPath();
          g.moveTo(gx - r, gy - r * 0.6);
          g.lineTo(gx + r * 0.2, gy - r * 0.1);
          g.lineTo(gx - r * 0.3, gy + r * 0.2);
          g.lineTo(gx + r, gy + r * 0.8);
        } else formeCouloir(couleur, gx, gy, r);
      };
    tracer();
    g.strokeStyle = hsl(teinte, 95, 62, 0.25 + 0.1 * bp + 0.3 * frais);
    g.lineWidth = 7;
    g.stroke();
    tracer();
    g.strokeStyle = hsl(teinte, 95, 70 + 15 * frais, 0.95);
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = hsl(teinte, 95, 66, 0.7);
    g.fillRect(gx + (hh(t, 62) - 0.5) * r, gy + r, 1.5, 4 + hh(t, 63) * 8);
  }
  g.restore();
}

/* ---------- Le pop-up du refrain : rayons, kiosque à musique, bannière ---------- */
function rayons(c1: string, c2: string, n: number): Piece {
  return piece(
    560,
    300,
    20,
    (x) => {
      for (let k = 0; k < n; k++) {
        const a0 = Math.PI + (k / n) * Math.PI,
          a1 = a0 + Math.PI / n;
        remplir(
          x,
          [
            [280, 300],
            [280 + Math.cos(a0) * 300, 300 + Math.sin(a0) * 300],
            [280 + Math.cos(a1) * 300, 300 + Math.sin(a1) * 300],
          ],
          k % 2 ? c1 : c2,
        );
      }
    },
    { ombre: [3, 5, 14, "rgba(0,0,0,.45)"] },
  );
}
/** La bannière du pop-up, à deux queues, avec son texte */
export function banniere(texte: string, fond: string, encre: string, queues: string, police: string): Piece {
  const [, m] = toile(4, 4);
  m.font = `800 30px ${police}`;
  const w = m.measureText(texte).width + 120,
    h = 70;
  return piece(w, h, 18, (x) => {
    const r = alea(9);
    remplir(
      x,
      [
        [0, 22],
        [46, 22],
        [46, 66],
        [0, 66],
        [16, 44],
      ],
      queues,
    );
    remplir(
      x,
      [
        [w, 22],
        [w - 46, 22],
        [w - 46, 66],
        [w, 66],
        [w - 16, 44],
      ],
      queues,
    );
    rectDecoupe(x, 30, 8, w - 60, 50, r, fond);
    x.fillStyle = "rgba(0,0,0,.12)";
    x.fillRect(30, 48, w - 60, 10);
    x.font = `800 30px ${police}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = encre;
    x.fillText(texte, w / 2, 34);
  });
}
function popup(): Piece[] {
  const kiosque = piece(320, 250, 20, (x) => {
    const r = alea(6);
    rectDecoupe(x, 20, 214, 280, 36, r, "#e9dcc0");
    rectDecoupe(x, 30, 226, 260, 24, r, "#c8443a");
    for (let k = 0; k < 6; k++) rectDecoupe(x, 46 + k * 45, 96, 9, 120, r, "#f4ead4");
    remplir(
      x,
      [
        [24, 100],
        [160, 18],
        [296, 100],
      ],
      "#2f6f7a",
    );
    for (let k = 0; k < 10; k++) {
      x.beginPath();
      x.arc(38 + k * 27, 100, 14, 0, Math.PI);
      x.fillStyle = k % 2 ? "#f4ead4" : "#c8443a";
      x.fill();
    }
    x.strokeStyle = "#3b281a";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(160, 18);
    x.lineTo(160, 0);
    x.stroke();
    remplir(
      x,
      [
        [160, 0],
        [184, 6],
        [160, 12],
      ],
      "#ffd35e",
    );
    // Une guirlande d'ampoules
    x.save();
    ombre(x, 0, 0, 10, "rgba(255,210,90,.9)");
    for (let k = 0; k < 14; k++) {
      x.beginPath();
      x.arc(32 + k * 20, 122 + Math.sin(k * 0.9) * 4, 4, 0, Math.PI * 2);
      x.fillStyle = "#ffe28a";
      x.fill();
    }
    x.restore();
  });
  return [
    rayons("#ffb347", "#ff7e5f", 13),
    kiosque,
    banniere(TH().refrain, "#ffd35e", ENCRE, "#a1362d", "Georgia, serif"),
  ];
}

/* ---------- Les fils à linge, leurs poteaux, la rue ---------- */
function corde(ligne: () => void) {
  g.save();
  g.lineCap = "round";
  g.translate(3, 6);
  ligne();
  g.strokeStyle = "rgba(0,0,0,.28)";
  g.lineWidth = 3;
  g.stroke();
  g.translate(-3, -6);
  g.strokeStyle = "#efe2c4";
  g.stroke();
  g.setLineDash([2.5, 3.5]);
  g.strokeStyle = "rgba(140,105,65,.85)";
  g.stroke();
  g.restore();
}
function poteau(x: number, sol: number, haut: number) {
  g.fillStyle = "rgba(0,0,0,.3)";
  g.fillRect(x - 2, sol + haut + 4, 12, -haut - 4);
  g.fillStyle = "#563824";
  g.fillRect(x - 6, sol, 12, haut);
  g.fillRect(x - 26, sol + haut + 4, 52, 8);
  g.fillStyle = "rgba(255,220,170,.18)";
  g.fillRect(x - 6, sol + haut, 3, -haut);
  g.strokeStyle = "rgba(0,0,0,.35)";
  g.lineWidth = 1;
  g.beginPath();
  for (let yy = sol - 40; yy > sol + haut; yy -= 44) {
    g.moveTo(x - 6, yy);
    g.lineTo(x + 6, yy - 3);
  }
  g.stroke();
  // Les isolateurs où s'attachent les fils
  g.strokeStyle = "#9b9aa6";
  g.lineWidth = 2;
  for (const ly of LANE_Y) {
    g.beginPath();
    g.arc(x + 7, ly - GY - 9, 3.5, 0, Math.PI * 2);
    g.stroke();
  }
}
function route(): Piece {
  const TW = 1200,
    TH = 70;
  return piece(
    TW,
    TH,
    0,
    (x: Ctx) => {
      const bord = (dy: number, amp: number): Point[] => {
        const p = dechire([], -10, 8 + dy, TW + 10, 8 + dy, alea(9), amp, 6);
        p.push([TW + 10, TH], [-10, TH]);
        return p;
      };
      remplir(x, bord(-2.5, 5), "#ece3cf");
      remplir(x, bord(0, 4), "#8d8a92");
      remplir(x, bord(12, 3), "#34333f");
      const r = alea(404);
      for (let k = 0; k < 15; k++) {
        const dx = k * 80 + 20,
          p = dechire([], dx, 36, dx + 40, 36, r, 2, 7);
        dechire(p, dx + 40, 41, dx, 41, r, 2, 7);
        remplir(x, p, "#e8c14a");
      }
      x.strokeStyle = "rgba(255,255,255,.07)";
      x.lineWidth = 1;
      for (let k = 0; k < 50; k++) {
        const px = r() * TW,
          py = 26 + r() * 40;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + 6 + r() * 20, py + (r() - 0.5) * 3);
        x.stroke();
      }
    },
    { grain: 0.6 },
  );
}

export const VILLE: Diorama = {
  plans,
  popup,
  chaud: ["#ff9a3c", "#ff5f7e"],
  voile: ["rgba(8,10,30,.10)", "rgba(8,10,30,.30)"],
  corde,
  poteau,
  route,
  encre: ENCRE,
  pancarte: "#f4ead4",
};
