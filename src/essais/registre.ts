/* ---------- Registre des essais ---------- */
// Logique pure (ADR-0007). Un essai fait tomber directement sur une fonctionnalité : une chanson courte où elle
// revient dès les premières mesures, dans l'univers et la difficulté choisis, avec l'autre main en auto-play
// ou un second joueur.
// On l'ouvre par le menu Essais de l'écran titre, ou par l'adresse : ?essai=<id> ou #essai=<id>.
// Chaque issue qui ajoute une fonctionnalité jouable ajoute ici son essai (voir CLAUDE.md, « Mode essai »).
import type { Chanson, Note } from "../chanson/types";
import type { Mains } from "../jeu/etat";
import { accorder, assembler, type Morceau } from "./fabrique";

export interface Essai {
  /** Court, en minuscules avec des tirets : il sert dans l'adresse (?essai=double-saut) */
  id: string;
  titre: string;
  /** Ce que le joueur doit voir ou entendre, affiché pendant l'essai */
  verifier: string;
  /** L'issue de la fonctionnalité, s'il y en a une */
  issue?: number;
  /** Une clé de THEMES (ADR-0006) */
  univers: "ville" | "boite";
  /** Une clé de DIFFS */
  diff: "debutant" | "facile" | "normal" | "difficile";
  /** Les mains jouées : les deux, une seule (l'autre joue toute seule), ou le duo, un joueur par main (#6) */
  mains: Mains;
  /** La scène montre les touches du clavier MIDI, branché ou non (#10) */
  midi?: boolean;
  /** Construit la chanson d'essai, neuve à chaque appel */
  chanson(): Chanson;
  /** Les notes qui portent la fonctionnalité : les tests vérifient qu'elles arrivent tôt et souvent */
  repere(ev: Note): boolean;
  /** Les notes du repère naissent pendant la partie, dans ses variations (ADR-0012) : les tests les cherchent dans
   * les notes de la partie jouée par l'auto-play, dans les quatre mesures qui suivent le solo, qui doit commencer
   * dans les quatre premières mesures */
  variation?: boolean;
}

// Graine fixe (ADR-0005) : la même chanson d'essai à chaque ouverture
const GRAINE = 4242;

// Les sections de la chanson générée, dans les quatre difficultés : intro 0–1, couplet 2–9, refrain 10–17,
// solo 18–21, refrain 22–29, outro 30–31
const INTRO: Morceau = { nom: "Intro", genre: "intro", de: 0, mesures: 2 },
  OUTRO: Morceau = { nom: "Outro", genre: "outro", de: 30, mesures: 2 };
const couplet = (de: number, mesures: number): Morceau => ({ nom: "Couplet", genre: "couplet", de, mesures }),
  refrain = (de: number, mesures: number): Morceau => ({ nom: "Refrain", genre: "refrain", de, mesures });

export const ESSAIS: Essai[] = [
  {
    id: "double-saut",
    titre: "Double saut",
    verifier:
      "Un haut obstacle à chaque mesure : saute, puis saute encore en l'air. Le second saut monte plus haut et joue la quinte au-dessus de l'octave.",
    issue: 7,
    univers: "ville",
    diff: "normal",
    mains: "L",
    chanson: () => assembler(GRAINE, "normal", [INTRO, couplet(2, 8), OUTRO], { couplet: ["S.WD..W.", "T--.WD.."] }),
    repere: (ev) => ev.hand === "L" && ev.lane === 2,
  },
  {
    id: "ecrasement",
    titre: "Écrasement",
    verifier:
      "Avant chaque refrain, la musique se tait un temps ; écrase la plaque (Espace) : la fondamentale accentuée, la cymbale et un grave qui tombe relancent le refrain.",
    issue: 8,
    univers: "ville",
    diff: "normal",
    mains: "L",
    chanson: () =>
      assembler(GRAINE, "normal", [
        INTRO,
        refrain(10, 2),
        couplet(2, 2),
        refrain(12, 2),
        couplet(4, 2),
        refrain(14, 2),
        couplet(6, 2),
        refrain(16, 2),
        OUTRO,
      ]),
    repere: (ev) => ev.hand === "L" && ev.lane === 3,
  },
  {
    id: "tunnel",
    titre: "Tunnels",
    verifier:
      "Un tunnel à chaque mesure : garde la glissade enfoncée jusqu'au bout. La basse tient sa note ; lâcher trop tôt la coupe.",
    univers: "boite",
    diff: "normal",
    mains: "L",
    chanson: () => assembler(GRAINE, "normal", [INTRO, couplet(2, 8), OUTRO], { couplet: ["T------.", "T--.W..."] }),
    repere: (ev) => ev.hand === "L" && ev.lane === 0 && ev.dur > 0,
  },
  {
    id: "accords",
    titre: "Accords à deux mains",
    verifier:
      "Au premier temps de chaque mesure, deux ennemis reliés et un pointillé vers l'obstacle : joue les deux mains ensemble pour le bonus d'accord.",
    univers: "boite",
    diff: "facile",
    mains: "both",
    chanson: () => accorder(assembler(GRAINE, "facile", [INTRO, couplet(2, 4), refrain(10, 4), OUTRO])),
    repere: (ev) => !!ev.grp && ev.grp.some((e) => e.hand === "L") && ev.grp.filter((e) => e.hand === "R").length > 1,
  },
  {
    id: "vibrato",
    titre: "Vibrato",
    verifier:
      "Des ennemis allongés à chaque mesure : tiens la note, puis tapote une autre touche. La note ondule (vibrato), l'ennemi aussi, et « Vibrato +20 » s'affiche, cinq fois au plus par note. Sans tapoter, la note tenue reste réussie.",
    issue: 17,
    univers: "ville",
    diff: "normal",
    mains: "R",
    chanson: () =>
      assembler(
        GRAINE,
        "normal",
        [INTRO, couplet(2, 4), refrain(10, 4), OUTRO],
        {},
        {
          couplet: ["0-----..", "2---1-.."],
          refrain: ["3-----..", "1---2-.."],
        },
      ),
    repere: (ev) => ev.hand === "R" && ev.dur > 0,
  },
  {
    id: "pentes",
    titre: "Pentes",
    verifier:
      "Une pente à la fin de chaque mesure : garde S enfoncé jusqu'en bas. La basse glisse de la fondamentale à l'octave en montant, de l'octave à la fondamentale en descendant ; lâcher trop tôt la coupe.",
    issue: 12,
    univers: "ville",
    diff: "normal",
    mains: "L",
    chanson: () => assembler(GRAINE, "normal", [INTRO, couplet(2, 8), OUTRO], { couplet: ["S...M--.", "S.W.B--."] }),
    repere: (ev) => ev.hand === "L" && ev.fin !== undefined,
  },
  {
    id: "duo",
    titre: "Duo local",
    verifier:
      "À deux sur un clavier : la basse (W S Espace) et la mélodie (J K L ;). Rien ne joue tout seul ; le HUD montre deux scores et deux combos, un raté ne casse que celui de son joueur, l'harmonie baisse pour les deux. Deux accords à deux mains par mesure, comptés sur l'écran de fin.",
    issue: 6,
    univers: "ville",
    diff: "facile",
    mains: "duo",
    // La basse joue sur les temps 1 et 3 de chaque mesure : un accord à deux mains sur chacun
    chanson: () =>
      accorder(
        assembler(GRAINE, "facile", [INTRO, couplet(2, 4), refrain(10, 4), couplet(6, 4), OUTRO], {
          couplet: ["S...W..."],
        }),
        [0, 2],
      ),
    repere: (ev) => !!ev.grp && ev.grp.some((e) => e.hand === "L") && ev.grp.some((e) => e.hand === "R"),
  },
  {
    id: "midi",
    titre: "Clavier MIDI",
    verifier:
      "Branche un clavier MIDI et active-le (Chrome ou Edge, dans deux-mains.html ou le serveur de développement : la page d'artefact bloque les périphériques). Gauche : Do3 glisser, Mi3 écraser, Sol3 sauter ; droite : Do4, Mi4, Sol4, Do5 pour les couloirs. Le bas de la scène indique le clavier détecté ; une touche tenue tient tunnels et ennemis allongés.",
    issue: 10,
    univers: "ville",
    diff: "facile",
    mains: "both",
    midi: true,
    // Une chanson simple aux deux mains : la basse et la mélodie partent ensemble à chaque mesure, comme au piano,
    // avec des notes tenues de chaque côté et la plaque de chaque refrain
    chanson: () =>
      assembler(
        GRAINE,
        "facile",
        [INTRO, couplet(2, 4), refrain(10, 4), couplet(6, 4), OUTRO],
        { couplet: ["S...W...", "T--.W..."], refrain: ["S...W...", "S.W.T--."] },
        { couplet: ["0...1...", "2-..3..."], refrain: ["0.2.1...", "3...2-.."] },
      ),
    repere: (ev) => !!ev.grp && ev.grp.some((e) => e.hand === "L") && ev.grp.some((e) => e.hand === "R"),
  },
  {
    id: "trilles",
    titre: "Trilles",
    verifier:
      "Un ennemi vibre entre deux couloirs voisins à chaque mesure : dès qu'il arrive, alterne vite ses deux touches jusqu'au bout de la bande. Chaque appui joue la note de son couloir ; le compte passe au vert à trois alternances par temps (trille réussie), et chaque alternance en plus rapporte des points. Une autre touche ne la casse pas.",
    issue: 15,
    univers: "boite",
    diff: "normal",
    mains: "R",
    chanson: () =>
      assembler(
        GRAINE,
        "normal",
        [INTRO, couplet(2, 4), refrain(10, 4), OUTRO],
        {},
        {
          couplet: ["1~~~..2.", "2_____.."],
          refrain: ["3~..0~..", "1~~~~~.."],
        },
      ),
    repere: (ev) => ev.hand === "R" && ev.trille !== undefined,
  },
  {
    id: "reprise-solo",
    titre: "Reprise du solo",
    verifier:
      "Le solo libre arrive tout de suite : joue au moins trois notes (J K L ;), une phrase qui finit sur J sonne mieux. Au refrain, « Le refrain reprend ton solo » s'affiche, et les mesures 3–4 et 7–8 du refrain rejouent ta meilleure phrase sur les accords du refrain : ses ennemis portent une étoile. Sans rien jouer au solo, le refrain reste celui de la chanson.",
    issue: 9,
    univers: "boite",
    diff: "facile",
    mains: "R",
    // Une mesure de décompte, le solo, puis le dernier refrain : la phrase revient deux mesures après le solo
    chanson: () =>
      assembler(GRAINE, "facile", [
        { nom: "Intro", genre: "intro", de: 1, mesures: 1 },
        { nom: "Solo libre", genre: "pont", de: 18, mesures: 4 },
        refrain(22, 8),
        OUTRO,
      ]),
    repere: (ev) => ev.hand === "R" && !!ev.reprise,
    variation: true,
  },
];

export const trouverEssai = (id: string) => ESSAIS.find((e) => e.id === id);

/** L'essai demandé par l'adresse de la page, ?essai=<id> ou #essai=<id>, ou null */
export function essaiDemande(search: string, hash: string): string | null {
  for (const partie of [search, hash]) {
    const id = new URLSearchParams(partie.replace(/^[?#]/, "")).get("essai");
    if (id) return id;
  }
  return null;
}
