/* ---------- Écrans ---------- */
import { songNow } from "../audio/moteur";
import { DIFFS } from "../chanson/difficultes";
import { ESSAIS } from "../essais/registre";
import { METRONOME } from "../jeu/calibrage";
import { touchesMidi } from "../jeu/midi";
import { peutReecouter } from "../jeu/reecoute";
import { resultatRemontage } from "../jeu/remontage";
import { S, autoFor, mesureDeLaChanson, passageAt, precision, sectionAtBar, spb, type StatsMain } from "../jeu/etat";
import { CRITERES, conseil } from "../jeu/style";
import { clamp, echapper } from "../outils";
import { LANE_HUE } from "../rendu/outils";
import { TH, placeName } from "../univers/univers";
import { carteDisponible, ecranCarte, ecranSauvegarde, prochainLieu, progresDeFin } from "./ecran-carte";
import { boutonEditeur, ecranEditeur } from "./ecran-editeur";
import { CLAVIER, COMMANDES, KEYLABEL, MIDI, etatMidiLong, etiquettes } from "./touches";

export const overlay = document.querySelector<HTMLElement>("#overlay");
// Pendant un essai, ce qu'il faut vérifier reste écrit sur la scène
const bandeau = document.querySelector<HTMLElement>("#essai-bandeau");

export const k = (c) => `<kbd>${KEYLABEL[c] || c}</kbd>`;
// Les touches du clavier d'ordinateur, même quand la scène montre celles du clavier MIDI
const kc = (c: string) => `<kbd>${CLAVIER[c] || c}</kbd>`;

/* ---------- Clavier MIDI (ADR-0011) ---------- */
// Ce que fait chaque touche de la table : les actions de la basse, les degrés des couloirs (ADR-0003)
const ROLE = {
  glisser: "glisser",
  ecraser: "écraser",
  sauter: "sauter",
  couloir0: "fond.",
  couloir1: "tierce",
  couloir2: "quinte",
  couloir3: "octave",
};
// Le rappel de la table en une ligne : sur l'écran de départ, quand un clavier MIDI est branché
const ligneMidi = (duo: boolean) => {
  const t = touchesMidi(MIDI.separation),
    nom = (i: number) => `<kbd>${t[i].nom}</kbd>`;
  return `<p class="hint">Clavier MIDI · ${duo ? "Basse" : "Gauche"} : ${nom(0)} glisser, ${nom(1)} écraser, ${nom(2)} sauter · ${duo ? "Mélodie" : "Droite"} : ${nom(3)} ${nom(4)} ${nom(5)} ${nom(6)}</p>`;
};
// Le rappel de la table sur un clavier de deux octaves autour de la séparation : les touches de la basse aux
// couleurs de la main gauche, celles des couloirs aux couleurs de leur couloir
function pianoMidi() {
  const sep = MIDI.separation,
    table = touchesMidi(sep),
    blanches: string[] = [],
    noires: string[] = [];
  for (let n = sep - 12; n <= sep + 12; n++) {
    if ([1, 3, 6, 8, 10].includes(n % 12)) {
      noires.push(`<span class="noire" style="--x:${blanches.length}"></span>`);
      continue;
    }
    const t = table.find((t) => t.note === n),
      lane = t ? ["couloir0", "couloir1", "couloir2", "couloir3"].indexOf(t.action) : -1,
      style = lane >= 0 ? ` style="background:hsl(${LANE_HUE[lane]} 80% 70%)"` : "";
    blanches.push(
      t
        ? `<span class="blanche ${lane >= 0 ? "droite" : "gauche"}"${style}><b>${t.nom}</b><small>${ROLE[t.action]}</small></span>`
        : `<span class="blanche"></span>`,
    );
  }
  return `<div class="piano" role="img" aria-label="Touches du clavier MIDI : ${table.map((t) => `${t.nom} ${ROLE[t.action]}`).join(", ")}">${blanches.join("")}${noires.join("")}</div>`;
}
// L'état de l'accès MIDI, et le bouton pour l'activer quand il ne l'est pas encore
const etatMidi = () =>
  `<p class="hint">${etatMidiLong()}</p>${
    MIDI.etat === "inactif" || MIDI.etat === "refuse"
      ? `<div class="actions"><button type="button" data-act="midi">Activer le clavier MIDI</button></div>`
      : ""
  }`;
// Réécouter la partie qui vient de finir (#23), sur l'écran de fin : celle du joueur, ou l'écoute en auto-play
const boutonReecoute = () =>
  peutReecouter()
    ? `<button type="button" data-act="reecouter">Réécouter ${S.auto ? "la" : "ma"} partie <kbd>R</kbd></button>`
    : "";
// Le boss de fin (#26) : le bouton qui y mène depuis la chanson (ou qui revient à la chanson), hors essai
const boutonBoss = () =>
  S.song.boss
    ? `<button type="button" data-act="boss">Retour à la chanson <kbd>B</kbd></button>`
    : `<button type="button" data-act="boss">Affronter le boss <kbd>B</kbd></button>`;
// Le bilan du boss sur l'écran de fin : tombé, ou encore debout, et les phrases du canon rejouées justes
function bilanBoss() {
  const b = S.boss;
  if (!b || S.bouclePartie) return "";
  return `<p class="meta">${TH().boss.nom} : ${b.vaincu !== null ? "vaincu" : `encore debout, ${b.vie} vie${b.vie > 1 ? "s" : ""} sur ${b.max}`} · canon : ${b.reussies} / ${b.total} phrases justes</p>`;
}
// Les boutons de sortie d'un essai, sur ses écrans de départ, de mort et de fin
const sortiesEssai = () =>
  `<button type="button" data-act="essais">Autres essais <kbd>E</kbd></button>
      <button type="button" data-act="quitter-essai">Quitter les essais <kbd>Échap</kbd></button>`;
// La carte du monde (#25) : la Carte de la Ville ou l'Album de la Boîte
const boutonCarte = () =>
  carteDisponible() ? `<button type="button" data-act="carte">${TH().carte.nom} <kbd>C</kbd></button>` : "";
// L'enchaînement (#25) : le prochain lieu à faire sur la carte, après celui de la chanson
const boutonSuivant = () =>
  `<button type="button" data-act="suivant">Suivant : ${TH().places[prochainLieu()]} <kbd>→</kbd></button>`;
// Le remontage (#27) : l'essai du remontage le propose tant qu'il n'est pas fait ; l'écran de départ du lieu qui le
// suit annonce l'harmonie de départ gagnée
export const aRemonter = () => !!S.essai?.essai.remontage && S.depart === null;
function ligneDepart() {
  if (S.depart === null || !S.remontage) return "";
  const { reussis, total } = resultatRemontage(S.remontage),
    R = TH().remontage;
  return `<p class="meta depart">${R.depart} : ${S.depart} · ${reussis} ${R.tours} sur ${total}</p>`;
}
// Le retour à l'éditeur (#28) depuis une composition jouée, ou son ouverture dans l'essai de l'éditeur
const retourEditeur = () => `Retour : ${TH().editeur.nom.toLowerCase()}`;
export function show(kind) {
  const s = S.song,
    D = DIFFS[S.diff],
    essai = S.essai && S.essai.essai,
    // La composition installée (#28), qu'on joue depuis l'éditeur
    compo = s.source?.genre === "partition" ? s.source : null;
  // La durée à la vitesse choisie, qui s'appliquera au départ (#4)
  const len = Math.round((s.totalBars * 4 * 60) / (s.bpm * S.vitesse)),
    boucle = s.sections[S.boucle],
    duo = S.practice === "duo",
    mains =
      S.practice === "L" ? " · main gauche seule" : S.practice === "R" ? " · main droite seule" : duo ? " · duo" : "";
  etiquettes();
  bandeau.hidden = !essai;
  bandeau.textContent = essai ? `Essai · ${essai.titre} — ${essai.verifier}` : "";
  let h = "";
  if (kind === "title" && essai) {
    h = `<p class="eyebrow">Essai · ${TH().label} · ${D.label}${mains}${boucle ? ` · boucle : ${boucle.name}` : ""}</p>
      <h2>${essai.titre}</h2>
      <p class="meta">À vérifier : ${essai.verifier}</p>
      <p class="hint">${s.keyName} · ${s.bpm} BPM · ${len} s</p>
      ${essai.midi ? pianoMidi() + etatMidi() : ""}
      ${ligneDepart()}
      <div class="actions">${
        essai.jam
          ? `<button class="primary" type="button" data-act="jam">Jammer <kbd>Espace</kbd></button>`
          : aRemonter()
            ? `<button class="primary" type="button" data-act="remonter">${TH().remontage.titre} <kbd>Espace</kbd></button>
      <button type="button" data-act="remonter-auto">En auto-play ${k("KeyA")}</button>`
            : `<button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>${
        essai.remontage
          ? `<button type="button" data-act="remonter">Recommencer le remontage <kbd>R</kbd></button>`
          : ""
      }`
      }
      ${essai.partition ? boutonEditeur(retourEditeur()) : ""}${boutonCarte()}${sortiesEssai()}</div>`;
  } else if (kind === "editeur") {
    h = ecranEditeur();
  } else if (kind === "title" && compo) {
    // Une composition (#28) : son titre, et le retour à l'éditeur
    h = `<p class="eyebrow">${TH().label} · ${TH().editeur.nom} · ${D.label}${mains}${S.vitesse < 1 ? ` · vitesse ${Math.round(S.vitesse * 100)} %` : ""}</p>
      <h2>${echapper(compo.titre.trim() || TH().editeur.sansTitre)}</h2>
      <p class="meta">${s.keyName} · ${s.progLabel} · ${s.bpm} BPM · ${len} s</p>
      <div class="actions"><button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>
      ${boutonEditeur(retourEditeur())}
      <button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button></div>`;
  } else if (kind === "carte") {
    h = ecranCarte();
  } else if (kind === "sauvegarde") {
    h = ecranSauvegarde();
  } else if (kind === "essais") {
    h = `<p class="eyebrow">Mode essai</p><h2>Essayer une fonctionnalité</h2>
      <p class="meta">Une chanson courte où elle revient dès les premières mesures.</p>
      <div class="essais">${ESSAIS.map(
        (e, i) =>
          `<button type="button" data-act="essai" data-essai="${e.id}"><kbd>${i + 1}</kbd><span><b>${e.titre}</b><small>${e.verifier}</small></span></button>`,
      ).join("")}</div>
      <div class="actions"><button type="button" data-act="titre">Retour <kbd>Échap</kbd></button></div>`;
  } else if (kind === "title" && s.boss) {
    h = `<p class="eyebrow">Boss de fin · ${TH().label} · ${TH().unit} n° ${S.seed} · ${D.label}${mains}${S.vitesse < 1 ? ` · vitesse ${Math.round(S.vitesse * 100)} %` : ""}${boucle ? ` · boucle : ${boucle.name}` : ""}</p>
      <h2>${placeName()}</h2>
      <p class="meta">Il joue une phrase : rejoue-la une mesure plus tard, pendant qu'il enchaîne la suivante. Chaque phrase juste lui retire une vie ; trois phases, de plus en plus serrées.</p>
      <p class="hint">${s.keyName} · ${s.bpm} BPM · ${len} s · ${s.boss.vie} vies</p>
      <div class="actions"><button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>
      ${boutonBoss()}
      <button type="button" data-act="essais">Essais <kbd>E</kbd></button></div>`;
  } else if (kind === "title") {
    h = `<p class="eyebrow">${TH().label} · ${TH().unit} n° ${S.seed} · ${D.label}${mains}${S.vitesse < 1 ? ` · vitesse ${Math.round(S.vitesse * 100)} %` : ""}${boucle ? ` · boucle : ${boucle.name}` : ""}</p>
      <h2>${placeName()}</h2>
      <p class="meta">${s.keyName} · ${s.progLabel} · ${s.bpm} BPM · ${len} s</p>
      ${ligneDepart()}
      <div class="actions"><button class="primary" type="button" data-act="start">Jouer <kbd>Espace</kbd></button>
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>
      <button type="button" data-act="jam">Jam ${kc("KeyJ")}</button>
      ${boutonCarte()}
      ${boutonBoss()}
      ${boutonEditeur()}
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
          : `<p class="hint">${duo ? "Basse" : "Gauche"} ${kc("KeyW")} ${kc("KeyS")} ${kc("Space")} · ${duo ? "Mélodie" : "Droite"} ${kc("KeyJ")} ${kc("KeyK")} ${kc("KeyL")} ${kc("Semicolon")}</p>`
      }${MIDI.etat === "connecte" ? ligneMidi(duo) : ""}`;
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
  } else if (kind === "pause" && S.relecture) {
    h = `<p class="eyebrow">Pause · réécoute</p><h2>La réécoute attend</h2>
      <div class="actions"><button class="primary" type="button" data-act="continue">Continuer <kbd>Échap</kbd></button>
      <button type="button" data-act="quitter-reecoute">Quitter la réécoute <kbd>Entrée</kbd></button></div>`;
  } else if (kind === "pause" && S.jam) {
    h = `<p class="eyebrow">Pause · jam</p><h2>La jam attend</h2>
      <div class="actions"><button class="primary" type="button" data-act="continue">Continuer <kbd>Espace</kbd></button>
      <button type="button" data-act="quitter-jam">Quitter la jam <kbd>Échap</kbd></button></div>`;
  } else if (kind === "pause") {
    h = `<p class="eyebrow">Pause</p><h2>La chanson attend</h2>
      <div class="actions"><button class="primary" type="button" data-act="continue">Continuer <kbd>Échap</kbd></button>
      <button type="button" data-act="restart">Recommencer <kbd>Entrée</kbd></button>${
        S.bouclePartie ? `<button type="button" data-act="quitter-boucle">Quitter la boucle <kbd>B</kbd></button>` : ""
      }</div>`;
  } else if (kind === "dead") {
    const bar = clamp(mesureDeLaChanson(Math.floor(S.deathBeat / 4)), 0, s.totalBars - 1),
      sec = sectionAtBar(bar);
    const where = S.cp?.sec.boss
      ? `à la phase ${S.cp.sec.boss}`
      : S.cp?.sec.croisee
        ? "aux mains croisées"
        : {
            intro: "au début",
            couplet: "au couplet",
            refrain: "au refrain",
            pont: "au solo",
            polyrythmie: "au 3 contre 2",
            outro: "à l'outro",
          }[S.cp ? S.cp.sec.kind : "intro"];
    h = `<p class="eyebrow">${TH().deadTag}</p><h2>${TH().deadTitle}</h2>
      <p class="meta">Mesure ${bar + 1} sur ${s.totalBars}, pendant : ${sec.name}.</p>
      <div class="actions"><button class="primary" type="button" data-act="resume">Reprendre ${where} <kbd>R</kbd></button>
      <button type="button" data-act="restart">Recommencer <kbd>Entrée</kbd></button>
      ${compo ? boutonEditeur(retourEditeur()) : ""}${essai ? sortiesEssai() : `${boutonCarte()}<button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button>`}</div>`;
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
      }${bilanBoss()}${bilanStyle()}${S.bouclePartie ? `<p class="meta">${resumeBoucle()}</p>` : ""}${progresDeFin()}
      <div class="actions"><button class="primary" type="button" data-act="restart">Rejouer l'essai <kbd>Entrée</kbd></button>
      ${boutonReecoute()}
      <button type="button" data-act="listen">Écouter ${k("KeyA")}</button>
      ${compo ? boutonEditeur(retourEditeur()) : ""}${boutonCarte()}${sortiesEssai()}</div>`;
  } else if (kind === "done") {
    const acc = precision(S.perfect, S.good, S.miss);
    const rank = acc >= 0.95 ? "Virtuose" : acc >= 0.85 ? "Soliste" : acc >= 0.7 ? "Choriste" : "Élève";
    const tag = S.autoUsed
      ? `${S.auto ? "auto-play" : "entraînement"}, score non classé`
      : `${duo ? "duo · " : ""}précision ${Math.round(acc * 100)} %`;
    const ou = compo
      ? `${TH().editeur.nom} · ${echapper(compo.titre.trim() || TH().editeur.sansTitre)}`
      : `${placeName()} · ${TH().unit} n° ${S.seed}`;
    h = `<p class="eyebrow">${ou} · ${tag}</p><h2>${S.auto ? "Écoute terminée" : S.autoUsed ? "Entraînement terminé" : rank}</h2>
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
      }${bilanBoss()}${bilanStyle()}${S.bouclePartie ? `<p class="meta">${resumeBoucle()}</p>` : ""}${progresDeFin()}
      <div class="actions"><button class="primary" type="button" data-act="restart">Jouer <kbd>Entrée</kbd></button>
      ${boutonReecoute()}
      <button type="button" data-act="listen">Écouter en auto-play ${k("KeyA")}</button>
      ${compo ? boutonEditeur(retourEditeur()) : `${boutonSuivant()}${boutonBoss()}`}${boutonCarte()}
      <button type="button" data-act="new">Nouvelle chanson <kbd>N</kbd></button></div>`;
  }
  overlay.innerHTML = h;
  overlay.hidden = false;
}

// Fin d'une partie en duo (#6) : les deux joueurs côte à côte, le meilleur de chaque ligne mis en valeur, puis
// les exploits communs (les accords à deux mains, les relais de #20) et, discrètement, le score total
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
      <p class="meta">Accords en duo : ${reussis} / ${total}${
        S.relais.total ? ` · relais passés : ${S.relais.reussis} / ${S.relais.total}` : ""
      }</p>
      <p class="hint">Score total : ${S.score.toLocaleString("fr-CA")}</p>`;
}

// La note de style du solo (#22) : chaque critère avec ses étoiles et ce qu'il demande, puis le conseil pour le
// plus faible. Celle de l'auto-play n'a pas de conseil ; en duo, c'est celle du joueur de la mélodie.
function bilanStyle() {
  const style = S.reprise.style;
  if (!style || S.bouclePartie) return "";
  const bot = autoFor("R");
  const criteres = CRITERES.map(({ cle, nom, explication }) => {
    const n = style[cle];
    return `<div><b aria-label="${n} étoile${n > 1 ? "s" : ""} sur 3">${"★".repeat(n)}<i>${"☆".repeat(3 - n)}</i></b><span>${nom}</span><small>${explication}</small></div>`;
  }).join("");
  return `<section class="style-solo">
        <p class="eyebrow">${bot ? "Style de l'auto-play au solo" : S.practice === "duo" ? "Style du solo · mélodie" : "Style du solo"}</p>
        <div class="criteres">${criteres}</div>${bot ? "" : `<p class="hint">${conseil(style)}</p>`}
      </section>`;
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
