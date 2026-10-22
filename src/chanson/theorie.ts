// Théorie : noms des notes, qualités d'accords et progressions. Tout le jeu parle en degrés de l'accord (ADR-0003).
import type { Accord, Progression } from "./types";

export const NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const NOTE_FR = ["Do", "Do♯", "Ré", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
export const QUAL = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10] };
export const QSUF = { M: "", m: "m", M7: "maj7", "7": "7", m7: "m7" };

// Décalages en demi-tons depuis la tonique de la chanson
export const PROGS: Progression[] = [
  {
    name: "I–V–vi–IV",
    mode: "majeur",
    chords: [
      [0, "M"],
      [7, "M"],
      [9, "m"],
      [5, "M"],
    ],
    end: [0, "M"],
  },
  {
    name: "vi–IV–I–V",
    mode: "mineur",
    chords: [
      [0, "m"],
      [8, "M"],
      [3, "M"],
      [10, "M"],
    ],
    end: [0, "m"],
  },
  {
    name: "Royal Road",
    mode: "majeur",
    chords: [
      [5, "M7"],
      [7, "7"],
      [4, "m7"],
      [9, "m7"],
    ],
    end: [9, "m7"],
  },
  {
    name: "Vamp dorien",
    mode: "mineur",
    chords: [
      [0, "m7"],
      [5, "7"],
    ],
    end: [0, "m7"],
  },
  {
    name: "Cadence andalouse",
    mode: "mineur",
    chords: [
      [0, "m"],
      [10, "M"],
      [8, "M"],
      [7, "M"],
    ],
    end: [0, "m"],
  },
  {
    name: "Canon de Pachelbel",
    mode: "majeur",
    chords: [
      [0, "M"],
      [7, "M"],
      [9, "m"],
      [4, "m"],
      [5, "M"],
      [0, "M"],
      [5, "M"],
      [7, "M"],
    ],
    end: [0, "M"],
  },
];

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const noteName = (m) => NOTE[m % 12] + (Math.floor(m / 12) - 1);

export function makeChord(keyPc: number, [off, q]: [number, string]): Accord {
  const pc = (keyPc + off) % 12,
    ints = QUAL[q],
    root = 60 + pc;
  let bass = 36 + pc;
  if (bass > 44) bass -= 12;
  return {
    pc,
    q,
    name: NOTE[pc] + QSUF[q],
    ints,
    root,
    bass,
    lanes: [root, root + ints[1], root + ints[2], root + 12],
    hue: ((pc * 7) % 12) * 30,
  };
}
