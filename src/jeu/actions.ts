// Couche d'entrée commune (ADR-0008) : le clavier, le tactile (et plus tard le MIDI) traduisent leurs événements
// en actions, jugées au temps de la chanson (en secondes) où elles ont eu lieu.
import { S, autoFor, type Action } from "./etat";
import { leftPress, release, rightPress } from "./jugement";

const main = (a: Action) => (a === "sauter" || a === "glisser" ? "L" : "R");
const couloir = (a: Action) => +a.slice(-1);

// Les couloirs joués par chaque action de la main droite : plusieurs quand un pouce a joué tout un accord
const joues: Partial<Record<Action, number[]>> = {};

/** Une action commence. `accordEntier` : un seul couloir de l'accord joue tout l'accord (tactile). */
export function presser(a: Action, ns: number, accordEntier = false) {
  if (S.mode !== "play" || autoFor(main(a)) || S.keys[a]) return;
  S.keys[a] = true;
  if (a === "sauter") leftPress(1, ns);
  else if (a === "glisser") leftPress(0, ns);
  else {
    const notes = rightPress(couloir(a), ns, accordEntier);
    joues[a] = [couloir(a), ...notes.map((ev) => ev.lane).filter((l) => l !== couloir(a))];
  }
}

/** Une action s'arrête : les notes tenues sont lâchées. */
export function relacher(a: Action, ns: number) {
  S.keys[a] = false;
  if (S.mode !== "play" || autoFor(main(a))) return;
  if (a === "glisser") release("L", 0, ns);
  else if (a !== "sauter") for (const l of joues[a] || [couloir(a)]) release("R", l, ns);
  delete joues[a];
}
