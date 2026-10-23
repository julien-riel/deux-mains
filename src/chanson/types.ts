// Types de la chanson générée

/** Une voix qui sonne, qu'on peut arrêter (note tenue lâchée, pause). Fournie par l'audio. */
export interface Voix {
  stop(at: number): void;
  /** Fait osciller la hauteur de la voix autour de sa note, un instant (vibrato, #17) */
  vibrer?(at: number): void;
  /** Fait glisser la voix jusqu'à cette note, sans la couper (serpent, #16) */
  glisser?(midi: number, at: number): void;
}

export type Main = "L" | "R";
/** « pont » est le solo libre (ou le pont en mains croisées, #21) ; « polyrythmie » est la section en 3 contre 2
 * (#19, ADR-0013), où la basse joue en triolets pendant que la mélodie reste en croches. */
export type Genre = "intro" | "couplet" | "refrain" | "pont" | "polyrythmie" | "outro";
export type EtatNote = "pending" | "hit" | "holding" | "done" | "miss" | "broken" | "skip";

/** Un accord de la progression, et les notes de ses quatre couloirs (fondamentale, tierce, quinte, octave). */
export interface Accord {
  pc: number;
  q: string;
  name: string;
  ints: number[];
  root: number;
  bass: number;
  lanes: number[];
  hue: number;
}

export interface Section {
  name: string;
  kind: Genre;
  bars: number;
  start: number;
  /** Un pont en mains croisées (#21) : la scène s'y retourne, mais les touches et le jugement restent les mêmes.
   * Ce pont a une mélodie écrite : ce n'est pas un solo libre. */
  croisee?: true;
}

/** Un événement de note : un obstacle (main gauche) ou un ennemi (main droite). */
export interface Note {
  hand: Main;
  /** Le temps de la note et sa durée, en temps : des multiples de 1/12 de temps, comparés par `pas()` (ADR-0013) */
  beat: number;
  dur: number;
  /** Main gauche : 0 glisser, 1 sauter, 2 double saut, 3 écraser (#8), 4 monter une marche et 5 descendre une
   * marche d'un escalier (#13). Main droite : le couloir, ou n + 0,5 pour une petite note entre les couloirs n et
   * n + 1 (#14), qui se joue avec l'une ou l'autre des deux touches (ADR-0010). */
  lane: number;
  bar: number;
  kind: Genre;
  midi: number;
  /** Une pente (#12) : glisser tenu, la note glisse de `midi` jusqu'à cette note d'arrivée */
  fin?: number;
  /** Une trille (#15) de la main droite : le couloir voisin avec lequel on alterne pendant `dur`, et sa note */
  trille?: number;
  midiTrille?: number;
  /** Un serpent (#16) de la main droite : les couloirs voisins qu'il traverse, le premier compris (`lane`), dans un
   * seul sens, et leurs notes. Chaque couloir dure la même part de `dur`. */
  serpent?: number[];
  midiSerpent?: number[];
  harm?: number;
  vel?: number;
  air?: number;
  /** Les notes du même temps : un accord */
  grp?: Note[];
  // État de jeu
  state: EtatNote;
  auto?: boolean;
  voice?: Voix;
  missAt?: number;
  /** Les tapotements de vibrato donnés pendant cette note tenue (#17), et l'heure du dernier pour l'image */
  vibrato?: number;
  vibreAt?: number;
  /** Une trille en cours (#15) : l'écart du premier appui, le dernier couloir appuyé, les alternances comptées,
   * et l'heure du dernier appui pour l'image */
  ecart?: number;
  dernier?: number;
  alternances?: number;
  trilleAt?: number;
  /** Un serpent en cours (#16) : le rang du dernier couloir atteint, l'heure (en secondes de la chanson) où toutes
   * les touches ont été lâchées juste avant un passage, et l'heure du dernier passage pour l'image */
  troncon?: number;
  lacheAt?: number;
  passeAt?: number;
  /** Le passage de la boucle auquel appartient cette copie de la note (ADR-0009) */
  passage?: number;
  /** Une note de la phrase du solo reprise au dernier refrain (#9, ADR-0012) : elle n'existe que dans la partie */
  reprise?: boolean;
  /** Une note de la réponse au chanteur (#18) : une silhouette dont le couloir ne se révèle qu'au coup. Les quatre
   * notes d'une réponse sont celles de la même mesure. */
  reponse?: true;
  /** Une note d'une phrase en relais (#20) : la mesure où commence le relais, qui le désigne dans la partie (en
   * boucle, chaque passage a le sien). Une main joue la première mesure, l'autre finit la phrase sur la suivante. */
  relais?: number;
}

/** Une note chantée par le chanteur (#18) : on l'entend, on ne la joue pas */
export interface NoteChantee {
  beat: number;
  /** Le degré chanté (le couloir de la réponse), et sa note dans l'accord de la mesure chantée (ADR-0003) */
  lane: number;
  midi: number;
}

/** L'ennemi chanteur (#18) : il chante une phrase sur sa mesure, que le joueur répète sur la mesure suivante */
export interface Chanteur {
  bar: number;
  notes: NoteChantee[];
}

export interface Progression {
  name: string;
  mode: string;
  /** La gamme des notes hors accord (ADR-0010), une clé de `GAMMES` : celle du mode, sauf indication */
  gamme?: string;
  chords: [number, string][];
  end: [number, string];
}

export interface Chanson {
  seed: number;
  prog: Progression;
  keyPc: number;
  bpm: number;
  sections: Section[];
  totalBars: number;
  chords: Accord[];
  ev: Note[];
  /** Les chanteurs (#18) : leur phrase n'est pas dans `ev`, elle ne se joue pas et n'est pas jugée */
  chanteurs: Chanteur[];
  endBeat: number;
  keyName: string;
  progLabel: string;
}
