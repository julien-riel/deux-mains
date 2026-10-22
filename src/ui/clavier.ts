import { songNow } from "../audio/moteur";
import { randomSeed } from "../chanson/aleatoire";
import { presser, relacher } from "../jeu/actions";
import { newRun, pause, resumeCP, unpause } from "../jeu/deroulement";
import { S } from "../jeu/etat";
import { overlay, show } from "./ecrans";
import { load } from "./reglages";
import { ACTION_DE, CLAVIER, KEYLABEL, etiquettes } from "./touches";

overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "start" || act === "restart") newRun();
  else if (act === "listen") newRun(true);
  else if (act === "resume") resumeCP();
  else if (act === "continue") unpause();
  else if (act === "new") load(randomSeed(), S.diff);
});

/* ---------- Entrées ---------- */
addEventListener("keydown", (e) => {
  const t = e.target as HTMLInputElement;
  if (t && ((t.tagName === "INPUT" && t.type !== "radio") || t.tagName === "TEXTAREA")) return;
  const c = e.code;
  if (S.mode === "play") {
    if (c in KEYLABEL || c === "Space" || c === "Escape") e.preventDefault();
    if (e.repeat) return;
    if (c === "Escape") return pause();
    if (c === "KeyA") {
      S.auto = !S.auto;
      if (S.auto) S.autoUsed = true;
      S.banner = {
        text: S.auto ? "Auto-play" : "À toi de jouer",
        sub: S.auto ? `${KEYLABEL.KeyA} pour reprendre la main` : "",
        at: performance.now(),
      };
      return;
    }
    if (ACTION_DE[c]) presser(ACTION_DE[c], songNow());
    return;
  }
  if (e.repeat) return;
  if (S.mode === "title") {
    if (c === "Space" || c === "Enter") {
      e.preventDefault();
      newRun();
    } else if (c === "KeyA") newRun(true);
    else if (c === "KeyN") load(randomSeed(), S.diff);
  } else if (S.mode === "pause") {
    if (c === "Escape" || c === "Space") {
      e.preventDefault();
      unpause();
    } else if (c === "Enter") {
      e.preventDefault();
      newRun();
    }
  } else if (S.mode === "dead" || S.mode === "done") {
    if (c === "KeyR" && S.mode === "dead") resumeCP();
    else if (c === "KeyA") newRun(true);
    else if (c === "Enter") {
      e.preventDefault();
      newRun();
    } else if (c === "KeyN") load(randomSeed(), S.diff);
  }
});
addEventListener("keyup", (e) => {
  const a = ACTION_DE[e.code];
  if (a) relacher(a, S.mode === "play" ? songNow() : 0);
});
addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

// Étiquettes selon la disposition réelle du clavier (AZERTY, etc.)
try {
  (navigator as Navigator & { keyboard: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard
    .getLayoutMap()
    .then((m) => {
      for (const c of Object.keys(CLAVIER)) {
        const v = m.get(c);
        if (v) CLAVIER[c] = v.toUpperCase();
      }
      etiquettes();
      document
        .querySelectorAll<HTMLElement>("kbd[data-code]")
        .forEach((el) => (el.textContent = CLAVIER[el.dataset.code]));
      if (S.mode === "title") show("title");
    })
    .catch(() => {});
} catch {
  /* API absente : on garde les étiquettes QWERTY */
}
