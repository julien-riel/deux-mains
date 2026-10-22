/* ---------- Écrans ---------- */
import { songNow } from "../audio/moteur";
import { DIFFS } from "../chanson/difficultes";
import { METRONOME } from "../jeu/calibrage";
import { S, mesureDeLaChanson, passageAt, precision, sectionAtBar, spb } from "../jeu/etat";
import { clamp } from "../outils";
import { TH, placeName } from "../univers/univers";
import { COMMANDES, KEYLABEL } from "./touches";

export const overlay = document.querySelector<HTMLElement>("#overlay");

export const k = (c) => `<kbd>${KEYLABEL[c] || c}</kbd>`;
export function show(kind) {
  const s = S.song,
    D = DIFFS[S.diff];
  // La durée à la vitesse choisie, qui s'appliquera au départ (#4)
  const len = Math.round((s.totalBars * 4 * 60) / (s.bpm * S.vitesse)),
    boucle = s.sections[S.boucle];
  let h = "";
  if (kind === "title") {
    h = `<p class="eyebrow">${TH().label} · ${TH().unit} n° ${S.seed} · ${D.label}${S.practice === "L" ? " · main gauche seule" : S.practice === "R" ? " · main droite seule" : ""}${S.vitesse < 1 ? ` · vitesse ${Math.round(S.vitesse * 100)} %` : ""}${boucle ? ` · boucle : ${boucle.name}` : ""}</p>
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
          ? `<p class="hint">Pouce gauche : en haut pour sauter (une seconde fois en l'air pour un double saut), en bas pour glisser, le doigt posé pour tenir. Pouce droit : la bande du couloir de l'ennemi.</p>
      <p class="hint">Sur iPhone, coupe le mode silencieux pour entendre la musique.</p>`
          : `<p class="hint">Gauche ${k("KeyW")} ${k("KeyS")} · Droite ${k("KeyJ")} ${k("KeyK")} ${k("KeyL")} ${k("Semicolon")}</p>`
      }`;
  } else if (kind === "calib") {
    const r = S.calib.resultat,
      geste = COMMANDES.tactile ? "Touche l'écran" : `Appuie sur <kbd>Espace</kbd>`,
      ms = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))} ms`,
      actuel = `Réglage actuel : ${ms(S.decalage * 1000)}`;
    if (r === undefined)
      h = `<p class="eyebrow">Calibrage de la latence</p><h2>Tape en rythme avec le clic</h2>
      <p class="meta">${geste} à chaque clic. Les ${METRONOME.decompte} premiers servent à te caler.</p>
      <p class="hint">Coups : ${S.calib.coups.length}</p>
      <div class="actions"><button type="button" data-act="calib-annuler">Annuler <kbd>Échap</kbd></button></div>`;
    else if (r === null)
      h = `<p class="eyebrow">Calibrage de la latence</p><h2>Pas assez de coups réguliers</h2>
      <p class="meta">Tape sur chaque clic, le plus régulièrement possible.</p>
      <p class="hint">${actuel}</p>
      <div class="actions"><button class="primary" type="button" data-act="calib">Recommencer <kbd>Entrée</kbd></button>
      <button type="button" data-act="calib-annuler">Annuler <kbd>Échap</kbd></button></div>`;
    else
      h = `<p class="eyebrow">Calibrage de la latence · décalage mesuré</p><h2>${ms(r * 1000)}</h2>
      <p class="meta">${
        Math.round(r * 1000) === 0
          ? "Tu tapes pile sur le clic."
          : `Tu tapes en moyenne ${Math.abs(Math.round(r * 1000))} ms ${r > 0 ? "après" : "avant"} le clic : le jeu va le compenser.`
      }</p>
      <p class="hint">${actuel}</p>
      <div class="actions"><button class="primary" type="button" data-act="calib-ok">Appliquer <kbd>Entrée</kbd></button>
      <button type="button" data-act="calib">Recommencer</button>
      <button type="button" data-act="calib-annuler">Annuler <kbd>Échap</kbd></button></div>`;
  } else if (kind === "pause") {
    h = `<p class="eyebrow">Pause</p><h2>La chanson attend</h2>
      <div class="actions"><button class="primary" type="button" data-act="continue">Continuer <kbd>Échap</kbd></button>
      <button type="button" data-act="restart">Recommencer <kbd>Entrée</kbd></button>${
        S.bouclePartie ? `<button type="button" data-act="quitter-boucle">Quitter la boucle <kbd>B</kbd></button>` : ""
      }</div>`;
  } else if (kind === "dead") {
    const bar = clamp(mesureDeLaChanson(Math.floor(S.deathBeat / 4)), 0, s.totalBars - 1),
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
    const acc = precision(S.perfect, S.good, S.miss);
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
      </div>${S.bouclePartie ? `<p class="meta">${resumeBoucle()}</p>` : ""}
      <div class="actions"><button class="primary" type="button" data-act="restart">Jouer <kbd>Entrée</kbd></button>
      <button type="button" data-act="listen">Réécouter ${k("KeyA")}</button>
      <button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button></div>`;
  }
  overlay.innerHTML = h;
  overlay.hidden = false;
}

// Fin d'une boucle (#5) : le nombre de passages terminés et la précision du dernier
function resumeBoucle() {
  const { sec, passages } = S.bouclePartie,
    n = passageAt(songNow() / spb()),
    d = passages[n - 1];
  if (!n) return `${sec.name} en boucle · aucun passage terminé`;
  return `${sec.name} en boucle · ${n} passage${n > 1 ? "s" : ""} terminé${n > 1 ? "s" : ""}${
    d ? ` · dernier passage : précision ${Math.round(precision(d.parfait, d.bien, d.rate) * 100)} %` : ""
  }`;
}
