/* ---------- Écrans ---------- */
import { DIFFS } from "../chanson/difficultes";
import { S, sectionAtBar, spb } from "../jeu/etat";
import { clamp } from "../outils";
import { TH, placeName } from "../univers/univers";
import { COMMANDES, KEYLABEL } from "./touches";

export const overlay = document.querySelector<HTMLElement>("#overlay");

export const k = (c) => `<kbd>${KEYLABEL[c] || c}</kbd>`;
export function show(kind) {
  const s = S.song,
    D = DIFFS[S.diff];
  const len = Math.round(s.totalBars * 4 * spb());
  let h = "";
  if (kind === "title") {
    h = `<p class="eyebrow">${TH().label} · ${TH().unit} n° ${S.seed} · ${D.label}${S.practice === "L" ? " · main gauche seule" : S.practice === "R" ? " · main droite seule" : ""}</p>
      <h2>${placeName()}</h2>
      <p class="meta">${s.keyName} · ${s.progLabel} · ${s.bpm} BPM · ${len} s</p>
      <div class="actions"><button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>${
        COMMANDES.tactile
          ? `<button type="button" data-act="reglages">Réglages</button>${
              document.fullscreenEnabled && !document.fullscreenElement
                ? `<button type="button" data-act="plein-ecran">Plein écran</button>`
                : ""
            }`
          : ""
      }</div>
      ${
        COMMANDES.tactile
          ? `<p class="hint">Pouce gauche : en haut pour sauter, en bas pour glisser, le doigt posé pour tenir. Pouce droit : la bande du couloir de l'ennemi.</p>
      <p class="hint">Sur iPhone, coupe le mode silencieux pour entendre la musique.</p>`
          : `<p class="hint">Gauche ${k("KeyW")} ${k("KeyS")} · Droite ${k("KeyJ")} ${k("KeyK")} ${k("KeyL")} ${k("Semicolon")}</p>`
      }`;
  } else if (kind === "pause") {
    h = `<p class="eyebrow">Pause</p><h2>La chanson attend</h2>
      <div class="actions"><button class="primary" type="button" data-act="continue">Continuer <kbd>Échap</kbd></button>
      <button type="button" data-act="restart">Recommencer <kbd>Entrée</kbd></button></div>`;
  } else if (kind === "dead") {
    const bar = clamp(Math.floor(S.deathBeat / 4), 0, s.totalBars - 1),
      sec = sectionAtBar(bar);
    const where = {
      intro: "au début",
      couplet: "au couplet",
      refrain: "au refrain",
      pont: "au solo",
      outro: "à l'outro",
    }[S.cp ? S.cp.sec.kind : "intro"];
    h = `<p class="eyebrow">${TH().deadTag}</p><h2>${TH().deadTitle}</h2>
      <p class="meta">Mesure ${bar + 1} sur ${s.totalBars}, pendant : ${sec.name}.</p>
      <div class="actions"><button class="primary" type="button" data-act="resume">Reprendre ${where} <kbd>R</kbd></button>
      <button type="button" data-act="restart">Recommencer <kbd>Entrée</kbd></button>
      <button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button></div>`;
  } else if (kind === "done") {
    const total = S.perfect + S.good + S.miss,
      acc = (S.perfect + 0.6 * S.good) / Math.max(1, total);
    const rank = acc >= 0.95 ? "Virtuose" : acc >= 0.85 ? "Soliste" : acc >= 0.7 ? "Choriste" : "Élève";
    const tag = S.autoUsed
      ? `${S.auto ? "auto-play" : "entraînement"}, score non classé`
      : `précision ${Math.round(acc * 100)} %`;
    h = `<p class="eyebrow">${placeName()} · ${TH().unit} n° ${S.seed} · ${tag}</p><h2>${S.auto ? "Écoute terminée" : S.autoUsed ? "Entraînement terminé" : rank}</h2>
      <div class="stats">
        <div><b>${S.score.toLocaleString("fr-CA")}</b><span>Score</span></div>
        <div><b>${S.perfect}</b><span>Parfait</span></div>
        <div><b>${S.good}</b><span>Bien</span></div>
        <div><b>${S.miss}</b><span>Raté</span></div>
        <div><b>${S.maxCombo}</b><span>Combo max</span></div>
      </div>
      <div class="actions"><button class="primary" type="button" data-act="restart">Jouer <kbd>Entrée</kbd></button>
      <button type="button" data-act="listen">Réécouter ${k("KeyA")}</button>
      <button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button></div>`;
  }
  overlay.innerHTML = h;
  overlay.hidden = false;
}
