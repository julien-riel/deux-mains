/* ---------- Registre des essais ---------- */
// Logique pure (ADR-0007). Un essai fait tomber directement sur une fonctionnalité : une chanson courte où elle
// revient dès les premières mesures, dans l'univers et la difficulté choisis, avec l'autre main en auto-play
// ou un second joueur.
// On l'ouvre par le menu Essais de l'écran titre, ou par l'adresse : ?essai=<id> ou #essai=<id>.
// Chaque issue qui ajoute une fonctionnalité jouable ajoute ici son essai (voir CLAUDE.md, « Mode essai »).
import type { Chanson, Note } from "../chanson/types";
import type { Mains } from "../jeu/etat";
import { NOM_CROISEE, NOM_POLYRYTHMIE, estPetiteNote, progressionDe } from "../chanson/generateur";
import { surLaCroche } from "../chanson/temps";
import { LIEUX } from "../jeu/carte";
import { sauvegardeVide, type Sauvegarde } from "../sauvegarde/format";
import { accorder, assembler, chanter, marcher, polyrythmer, relayer, type Morceau } from "./fabrique";

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
  /** L'essai ouvre la jam (#24) sur sa chanson : aucune note n'y est jouée, et le repère n'en trouve aucune */
  jam?: boolean;
  /** Une progression fictive pour la carte du monde (#25), neuve à chaque ouverture : pendant l'essai, la carte et
   * le décor la montrent, et ce que l'essai gagne s'y ajoute en mémoire, sans jamais toucher la vraie sauvegarde */
  progression?(): Sauvegarde;
  /** L'essai commence par le remontage entre deux lieux (#27, ADR-0015) : son écran de départ le lance (Espace, ou A
   * en auto-play), puis joue sa chanson avec l'harmonie de départ gagnée ; R le recommence. Il ne touche pas à la
   * sauvegarde : le remontage ne vaut que pour la chanson qui le suit. */
  remontage?: boolean;
}

// Graine fixe (ADR-0005) : la même chanson d'essai à chaque ouverture
const GRAINE = 4242;

// Les sections de la chanson générée, dans les quatre difficultés : intro 0–1, couplet 2–9, refrain 10–17,
// solo 18–21, refrain 22–29, puis en Difficile la section en 3 contre 2 (#19) 30–33, et l'outro : les deux
// dernières mesures
const INTRO: Morceau = { nom: "Intro", genre: "intro", de: 0, mesures: 2 },
  OUTRO: Morceau = { nom: "Outro", genre: "outro", de: -2, mesures: 2 };
const couplet = (de: number, mesures: number): Morceau => ({ nom: "Couplet", genre: "couplet", de, mesures }),
  refrain = (de: number, mesures: number): Morceau => ({ nom: "Refrain", genre: "refrain", de, mesures }),
  // Un pont en mains croisées (#21) de quatre mesures, qui recopie la mélodie de la chanson générée à partir de `de`
  pontCroise = (de: number): Morceau => ({ nom: NOM_CROISEE, genre: "pont", de, mesures: 4, croisee: true }),
  // Une section en 3 contre 2 (#19) de quatre mesures, sur les accords de la chanson générée à partir de `de` : sa
  // basse vient des motifs en triolets de Difficile, sa mélodie de `polyrythmer`
  polyrythmie = (de: number): Morceau => ({ nom: NOM_POLYRYTHMIE, genre: "polyrythmie", de, mesures: 4 });

// La progression fictive des essais de la carte (#25) : des lieux déjà réussis, trois dans la Ville et deux dans la
// Boîte, mais jamais celui de la chanson d'essai, qu'on réussit en la jouant
function progressionFictive(): Sauvegarde {
  const autres = LIEUX.filter((l) => l !== progressionDe(GRAINE).name);
  return { ...sauvegardeVide(), carte: { ville: autres.slice(0, 3), boite: autres.slice(1, 3) } };
}

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
  {
    id: "serpent",
    titre: "Serpent",
    verifier:
      "Un serpent traverse deux à quatre couloirs à chaque mesure : tire sur son premier couloir, puis appuie sur le couloir suivant chaque fois qu'il change, sans jamais tout lâcher (les deux touches peuvent se chevaucher). Le son glisse de note en note sans se couper, chaque passage est jugé ; tout lâcher le casse.",
    issue: 16,
    univers: "ville",
    diff: "difficile",
    mains: "R",
    // Des serpents qui montent et descendent, d'une croche ou d'un temps par couloir
    chanson: () =>
      assembler(
        GRAINE,
        "difficile",
        [INTRO, couplet(2, 4), refrain(10, 4), OUTRO],
        {},
        {
          couplet: ["0///..2.", "3-\\-\\-.."],
          refrain: ["1//..0..", "2-\\-\\-.."],
        },
      ),
    repere: (ev) => ev.hand === "R" && ev.serpent !== undefined,
  },
  {
    id: "chanteur",
    titre: "Chanteur",
    verifier:
      "Une mesure sur deux, un chanteur chante quatre notes (écoute : aucun couloir n'est montré), puis quatre silhouettes grises arrivent : rejoue la phrase de mémoire (J K L), au même rythme. Le couloir de chaque silhouette ne se révèle qu'au coup ; un mauvais couloir la rate. Une phrase entièrement juste affiche « Phrase juste ».",
    issue: 18,
    univers: "boite",
    diff: "normal",
    mains: "R",
    // Une mesure de décompte, puis un couplet où un chanteur chante toutes les deux mesures, dès la première
    chanson: () =>
      chanter(
        assembler(GRAINE, "normal", [{ nom: "Intro", genre: "intro", de: 1, mesures: 1 }, couplet(2, 8), OUTRO]),
        "normal",
        [1, 3, 5, 7],
      ),
    repere: (ev) => ev.hand === "R" && !!ev.reponse,
  },
  {
    id: "petites-notes",
    titre: "Petites notes",
    verifier:
      "De petits ennemis entre deux couloirs, sur les croches faibles, dans un halo aux deux couleurs : touche-les avec l'une ou l'autre des deux touches voisines (J ou K, K ou L, L ou ;). Chacun joue une note de la gamme qui n'est pas dans l'accord et mène à la note suivante ; la mélodie ne sonne jamais faux.",
    issue: 14,
    univers: "boite",
    diff: "normal",
    mains: "R",
    // Deux petites notes par mesure, l'une qui monte vers la note suivante, l'autre qui descend ; sur les accords
    // où la gamme n'a pas de note entre deux couloirs, la petite note disparaît
    chanson: () =>
      assembler(
        GRAINE,
        "normal",
        [INTRO, couplet(2, 4), refrain(10, 4), OUTRO],
        {},
        {
          couplet: ["2c3.1b2.", "3c2.0a1."],
          refrain: ["1b2.2c3.", "3c2.1b2."],
        },
      ),
    repere: (ev) => estPetiteNote(ev),
  },
  {
    id: "walking-bass",
    titre: "Walking bass",
    verifier:
      "Chaque mesure finit par un escalier : des marches qui montent (W ↑) ou descendent (S ↓) jusqu'à la fondamentale de l'accord suivant. Sauter monte d'une marche, glisser en descend une ; la basse marche note à note dans la gamme, une marche par temps, et le rail de gauche annonce la marche.",
    issue: 13,
    univers: "ville",
    diff: "difficile",
    mains: "L",
    // Sol mineur, puis Mi♭ et Do mineur en boucle : un escalier d'une marche vers l'accord suivant (en descendant
    // ou en montant), puis un de trois marches de Do mineur à Sol mineur
    chanson: () =>
      marcher(
        assembler(
          GRAINE,
          "difficile",
          [
            INTRO,
            {
              ...couplet(2, 8),
              accords: [
                [0, "m"],
                [8, "M"],
                [5, "m"],
              ],
            },
            OUTRO,
          ],
          { couplet: ["S......."] },
          { couplet: ["0...2...", "1...0..."] },
        ),
        "difficile",
        ["couplet"],
        { couplet: ["S......."] },
      ),
    repere: (ev) => ev.hand === "L" && ev.lane >= 4,
  },
  {
    id: "style-solo",
    titre: "Style du solo",
    verifier:
      "Le solo libre arrive tout de suite, la basse joue toute seule : improvise avec J K L ;. À la fin du solo, la note de style s'affiche en haut de la scène : variété, respiration et résolution, d'une à trois étoiles, un conseil pour le critère le plus faible, et des points de style. Essaie une seule note répétée sans t'arrêter (une étoile en variété et en respiration), puis des phrases séparées d'un temps de silence qui finissent sur J (trois étoiles en résolution). L'écran de fin reprend la note et ses explications.",
    issue: 22,
    univers: "ville",
    diff: "normal",
    mains: "R",
    // Une mesure de décompte, le solo, puis le dernier refrain : la note de style s'affiche à son début
    chanson: () =>
      assembler(GRAINE, "normal", [
        { nom: "Intro", genre: "intro", de: 1, mesures: 1 },
        { nom: "Solo libre", genre: "pont", de: 18, mesures: 4 },
        refrain(22, 8),
        OUTRO,
      ]),
    // La note de style ne fait pas de notes : le repère est la phrase reprise, notée en même temps (ADR-0012)
    repere: (ev) => ev.hand === "R" && !!ev.reprise,
    variation: true,
  },
  {
    id: "relais",
    titre: "Phrases en relais",
    verifier:
      "Les deux mains se passent l'arpège : la mélodie descend de l'octave à la fondamentale (; L K J), puis la basse finit la descente une octave plus bas (W, S ↓, S ↓, S) ; ou la basse monte (S, W ↑, W ↑, W) et la mélodie finit (J K L ;). On entend une seule ligne ; un fil « RELAIS » relie la dernière note d'une main à la première de l'autre, et toute la phrase réussie affiche « Relais + ».",
    issue: 20,
    univers: "ville",
    diff: "normal",
    mains: "both",
    // Le couplet n'est fait que de relais, une phrase sur deux dans chaque sens
    chanson: () =>
      relayer(assembler(GRAINE, "normal", [INTRO, couplet(2, 8), OUTRO]), [
        [2, false],
        [4, true],
        [6, false],
        [8, true],
      ]),
    repere: (ev) => ev.relais !== undefined,
  },
  {
    id: "reecoute",
    titre: "Réécouter sa partie",
    verifier:
      "Une chanson très courte : joue les deux mains, rate quelques notes exprès, et improvise au solo (J K L ;). À l'écran de fin, « Réécouter ma partie » (R) rejoue ta partie : les mêmes notes aux mêmes moments, sans les ratées, le personnage qui saute et les tirs, et ta phrase du solo reprise au refrain. Échap met la réécoute en pause, Entrée la quitte.",
    issue: 23,
    univers: "ville",
    diff: "facile",
    mains: "both",
    // Un couplet, un solo de deux mesures et un refrain de quatre : la phrase du solo revient à ses mesures 3–4
    chanson: () =>
      assembler(GRAINE, "facile", [
        { nom: "Intro", genre: "intro", de: 1, mesures: 1 },
        couplet(2, 2),
        { nom: "Solo libre", genre: "pont", de: 18, mesures: 2 },
        refrain(22, 4),
        { ...OUTRO, mesures: 1 },
      ]),
    // Toutes les notes se réécoutent
    repere: () => true,
  },
  {
    id: "mains-croisees",
    titre: "Mains croisées",
    verifier:
      "Une mesure avant le pont, l'annonce « Mains croisées » ; la scène bascule autour de son milieu : le sol, le personnage et les obstacles passent en haut, les ennemis en bas, et le rail suit ses couloirs. Les touches ne changent pas (S et W pour la basse, J K L ; pour la mélodie), ni les fenêtres de jugement. À la fin du pont, « Retour à l'endroit » et la scène se remet droite. Il y a deux ponts : compare avec l'autre univers dans les réglages.",
    issue: 21,
    univers: "ville",
    diff: "difficile",
    mains: "both",
    // Deux ponts en mains croisées, sur la mélodie du couplet, séparés par deux mesures à l'endroit
    chanson: () => assembler(GRAINE, "difficile", [INTRO, pontCroise(2), couplet(6, 2), pontCroise(10), OUTRO]),
    repere: (ev) => ev.kind === "pont",
  },
  {
    id: "jam",
    titre: "Jam",
    verifier:
      "Ni obstacle ni ennemi : joue librement des deux mains (W, S, Espace ; J K L ;). Chaque touche sonne juste sur l'accord en cours, dont le rail de gauche montre les notes en direct. Après le refrain, la chanson repart au couplet sans s'arrêter, et il n'y a ni score, ni harmonie, ni mort. Échap quitte la jam.",
    issue: 24,
    univers: "boite",
    diff: "normal",
    mains: "both",
    jam: true,
    // Un couplet, un solo et un refrain courts : la jam revient au couplet après une dizaine de mesures
    chanson: () =>
      assembler(GRAINE, "normal", [
        INTRO,
        couplet(2, 4),
        { nom: "Solo libre", genre: "pont", de: 18, mesures: 2 },
        refrain(10, 4),
        OUTRO,
      ]),
    // La jam ne joue aucune note de la chanson
    repere: () => false,
  },
  {
    id: "carte",
    titre: "Carte de la ville",
    verifier:
      "Avec une progression fictive : ouvre la Carte (C), trois quartiers sont rallumés et trois éteints, et au départ des fenêtres sont déjà allumées. Finis la chanson des deux mains, sans auto-play : l'écran de fin annonce que son quartier se rallume, et la carte l'allume. Ta vraie sauvegarde n'est pas touchée.",
    issue: 25,
    univers: "ville",
    diff: "facile",
    mains: "both",
    chanson: () => assembler(GRAINE, "facile", [INTRO, couplet(2, 8), OUTRO]),
    // La carte ne fait pas de notes : le repère est toute la chanson, qu'il faut finir pour rallumer son quartier
    repere: () => true,
    progression: progressionFictive,
  },
  {
    id: "album",
    titre: "Album des souvenirs",
    verifier:
      "Avec une progression fictive : ouvre l'Album (C), deux souvenirs montrent leur illustration et les autres des cadres vides, et au départ leurs photographies pendent au mur du grenier. Finis la chanson des deux mains, sans auto-play : son souvenir rejoint l'album. Ta vraie sauvegarde n'est pas touchée.",
    issue: 25,
    univers: "boite",
    diff: "facile",
    mains: "both",
    chanson: () => assembler(GRAINE, "facile", [INTRO, couplet(2, 8), OUTRO]),
    repere: () => true,
    progression: progressionFictive,
  },
  {
    id: "polyrythmie",
    titre: "3 contre 2",
    verifier:
      "Après l'intro, « 3 contre 2 » : sur les temps 1 et 3, la basse joue trois notes par temps (triolets, W et S) pendant que la mélodie en joue deux (croches), puis trois temps de suite à la dernière mesure. Sur le sol, deux repères et un « 3 » marquent les triolets ; dans le ciel, une ligne par croche. La grosse caisse marque chaque temps. En auto-play, les triolets tombent régulièrement entre les croches, jamais en avance sur elles. Pour apprendre une main à la fois, choisis une seule main dans les réglages.",
    issue: 19,
    univers: "ville",
    diff: "difficile",
    mains: "both",
    // Deux sections en 3 contre 2, séparées par deux mesures de couplet en croches pour sentir la différence
    chanson: () =>
      polyrythmer(
        assembler(GRAINE, "difficile", [INTRO, polyrythmie(10), couplet(2, 2), polyrythmie(14), OUTRO]),
        "difficile",
      ),
    // Les triolets de la basse, hors de la grille des croches
    repere: (ev) => ev.kind === "polyrythmie" && ev.hand === "L" && !surLaCroche(ev.beat),
  },
  {
    id: "remontage-boite",
    titre: "Remonter la clé",
    verifier:
      "Espace lance le remontage : un décompte de quatre clics, puis huit tours de clé en quatre mesures, à la main gauche (W, S ou Espace) puis à la main droite (J, K, L ou ;), tour à tour. Chaque tour réussi fait cliqueter la crémaillère, tourne la clé d'un quart de tour et resserre le ressort ; un tour raté le fait déraper. L'écran de départ annonce le ressort de départ (60 sans aucun tour, 100 avec les huit), et la jauge RESSORT démarre la chanson à ce niveau. A le fait en auto-play (100).",
    issue: 27,
    univers: "boite",
    diff: "normal",
    mains: "both",
    remontage: true,
    chanson: () => assembler(GRAINE, "normal", [INTRO, couplet(2, 8), OUTRO]),
    // Le remontage ne fait pas de notes : le repère est la chanson qu'il précède, qui démarre au ressort gagné
    repere: () => true,
  },
  {
    id: "remontage-ville",
    titre: "Relancer le groupe électrogène",
    verifier:
      "Les mêmes règles que la clé de la Boîte, habillées par la Ville : Espace lance le remontage, la manivelle tourne d'un quart de tour à chaque tour réussi, le moteur tousse et chaque tour rallume une rangée de fenêtres de l'immeuble. L'écran de départ annonce le volume de départ (60 à 100), et la jauge VOLUME DU QUARTIER démarre la chanson à ce niveau. Essaie aussi en duo ou d'une seule main : l'autre main tourne toute seule.",
    issue: 27,
    univers: "ville",
    diff: "normal",
    mains: "both",
    remontage: true,
    chanson: () => assembler(GRAINE, "normal", [INTRO, couplet(2, 8), OUTRO]),
    repere: () => true,
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
