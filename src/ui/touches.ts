// Les touches suivent leur position physique (KeyboardEvent.code) ; les étiquettes s'adaptent à la disposition du clavier
import type { Action } from "../jeu/etat";

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
export function etiquettes() {
  Object.assign(KEYLABEL, COMMANDES.tactile ? TACTILE : CLAVIER);
}
