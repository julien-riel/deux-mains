/* ---------- Jugement ---------- */
// Logique pure (ADR-0007) : ce module ne touche ni au DOM, ni au canvas, ni à l'audio. Il reçoit le temps
// de la chanson (en secondes) en paramètre, et passe par les effets qu'on lui branche pour le son et l'image.
import { DIFFS } from "../chanson/difficultes";
import type { Main, Note } from "../chanson/types";
import { S, mult, sectionAtBar, spb } from "./etat";

export interface Effets {
  /** Fait sonner la note : sur son temps `beat` (coup en avance, quantifié), ou tout de suite (`null`). */
  jouer(ev: Note, beat: number | null): void;
  /** Arrête la voix d'une note tenue. */
  couper(ev: Note): void;
  reussite(ev: Note, parfait: boolean): void;
  accord(grp: Note[]): void;
  rate(ev: Note): void;
  lache(ev: Note): void;
  mauvaisCouloir(lane: number): void;
  /** Une note jouée librement pendant le solo. */
  solo(lane: number, nb: number): void;
  /** Le rayon tiré dans un couloir : réussi, dans le mauvais couloir, ou dans le vide (`null`). */
  tir(lane: number, ok: boolean | null): void;
  mourir(): void;
}

let effets: Effets;
export function brancherEffets(e: Effets) {
  effets = e;
}

export function findNear(hand: Main, ns: number, pred?: (ev: Note) => boolean) {
  const wg = DIFFS[S.diff].win[1];
  let best = null,
    bd = 1e9;
  for (const ev of S.song.ev) {
    if (ev.state !== "pending" || ev.hand !== hand) continue;
    const d = ns - ev.beat * spb();
    if (d < -wg) break;
    if (d > wg || (pred && !pred(ev))) continue;
    if (Math.abs(d) < Math.abs(bd)) {
      best = ev;
      bd = d;
    }
  }
  return best ? { ev: best, d: bd } : null;
}
export function damage(n: number) {
  S.health -= n;
  if (S.health <= 0) {
    S.health = 0;
    effets.mourir();
  }
}
export function hitEv(ev: Note, d: number) {
  const perfect = Math.abs(d) <= DIFFS[S.diff].win[0];
  ev.state = ev.dur > 0 ? "holding" : "hit";
  S.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  if (perfect) S.perfect++;
  else S.good++;
  S.score += Math.round((perfect ? 300 : 120) * mult());
  if (S.combo % 8 === 0) S.health = Math.min(100, S.health + 4);
  // Quantification : en avance, la note part pile sur le temps ; en retard, tout de suite
  if (!ev.auto) effets.jouer(ev, d < 0 ? ev.beat : null);
  effets.reussite(ev, perfect);
  if (ev.grp && ev.grp.every((e) => e.state === "hit" || e.state === "holding" || e.state === "done")) {
    S.score += Math.round(200 * (ev.grp.length - 1) * mult());
    effets.accord(ev.grp);
  }
}
export function missEv(ev: Note) {
  const D = DIFFS[S.diff];
  ev.state = "miss";
  S.combo = 0;
  S.miss++;
  effets.rate(ev);
  damage(ev.hand === "L" ? D.dmgL : D.dmgR);
}
export function completeHold(ev: Note, cut: boolean) {
  ev.state = "done";
  if (cut) effets.couper(ev);
  S.score += Math.round(150 * mult());
}
export function breakHold(ev: Note) {
  ev.state = "broken";
  effets.couper(ev);
  S.combo = 0;
  effets.lache(ev);
  damage(6);
}
export function release(hand: Main, lane: number, ns: number) {
  const wg = DIFFS[S.diff].win[1];
  for (const ev of S.song.ev) {
    if (ev.state !== "holding" || ev.hand !== hand || (hand === "R" && ev.lane !== lane)) continue;
    if ((ev.beat + ev.dur) * spb() - ns > wg) breakHold(ev);
    else completeHold(ev, false);
  }
}
export function leftPress(lane: number, ns: number) {
  const near = findNear("L", ns);
  if (lane === 1) {
    S.jumpAt = ns;
    S.jumpAir = (near && near.ev.lane === 1 ? near.ev.air : 0.8) * spb();
  } else {
    S.slideUntil = ns + 0.55 * spb();
    S.jumpAt = -99;
  }
  if (!near) return;
  if (near.ev.lane !== lane) return missEv(near.ev);
  hitEv(near.ev, near.d);
}
export function rightPress(lane: number, ns: number) {
  const nb = ns / spb();
  if (sectionAtBar(Math.floor(nb / 4)).kind === "pont") {
    effets.solo(lane, nb);
    S.score += 25;
    effets.tir(lane, true);
    return;
  }
  const near = findNear("R", ns, (ev) => ev.lane === lane);
  if (near) {
    hitEv(near.ev, near.d);
    effets.tir(lane, true);
    return;
  }
  if (findNear("R", ns)) {
    S.combo = 0;
    effets.mauvaisCouloir(lane);
    effets.tir(lane, false);
    return;
  }
  effets.tir(lane, null);
}
