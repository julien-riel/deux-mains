// Les touches suivent leur position physique (KeyboardEvent.code) ; les étiquettes s'adaptent à la disposition du clavier
import { S, type Action } from "../jeu/etat";
import { SEPARATION, nomDeNote, noteDeAction } from "../jeu/midi";

export const LANE_CODES = ["KeyJ", "KeyK", "KeyL", "Semicolon"];
export const ACTION_DE: Record<string, Action> = {
  KeyW: "sauter",
  KeyS: "glisser",
  Space: "ecraser",
  KeyJ: "couloir0",
  KeyK: "couloir1",
  KeyL: "couloir2",
  Semicolon: "couloir3",
};
/** Les étiquettes des touches, selon la disposition réelle du clavier */
export const CLAVIER = {
  KeyW: "W",
  KeyS: "S",
  Space: "Espace",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  Semicolon: ";",
  KeyA: "A",
};
// En tactile, la scène montre des repères de zone plutôt que des touches : la plaque s'écrase en bas, comme glisser
const TACTILE = { KeyW: "▲", KeyS: "▼", Space: "▼", KeyJ: "●", KeyK: "●", KeyL: "●", Semicolon: "●", KeyA: "" };
/** Ce que la scène et les écrans affichent pour chaque commande */
export const KEYLABEL = { ...CLAVIER };
export const COMMANDES = { tactile: false };

/** Le clavier MIDI (ADR-0011) : l'accès Web MIDI (absent du navigateur, pas encore demandé, en attente, refusé,
 * accordé sans clavier branché, ou accordé avec des claviers), leurs noms et le point de séparation */
export type EtatMidi = "absent" | "inactif" | "attente" | "refuse" | "aucun" | "connecte";
export const MIDI = { etat: "absent" as EtatMidi, entrees: [] as string[], separation: SEPARATION };
/** La touche MIDI de chaque commande (« Do4 »), repérée par la touche du clavier d'ordinateur qui fait la même action */
export const toucheMidi = (code: string) => nomDeNote(noteDeAction(ACTION_DE[code], MIDI.separation));
/** La scène montre les touches MIDI quand un clavier MIDI est branché, ou pendant l'essai du MIDI */
export const etiquettesMidi = () => MIDI.etat === "connecte" || !!S.essai?.essai.midi;
export function etiquettes() {
  const midi = Object.fromEntries(Object.keys(ACTION_DE).map((c) => [c, toucheMidi(c)]));
  Object.assign(KEYLABEL, etiquettesMidi() ? { ...midi, KeyA: CLAVIER.KeyA } : COMMANDES.tactile ? TACTILE : CLAVIER);
}
/** Ce que la scène affiche de l'accès MIDI, en bas à droite */
export function etatMidiCourt() {
  if (MIDI.etat === "connecte") return `MIDI · ${MIDI.entrees[0].slice(0, 28).toUpperCase()}`;
  return {
    absent: "MIDI · INDISPONIBLE ICI",
    inactif: "MIDI · NON ACTIVÉ",
    attente: "MIDI · EN ATTENTE",
    refuse: "MIDI · REFUSÉ ICI",
    aucun: "MIDI · AUCUN CLAVIER",
  }[MIDI.etat];
}
/** Ce que les réglages et les écrans disent de l'accès MIDI : une indication, jamais une erreur */
export function etatMidiLong() {
  const ailleurs = "ouvre deux-mains.html ou le serveur de développement dans Chrome ou Edge";
  return {
    absent: "Pas de MIDI dans ce navigateur : il faut Chrome ou Edge.",
    inactif: "Clavier MIDI pas encore activé.",
    attente: "Le navigateur demande l'accès au MIDI…",
    refuse: `Accès au MIDI refusé. La page d'artefact claude.ai bloque les périphériques : ${ailleurs}.`,
    aucun: "MIDI activé, aucun clavier branché.",
    connecte: `Clavier MIDI : ${MIDI.entrees.join(", ")}.`,
  }[MIDI.etat];
}
