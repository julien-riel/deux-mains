// Auto-play : le son part du séquenceur à l'heure exacte, l'animation suit au moment où on l'entend (ADR-0004).
// Ce module décide quoi jouer ; le séquenceur fait sonner les notes.
import type { Note, Section } from "../chanson/types";
import { clamp } from "../outils";
import { COULOIRS, S, autoFor, spb } from "./etat";
import { hitEv } from "./jugement";

/** Les notes de ce pas (double-croche) que l'auto-play fait sonner : elles sont marquées et mises en file pour l'animation. */
export function autoNotes(step: number) {
  const b = step / 4,
    notes: Note[] = [];
  for (const ev of S.ev) {
    if (ev.beat >= b + 0.25) break;
    if (ev.beat < b || ev.state !== "pending" || ev.auto || !autoFor(ev.hand)) continue;
    ev.auto = true;
    notes.push(ev);
    S.autoQ.push({ at: ev.beat * spb(), ev });
  }
  return notes;
}
// Pendant le solo libre, le bot improvise par degrés voisins : renvoie le couloir joué, ou null
export function autoSolo(step: number, sec: Section) {
  if (!(autoFor("R") && sec.kind === "pont" && step % 2 === 0 && Math.random() < 0.55)) return null;
  const r = Math.random();
  S.autoLane = clamp(S.autoLane + (r < 0.4 ? -1 : r < 0.8 ? 1 : 0), 0, 3);
  S.autoQ.push({ at: (step / 4) * spb(), solo: S.autoLane });
  return S.autoLane;
}
// L'auto-play anime le personnage et les touches comme si quelqu'un jouait
export function autoHit(ev: Note) {
  const ns = ev.beat * spb(),
    pnow = performance.now();
  if (ev.hand === "L") {
    S.keyFlash[ev.lane ? "sauter" : "glisser"] = pnow;
    if (ev.lane === 2) {
      S.doubleAt = ns;
      S.doubleAir = ev.air * spb();
    } else if (ev.lane) {
      S.jumpAt = ns;
      S.jumpAir = ev.air * spb();
    } else {
      S.slideUntil = ns + (ev.dur > 0 ? ev.dur : 0.55) * spb();
      S.jumpAt = S.doubleAt = -99;
    }
  } else {
    S.keyFlash[COULOIRS[ev.lane]] = pnow;
    S.laneFlash[ev.lane] = pnow;
    S.beams.push({ lane: ev.lane, at: pnow, ok: true });
  }
  hitEv(ev, 0);
}
