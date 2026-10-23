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
export type Genre = "intro" | "couplet" | "refrain" | "pont" | "outro";
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
}

/** Un événement de note : un obstacle (main gauche) ou un ennemi (main droite). */
export interface Note {
  hand: Main;
  beat: number;
  dur: number;
  /** Main gauche : 0 glisser, 1 sauter, 2 double saut, 3 écraser (#8). Main droite : le couloir. */
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
}

export interface Progression {
  name: string;
  mode: string;
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
  endBeat: number;
  keyName: string;
  progLabel: string;
}
