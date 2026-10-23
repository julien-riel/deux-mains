/* ---------- Jam (#24) : jouer librement sur la chanson, sans obstacles ni ennemis ---------- */
// Logique pure (ADR-0007). La jam rejoue sans fin l'accompagnement de la chanson de la graine (accords, batterie,
// nappe) : après l'intro, le corps de la chanson revient en boucle, déroulé dans le temps de la partie comme une
// boucle de section (ADR-0009). Il n'y a aucune note à jouer : chaque geste fait sonner le degré de l'accord en
// cours (ADR-0003), sans jugement, ni score, ni harmonie, ni mort.
import type { Accord, Genre, Main, Note, Section } from "../chanson/types";

/** Les mesures que la jam rejoue sans fin, de `start` à `start + bars` (exclue), en mesures de la chanson */
export interface Jam {
  start: number;
  bars: number;
}

/** Le corps de la chanson : de la fin de l'intro au début de l'outro. Une chanson sans intro ni outro tourne tout
 * entière. */
export function corpsDeLaChanson(sections: Section[]): Jam {
  const corps = sections.filter((s) => s.kind !== "intro" && s.kind !== "outro"),
    tout = corps.length ? corps : sections,
    start = tout[0].start,
    fin = tout[tout.length - 1];
  return { start, bars: fin.start + fin.bars - start };
}

/** Les notes de la main gauche, geste par geste, comme celles du générateur : glisser joue la fondamentale,
 * sauter l'octave, le double saut la quinte au-dessus de l'octave (#7) et l'écrasement la fondamentale accentuée
 * (#8) */
export const basseDe = (ch: Accord, geste: number) =>
  [ch.bass, ch.bass + 12, ch.bass + 12 + ch.ints[2], ch.bass][geste];

/**
 * La note que fait sonner un geste en jam : `geste` est le geste de la main gauche (0 à 3, voir `basseDe`), ou le
 * couloir de la main droite, joué sur l'accord `ch` (ADR-0003). Elle n'est pas dans les notes de la partie : elle
 * sonne au temps `beat` de la partie, et rien ne la juge.
 */
export function noteDeJam(hand: Main, geste: number, ch: Accord, beat: number, kind: Genre): Note {
  const note: Note = { hand, beat, dur: 0, lane: geste, bar: Math.floor(beat / 4), kind, midi: 0, state: "hit" };
  if (hand === "L") note.midi = basseDe(ch, geste);
  else {
    note.midi = ch.lanes[geste];
    // La voix d'harmonie, comme dans le générateur : le degré au-dessus, ou la tierce à l'octave
    note.harm = geste < 3 ? ch.lanes[geste + 1] : ch.lanes[1] + 12;
    note.vel = 1;
  }
  return note;
}
