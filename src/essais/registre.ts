/* ---------- Registre des essais ---------- */
// Logique pure (ADR-0007). Un essai fait tomber directement sur une fonctionnalité : une chanson courte où elle
// revient dès les premières mesures, dans l'univers et la difficulté choisis, avec l'autre main en auto-play.
// On l'ouvre par le menu Essais de l'écran titre, ou par l'adresse : ?essai=<id> ou #essai=<id>.
// Chaque issue qui ajoute une fonctionnalité jouable ajoute ici son essai (voir CLAUDE.md, « Mode essai »).
import type { Chanson, Note } from "../chanson/types";
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
  /** Les mains que joue le joueur : l'autre joue toute seule */
  mains: "both" | "L" | "R";
  /** Construit la chanson d'essai, neuve à chaque appel */
  chanson(): Chanson;
  /** Les notes qui portent la fonctionnalité : les tests vérifient qu'elles arrivent tôt et souvent */
  repere(ev: Note): boolean;
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
