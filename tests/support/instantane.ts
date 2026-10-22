// Instantané du générateur : pour chaque graine et difficulté, un résumé lisible de la chanson et une empreinte
// SHA-256 de tout son contenu (accords, sections, notes). L'empreinte change dès qu'une seule note bouge.

import { createHash } from "node:crypto";

export const GRAINES = [
  1, 2, 3, 7, 42, 99, 123, 777, 1000, 2024, 4242, 5000, 9999, 12345, 31415, 50000, 65536, 77777, 88888, 99999,
];
export const DIFFICULTES = ["facile", "normal", "difficile"] as const;

interface NoteBrute {
  hand: string;
  beat: number;
  dur: number;
  lane: number;
  bar: number;
  kind: string;
  midi: number;
  harm?: number;
  vel?: number;
  air?: number;
  grp?: NoteBrute[];
}

interface ChansonBrute {
  seed: number;
  prog: { name: string };
  keyPc: number;
  bpm: number;
  totalBars: number;
  endBeat: number;
  keyName: string;
  progLabel: string;
  sections: { name: string; kind: string; bars: number; start: number }[];
  chords: {
    pc: number;
    q: string;
    name: string;
    ints: number[];
    root: number;
    bass: number;
    lanes: number[];
    hue: number;
  }[];
  ev: NoteBrute[];
}

// Seuls les champs produits par le générateur comptent : l'état de jeu (voice, auto…) est ignoré
function canonique(s: ChansonBrute) {
  return {
    seed: s.seed,
    prog: s.prog.name,
    keyPc: s.keyPc,
    bpm: s.bpm,
    totalBars: s.totalBars,
    endBeat: s.endBeat,
    keyName: s.keyName,
    progLabel: s.progLabel,
    sections: s.sections.map((x) => [x.name, x.kind, x.bars, x.start]),
    chords: s.chords.map((c) => [c.pc, c.q, c.name, c.ints, c.root, c.bass, c.lanes, c.hue]),
    ev: s.ev.map((e) => [
      e.hand,
      e.beat,
      e.dur,
      e.lane,
      e.bar,
      e.kind,
      e.midi,
      e.harm ?? null,
      e.vel ?? null,
      e.air ?? null,
      e.grp ? e.grp.map((x) => s.ev.indexOf(x)) : null,
    ]),
  };
}

export function decrireChanson(song: unknown) {
  const s = song as ChansonBrute;
  const empreinte = createHash("sha256")
    .update(JSON.stringify(canonique(s)))
    .digest("hex");
  return { prog: s.prog.name, tonalite: s.keyName, bpm: s.bpm, notes: s.ev.length, empreinte };
}
