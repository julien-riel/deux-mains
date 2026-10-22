import { songNow } from "../audio/moteur";
import { randomSeed } from "../chanson/aleatoire";
import { newRun, pause, resumeCP, unpause } from "../jeu/deroulement";
import { S, autoFor } from "../jeu/etat";
import { leftPress, release, rightPress } from "../jeu/jugement";
import { overlay, show } from "./ecrans";
import { load } from "./reglages";
import { KEYLABEL, LANE_CODES } from "./touches";

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
    const hand = c === "KeyW" || c === "KeyS" ? "L" : LANE_CODES.includes(c) ? "R" : null;
    if (hand && autoFor(hand)) return;
    if (S.keys[c]) return;
    S.keys[c] = true;
    if (c === "KeyW") leftPress(1, songNow());
    else if (c === "KeyS") leftPress(0, songNow());
    else {
      const lane = LANE_CODES.indexOf(c);
      if (lane >= 0) rightPress(lane, songNow());
    }
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
  const c = e.code;
  S.keys[c] = false;
  if (S.mode !== "play") return;
  if (c === "KeyS") {
    if (!autoFor("L")) release("L", 0, songNow());
  } else {
    const lane = LANE_CODES.indexOf(c);
    if (lane >= 0 && !autoFor("R")) release("R", lane, songNow());
  }
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
      for (const c of Object.keys(KEYLABEL)) {
        const v = m.get(c);
        if (v) KEYLABEL[c] = v.toUpperCase();
      }
      document
        .querySelectorAll<HTMLElement>("kbd[data-code]")
        .forEach((el) => (el.textContent = KEYLABEL[el.dataset.code]));
      if (S.mode === "title") show("title");
    })
    .catch(() => {});
} catch {
  /* API absente : on garde les étiquettes QWERTY */
}
