// Commandes tactiles (ADR-0008) : la moitié gauche de l'écran commande la basse (en haut : sauter, en bas : glisser),
// la moitié droite est coupée en quatre bandes, chacune à la hauteur de son couloir tel qu'il est affiché. Chaque
// doigt est suivi à part.
import { heureDe, retardDe } from "../audio/moteur";
import { presser, relacher } from "../jeu/actions";
import { pause } from "../jeu/deroulement";
import { COULOIRS, S, type Action } from "../jeu/etat";
import { H, LANE_Y, cv } from "../rendu/outils";
import { taper } from "./calibrage";
import { overlay, show } from "./ecrans";
import { taperRemontage } from "./remontage";
import { COMMANDES } from "./touches";

const scene = document.querySelector<HTMLElement>(".stage");
const racine = document.documentElement;
const doigts = new Map<number, Action>();

// Limites des bandes de droite, à mi-chemin entre deux couloirs voisins (du plus grave au plus aigu)
const LIMITES = LANE_Y.slice(1).map((y, i) => (y + LANE_Y[i]) / 2);
function zone(x: number, y: number): Action {
  const r = scene.getBoundingClientRect();
  if (x - r.left < r.width / 2) return y - r.top < r.height / 2 ? "sauter" : "glisser";
  // Les bandes suivent les couloirs affichés : le toucher est ramené dans la scène avant de chercher sa bande
  const c = cv.getBoundingClientRect(),
    sy = ((y - c.top) / c.height) * H,
    i = LIMITES.findIndex((l) => sy > l);
  return COULOIRS[i < 0 ? 3 : i];
}
// Le temps écoulé depuis le toucher, et son heure sur l'horloge de la chanson (ADR-0004)
const retard = (e: PointerEvent) => retardDe(e.timeStamp);
const heure = (e: PointerEvent) => heureDe(e.timeStamp);

scene.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest("button")) return;
  // Pendant le calibrage, toucher n'importe où compte comme un coup, même au clavier
  if (S.mode === "calib") return taper(retard(e));
  // Pendant le remontage (#27), un doigt sur la moitié d'une main fait le tour de cette main
  if (S.mode === "remontage") {
    e.preventDefault();
    return taperRemontage(zone(e.clientX, e.clientY), retard(e));
  }
  if (!COMMANDES.tactile || S.mode !== "play") return;
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
// Pas de zoom ni de défilement pendant la partie (Safari ignore une partie de touch-action). Un écran affiché par
// dessus la scène (la carte de #25, la liste des essais) défile quand il dépasse la hauteur de la scène.
for (const type of ["touchmove", "gesturestart", "dblclick"])
  scene.addEventListener(
    type,
    (e) => {
      if (COMMANDES.tactile && !(e.target as HTMLElement).closest?.(".overlay:not([hidden])")) e.preventDefault();
    },
    { passive: false },
  );

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
