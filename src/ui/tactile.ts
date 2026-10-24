// Commandes tactiles (ADR-0008, ADR-0019) : des zones fixes dessinées dans l'écran, les mêmes dans toutes les scènes.
// La colonne gauche commande la basse (en haut : sauter, en bas : glisser), la rangée du bas joue les quatre couloirs
// (`src/rendu/zones.ts`). Chaque doigt est suivi à part.
import { heureDe, retardDe } from "../audio/moteur";
import { presser, relacher } from "../jeu/actions";
import { pause } from "../jeu/deroulement";
import { COULOIRS, S, type Action } from "../jeu/etat";
import { cv } from "../rendu/outils";
import { actionAuPoint } from "../rendu/zones";
import { taper } from "./calibrage";
import { overlay, show } from "./ecrans";
import { taperRemontage } from "./remontage";
import { COMMANDES } from "./touches";

const scene = document.querySelector<HTMLElement>(".stage");
const racine = document.documentElement;
const doigts = new Map<number, Action>();

// La zone sous le doigt, dans le canvas où elle est dessinée ; un doigt posé sur la scène ne joue rien (null). Un
// doigt sur les bords de la page, hors du canvas, compte pour la zone la plus proche.
function zone(x: number, y: number): Action | null {
  const c = cv.getBoundingClientRect(),
    dedans = (v: number, max: number) => Math.min(max, Math.max(0, v));
  return actionAuPoint(dedans(x - c.left, c.width), dedans(y - c.top, c.height), c.width, c.height);
}
// Pendant le remontage (#27), seule la main compte : une zone fait le tour de sa main, et un doigt sur la scène
// (ou n'importe où, au clavier, où les zones ne sont pas dessinées) celui de la main de sa moitié de l'écran
function main(x: number, y: number): Action {
  const r = scene.getBoundingClientRect();
  return (COMMANDES.tactile && zone(x, y)) || (x - r.left < r.width / 2 ? "sauter" : COULOIRS[0]);
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
    return taperRemontage(main(e.clientX, e.clientY), retard(e));
  }
  if (!COMMANDES.tactile || S.mode !== "play") return;
  e.preventDefault();
  const a = zone(e.clientX, e.clientY);
  // Un doigt sur la scène ne joue rien ; un deuxième doigt sur la même zone non plus : seul le premier la relâchera
  if (!a || S.keys[a]) return;
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
