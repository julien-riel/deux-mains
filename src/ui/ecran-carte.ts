// Les écrans de la carte du monde (#25) et du code de sauvegarde (ADR-0014). Mêmes lieux et même progression dans
// les deux univers ; seul l'habillage change (ADR-0006) : les quartiers de la Ville s'allument sur la carte, les
// souvenirs de la Boîte révèlent leur illustration dans l'album. Les illustrations sont des esquisses provisoires.
import { LIEUX, graineDuLieu, lieuSuivant } from "../jeu/carte";
import { S, progression } from "../jeu/etat";
import { NOMS_SCENES, sceneDuLieu, type IdScene } from "../jeu/scenes";
import { encoder } from "../sauvegarde/code";
import { lieuxReussis, meilleurScore } from "../sauvegarde/format";
import { TH } from "../univers/univers";
import { STOCKAGE } from "./stockage";

/** Le message de l'écran du code, après une copie ou un code collé */
export const ECRAN_CODE = { message: "" };

/** La carte s'ouvre hors des essais, et dans un essai qui a sa progression fictive */
export const carteDisponible = () => !S.essai || !!S.essai.sauvegarde;
/** Le lieu qui suit la chanson en cours sur la carte : le prochain encore à faire */
export const prochainLieu = () => lieuSuivant(lieuxReussis(progression(), S.theme), S.song.prog.name);

/* ---------- Esquisses ---------- */
// Une fenêtre de la Ville : allumée (un habitant réveillé) ou éteinte
const fenetres = (lit: boolean, cases: [number, number][]) =>
  cases
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="5" fill="${lit ? "#ffd36b" : "#2c2645"}"/>`)
    .join("");
const grille = (x0: number, y0: number, colonnes: number, rangees: number, dx = 7, dy = 9) =>
  Array.from({ length: colonnes * rangees }, (_, i) => [
    x0 + (i % colonnes) * dx,
    y0 + Math.floor(i / colonnes) * dy,
  ]) as [number, number][];
const BATI = "#3a3256";

// Les quartiers, un par progression : leurs silhouettes, et leurs fenêtres
const QUARTIERS: Record<string, (lit: boolean) => string> = {
  "I–V–vi–IV": (lit) =>
    `<rect x="18" y="18" width="24" height="62" fill="${BATI}"/><rect x="48" y="8" width="26" height="72" fill="${BATI}"/><rect x="80" y="28" width="22" height="52" fill="${BATI}"/>` +
    fenetres(lit, [...grille(22, 24, 3, 6), ...grille(52, 14, 3, 7), ...grille(84, 34, 2, 5)]),
  "vi–IV–I–V": (lit) =>
    [10, 38, 66, 94]
      .map((x) => `<path d="M${x} 52 L${x + 12} 40 L${x + 24} 52 V80 H${x} Z" fill="${BATI}"/>`)
      .join("") +
    `<path d="M22 44 Q50 54 78 44" stroke="#8a80b0" fill="none"/><rect x="34" y="47" width="5" height="6" fill="#8a80b0"/><rect x="56" y="48" width="5" height="6" fill="#8a80b0"/>` +
    fenetres(lit, [
      ...grille(15, 58, 2, 2, 9),
      ...grille(43, 58, 2, 2, 9),
      ...grille(71, 58, 2, 2, 9),
      ...grille(99, 58, 2, 2, 9),
    ]),
  "Royal Road": (lit) =>
    `<rect x="12" y="30" width="34" height="50" fill="${BATI}"/><rect x="70" y="22" width="38" height="58" fill="${BATI}"/>` +
    `<rect x="40" y="12" width="40" height="14" rx="3" fill="none" stroke="${lit ? "#ff5fa2" : "#4a4266"}" stroke-width="2"/>` +
    `<text x="60" y="23" text-anchor="middle" font-size="9" font-family="monospace" fill="${lit ? "#ff9ccc" : "#4a4266"}">NÉON</text>` +
    fenetres(lit, [...grille(17, 36, 4, 5), ...grille(75, 28, 4, 6)]),
  "Vamp dorien": (lit) =>
    [12, 46, 80]
      .map(
        (x, i) =>
          `<rect x="${x}" y="52" width="28" height="28" fill="${BATI}"/><path d="M${x - 3} 52 L${x + 2} 40 H${x + 26} L${x + 31} 52 Z" fill="${["#7a3b5c", "#3b5c7a", "#5c7a3b"][i]}"/>`,
      )
      .join("") +
    `<path d="M6 30 Q60 44 114 30" stroke="#8a80b0" fill="none"/>` +
    [16, 30, 44, 58, 72, 86, 100]
      .map(
        (x) =>
          `<circle cx="${x}" cy="${33 + 6 * Math.sin((x / 114) * Math.PI)}" r="2.2" fill="${lit ? "#ffd36b" : "#2c2645"}"/>`,
      )
      .join(""),
  "Cadence andalouse": (lit) =>
    `<rect x="10" y="44" width="46" height="26" fill="${BATI}"/><path d="M78 70 V16 H104 M86 16 V70" stroke="${BATI}" stroke-width="4" fill="none"/><path d="M104 16 V30" stroke="#8a80b0"/>` +
    `<path d="M0 74 Q10 70 20 74 T40 74 T60 74 T80 74 T100 74 T120 74 V80 H0 Z" fill="#241f3a"/>` +
    fenetres(lit, grille(15, 50, 6, 2)),
  "Canon de Pachelbel": (lit) =>
    `<rect x="26" y="40" width="68" height="40" fill="${BATI}"/><path d="M50 40 L60 6 L70 40 Z" fill="${BATI}"/>` +
    `<circle cx="60" cy="52" r="8" fill="${lit ? "#ffd36b" : "#2c2645"}"/><path d="M52 52 H68 M60 44 V60" stroke="${BATI}" stroke-width="1.5"/>` +
    fenetres(lit, [...grille(32, 64, 2, 1), ...grille(80, 64, 2, 1)]),
  "ii–V–I": (lit) =>
    `<rect x="14" y="26" width="92" height="54" fill="${BATI}"/><rect x="44" y="56" width="32" height="24" fill="#241f3a"/>` +
    `<path d="M40 50 H80 L76 56 H44 Z" fill="${lit ? "#7a3b5c" : "#2c2645"}"/>` +
    `<text x="60" y="44" text-anchor="middle" font-size="10" font-style="italic" font-family="serif" fill="${lit ? "#ffd36b" : "#4a4266"}">Jazz</text>` +
    `<path d="M90 30 q6 -8 2 -14 M96 32 q6 -8 2 -14" stroke="${lit ? "#ffd36b" : "#4a4266"}" fill="none"/>` +
    fenetres(lit, [...grille(20, 32, 2, 4), ...grille(88, 52, 2, 3)]),
  Blues: (lit) =>
    `<rect x="0" y="12" width="120" height="16" fill="${BATI}"/><path d="M0 80 V44 Q60 18 120 44 V80 Z" fill="#241f3a"/>` +
    `<rect x="16" y="50" width="88" height="22" rx="4" fill="${BATI}"/><path d="M0 74 H120" stroke="#8a80b0"/>` +
    `<circle cx="60" cy="20" r="5" fill="${lit ? "#ff5fa2" : "#2c2645"}"/><text x="60" y="23" text-anchor="middle" font-size="7" font-family="monospace" fill="#15112a">M</text>` +
    fenetres(lit, grille(22, 56, 11, 1, 8)),
  "Vamp lydien": (lit) =>
    `<rect x="30" y="46" width="60" height="34" fill="${BATI}"/><path d="M34 46 A26 26 0 0 1 86 46 Z" fill="${BATI}"/>` +
    `<path d="M58 22 L74 10 L78 16 L62 26 Z" fill="${lit ? "#8a80b0" : "#4a4266"}"/>` +
    [18, 30, 96, 104, 112]
      .map((x, i) => `<circle cx="${x}" cy="${[14, 30, 8, 26, 16][i]}" r="1.2" fill="${lit ? "#ffd36b" : "#4a4266"}"/>`)
      .join("") +
    fenetres(lit, [...grille(38, 56, 3, 2, 8), ...grille(70, 56, 2, 2, 8)]),
};

// Un trait de crayon sur le papier de l'album
const TRAIT = `fill="none" stroke="#5b4026" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
// Les souvenirs, un par progression
const SOUVENIRS: Record<string, string> = {
  "I–V–vi–IV": `<path d="M30 66 H90 V50 H30 Z M36 50 V40 H84 V50" ${TRAIT}/><path d="M48 40 V30 M60 40 V28 M72 40 V30" ${TRAIT}/><path d="M48 26 q2 -4 0 -7 M60 24 q2 -4 0 -7 M72 26 q2 -4 0 -7" stroke="#c0602a" fill="none" stroke-width="2"/>`,
  "vi–IV–I–V": `<rect x="34" y="38" width="38" height="28" rx="3" ${TRAIT}/><path d="M46 38 V32 H60 V38 M34 50 H72" ${TRAIT}/><path d="M80 66 L100 20" ${TRAIT}/><path d="M92 26 l8 -6 l2 10" ${TRAIT}/>`,
  "Royal Road": `<circle cx="46" cy="26" r="6" ${TRAIT}/><circle cx="74" cy="26" r="6" ${TRAIT}/><path d="M46 32 V54 L40 70 M46 54 L52 70 M74 32 V54 L68 70 M74 54 L80 70 M46 40 L60 46 L74 40" ${TRAIT}/><path d="M92 20 V34 M92 20 L100 18 V30" ${TRAIT}/>`,
  "Vamp dorien": `<path d="M30 44 Q60 14 90 44 Z" ${TRAIT}/><path d="M60 44 V66 q0 6 -6 4" ${TRAIT}/><path d="M24 20 l-3 8 M40 14 l-3 8 M84 16 l-3 8 M100 24 l-3 8 M30 56 l-3 8 M94 54 l-3 8" stroke="#6f86a0" stroke-width="1.6" stroke-linecap="round"/>`,
  "Cadence andalouse": `<circle cx="34" cy="38" r="12" ${TRAIT}/><circle cx="86" cy="38" r="12" ${TRAIT}/><path d="M28 34 l4 2 M40 34 l-4 2 M80 34 l4 2 M92 34 l-4 2 M30 46 q4 -3 8 0 M82 46 q4 -3 8 0" ${TRAIT}/><path d="M52 30 L60 38 L54 42 L66 52" stroke="#c0602a" fill="none" stroke-width="2.2"/>`,
  "Canon de Pachelbel": `<circle cx="50" cy="44" r="14" ${TRAIT}/><circle cx="70" cy="44" r="14" ${TRAIT}/><path d="M60 22 q-5 -6 -9 -2 q-3 4 9 10 q12 -6 9 -10 q-4 -4 -9 2" stroke="#c0602a" fill="none" stroke-width="1.8"/>`,
  "ii–V–I": `<path d="M30 40 Q38 28 52 34 Q60 38 68 34 Q82 28 90 40 Q82 52 68 46 Q60 42 52 46 Q38 52 30 40 Z" ${TRAIT}/><path d="M40 40 q5 -4 10 0 M70 40 q5 -4 10 0" ${TRAIT}/><path d="M90 40 L100 62" ${TRAIT}/><path d="M30 34 q-8 -10 -2 -18 M34 32 q-2 -12 6 -16" stroke="#c0602a" fill="none" stroke-width="1.8"/>`,
  Blues: `<rect x="26" y="34" width="56" height="22" rx="3" ${TRAIT}/><path d="M82 40 H96 V56 H82 M30 40 H46 V48 H30 Z M52 40 H68 V48 H52 Z" ${TRAIT}/><circle cx="38" cy="60" r="4" ${TRAIT}/><circle cx="70" cy="60" r="4" ${TRAIT}/><path d="M14 66 H106" ${TRAIT}/><path d="M92 34 q2 -8 8 -10 q6 -2 8 -8" stroke="#6f86a0" fill="none" stroke-width="1.8"/>`,
  "Vamp lydien": `<path d="M34 30 Q44 14 60 24 Q76 14 86 30 Q92 44 78 50 Q60 60 42 50 Q28 44 34 30 Z" ${TRAIT}/><path d="M60 50 V68" ${TRAIT}/><path d="M22 18 l3 3 l-3 3 l-3 -3 Z M98 20 l3 3 l-3 3 l-3 -3 Z M104 52 l2 2 l-2 2 l-2 -2 Z" stroke="#c0602a" fill="none" stroke-width="1.6"/><path d="M48 34 q4 -3 8 0 M64 34 q4 -3 8 0" ${TRAIT}/>`,
};

function esquisse(lieu: string, reussi: boolean) {
  const ouvrir = `<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  if (S.theme === "ville")
    return `${ouvrir}<rect width="120" height="80" fill="#15112a"/>${QUARTIERS[lieu](reussi)}</svg>`;
  // Un souvenir à retrouver : un cadre vide sur le papier
  return `${ouvrir}<rect width="120" height="80" fill="${reussi ? "#e9d9b8" : "#3a2d22"}"/>${
    reussi
      ? SOUVENIRS[lieu]
      : `<text x="60" y="50" text-anchor="middle" font-size="26" font-family="serif" fill="#6b5640">?</text>`
  }</svg>`;
}

/* ---------- Scènes (#83, ADR-0019) ---------- */
// Le pictogramme de chaque scène : les couloirs de côté, les colonnes qui tombent, les anneaux du disque, les rails
// qui fuient vers l'horizon
const PICTOGRAMMES: Record<IdScene, string> = {
  cote: "M1 4H13M1 8H13M1 12H13",
  colonnes: "M2 1V13M5.3 1V13M8.7 1V13M12 1V13",
  disque: "M1 7a6 6 0 1 0 12 0a6 6 0 1 0 -12 0ZM4 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z",
  horizon: "M7 2L1 13M7 2L4.5 13M7 2L9.5 13M7 2L13 13M1 13H13",
};
// La scène dans une phrase : « toutes les chansons se jouent sur le disque »
const DANS_LA_SCENE: Record<IdScene, string> = {
  cote: "de côté",
  colonnes: "en colonnes",
  disque: "sur le disque",
  horizon: "vers l'horizon",
};
/** La scène d'un lieu sur la carte : son pictogramme et son nom */
const etiquetteDeScene = (scene: IdScene) =>
  `<em class="scene-lieu" data-scene="${scene}"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="${PICTOGRAMMES[scene]}"/></svg>${NOMS_SCENES[scene]}</em>`;
// Sous la carte : la scène fixée par le réglage passe avant celle des lieux, hors essai
const sceneFixee = () =>
  !S.essai && S.reglageScene !== "lieu"
    ? ` Ton réglage « Scène » les joue toutes ${DANS_LA_SCENE[S.reglageScene]}.`
    : "";

/* ---------- Écrans ---------- */
const kbd = (t: string) => `<kbd>${t}</kbd>`;

/** La carte : les lieux de l'univers et leur état, le prochain à faire mis en avant */
export function ecranCarte() {
  const C = TH().carte,
    reussis = lieuxReussis(progression(), S.theme),
    prochain = LIEUX.find((l) => !reussis.includes(l)),
    diff = S.diff;
  const lieux = LIEUX.map((lieu, i) => {
    const reussi = reussis.includes(lieu),
      record = S.essai ? undefined : meilleurScore(progression(), graineDuLieu(lieu), diff);
    return `<button type="button" class="lieu ${reussi ? "reussi" : "a-faire"}${lieu === prochain ? " prochain" : ""}" data-act="lieu" data-lieu="${lieu}"${S.essai ? " disabled" : ""}>
        ${esquisse(lieu, reussi)}${etiquetteDeScene(sceneDuLieu(lieu))}
        <span><b>${kbd(String(i + 1))} ${TH().places[lieu]}</b><small>${reussi ? C.reussi : C.aFaire}${
          record !== undefined ? ` · record ${record.toLocaleString("fr-CA")}` : ""
        }</small></span></button>`;
  }).join("");
  return `<p class="eyebrow">${TH().label} · ${reussis.length} sur ${LIEUX.length} ${C.reussis}${S.essai ? " · essai, progression fictive" : ""}</p>
      <h2>${C.titre}</h2>
      <div class="carte ${S.theme}">${lieux}</div>
      <p class="hint">${C.effet} Chaque lieu se lit dans sa scène.${sceneFixee()}${S.essai ? " Dans l'essai, la carte se regarde : ta vraie sauvegarde n'est pas touchée." : ""}</p>
      <div class="actions"><button type="button" data-act="sauvegarde">Code de sauvegarde ${kbd("S")}</button>
      <button type="button" data-act="titre">Retour ${kbd("Échap")}</button></div>`;
}

const ETAT_STOCKAGE = {
  actif:
    "La progression est gardée dans ce navigateur. Copie ton code pour la retrouver ailleurs, ou si le navigateur l'efface.",
  indisponible:
    "Ce navigateur ne garde pas la progression (navigation privée, page sans stockage) : copie ton code avant de partir.",
  "lecture-seule":
    "Ce navigateur garde la sauvegarde d'une version plus récente du jeu : elle n'est pas modifiée ici. Ouvre la dernière version pour continuer à la remplir.",
};

/** Le code de sauvegarde : le copier, ou en coller un, qui s'ajoute à la progression */
export function ecranSauvegarde() {
  const code = encoder(progression());
  return `<p class="eyebrow">${TH().label} · code de sauvegarde${S.essai ? " · essai, progression fictive" : ""}</p>
      <h2>Garder sa progression</h2>
      <p class="hint">${S.essai ? "Dans l'essai, le code est celui de la progression fictive : ta vraie sauvegarde n'est pas touchée." : ETAT_STOCKAGE[STOCKAGE.etat]}</p>
      <div class="code">
        <label for="code-sauvegarde">Ton code</label>
        <textarea id="code-sauvegarde" readonly rows="3" spellcheck="false">${code}</textarea>
        <label for="code-colle">Coller un code (il s'ajoute à ta progression, rien n'est perdu)</label>
        <textarea id="code-colle" rows="2" spellcheck="false" placeholder="DM2.…"></textarea>
      </div>
      ${ECRAN_CODE.message ? `<p class="meta" role="status">${ECRAN_CODE.message}</p>` : ""}
      <div class="actions"><button class="primary" type="button" data-act="copier">Copier mon code</button>
      <button type="button" data-act="coller">Charger le code collé</button>
      <button type="button" data-act="carte">Retour ${kbd("Échap")}</button></div>`;
}

/** Sur l'écran de fin : ce que la chanson a changé sur la carte, et un record, dont la partie devient le fantôme
 * (#32). Un essai ne parle de record que s'il en avait un à battre : celui de son fantôme. */
export function progresDeFin() {
  const p = S.progres,
    record = p?.record && (!S.essai || S.fantome);
  if (!p || (!p.lieu && !record)) return "";
  return `<p class="meta progres">${p.lieu ? `${TH().places[p.lieu]} · ${TH().carte.gagne}` : ""}${
    record ? `${p.lieu ? " " : ""}Nouveau record pour cette chanson : ton fantôme rejouera ce passage.` : ""
  }</p>`;
}
