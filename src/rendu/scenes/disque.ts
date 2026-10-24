/* ---------- La scène du disque (ADR-0019, #80) ---------- */
// Le temps est un angle. Un disque tourne au centre, d'un angle fixe par temps, dans le sens inverse des aiguilles
// d'une montre ; le personnage court à son sommet. Les obstacles de la basse sont posés sur son bord et montent vers
// lui avec la rotation ; la mélodie voyage sur quatre anneaux concentriques, de la fondamentale (au plus près du
// centre) à l'octave (au plus loin), jusqu'à la ligne de jugement, verticale, au-dessus du personnage, qui porte les
// quatre points d'impact. Les notes entrent à droite, un peu au-dessus de l'horizontale, passent la ligne au
// sommet, et s'en vont à gauche. La ligne du chanteur et du boss (#18, #26) est un cinquième anneau, au-dehors.
//
// Chaque « Parfait » grave un arc lumineux sur son anneau (les traces des notes parfaites, #29, sans nouveau
// format) qui continue de tourner avec le disque ; un raté raye son anneau et fait vaciller le disque. Avec
// « Mouvement réduit », le disque tourne plus lentement (la scène montre alors plus de temps à l'avance) et ne
// vacille pas. Son décor dans chaque univers est dans `disque-ville.ts` et `disque-boite.ts`.
import { PAS_PAR_TEMPS } from "../../chanson/temps";
import { S, tracesAffichees } from "../../jeu/etat";
import { COULEUR_BASSE, couleurDeLaTrace, pasDeLaTrace } from "../../jeu/traces";
import { clamp } from "../../outils";
import { COL, FONT, LANE_HUE, g, hexA, hh, reduced, txt } from "../outils";
import type { Bord, Pose, Scene, VueDeScene, Voie } from "./contrat";
import { boiteDisqueFond, boiteDisqueSol } from "./disque-boite";
import { villeDisqueFond, villeDisqueSol } from "./disque-ville";

const DEG = Math.PI / 180,
  TOUR = 2 * Math.PI;
/** Le centre du disque, son rayon (le sol de la basse), et les rayons des quatre anneaux, de la fondamentale à
 * l'octave. Les points d'impact s'étagent au-dessus du personnage comme les touches du rail de gauche. */
const CX = 660,
  CY = 582,
  RAYON = 200;
export const ANNEAUX = [296, 338, 380, 422];
/** La ligne du chanteur et du boss, au-delà de l'octave */
const R_CHANTEUR = 466;
/** Le sommet, où tout se joue ; l'angle où les notes entrent dans le champ, à droite, et celui où elles en sortent,
 * à gauche (les angles croissent dans le sens des aiguilles d'une montre, comme sur l'écran) */
const SOMMET = -Math.PI / 2,
  ENTREE = -15 * DEG,
  SORTIE = -180 * DEG;
/** Les notes naissent en grossissant sur `NAISSANCE`, et rapetissent en s'en allant sur `DEPART` */
const NAISSANCE = 12 * DEG,
  DEPART = 25 * DEG;
/** La taille des ennemis sur les anneaux, plus serrés que les couloirs de la scène de côté */
const ECHELLE_ANNEAU = 0.85;
/** L'angle parcouru par temps : 20°, une mesure par quart de tour ; plus lent avec « Mouvement réduit » */
export const VITESSE = 20 * DEG,
  VITESSE_REDUITE = 15 * DEG;

/** Le rayon d'une voie : un anneau, le milieu de deux anneaux voisins (n + 0,5), la ligne du chanteur, ou le bord */
export function rayonDe(voie: Voie): number {
  if (voie === "basse") return RAYON;
  if (voie === "chanteur") return R_CHANTEUR;
  return (ANNEAUX[Math.floor(voie)] + ANNEAUX[Math.ceil(voie)]) / 2;
}

/**
 * L'angle d'une pose autour du centre, déroulé dans le sens de la lecture : de `ENTREE` (elle arrive) à `SORTIE`
 * (elle s'en va), et au-delà de chaque côté. Le bas du disque, sous l'écran, est partagé à la verticale : ce qui est
 * à sa droite n'est pas encore arrivé, ce qui est à sa gauche est passé.
 */
function angleDeroule(p: Pose): number {
  const phi = Math.atan2(p.y - CY, p.x - CX);
  return phi > Math.PI / 2 ? phi - TOUR : phi;
}

/** Le vacillement du disque après un raté : un angle et un saut vertical qui s'amortissent en une seconde, nuls
 * avec « Mouvement réduit » */
export function vacillement(rates: VueDeScene["rates"], pnow: number, reduit = reduced) {
  const dernier = Math.max(-Infinity, ...rates.map((r) => r.at)),
    t = (pnow - dernier) / 1000;
  if (reduit || !(t >= 0 && t < 1)) return { a: 0, dy: 0 };
  const env = Math.exp(-t * 5);
  return { a: 0.05 * env * Math.sin(t * 30), dy: 4 * env * Math.sin(t * 24 + 1) };
}

/** Ce que le disque donne à son décor dans chaque univers : sa place, sa rotation et son vacillement */
export interface DecorDuDisque {
  cx: number;
  cy: number;
  /** Le rayon du disque (le sol de la basse) et ceux des anneaux */
  rayon: number;
  anneaux: number[];
  /** L'angle dont le disque a tourné depuis le début de la chanson : un point du disque à l'angle φ est en φ − rot */
  rot: number;
  /** Le vacillement d'après un raté (`vacillement`) */
  vac: { a: number; dy: number };
  /** Le mouvement est réduit : le décor bouge le moins possible */
  reduit: boolean;
}

/**
 * La scène du disque, tournant de `vitesse` radians par temps : `VITESSE`, ou `VITESSE_REDUITE` avec « Mouvement
 * réduit » (`DISQUE`). Une fonction, pour qu'on puisse l'éprouver dans les deux réglages.
 */
export function disque(vitesse: number, reduit: boolean): Scene {
  const angleDe = (beat: number, nb: number) => SOMMET + (beat - nb) * vitesse;
  const poser = (beat: number, voie: Voie, nb: number): Pose => {
    const th = angleDe(beat, nb),
      r = rayonDe(voie),
      // Elle grossit en entrant, et rapetisse en s'en allant
      k = clamp((ENTREE - th) / NAISSANCE, 0, 1) * clamp((th - SORTIE) / DEPART, 0, 1),
      echelle = (voie === "basse" ? 1 : ECHELLE_ANNEAU) * (0.25 + 0.75 * k * k * (3 - 2 * k));
    return {
      x: CX + r * Math.cos(th),
      y: CY + r * Math.sin(th),
      echelle,
      // Les obstacles se tiennent debout sur le bord ; les ennemis volent droits, pour qu'on les reconnaisse
      angle: voie === "basse" ? th - SOMMET : 0,
      visible: th <= ENTREE && th >= SORTIE,
    };
  };
  const decor = (vue: VueDeScene): DecorDuDisque => ({
    cx: CX,
    cy: CY,
    rayon: RAYON,
    anneaux: ANNEAUX,
    rot: vue.nb * vitesse,
    vac: vacillement(vue.rates, vue.pnow, reduit),
    reduit,
  });
  return {
    id: "disque",
    poser,
    impact: (voie) => poser(0, voie, 0),
    horsChamp(p: Pose, bord: Bord, marge: number) {
      const th = angleDeroule(p),
        m = marge / Math.max(1, Math.hypot(p.x - CX, p.y - CY));
      return bord === "devant" ? th > ENTREE + m : th < SORTIE - m;
    },
    avance: (ENTREE - SOMMET) / vitesse,
    // Un point tous les six pixels sur le bord, un peu plus sur les anneaux du dehors
    echantillon: 1 / 12,
    // Le boss plane en haut à droite, au-delà de la ligne du chanteur d'où arrivent ses notes
    boss: { x: CX + 560 * Math.cos(-40 * DEG), y: CY + 560 * Math.sin(-40 * DEG), echelle: 1, angle: 0, visible: true },
    fond(vue) {
      const d = decor(vue);
      if (vue.univers === "boite") boiteDisqueFond(vue, d);
      else villeDisqueFond(vue, d);
      reperes(vue, angleDe, vitesse);
      traces(vue, angleDe, vitesse);
      rayures(vue, angleDe);
    },
    sol(vue) {
      const d = decor(vue);
      if (vue.univers === "boite") boiteDisqueSol(vue, d);
      else villeDisqueSol(vue, d);
      bord(vue, angleDe);
    },
  };
}

/** La scène du disque de la partie, selon le réglage « Mouvement réduit » du navigateur */
export const DISQUE = disque(reduced ? VITESSE_REDUITE : VITESSE, reduced);

const polaire = (r: number, th: number): [number, number] => [CX + r * Math.cos(th), CY + r * Math.sin(th)];
/** L'opacité d'un repère à l'angle `th` : il apparaît à l'entrée du champ et s'efface à sa sortie */
const fondu = (th: number) => clamp((ENTREE + 8 * DEG - th) / (14 * DEG), 0, 1) * clamp((th - SORTIE) / DEPART, 0, 1);

/**
 * Les repères du temps, entraînés par la rotation : un point sur chaque anneau à chaque temps (et à chaque croche
 * de la mélodie en 3 contre 2, #19), un rayon à chaque mesure, avec le nom de son accord gravé au-dehors. Pendant le
 * solo libre (#9), les anneaux battent au temps.
 */
function reperes(vue: VueDeScene, angleDe: (b: number, nb: number) => number, vitesse: number) {
  const { nb, hsl } = vue,
    boite = vue.univers === "boite";
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = hsl(LANE_HUE[i], 70, 70, vue.solo ? 0.3 + 0.25 * vue.pulsation : 0.2);
    g.lineWidth = vue.solo ? 3 : 2;
    g.beginPath();
    g.arc(CX, CY, ANNEAUX[i], SORTIE, ENTREE);
    g.stroke();
  }
  // La ligne du chanteur et du boss (#18, #26), au-dehors, à peine marquée
  g.strokeStyle = hexA(COL.fg, 0.08);
  g.lineWidth = 1;
  g.setLineDash([2, 8]);
  g.beginPath();
  g.arc(CX, CY, R_CHANTEUR, SORTIE, ENTREE);
  g.stroke();
  g.setLineDash([]);
  const premier = Math.ceil(nb - (SOMMET - SORTIE) / vitesse),
    dernier = Math.floor(nb + (ENTREE - SOMMET) / vitesse) + 1;
  for (let b = premier; b <= dernier; b++) {
    if (b < 0 || b >= vue.fin * 4) continue;
    const th = angleDe(b, nb),
      a = fondu(th);
    if (a <= 0) continue;
    if (b % 4 === 0) {
      const c = vue.accord(b / 4),
        [x1, y1] = polaire(RAYON + 18, th),
        [x2, y2] = polaire(ANNEAUX[3] + 16, th);
      g.strokeStyle = hsl(c.hue, 70, 65, 0.35 * a);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      const [tx, ty] = polaire(ANNEAUX[3] + 34, th);
      txt(
        c.name,
        tx,
        ty + 7,
        boite ? `italic 700 20px ${FONT.display}` : `700 18px ${FONT.display}`,
        hsl(c.hue, 75, 72, 0.9 * a),
        "center",
      );
    } else
      for (const r of ANNEAUX) {
        const [x, y] = polaire(r, th);
        g.fillStyle = hexA(COL.fg, 0.3 * a);
        g.beginPath();
        g.arc(x, y, 1.8, 0, TOUR);
        g.fill();
      }
    if (!vue.polyrythmie(b)) continue;
    // En 3 contre 2, la mélodie a un repère par croche
    const [x, y] = polaire(ANNEAUX[3] + 8, angleDe(b + 0.5, nb));
    g.fillStyle = hexA(COL.mel, 0.5 * a);
    g.fillRect(x - 1, y - 1, 3, 3);
  }
}

/**
 * Le bord du disque, où court le personnage : le sol de la basse, en ambre, avec un cran à chaque temps et un plus
 * grand à chaque mesure, et deux de plus par temps en 3 contre 2 (#19), quand la basse joue des triolets.
 */
function bord(vue: VueDeScene, angleDe: (b: number, nb: number) => number) {
  const { nb } = vue;
  g.strokeStyle = hexA(COL.bass, 0.65);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(CX, CY, RAYON, SORTIE, ENTREE);
  g.stroke();
  for (let b = Math.ceil(nb - 5); b < nb + 6; b++) {
    if (b < 0) continue;
    const marques = vue.polyrythmie(b) ? [0, 1 / 3, 2 / 3] : [0];
    for (const k of marques) {
      const th = angleDe(b + k, nb),
        a = fondu(th),
        long = k === 0 && b % 4 === 0 ? 12 : 6,
        [x1, y1] = polaire(RAYON - 2, th),
        [x2, y2] = polaire(RAYON - 2 - long, th);
      if (a <= 0) continue;
      g.strokeStyle = k ? hexA(COL.bass, 0.5 * a) : b % 4 === 0 ? hexA(COL.bass, 0.6 * a) : hexA(COL.fg, 0.25 * a);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }
  }
}

/** Combien de temps une trace reste gravée sur le disque : un tour complet */
const tour = (vitesse: number) => TOUR / vitesse;

/**
 * Les traces des notes parfaites (#29), gravées en arcs lumineux sur leur anneau (sur le bord pour la basse) au
 * temps de leur note : elles tournent avec le disque et pâlissent en un tour. Une trace qui vient d'être peinte
 * brille plus fort. Seules les traces déjà passées au sommet : celles d'avant, gardées, attendent leur tour.
 */
function traces(vue: VueDeScene, angleDe: (b: number, nb: number) => number, vitesse: number) {
  const { nb, hsl } = vue,
    duree = tour(vitesse);
  g.save();
  g.lineCap = "round";
  for (const t of tracesAffichees()) {
    const couleur = couleurDeLaTrace(t),
      temps = pasDeLaTrace(t) / PAS_PAR_TEMPS,
      age = nb - temps;
    if (age < 0 || age >= duree) continue;
    const frais = age < 1 && S.traces.nouvelles.includes(t) ? 1 - age : 0,
      th = angleDe(temps, nb),
      r = couleur === COULEUR_BASSE ? RAYON - 8 : ANNEAUX[couleur],
      hue = couleur === COULEUR_BASSE ? 28 : LANE_HUE[couleur],
      a = 1 - age / duree,
      demi = 0.05 + 0.04 * frais;
    g.strokeStyle = hsl(hue, 85, 65, (0.15 + 0.35 * frais) * a);
    g.lineWidth = 9;
    g.beginPath();
    g.arc(CX, CY, r, th - demi, th + demi);
    g.stroke();
    g.strokeStyle = hsl(hue, 90, 82, (0.45 + 0.55 * frais) * a);
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
}

/** Les ratés rayent leur anneau (le bord pour la basse), au temps de leur note : la rayure tourne avec le disque et
 * s'efface en un tour */
function rayures(vue: VueDeScene, angleDe: (b: number, nb: number) => number) {
  const { nb } = vue;
  for (const { beat, voie, at } of vue.rates) {
    const age = nb - beat,
      th = angleDe(beat, nb),
      r = rayonDe(voie),
      a = clamp(1 - age / 12, 0, 1) * (0.6 + 0.4 * clamp(1 - (vue.pnow - at) / 600, 0, 1));
    if (a <= 0 || voie === "chanteur") continue;
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const [x, y] = polaire(r - 14 + i * 3.5, th + 0.02 + (i / 8) * 0.12 + (hh(beat * 12, i) - 0.5) * 0.03);
      g.lineTo(x, y);
    }
    g.strokeStyle = hexA(COL.ink, 0.7 * a);
    g.lineWidth = 4;
    g.stroke();
    g.strokeStyle = hexA(COL.fg, 0.85 * a);
    g.lineWidth = 1.4;
    g.stroke();
  }
}
