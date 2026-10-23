// Instantané du générateur : pour chaque graine et difficulté, un résumé lisible de la chanson et une empreinte
// SHA-256 de tout son contenu (accords, sections, notes). L'empreinte change dès qu'une seule note bouge.

import { createHash } from "node:crypto";

export const GRAINES = [
  1, 2, 3, 7, 42, 99, 123, 777, 1000, 2024, 4242, 5000, 9999, 12345, 31415, 50000, 65536, 77777, 88888, 99999,
];
export const DIFFICULTES = ["debutant", "facile", "normal", "difficile"] as const;

interface NoteBrute {
  hand: string;
  beat: number;
  dur: number;
  lane: number;
  bar: number;
  kind: string;
  midi: number;
  fin?: number;
  trille?: number;
  midiTrille?: number;
  serpent?: number[];
  midiSerpent?: number[];
  reponse?: true;
  relais?: number;
  canon?: number;
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
  sections: { name: string; kind: string; bars: number; start: number; boss?: number }[];
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
  chanteurs?: { bar: number; notes: { beat: number; lane: number; midi: number }[] }[];
  boss?: { vie: number; phrases: { bar: number; notes: { beat: number; lane: number; midi: number }[] }[] };
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
    // Les phases du boss de fin (#26) ne comptent que dans ses niveaux : les chansons gardent leur empreinte
    sections: s.sections.map((x) => [x.name, x.kind, x.bars, x.start, ...(x.boss ? [x.boss] : [])]),
    chords: s.chords.map((c) => [c.pc, c.q, c.name, c.ints, c.root, c.bass, c.lanes, c.hue]),
    ev: s.ev.map((e) => [
      e.hand,
      e.beat,
      e.dur,
      e.lane,
      e.bar,
      e.kind,
      e.midi,
      e.fin ?? null,
      e.harm ?? null,
      e.vel ?? null,
      e.air ?? null,
      e.grp ? e.grp.map((x) => s.ev.indexOf(x)) : null,
      // Les trilles (#15) ne s'ajoutent qu'aux notes qui en sont : les chansons sans trille gardent leur empreinte
      ...(e.trille !== undefined ? [e.trille, e.midiTrille] : []),
      // De même pour les serpents (#16)
      ...(e.serpent ? [e.serpent, e.midiSerpent] : []),
      // De même pour les réponses au chanteur (#18)
      ...(e.reponse ? ["reponse"] : []),
      // De même pour les phrases en relais (#20)
      ...(e.relais !== undefined ? ["relais", e.relais] : []),
      // De même pour le canon contre le boss (#26)
      ...(e.canon !== undefined ? ["canon", e.canon] : []),
    ]),
    // Les chanteurs (#18) ne comptent que dans les chansons qui en ont : Débutant garde son empreinte
    ...(s.chanteurs?.length
      ? { chanteurs: s.chanteurs.map((c) => [c.bar, c.notes.map((n) => [n.beat, n.lane, n.midi])]) }
      : {}),
    ...(s.boss
      ? { boss: [s.boss.vie, s.boss.phrases.map((p) => [p.bar, p.notes.map((n) => [n.beat, n.lane, n.midi])])] }
      : {}),
  };
}

export function decrireChanson(song: unknown) {
  const s = song as ChansonBrute;
  const empreinte = createHash("sha256")
    .update(JSON.stringify(canonique(s)))
    .digest("hex");
  return { prog: s.prog.name, tonalite: s.keyName, bpm: s.bpm, notes: s.ev.length, empreinte };
}
