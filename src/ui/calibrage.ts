// Écran de calibrage (#30) : un métronome joue, le joueur tape en rythme, le jeu mesure son décalage
import { click } from "../audio/instruments";
import { AC, B, initAudio, lat } from "../audio/moteur";
import { stopScheduler } from "../audio/sequenceur";
import { METRONOME, mesurerDecalage } from "../jeu/calibrage";
import { S } from "../jeu/etat";
import { overlay, show } from "./ecrans";
import { setDecalage } from "./reglages";

export function lancerCalibrage() {
  initAudio();
  if (AC.state === "suspended") AC.resume();
  stopScheduler();
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setValueAtTime(0.8, t);
  // Les clics sont programmés d'un coup, à l'heure exacte (ADR-0004)
  const periode = 60 / METRONOME.bpm,
    debut = t + 0.5,
    n = METRONOME.decompte + METRONOME.mesures,
    clics = [];
  for (let k = 0; k < n; k++) {
    click(debut + k * periode, k % 4 === 0);
    if (k >= METRONOME.decompte) clics.push(debut + k * periode);
  }
  S.calib = { clics, coups: [], fin: debut + n * periode };
  S.mode = "calib";
  document.documentElement.classList.remove("menu");
  show("calib");
}

/** Un coup du joueur. `retard` : le temps écoulé depuis l'événement (toucher horodaté), en secondes. */
export function taper(retard = 0) {
  if (S.mode !== "calib" || S.calib.resultat !== undefined) return;
  // L'heure où le joueur entend le son, comme pour le temps de la chanson, mais sans le décalage déjà réglé
  S.calib.coups.push(AC.currentTime - lat() - retard);
  show("calib");
}

/** Appelé à chaque image : à la fin du métronome, le résultat s'affiche. */
export function suivreCalibrage() {
  if (S.mode !== "calib" || S.calib.resultat !== undefined || AC.currentTime < S.calib.fin) return;
  S.calib.resultat = mesurerDecalage(S.calib.coups, S.calib.clics);
  show("calib");
}

export function appliquerCalibrage() {
  if (S.mode === "calib" && typeof S.calib.resultat === "number") setDecalage(Math.round(S.calib.resultat * 1000));
  fermerCalibrage();
}
export function fermerCalibrage() {
  S.calib = null;
  S.mode = "title";
  show("title");
}

overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  if (!b) return;
  if (b.dataset.act === "calib") lancerCalibrage();
  else if (b.dataset.act === "calib-ok") appliquerCalibrage();
  else if (b.dataset.act === "calib-annuler") fermerCalibrage();
});
document.querySelector("#calibrer").addEventListener("click", lancerCalibrage);
