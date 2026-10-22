// Commandes tactiles (ADR-0008) : la moitié gauche de l'écran commande la basse (en haut : sauter, en bas : glisser),
// la moitié droite est coupée en quatre bandes, chacune à la hauteur de son couloir. Chaque doigt est suivi à part.
import { songNow } from "../audio/moteur";
import { presser, relacher } from "../jeu/actions";
import { pause } from "../jeu/deroulement";
import { COULOIRS, S, type Action } from "../jeu/etat";
import { H, LANE_Y, cv } from "../rendu/outils";
import { overlay, show } from "./ecrans";
import { COMMANDES } from "./touches";

const scene = document.querySelector<HTMLElement>(".stage");
const racine = document.documentElement;
const doigts = new Map<number, Action>();

// Limites des bandes de droite, à mi-chemin entre deux couloirs voisins (du plus grave au plus aigu)
const LIMITES = LANE_Y.slice(1).map((y, i) => (y + LANE_Y[i]) / 2);
function zone(x: number, y: number): Action {
  const r = scene.getBoundingClientRect();
  if (x - r.left < r.width / 2) return y - r.top < r.height / 2 ? "sauter" : "glisser";
  const c = cv.getBoundingClientRect(),
    sy = ((y - c.top) / c.height) * H,
    i = LIMITES.findIndex((l) => sy > l);
  return COULOIRS[i < 0 ? 3 : i];
}
// L'heure du toucher, ramenée sur l'horloge de la chanson (ADR-0004) : le délai de traitement ne compte pas.
// Un horodatage d'une autre base (anciens navigateurs) est ignoré.
function heure(e: PointerEvent) {
  const retard = performance.now() - e.timeStamp;
  return songNow() - (retard >= 0 && retard < 1000 ? retard / 1000 : 0);
}

scene.addEventListener("pointerdown", (e) => {
  if (!COMMANDES.tactile || S.mode !== "play" || (e.target as HTMLElement).closest("button")) return;
  e.preventDefault();
  const a = zone(e.clientX, e.clientY);
  // Un deuxième doigt sur la même zone ne fait rien : seul le premier la relâchera
  if (S.keys[a]) return;
  doigts.set(e.pointerId, a);
  presser(a, heure(e), true);
});
function lever(e: PointerEvent) {
  const a = doigts.get(e.pointerId);
  if (!a) return;
  doigts.delete(e.pointerId);
  relacher(a, S.mode === "play" ? heure(e) : 0);
}
scene.addEventListener("pointerup", lever);
scene.addEventListener("pointercancel", lever);
// Pas de zoom ni de défilement pendant la partie (Safari ignore une partie de touch-action)
for (const type of ["touchmove", "gesturestart", "dblclick"])
  scene.addEventListener(type, (e) => COMMANDES.tactile && e.preventDefault(), { passive: false });

document.querySelector("#pause").addEventListener("click", pause);

// En portrait, la partie s'arrête : un écran demande de tourner le téléphone
const portrait = matchMedia("(orientation: portrait)");
portrait.addEventListener?.("change", () => {
  if (portrait.matches && COMMANDES.tactile) pause();
});

/* ---------- Menu des réglages et plein écran ---------- */
overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  if (!b) return;
  if (b.dataset.act === "reglages") racine.classList.add("menu");
  else if (b.dataset.act === "plein-ecran") racine.requestFullscreen?.().catch(() => {});
});
document.querySelector("#fermer-reglages").addEventListener("click", () => racine.classList.remove("menu"));
document.addEventListener("fullscreenchange", () => {
  if (S.mode === "title") show("title");
});

/** Un écran tactile sans survol : téléphone ou tablette */
export const ecranTactile = () => matchMedia("(hover: none) and (pointer: coarse)").matches;
