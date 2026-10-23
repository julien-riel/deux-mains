/* ---------- Enregistrement des coups d'une partie (#23) ---------- */
// Logique pure (ADR-0007). La graine refait la chanson (ADR-0005) et l'auto-play improvise à partir d'elle
// (ADR-0012) : pour rejouer une partie, il suffit de ses réglages et de ce que le joueur a fait, dans l'ordre où il
// l'a fait. La réécoute de fin de partie (#23) rejoue ces coups dans le jugement ; le fantôme du meilleur passage
// (#32) les rejoue à l'image, avec le score de la partie à chaque temps.
//
// L'enregistrement vit en mémoire, le temps d'une partie ; celui du meilleur passage d'une chanson est gardé dans la
// sauvegarde comme fantôme (#32, ADR-0014, `jeu/fantome.ts`).
import type { Action, Mains } from "./etat";

/** Ce qu'un appui a donné : la note qu'il a jugée, réussie (« Parfait » ou « Bien ») ou ratée */
export type Resultat = "parfait" | "bien" | "rate";

/** Une touche enfoncée, quelle que soit la commande : clavier, tactile ou MIDI (ADR-0008, ADR-0011) */
export interface Appui {
  /** Le temps de la partie où le coup a été joué, en temps de la chanson (le jugement le reçoit en secondes) */
  temps: number;
  geste: "appui";
  action: Action;
  /** Une commande tactile : un pouce joue tout l'accord, et glisser écrase la plaque qui arrive (ADR-0008) */
  tactile?: true;
  /** En mode pianiste au clavier MIDI (#53, ADR-0011) : la note jouée, que le jugement compare à la note attendue.
   * Pour un écrasement, la fondamentale de l'accord frappé. */
  hauteur?: number;
  /** La note jugée par l'appui ; absent quand il n'en juge aucune (tir dans le vide, solo, vibrato, trille…) */
  resultat?: Resultat;
}
/** Une touche relâchée : elle peut finir ou lâcher une note tenue */
export interface Relache {
  temps: number;
  geste: "relache";
  action: Action;
}
/** L'auto-play pris ou rendu en cours de partie (touche A) */
export interface Bascule {
  temps: number;
  geste: "auto";
  auto: boolean;
}
/** Les mains jouées changées en cours de partie, depuis les réglages */
export interface ChangementDeMains {
  temps: number;
  geste: "mains";
  mains: Mains;
}
/** Une pause : les notes tenues et les trilles en cours y sont réussies, et les touches oubliées */
export interface Pause {
  temps: number;
  geste: "pause";
}
/** La reprise après une mort : la partie repart du début de la section, à ce temps (voir `reprendre`), avec les
 * mains et l'auto-play de ce moment (les coups qui les ont changés depuis le début de la section sont oubliés, et
 * les mains se changent aussi sur l'écran de mort) */
export interface Reprise {
  temps: number;
  geste: "reprise";
  mains: Mains;
  auto: boolean;
}
export type Coup = Appui | Relache | Bascule | ChangementDeMains | Pause | Reprise;

/** Les réglages qui refont la partie : la chanson (graine et difficulté, ou essai), les mains, la vitesse et l'auto-play
 * au départ */
export interface ReglagesDePartie {
  graine: number;
  difficulte: string;
  /** L'essai joué (son id), ou null pour une chanson générée : sa chanson se refait par le registre des essais */
  essai: string | null;
  /** Le niveau du boss de fin de la graine (#26), plutôt que sa chanson */
  boss?: true;
  mains: Mains;
  vitesse: number;
  auto: boolean;
}

/** Une partie enregistrée : ses réglages, et ses coups dans l'ordre où ils ont été joués */
export interface Enregistrement extends ReglagesDePartie {
  coups: Coup[];
  /** Le score de la partie au début de chaque temps, du temps 0 au dernier atteint (#32) : le fantôme s'y compare */
  scores: number[];
  /** La partie est allée au bout de la chanson */
  finie: boolean;
}

export const nouvelEnregistrement = (reglages: ReglagesDePartie): Enregistrement => ({
  ...reglages,
  coups: [],
  scores: [],
  finie: false,
});

/**
 * Note le score de la partie au temps `nb` : chaque temps franchi depuis le dernier noté prend ce score, celui de
 * son début. Le temps ne fait qu'avancer, sauf à la reprise après une mort, qui oublie les temps d'après (`reprendre`).
 */
export function noterScore(enr: Enregistrement | null, nb: number, score: number) {
  if (!enr) return;
  for (let b = enr.scores.length; b <= Math.floor(nb); b++) enr.scores[b] = score;
}

/**
 * Ajoute un coup à la fin de l'enregistrement (rien sans enregistrement). Après une reprise, les coups du décompte
 * qui la précède sont ignorés : ses notes sont passées (`resumeCP`), et la partie gardée s'y raccorde.
 */
export function noter(enr: Enregistrement | null, coup: Coup) {
  if (!enr) return;
  for (let i = enr.coups.length - 1; i >= 0; i--)
    if (enr.coups[i].geste === "reprise") {
      if (coup.temps < enr.coups[i].temps) return;
      break;
    }
  enr.coups.push(coup);
}

/**
 * La reprise après une mort, au début de la section `temps` : les coups joués depuis sont oubliés, la partie
 * gardée est celle d'avant la mort jusque-là, puis celle d'après. L'enregistrement reste celui d'une seule partie,
 * du début à la fin de la chanson.
 */
export function reprendre(enr: Enregistrement | null, temps: number, mains: Mains, auto: boolean) {
  if (!enr) return;
  enr.coups = enr.coups.filter((c) => c.temps < temps);
  enr.coups.push({ temps, geste: "reprise", mains, auto });
  // Le score repart de celui du début de la section : les temps d'après seront notés de nouveau
  enr.scores.length = Math.min(enr.scores.length, Math.max(0, Math.ceil(temps)));
}

/** Les réglages d'un enregistrement, pour en commencer un autre de la même partie */
export const reglagesDe = ({
  graine,
  difficulte,
  essai,
  boss,
  mains,
  vitesse,
  auto,
}: ReglagesDePartie): ReglagesDePartie => ({
  graine,
  difficulte,
  essai,
  ...(boss && { boss }),
  mains,
  vitesse,
  auto,
});

/** Les compteurs du jugement qui disent ce qu'un appui a donné */
export interface Compteurs {
  perfect: number;
  good: number;
  miss: number;
}
export const compteurs = ({ perfect, good, miss }: Compteurs): Compteurs => ({ perfect, good, miss });

/** Ce qu'un appui a donné, d'après les compteurs avant et après lui : une note ratée l'emporte, puis « Bien » */
export function resultatEntre(avant: Compteurs, apres: Compteurs): Resultat | undefined {
  if (apres.miss > avant.miss) return "rate";
  if (apres.good > avant.good) return "bien";
  if (apres.perfect > avant.perfect) return "parfait";
  return undefined;
}

/**
 * Les coups à rejouer jusqu'au temps `jusqua` (compris), à partir du rang `suivant` : renvoie leur liste et le rang
 * du prochain. Les coups se rejouent dans l'ordre où ils ont été joués, même quand deux commandes les ont horodatés
 * un peu dans le désordre.
 */
export function coupsDus(enr: Enregistrement, suivant: number, jusqua: number): { coups: Coup[]; suivant: number } {
  const coups: Coup[] = [];
  while (suivant < enr.coups.length && enr.coups[suivant].temps <= jusqua) coups.push(enr.coups[suivant++]);
  return { coups, suivant };
}
