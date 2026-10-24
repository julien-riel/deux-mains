/* ---------- La scène de côté (ADR-0019) ---------- */
// Le temps défile de droite à gauche, `PPB` pixels par temps. La mélodie arrive sur quatre couloirs horizontaux,
// étagés de la fondamentale (en bas) à l'octave (en haut), jusqu'à la ligne de tir ; la basse arrive sur le sol,
// jusqu'au personnage, à gauche de la ligne de tir. Les accords s'affichent en bandes dans le ciel et sur le sol.
// Son décor dans chaque univers est dans `ville.ts` et `boite.ts` (`villeBack`, `boiteBack`…), qui reçoivent la
// scène pour suivre son défilement.
import { PAS_PAR_TEMPS } from "../../chanson/temps";
import { S, tracesAffichees } from "../../jeu/etat";
import { COULEUR_BASSE, couleurDeLaTrace, pasDeLaTrace } from "../../jeu/traces";
import { TH } from "../../univers/univers";
import { boiteBack, boiteGround, drawComb } from "../boite";
import { COL, FONT, H, LANE_HUE, PW, W, g, hexA, txt } from "../outils";
import { villeBack, villeGround } from "../ville";
import type { Bord, Pose, Scene, VueDeScene, Voie } from "./contrat";

// Le sol, la place du personnage, la ligne de tir et la vitesse de défilement
const GY = 505,
  PX = 210,
  HITX = 300,
  PPB = 150;
/** La hauteur de chaque couloir, de la fondamentale à l'octave. Le tactile (ADR-0008) s'y aligne encore (#79). */
export const LANE_Y = [395, 315, 235, 155];
// Le personnage se tient au milieu de sa largeur ; le chanteur et ses notes passent au-dessus des couloirs ; le boss
// plane à droite, à mi-hauteur des couloirs
const X_BASSE = PX + PW / 2,
  Y_CHANTEUR = LANE_Y[3] - 50,
  BOSS_X = W - 130,
  BOSS_Y = 275;

/** La hauteur d'un couloir, ou du milieu de deux couloirs voisins (n + 0,5) */
const yDeCouloir = (l: number) => (Number.isInteger(l) ? LANE_Y[l] : (LANE_Y[l - 0.5] + LANE_Y[l + 0.5]) / 2);
const yDeVoie = (voie: Voie) => (voie === "basse" ? GY : voie === "chanteur" ? Y_CHANTEUR : yDeCouloir(voie));
// De côté, tout est debout, à sa taille, et rien n'est caché : ce qui sort de l'écran est coupé par son bord
const debout = (x: number, y: number): Pose => ({ x, y, echelle: 1, angle: 0, visible: true });

/** La scène de côté, et ce qu'elle donne à son décor dans chaque univers */
export interface SceneDeCote extends Scene {
  /** Le chemin parcouru par les notes depuis le début de la chanson, en pixels : le décor en défile une part */
  defile(nb: number): number;
  /** Les traces des notes parfaites (#29) que le décor montre, sur un plan qui défile à `vitesse` fois les notes */
  traces(nb: number, vitesse: number): TraceVue[];
}

/** Une trace d'une note parfaite (#29) à l'écran : la trace, sa couleur (`COULEUR_BASSE` ou un couloir), sa place sur
 * le plan du décor, et à quel point la partie vient de la peindre (de 1, à l'instant, à 0, un temps plus tard) */
export interface TraceVue {
  t: number;
  couleur: number;
  x: number;
  frais: number;
}

export const COTE: SceneDeCote = {
  id: "cote",
  poser: (beat, voie, nb) => debout((voie === "basse" ? X_BASSE : HITX) + (beat - nb) * PPB, yDeVoie(voie)),
  impact: (voie) => debout(voie === "basse" ? X_BASSE : HITX, yDeVoie(voie)),
  // Les notes arrivent par la droite et s'en vont par la gauche
  horsChamp: (p: Pose, bord: Bord, marge: number) => (bord === "devant" ? p.x > W + marge : p.x < -marge),
  avance: (W - HITX) / PPB,
  // Un point tous les quatre pixels
  echantillon: 4 / PPB,
  boss: debout(BOSS_X, BOSS_Y),
  defile: (nb) => nb * PPB,
  traces: tracesVisibles,
  fond,
  sol,
};

// Les mesures dont on voit l'accord : de celle qui vient de passer à celle qui entre par la droite
const premiereMesure = (nb: number) => Math.max(0, Math.floor(nb / 4) - 1);
const derniereMesure = (vue: VueDeScene) => Math.min(vue.fin - 1, Math.floor((vue.nb + COTE.avance) / 4) + 1);

function fond(vue: VueDeScene) {
  const { nb, hsl, pulsation: bp } = vue;
  // Décor de l'univers choisi
  if (vue.univers === "boite") boiteBack(nb, hsl, bp, COTE);
  else villeBack(nb, hsl, bp, COTE);

  // Zones d'accord (ciel, alignées sur la ligne de tir)
  const bFirst = premiereMesure(nb),
    bLast = derniereMesure(vue);
  for (let bar = bFirst; bar <= bLast; bar++) {
    const c = vue.accord(bar),
      x0 = HITX + (bar * 4 - nb) * PPB;
    g.fillStyle = hsl(c.hue, 70, 60, 0.07);
    g.fillRect(x0, 96, 4 * PPB, GY - 136);
    g.fillStyle = hsl(c.hue, 70, 65, 0.45);
    g.fillRect(x0, 96, 2, GY - 136);
    txt(c.name, x0 + 10, 122, `700 20px ${FONT.display}`, hsl(c.hue, 75, 72, 0.95));
  }
  // Les repères rythmiques propres à chaque main (#19) : en 3 contre 2, la mélodie a une ligne par croche ici, et
  // la basse un repère par triolet sur le sol, plus bas
  for (let b = Math.ceil(nb - 2); b < nb + 7; b++) {
    if (vue.polyrythmie(b)) {
      g.fillStyle = hexA(COL.mel, 0.16);
      g.fillRect(HITX + (b + 0.5 - nb) * PPB, 134, 1, 286);
    }
    if (b % 4 === 0) continue;
    g.fillStyle = vue.polyrythmie(b) ? hexA(COL.mel, 0.22) : "rgba(239,234,248,.05)";
    g.fillRect(HITX + (b - nb) * PPB, 134, 1, 286);
  }
  // Couloirs et ligne de tir
  for (let i = 0; i < 4; i++) {
    g.fillStyle = hsl(LANE_HUE[i], 60, 70, vue.solo ? 0.14 + 0.1 * bp : 0.08);
    g.fillRect(HITX, LANE_Y[i] - 1, W - HITX, 2);
  }
  g.fillStyle = hexA(COL.mel, 0.3);
  g.fillRect(HITX - 1, 135, 2, 280);
}

function sol(vue: VueDeScene) {
  const { nb, hsl } = vue;
  // Le peigne de la Boîte, devant les cibles
  if (vue.univers === "boite") drawComb(vue.pnow, hsl, COTE);

  // Sol, teinté par l'accord (aligné sur le personnage)
  if (vue.univers === "boite") boiteGround(nb, hsl, COTE);
  else villeGround(nb, hsl, COTE);
  const bLast = derniereMesure(vue);
  for (let bar = premiereMesure(nb); bar <= bLast + 1 && bar < vue.fin; bar++) {
    const c = vue.accord(bar),
      x0 = X_BASSE + (bar * 4 - nb) * PPB;
    g.fillStyle = hsl(c.hue, 60, 55, 0.14);
    g.fillRect(x0, GY, 4 * PPB, 40);
  }
  for (let b = Math.ceil(nb - 2); b < nb + 8; b++) {
    g.fillStyle = b % 4 === 0 ? hexA(COL.bass, 0.5) : "rgba(239,234,248,.12)";
    g.fillRect(X_BASSE + (b - nb) * PPB, GY + 4, 2, b % 4 === 0 ? 14 : 7);
    if (!vue.polyrythmie(b)) continue;
    // Les triolets de la basse (#19) : deux repères de plus dans le temps, et un « 3 » au-dessus du groupe
    g.fillStyle = hexA(COL.bass, 0.45);
    for (const k of [1, 2]) g.fillRect(X_BASSE + (b + k / 3 - nb) * PPB, GY + 4, 2, 10);
    txt("3", X_BASSE + (b + 1 / 3 - nb) * PPB, GY + 30, `700 11px ${FONT.mono}`, hexA(COL.bass, 0.7), "center");
  }
  g.fillStyle = hexA(COL.bass, 0.65);
  g.fillRect(-12, GY, W + 24, 2);
  g.fillStyle = TH().under;
  g.fillRect(-12, GY + 40, W + 24, H - GY - 28);
}

/**
 * Les traces que le décor montre (#29), sur un plan qui défile à `vitesse` fois celle des notes : chacune là où
 * passait ce plan quand sa note a été jouée, derrière le personnage pour la basse, derrière la ligne de tir pour la
 * mélodie. Seules celles qui tombent sur l'écran ; il n'y en a jamais plus que le plafond des traces (`TRACES`).
 */
function tracesVisibles(nb: number, vitesse: number): TraceVue[] {
  const vues: TraceVue[] = [];
  for (const t of tracesAffichees()) {
    const couleur = couleurDeLaTrace(t),
      temps = pasDeLaTrace(t) / PAS_PAR_TEMPS,
      x = (couleur === COULEUR_BASSE ? X_BASSE : HITX) + (temps - nb) * PPB * vitesse;
    if (x < -40 || x > W + 40) continue;
    const age = nb - temps,
      frais = age >= 0 && age < 1 && S.traces.nouvelles.includes(t) ? 1 - age : 0;
    vues.push({ t, couleur, x, frais });
  }
  return vues;
}
