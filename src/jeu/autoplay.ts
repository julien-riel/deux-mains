// Auto-play : le son part du séquenceur à l'heure exacte, l'animation suit au moment où on l'entend (ADR-0004).
// Ce module décide quoi jouer ; le séquenceur fait sonner les notes.
import { PAS_PAR_TEMPS, pas } from "../chanson/temps";
import type { Note, Section } from "../chanson/types";
import { COULOIRS, S, autoFor, mesureDeLaChanson, spb } from "./etat";
import { alterner, hitEv, pasDuSerpent, passer, tempsDuPassage } from "./jugement";
import { estSolo, improviser, noterAuSolo } from "./variations";

/** Les notes de ce pas (double-croche) que l'auto-play fait sonner : elles sont marquées et mises en file pour
 * l'animation. Ce sont celles qui tombent entre ce pas du séquenceur et le suivant, comparées sur la grille de 12 pas
 * par temps (ADR-0013) : un triolet (#19) en fait partie, et le séquenceur le fait sonner à son heure, pas à celle
 * du pas. */
export function autoNotes(step: number) {
  const debut = (step * PAS_PAR_TEMPS) / 4,
    fin = debut + PAS_PAR_TEMPS / 4,
    notes: Note[] = [];
  for (const ev of S.ev) {
    if (pas(ev.beat) >= fin) break;
    if (pas(ev.beat) < debut || ev.state !== "pending" || ev.auto || !autoFor(ev.hand)) continue;
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
/** Les passages de serpent (#16) de ce pas : l'auto-play change de couloir pile au temps de chaque passage. Ils
 * sont mis en file pour l'animation et le jugement ; le séquenceur fait glisser la voix. */
export function autoSerpents(step: number) {
  const b = step / 4,
    passages: { ev: Note; k: number }[] = [];
  if (!autoFor("R")) return passages;
  for (const ev of S.ev) {
    if (ev.beat >= b) break;
    if (!ev.serpent || b >= ev.beat + ev.dur) continue;
    if (ev.state !== "holding" && !(ev.state === "pending" && ev.auto)) continue;
    const k = Math.round((b - ev.beat) / pasDuSerpent(ev));
    if (Math.abs(tempsDuPassage(ev, k) - b) > 1e-6) continue;
    passages.push({ ev, k });
    S.autoQ.push({ at: b * spb(), ev, passage: k });
  }
  return passages;
}
// Pendant le solo libre, le bot improvise par degrés voisins, à partir de la graine (ADR-0012) : renvoie le
// couloir joué, ou null. Ses notes sont gardées comme celles d'une personne, et sa phrase revient au refrain.
let impro = { graine: NaN, croches: 0, couloirs: new Map<number, number>() };
function improvisation(graine: number, croches: number) {
  if (impro.graine !== graine || impro.croches !== croches)
    impro = { graine, croches, couloirs: new Map(improviser(graine, croches).map((n) => [n.croche, n.couloir])) };
  return impro.couloirs;
}
export function autoSolo(step: number, sec: Section) {
  if (!(autoFor("R") && estSolo(sec) && step % 2 === 0)) return null;
  // La croche dans le solo : en boucle, chaque passage rejoue la même improvisation (ADR-0009)
  const croche = (mesureDeLaChanson(Math.floor(step / 16)) - sec.start) * 8 + (step % 16) / 2,
    couloir = improvisation(S.song.seed, sec.bars * 8).get(croche);
  if (couloir === undefined) return null;
  noterAuSolo(sec, sec.start * 4 + croche / 2, couloir);
  S.autoQ.push({ at: (step / 4) * spb(), solo: couloir });
  return couloir;
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
/** Un passage de serpent de l'auto-play, au moment où on l'entend : la touche du nouveau couloir s'allume et le
 * passage compte. Un passage déjà jugé (l'auto-play repris en cours de serpent) ne compte pas deux fois. */
export function autoPasser(ev: Note, k: number) {
  if (ev.state !== "holding" || ev.troncon !== k - 1) return;
  tirer(ev.serpent[k]);
  passer(ev, 0);
}
export function autoHit(ev: Note) {
  const ns = ev.beat * spb(),
    pnow = performance.now();
  if (ev.hand === "L") {
    // Dans un escalier (#13), monter se fait en sautant et descendre en glissant
    const bas = ev.lane === 0 || ev.lane === 5;
    S.keyFlash[ev.lane === 3 ? "ecraser" : bas ? "glisser" : "sauter"] = pnow;
    if (ev.lane === 3) {
      S.ecraseAt = ns;
      S.jumpAt = S.doubleAt = -99;
    } else if (ev.lane === 2) {
      S.doubleAt = ns;
      S.doubleAir = ev.air * spb();
    } else if (!bas) {
      S.jumpAt = ns;
      S.jumpAir = ev.air * spb();
    } else {
      S.slideUntil = ns + (ev.dur > 0 ? ev.dur : 0.55) * spb();
      S.jumpAt = S.doubleAt = -99;
    }
  } else tirer(Math.floor(ev.lane)); // une petite note (#14) se touche avec la touche du dessous
  hitEv(ev, 0);
}
