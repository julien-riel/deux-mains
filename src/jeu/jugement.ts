/* ---------- Jugement ---------- */
// Logique pure (ADR-0007) : ce module ne touche ni au DOM, ni au canvas, ni à l'audio. Il reçoit le temps
// de la chanson (en secondes) en paramètre, et passe par les effets qu'on lui branche pour le son et l'image.
import { DIFFS } from "../chanson/difficultes";
import type { Main, Note } from "../chanson/types";
import { S, compterPassage, mult, sectionAtBar, spb } from "./etat";

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
  /** Un tapotement de vibrato sur une note tenue, et les points de style qu'il rapporte (0 une fois plafonné) */
  vibrato(ev: Note, points: number): void;
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
  for (const ev of S.ev) {
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
  compterPassage(ev, perfect ? "parfait" : "bien");
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
  compterPassage(ev, "rate");
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
  for (const ev of S.ev) {
    if (ev.state !== "holding" || ev.hand !== hand || (hand === "R" && ev.lane !== lane)) continue;
    if ((ev.beat + ev.dur) * spb() - ns > wg) breakHold(ev);
    else completeHold(ev, false);
  }
}
/** Le vibrato (#17) : chaque tapotement pendant une note tenue rapporte des points de style, jusqu'à `max` par note */
export const VIBRATO = { points: 20, max: 5 };
/** Fait vibrer les notes tenues de la main droite, et renvoie celles qui vibrent. Ce n'est jamais une erreur :
 * la note reste tenue, le combo ne bouge pas, et une note tenue sans vibrato reste réussie. */
export function vibrer(ns: number): Note[] {
  const nb = ns / spb(),
    tenues: Note[] = [];
  for (const ev of S.ev) {
    if (ev.beat > nb) break;
    if (ev.hand !== "R" || ev.state !== "holding") continue;
    ev.vibrato = (ev.vibrato ?? 0) + 1;
    const points = ev.vibrato <= VIBRATO.max ? VIBRATO.points : 0;
    S.score += points;
    effets.vibrato(ev, points);
    tenues.push(ev);
  }
  return tenues;
}
/** En l'air, sur un saut simple : un second appui sur sauter y devient un double saut (#7) */
export const enLair = (ns: number) => S.doubleAt < S.jumpAt && ns >= S.jumpAt && ns < S.jumpAt + S.jumpAir;
export function leftPress(lane: number, ns: number) {
  const near = findNear("L", ns);
  // Près d'un saut ordinaire, un appui en l'air reste un saut simple : on a juste sauté un peu tôt
  if (lane === 1 && enLair(ns) && !(near && near.ev.lane === 1)) lane = 2;
  const air = (near && near.ev.lane === lane ? near.ev.air : 0.8) * spb();
  if (lane === 3) {
    S.ecraseAt = ns;
    S.jumpAt = S.doubleAt = -99;
  } else if (lane === 2) {
    S.doubleAt = ns;
    S.doubleAir = air;
  } else if (lane === 1) {
    S.jumpAt = ns;
    S.jumpAir = air;
  } else {
    S.slideUntil = ns + 0.55 * spb();
    S.jumpAt = S.doubleAt = -99;
  }
  if (!near) return;
  if (near.ev.lane !== lane) return missEv(near.ev);
  hitEv(near.ev, near.d);
}
/** Tire dans un couloir, et renvoie les notes réussies. `accordEntier` : toucher un couloir de l'accord joue
 * toutes ses notes de la main droite, car un pouce ne touche qu'une zone à la fois (ADR-0008). */
export function rightPress(lane: number, ns: number, accordEntier = false): Note[] {
  const nb = ns / spb();
  if (sectionAtBar(Math.floor(nb / 4)).kind === "pont") {
    effets.solo(lane, nb);
    S.score += 25;
    effets.tir(lane, true);
    return [];
  }
  const near = findNear("R", ns, (ev) => ev.lane === lane);
  if (near) {
    const autres =
      accordEntier && near.ev.grp
        ? near.ev.grp.filter((ev) => ev.hand === "R" && ev.state === "pending" && ev !== near.ev)
        : [];
    hitEv(near.ev, near.d);
    effets.tir(lane, true);
    for (const ev of autres) {
      hitEv(ev, near.d);
      effets.tir(ev.lane, true);
    }
    return [near.ev, ...autres];
  }
  // Pendant une note tenue, l'autre touche fait vibrer la note au lieu de compter comme un mauvais couloir
  if (vibrer(ns).length) return [];
  if (findNear("R", ns)) {
    S.combo = 0;
    effets.mauvaisCouloir(lane);
    effets.tir(lane, false);
    return [];
  }
  effets.tir(lane, null);
  return [];
}
