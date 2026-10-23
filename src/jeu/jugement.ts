/* ---------- Jugement ---------- */
// Logique pure (ADR-0007) : ce module ne touche ni au DOM, ni au canvas, ni à l'audio. Il reçoit le temps
// de la chanson (en secondes) en paramètre, et passe par les effets qu'on lui branche pour le son et l'image.
import { DIFFS } from "../chanson/difficultes";
import type { Main, Note } from "../chanson/types";
import { COULOIRS, S, compterPassage, mult, sectionAtBar, spb } from "./etat";
import { noterAuSolo } from "./variations";

export interface Effets {
  /** Fait sonner la note : sur son temps `beat` (coup en avance, quantifié), ou tout de suite (`null`).
   * `lane` : pour une trille (#15), le couloir appuyé, dont la note sonne brève. */
  jouer(ev: Note, beat: number | null, lane?: number): void;
  /** Arrête la voix d'une note tenue. */
  couper(ev: Note): void;
  /** Une note réussie ; une trille réussie (#15) donne aussi les points de ses alternances en plus */
  reussite(ev: Note, parfait: boolean, bonus?: number): void;
  accord(grp: Note[]): void;
  rate(ev: Note): void;
  lache(ev: Note): void;
  mauvaisCouloir(lane: number): void;
  /** Une note jouée librement pendant le solo. */
  solo(lane: number, nb: number): void;
  /** Un tapotement de vibrato sur une note tenue, et les points de style qu'il rapporte (0 une fois plafonné) */
  vibrato(ev: Note, points: number): void;
  /** Un appui sur un des deux couloirs d'une trille en cours (#15) : l'ennemi vibre */
  trille(ev: Note, lane: number): void;
  /** Fait glisser la voix d'un serpent (#16) jusqu'à la note de son couloir `k` : sur son temps (passage en
   * avance, quantifié), ou tout de suite (`null`) */
  glisser(ev: Note, k: number, beat: number | null): void;
  /** Un passage du serpent vers son couloir `k` : « Parfait » (true), « Bien » (false) ou raté (null) */
  passage(ev: Note, k: number, parfait: boolean | null): void;
  /** Une réponse au chanteur (#18) entièrement juste : ses quatre notes, et le bonus gagné */
  phrase(notes: Note[], points: number): void;
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
/** Des points pour le score total et, s'il y a lieu, pour la main qui les a gagnés (le duo les compte à part, #6) */
export function gagner(points: number, hand?: Main) {
  S.score += points;
  if (hand) S.parMain[hand].score += points;
}
// Une erreur casse le combo commun et celui de la main fautive : en duo, l'autre joueur garde le sien (#6)
function casser(hand: Main) {
  S.combo = 0;
  S.parMain[hand].combo = 0;
}
// Une trille en cours (#15) n'est pas encore jugée : elle ne l'est qu'à sa fin
const trilleEnCoursDe = (ev: Note) => ev.trille !== undefined && ev.state === "holding";
const reussie = (ev: Note) =>
  ev.state === "hit" || (ev.state === "holding" && !trilleEnCoursDe(ev)) || ev.state === "done";
// Un accord à deux mains est jugé quand sa dernière note l'est : réussi si toutes ses notes le sont (#6)
function suivreAccordDuo(ev: Note) {
  const grp = ev.grp;
  if (!grp || !grp.some((e) => e.hand === "L") || !grp.some((e) => e.hand === "R")) return;
  if (grp.some((e) => e.state === "pending" || trilleEnCoursDe(e))) return;
  S.accordsDuo.total++;
  if (grp.every(reussie)) S.accordsDuo.reussis++;
}
export function damage(n: number) {
  S.health -= n;
  if (S.health <= 0) {
    S.health = 0;
    effets.mourir();
  }
}
// Compte une réussite à `d` secondes du temps : combo, précision, points (plus `points`), harmonie toutes les 8
function compter(ev: Note, d: number, points = 0) {
  const perfect = Math.abs(d) <= DIFFS[S.diff].win[0];
  const m = S.parMain[ev.hand];
  S.combo++;
  m.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  m.maxCombo = Math.max(m.maxCombo, m.combo);
  const coup = perfect ? "perfect" : "good";
  S[coup]++;
  m[coup]++;
  compterPassage(ev, perfect ? "parfait" : "bien");
  gagner(Math.round((perfect ? 300 : 120) * mult(ev.hand)) + points, ev.hand);
  if (S.combo % 8 === 0) S.health = Math.min(100, S.health + 4);
  return perfect;
}
// L'accord dont cette note vient d'être jugée : le bonus quand toutes ses notes sont réussies, et le suivi du duo
function jugerAccord(ev: Note) {
  // Le bonus d'accord va au score total seulement : en duo, c'est un exploit commun
  if (ev.grp && ev.grp.every(reussie)) {
    gagner(Math.round(200 * (ev.grp.length - 1) * mult()));
    effets.accord(ev.grp);
  }
  suivreAccordDuo(ev);
}
/** Le chanteur (#18) : une réponse dont les quatre notes sont réussies rapporte `bonus` points, multipliés par le combo */
export const CHANTEUR = { bonus: 500 };
// La réponse au chanteur dont cette note vient d'être réussie : le bonus quand c'est la dernière et que toutes
// le sont. Les notes d'une réponse sont celles de sa mesure, dans la partie : en boucle, chaque passage a la sienne.
function jugerReponse(ev: Note) {
  if (!ev.reponse) return;
  const phrase = S.ev.filter((e) => e.reponse && e.bar === ev.bar);
  if (!phrase.every(reussie)) return;
  const points = Math.round(CHANTEUR.bonus * mult(ev.hand));
  gagner(points, ev.hand);
  effets.phrase(phrase, points);
}
export function hitEv(ev: Note, d: number) {
  if (ev.trille !== undefined) return commencerTrille(ev, d, ev.lane);
  ev.state = ev.dur > 0 ? "holding" : "hit";
  // Le serpent (#16) commence sur son premier couloir
  if (ev.serpent) ev.troncon = 0;
  const perfect = compter(ev, d);
  // Quantification : en avance, la note part pile sur le temps ; en retard, tout de suite
  if (!ev.auto) effets.jouer(ev, d < 0 ? ev.beat : null);
  effets.reussite(ev, perfect);
  jugerAccord(ev);
  jugerReponse(ev);
}
export function missEv(ev: Note) {
  const D = DIFFS[S.diff];
  ev.state = "miss";
  casser(ev.hand);
  S.miss++;
  S.parMain[ev.hand].miss++;
  compterPassage(ev, "rate");
  suivreAccordDuo(ev);
  effets.rate(ev);
  // L'harmonie est commune : en duo, l'erreur d'un joueur la fait baisser pour les deux
  damage(ev.hand === "L" ? D.dmgL : D.dmgR);
}
export function completeHold(ev: Note, cut: boolean) {
  ev.state = "done";
  if (cut) effets.couper(ev);
  gagner(Math.round(150 * mult(ev.hand)), ev.hand);
}
export function breakHold(ev: Note) {
  ev.state = "broken";
  effets.couper(ev);
  casser(ev.hand);
  effets.lache(ev);
  damage(6);
}
export function release(hand: Main, lane: number, ns: number) {
  const wg = DIFFS[S.diff].win[1];
  for (const ev of S.ev) {
    // Le serpent (#16) ne tient pas à une touche : il tient tant qu'il en reste une
    if (hand === "R" && ev.state === "holding" && ev.serpent) {
      lacherSerpent(ev, ns);
      continue;
    }
    if (ev.state !== "holding" || ev.hand !== hand || (hand === "R" && ev.lane !== lane)) continue;
    // Une trille (#15) ne se tient pas : on lâche ses touches entre deux appuis
    if (ev.trille !== undefined) continue;
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
    // Une trille (#15) n'est pas une note tenue, et le serpent (#16) glisse déjà : ils ne vibrent pas
    if (ev.hand !== "R" || ev.state !== "holding" || ev.trille !== undefined || ev.serpent) continue;
    ev.vibrato = (ev.vibrato ?? 0) + 1;
    const points = ev.vibrato <= VIBRATO.max ? VIBRATO.points : 0;
    gagner(points, "R");
    effets.vibrato(ev, points);
    tenues.push(ev);
  }
  return tenues;
}
/** La trille (#15) : réussie avec au moins `parTemps` alternances par temps de sa durée ; chaque alternance en
 * plus rapporte `bonus` points, sans plafond ni multiplicateur. À régler à l'essai (essai « trilles »). */
export const TRILLE = { parTemps: 3, bonus: 10 };
/** Le nombre d'alternances qu'il faut pour réussir cette trille */
export const seuilTrille = (ev: Note) => Math.floor(TRILLE.parTemps * ev.dur);
/** Le premier appui d'une trille, sur l'un de ses deux couloirs, dans la fenêtre : elle ne sera jugée qu'à la fin */
export function commencerTrille(ev: Note, d: number, lane: number) {
  ev.state = "holding";
  ev.ecart = d;
  ev.alternances = 0;
  ev.dernier = lane;
  if (!ev.auto) effets.jouer(ev, d < 0 ? ev.beat : null, lane);
  effets.trille(ev, lane);
}
/** Un appui sur un des deux couloirs de la trille en cours : il joue sa note, et compte s'il change de couloir */
export function alterner(ev: Note, lane: number) {
  if (lane !== ev.dernier) ev.alternances = (ev.alternances ?? 0) + 1;
  ev.dernier = lane;
  if (!ev.auto) effets.jouer(ev, null, lane);
  effets.trille(ev, lane);
}
/** La fin d'une trille : réussie avec assez d'alternances, ratée sinon. `grace` (la pause) la réussit sans bonus. */
export function finirTrille(ev: Note, grace = false) {
  const seuil = seuilTrille(ev),
    n = ev.alternances ?? 0;
  if (!grace && n < seuil) return missEv(ev);
  ev.state = "done";
  const bonus = grace ? 0 : (n - seuil) * TRILLE.bonus;
  effets.reussite(ev, compter(ev, ev.ecart ?? 0, Math.round(150 * mult(ev.hand)) + bonus), bonus);
  jugerAccord(ev);
}
/** La trille de la main droite en cours à ce moment, ou null */
export function trilleEnCours(ns: number) {
  const nb = ns / spb();
  for (const ev of S.ev) {
    if (ev.beat > nb) break;
    if (ev.hand === "R" && ev.state === "holding" && ev.trille !== undefined) return ev;
  }
  return null;
}
/* ---------- Serpent (#16) ---------- */
// On le suit au rayon d'une touche à l'autre : la tête se joue comme une note tenue, puis chaque changement de
// couloir (un passage) se joue en appuyant sur le couloir suivant à son temps. Il tient tant qu'une touche de la
// main droite reste enfoncée : l'ancienne et la nouvelle peuvent se chevaucher.

/** La durée de chaque couloir du serpent, en temps, et le temps du passage vers son couloir `k` */
export const pasDuSerpent = (ev: Note) => ev.dur / ev.serpent.length;
export const tempsDuPassage = (ev: Note, k: number) => ev.beat + k * pasDuSerpent(ev);
/** Le couloir où en est la note : le dernier atteint par un serpent, le sien sinon */
export const couloirDe = (ev: Note) => (ev.serpent ? ev.serpent[ev.troncon ?? 0] : ev.lane);
/** Le serpent de la main droite en cours à ce moment, ou null */
export function serpentEnCours(ns: number) {
  const nb = ns / spb();
  for (const ev of S.ev) {
    if (ev.beat > nb) break;
    if (ev.hand === "R" && ev.state === "holding" && ev.serpent) return ev;
  }
  return null;
}
/** Un passage joué dans la fenêtre de son temps : jugé comme une note, et la voix glisse jusqu'au nouveau couloir */
export function passer(ev: Note, d: number) {
  const k = ++ev.troncon;
  ev.lacheAt = undefined;
  const perfect = compter(ev, d);
  if (!ev.auto) effets.glisser(ev, k, d < 0 ? tempsDuPassage(ev, k) : null);
  effets.passage(ev, k, perfect);
}
/** Un passage qui n'est pas venu à temps : raté, comme une note manquée ; le serpent continue, sans glisser */
export function manquerPassage(ev: Note) {
  const k = ++ev.troncon;
  casser(ev.hand);
  S.miss++;
  S.parMain[ev.hand].miss++;
  compterPassage(ev, "rate");
  effets.passage(ev, k, null);
  damage(DIFFS[S.diff].dmgR);
}
/** Le serpent au fil du temps : ses passages manqués sont ratés, et s'il a été lâché juste avant, il casse ; au
 * bout, une fois tous ses passages joués ou ratés, il est réussi. */
export function suivreSerpent(ev: Note, ns: number) {
  const wg = DIFFS[S.diff].win[1],
    dernier = ev.serpent.length - 1;
  while (ev.state === "holding" && S.mode === "play" && ev.troncon < dernier) {
    if (ns - tempsDuPassage(ev, ev.troncon + 1) * spb() <= wg) return;
    if (ev.lacheAt !== undefined) breakHold(ev);
    else manquerPassage(ev);
  }
  if (ev.state === "holding" && ns >= (ev.beat + ev.dur) * spb()) completeHold(ev, false);
}
// Plus aucune touche de la main droite : le serpent casse, avec les dégâts d'une note tenue lâchée. Juste avant
// un passage, il attend : joué à temps, le passage le rattrape (on a levé l'ancienne touche un peu tôt).
function lacherSerpent(ev: Note, ns: number) {
  if (COULOIRS.some((a) => S.keys[a])) return;
  const wg = DIFFS[S.diff].win[1],
    k = ev.troncon + 1;
  if (k < ev.serpent.length) {
    if (ns >= tempsDuPassage(ev, k) * spb() - wg) ev.lacheAt = ns;
    else breakHold(ev);
  } else if ((ev.beat + ev.dur) * spb() - ns > wg) breakHold(ev);
  else completeHold(ev, false);
}
// Un appui pendant un serpent : le passage s'il vient sur le couloir suivant, dans la fenêtre. Renvoie true s'il
// l'a pris ; sinon le jeu continue (une note qui suit le serpent peut se jouer).
function appuiSurSerpent(ev: Note, lane: number, ns: number) {
  // Une touche enfoncée de nouveau : le serpent tient
  ev.lacheAt = undefined;
  const k = ev.troncon + 1;
  if (k >= ev.serpent.length || lane !== ev.serpent[k]) return false;
  const d = ns - tempsDuPassage(ev, k) * spb();
  if (Math.abs(d) > DIFFS[S.diff].win[1]) return false;
  passer(ev, d);
  effets.tir(lane, true);
  return true;
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
  const nb = ns / spb(),
    sec = sectionAtBar(Math.floor(nb / 4));
  if (sec.kind === "pont") {
    // La note est gardée : la meilleure phrase du solo revient au dernier refrain (#9)
    noterAuSolo(sec, nb, lane);
    effets.solo(lane, nb);
    gagner(25, "R");
    effets.tir(lane, true);
    return [];
  }
  // Pendant un serpent (#16), le couloir suivant est un passage : ni vibrato, ni mauvais couloir
  const serpent = serpentEnCours(ns);
  if (serpent && appuiSurSerpent(serpent, lane, ns)) return [];
  // Une trille (#15) commence sur l'un ou l'autre de ses deux couloirs
  const near = findNear("R", ns, (ev) => ev.lane === lane || ev.trille === lane);
  if (near && near.ev.trille !== undefined) {
    commencerTrille(near.ev, near.d, lane);
    effets.tir(lane, true);
    return [near.ev];
  }
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
  // Une silhouette de la réponse au chanteur (#18) tirée dans le mauvais couloir est ratée : on ne la retente pas
  const silhouette = findNear("R", ns, (ev) => !!ev.reponse);
  if (silhouette) {
    missEv(silhouette.ev);
    effets.tir(lane, false);
    return [];
  }
  // Pendant une trille, ses deux couloirs alternent
  const trille = trilleEnCours(ns);
  if (trille && (lane === trille.lane || lane === trille.trille)) {
    alterner(trille, lane);
    effets.tir(lane, true);
    return [];
  }
  // Pendant une note tenue, l'autre touche fait vibrer la note au lieu de compter comme un mauvais couloir
  if (vibrer(ns).length) return [];
  // Pendant une trille ou un serpent, un autre couloir ne les casse pas et ne compte pas : ce n'est pas une
  // erreur non plus
  if (trille || serpent) {
    effets.tir(lane, null);
    return [];
  }
  if (findNear("R", ns)) {
    casser("R");
    effets.mauvaisCouloir(lane);
    effets.tir(lane, false);
    return [];
  }
  effets.tir(lane, null);
  return [];
}
