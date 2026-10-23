// Les écrans de l'éditeur de partitions (#28, ADR-0016) : la grille, puis les compositions rangées et le code de
// partage. Une seule grille pour les deux univers (ADR-0006, ADR-0015) : la Boîte la montre en cylindre à perforer,
// des picots de laiton sur un tambour, la Ville en console de radio pirate, des touches qui s'allument. Tout texte
// venu du joueur ou d'un code collé (le titre) est échappé.
import { DIFFS } from "../chanson/difficultes";
import { LIMITES, empreinteDe, estSoloLibre, type Partition } from "../chanson/partition";
import { NOTE_FR, PROGS } from "../chanson/theorie";
import { CHOIX_DE_GENRE, LIGNES, choixDe, lireCase, motifsDeLaMesure } from "../jeu/editeur";
import { S, progression, type EditeurEnCours } from "../jeu/etat";
import { echapper } from "../outils";
import { LANE_HUE } from "../rendu/outils";
import { encoderPartition } from "../sauvegarde/code";
import { MAX_COMPOSITIONS, compositions } from "../sauvegarde/format";
import { TH } from "../univers/univers";

const kbd = (t: string) => `<kbd>${t}</kbd>`;
const options = (liste: [string, string][], choisi: string) =>
  liste.map(([v, nom]) => `<option value="${v}"${v === choisi ? " selected" : ""}>${echapper(nom)}</option>`).join("");

/** Le titre d'une partition, ou celui que l'univers donne à une composition sans titre */
export const titreDe = (p: { titre: string }) => p.titre.trim() || TH().editeur.sansTitre;
const nombreDeMesures = (p: Partition) => p.sections.reduce((n, s) => n + s.mesures, 0);

// La couleur d'une ligne : celle de son couloir pour la mélodie, l'ambre de la basse pour sauter et glisser
const teinte = (ligne: number) => {
  const c = LIGNES[ligne].couloir;
  return c === undefined ? "--teinte: var(--bass)" : `--teinte: hsl(${LANE_HUE[c]} 80% 66%)`;
};

/** La grille d'une mesure : une rangée par ligne, une case par signe du motif de sa main */
function mesure(E: EditeurEnCours, i: number) {
  const sec = E.partition.sections[E.section],
    debut = E.partition.sections.slice(0, E.section).reduce((n, s) => n + s.mesures, 0),
    motifs = motifsDeLaMesure(sec, i),
    solo = estSoloLibre(sec),
    nom = TH().editeur.note,
    largeur = Math.max(motifs.basse.length, motifs.melodie.length);
  const division = (main: "L" | "R") => {
    const n = (main === "L" ? motifs.basse : motifs.melodie).length,
      qui = main === "L" ? "basse" : "mélodie";
    if (main === "R" && solo) return `<div class="division"></div>`;
    return `<div class="division"><button type="button" data-act="ed-division" data-mesure="${i}" data-main="${main}" aria-label="Mesure ${debut + i + 1}, ${qui} en ${n === 8 ? "croches : passer en triolets" : "triolets : passer en croches"}">${n === 8 ? "♪♪" : "3"}</button></div>`;
  };
  const rangee = (ligne: number) => {
    const L = LIGNES[ligne],
      motif = L.main === "L" ? motifs.basse : motifs.melodie;
    if (L.main === "R" && solo) return `<div class="rangee solo" style="${teinte(ligne)}"></div>`;
    const cases = [...motif]
      .map((_, k) => {
        const c = lireCase(motif, ligne, k),
          temps = (k * 4) / motif.length,
          sur = Number.isInteger(temps) ? " temps" : "",
          etat =
            c.etat === "note" ? ` note signe-${"SWDPTMB0123abc".indexOf(c.signe)}` : c.etat === "suite" ? " suite" : "";
        return `<button type="button" class="case${sur}${etat}" data-act="ed-case" data-mesure="${i}" data-ligne="${ligne}" data-k="${k}" aria-pressed="${c.etat !== "vide"}" aria-label="Mesure ${debut + i + 1}, ${motif.length === 8 ? "croche" : "triolet"} ${k + 1}, ${L.nom}${c.etat === "note" ? ` : ${nom}` : c.etat === "suite" ? " : tenue" : ""}"></button>`;
      })
      .join("");
    return `<div class="rangee" style="${teinte(ligne)}">${cases}</div>`;
  };
  return `<div class="mesure" style="--n: ${largeur}">
      <div class="numero">${debut + i + 1}</div>
      ${division("R")}${[0, 1, 2, 3].map(rangee).join("")}
      ${division("L")}${[4, 5].map(rangee).join("")}
    </div>`;
}

/** La grille de l'éditeur : réglages de la partition, sections, outils et cylindre */
function grille(E: EditeurEnCours) {
  E.section = Math.min(E.section, E.partition.sections.length - 1);
  const p = E.partition,
    sec = p.sections[E.section],
    T = TH().editeur,
    rangee = E.rangee !== null && E.rangee === empreinteDe(p);
  const sections = p.sections
    .map(
      (s, i) =>
        `<button type="button" role="tab" data-act="ed-section" data-section="${i}" aria-selected="${i === E.section}">${CHOIX_DE_GENRE.find((c) => c.choix === choixDe(s)).nom} <small>${s.mesures}</small></button>`,
    )
    .join("");
  const etiquettes = `<div class="etiquettes" aria-hidden="true">
      <div class="numero">Mesure</div><div class="division">÷</div>
      ${[0, 1, 2, 3].map((l) => `<div class="rangee" style="${teinte(l)}">${LIGNES[l].nom}</div>`).join("")}
      <div class="division">÷</div>
      ${[4, 5].map((l) => `<div class="rangee" style="${teinte(l)}">${LIGNES[l].nom}</div>`).join("")}
    </div>`;
  return `<p class="eyebrow">${TH().label} · ${T.titre}${S.essai ? ` · essai : ${S.essai.essai.titre}, progression fictive` : ""} · ${rangee ? "rangé" : "pas encore rangé"}</p>
    <div class="editeur">
      <label class="titre-compo"><span class="sr">Titre</span><input type="text" data-champ="titre" maxlength="${LIMITES.titre}" value="${echapper(p.titre)}" placeholder="${T.sansTitre}" spellcheck="false" /></label>
      <div class="reglages-compo">
        <label>Progression <select data-champ="prog">${options(
          PROGS.map((x) => [x.name, x.name]),
          p.prog,
        )}</select></label>
        <label>Tonalité <select data-champ="ton">${options(
          NOTE_FR.map((n, i) => [String(i), n]),
          String(p.ton),
        )}</select></label>
        <label>Tempo <input type="number" data-champ="bpm" min="${LIMITES.bpm[0]}" max="${LIMITES.bpm[1]}" step="4" value="${p.bpm}" inputmode="numeric" /> BPM</label>
        <label>Difficulté <select data-champ="diff">${options(
          Object.entries(DIFFS).map(([k, d]) => [k, d.label]),
          p.diff,
        )}</select></label>
      </div>
      <div class="sections-compo" role="tablist" aria-label="Sections">${sections}<button type="button" data-act="ed-ajouter-section">+ Section</button></div>
      <div class="outils-compo">
        <label>Genre <select data-champ="genre">${options(
          CHOIX_DE_GENRE.map((c) => [c.choix, c.nom]),
          choixDe(sec),
        )}</select></label>
        <span class="groupe">Mesures <button type="button" data-act="ed-moins" aria-label="Retirer une mesure">−</button><b>${sec.mesures}</b><button type="button" data-act="ed-plus" aria-label="Ajouter une mesure">+</button></span>
        <span class="groupe"><button type="button" data-act="ed-avant" aria-label="Avancer la section">←</button><button type="button" data-act="ed-apres" aria-label="Reculer la section">→</button></span>
        <button type="button" data-act="ed-retirer-section"${p.sections.length > 1 ? "" : " disabled"}>Retirer la section</button>
        <span class="groupe" role="group" aria-label="Outil">${(
          [
            ["note", T.note[0].toUpperCase() + T.note.slice(1)],
            ["tenue", "Tenue"],
          ] as const
        )
          .map(
            ([o, nom]) =>
              `<button type="button" data-act="ed-outil" data-outil="${o}" aria-pressed="${E.outil === o}">${nom}</button>`,
          )
          .join("")}</span>
      </div>
      <div class="cylindre ${S.theme}">${etiquettes}${Array.from({ length: sec.mesures }, (_, i) => mesure(E, i)).join("")}</div>
      <p class="hint">${T.aide}${estSoloLibre(sec) ? " Au solo libre, la mélodie est à celui qui joue : seule la basse s'écrit." : ""}</p>
    </div>
    ${E.message ? `<p class="meta" role="status">${E.message}</p>` : ""}
    <div class="actions"><button class="primary" type="button" data-act="ed-jouer">Jouer ${kbd("Espace")}</button>
      <button type="button" data-act="ed-ecouter">Écouter ${kbd("A")}</button>
      <button type="button" data-act="ed-ranger">Ranger</button>
      <button type="button" data-act="ed-rangement">${T.rangees} et partage</button>
      <button type="button" data-act="ed-fermer">Retour ${kbd("Échap")}</button></div>`;
}

/** Les compositions rangées, le code de partage du brouillon, et un code à ouvrir */
function rangement(E: EditeurEnCours) {
  const T = TH().editeur,
    liste = compositions(progression());
  const lignes = liste.length
    ? liste
        .map((p) => {
          const e = empreinteDe(p);
          return `<li><span><b>${echapper(titreDe(p))}</b><small>${nombreDeMesures(p)} mesures · ${echapper(p.prog)} · ${p.bpm} BPM · ${DIFFS[p.diff].label}</small></span>
            <button type="button" data-act="ed-ouvrir" data-empreinte="${e}">Ouvrir</button>
            <button type="button" data-act="ed-supprimer" data-empreinte="${e}" aria-label="Retirer ${echapper(titreDe(p))}">Retirer</button></li>`;
        })
        .join("")
    : `<li class="vide">Rien de rangé pour l'instant.</li>`;
  return `<p class="eyebrow">${TH().label} · ${T.rangees} · ${liste.length} sur ${MAX_COMPOSITIONS}${S.essai ? " · essai, progression fictive" : ""}</p>
    <h2>${T.rangees}</h2>
    <ul class="compositions">${lignes}</ul>
    <div class="code">
      <label for="code-partition">Le code de « ${echapper(titreDe(E.partition))} », à partager : il la recrée à l'identique</label>
      <textarea id="code-partition" readonly rows="3" spellcheck="false">${encoderPartition(E.partition)}</textarea>
      <label for="code-partition-colle">Ouvrir un code reçu (il remplace le brouillon)</label>
      <textarea id="code-partition-colle" rows="2" spellcheck="false" placeholder="DMP1.…"></textarea>
    </div>
    ${E.message ? `<p class="meta" role="status">${E.message}</p>` : ""}
    <div class="actions"><button type="button" data-act="ed-copier">Copier le code</button>
      <button type="button" data-act="ed-coller">Ouvrir le code collé</button>
      <button type="button" data-act="ed-nouveau">Nouveau brouillon</button>
      <button class="primary" type="button" data-act="ed-grille">Retour à la grille ${kbd("Échap")}</button></div>`;
}

/** Le bouton qui ouvre l'éditeur, dans les mots de l'univers : « Cylindre » ou « Console » */
export const boutonEditeur = (texte = TH().editeur.nom) =>
  `<button type="button" data-act="editeur">${texte} <kbd>P</kbd></button>`;

/** L'écran de l'éditeur, selon sa vue */
export const ecranEditeur = () => (S.editeur.vue === "rangement" ? rangement(S.editeur) : grille(S.editeur));
