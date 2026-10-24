/* ---------- Le contrat de scène (ADR-0019) ---------- */
// Une scène est une façon de représenter la musique : de côté, en colonnes, sur un disque, vers l'horizon. Elle ne
// fournit que sa géométrie et son décor :
//
//   - la pose d'une note de chaque voie à un temps donné (`poser`), et le point d'impact de chaque voie (`impact`),
//     là où la note se joue et où se tient le personnage ;
//   - ce qu'elle laisse voir : combien de temps à l'avance (`avance`), et ce qui est sorti de son champ (`horsChamp`) ;
//   - la place du boss de fin (`boss`), et le pas de temps qui trace une ligne lisse le long d'une voie (`echantillon`) ;
//   - où se lit la légende de chaque couloir (`etiquette`, sur le rail de gauche sans elle) ;
//   - son fond (`fond`) et son sol (`sol`), habillés par chaque univers (ADR-0015).
//
// Elle ne juge rien, ne lit de la partie que ce que lui donne la vue (`VueDeScene`), et ne décide d'aucune règle.
// Tout le reste est commun (`src/rendu/scene.ts`) et se dessine à la pose donnée : ennemis des lieux, personnage,
// obstacles, tenues, serpents, trilles, relais, petites notes, chanteur, traces, fantôme, boss, effets du jugement
// et HUD. Une chose qui tient en un point (un ennemi, un obstacle, le personnage) se dessine à sa pose, à son
// échelle et à son angle (`aLaPose`, `src/rendu/outils.ts`) ; une chose qui dure (tenue, tunnel, pente) se tend
// entre la pose de son début et celle de sa fin ; une chose qui passe d'une voie à l'autre (serpent, trille)
// échantillonne les poses le long du temps.
//
// Toutes les places sont en pixels, dans l'espace de la scène, W × H (`src/rendu/outils.ts`) : le rendu commun
// ramène cet espace dans le cadre de la scène à l'écran (`Cadre`).

import type { IdScene } from "../../jeu/scenes";
import type { Palette } from "../outils";

/**
 * Où et comment se dessine une chose : sa place (x, y), son échelle (1 : sa taille de référence, celle de la scène
 * de côté), son angle en radians (0 : debout, dans le sens de lecture de la scène de côté), et si la scène la montre
 * (une scène peut cacher ce qui passe derrière son décor).
 */
export interface Pose {
  x: number;
  y: number;
  echelle: number;
  angle: number;
  visible: boolean;
}

/**
 * Une voie de la scène : un couloir de la mélodie, de 0 (fondamentale) à 3 (octave), ou n + 0,5 entre deux
 * couloirs voisins (les petites notes, #14, et les silhouettes de la réponse au chanteur, #18) ; la ligne du
 * chanteur (`"chanteur"`, #18), où passent ses notes et celles du boss (#26) ; ou le sol de la basse (`"basse"`),
 * où passent les obstacles et où court le personnage.
 */
export type Voie = number | "chanteur" | "basse";

/** Un rectangle de l'espace de la scène */
export interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Les deux bords du champ d'une scène : celui d'où arrivent les notes, et celui par où elles s'en vont */
export type Bord = "devant" | "derriere";

/** Ce qu'une scène sait de la partie pour dessiner son fond et son sol : le temps, et la musique à ce temps */
export interface VueDeScene {
  /** Le temps de la chanson, en temps, et le temps écoulé depuis l'image précédente, en secondes */
  nb: number;
  dt: number;
  /** L'heure de l'image (performance.now), pour les animations du décor */
  pnow: number;
  /** La palette de la partie, qui se désature quand l'harmonie baisse */
  hsl: Palette;
  /** Le battement du temps : 1 pile sur le temps, qui retombe aussitôt */
  pulsation: number;
  /** L'univers qui habille la scène (ADR-0006) */
  univers: string;
  /** Le cadre de la scène à l'écran, dans l'espace de la scène : tout l'écran au clavier */
  cadre: Cadre;
  /** L'accord d'une mesure de la partie, son nom et sa teinte */
  accord(bar: number): { name: string; hue: number };
  /** Le temps `b` tombe-t-il dans une section en 3 contre 2 (#19) ? */
  polyrythmie(b: number): boolean;
  /** Le nombre de mesures de la partie : Infinity quand elle tourne sans fin (jam, boucle) */
  fin: number;
  /** Le solo libre est en cours (#9) : les couloirs battent au temps */
  solo: boolean;
  /** Les notes ratées des derniers temps, pour qu'une scène les marque dans son décor : leur temps, leur voie et
   * l'heure du raté (performance.now) */
  rates: { beat: number; voie: Voie; at: number }[];
  /** Les notes de la mélodie qui passent entre les temps `de` et `a`, dans l'ordre du temps */
  melodie(de: number, a: number): NoteDeScene[];
  /** Le refrain en cours, ses temps de début et de fin dans la partie : son décor peut s'y déplier (#78) ; null au
   * repos et hors refrain */
  refrain: { debut: number; fin: number } | null;
}

/**
 * Une note de la mélodie, telle qu'une scène peut l'habiller (des parachutes, des avions) : son temps, sa voie (là
 * où elle se montre), sa durée, si elle attend encore d'être jouée (ou est tenue), et si elle fait partie d'un
 * accord de la main droite. Le dessin de la note elle-même reste commun.
 */
export interface NoteDeScene {
  beat: number;
  voie: number;
  dur: number;
  attend: boolean;
  accord: boolean;
}

/**
 * Le geste du personnage à l'image, calculé par le rendu commun, pour une scène qui le voit sous un autre angle
 * (`personnage`) : sa place au sol, dans le repère de sa pose (x, sol), sa hauteur au-dessus du sol (`haut`, négative
 * en l'air), s'il glisse, s'écrase (de 0 à 1) ou court (et la phase de sa course), s'il vient d'être blessé, et
 * l'univers qui l'habille.
 */
export interface GesteDuPersonnage {
  x: number;
  sol: number;
  haut: number;
  glisse: boolean;
  ecrase: number;
  court: boolean;
  phase: number;
  blesse: boolean;
  fantome: boolean;
  univers: string;
  hsl: Palette;
}

/** Une scène : sa géométrie, son champ et son décor */
export interface Scene {
  id: IdScene;
  /** La pose d'une note de la voie `voie` au temps `beat`, vue au temps `nb` : au point d'impact quand beat = nb */
  poser(beat: number, voie: Voie, nb: number): Pose;
  /** Le point d'impact d'une voie, où sa note se joue ; celui de la basse est là où se tient le personnage */
  impact(voie: Voie): Pose;
  /** La pose est-elle sortie du champ par ce bord, de plus de `marge` pixels ? Le rendu commun n'y dessine rien. */
  horsChamp(p: Pose, bord: Bord, marge: number): boolean;
  /** Combien de temps la scène montre à l'avance, du point d'impact au bord d'où arrivent les notes */
  avance: number;
  /** Le pas de temps qui trace une ligne lisse le long d'une voie (le corps d'un serpent, #16) */
  echantillon: number;
  /** Où plane le boss de fin (#26), derrière les couloirs d'où sortent ses ennemis */
  boss: Pose;
  /**
   * Où se lit la légende d'un couloir (sa touche, son degré, sa note) : le bord gauche de sa touche, à mi-hauteur.
   * Sans elle, sur le rail de gauche, à la hauteur du point d'impact du couloir.
   */
  etiquette?(couloir: number): { x: number; y: number };
  /** Le fond, sous les cibles des couloirs : le décor de l'univers et les repères du temps (accords, temps) */
  fond(vue: VueDeScene): void;
  /** Le sol, par-dessus les cibles et sous les notes : le sol de l'univers et ses repères */
  sol(vue: VueDeScene): void;
  /**
   * Le personnage vu sous l'angle de la scène, quand le dessin commun (de profil) ne convient pas : vu de dos vers
   * l'horizon (#82). Il se dessine au geste donné, dans le repère de la pose du personnage, et renvoie le bout de
   * son arme, d'où partent les tirs. Sans lui, le personnage est dessiné de profil.
   */
  personnage?(geste: GesteDuPersonnage): [number, number];
}
