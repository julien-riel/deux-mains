// Réglages : chanson (graine, difficulté) ou essai, univers, mains jouées, vitesse, boucle, commandes, décalage, formes des couloirs, mode pianiste, fantôme (#32) et scène (#83), retenus d'une visite à l'autre
import { B, AC, songNow } from "../audio/moteur";
import { stopScheduler } from "../audio/sequenceur";
import { randomSeed } from "../chanson/aleatoire";
import { buildBoss } from "../chanson/boss";
import { buildSong } from "../chanson/generateur";
import { composer, type Partition } from "../chanson/partition";
import { airDe, composerAir, type Air } from "../chanson/repertoire";
import type { Chanson } from "../chanson/types";
import type { Essai } from "../essais/registre";
import { resetRun } from "../jeu/deroulement";
import { noter } from "../jeu/enregistrement";
import { S, airEnCours, spb, type EssaiEnCours, type Mains } from "../jeu/etat";
import { abandonnerReecoute, mainsDuJoueur } from "../jeu/reecoute";
import { sceneDeLaPartie, type ReglageScene } from "../jeu/scenes";
import { clamp } from "../outils";
import { placeName } from "../univers/univers";
import { show } from "./ecrans";
import { ecranTactile } from "./tactile";
import { COMMANDES, MIDI, etiquettes } from "./touches";

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

/** Charge la chanson de cette graine dans cette difficulté, ou son niveau de boss de fin (#26) */
export function load(seed: number, diff: string, boss = false) {
  seed = clamp(Math.round(seed) || 1, 1, 99999);
  rendreComposition();
  if (S.essai) rendreReglages();
  S.seed = seed;
  installer(boss ? buildBoss(seed, diff) : buildSong(seed, diff), diff);
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
  abandonnerReecoute();
  if (AC && B) {
    const t = AC.currentTime;
    B.master.gain.cancelScheduledValues(t);
    B.master.gain.setTargetAtTime(0, t, 0.05);
  }
  S.diff = diff;
  S.song = song;
  // La scène ne change jamais en pleine chanson (ADR-0019) : elle se choisit avec elle
  S.scene = sceneDeLaPartie(S.essai?.essai, song, S.reglageScene);
  // Le remontage (#27) ne vaut que pour la chanson qui le suit
  S.remontage = null;
  S.depart = null;
  resetRun();
  S.mode = "title";
  const r = document.getElementById("d-" + diff) as HTMLInputElement;
  if (r) r.checked = true;
  $("#songline").textContent = `${placeName()} · ${S.song.keyName} · ${S.song.progLabel} · ${S.song.bpm} BPM`;
  listerSections();
}
/** La difficulté choisie par le joueur : pendant un essai ou une composition, celle qu'il retrouvera en les quittant */
export const diffDuJoueur = () =>
  S.essai ? S.essai.avant.diff : S.avantComposition ? S.avantComposition.diff : S.diff;

/* ---------- Compositions (#28, ADR-0016) ---------- */
// Une composition impose sa difficulté sans l'enregistrer, comme un essai, et se joue sans la boucle du joueur : en
// revenant à sa chanson, il retrouve les deux. Pendant un essai, c'est l'essai qui les garde.
export function chargerComposition(p: Partition) {
  S.avantComposition ??= { diff: S.diff, boucle: S.boucle };
  S.boucle = -1;
  installer(composer(p), p.diff);
}
/**
 * Une chanson du répertoire (ADR-0018) : elle s'installe comme une composition, sans la boucle du joueur, mais dans
 * la difficulté qu'il a choisie, qu'on retient. Changer de difficulté la reprend dans la nouvelle.
 */
export function chargerAir(air: Air, diff: string) {
  if (S.essai) return;
  S.avantComposition ??= { diff: S.diff, boucle: S.boucle };
  S.avantComposition.diff = diff;
  S.boucle = -1;
  installer(composerAir(air, diff), diff);
  try {
    localStorage.setItem("deux-mains-diff", diff);
  } catch {
    /* stockage indisponible */
  }
  show("title");
}
function rendreComposition() {
  const a = S.avantComposition;
  if (!a) return;
  S.avantComposition = null;
  S.diff = a.diff;
  S.boucle = a.boucle;
}
/** Une nouvelle chanson générée, dans la difficulté du joueur : quitte l'essai en cours */
export const nouvelleChanson = () => load(randomSeed(), diffDuJoueur());
/** Le niveau affiché est-il un boss de fin (#26), hors essai ? Changer de difficulté ou de graine le garde. */
export const enBoss = () => !S.essai && !!S.song?.boss;
/**
 * Le boss de fin (#26) de cette graine, dans la difficulté du joueur : c'est par ici que la carte du monde (#25)
 * l'ouvrira. Sans graine, celui de la chanson affichée ; quitte l'essai en cours.
 */
export const chargerBoss = (seed = S.seed, diff = diffDuJoueur()) => load(seed, diff, true);
/** Passe de la chanson à son boss, ou du boss à sa chanson */
export const basculerBoss = () => load(S.seed, diffDuJoueur(), !enBoss());

/* ---------- Mode essai ---------- */
// Un essai impose son univers, sa difficulté et ses mains sans les enregistrer : en le quittant, le joueur
// retrouve ses réglages, sa graine et sa boucle. Pendant l'essai, la boucle peut reprendre une de ses sections.
export function chargerEssai(e: Essai) {
  rendreComposition();
  S.essai ??= {
    essai: e,
    avant: { diff: S.diff, theme: S.theme, practice: S.practice, vitesse: S.vitesse, boucle: S.boucle },
  };
  S.essai.essai = e;
  // Sa progression fictive (#25), neuve à chaque ouverture : la sauvegarde du joueur n'est ni lue ni écrite
  S.essai.sauvegarde = e.progression?.();
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
  // Le brouillon d'exemple de l'essai de l'éditeur (#28) ne suit pas le joueur hors des essais
  if (S.editeur?.essai) S.editeur = null;
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
  .forEach((r) =>
    r.addEventListener("change", () =>
      airEnCours() ? chargerAir(airDe(airEnCours()), r.value) : load(S.seed, r.value, enBoss()),
    ),
  );
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
  // La carte (#25) change d'habillage avec l'univers : la Carte de la Ville, l'Album de la Boîte
  if ((S.mode === "title" || S.mode === "carte") && S.song) show(S.mode);
}
// Mains jouées : les deux, une seule (l'autre en auto-play, un entraînement), ou le duo local (#6)
export function setPractice(v: Mains, choix = true) {
  // Pendant la réécoute (#23), la partie rejouée garde ses mains : le choix vaudra en la quittant
  if (!mainsDuJoueur(v)) S.practice = v;
  const r = document.getElementById("h-" + v) as HTMLInputElement;
  if (r) r.checked = true;
  if (S.mode === "play" && (v === "L" || v === "R")) S.autoUsed = true;
  // Changées en cours de partie, les mains s'enregistrent pour la réécoute
  if ((S.mode === "play" || S.mode === "pause") && !S.relecture)
    noter(S.enregistrement, { temps: songNow() / spb(), geste: "mains", mains: v });
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
document
  .querySelectorAll<HTMLInputElement>('input[name="pianiste"]')
  .forEach((r) => r.addEventListener("change", () => setPianiste(r.value === "oui")));
// Mode pianiste au clavier MIDI (#53, ADR-0011) : jouer la vraie note demandée, à l'octave près, plutôt que les touches
// de la position fixe. Désactivé par défaut ; le réglage ne se montre qu'une fois le MIDI activé (src/ui/midi.ts).
export function setPianiste(oui: boolean) {
  MIDI.pianiste = oui;
  const r = document.getElementById(oui ? "p-oui" : "p-non") as HTMLInputElement;
  if (r) r.checked = true;
  try {
    localStorage.setItem("deux-mains-pianiste", oui ? "oui" : "non");
  } catch {
    /* stockage indisponible */
  }
  etiquettes();
  if (S.mode === "title" && S.song) show("title");
}
document
  .querySelectorAll<HTMLInputElement>('input[name="fantome"]')
  .forEach((r) => r.addEventListener("change", () => setFantome(r.value === "voir")));
// Fantôme du meilleur passage (#32) : on le voit courir avec l'écart de score, ou on le masque. Il se change aussi en
// pleine partie : le fantôme apparaît ou disparaît aussitôt.
export function setFantome(voir: boolean) {
  S.voirFantome = voir;
  const r = document.getElementById(voir ? "fa-voir" : "fa-masquer") as HTMLInputElement;
  if (r) r.checked = true;
  try {
    localStorage.setItem("deux-mains-fantome", voir ? "voir" : "masquer");
  } catch {
    /* stockage indisponible */
  }
}
$("#scene").addEventListener("change", (e) => {
  const sel = e.target as HTMLSelectElement;
  setScene(sel.value as ReglageScene);
  // On rend le clavier au jeu, comme pour la boucle
  sel.blur();
});
/**
 * Scène (#83, ADR-0019) : celle du lieu de chaque chanson, ou une scène fixe pour toutes. La scène ne change jamais
 * en pleine chanson : le choix vaut aussitôt pour la chanson de l'écran de départ, sinon pour la prochaine chanson
 * mise en place. Un essai garde sa scène, et n'appelle jamais ce réglage.
 */
export function setScene(v: ReglageScene) {
  S.reglageScene = v;
  $<HTMLSelectElement>("#scene").value = v;
  try {
    localStorage.setItem("deux-mains-scene", v);
  } catch {
    /* stockage indisponible */
  }
  if (S.mode === "title" && S.song) {
    S.scene = sceneDeLaPartie(S.essai?.essai, S.song, v);
    show("title");
  }
}
$("#decalage").addEventListener("change", (e) => setDecalage(+(e.target as HTMLInputElement).value));
$("#seed").addEventListener("change", (e) => load(+(e.target as HTMLInputElement).value, diffDuJoueur(), enBoss()));
$("#new").addEventListener("click", nouvelleChanson);
