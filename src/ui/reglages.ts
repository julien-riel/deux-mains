// Réglages : chanson (graine, difficulté), univers, mains jouées et commandes, retenus d'une visite à l'autre
import { B, AC } from "../audio/moteur";
import { stopScheduler } from "../audio/sequenceur";
import { randomSeed } from "../chanson/aleatoire";
import { buildSong } from "../chanson/generateur";
import { resetRun } from "../jeu/deroulement";
import { S } from "../jeu/etat";
import { clamp } from "../outils";
import { placeName } from "../univers/univers";
import { show } from "./ecrans";
import { ecranTactile } from "./tactile";
import { COMMANDES, etiquettes } from "./touches";

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

export function load(seed: number, diff: string) {
  seed = clamp(Math.round(seed) || 1, 1, 99999);
  stopScheduler();
  if (AC && B) {
    const t = AC.currentTime;
    B.master.gain.cancelScheduledValues(t);
    B.master.gain.setTargetAtTime(0, t, 0.05);
  }
  S.seed = seed;
  S.diff = diff;
  S.song = buildSong(seed, diff);
  resetRun();
  S.mode = "title";
  $<HTMLInputElement>("#seed").value = String(seed);
  const r = document.getElementById("d-" + diff) as HTMLInputElement;
  if (r) r.checked = true;
  $("#songline").textContent = `${placeName()} · ${S.song.keyName} · ${S.song.progLabel} · ${S.song.bpm} BPM`;
  try {
    localStorage.setItem("deux-mains-diff", diff);
  } catch {
    /* stockage indisponible */
  }
  show("title");
}

document
  .querySelectorAll<HTMLInputElement>('input[name="diff"]')
  .forEach((r) => r.addEventListener("change", () => load(S.seed, r.value)));
document
  .querySelectorAll<HTMLInputElement>('input[name="hands"]')
  .forEach((r) => r.addEventListener("change", () => setPractice(r.value)));
document
  .querySelectorAll<HTMLInputElement>('input[name="theme"]')
  .forEach((r) => r.addEventListener("change", () => setTheme(r.value)));
export function setTheme(v: string) {
  S.theme = v;
  const r = document.getElementById("t-" + v) as HTMLInputElement;
  if (r) r.checked = true;
  try {
    localStorage.setItem("deux-mains-theme", v);
  } catch {
    /* stockage indisponible */
  }
  if (S.song)
    $("#songline").textContent = `${placeName()} · ${S.song.keyName} · ${S.song.progLabel} · ${S.song.bpm} BPM`;
  if (S.mode === "title" && S.song) show("title");
}
export function setPractice(v: string) {
  S.practice = v;
  const r = document.getElementById("h-" + v) as HTMLInputElement;
  if (r) r.checked = true;
  if (S.mode === "play" && v !== "both") S.autoUsed = true;
  try {
    localStorage.setItem("deux-mains-hands", v);
  } catch {
    /* stockage indisponible */
  }
  if (S.mode === "title" && S.song) show("title");
}
document
  .querySelectorAll<HTMLInputElement>('input[name="commandes"]')
  .forEach((r) => r.addEventListener("change", () => setCommandes(r.value)));
// Commandes : automatique (tactile sur un téléphone ou une tablette), clavier ou tactile (ADR-0008)
export function setCommandes(v: string) {
  const r = document.getElementById("c-" + v) as HTMLInputElement;
  if (r) r.checked = true;
  try {
    localStorage.setItem("deux-mains-commandes", v);
  } catch {
    /* stockage indisponible */
  }
  COMMANDES.tactile = v === "tactile" || (v === "auto" && ecranTactile());
  document.documentElement.classList.toggle("tactile", COMMANDES.tactile);
  etiquettes();
  if (S.mode === "title" && S.song) show("title");
}
$("#seed").addEventListener("change", (e) => load(+(e.target as HTMLInputElement).value, S.diff));
$("#new").addEventListener("click", () => load(randomSeed(), S.diff));
