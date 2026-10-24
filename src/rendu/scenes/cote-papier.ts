/* ---------- La scène de côté en papier découpé (#78) ---------- */
// Le décor de la scène de côté, commun aux deux univers : un diorama de plans de papier en parallaxe (fourni par
// chaque univers, `cote-ville.ts` et `cote-boite.ts`), qui bat au temps ; les couloirs de la mélodie en cordes qui
// pendent entre des poteaux, un poteau par mesure, avec le nom de l'accord de la mesure qui commence ; la route de
// la basse ; et le pop-up du refrain, qui se déplie au début de la section et se replie à sa fin.
//
// Les cordes passent derrière les notes, à quelques pixels de la hauteur de leur couloir : la place des notes et
// des points d'impact ne change pas (ADR-0019). Un tir réussi pince la corde, un raté la casse (`../cordes.ts`).
import { clamp } from "../../outils";
import { casseDe, noeudsRenoues, vibrations } from "../cordes";
import { COL, FONT, H, W, g, hexA, hh, reduced, txt, LANE_HUE } from "../outils";
import { alea, cuit, dechire, grainSur, piece, poserPiece, remplir, type Piece, type Point } from "../papier";
import { TH } from "../../univers/univers";
import type { VueDeScene } from "./contrat";
import type { SceneDeCote } from "./cote";
import { GY, HITX, LANE_Y, PPB, X_BASSE } from "./cote-mesures";
import { BOITE } from "./cote-boite";
import { VILLE } from "./cote-ville";

/** Ce que chaque univers fournit au papier découpé de la scène de côté */
export interface Diorama {
  /** Les plans du décor, du fond au premier plan, sous les cordes */
  plans(vue: VueDeScene, cote: SceneDeCote, k: Rebond): void;
  /** Les pièces du pop-up du refrain, de l'arrière à l'avant : rayons, monument, bannière */
  popup(): Piece[];
  /** La couleur chaude du refrain, en haut et en bas */
  chaud: [string, string];
  /** Le voile qui détache le jeu du décor, en haut et en bas */
  voile: [string, string];
  /** Trace la corde d'un couloir le long de ses points (`ligne`) */
  corde(ligne: () => void, voie: number): void;
  /** Un poteau, debout sur le sol en (x, sol), haut jusqu'à `haut` */
  poteau(x: number, sol: number, haut: number): void;
  /** La route, une bande qui se répète, posée de `GY - 8` vers le bas */
  route(): Piece;
  /** L'encre de l'univers, et le papier de ses pancartes */
  encre: string;
  pancarte: string;
}
/** Le rebond d'un plan au temps : son étirement en largeur et en hauteur */
export type Rebond = (force?: number, phase?: number) => { x: number; y: number };

// Les poteaux : un par mesure, un quart de temps avant son premier temps, pour ne pas se tenir sur une note du temps
const AVANT_LA_MESURE = 0.25,
  ENTRE_POTEAUX = 4 * PPB;
/** De combien les cordes pendent au milieu de deux poteaux */
export const PEND = 14;
// Le haut des poteaux, au-dessus de la corde de l'octave
const HAUT_POTEAU = LANE_Y[3] - 40;

/** Le nombre de pixels de défilement de la corde au temps nb, depuis le premier poteau */
const defilement = (nb: number) => (nb + AVANT_LA_MESURE) * PPB;
/** Le poteau de rang k (celui de la mesure k), à l'écran au temps nb */
const xDuPoteau = (k: number, nb: number) => HITX + (4 * k - AVANT_LA_MESURE - nb) * PPB;

/**
 * La hauteur de la corde d'un couloir à l'abscisse x, au temps nb : elle pend entre deux poteaux, ondule doucement,
 * et vibre où on l'a pincée. Ses bouts, aux poteaux, sont un peu au-dessus du couloir, son milieu un peu en dessous.
 */
function hauteurDeCorde(
  voie: number,
  x: number,
  nb: number,
  t: number,
  pincees: { seg: number; u: number; age: number; force: number }[],
) {
  const rel = x - HITX + defilement(nb),
    seg = Math.floor(rel / ENTRE_POTEAUX),
    u = rel / ENTRE_POTEAUX - seg;
  let y =
    LANE_Y[voie] +
    PEND * (4 * u * (1 - u) - 2 / 3) +
    Math.sin(t * 1.7 + rel * 0.008 + voie * 1.3) * 1.8 * Math.sin(Math.PI * u);
  for (const p of pincees) {
    const env = 14 * p.force * Math.exp(-p.age * 3.4);
    if (p.seg === seg) {
      const tri = u < p.u ? u / p.u : (1 - u) / (1 - p.u);
      y +=
        env * (0.55 * tri + 0.45 * Math.sin(Math.PI * u)) * Math.cos(p.age * 38) +
        env * 0.35 * Math.sin(2 * Math.PI * u) * Math.cos(p.age * 63 + 1);
    } else if (Math.abs(p.seg - seg) === 1) y += env * 0.22 * Math.sin(Math.PI * u) * Math.cos(p.age * 31);
  }
  return y;
}
/** Le segment de corde (entre deux poteaux) où passe la note du temps `beat`, et sa place dans le segment */
function segmentDuTemps(beat: number) {
  const rel = (beat + AVANT_LA_MESURE) / 4,
    seg = Math.floor(rel);
  return { seg, u: clamp(rel - seg, 0.08, 0.92) };
}

const diorama = (univers: string): Diorama => (univers === "boite" ? BOITE : VILLE);

/** Le rebond au temps : chaque plan s'écrase un peu sur le temps puis se redresse, moins avec « Mouvement réduit » */
const rebond =
  (nb: number): Rebond =>
  (force = 1, phase = 0) => {
    const f = (((nb + phase) % 1) + 1) % 1,
      s = Math.exp(-f * 6) * Math.cos(f * 13) * force * (reduced ? 0.4 : 1);
    return { x: 1 + 0.022 * s, y: 1 - 0.045 * s };
  };

/** Le fond de la scène de côté : le diorama, le pop-up du refrain, les repères du temps, les poteaux et les cordes */
export function fondPapier(vue: VueDeScene, cote: SceneDeCote) {
  const D = diorama(vue.univers),
    { nb } = vue,
    k = rebond(nb);
  D.plans(vue, cote, k);
  popupDuRefrain(vue, D);
  // Le voile qui détache le jeu du décor
  const v = g.createLinearGradient(0, 120, 0, GY);
  v.addColorStop(0, D.voile[0]);
  v.addColorStop(1, D.voile[1]);
  g.fillStyle = v;
  g.fillRect(-12, 120, W + 24, GY - 120);
  reperes(vue);
  poteaux(vue, D, k);
  cordes(vue, D);
  // La ligne de tir, au crayon
  g.save();
  g.strokeStyle = hexA(COL.mel, 0.3);
  g.lineWidth = 1.5;
  g.setLineDash([4, 6]);
  g.beginPath();
  g.moveTo(HITX, LANE_Y[3] - 36);
  g.lineTo(HITX, LANE_Y[0] + 28);
  g.stroke();
  g.restore();
}

// Les repères rythmiques propres à chaque main (#19) : en 3 contre 2, la mélodie a une ligne par croche, au crayon
function reperes(vue: VueDeScene) {
  const { nb } = vue;
  for (let b = Math.ceil(nb - 2); b < nb + 7; b++) {
    if (vue.polyrythmie(b)) {
      g.fillStyle = hexA(COL.mel, 0.16);
      g.fillRect(HITX + (b + 0.5 - nb) * PPB, 134, 1, 286);
    }
    if (b % 4 === 0) continue;
    g.fillStyle = vue.polyrythmie(b) ? hexA(COL.mel, 0.22) : "rgba(239,234,248,.05)";
    g.fillRect(HITX + (b - nb) * PPB, 134, 1, 286);
  }
}

// Les poteaux, un par mesure, avec sur chacun le nom de l'accord de la mesure qui commence
function poteaux(vue: VueDeScene, D: Diorama, k: Rebond) {
  const { nb, hsl } = vue,
    sq = k(0.6, 0.02);
  for (let m = Math.floor((nb - 2) / 4); m <= Math.ceil((nb + 9) / 4); m++) {
    const x = xDuPoteau(m, nb);
    if (x < -40 || x > W + 40) continue;
    g.save();
    g.translate(x, GY);
    g.scale(sq.x, sq.y);
    D.poteau(0, 0, HAUT_POTEAU - GY);
    g.restore();
    if (m < 0 || m >= vue.fin) continue;
    // La pancarte de l'accord, au sommet du poteau, à la teinte de l'accord
    const c = vue.accord(m),
      y = HAUT_POTEAU - 20 + (GY - HAUT_POTEAU) * (1 - sq.y);
    g.font = `700 17px ${FONT.display}`;
    const w = Math.max(34, g.measureText(c.name).width + 16);
    g.save();
    g.translate(x, y);
    g.rotate((hh(m, 3) - 0.5) * 0.12);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(-w / 2 + 2, -13, w, 26);
    g.fillStyle = D.pancarte;
    g.fillRect(-w / 2, -16, w, 26);
    g.fillStyle = hsl(c.hue, 70, 55);
    g.fillRect(-w / 2, 6, w, 4);
    txt(c.name, 0, 3, `700 17px ${FONT.display}`, D.encre, "center");
    g.restore();
  }
}

// Les cordes des quatre couloirs : elles pendent entre les poteaux, vibrent où on les a pincées, et se cassent au
// raté avant de se renouer ; un nœud reste où elles ont cassé
function cordes(vue: VueDeScene, D: Diorama) {
  const { nb, pnow } = vue,
    t = pnow / 1000;
  for (let voie = 0; voie < 4; voie++) {
    const pincees = vibrations(voie, pnow).map((p) => ({
        ...segmentDuTemps(p.beat),
        age: (pnow - p.at) / 1000,
        force: p.force,
      })),
      casse = casseDe(voie, pnow),
      segCasse = casse ? segmentDuTemps(casse.beat).seg : null,
      segDe = (x: number) => Math.floor((x - HITX + defilement(nb)) / ENTRE_POTEAUX),
      y = (x: number) => hauteurDeCorde(voie, x, nb, t, pincees);
    D.corde(() => {
      g.beginPath();
      let levee = true;
      for (let x = -20; x <= W + 20; x += 8) {
        if (segCasse !== null && segDe(x) === segCasse) {
          levee = true;
          continue;
        }
        if (levee) g.moveTo(x, y(x));
        else g.lineTo(x, y(x));
        levee = false;
      }
    }, voie);
    // En solo (#9), les cordes battent au temps, à la couleur de leur couloir
    if (vue.solo) {
      g.save();
      g.globalAlpha = 0.25 + 0.45 * vue.pulsation;
      g.strokeStyle = vue.hsl(LANE_HUE[voie], 80, 70);
      g.lineWidth = 2;
      g.beginPath();
      for (let x = HITX; x <= W + 20; x += 12) (x === HITX ? g.moveTo : g.lineTo).call(g, x, y(x));
      g.stroke();
      g.restore();
    }
    if (casse) {
      // Les deux bouts de la corde cassée tombent de leurs poteaux
      const k = clamp((pnow - casse.at) / 120, 0, 1),
        x0 = xDuPoteau(segCasse, nb),
        x1 = x0 + ENTRE_POTEAUX,
        bx = HITX + (casse.beat - nb) * PPB,
        ly = LANE_Y[voie] - (PEND * 2) / 3;
      D.corde(() => {
        g.beginPath();
        g.moveTo(x0, ly);
        g.quadraticCurveTo(
          x0 + ((bx - x0) / 2) * (1 - k) + 30 * k,
          ly + 40 * k,
          bx + (x0 + 40 - bx) * k * 0.5,
          ly + 110 * k,
        );
        g.moveTo(x1, ly);
        g.quadraticCurveTo(
          x1 + ((bx - x1) / 2) * (1 - k) - 30 * k,
          ly + 40 * k,
          bx + (x1 - 40 - bx) * k * 0.5,
          ly + 110 * k,
        );
      }, voie);
    }
  }
  // Les nœuds des cordes renouées
  g.lineWidth = 2.4;
  for (const n of noeudsRenoues(pnow)) {
    const x = HITX + (n.beat - nb) * PPB;
    if (x < -30 || x > W + 30) continue;
    const s = clamp((pnow - n.at - 500) / 200, 0, 1),
      yn = hauteurDeCorde(n.voie, x, nb, t, []);
    g.save();
    g.translate(x, yn);
    g.scale(s, s);
    g.strokeStyle = D.pancarte;
    g.beginPath();
    g.ellipse(-5, -3, 5, 3.5, -0.5, 0, Math.PI * 2);
    g.moveTo(10, -3);
    g.ellipse(5, -3, 5, 3.5, 0.5, 0, Math.PI * 2);
    g.moveTo(-1, 0);
    g.lineTo(-4, 9);
    g.moveTo(1, 0);
    g.lineTo(4, 9);
    g.stroke();
    g.restore();
  }
}

/* ---------- Le pop-up du refrain ---------- */
// Pendant le refrain, ses pièces se déplient l'une après l'autre au début de la section, et se replient à sa fin
function ouverture(vue: VueDeScene, k: number) {
  const r = vue.refrain;
  if (!r) return 0;
  const { nb } = vue;
  if (nb > r.fin - 1) return lisse(clamp((r.fin - nb - (2 - k) * 0.12) / 0.6, 0, 1));
  const a = clamp((nb - r.debut - k * 0.18) / 0.7, 0, 1);
  return a <= 0 ? 0 : reduced ? lisse(a) : depasse(a);
}
const lisse = (t: number) => t * t * (3 - 2 * t);
// Un dépassement, puis le retour : la pièce se déplie d'un coup sec
const depasse = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
/** La chaleur du refrain : elle monte en un temps au début, et retombe en un temps à la fin */
const chaleur = (vue: VueDeScene) =>
  vue.refrain ? lisse(clamp(Math.min(vue.nb - vue.refrain.debut, vue.refrain.fin - vue.nb), 0, 1)) : 0;

function popupDuRefrain(vue: VueDeScene, D: Diorama) {
  if (!vue.refrain) return;
  const pieces = cuit(`popup-${vue.univers}`, D.popup),
    cx = 880;
  pieces.forEach((p, k) => {
    const o = ouverture(vue, k);
    if (o <= 0.001) return;
    // Les pièces se déplient depuis le sol ; la bannière, en dernier, au-dessus du monument
    const base = k === 2 ? GY - 260 : GY - (k === 1 ? 10 : 4);
    g.save();
    g.translate(cx, base);
    g.scale(1, Math.max(0.001, o));
    poserPiece(p, -p.w / 2, -p.h);
    if (o < 1) {
      g.fillStyle = `rgba(0,0,0,${0.45 * (1 - clamp(o, 0, 1))})`;
      g.fillRect(-p.w / 2, -p.h, p.w, p.h);
    }
    g.restore();
  });
  const w = chaleur(vue);
  if (w <= 0.01) return;
  g.save();
  g.globalCompositeOperation = "soft-light";
  g.globalAlpha = 0.7 * w;
  const d = g.createLinearGradient(0, 0, 0, GY);
  d.addColorStop(0, D.chaud[1]);
  d.addColorStop(1, D.chaud[0]);
  g.fillStyle = d;
  g.fillRect(-12, -12, W + 24, GY + 12);
  g.restore();
}

/** Le sol de la scène de côté : la route de l'univers, les repères des temps et des triolets, et le bas de page */
export function solPapier(vue: VueDeScene) {
  const { nb, hsl } = vue,
    D = diorama(vue.univers),
    route = cuit(`route-${vue.univers}`, D.route),
    dx = -((((nb * PPB) % route.w) + route.w) % route.w);
  for (let x = dx; x < W + 12; x += route.w) poserPiece(route, x, GY - 8);
  // La teinte de l'accord de chaque mesure, légère, sous le personnage
  for (let bar = Math.max(0, Math.floor(nb / 4) - 1); bar <= Math.floor((nb + 7) / 4) + 1 && bar < vue.fin; bar++) {
    const c = vue.accord(bar);
    g.fillStyle = hsl(c.hue, 60, 55, 0.12);
    g.fillRect(X_BASSE + (bar * 4 - nb) * PPB, GY, 4 * PPB, 40);
  }
  for (let b = Math.ceil(nb - 2); b < nb + 8; b++) {
    g.fillStyle = b % 4 === 0 ? hexA(COL.bass, 0.6) : "rgba(239,234,248,.2)";
    g.fillRect(X_BASSE + (b - nb) * PPB, GY + 4, 2, b % 4 === 0 ? 14 : 7);
    if (!vue.polyrythmie(b)) continue;
    // Les triolets de la basse (#19) : deux repères de plus dans le temps, et un « 3 » au-dessus du groupe
    g.fillStyle = hexA(COL.bass, 0.45);
    for (const k of [1, 2]) g.fillRect(X_BASSE + (b + k / 3 - nb) * PPB, GY + 4, 2, 10);
    txt("3", X_BASSE + (b + 1 / 3 - nb) * PPB, GY + 30, `700 11px ${FONT.mono}`, hexA(COL.bass, 0.7), "center");
  }
  g.fillStyle = hexA(COL.bass, 0.55);
  g.fillRect(-12, GY, W + 24, 2);
  // Le bas de page, déchiré, sous la route : le HUD s'y pose
  basDePage(vue);
}

function basDePage(vue: VueDeScene) {
  const bande = cuit(`bas-${vue.univers}`, () => basCuit(vue.univers));
  const dx = -((((vue.nb * PPB * 1.3) % bande.w) + bande.w) % bande.w);
  for (let x = dx; x < W + 12; x += bande.w) poserPiece(bande, x, GY + 34);
}
function basCuit(univers: string): Piece {
  const largeur = 1200,
    haut = H - GY - 30;
  return piece(
    largeur,
    haut,
    14,
    (x) => {
      const r = alea(univers === "boite" ? 13 : 12),
        pts: Point[] = [[0, haut]];
      for (let px = 0; px < largeur;) {
        const w = 40 + r() * 30;
        dechire(pts, px, 12, px + w * 0.5, 4 + r() * 6, r, 3);
        dechire(pts, px + w * 0.5, 8, Math.min(largeur, px + w), 12, r, 3);
        px += w;
      }
      pts.push([largeur, 12], [largeur, haut]);
      remplir(x, pts, TH().under);
      if (univers === "boite") {
        x.strokeStyle = "#c9973f";
        x.lineWidth = 2;
        x.setLineDash([8, 5]);
        x.beginPath();
        x.moveTo(0, 22);
        x.lineTo(largeur, 22);
        x.stroke();
        x.setLineDash([]);
      }
      grainSur(x, largeur, haut, 0.4);
    },
    { grain: 0, ombre: [0, -4, 12, "rgba(0,0,0,.55)"] },
  );
}
