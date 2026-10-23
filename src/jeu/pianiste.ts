/* ---------- Mode pianiste au clavier MIDI : jouer la vraie note (#53) ---------- */
// Logique pure (ADR-0007). ADR-0011, option 2C : la position fixe reste le mode par défaut (src/jeu/midi.ts) ; en mode
// pianiste, il faut jouer la note demandée, à l'octave près (note modulo 12). La note reçue est comparée aux notes en
// attente dans la fenêtre de jugement, jamais à l'accord à l'heure de l'appui : un appui un peu avant un changement
// d'accord lirait l'ancien.
//
// C'est la seule exception admise à ADR-0008, règle 1 : la traduction lit les notes attendues pour choisir l'action,
// mais elle passe toujours par presser et relacher (src/jeu/actions.ts), jamais par le jugement. Elle donne aussi la
// note jouée, que le jugement vérifie : la vraie hauteur prime. Une petite note (#14), une marche d'escalier (#13),
// une trille (#15) ou un serpent (#16) se jouent avec leur note écrite (ADR-0010), jamais avec une touche voisine.
import { DIFFS } from "../chanson/difficultes";
import { NOTE_FR } from "../chanson/theorie";
import type { Accord, Main, Note } from "../chanson/types";
import { COULOIRS, S, chordAtBeat, sectionAtBar, spb, type Action } from "./etat";
import { estSolo } from "./variations";

/* ---------- Hauteurs, à l'octave près ---------- */
/** La classe d'une note MIDI, de 0 (Do) à 11 (Si) : sa hauteur à l'octave près */
export const classe = (m: number) => ((m % 12) + 12) % 12;
/** Deux notes de même nom, à n'importe quelle octave */
export const memeNote = (a: number, b: number) => classe(a) === classe(b);
/** Le nom français d'une note, sans son octave : 70 → « Si♭ » */
export const nomDeClasse = (m: number) => NOTE_FR[classe(m)];

/** La note écrite qu'attend une note sur ce couloir : sur le second couloir d'une trille, la note de ce couloir ; sur
 * chaque couloir d'un serpent, la sienne ; sinon la note de l'événement (petite note et marche comprises) */
export function noteAttendue(ev: Note, lane = ev.lane) {
  if (ev.trille !== undefined && lane === ev.trille) return ev.midiTrille;
  const k = ev.serpent ? ev.serpent.indexOf(lane) : -1;
  return k >= 0 ? ev.midiSerpent[k] : ev.midi;
}
/** La note jouée est-elle celle qu'attend cette note sur ce couloir, à l'octave près */
export const joueLaNote = (ev: Note, lane: number, hauteur: number) => memeNote(noteAttendue(ev, lane), hauteur);
/** La note jouée est-elle un degré de l'accord : la note d'un de ses quatre couloirs (ADR-0003) */
export const dansLAccord = (ch: Accord, hauteur: number) => ch.lanes.some((m) => memeNote(m, hauteur));
/** Les deux notes de l'écrasement (#8) : la fondamentale et la quinte de l'accord, frappées ensemble */
export const notesDeLEcrasement = (ch: Accord) => [ch.bass, ch.bass + ch.ints[2]];

/* ---------- Ce que la traduction lit de la partie ---------- */
// Les notes d'une main en attente dans la fenêtre de jugement, dans l'ordre du temps, avec leur écart en secondes
function attendues(main: Main, ns: number) {
  const wg = DIFFS[S.diff].win[1],
    notes: { ev: Note; d: number }[] = [];
  for (const ev of S.ev) {
    if (ev.state !== "pending" || ev.hand !== main) continue;
    const d = ns - ev.beat * spb();
    if (d < -wg) break;
    if (d <= wg) notes.push({ ev, d: Math.abs(d) });
  }
  return notes;
}
// La note la plus proche dans le temps : celle que le jugement de la main gauche prendra (`findNear`)
const plusProche = (notes: { ev: Note; d: number }[]) =>
  notes.reduce<{ ev: Note; d: number } | null>((m, n) => (!m || n.d < m.d ? n : m), null);

// Une hauteur à jouer à la main droite : son couloir, sa note écrite et son écart dans le temps, en secondes
interface Choix {
  lane: number;
  midi: number;
  d: number;
}
// Tout ce que la main droite peut jouer maintenant : les notes en attente (les deux couloirs d'une trille, le couloir
// du dessous d'une petite note, que le jugement accepte), les deux couloirs d'une trille en cours et le passage
// suivant d'un serpent en cours
function choixDeDroite(ns: number): Choix[] {
  const nb = ns / spb(),
    choix: Choix[] = [];
  for (const { ev, d } of attendues("R", ns)) {
    choix.push({ lane: Math.floor(ev.lane), midi: ev.midi, d });
    if (ev.trille !== undefined) choix.push({ lane: ev.trille, midi: ev.midiTrille, d });
  }
  for (const ev of S.ev) {
    if (ev.beat > nb) break;
    if (ev.hand !== "R" || ev.state !== "holding") continue;
    if (ev.trille !== undefined)
      choix.push({ lane: ev.lane, midi: ev.midi, d: 0 }, { lane: ev.trille, midi: ev.midiTrille, d: 0 });
    else if (ev.serpent) {
      const k = (ev.troncon ?? 0) + 1;
      if (k < ev.serpent.length) {
        const temps = ev.beat + (k * ev.dur) / ev.serpent.length;
        choix.push({ lane: ev.serpent[k], midi: ev.midiSerpent[k], d: Math.abs(ns - temps * spb()) });
      }
    }
  }
  return choix;
}

/* ---------- La traduction ---------- */
/** Une note traduite : l'action à presser, à cette heure (en secondes de la chanson), et la note jouée */
export interface Traduction {
  action: Action;
  ns: number;
  hauteur: number;
  /** Aucune note attendue n'a cette hauteur : l'action est relâchée aussitôt pressée. Tenue, la fausse note
   * bloquerait l'action pour la note juste qui la suit sur la même touche. */
  breve?: true;
}

/** La tolérance de « ensemble » pour l'écrasement, en secondes : les deux touches d'un accord frappé partent rarement
 * au même instant */
export const ENSEMBLE = 0.1;
/** Les notes de la main gauche frappées pour un écrasement, qui attendent l'autre note de l'accord */
export interface EtatPianiste {
  attente: { note: number; ns: number }[];
}
export const etatPianiste = (): EtatPianiste => ({ attente: [] });
/** Une touche relâchée n'attend plus rien */
export function lacherNote(etat: EtatPianiste, note: number) {
  etat.attente = etat.attente.filter((a) => a.note !== note);
}

/** La main d'une note : sous la séparation la gauche, à partir d'elle la droite (ADR-0011) */
export const mainDeNote = (note: number, separation: number): Main => (note < separation ? "L" : "R");

/**
 * Traduit une note enfoncée en mode pianiste, ou null quand elle ne fait rien (encore) : une note de la main gauche
 * qui attend l'autre note de l'écrasement, ou une note sans emploi quand rien n'est attendu. `ns` : l'heure de l'appui,
 * en secondes de la chanson.
 */
export function traduire(note: number, separation: number, ns: number, etat: EtatPianiste): Traduction | null {
  return mainDeNote(note, separation) === "L" ? gauche(note, separation, ns, etat) : droite(note, separation, ns);
}

// Main gauche : le geste de la note attendue la plus proche, quelle que soit la note jouée, que le jugement vérifie.
// Une fausse note y est donc ratée, comme un mauvais geste en position fixe. Le double saut est un saut joué en l'air.
const GESTE: Action[] = ["glisser", "sauter", "sauter", "ecraser", "sauter", "glisser"];
function gauche(note: number, separation: number, ns: number, etat: EtatPianiste): Traduction | null {
  etat.attente = etat.attente.filter((a) => ns - a.ns <= ENSEMBLE);
  const cible = plusProche(attendues("L", ns))?.ev;
  if (cible?.lane === 3) return ecraser(note, ns, cible, etat);
  if (cible)
    return memeNote(note, cible.midi)
      ? { action: GESTE[cible.lane], ns, hauteur: note }
      : { action: GESTE[cible.lane], ns, hauteur: note, breve: true };
  // Rien à jouer : la fondamentale glisse, ou saute dans l'octave sous la séparation, et la quinte saute (le double
  // saut en l'air) ; les autres notes ne font rien
  const ch = chordAtBeat(ns / spb()),
    [fond, quinte] = notesDeLEcrasement(ch);
  if (memeNote(note, fond)) return { action: note < separation - 12 ? "glisser" : "sauter", ns, hauteur: note };
  if (memeNote(note, quinte)) return { action: "sauter", ns, hauteur: note };
  return null;
}
// L'écrasement : la fondamentale et la quinte de l'accord de la plaque, frappées ensemble. La première attend l'autre ;
// l'écrasement est jugé à l'heure de la première. Une autre note est une fausse note : la plaque est ratée.
function ecraser(note: number, ns: number, plaque: Note, etat: EtatPianiste): Traduction | null {
  const [fond, quinte] = notesDeLEcrasement(chordAtBeat(plaque.beat));
  if (!memeNote(note, fond) && !memeNote(note, quinte)) return { action: "ecraser", ns, hauteur: note, breve: true };
  const autre = etat.attente.find((a) => memeNote(a.note, memeNote(note, fond) ? quinte : fond));
  if (!autre) {
    etat.attente.push({ note, ns });
    return null;
  }
  lacherNote(etat, autre.note);
  return { action: "ecraser", ns: Math.min(ns, autre.ns), hauteur: fond };
}

// Main droite : le couloir de la note attendue qui a cette hauteur, la plus proche dans le temps ; à égalité (la
// fondamentale et l'octave d'un accord), la plus proche en hauteur. Sans note attendue de cette hauteur, le couloir
// de son degré dans l'accord : le jugement compte la fausse note comme un mauvais couloir s'il attend une note.
function droite(note: number, separation: number, ns: number): Traduction {
  const nb = ns / spb();
  // Le solo libre (#9) : toute note de l'accord sonne et compte, le jugement compte les autres comme des erreurs
  if (estSolo(sectionAtBar(Math.floor(nb / 4)))) {
    const ch = chordAtBeat(nb),
      action = COULOIRS[couloirDansLAccord(ch, note, separation)];
    return dansLAccord(ch, note) ? { action, ns, hauteur: note } : { action, ns, hauteur: note, breve: true };
  }
  const [choix] = choixDeDroite(ns)
    .filter((c) => memeNote(c.midi, note))
    .sort((a, b) => a.d - b.d || Math.abs(a.midi - note) - Math.abs(b.midi - note));
  if (choix) return { action: COULOIRS[choix.lane], ns, hauteur: note };
  const proche = plusProche(attendues("R", ns))?.ev,
    lane = couloirDansLAccord(chordAtBeat(proche ? proche.beat : nb), note, separation);
  return { action: COULOIRS[lane], ns, hauteur: note, breve: true };
}
/** Le couloir d'une note dans un accord : son degré, la fondamentale à l'octave (couloir 3) à partir d'une octave
 * au-dessus de la séparation ; une note hors de l'accord, le couloir du degré le plus proche */
export function couloirDansLAccord(ch: Accord, note: number, separation: number) {
  const degre = ch.lanes.findIndex((m) => memeNote(m, note));
  if (degre === 0) return note - separation >= 12 ? 3 : 0;
  if (degre > 0) return degre;
  let lane = 0,
    ecart = 12;
  for (let l = 0; l < 3; l++) {
    const e = Math.min(classe(note - ch.lanes[l]), classe(ch.lanes[l] - note));
    if (e < ecart) [lane, ecart] = [l, e];
  }
  return lane;
}
