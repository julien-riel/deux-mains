/* ---------- La scène en colonnes : le pont aérien (ADR-0019, #81) ---------- */
// La mélodie tombe du ciel juste au-dessus du doigt qui la joue. Chaque couloir a sa colonne de ciel ; des avions
// (Ville) ou des oiseaux mécaniques (Boîte) traversent le ciel de droite à gauche, une colonne par croche, et
// larguent les ennemis du lieu au-dessus de leur colonne. Ils tombent en parachute le long d'un pointillé jusqu'au
// sol, où on les joue : le pointillé apparaît dès le largage, on sait quel doigt jouera bien avant de jouer.
// La basse reste de côté : le personnage court sur le sol à gauche et les obstacles arrivent de la droite, comme
// dans la scène de côté (`cote.ts`), dont on garde le sol, la vitesse et le décor qui défile.
//
// Une note est d'abord dans la soute de son avion : la scène la cache (sa pose n'est pas visible, et n'est pas encore
// entrée dans le champ), et l'avion en porte la forme. Elle est larguée `CHUTE` temps avant le sien, au-dessus de sa
// colonne, puis tombe droit jusqu'à son point d'impact : une note longue (tenue, trille, serpent) ne se montre que
// jusqu'au largage, le reste est encore dans l'avion. Deux notes larguées par le même avion sont celles dont
// les trajectoires de vol se confondent (`cleDeVol`) : une colonne plus à gauche, une croche plus tard.
import {
  COL,
  FONT,
  H,
  LANE_HUE,
  W,
  formeCouloir,
  g,
  hexA,
  reduced,
  rr,
  teinteDeCouloir,
  txt,
  type Palette,
} from "../outils";
import { TH } from "../../univers/univers";
import { boiteBack, boiteGround } from "../boite";
import { villeBack, villeGround } from "../ville";
import type { Bord, NoteDeScene, Pose, Scene, VueDeScene, Voie } from "./contrat";
import { COTE } from "./cote";
import { COMMANDES } from "../../ui/touches";
import { ZONES, zonesTactiles } from "../zones";

/* ----- La géométrie des colonnes ----- */
// Le seul endroit qui place les colonnes : chacune tombe sur sa zone de doigt (`zones.ts`, #79, ADR-0019), de la
// fondamentale (index) à l'octave (auriculaire). Les zones de l'écran sont ramenées dans l'espace de la scène par le
// cadre où elle se dessine. En mode tactile, la scène est au-dessus de la rangée des doigts : chaque colonne est au
// quart de la scène qui surplombe sa zone (`zonesDansLaScene`). Au clavier et au MIDI, la scène prend tout l'écran
// et les zones ne sont pas dessinées, mais les colonnes gardent leur place à l'écran : quatre colonnes à droite d'une
// bande d'un cinquième de la largeur, où courent le personnage et se lit le rail, comme au doigt.

/** Les colonnes dans l'espace de la scène, pour le mode de jeu (tactile ou non) : leur bord gauche et la largeur de
 * chacune, celles des zones des doigts ramenées du cadre de la scène à l'écran */
export function placeDesColonnes(tactile: boolean): { gauche: number; largeur: number } {
  const zones = zonesTactiles(W, H),
    cadre = tactile ? zones.scene : { x: 0, largeur: W },
    pas = (zones.couloirs[1].x - zones.couloirs[0].x) * (W / cadre.largeur);
  return { gauche: (zones.couloirs[0].x - ZONES.ecart * H * 0.5 - cadre.x) * (W / cadre.largeur), largeur: pas };
}
const PLACES = { tactile: placeDesColonnes(true), clavier: placeDesColonnes(false) };
const place = () => (COMMANDES.tactile ? PLACES.tactile : PLACES.clavier);
/** Le milieu de la colonne d'une voie, ou d'entre deux colonnes voisines (n + 0,5, les petites notes) */
export const xDeColonne = (voie: number) => place().gauche + (voie + 0.5) * place().largeur;

// Le sol de la basse, celui de la scène de côté ; les notes atterrissent juste au-dessus
const SOL = COTE.impact("basse").y,
  Y_IMPACT = SOL - 30;
/** Combien de temps tombe une note, de son largage à son point d'impact */
export const CHUTE = 2;
/** La vitesse des avions, en pixels par temps : une colonne par croche */
const vol = () => 2 * place().largeur;
// L'altitude des avions, qui varie doucement de l'un à l'autre ; une note pend sous son avion avant le largage
const altitude = (cle: number) => 168 + 14 * Math.sin(cle / 150),
  SOUTE = 30,
  ECHELLE_SOUTE = 0.5;
// Le chanteur (#18) et le boss (#26) restent en haut à gauche, au-dessus du rail ; leurs notes arrivent de la droite,
// au-dessus des avions, à la vitesse de la basse
const X_CHANTEUR = PLACES.clavier.gauche + 40,
  Y_CHANTEUR = 118,
  PPB_CHANTEUR = 150,
  BOSS_X = W - 140,
  BOSS_Y = 270;

/** La trajectoire de vol d'une note : la place de son avion au temps 0. Deux notes du même avion ont la même. */
export const cleDeVol = (beat: number, voie: number) => xDeColonne(voie) + vol() * (beat - CHUTE);

const debout = (x: number, y: number, echelle = 1, angle = 0): Pose => ({ x, y, echelle, angle, visible: true });
const lisse = (u: number) => u * u * (3 - 2 * u);

/** La pose d'une note d'une colonne : dans la soute, en chute, puis sous le point d'impact une fois son temps passé */
function poserDansLaColonne(beat: number, voie: number, nb: number): Pose {
  const largage = beat - CHUTE,
    cle = cleDeVol(beat, voie),
    haut = altitude(cle) + SOUTE;
  if (nb < largage) return { ...debout(cle - vol() * nb, haut, ECHELLE_SOUTE), visible: false };
  const x = xDeColonne(voie);
  if (nb >= beat) return debout(x, Y_IMPACT + ((nb - beat) * (Y_IMPACT - haut)) / CHUTE);
  // La voile s'ouvre au largage : la note grossit et se balance, puis se pose bien droite sur son temps
  const p = (nb - largage) / CHUTE,
    ouvre = Math.min(1, p * 5),
    phase = (nb - largage) * 5 + voie * 1.7,
    balance = reduced ? 0 : (1 - p) * ouvre;
  return debout(
    x + 6 * Math.sin(phase) * balance,
    haut + (Y_IMPACT - haut) * p,
    ECHELLE_SOUTE + (1 - ECHELLE_SOUTE) * lisse(ouvre),
    0.1 * Math.cos(phase) * balance,
  );
}

function poser(beat: number, voie: Voie, nb: number): Pose {
  if (voie === "basse") return COTE.poser(beat, voie, nb);
  if (voie === "chanteur") return debout(X_CHANTEUR + (beat - nb) * PPB_CHANTEUR, Y_CHANTEUR);
  return poserDansLaColonne(beat, voie, nb);
}

export const COLONNES: Scene = {
  id: "colonnes",
  poser,
  impact: (voie) =>
    voie === "basse"
      ? COTE.impact(voie)
      : voie === "chanteur"
        ? debout(X_CHANTEUR, Y_CHANTEUR)
        : debout(xDeColonne(voie), Y_IMPACT),
  // Les obstacles arrivent par la droite et les notes par le largage ; les obstacles s'en vont par la gauche, les
  // notes sous le sol
  horsChamp: (p: Pose, bord: Bord, marge: number) =>
    bord === "devant" ? !p.visible || p.x > W + marge : p.x < -marge || p.y > SOL + 60 + marge,
  // Ce que montre la basse, qui voit le plus loin : la mélodie arrive en avion, plus tard
  avance: Math.max(COTE.avance, CHUTE + W / (2 * PLACES.clavier.largeur), (W - X_CHANTEUR) / PPB_CHANTEUR),
  // Un point tous les quatre pixels, à la vitesse des avions
  echantillon: 4 / (2 * PLACES.clavier.largeur),
  boss: debout(BOSS_X, BOSS_Y),
  // La légende de chaque couloir se lit au pied de sa colonne, sur le sol
  etiquette: (couloir) => ({ x: xDeColonne(couloir) - 70, y: SOL + 20 }),
  fond,
  sol,
};

/* ----- Le fond : le décor qui défile, les colonnes, les avions et les parachutes ----- */

function fond(vue: VueDeScene) {
  const { nb, hsl, pulsation: bp } = vue,
    boite = vue.univers === "boite";
  // Le décor de l'univers défile avec la basse, comme de côté
  if (boite) boiteBack(nb, hsl, bp, COTE);
  else villeBack(nb, hsl, bp, COTE);

  const notes = vue.melodie(nb - 1, nb + COLONNES.avance + 1);
  // Les colonnes : un voile léger sur celles qui attendent une note larguée, plus fort à l'approche
  for (let i = 0; i < 4; i++) {
    const x0 = place().gauche + i * place().largeur,
      proche = notes
        .filter((n) => n.attend && n.voie === i && nb >= n.beat - CHUTE)
        .reduce((m, n) => Math.max(m, 1 - (n.beat - nb) / CHUTE), 0);
    g.fillStyle = hsl(LANE_HUE[i], 60, 70, vue.solo ? 0.05 + 0.05 * bp : 0.03);
    g.fillRect(x0 + place().largeur / 2 - 1, 210, 2, Y_IMPACT - 210);
    if (proche <= 0) continue;
    const voile = g.createLinearGradient(0, 200, 0, SOL);
    voile.addColorStop(0, hsl(LANE_HUE[i], 70, 65, 0));
    voile.addColorStop(1, hsl(LANE_HUE[i], 70, 65, 0.05 + 0.12 * proche));
    g.fillStyle = voile;
    g.fillRect(x0 + 4, 200, place().largeur - 8, SOL - 200);
  }
  // Les pointillés, dès le largage, de la note à son point d'atterrissage
  g.save();
  g.lineCap = "round";
  for (const n of notes) {
    if (!n.attend || nb < n.beat - CHUTE - 0.5 || nb > n.beat) continue;
    const x = xDeColonne(n.voie),
      p = poser(n.beat, n.voie, nb),
      // Une demi-temps avant le largage, le pointillé s'annonce sous l'avion
      annonce = nb < n.beat - CHUTE,
      a = annonce ? 0.5 * (1 - (n.beat - CHUTE - nb) / 0.5) : 0.85;
    g.setLineDash(annonce ? [4, 10] : [7, 9]);
    g.lineDashOffset = reduced ? 0 : -nb * 40;
    g.strokeStyle = hsl(teinteDeCouloir(n.voie), 80, 68, a);
    g.lineWidth = annonce ? 2.5 : 3.5;
    g.beginPath();
    g.moveTo(x, annonce ? p.y + 10 : p.y + 26 * p.echelle);
    g.lineTo(x, SOL);
    g.stroke();
  }
  g.restore();
  // Les avions (ou les oiseaux), un par trajectoire de vol : sous chacun pendent les formes des notes qu'il porte
  // encore, dans l'ordre où il les larguera
  const vols = new Map<number, NoteDeScene[]>();
  for (const n of notes) {
    const cle = Math.round(cleDeVol(n.beat, n.voie));
    vols.set(cle, [...(vols.get(cle) ?? []), n]);
  }
  for (const [cle, portees] of vols) {
    const x = cle - vol() * nb;
    if (x < -160 || x > W + 160) continue;
    const y = altitude(cle) + (reduced ? 0 : 3 * Math.sin(nb * 2 + cle)),
      teintes = TEINTES_DES_AVIONS[boite ? "boite" : "ville"],
      teinte = teintes[Math.abs(Math.round(cle / 97)) % teintes.length],
      soute = portees.filter((n) => n.attend && nb < n.beat - CHUTE);
    soute.forEach((n, k) => {
      const cx = x - 12 * (soute.length - 1) + 24 * k,
        cy = y + SOUTE + 4;
      g.strokeStyle = boite ? hsl(20, 50, 8) : hsl(255, 45, 9);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, y + 14);
      g.lineTo(cx, cy - 8);
      g.stroke();
      if (Number.isInteger(n.voie)) formeCouloir(n.voie, cx, cy, 8);
      else {
        g.beginPath();
        g.arc(cx, cy, 5, 0, Math.PI * 2);
      }
      g.fillStyle = hsl(teinteDeCouloir(n.voie), 80, 64);
      g.fill();
      g.lineWidth = 2.5;
      g.stroke();
    });
    if (boite) oiseau(x, y, teinte, hsl, nb, vue.pnow, soute.length > 0);
    else avion(x, y, teinte, hsl, nb, vue.pnow, soute.length > 0);
  }
  // Les parachutes des notes larguées, et la guirlande qui relie ceux d'un accord
  for (const n of notes) if (n.attend && nb >= n.beat - CHUTE && nb < n.beat + 0.1) parachute(n, nb, hsl, boite);
  guirlandes(notes, nb, hsl);
}

/** Les teintes des avions de la Ville et des oiseaux de la Boîte */
const TEINTES_DES_AVIONS = { ville: [198, 24, 160, 345], boite: [172, 355, 230] };

/** La voile d'une note larguée, au-dessus de sa pose : elle s'ouvre au largage et se balance avec la note */
function parachute(n: NoteDeScene, nb: number, hsl: Palette, boite: boolean) {
  const p = poser(n.beat, n.voie, nb),
    ouvre = Math.min(1, (nb - (n.beat - CHUTE)) / 0.25),
    e = p.echelle,
    trait = boite ? hsl(20, 50, 8) : hsl(255, 45, 9),
    couleur = hsl(teinteDeCouloir(n.voie), 80, 62);
  if (ouvre <= 0.02) return;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.angle);
  g.scale(e, e);
  const o = ouvre < 1 ? 1 + 2.9 * (ouvre - 1) ** 3 + 1.9 * (ouvre - 1) ** 2 : 1,
    hw = 39 * o,
    hh = 28 * o,
    vy = -54;
  // Les suspentes
  g.strokeStyle = trait;
  g.lineWidth = 2;
  g.beginPath();
  for (const [sx, ex] of [
    [-0.95, -9],
    [-0.35, -4],
    [0.35, 4],
    [0.95, 9],
  ]) {
    g.moveTo(sx * hw, vy - 1);
    g.lineTo(ex, -20);
  }
  g.stroke();
  // La voile, à quartiers de deux couleurs
  const quartiers = boite ? 5 : 4;
  g.beginPath();
  g.moveTo(-hw, vy);
  g.bezierCurveTo(-hw, vy - hh * 1.4, hw, vy - hh * 1.4, hw, vy);
  for (let i = quartiers; i > 0; i--) {
    const xa = -hw + (i * 2 * hw) / quartiers,
      xb = -hw + ((i - 1) * 2 * hw) / quartiers;
    g.quadraticCurveTo((xa + xb) / 2, vy - 10 * o, xb, vy);
  }
  g.closePath();
  g.save();
  g.fillStyle = boite ? hsl(40, 80, 92) : hsl(35, 90, 93);
  g.fill();
  g.clip();
  g.fillStyle = couleur;
  for (let i = boite ? 1 : 0; i < quartiers; i += 2)
    g.fillRect(-hw + (i * 2 * hw) / quartiers, vy - hh * 1.5, (2 * hw) / quartiers, hh * 1.6);
  g.restore();
  g.lineWidth = 3;
  g.strokeStyle = trait;
  g.stroke();
  // Dans la Boîte, un bouton de laiton au sommet
  if (boite) {
    g.beginPath();
    g.arc(0, vy - hh * 1.05, 4, 0, Math.PI * 2);
    g.fillStyle = hsl(40, 75, 56);
    g.fill();
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
}

/** Un accord relie les parachutes de ses notes par une guirlande de fanions, de la plus à gauche à la plus à droite */
function guirlandes(notes: NoteDeScene[], nb: number, hsl: Palette) {
  const parTemps = new Map<number, NoteDeScene[]>();
  for (const n of notes)
    if (n.accord && n.attend && nb >= n.beat - CHUTE && nb < n.beat)
      parTemps.set(n.beat, [...(parTemps.get(n.beat) ?? []), n]);
  for (const accord of parTemps.values()) {
    if (accord.length < 2) continue;
    accord.sort((u, v) => u.voie - v.voie);
    const a = accord[0],
      b = accord[accord.length - 1],
      pa = poser(a.beat, a.voie, nb),
      pb = poser(b.beat, b.voie, nb),
      x1 = pa.x + 34 * pa.echelle,
      y1 = pa.y - 56 * pa.echelle,
      x2 = pb.x - 34 * pb.echelle,
      y2 = pb.y - 56 * pb.echelle,
      mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2 + 26 + (reduced ? 0 : 3 * Math.sin(nb * 4));
    g.strokeStyle = hexA(COL.fg, 0.75);
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo(mx, my, x2, y2);
    g.stroke();
    const fanions = Math.max(4, Math.floor(Math.abs(x2 - x1) / 34));
    for (let i = 1; i < fanions; i++) {
      const u = i / fanions,
        x = (1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * mx + u * u * x2,
        y = (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * my + u * u * y2;
      g.beginPath();
      g.moveTo(x - 8, y);
      g.lineTo(x + 8, y);
      g.lineTo(x, y + 15);
      g.closePath();
      g.fillStyle = hsl(teinteDeCouloir(i % 2 ? a.voie : b.voie), 80, 64);
      g.fill();
    }
  }
}

/** Un avion de la Ville, en (x, y) : fuselage crème, bande et dérive de sa teinte, hélice qui tourne, feu au temps */
function avion(x: number, y: number, teinte: number, hsl: Palette, nb: number, pnow: number, soute: boolean) {
  const trait = hsl(255, 45, 9),
    couleur = hsl(teinte, 75, 60);
  g.save();
  g.translate(x, y);
  g.scale(0.78, 0.78);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = trait;
  g.lineWidth = 4;
  // La dérive et le stabilisateur
  g.beginPath();
  g.moveTo(40, -8);
  g.lineTo(58, -40);
  g.quadraticCurveTo(70, -44, 72, -34);
  g.lineTo(70, -4);
  g.closePath();
  g.fillStyle = couleur;
  g.fill();
  g.stroke();
  rr(46, -6, 34, 10, 5);
  g.fillStyle = hsl(teinte, 70, 45);
  g.fill();
  g.stroke();
  // Le fuselage et sa bande
  rr(-70, -20, 142, 40, 20);
  g.fillStyle = hsl(40, 60, 92);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = couleur;
  g.fillRect(-80, 4, 170, 8);
  g.fillStyle = hsl(255, 45, 9, 0.12);
  g.fillRect(-80, 12, 170, 10);
  g.restore();
  rr(-70, -20, 142, 40, 20);
  g.stroke();
  // Les hublots, le cockpit et l'aile haute
  g.lineWidth = 2;
  g.fillStyle = hsl(45, 95, 70);
  for (const hx of [-22, -4, 14, 32]) {
    g.beginPath();
    g.arc(hx, -5, 4.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.lineWidth = 3;
  rr(-62, -13, 20, 11, 5);
  g.fillStyle = hsl(250, 50, 32);
  g.fill();
  g.stroke();
  g.lineWidth = 4;
  rr(-34, -30, 64, 13, 6.5);
  g.fillStyle = hsl(teinte, 70, 70);
  g.fill();
  g.stroke();
  // La soute, ouverte tant qu'il porte une note
  if (soute) {
    g.lineWidth = 2.5;
    rr(-18, 14, 40, 9, 4);
    g.fillStyle = hsl(250, 50, 32);
    g.fill();
    g.stroke();
  }
  // L'hélice
  g.lineWidth = 3;
  g.beginPath();
  g.arc(-74, 0, 6, 0, Math.PI * 2);
  g.fillStyle = hsl(25, 90, 60);
  g.fill();
  g.stroke();
  const pale = reduced ? 0.5 : Math.abs(Math.cos(pnow / 21));
  g.fillStyle = "rgba(255,255,255,0.4)";
  g.beginPath();
  g.ellipse(-78, 0, 3.5, 6 + 24 * pale, 0, 0, Math.PI * 2);
  g.fill();
  // Le feu de navigation clignote sur le temps
  const allume = ((nb % 1) + 1) % 1 < 0.15;
  g.fillStyle = allume ? hsl(355, 95, 62) : hsl(345, 50, 26);
  g.beginPath();
  g.arc(70, -36, allume ? 4.5 : 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Un oiseau mécanique de la Boîte, en (x, y) : corps de laiton, ailes de sa teinte qui battent, clé de remontage */
function oiseau(x: number, y: number, teinte: number, hsl: Palette, nb: number, pnow: number, soute: boolean) {
  const trait = hsl(20, 50, 8),
    couleur = hsl(teinte, 60, 52),
    bat = reduced ? 0 : Math.sin(pnow / 77 + x * 0.01);
  g.save();
  g.translate(x, y);
  g.scale(0.72, 0.72);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = trait;
  g.lineWidth = 4;
  // La queue en éventail
  for (const [a, l] of [
    [-0.45, 44],
    [-0.1, 50],
    [0.25, 44],
  ]) {
    g.save();
    g.translate(44, -2);
    g.rotate(a);
    rr(0, -7, l, 14, 7);
    g.fillStyle = a < 0 ? couleur : hsl(teinte, 55, 66);
    g.fill();
    g.stroke();
    g.restore();
  }
  // L'aile arrière
  g.save();
  g.translate(6, -10);
  g.rotate(-0.4 - bat * 0.6);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(26, -50, 62, -46);
  g.quadraticCurveTo(44, -16, 0, 0);
  g.fillStyle = hsl(teinte, 55, 36);
  g.fill();
  g.stroke();
  g.restore();
  // Le corps de laiton, ses rivets, la tête et le bec
  g.beginPath();
  g.ellipse(4, 0, 50, 24, 0, 0, Math.PI * 2);
  const laiton = g.createLinearGradient(0, -24, 0, 24);
  laiton.addColorStop(0, hsl(43, 100, 80));
  laiton.addColorStop(0.5, hsl(38, 78, 57));
  laiton.addColorStop(1, hsl(33, 73, 35));
  g.fillStyle = laiton;
  g.fill();
  g.stroke();
  g.fillStyle = hsl(33, 77, 27);
  for (const rx of [-14, 2, 18, 34]) {
    g.beginPath();
    g.arc(rx, 10, 2, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(-42, -10, 19, 0, Math.PI * 2);
  g.fillStyle = hsl(41, 89, 66);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(-58, -14);
  g.lineTo(-80, -6);
  g.lineTo(-58, -2);
  g.closePath();
  g.fillStyle = hsl(25, 95, 62);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(-46, -14, 6, 0, Math.PI * 2);
  g.fillStyle = hsl(40, 100, 95);
  g.fill();
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = trait;
  g.beginPath();
  g.arc(-47.5, -14, 3, 0, Math.PI * 2);
  g.fill();
  // L'aile avant
  g.lineWidth = 4;
  g.save();
  g.translate(0, -8);
  g.rotate(-0.2 - bat * 0.75);
  g.beginPath();
  g.moveTo(-6, 0);
  g.quadraticCurveTo(18, -58, 58, -56);
  g.quadraticCurveTo(40, -18, 14, 4);
  g.closePath();
  g.fillStyle = couleur;
  g.fill();
  g.stroke();
  g.restore();
  // La clé de remontage tourne au rythme
  g.save();
  g.translate(18, -26);
  g.lineWidth = 3;
  g.fillStyle = hsl(36, 65, 48);
  g.fillRect(-3, -12, 6, 12);
  g.strokeRect(-3, -12, 6, 12);
  const k = Math.abs(Math.cos(nb * Math.PI));
  g.fillStyle = hsl(42, 82, 67);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 11 * k, -18, 10 * k + 1, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
  // Les pattes tiennent la note tant qu'il en porte une
  if (soute) {
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-6, 22);
    g.lineTo(-10, 32);
    g.moveTo(12, 22);
    g.lineTo(16, 32);
    g.stroke();
  }
  g.restore();
}

/* ----- Le sol : celui de l'univers, les repères de la basse, et les pistes d'atterrissage ----- */

function sol(vue: VueDeScene) {
  const { nb, hsl } = vue,
    xBasse = COTE.impact("basse").x;
  if (vue.univers === "boite") boiteGround(nb, hsl, COTE);
  else villeGround(nb, hsl, COTE);
  // Le sol est teinté par l'accord, aligné sur le personnage, et marqué à chaque temps (en triolets en 3 contre 2)
  for (let bar = Math.max(0, Math.floor(nb / 4) - 1); bar <= Math.floor((nb + COTE.avance) / 4) + 1; bar++) {
    if (bar >= vue.fin) break;
    const c = vue.accord(bar);
    g.fillStyle = hsl(c.hue, 60, 55, 0.14);
    g.fillRect(xBasse + (bar * 4 - nb) * 150, SOL, 4 * 150, 40);
  }
  for (let b = Math.ceil(nb - 2); b < nb + 8; b++) {
    g.fillStyle = b % 4 === 0 ? hexA(COL.bass, 0.5) : "rgba(239,234,248,.12)";
    g.fillRect(xBasse + (b - nb) * 150, SOL + 4, 2, b % 4 === 0 ? 14 : 7);
    if (!vue.polyrythmie(b)) continue;
    g.fillStyle = hexA(COL.bass, 0.45);
    for (const k of [1, 2]) g.fillRect(xBasse + (b + k / 3 - nb) * 150, SOL + 4, 2, 10);
  }
  // Les pistes d'atterrissage, une par colonne, qui s'éclairent quand une note y tombe
  const notes = vue.melodie(nb - 0.2, nb + CHUTE);
  for (let i = 0; i < 4; i++) {
    const proche = notes
        .filter((n) => n.attend && n.voie === i && nb >= n.beat - CHUTE)
        .reduce((m, n) => Math.max(m, 1 - Math.abs(n.beat - nb) / CHUTE), 0),
      x = xDeColonne(i);
    g.beginPath();
    g.ellipse(x, SOL + 2, 56, 9, 0, 0, Math.PI * 2);
    g.fillStyle = hsl(LANE_HUE[i], 75, 62, 0.16 + 0.35 * proche);
    g.fill();
    g.strokeStyle = hsl(LANE_HUE[i], 80, 70, 0.55 + 0.4 * proche);
    g.lineWidth = 2;
    g.stroke();
  }
  g.fillStyle = hexA(COL.bass, 0.65);
  g.fillRect(-12, SOL, W + 24, 2);
  g.fillStyle = TH().under;
  g.fillRect(-12, SOL + 40, W + 24, H - SOL - 28);
  // En 3 contre 2 (#19), la mélodie garde ses croches : un repère par colonne le rappelle
  if (vue.polyrythmie(Math.floor(nb)))
    txt("3 : 2", place().gauche + 8, SOL - 8, `700 11px ${FONT.mono}`, hexA(COL.mel, 0.7));
}
