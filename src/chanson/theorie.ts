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
    gamme: "dorien",
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

/* ---------- Gammes : les notes hors accord (ADR-0010) ---------- */

/** Les gammes, en demi-tons depuis la tonique, degré par degré */
export const GAMMES: Record<string, number[]> = {
  majeur: [0, 2, 4, 5, 7, 9, 11],
  mineur: [0, 2, 3, 5, 7, 8, 10],
  dorien: [0, 2, 3, 5, 7, 9, 10],
};
// La pentatonique retire deux degrés de la gamme (à partir de 0) : le 4e et le 7e en majeur, le 2e et le 6e en
// mineur et en dorien
const HORS_PENTATONIQUE: Record<string, number[]> = { majeur: [3, 6], mineur: [1, 5], dorien: [1, 5] };

/**
 * La gamme de la tonalité pendant cet accord, en classes de hauteur (0 à 11) : la mélodie prend la pentatonique
 * (`pentatonique`), la basse la gamme entière. Une note de l'accord hors de la gamme remplace la note qu'elle
 * contredit, à un demi-ton : celle du dessous (un degré haussé, comme le Sol♯ du Mi majeur de la cadence andalouse
 * en La mineur), sinon celle du dessus. La pentatonique est prise dans la gamme ainsi corrigée.
 */
export function gammeDe(keyPc: number, prog: Progression, ch: Accord, pentatonique = false): number[] {
  const nom = prog.gamme ?? prog.mode,
    degres = GAMMES[nom].map((i) => (keyPc + i) % 12);
  for (const i of ch.ints) {
    const pc = (ch.pc + i) % 12;
    if (degres.includes(pc)) continue;
    const dessous = degres.indexOf((pc + 11) % 12),
      k = dessous >= 0 ? dessous : degres.indexOf((pc + 1) % 12);
    if (k >= 0) degres[k] = pc;
  }
  return pentatonique ? degres.filter((_, k) => !HORS_PENTATONIQUE[nom].includes(k)) : degres;
}

/** Les notes MIDI de la gamme strictement entre `de` et `vers`, dans l'ordre où on les rencontre en partant de `de` */
export function notesEntre(de: number, vers: number, gamme: number[]): number[] {
  const sens = vers > de ? 1 : -1,
    notes: number[] = [];
  for (let m = de + sens; m !== vers && de !== vers; m += sens) if (gamme.includes(m % 12)) notes.push(m);
  return notes;
}

/** La note appartient-elle à l'accord (à l'octave près) ? */
export const dansLAccord = (ch: Accord, m: number) => ch.ints.some((i) => (ch.pc + i) % 12 === m % 12);
