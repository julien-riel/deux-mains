/* ---------- Clavier MIDI : des notes aux actions ---------- */
// Logique pure (ADR-0007). Position fixe (ADR-0011) : sept touches blanches, placées par rapport au point de
// séparation, correspondent chacune à une action. La table ne lit ni la chanson ni le temps : c'est l'équivalent
// MIDI de ACTION_DE pour le clavier d'ordinateur (ADR-0008, règle 1). L'accès Web MIDI est dans src/ui/midi.ts.
import { NOTE_FR } from "../chanson/theorie";
import type { Action } from "./etat";

/** Le point de séparation par défaut : le Do central (Do4, note MIDI 60) */
export const SEPARATION = 60;
/** Les points de séparation proposés : les Do, de Do2 à Do6 */
export const SEPARATIONS = [36, 48, 60, 72, 84];

/** L'écart à la séparation, en demi-tons, de chaque touche qui joue (ADR-0011) */
export const POSITIONS: Readonly<Record<number, Action>> = {
  [-12]: "glisser",
  [-8]: "ecraser",
  [-5]: "sauter",
  0: "couloir0",
  4: "couloir1",
  7: "couloir2",
  12: "couloir3",
};

/** L'action d'une note MIDI, ou null pour une touche hors de la table, qui ne fait rien */
export const actionDeNote = (note: number, separation = SEPARATION): Action | null =>
  POSITIONS[note - separation] ?? null;

/** Le nom français d'une note MIDI, avec son octave : 60 → « Do4 » */
export const nomDeNote = (note: number) => NOTE_FR[note % 12] + (Math.floor(note / 12) - 1);

/** Les touches de la table, de la plus grave à la plus aiguë, pour les rappels à l'écran */
export const touchesMidi = (separation = SEPARATION) =>
  Object.entries(POSITIONS)
    .map(([ecart, action]) => ({ note: separation + +ecart, nom: nomDeNote(separation + +ecart), action }))
    .sort((a, b) => a.note - b.note);

/** La touche qui joue une action, pour les étiquettes de la scène */
export const noteDeAction = (action: Action, separation = SEPARATION) =>
  touchesMidi(separation).find((t) => t.action === action).note;

/**
 * Un message MIDI : une touche enfoncée ou relâchée, sur n'importe quel canal. Un noteon de vélocité 0 vaut un
 * noteoff. Tout autre message (pédale, contrôleurs, horloge) donne null. La vélocité ne change rien (ADR-0011).
 */
export function lireMessage(data: ArrayLike<number>): { enfoncee: boolean; note: number } | null {
  if (!data || data.length < 3) return null;
  const type = data[0] & 0xf0;
  if (type === 0x90 && data[2] > 0) return { enfoncee: true, note: data[1] };
  if (type === 0x80 || type === 0x90) return { enfoncee: false, note: data[1] };
  return null;
}
