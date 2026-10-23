// Le remontage entre deux lieux (#27, ADR-0015) : le lancer, recevoir les appuis (clavier, toucher, MIDI), le suivre
// à chaque image, et rendre l'harmonie de départ du lieu suivant. La mécanique est commune (jeu/remontage.ts) ;
// l'univers n'en change que les textes, les dessins et les timbres.
import { cliquet, padV, tourRate, tourReussi } from "../audio/instruments";
import { AC, B, initAudio, lat } from "../audio/moteur";
import { stopScheduler } from "../audio/sequenceur";
import { DIFFS } from "../chanson/difficultes";
import type { Main } from "../chanson/types";
import { S, autoFor, type Action } from "../jeu/etat";
import {
  REMONTAGE,
  avancerRemontage,
  creerRemontage,
  jugerTour,
  passerRemontage,
  remontageFini,
  resultatRemontage,
} from "../jeu/remontage";
import { overlay, show } from "./ecrans";

const mainDe = (a: Action): Main => (a === "sauter" || a === "glisser" || a === "ecraser" ? "L" : "R");
// Les fenêtres de jugement de la difficulté : les mêmes que pendant la chanson
const fenetres = () => DIFFS[S.diff].win as [number, number];
// L'heure du remontage telle que le joueur l'entend, corrigée du décalage du calibrage, comme le temps de la chanson
const maintenant = () => AC.currentTime - lat() - S.decalage - S.remontage.debut;
// La note du tour k : les degrés du premier accord du lieu suivant, une octave plus haut au second passage
function noteDuTour(k: number) {
  const ch = S.song.chords[0];
  return ch.lanes[k % 4] + 12 * Math.floor(k / 4);
}
// Avance de la programmation des sons, en secondes (ADR-0004)
const AVANCE = 0.2;

/**
 * Lance le remontage avant la chanson en place, à son tempo (et à la vitesse choisie). Les mains qui jouent toutes
 * seules sont celles de la chanson : les deux en auto-play (`auto`), l'autre main quand le joueur n'en tient qu'une.
 */
export function lancerRemontage(auto = S.auto) {
  initAudio();
  if (AC.state === "suspended") AC.resume();
  stopScheduler();
  S.auto = auto;
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setValueAtTime(0.8, t);
  B.filt.frequency.cancelScheduledValues(t);
  B.filt.frequency.setValueAtTime(18000, t);
  const r = creerRemontage(60 / (S.song.bpm * S.vitesse));
  S.remontage = { ...r, debut: t + 0.3, programme: 0, eclats: r.tours.map(() => -1e9) };
  S.depart = null;
  S.mode = "remontage";
  overlay.hidden = true;
  const actif = document.activeElement as HTMLElement;
  if (actif && actif.blur) actif.blur();
  programmer();
}

// Programme les sons des temps qui arrivent : le cliquet sur chaque temps, plus fort sur les tours, la progression du
// lieu suivant en nappe (un accord par mesure), et les tours des mains qui jouent toutes seules, à leur heure
function programmer() {
  const r = S.remontage,
    n = Math.round(r.fin / r.spb);
  while (r.programme < n && r.debut + r.programme * r.spb < AC.currentTime + AVANCE) {
    const k = r.programme++,
      t = r.debut + k * r.spb,
      tour = r.tours.findIndex((x) => Math.abs(x.temps - k * r.spb) < 1e-6);
    cliquet(t, tour >= 0);
    const mesure = k - REMONTAGE.decompte;
    if (mesure >= 0 && mesure % 4 === 0) padV(t, S.song.chords[mesure / 4] ?? S.song.chords[0], 4 * r.spb);
    if (tour >= 0 && autoFor(r.tours[tour].main)) tourReussi(t, noteDuTour(tour));
  }
}

/** Un appui pendant le remontage : sa main juge son tour. `retard` : le temps écoulé depuis l'événement (toucher,
 * message MIDI), en secondes. */
export function taperRemontage(a: Action, retard = 0) {
  if (S.mode !== "remontage") return;
  const main = mainDe(a);
  if (autoFor(main)) return;
  const r = S.remontage,
    tour = jugerTour(r, main, maintenant() - retard, fenetres());
  if (!tour) return;
  const k = r.tours.indexOf(tour);
  r.eclats[k] = performance.now();
  if (tour.etat === "rate") tourRate(AC.currentTime);
  else tourReussi(AC.currentTime, noteDuTour(k));
}

/** Appelé à chaque image : l'auto-play, les tours manqués, et la fin du remontage */
export function suivreRemontage() {
  if (S.mode !== "remontage") return;
  programmer();
  const r = S.remontage,
    t = maintenant(),
    { joues, rates } = avancerRemontage(r, t, fenetres(), autoFor),
    pnow = performance.now();
  for (const tour of [...joues, ...rates]) r.eclats[r.tours.indexOf(tour)] = pnow;
  if (rates.length) tourRate(AC.currentTime);
  if (remontageFini(r, t)) finir();
}

/** Passe le remontage (Échap) : les tours qui restent sont ratés, le ressort reste ce qu'il est */
export function passerLeRemontage() {
  if (S.mode !== "remontage") return;
  passerRemontage(S.remontage);
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setTargetAtTime(0, t, 0.05);
  finir();
}

// L'harmonie de départ vaut pour les parties de la chanson en place ; l'écran de départ l'annonce et la jauge la montre
function finir() {
  S.depart = resultatRemontage(S.remontage).harmonie;
  S.health = S.depart;
  S.mode = "title";
  show("title");
}

overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  if (!b) return;
  if (b.dataset.act === "remonter") lancerRemontage(false);
  else if (b.dataset.act === "remonter-auto") lancerRemontage(true);
});
