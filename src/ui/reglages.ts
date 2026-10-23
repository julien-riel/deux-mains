// Réglages : chanson (graine, difficulté) ou essai, univers, mains jouées, vitesse, boucle, commandes, décalage et formes des couloirs, retenus d'une visite à l'autre
import { B, AC } from "../audio/moteur";
import { stopScheduler } from "../audio/sequenceur";
import { randomSeed } from "../chanson/aleatoire";
import { buildSong } from "../chanson/generateur";
import type { Chanson } from "../chanson/types";
import type { Essai } from "../essais/registre";
import { resetRun } from "../jeu/deroulement";
import { S, type EssaiEnCours, type Mains } from "../jeu/etat";
import { clamp } from "../outils";
import { placeName } from "../univers/univers";
import { show } from "./ecrans";
import { ecranTactile } from "./tactile";
import { COMMANDES, etiquettes } from "./touches";

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

export function load(seed: number, diff: string) {
  seed = clamp(Math.round(seed) || 1, 1, 99999);
  if (S.essai) rendreReglages();
  S.seed = seed;
  installer(buildSong(seed, diff), diff);
  $<HTMLInputElement>("#seed").value = String(seed);
  try {
    localStorage.setItem("deux-mains-diff", diff);
  } catch {
    /* stockage indisponible */
  }
  show("title");
}
// Met une chanson en place, partie neuve, sur l'écran de départ
function installer(song: Chanson, diff: string) {
  stopScheduler();
  if (AC && B) {
    const t = AC.currentTime;
    B.master.gain.cancelScheduledValues(t);
    B.master.gain.setTargetAtTime(0, t, 0.05);
  }
  S.diff = diff;
  S.song = song;
  resetRun();
  S.mode = "title";
  const r = document.getElementById("d-" + diff) as HTMLInputElement;
  if (r) r.checked = true;
  $("#songline").textContent = `${placeName()} · ${S.song.keyName} · ${S.song.progLabel} · ${S.song.bpm} BPM`;
  listerSections();
}
/** La difficulté choisie par le joueur : pendant un essai, celle qu'il retrouvera en le quittant */
export const diffDuJoueur = () => (S.essai ? S.essai.avant.diff : S.diff);
/** Une nouvelle chanson générée, dans la difficulté du joueur : quitte l'essai en cours */
export const nouvelleChanson = () => load(randomSeed(), diffDuJoueur());

/* ---------- Mode essai ---------- */
// Un essai impose son univers, sa difficulté et ses mains sans les enregistrer : en le quittant, le joueur
// retrouve ses réglages, sa graine et sa boucle. Pendant l'essai, la boucle peut reprendre une de ses sections.
export function chargerEssai(e: Essai) {
  S.essai ??= {
    essai: e,
    avant: { diff: S.diff, theme: S.theme, practice: S.practice, vitesse: S.vitesse, boucle: S.boucle },
  };
  S.essai.essai = e;
  S.boucle = -1;
  setTheme(e.univers, false);
  setPractice(e.mains, false);
  setVitesse(1, false);
  installer(e.chanson(), e.diff);
  show("title");
}
function rendreReglages() {
  const a = S.essai.avant;
  S.essai = null;
  S.boucle = a.boucle;
  setTheme(a.theme, false);
  setPractice(a.practice, false);
  setVitesse(a.vitesse, false);
}
/** Quitte les essais : la chanson du joueur, avec ses réglages */
export const quitterEssai = () => load(S.seed, diffDuJoueur());

// Enregistre un choix du joueur ; pendant un essai, c'est aussi celui qu'il retrouvera en le quittant
const CLES = { theme: "deux-mains-theme", practice: "deux-mains-hands", vitesse: "deux-mains-vitesse" } as const;
function retenir<K extends keyof typeof CLES>(k: K, v: EssaiEnCours["avant"][K]) {
  if (S.essai) S.essai.avant[k] = v;
  try {
    localStorage.setItem(CLES[k], String(v));
  } catch {
    /* stockage indisponible */
  }
}

document
  .querySelectorAll<HTMLInputElement>('input[name="diff"]')
  .forEach((r) => r.addEventListener("change", () => load(S.seed, r.value)));
document
  .querySelectorAll<HTMLInputElement>('input[name="hands"]')
  .forEach((r) => r.addEventListener("change", () => setPractice(r.value as Mains)));
document
  .querySelectorAll<HTMLInputElement>('input[name="theme"]')
  .forEach((r) => r.addEventListener("change", () => setTheme(r.value)));
// `choix` : le joueur l'a choisi, on l'enregistre ; sinon c'est celui d'un essai, qui ne dure que l'essai
export function setTheme(v: string, choix = true) {
  S.theme = v;
  const r = document.getElementById("t-" + v) as HTMLInputElement;
  if (r) r.checked = true;
  if (choix) retenir("theme", v);
  if (S.song)
    $("#songline").textContent = `${placeName()} · ${S.song.keyName} · ${S.song.progLabel} · ${S.song.bpm} BPM`;
  if (S.mode === "title" && S.song) show("title");
}
// Mains jouées : les deux, une seule (l'autre en auto-play, un entraînement), ou le duo local (#6)
export function setPractice(v: Mains, choix = true) {
  S.practice = v;
  const r = document.getElementById("h-" + v) as HTMLInputElement;
  if (r) r.checked = true;
  if (S.mode === "play" && (v === "L" || v === "R")) S.autoUsed = true;
  if (choix) retenir("practice", v);
  if (S.mode === "title" && S.song) show("title");
}
document
  .querySelectorAll<HTMLInputElement>('input[name="vitesse"]')
  .forEach((r) => r.addEventListener("change", () => setVitesse(+r.value / 100)));
// Vitesse de lecture, pour s'entraîner au ralenti (#4) : elle s'applique au prochain départ ou à la prochaine reprise
export function setVitesse(v: number, choix = true) {
  S.vitesse = v;
  const r = document.getElementById("v-" + Math.round(v * 100)) as HTMLInputElement;
  if (r) r.checked = true;
  if (choix) retenir("vitesse", v);
  if (S.mode === "title" && S.song) show("title");
}
// Boucle (#5) : une section de la chanson à rejouer sans fin, ou aucune. Elle s'applique au prochain départ.
function listerSections() {
  const sel = $<HTMLSelectElement>("#boucle");
  sel.innerHTML =
    `<option value="-1">Aucune</option>` +
    S.song.sections
      .map((s, i) => `<option value="${i}">${s.name} · mesures ${s.start + 1} à ${s.start + s.bars}</option>`)
      .join("");
  setBoucle(S.boucle < S.song.sections.length ? S.boucle : -1);
}
export function setBoucle(i: number) {
  S.boucle = i;
  $<HTMLSelectElement>("#boucle").value = String(i);
  if (S.mode === "title" && S.song) show("title");
}
$("#boucle").addEventListener("change", (e) => {
  const sel = e.target as HTMLSelectElement;
  setBoucle(+sel.value);
  // On rend le clavier au jeu : Espace lance la partie au lieu de rouvrir la liste
  sel.blur();
});
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
// Décalage du joueur, en millisecondes : mesuré par le calibrage, ou ajusté à la main (#30)
export function setDecalage(ms: number) {
  ms = clamp(Math.round(ms) || 0, -300, 300);
  S.decalage = ms / 1000;
  $<HTMLInputElement>("#decalage").value = String(ms);
  try {
    localStorage.setItem("deux-mains-decalage", String(ms));
  } catch {
    /* stockage indisponible */
  }
}
document
  .querySelectorAll<HTMLInputElement>('input[name="formes"]')
  .forEach((r) => r.addEventListener("change", () => setFormes(r.value === "oui")));
// Formes des couloirs : chaque couloir se reconnaît aussi à sa forme, pas seulement à sa couleur (#31)
export function setFormes(oui: boolean) {
  S.formes = oui;
  const r = document.getElementById(oui ? "f-oui" : "f-non") as HTMLInputElement;
  if (r) r.checked = true;
  try {
    localStorage.setItem("deux-mains-formes", oui ? "oui" : "non");
  } catch {
    /* stockage indisponible */
  }
}
$("#decalage").addEventListener("change", (e) => setDecalage(+(e.target as HTMLInputElement).value));
$("#seed").addEventListener("change", (e) => load(+(e.target as HTMLInputElement).value, diffDuJoueur()));
$("#new").addEventListener("click", nouvelleChanson);
