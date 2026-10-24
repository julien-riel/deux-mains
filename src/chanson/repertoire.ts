/* ---------- Le répertoire : des chansons connues du domaine public (ADR-0018) ---------- */
// Logique pure (ADR-0007). Chaque chanson est une partition de la version 2 (ADR-0016, ADR-0018) : ses accords
// sont écrits mesure par mesure, la mélodie reste en couloirs, et les petites notes prennent la gamme entière. Les
// airs sont anciens et libres de droits ; les arrangements sont les nôtres. Une chanson se joue dans la difficulté du
// joueur, qui ne règle que le jugement : ses notes sont toujours celles de la partition. Chacune habite le lieu de sa
// progression (ADR-0015) : son ennemi, son instrument et son décor, mais elle ne réussit pas le lieu.
import { composer, type Partition } from "./partition";
import type { Chanson } from "./types";

export interface Air {
  /** L'identifiant de la chanson : minuscules et tirets */
  id: string;
  /** D'où vient l'air : son auteur et sa date, ou sa tradition */
  origine: string;
  partition: Partition;
}

/** Les chansons du répertoire, des plus simples aux plus vives */
export const REPERTOIRE: Air[] = [
  {
    id: "clair-de-lune",
    origine: "Chanson populaire française, XVIIIᵉ siècle",
    partition: {
      v: 2,
      titre: "Au clair de la lune",
      ton: 0,
      bpm: 96,
      diff: "normal",
      prog: "Vamp lydien",
      sections: [
        { genre: "intro", mesures: 1, accords: ["IM7"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["IM7"],
          basse: ["S...W...", "S...W...", "S...W...", "T-----.."],
          melodie: ["0.0.0.a.", "1--.a...", "0.1.a.a.", "0------.", "0.0.0.a.", "1--.a...", "0.1.a.a.", "0------."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["V", "II", "V", "V", "IM7", "IM7", "IM7", "IM7"],
          basse: ["S.W.S.W.", "S...W...", "S.W.S.W.", "T-----.."],
          melodie: ["2.2.2.2.", "2--.2--.", "2.b.1.a.", "0------.", "0.0.0.a.", "1--.a...", "0.1.a.a.", "0------."],
        },
        { genre: "outro", mesures: 1, accords: ["IM7"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "frere-jacques",
    origine: "Comptine française, XVIIIᵉ siècle",
    partition: {
      v: 2,
      titre: "Frère Jacques",
      ton: 7,
      bpm: 112,
      diff: "normal",
      prog: "Royal Road",
      sections: [
        { genre: "intro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["I", "I", "I", "I", "I", "I", "V", "V"],
          basse: ["S...W...", "S...W...", "S.W.S.W.", "S.W.S.W."],
          melodie: ["0.a.1.0.", "0.a.1.0.", "1.b.2--.", "1.b.2--.", "2c2b1.0.", "2c2b1.0.", "b.0.b...", "b.0.b..."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["I", "I", "I", "I", "I", "I", "V", "V"],
          basse: ["S.W.S.W.", "SWS.SWS.", "S.W.S.W.", "T--.W..."],
          melodie: ["0.a.1.0.", "0.a.1.0.", "1.b.2--.", "1.b.2--.", "2c2b1.0.", "2c2b1.0.", "b.0.b...", "b.0.b..."],
        },
        { genre: "outro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "vous-dirai-je",
    origine: "Chanson populaire française, XVIIIᵉ siècle",
    partition: {
      v: 2,
      titre: "Ah ! vous dirai-je, maman",
      ton: 2,
      bpm: 104,
      diff: "normal",
      prog: "I–V–vi–IV",
      sections: [
        { genre: "intro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 4,
          accords: ["I", "IV", "I", "I"],
          basse: ["S...W...", "S...W...", "S.W.S.W.", "T-----.."],
          melodie: ["0.0.2.2.", "1.1.a...", "b.b.1.1.", "a.a.0--."],
        },
        {
          genre: "refrain",
          mesures: 4,
          accords: ["IV", "ii", "IV", "ii"],
          basse: ["S.W.S.W.", "S...T--."],
          melodie: ["a.a.0.0.", "a.a.0--.", "a.a.0.0.", "a.a.0--."],
        },
        {
          genre: "couplet",
          mesures: 4,
          accords: ["I", "IV", "I", "I"],
          basse: ["S...W...", "S...W...", "S.W.S.W.", "T-----.."],
          melodie: ["0.0.2.2.", "1.1.a...", "b.b.1.1.", "a.a.0--."],
        },
        { genre: "outro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "ode-joie",
    origine: "Beethoven, Neuvième Symphonie, 1824",
    partition: {
      v: 2,
      titre: "Ode à la joie",
      ton: 2,
      bpm: 108,
      diff: "normal",
      prog: "Canon de Pachelbel",
      sections: [
        { genre: "intro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["I"],
          basse: ["S...W...", "S...W...", "S.W.S.W.", "T-----.."],
          melodie: ["1.1.b.2.", "2.b.1.a.", "0.0.a.1.", "1-.aa...", "1.1.b.2.", "2.b.1.a.", "0.0.a.1.", "a..00--."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["I"],
          basse: ["S.W.S.W.", "S.W.S.W.", "S.W.S.W.", "T-----..", "S...W...", "S...W...", "S.W.S.W.", "T-----.."],
          melodie: ["a.a.1.0.", "a.1b1.0.", "a.1b1.a.", "0.a.2--.", "1.1.b.2.", "2.b.1.a.", "0.0.a.1.", "a..00--."],
        },
        { genre: "outro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "saints",
    origine: "Spiritual traditionnel américain",
    partition: {
      v: 2,
      titre: "When the Saints Go Marching In",
      ton: 3,
      bpm: 120,
      diff: "normal",
      prog: "Blues",
      sections: [
        { genre: "intro", mesures: 1, accords: ["I7"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["I7", "I7", "I7", "I7", "I7", "I7", "I7", "ii7"],
          basse: ["S...W...", "T-----..", "S...W...", "T-----.."],
          melodie: ["..0.1.b.", "2------.", "..0.1.b.", "2------.", "..0.1.b.", "2--.1--.", "0--.1--.", "0------."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["I7", "I7", "I7", "IV7", "I7", "I7", "I7", "I7"],
          basse: ["S.W.S.W.", "S.W.S.W.", "S.W.S.W.", "T-----.."],
          melodie: ["..1.1.a.", "0----.0.", "1--.2.2.", "0------.", "..0.1.b.", "2--.1--.", "0--.a...", "0------."],
        },
        { genre: "outro", mesures: 1, accords: ["I7"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "jingle-bells",
    origine: "James Lord Pierpont, 1857",
    partition: {
      v: 2,
      titre: "Jingle Bells",
      ton: 5,
      bpm: 132,
      diff: "normal",
      prog: "ii–V–I",
      sections: [
        { genre: "intro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["I", "I", "I", "I", "IV", "I", "ii", "V7"],
          basse: ["S.W.S.W."],
          melodie: ["1.1.1--.", "1.1.1--.", "1.2.0-.a", "1------.", "0.0.0-.0", "b.1.1.11", "a.0.0.a.", "2--.3--."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["I", "I", "I", "I", "IV", "I", "I", "I"],
          basse: ["S.W.S.W.", "S.W.S.W.", "S.W.S.W.", "SWS.SWS."],
          melodie: ["1.1.1--.", "1.1.1--.", "1.2.0-.a", "1------.", "0.0.0-.0", "b.1.1.11", "2.2.b.a.", "0------."],
        },
        { genre: "outro", mesures: 1, accords: ["I"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "marin",
    origine: "Chant de marins traditionnel",
    partition: {
      v: 2,
      titre: "Drunken Sailor",
      ton: 2,
      bpm: 132,
      diff: "normal",
      prog: "Vamp dorien",
      sections: [
        { genre: "intro", mesures: 1, accords: ["i"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["i", "i", "bVII", "bVII", "i", "IV", "bVII", "i"],
          basse: ["S...W...", "S...W...", "S...W...", "S.W.S..."],
          melodie: ["2.222.22", "2.0.1.2.", "2.222.22", "2.0.1.2.", "2.222.22", "a.1.b.2.", "3.c.2.1.", "0--.0--."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["i", "i", "bVII", "bVII", "i", "IV", "bVII", "i"],
          basse: ["T---W...", "S.W.S.W.", "T---W...", "S.W.S.W."],
          melodie: ["2--.2--.", "2.0.1.2.", "2--.2--.", "2.0.1.2.", "2--.2--.", "a.1.b.2.", "3.c.2.1.", "0--.0--."],
        },
        { genre: "outro", mesures: 1, accords: ["i"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "roi-montagne",
    origine: "Grieg, Peer Gynt, 1875",
    partition: {
      v: 2,
      titre: "Dans l'antre du roi de la montagne",
      ton: 4,
      bpm: 128,
      diff: "normal",
      prog: "Cadence andalouse",
      sections: [
        { genre: "intro", mesures: 1, accords: ["i"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["i", "i", "II7", "bII", "i", "i", "bIII", "bIII"],
          basse: ["S...S...", "S...S...", "S...S...", "S...S..."],
          melodie: ["0.a.1.b.", "2.1.2--.", "1.0.1--.", "1.0.1--.", "0.a.1.b.", "2.1.2.3.", "2.1.0.1.", "2------."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["i", "i", "II7", "bII", "i", "i", "bIII", "bIII"],
          basse: ["S.S.S.S.", "S.S.S.S.", "S.S.S.S.", "S.W.S.W."],
          melodie: ["0.a.1.b.", "2.1.2--.", "1.0.1--.", "1.0.1--.", "0.a.1.b.", "2.1.2.3.", "2.1.0.1.", "2------."],
        },
        { genre: "outro", mesures: 1, accords: ["i"], basse: ["S......."], melodie: [] },
      ],
    },
  },
  {
    id: "korobeiniki",
    origine: "Chanson populaire russe, XIXᵉ siècle",
    partition: {
      v: 2,
      titre: "Korobeïniki",
      ton: 6,
      bpm: 140,
      diff: "normal",
      prog: "vi–IV–I–V",
      sections: [
        { genre: "intro", mesures: 1, accords: ["i"], basse: ["S......."], melodie: [] },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["i", "i", "i", "i", "iv", "i", "i", "i"],
          basse: ["S.W.S.W."],
          melodie: ["2.a1b.1a", "0.012.b1", "a..1b.2.", "1.0.0--.", ".0.12.b1", "2-.12.b1", "a.a1b.2.", "1.0.0--."],
        },
        {
          genre: "refrain",
          mesures: 8,
          accords: ["i", "bVII", "i", "V", "i", "bVII", "i", "V"],
          basse: ["T--.T--.", "S...W...", "T--.T--.", "S...W..."],
          melodie: ["2--.1--.", "2--.1--.", "1--.0--.", "1--.2--.", "2--.1--.", "2--.1--.", "1.2.3--.", "1------."],
        },
        {
          genre: "couplet",
          mesures: 8,
          accords: ["i", "i", "i", "i", "iv", "i", "i", "i"],
          basse: ["S.W.S.W.", "S.W.S.W.", "SWS.SWS.", "S.W.S.W."],
          melodie: ["2.a1b.1a", "0.012.b1", "a..1b.2.", "1.0.0--.", ".0.12.b1", "2-.12.b1", "a.a1b.2.", "1.0.0--."],
        },
        { genre: "outro", mesures: 1, accords: ["i"], basse: ["S......."], melodie: [] },
      ],
    },
  },
];

/** La chanson du répertoire de cet identifiant, ou undefined */
export const airDe = (id: string) => REPERTOIRE.find((a) => a.id === id);

/** La partition d'une chanson du répertoire dans une difficulté : le meilleur score se range par difficulté */
export const partitionDe = (air: Air, diff: string): Partition => ({ ...air.partition, diff });

/** La chanson d'un air du répertoire dans cette difficulté ; sa source dit de quel air elle vient */
export function composerAir(air: Air, diff: string): Chanson {
  const chanson = composer(partitionDe(air, diff));
  if (chanson.source?.genre === "partition") chanson.source.repertoire = air.id;
  return chanson;
}
