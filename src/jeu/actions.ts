// Couche d'entrée commune (ADR-0008) : le clavier, le tactile et le MIDI (ADR-0011) traduisent leurs événements
// en actions, jugées au temps de la chanson (en secondes) où elles ont eu lieu. Chaque action jouée s'enregistre
// (#23) : la réécoute de fin de partie la rejoue.
import { compteurs, noter, resultatEntre, type Appui } from "./enregistrement";
import { S, autoFor, spb, type Action } from "./etat";
import { findNear, jouerEnJam, leftPress, release, rightPress } from "./jugement";

const main = (a: Action) => (a === "sauter" || a === "glisser" || a === "ecraser" ? "L" : "R");
const couloir = (a: Action) => +a.slice(-1);

// Les couloirs joués par chaque action de la main droite : plusieurs quand un pouce a joué tout un accord
const joues: Partial<Record<Action, number[]>> = {};
/** Une partie neuve, ou sa réécoute, repart sans couloir tenu */
export function oublierTouches() {
  for (const a of Object.keys(joues)) delete joues[a];
}

// En tactile, le bas de la zone gauche écrase la plaque qui arrive (#8) : pas de troisième zone (ADR-0008)
const plaqueProche = (ns: number) => findNear("L", ns)?.ev.lane === 3;

/** Une action commence. `tactile` : un seul couloir de l'accord joue tout l'accord, et glisser écrase une plaque.
 * `hauteur` : en mode pianiste au MIDI (#53, ADR-0011), la note jouée, que le jugement compare à la note attendue.
 * Pendant la réécoute (#23), ce sont les coups enregistrés qui jouent : ceux du joueur sont ignorés. */
export function presser(a: Action, ns: number, tactile = false, hauteur?: number) {
  if (!S.relecture) appuyer(a, ns, tactile, hauteur);
}

/** Une action s'arrête : les notes tenues sont lâchées. Ignorée pendant la réécoute, comme `presser`. */
export function relacher(a: Action, ns: number) {
  if (!S.relecture) lacher(a, ns);
}

/** Joue un appui et l'enregistre, avec la note qu'il a jugée : celui du joueur, ou celui que rejoue la réécoute */
export function appuyer(a: Action, ns: number, tactile = false, hauteur?: number) {
  if (S.mode !== "play" || autoFor(main(a)) || S.keys[a]) return;
  S.keys[a] = true;
  // En jam (#24), rien n'est jugé ni enregistré : le geste fait sonner son degré de l'accord en cours
  if (S.jam) return jouerEnJam(a, ns);
  // Une note jouée en mode pianiste : le score de la partie ne se compare plus à ceux de la position fixe
  if (hauteur !== undefined) S.pianiste = true;
  const avant = compteurs(S);
  if (a === "sauter") leftPress(1, ns, hauteur);
  else if (a === "ecraser") leftPress(3, ns, hauteur);
  else if (a === "glisser") leftPress(tactile && plaqueProche(ns) ? 3 : 0, ns, hauteur);
  else {
    const notes = rightPress(couloir(a), ns, tactile, hauteur);
    joues[a] = [couloir(a), ...notes.map((ev) => ev.lane).filter((l) => l !== couloir(a))];
  }
  const coup: Appui = { temps: ns / spb(), geste: "appui", action: a },
    resultat = resultatEntre(avant, compteurs(S));
  if (tactile) coup.tactile = true;
  if (hauteur !== undefined) coup.hauteur = hauteur;
  if (resultat) coup.resultat = resultat;
  noter(S.enregistrement, coup);
}

/** Joue un relâchement et l'enregistre */
export function lacher(a: Action, ns: number) {
  S.keys[a] = false;
  if (S.mode !== "play" || autoFor(main(a))) return;
  if (a === "glisser") release("L", 0, ns);
  else if (main(a) === "R") for (const l of joues[a] || [couloir(a)]) release("R", l, ns);
  delete joues[a];
  noter(S.enregistrement, { temps: ns / spb(), geste: "relache", action: a });
}
