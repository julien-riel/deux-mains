/* ---------- Écrans ---------- */
import { songNow } from "../audio/moteur";
import { DIFFS } from "../chanson/difficultes";
import { ESSAIS } from "../essais/registre";
import { METRONOME } from "../jeu/calibrage";
import { S, mesureDeLaChanson, passageAt, precision, sectionAtBar, spb, type StatsMain } from "../jeu/etat";
import { clamp } from "../outils";
import { TH, placeName } from "../univers/univers";
import { COMMANDES, KEYLABEL } from "./touches";

export const overlay = document.querySelector<HTMLElement>("#overlay");
// Pendant un essai, ce qu'il faut vérifier reste écrit sur la scène
const bandeau = document.querySelector<HTMLElement>("#essai-bandeau");

export const k = (c) => `<kbd>${KEYLABEL[c] || c}</kbd>`;
// Les boutons de sortie d'un essai, sur ses écrans de départ, de mort et de fin
const sortiesEssai = () =>
  `<button type="button" data-act="essais">Autres essais <kbd>E</kbd></button>
      <button type="button" data-act="quitter-essai">Quitter les essais <kbd>Échap</kbd></button>`;
export function show(kind) {
  const s = S.song,
    D = DIFFS[S.diff],
    essai = S.essai && S.essai.essai;
  // La durée à la vitesse choisie, qui s'appliquera au départ (#4)
  const len = Math.round((s.totalBars * 4 * 60) / (s.bpm * S.vitesse)),
    boucle = s.sections[S.boucle],
    duo = S.practice === "duo",
    mains =
      S.practice === "L" ? " · main gauche seule" : S.practice === "R" ? " · main droite seule" : duo ? " · duo" : "";
  bandeau.hidden = !essai;
  bandeau.textContent = essai ? `Essai · ${essai.titre} — ${essai.verifier}` : "";
  let h = "";
  if (kind === "title" && essai) {
    h = `<p class="eyebrow">Essai · ${TH().label} · ${D.label}${mains}${boucle ? ` · boucle : ${boucle.name}` : ""}</p>
      <h2>${essai.titre}</h2>
      <p class="meta">À vérifier : ${essai.verifier}</p>
      <p class="hint">${s.keyName} · ${s.bpm} BPM · ${len} s</p>
      <div class="actions"><button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>
      ${sortiesEssai()}</div>`;
  } else if (kind === "essais") {
    h = `<p class="eyebrow">Mode essai</p><h2>Essayer une fonctionnalité</h2>
      <p class="meta">Une chanson courte où elle revient dès les premières mesures.</p>
      <div class="essais">${ESSAIS.map(
        (e, i) =>
          `<button type="button" data-act="essai" data-essai="${e.id}"><kbd>${i + 1}</kbd><span><b>${e.titre}</b><small>${e.verifier}</small></span></button>`,
      ).join("")}</div>
      <div class="actions"><button type="button" data-act="titre">Retour <kbd>Échap</kbd></button></div>`;
  } else if (kind === "title") {
    h = `<p class="eyebrow">${TH().label} · ${TH().unit} n° ${S.seed} · ${D.label}${mains}${S.vitesse < 1 ? ` · vitesse ${Math.round(S.vitesse * 100)} %` : ""}${boucle ? ` · boucle : ${boucle.name}` : ""}</p>
      <h2>${placeName()}</h2>
      <p class="meta">${s.keyName} · ${s.progLabel} · ${s.bpm} BPM · ${len} s</p>
      <div class="actions"><button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>
      <button type="button" data-act="essais">Essais <kbd>E</kbd></button>${
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
          ? `<p class="hint">Pouce gauche : en haut pour sauter (une seconde fois en l'air pour un double saut), en bas pour glisser ou écraser la plaque d'un refrain, le doigt posé pour tenir. Pouce droit : la bande du couloir de l'ennemi.</p>
      <p class="hint">Sur iPhone, coupe le mode silencieux pour entendre la musique.</p>`
          : `<p class="hint">${duo ? "Basse" : "Gauche"} ${k("KeyW")} ${k("KeyS")} ${k("Space")} · ${duo ? "Mélodie" : "Droite"} ${k("KeyJ")} ${k("KeyK")} ${k("KeyL")} ${k("Semicolon")}</p>`
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
      ${essai ? sortiesEssai() : `<button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button>`}</div>`;
  } else if (kind === "done" && essai) {
    h = `<p class="eyebrow">Essai · ${essai.titre} · ${S.auto ? "auto-play" : `précision ${Math.round(precision(S.perfect, S.good, S.miss) * 100)} %`}</p>
      <h2>Essai terminé</h2>
      <p class="meta">À vérifier : ${essai.verifier}</p>
      ${
        duo
          ? bilanDuo()
          : `<div class="stats">
        <div><b>${S.perfect}</b><span>Parfait</span></div>
        <div><b>${S.good}</b><span>Bien</span></div>
        <div><b>${S.miss}</b><span>Raté</span></div>
        <div><b>${S.maxCombo}</b><span>Combo max</span></div>
      </div>`
      }${S.bouclePartie ? `<p class="meta">${resumeBoucle()}</p>` : ""}
      <div class="actions"><button class="primary" type="button" data-act="restart">Rejouer l'essai <kbd>Entrée</kbd></button>
      <button type="button" data-act="listen">Écouter ${k("KeyA")}</button>
      ${sortiesEssai()}</div>`;
  } else if (kind === "done") {
    const acc = precision(S.perfect, S.good, S.miss);
    const rank = acc >= 0.95 ? "Virtuose" : acc >= 0.85 ? "Soliste" : acc >= 0.7 ? "Choriste" : "Élève";
    const tag = S.autoUsed
      ? `${S.auto ? "auto-play" : "entraînement"}, score non classé`
      : `${duo ? "duo · " : ""}précision ${Math.round(acc * 100)} %`;
    h = `<p class="eyebrow">${placeName()} · ${TH().unit} n° ${S.seed} · ${tag}</p><h2>${S.auto ? "Écoute terminée" : S.autoUsed ? "Entraînement terminé" : rank}</h2>
      ${
        duo
          ? bilanDuo()
          : `<div class="stats">
        <div><b>${S.score.toLocaleString("fr-CA")}</b><span>Score</span></div>
        <div><b>${S.perfect}</b><span>Parfait</span></div>
        <div><b>${S.good}</b><span>Bien</span></div>
        <div><b>${S.miss}</b><span>Raté</span></div>
        <div><b>${S.maxCombo}</b><span>Combo max</span></div>
      </div>`
      }${S.bouclePartie ? `<p class="meta">${resumeBoucle()}</p>` : ""}
      <div class="actions"><button class="primary" type="button" data-act="restart">Jouer <kbd>Entrée</kbd></button>
      <button type="button" data-act="listen">Réécouter ${k("KeyA")}</button>
      <button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button></div>`;
  }
  overlay.innerHTML = h;
  overlay.hidden = false;
}

// Fin d'une partie en duo (#6) : les deux joueurs côte à côte, le meilleur de chaque ligne mis en valeur, puis
// l'exploit commun (les accords à deux mains) et, discrètement, le score total
function bilanDuo() {
  const { L, R } = S.parMain,
    pct = (m: StatsMain) => Math.round(precision(m.perfect, m.good, m.miss) * 100);
  const lignes: [string, number, number, string?][] = [
    ["Score", L.score, R.score],
    ["Précision", pct(L), pct(R), " %"],
    ["Parfait", L.perfect, R.perfect],
    ["Bien", L.good, R.good],
    ["Raté", -L.miss, -R.miss],
    ["Combo max", L.maxCombo, R.maxCombo],
  ];
  // Les ratés sont comptés en négatif pour que le plus grand soit toujours le meilleur
  const cellule = (v: number, autre: number, unite = "") =>
    `<td${v > autre ? ' class="mieux"' : ""}>${Math.abs(v).toLocaleString("fr-CA")}${unite}</td>`;
  const { reussis, total } = S.accordsDuo;
  return `<table class="duo">
        <thead><tr><td></td><th scope="col" class="basse">Basse</th><th scope="col" class="melodie">Mélodie</th></tr></thead>
        <tbody>${lignes
          .map(
            ([nom, l, r, unite]) =>
              `<tr><th scope="row">${nom}</th>${cellule(l, r, unite)}${cellule(r, l, unite)}</tr>`,
          )
          .join("")}</tbody>
      </table>
      <p class="meta">Accords en duo : ${reussis} / ${total}</p>
      <p class="hint">Score total : ${S.score.toLocaleString("fr-CA")}</p>`;
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
