/* ---------- État ---------- */
import type { Chanson, Main, Note, Section } from "../chanson/types";
import type { Essai } from "../essais/registre";
import { clamp } from "../outils";
import {
  cleChanson,
  cleEssai,
  clePartition,
  sauvegardeVide,
  tracesGardees,
  type Progres,
  type Sauvegarde,
} from "../sauvegarde/format";
import { reunir } from "./traces";
import type { Partition } from "../chanson/partition";
import type { Outil } from "./editeur";
import type { Enregistrement } from "./enregistrement";
import type { Fantome } from "./fantome";
import type { Jam } from "./jam";
import type { Relecture } from "./reecoute";
import type { IdScene } from "./scenes";
import type { Remontage } from "./remontage";
import type { Reprise } from "./variations";

export type Mode =
  | "title"
  | "essais"
  | "carte"
  | "repertoire"
  | "sauvegarde"
  | "editeur"
  | "calib"
  | "remontage"
  | "play"
  | "pause"
  | "dying"
  | "dead"
  | "done";

/** Ce que le joueur fait, quelle que soit la commande : clavier, tactile ou MIDI (ADR-0008) */
export type Action = "sauter" | "glisser" | "ecraser" | "couloir0" | "couloir1" | "couloir2" | "couloir3";
export const COULOIRS: Action[] = ["couloir0", "couloir1", "couloir2", "couloir3"];

/** Les mains que joue le joueur : les deux, une seule (l'autre joue toute seule), ou le duo local (#6), où deux
 * joueurs tiennent chacun une main sur le même clavier */
export type Mains = "both" | "L" | "R" | "duo";

/** Les coups et le score d'une main, comptés à part pour le duo (#6) */
export interface StatsMain {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
}
export const statsNeuves = (): Record<Main, StatsMain> => ({
  L: { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0 },
  R: { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0 },
});

/** Les accords à deux mains, ou les phrases en relais (#20) : réussis, et jugés (réussis ou non). En duo, c'est
 * l'exploit commun (#6). */
export interface AccordsDuo {
  reussis: number;
  total: number;
}

/** Le boss de fin dans la partie (#26) : sa vie et sa vie de départ, les phrases du canon rejouées justes et
 * jugées, le temps de la partie où il est tombé (null tant qu'il tient), et l'heure du dernier coup reçu pour
 * l'image */
export interface EtatBoss {
  vie: number;
  max: number;
  reussies: number;
  total: number;
  vaincu: number | null;
  toucheAt: number;
}
/** Le boss neuf d'une chanson, ou null pour une chanson sans boss */
export const bossNeuf = (song: Chanson): EtatBoss | null =>
  song.boss ? { vie: song.boss.vie, max: song.boss.vie, reussies: 0, total: 0, vaincu: null, toucheAt: -1e9 } : null;

/** Point de reprise : le début de la section en cours et le score à ce moment-là */
export interface PointDeReprise {
  sec: Section;
  score: number;
  perfect: number;
  good: number;
  miss: number;
  maxCombo: number;
  parMain: Record<Main, StatsMain>;
  accordsDuo: AccordsDuo;
  relais: AccordsDuo;
  boss: EtatBoss | null;
}

/** Les coups d'un passage de la boucle */
export interface Coups {
  parfait: number;
  bien: number;
  rate: number;
}

/** La boucle de la partie en cours (#5, ADR-0009) : la section rejouée, le dernier passage dont les notes
 * existent, et les coups de chaque passage */
export interface Boucle {
  sec: Section;
  cree: number;
  passages: Coups[];
}

/** Le calibrage en cours : les clics du métronome et les coups du joueur, à l'heure où on les entend */
export interface Calibrage {
  clics: number[];
  coups: number[];
  fin: number;
  /** Le décalage mesuré en secondes, null s'il n'a pas pu l'être ; absent tant que le métronome joue */
  resultat?: number | null;
}

/** Le remontage entre deux lieux (#27, ADR-0015) : ses tours, l'heure de son premier clic sur l'horloge audio, le
 * prochain temps à programmer, et l'heure (performance.now) où chaque tour a été jugé, pour l'animer */
export interface RemontageEnCours extends Remontage {
  debut: number;
  programme: number;
  eclats: number[];
}

/** L'essai en cours, et les réglages du joueur à lui rendre quand il quitte les essais */
export interface EssaiEnCours {
  essai: Essai;
  avant: { diff: string; theme: string; practice: Mains; vitesse: number; boucle: number };
  /** La progression fictive de l'essai (#25), en mémoire seulement : ce qu'il gagne n'atteint jamais le stockage */
  sauvegarde?: Sauvegarde;
}

/** L'éditeur de partitions (#28) : le brouillon, ce qu'on y a choisi, et la version rangée d'où il vient */
export interface EditeurEnCours {
  partition: Partition;
  /** La section montrée sur la grille */
  section: number;
  outil: Outil;
  /** La grille, ou les compositions rangées et le code de partage */
  vue: "grille" | "rangement";
  /** L'empreinte de la composition rangée d'où vient le brouillon : la ranger la remplace */
  rangee: string | null;
  message: string;
  /** Le brouillon vient d'un essai (#28) : il disparaît en quittant les essais */
  essai?: true;
}

/** L'état de la partie, partagé par tous les modules */
export interface Etat {
  song: Chanson;
  seed: number;
  diff: string;
  mode: Mode;
  health: number;
  combo: number;
  maxCombo: number;
  score: number;
  perfect: number;
  good: number;
  miss: number;
  /** Les mêmes coups, main par main : le score total, lui, compte aussi le bonus des accords */
  parMain: Record<Main, StatsMain>;
  accordsDuo: AccordsDuo;
  /** Les phrases en relais entre les deux mains (#20) */
  relais: AccordsDuo;
  // Horloge de la partie (ADR-0004), et le décalage du joueur mesuré par le calibrage, en secondes
  startBeat: number;
  decalage: number;
  calib: Calibrage;
  t0: number;
  nextStep: number;
  timer: ReturnType<typeof setInterval> | 0;
  /** Les notes de la partie : celles de la chanson, ou les passages de la boucle (ADR-0009) */
  ev: Note[];
  deathAt: number;
  deathBeat: number;
  titleBeat: number;
  curSec: Section;
  cp: PointDeReprise;
  banner: { text: string; sub: string; at: number };
  // Entrées et animation
  keys: Partial<Record<Action, boolean>>;
  jumpAt: number;
  jumpAir: number;
  /** Le second saut, donné en l'air (#7) : il compte tant qu'il suit le saut en cours */
  doubleAt: number;
  doubleAir: number;
  slideUntil: number;
  /** L'écrasement sur une plaque (#8) */
  ecraseAt: number;
  hurtAt: number;
  shake: number;
  gun: number[];
  laneFlash: number[];
  beams: { lane: number; at: number; ok: boolean | null }[];
  parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; size: number }[];
  pops: { text: string; x: number; y: number; color: string; at: number }[];
  // Auto-play et réglages
  auto: boolean;
  autoUsed: boolean;
  /** Ce que l'auto-play anime au moment où on l'entend : une note, un appui de trille (#15) sur un couloir, un
   * passage de serpent (#16) vers son couloir de ce rang, ou le solo */
  autoQ: { at: number; ev?: Note; trille?: number; passage?: number; solo?: number }[];
  keyFlash: Partial<Record<Action, number>>;
  practice: Mains;
  /** Vitesse de lecture choisie (#4), et celle de la partie en cours, figée au départ pour que l'horloge ne saute pas */
  vitesse: number;
  vitessePartie: number;
  /** Section choisie pour la boucle (#5), par son rang dans la chanson, -1 pour aucune ; et la boucle de la partie en cours */
  boucle: number;
  bouclePartie: Boucle | null;
  /** Ce que la partie garde du solo libre, sa note de style (#22), et la phrase qui revient au dernier refrain
   * (#9, ADR-0012) */
  reprise: Reprise;
  theme: string;
  /** Une forme par couloir, en plus de la couleur (#31) */
  formes: boolean;
  /** Le fantôme du meilleur passage et l'écart de score avec lui se voient (#32) ; un réglage les masque */
  voirFantome: boolean;
  /** Le fantôme du meilleur passage de la chanson, pour la partie en cours (#32) ; null s'il n'y en a pas */
  fantome: Fantome | null;
  keyAng: number;
  /** Le mode essai : l'essai ouvert, ou null pour une chanson générée */
  essai: EssaiEnCours | null;
  /** La scène de la partie (ADR-0019), choisie quand sa chanson se met en place (`sceneDeLaPartie`) */
  scene: IdScene;
  /** Les coups de la partie en cours (#23), ou null quand elle ne s'enregistre pas (boucle) */
  enregistrement: Enregistrement | null;
  /** La réécoute en cours (#23) : la partie rejoue les coups enregistrés, et ceux du joueur sont ignorés */
  relecture: Relecture | null;
  /** La jam en cours (#24) : les mesures qu'elle rejoue sans fin, sans notes à jouer ; null hors jam */
  jam: Jam | null;
  /** La progression du joueur (ADR-0014), lue au démarrage ; `progression()` donne celle qui compte en ce moment */
  sauvegarde: Sauvegarde;
  /** Ce que la dernière chanson finie a changé dans la progression (#25), pour l'écran de fin ; null sinon */
  progres: Progres | null;
  /** Les traces peintes par les notes parfaites de la partie en cours (#29), et la clé de sa chanson
   * (`cleDesTraces`) ; elles rejoignent celles de la sauvegarde à la fin d'une chanson réussie */
  traces: { cle: string | null; nouvelles: number[] };
  /** Le remontage en cours, ou le dernier fait pour la chanson en place (#27) ; null sinon */
  remontage: RemontageEnCours | null;
  /** L'harmonie de départ des parties de la chanson en place, gagnée au remontage (#27) ; null : 100 */
  depart: number | null;
  /** Le boss de fin de la partie (#26), dans un niveau de boss ; null sinon */
  boss: EtatBoss | null;
  /** L'éditeur de partitions (#28) : son brouillon reste en mémoire entre deux écoutes ; null tant qu'on ne l'a pas ouvert */
  editeur: EditeurEnCours | null;
  /** Une composition jouée impose sa difficulté sans l'enregistrer : celle du joueur et sa boucle, à lui rendre quand
   * il revient à sa chanson ; null quand aucune composition n'est installée */
  avantComposition: { diff: string; boucle: number } | null;
  /** La partie en cours a été jouée, au moins en partie, en mode pianiste au clavier MIDI (#53) : son score ne se
   * compare pas à ceux de la position fixe (ADR-0011) */
  pianiste: boolean;
}

export const S: Etat = {
  song: null,
  seed: 1,
  diff: "normal",
  mode: "title",
  health: 100,
  combo: 0,
  maxCombo: 0,
  score: 0,
  perfect: 0,
  good: 0,
  miss: 0,
  parMain: statsNeuves(),
  accordsDuo: { reussis: 0, total: 0 },
  relais: { reussis: 0, total: 0 },
  startBeat: 0,
  decalage: 0,
  calib: null,
  t0: 0,
  nextStep: 0,
  timer: 0,
  ev: [],
  deathAt: 0,
  deathBeat: 0,
  titleBeat: 4,
  curSec: null,
  cp: null,
  banner: null,
  keys: {},
  jumpAt: -99,
  jumpAir: 0.5,
  doubleAt: -99,
  doubleAir: 0.5,
  slideUntil: -99,
  ecraseAt: -99,
  hurtAt: -1e9,
  shake: 0,
  gun: [260, 470],
  laneFlash: [-1e9, -1e9, -1e9, -1e9],
  beams: [],
  parts: [],
  pops: [],
  auto: false,
  autoUsed: false,
  autoQ: [],
  keyFlash: {},
  practice: "both",
  vitesse: 1,
  vitessePartie: 1,
  boucle: -1,
  bouclePartie: null,
  reprise: { solo: [], phrase: null, style: null, faite: false },
  theme: "ville",
  formes: true,
  voirFantome: true,
  fantome: null,
  keyAng: 0,
  essai: null,
  scene: "cote",
  enregistrement: null,
  relecture: null,
  jam: null,
  sauvegarde: sauvegardeVide(),
  progres: null,
  traces: { cle: null, nouvelles: [] },
  remontage: null,
  depart: null,
  boss: null,
  editeur: null,
  avantComposition: null,
  pianiste: false,
};
export const VITESSES = [0.5, 0.75, 1];
// Secondes par temps : le tempo de la chanson, ralenti par la vitesse de la partie (#4). La chanson ne change pas.
export const spb = () => 60 / (S.song.bpm * S.vitessePartie);
// Sur l'écran de départ, dans la liste des essais, pendant le calibrage et le remontage (#27), la scène tourne au repos
export const auRepos = () =>
  S.mode === "title" ||
  S.mode === "essais" ||
  S.mode === "carte" ||
  S.mode === "sauvegarde" ||
  S.mode === "editeur" ||
  S.mode === "calib" ||
  S.mode === "remontage";
// Pendant un essai, la progression fictive de l'essai, ou une progression vide : un essai se voit toujours pareil,
// et ne lit ni n'écrit celle du joueur (#25)
const AUCUNE = sauvegardeVide();
export const progression = (): Sauvegarde => (S.essai ? (S.essai.sauvegarde ?? AUCUNE) : S.sauvegarde);

/**
 * La clé sous laquelle la chanson installée garde ses traces (#29) : celle de son meilleur score, ou celle de l'essai
 * en cours, dans sa progression fictive. Le boss de fin (#26) n'est pas la chanson de sa graine : il n'en a pas.
 */
export function cleDesTraces(): string | null {
  const source = S.song?.source;
  if (!S.song || S.song.boss) return null;
  if (S.essai) return cleEssai(S.essai.essai.id);
  if (source?.genre === "partition") return clePartition(source.empreinte);
  return cleChanson(S.seed, S.diff);
}
/** Les traces que le décor montre : celles que la progression garde pour la chanson installée, puis celles que la
 * partie en cours vient de peindre, dans la limite du plafond */
export function tracesAffichees(): number[] {
  const cle = cleDesTraces();
  if (cle === null) return [];
  const gardees = tracesGardees(progression(), cle);
  return S.traces.cle === cle ? reunir(gardees, S.traces.nouvelles) : gardees;
}

/** La chanson installée vient d'une partition écrite à la main (#28, ADR-0016) */
export const enComposition = () => S.song?.source?.genre === "partition";
/** L'air du répertoire joué (ADR-0018), ou undefined : une chanson connue est aussi une partition */
export const airEnCours = () => (S.song?.source?.genre === "partition" ? S.song.source.repertoire : undefined);

// Le combo qui fait le multiplicateur d'une main : en duo, celui de son joueur (#6) ; sinon le combo commun
export const comboDe = (hand?: Main) => (hand && S.practice === "duo" ? S.parMain[hand].combo : S.combo);
export const mult = (hand?: Main) => 1 + Math.min(3, Math.floor(comboDe(hand) / 10)) * 0.5;
// Les mesures que la partie rejoue sans fin : la section de la boucle (#5), ou le corps de la chanson en jam (#24)
const rejouees = () => (S.bouclePartie && S.bouclePartie.sec) || S.jam;
/** La partie n'a pas de fin : en boucle ou en jam (ADR-0009) */
export const sansFin = () => !!rejouees();
// Le temps de la partie ne recule jamais : en boucle (et en jam), ses mesures continuent après la fin des mesures
// rejouées, et cette conversion seule les ramène dans la chanson (ADR-0009). Hors boucle, c'est la même mesure.
export function mesureDeLaChanson(bar: number) {
  const sec = rejouees();
  return sec && bar >= sec.start + sec.bars ? sec.start + ((bar - sec.start) % sec.bars) : bar;
}
/** Le passage de la boucle en cours à ce temps de la partie, à partir de 0 (le décompte fait partie du premier) */
export const passageAt = (beat: number) =>
  Math.max(0, Math.floor((beat / 4 - S.bouclePartie.sec.start) / S.bouclePartie.sec.bars));
export const sectionAtBar = (bar: number) => {
  bar = mesureDeLaChanson(bar);
  return (
    S.song.sections.find((s) => bar >= s.start && bar < s.start + s.bars) || S.song.sections[S.song.sections.length - 1]
  );
};
export const chordAtBar = (bar: number) => S.song.chords[mesureDeLaChanson(bar)];
/** Le chanteur (#18) qui chante sur cette mesure de la partie, ou undefined. Ses notes sont aux temps de la
 * chanson : en boucle, on les décale de `4 * (bar - chanteur.bar)` (ADR-0009). */
export const chanteurAtBar = (bar: number) => {
  const b = mesureDeLaChanson(bar);
  return (S.song.chanteurs ?? []).find((c) => c.bar === b);
};
/** La phrase que le boss de fin (#26) joue sur cette mesure de la partie, ou undefined. Comme celles du chanteur,
 * ses notes sont aux temps de la chanson : en boucle, on les décale de `4 * (bar - phrase.bar)` (ADR-0009). */
export const phraseDuBossAt = (bar: number) => {
  const b = mesureDeLaChanson(bar);
  return S.song.boss?.phrases.find((p) => p.bar === b);
};
export const chordAtBeat = (b: number) =>
  S.song.chords[clamp(mesureDeLaChanson(Math.floor(b / 4)), 0, S.song.totalBars - 1)];
// La précision affichée en fin de partie et pour chaque passage : un « Bien » compte pour 60 %
export const precision = (parfait: number, bien: number, rate: number) =>
  (parfait + 0.6 * bien) / Math.max(1, parfait + bien + rate);
/** Compte un coup dans le passage de sa note, quand la partie est en boucle */
export function compterPassage(ev: Note, coup: keyof Coups) {
  const b = S.bouclePartie;
  if (!b || ev.passage === undefined) return;
  (b.passages[ev.passage] ??= { parfait: 0, bien: 0, rate: 0 })[coup]++;
}
export const layers = () => {
  const ok = S.health >= 50;
  return { arp: ok && S.combo >= 8, choir: ok && S.combo >= 20, strings: ok && S.combo >= 35 };
};
// Une seule main jouée par le joueur : c'est un entraînement. En duo, chaque main a son joueur (#6).
export const uneMain = () => S.practice === "L" || S.practice === "R";
// La main qui joue toute seule : les deux en auto-play, ou l'autre main en entraînement ; jamais en duo, ni en jam
// (#24), où les deux mains jouent librement
export const autoFor = (hand: Main) => !S.jam && (S.auto || (uneMain() && S.practice !== hand));
