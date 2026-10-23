// Les appuis d'un joueur parfait sur une note, pour les tests qui jouent une chanson entière à la main.

import type { Note } from "../../src/chanson/types";
import { tempsDuPassage } from "../../src/jeu/jugement";

/** Les coups jugés d'une chanson jouée sans faute : un par note, plus un par passage de serpent (#16) */
export const coupsAttendus = (notes: Note[]) => notes.reduce((n, ev) => n + (ev.serpent?.length ?? 1), 0);

export interface Appui {
  /** Le temps de l'appui, et le couloir (ou le geste de la main gauche) appuyé */
  beat: number;
  lane: number;
  /** Le temps où il relâche une note tenue ; null pour un appui bref */
  fin: number | null;
  /** Un appui de trille (#15), relâché aussitôt pour laisser venir l'autre touche */
  trille?: true;
}

/** Un serpent (#16) : la touche d'un couloir reste enfoncée un peu après le passage au suivant, en temps */
export const CHEVAUCHEMENT = 0.1;

/**
 * Un seul appui par note, tenu jusqu'au bout d'une note tenue. Une trille (#15) se joue comme l'auto-play : le
 * premier appui sur le temps, puis une alternance des deux couloirs à chaque double-croche, en appuis brefs. Un
 * serpent (#16) se suit touche par touche : chaque couloir est enfoncé au temps de son passage et relâché un peu
 * après le passage suivant (les touches se chevauchent), le dernier à la fin du serpent.
 */
export function appuis(ev: Note): Appui[] {
  if (ev.serpent)
    return ev.serpent.map((lane, k) => ({
      beat: tempsDuPassage(ev, k),
      lane,
      fin: k < ev.serpent.length - 1 ? tempsDuPassage(ev, k + 1) + CHEVAUCHEMENT : ev.beat + ev.dur,
    }));
  if (ev.trille === undefined) return [{ beat: ev.beat, lane: ev.lane, fin: ev.dur > 0 ? ev.beat + ev.dur : null }];
  return Array.from({ length: 4 * ev.dur }, (_, k) => ({
    beat: ev.beat + k / 4,
    lane: k % 2 ? ev.trille : ev.lane,
    fin: null,
    trille: true as const,
  }));
}

export interface EvenementClavier {
  at: number;
  code: string;
  geste: "presser" | "relacher" | "taper";
}

/**
 * Les événements clavier d'un joueur parfait sur ces notes, à l'heure `heure(beat)` en secondes : une note brève
 * est relâchée 50 ms plus tard, une note tenue à sa fin, et un appui de trille est tapé d'un coup (moins d'heures
 * à atteindre). Triés ; à heure égale, on relâche avant de presser.
 */
export function evenementsClavier(
  notes: Note[],
  heure: (beat: number) => number,
  touche: (ev: Note, lane: number) => string,
): EvenementClavier[] {
  const ordre = { relacher: 0, presser: 1, taper: 1 };
  return notes
    .flatMap((ev) =>
      appuis(ev).flatMap((a): EvenementClavier[] => {
        const code = touche(ev, a.lane),
          at = heure(a.beat);
        if (a.trille) return [{ at, code, geste: "taper" }];
        return [
          { at, code, geste: "presser" },
          { at: a.fin === null ? at + 0.05 : heure(a.fin), code, geste: "relacher" },
        ];
      }),
    )
    .sort((a, b) => a.at - b.at || ordre[a.geste] - ordre[b.geste]);
}

/** Fait le geste d'un événement clavier */
export function faire(nav: { presser(code: string): void; relacher(code: string): void }, e: EvenementClavier) {
  if (e.geste !== "relacher") nav.presser(e.code);
  if (e.geste !== "presser") nav.relacher(e.code);
}
