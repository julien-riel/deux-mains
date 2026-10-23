/* ---------- Réécoute de fin de partie (#23) ---------- */
// La chanson ne change pas (ADR-0005) : la réécoute rejoue la partie depuis le début, en refaisant passer chaque
// coup enregistré par le jugement, à son temps. Les notes réussies sonnent au même moment, les ratées manquent,
// la phrase du solo revient au dernier refrain comme dans la partie (ADR-0012), et l'image montre le personnage et
// les tirs. Les mains en auto-play rejouent comme dans la partie : leur improvisation vient de la graine.
//
// Un coup se rejoue un peu avant son temps, pour que sa note soit programmée à l'heure exacte où le joueur l'avait
// fait sonner (ADR-0004) ; avant lui, la partie avance jusqu'à son temps (notes passées, notes tenues finies), dans
// l'ordre où le jeu l'avait jugé.
import { AC, B, heureDuTemps } from "../audio/moteur";
import type { Chanson } from "../chanson/types";
import { appuyer, lacher } from "./actions";
import { finirLesTenues, finish, resetRun, startAt } from "./deroulement";
import { aLHeure } from "./effets";
import {
  coupsDus,
  noter,
  nouvelEnregistrement,
  reglagesDe,
  reprendre,
  type Coup,
  type Enregistrement,
  type Reprise,
} from "./enregistrement";
import { S, spb, type Etat, type Mains } from "./etat";

/** Ce que l'écran de fin montre de la partie : la réécoute le rend tel quel en finissant */
type Bilan = Pick<
  Etat,
  | "score"
  | "perfect"
  | "good"
  | "miss"
  | "maxCombo"
  | "combo"
  | "health"
  | "parMain"
  | "accordsDuo"
  | "auto"
  | "autoUsed"
  | "reprise"
>;
const bilanDe = (s: Etat): Bilan => ({
  score: s.score,
  perfect: s.perfect,
  good: s.good,
  miss: s.miss,
  maxCombo: s.maxCombo,
  combo: s.combo,
  health: s.health,
  parMain: s.parMain,
  accordsDuo: s.accordsDuo,
  auto: s.auto,
  autoUsed: s.autoUsed,
  reprise: s.reprise,
});

/** La réécoute en cours : la partie rejouée, le rang du prochain coup, le temps jusqu'où la partie a avancé (elle
 * n'y revient jamais en arrière), et ce que le jeu retrouve en la quittant */
export interface Relecture {
  enregistrement: Enregistrement;
  suivant: number;
  vu: number;
  avant: { practice: Mains; bilan: Bilan };
}

/** Un coup se rejoue jusqu'à `AVANCE` secondes avant son temps : un peu plus d'une image */
export const AVANCE = 0.02;

// La dernière partie allée au bout de la chanson, et la chanson où elle a été jouée : en mémoire seulement, la
// sauvegarde d'une visite à l'autre reste à décider (#25)
let derniere: { enregistrement: Enregistrement; chanson: Chanson } | null = null;
/** L'enregistrement de la dernière partie finie, ou null */
export const dernierePartie = () => derniere?.enregistrement ?? null;

/** Une partie neuve s'enregistre depuis son départ, sauf en boucle (#5) : elle n'a pas de fin à réécouter */
export function enregistrer() {
  S.enregistrement = S.bouclePartie
    ? null
    : nouvelEnregistrement({
        graine: S.song.seed,
        difficulte: S.diff,
        essai: S.essai?.essai.id ?? null,
        mains: S.practice,
        vitesse: S.vitesse,
        auto: S.auto,
      });
}

/** La partie est allée au bout de la chanson : on la garde pour la réécouter */
export function garderLaPartie() {
  const enr = S.enregistrement;
  if (!enr || S.bouclePartie || S.relecture) return;
  enr.finie = true;
  derniere = { enregistrement: enr, chanson: S.song };
}

/** La dernière partie finie l'a été sur la chanson affichée : l'écran de fin propose de la réécouter */
export const peutReecouter = () => !!derniere && derniere.chanson === S.song && !S.relecture && !S.bouclePartie;

/** Lance la réécoute de la dernière partie, depuis le début de la chanson */
export function reecouter() {
  if (!peutReecouter()) return;
  const enr = derniere.enregistrement,
    bilan = bilanDe(S);
  resetRun();
  S.relecture = { enregistrement: enr, suivant: 0, vu: -Infinity, avant: { practice: S.practice, bilan } };
  S.practice = enr.mains;
  S.auto = enr.auto;
  S.autoUsed = true;
  // La réécoute s'enregistre à son tour : rejouée fidèlement, elle redonne les mêmes coups et les mêmes résultats
  S.enregistrement = nouvelEnregistrement(reglagesDe(enr));
  startAt(0, enr.vitesse);
  S.banner = { text: "Réécoute", sub: "Échap pour la pause", at: performance.now() };
}

/**
 * Rejoue les coups dus au temps `nb` de la partie, en faisant d'abord avancer la partie (`avancer`) jusqu'au temps
 * de chacun. Renvoie le temps jusqu'où la partie doit avancer ensuite : jamais en arrière.
 */
export function rejouer(nb: number, avancer: (nb: number) => void) {
  const r = S.relecture,
    dus = coupsDus(r.enregistrement, r.suivant, nb + AVANCE / spb());
  r.suivant = dus.suivant;
  for (const coup of dus.coups) {
    r.vu = Math.max(r.vu, coup.temps);
    avancer(r.vu);
    if (S.mode !== "play" || S.relecture !== r) return r.vu;
    rejouerCoup(coup);
  }
  return (r.vu = Math.max(r.vu, nb));
}

function rejouerCoup(coup: Coup) {
  const ns = coup.temps * spb();
  aLHeure(heureDuTemps(ns), () => {
    if (coup.geste === "appui") return appuyer(coup.action, ns, coup.tactile);
    if (coup.geste === "relache") return lacher(coup.action, ns);
    if (coup.geste === "reprise") return reprendreIci(coup);
    if (coup.geste === "auto") S.auto = coup.auto;
    else if (coup.geste === "mains") S.practice = coup.mains;
    else {
      finirLesTenues();
      S.keys = {};
    }
    noter(S.enregistrement, { ...coup });
  });
}

// La reprise après une mort, comme `resumeCP` mais sans arrêter la musique : la partie gardée continue avec celle
// d'après la mort. Les notes d'avant la section encore en jeu passent, l'harmonie revient, les combos repartent de
// zéro, et le solo joué avant la mort est oublié s'il n'a pas encore été repris (ADR-0012).
function reprendreIci({ temps: b0, mains, auto }: Reprise) {
  Object.assign(S, {
    health: 100,
    combo: 0,
    keys: {},
    jumpAt: -99,
    doubleAt: -99,
    slideUntil: -99,
    ecraseAt: -99,
    practice: mains,
    auto,
  });
  S.parMain.L.combo = S.parMain.R.combo = 0;
  if (!S.reprise.faite) S.reprise.solo = [];
  const heure = Math.max(AC.currentTime, heureDuTemps(b0 * spb()));
  for (const ev of S.ev)
    if (ev.beat < b0 - 0.01 && (ev.state === "pending" || ev.state === "holding")) {
      ev.voice?.stop(heure);
      ev.state = "skip";
    }
  reprendre(S.enregistrement, b0, mains, auto);
}

/** Quitte la réécoute en cours : la musique s'arrête, et l'écran de fin revient */
export function quitterReecoute() {
  if (!S.relecture) return;
  if (B) {
    B.master.gain.cancelScheduledValues(AC.currentTime);
    B.master.gain.setTargetAtTime(0, AC.currentTime, 0.05);
  }
  if (AC.state === "suspended") AC.resume();
  // Les notes qui n'ont pas été rejouées ne défilent pas derrière l'écran de fin
  Object.assign(S, { ev: [], autoQ: [], beams: [], pops: [], parts: [] });
  finish();
}

/** La réécoute est finie, ou quittée : l'écran de fin retrouve le bilan de la partie et les mains du joueur */
export function finirReecoute() {
  const r = S.relecture;
  if (!r) return;
  S.relecture = null;
  S.practice = r.avant.practice;
  Object.assign(S, r.avant.bilan, { keys: {} });
}

/** Une autre chanson s'installe pendant la réécoute : elle s'arrête sans écran de fin */
export function abandonnerReecoute() {
  if (!S.relecture) return;
  S.practice = S.relecture.avant.practice;
  S.relecture = null;
}

/** Un réglage des mains changé pendant la réécoute est celui que le joueur retrouvera en la quittant */
export function mainsDuJoueur(v: Mains) {
  if (!S.relecture) return false;
  S.relecture.avant.practice = v;
  return true;
}
