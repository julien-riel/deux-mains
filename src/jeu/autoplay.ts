// Auto-play : le son part du séquenceur à l'heure exacte, l'animation suit au moment où on l'entend (ADR-0004).
// Ce module décide quoi jouer ; le séquenceur fait sonner les notes.
import type { Note, Section } from "../chanson/types";
import { clamp } from "../outils";
import { COULOIRS, S, autoFor, spb } from "./etat";
import { alterner, hitEv } from "./jugement";

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
/** Les appuis de trille (#15) de ce pas : l'auto-play alterne les deux couloirs en double-croches, du pas qui suit
 * le premier appui jusqu'à la fin de la trille. Ils sont mis en file pour l'animation et le compte. */
export function autoTrilles(step: number) {
  const b = step / 4,
    appuis: { ev: Note; lane: number }[] = [];
  if (!autoFor("R")) return appuis;
  for (const ev of S.ev) {
    if (ev.beat >= b) break;
    if (ev.trille === undefined || b >= ev.beat + ev.dur) continue;
    if (ev.state !== "holding" && !(ev.state === "pending" && ev.auto)) continue;
    const lane = Math.round((b - ev.beat) * 4) % 2 ? ev.trille : ev.lane;
    appuis.push({ ev, lane });
    S.autoQ.push({ at: b * spb(), ev, trille: lane });
  }
  return appuis;
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
function tirer(lane: number) {
  const pnow = performance.now();
  S.keyFlash[COULOIRS[lane]] = pnow;
  S.laneFlash[lane] = pnow;
  S.beams.push({ lane, at: pnow, ok: true });
}
/** Un appui de trille de l'auto-play, au moment où on l'entend : la touche s'allume et l'alternance compte */
export function autoAlterner(ev: Note, lane: number) {
  if (ev.state !== "holding") return;
  tirer(lane);
  alterner(ev, lane);
}
export function autoHit(ev: Note) {
  const ns = ev.beat * spb(),
    pnow = performance.now();
  if (ev.hand === "L") {
    S.keyFlash[ev.lane === 3 ? "ecraser" : ev.lane ? "sauter" : "glisser"] = pnow;
    if (ev.lane === 3) {
      S.ecraseAt = ns;
      S.jumpAt = S.doubleAt = -99;
    } else if (ev.lane === 2) {
      S.doubleAt = ns;
      S.doubleAir = ev.air * spb();
    } else if (ev.lane) {
      S.jumpAt = ns;
      S.jumpAir = ev.air * spb();
    } else {
      S.slideUntil = ns + (ev.dur > 0 ? ev.dur : 0.55) * spb();
      S.jumpAt = S.doubleAt = -99;
    }
  } else tirer(ev.lane);
  hitEv(ev, 0);
}
