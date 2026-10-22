// Amorçage : branche les modules, retrouve les réglages et lance la boucle d'images
import { AC } from "./audio/moteur";
import { randomSeed } from "./chanson/aleatoire";
import { DIFFS } from "./chanson/difficultes";
import { update } from "./jeu/deroulement";
import { effets } from "./jeu/effets";
import { S } from "./jeu/etat";
import { brancherEffets } from "./jeu/jugement";
import { cv } from "./rendu/outils";
import { render, visualBeat } from "./rendu/scene";
import "./ui/clavier";
import { show } from "./ui/ecrans";
import { load, setPractice, setTheme } from "./ui/reglages";
import { THEMES } from "./univers/univers";

// Mise à jour à chaud de l'artefact publié : la plateforme garde la chanson et les réglages d'une version à l'autre
interface Reglages {
  seed?: number;
  diff?: string;
  practice?: string;
  theme?: string;
}
interface Chaud {
  data?: Reglages;
  snapshot?(f: () => Reglages): void;
  ready?(f: (data?: Reglages) => void): void;
}
declare global {
  interface Window {
    claude?: { hot?: Chaud };
  }
}

brancherEffets(effets);

/* ---------- Boucle ---------- */
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    r = cv.getBoundingClientRect();
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
}
new ResizeObserver(fit).observe(cv);
fit();
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!S.song) return;
  if (S.mode === "play") update(visualBeat());
  if (S.mode === "dying" && AC.currentTime - S.deathAt > 1.7) {
    S.mode = "dead";
    show("dead");
  }
  render(visualBeat(), dt);
}

let savedDiff = null;
let savedHands = null,
  savedTheme = null;
try {
  savedDiff = localStorage.getItem("deux-mains-diff");
  savedHands = localStorage.getItem("deux-mains-hands");
  savedTheme = localStorage.getItem("deux-mains-theme");
} catch {
  /* stockage indisponible */
}
const HANDS = ["both", "L", "R"];
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ seed: S.seed, diff: S.diff, practice: S.practice, theme: S.theme }));
const boot = (data) => {
  data = data || {};
  setTheme(THEMES[data.theme] ? data.theme : THEMES[savedTheme] ? savedTheme : "ville");
  setPractice(HANDS.includes(data.practice) ? data.practice : HANDS.includes(savedHands) ? savedHands : "both");
  load(data.seed || randomSeed(), DIFFS[data.diff] ? data.diff : DIFFS[savedDiff] ? savedDiff : "normal");
  requestAnimationFrame(frame);
};
if (hot && hot.ready) hot.ready(boot);
else boot(hot && hot.data);
