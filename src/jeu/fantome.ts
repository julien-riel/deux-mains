/* ---------- Le fantôme du meilleur passage (#32) ---------- */
// Logique pure (ADR-0007). Après un nouveau meilleur score sur une chanson, sa partie est gardée dans la sauvegarde,
// dans l'entrée de la chanson (ADR-0014), au format d'enregistrement des coups de la réécoute (#23). À la partie
// suivante, un fantôme du personnage la rejoue à l'image : il saute, glisse, écrase et tire aux temps des coups
// gardés, et l'écart de score se lit au même temps. La chanson ne change pas (ADR-0005) : les temps des coups
// suffisent, et le fantôme ne repasse pas par le jugement, qui reste celui de la partie du joueur.
import type { Note } from "../chanson/types";
import type { Action, Mains } from "./etat";
import type { Coup, Enregistrement, Resultat } from "./enregistrement";

/** Une partie gardée comme fantôme : ses réglages, ses coups et son score à chaque temps, et quand elle l'a été */
export interface Fantome extends Enregistrement {
  /** Le moment où elle a été gardée, en millisecondes depuis 1970 : les fantômes les plus anciens partent d'abord */
  le: number;
}

/** Le nombre de fantômes qu'une sauvegarde garde au plus : un fantôme pèse de 10 à 40 ko */
export const MAX_FANTOMES = 20;

// Un dix-millième de temps (0,05 ms à 120 BPM) suffit à l'image et allège la sauvegarde
const arrondi = (t: number) => Math.round(t * 1e4) / 1e4;

/** Le fantôme d'une partie finie, gardé au moment `le` : les temps des coups sont arrondis */
export const nouveauFantome = (enr: Enregistrement, le: number): Fantome => ({
  ...enr,
  coups: enr.coups.map((c) => ({ ...c, temps: arrondi(c.temps) })),
  scores: [...enr.scores],
  le,
});

/* ---------- Lecture ---------- */
// Rien de `etat.ts` à l'exécution : la sauvegarde lit les fantômes, et l'état lit la sauvegarde
const ACTIONS: Action[] = ["sauter", "glisser", "ecraser", "couloir0", "couloir1", "couloir2", "couloir3"];
const MAINS: Mains[] = ["both", "L", "R", "duo"];
const RESULTATS: Resultat[] = ["parfait", "bien", "rate"];
const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const fini = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

// Un coup lu, s'il a la bonne forme
function lireCoup(c: unknown): Coup | null {
  if (!estObjet(c) || !fini(c.temps)) return null;
  const temps = c.temps,
    action = c.action as Action;
  switch (c.geste) {
    case "appui":
      if (!ACTIONS.includes(action)) return null;
      return {
        temps,
        geste: "appui",
        action,
        ...(c.tactile === true && { tactile: true as const }),
        // La note jouée en mode pianiste (#53) ; une partie au piano n'a pas de fantôme, mais le format la garde
        ...(Number.isInteger(c.hauteur) && { hauteur: c.hauteur as number }),
        ...(RESULTATS.includes(c.resultat as Resultat) && { resultat: c.resultat as Resultat }),
      };
    case "relache":
      return ACTIONS.includes(action) ? { temps, geste: "relache", action } : null;
    case "auto":
      return typeof c.auto === "boolean" ? { temps, geste: "auto", auto: c.auto } : null;
    case "mains":
      return MAINS.includes(c.mains as Mains) ? { temps, geste: "mains", mains: c.mains as Mains } : null;
    case "pause":
      return { temps, geste: "pause" };
    case "reprise":
      return MAINS.includes(c.mains as Mains) && typeof c.auto === "boolean"
        ? { temps, geste: "reprise", mains: c.mains as Mains, auto: c.auto }
        : null;
    default:
      return null;
  }
}

/**
 * Lit un fantôme de la sauvegarde, ou null s'il n'en a pas la forme. Un coup abîmé est laissé de côté ; des scores
 * abîmés font perdre le fantôme, dont l'écart ne voudrait plus rien dire.
 */
export function lireFantome(brut: unknown): Fantome | null {
  if (!estObjet(brut) || !Array.isArray(brut.coups) || !Array.isArray(brut.scores) || !fini(brut.le)) return null;
  if (!brut.scores.every(fini) || !fini(brut.graine) || typeof brut.difficulte !== "string") return null;
  return {
    graine: brut.graine,
    difficulte: brut.difficulte,
    essai: typeof brut.essai === "string" ? brut.essai : null,
    ...(brut.boss === true && { boss: true as const }),
    mains: MAINS.includes(brut.mains as Mains) ? (brut.mains as Mains) : "both",
    vitesse: fini(brut.vitesse) ? brut.vitesse : 1,
    auto: brut.auto === true,
    coups: brut.coups.map(lireCoup).filter((c) => c !== null),
    scores: brut.scores as number[],
    finie: brut.finie !== false,
    le: brut.le,
  };
}

/* ---------- À l'image ---------- */
/** Un tir du fantôme : son couloir, son temps, et la note qu'il a jugée */
export interface Tir {
  couloir: number;
  temps: number;
  resultat?: Resultat;
}

/**
 * La pose du fantôme à un temps de la partie, dans les mêmes grandeurs que celle du personnage, mais en temps de la
 * chanson : le départ et la durée du saut et du double saut, la fin de la glissade, l'écrasement, et la touche de
 * glissade tenue ; plus ses tirs récents.
 */
export interface Pose {
  jumpAt: number;
  jumpAir: number;
  doubleAt: number;
  doubleAir: number;
  slideUntil: number;
  ecraseAt: number;
  glisse: boolean;
  tirs: Tir[];
}

/** Les tirs du fantôme restent à l'image ce temps-là, en temps de la chanson */
export const DUREE_TIR = 0.3;
const LOIN = -99;
const posePrete = (): Pose => ({
  jumpAt: LOIN,
  jumpAir: 0.8,
  doubleAt: LOIN,
  doubleAir: 0.8,
  slideUntil: LOIN,
  ecraseAt: LOIN,
  glisse: false,
  tirs: [],
});

// La note de la main gauche la plus proche d'un temps, à moins d'un demi-temps : celle que le geste visait
function obstacleProche(notes: Note[], t: number): Note | undefined {
  let proche: Note | undefined;
  for (const ev of notes)
    if (
      ev.hand === "L" &&
      Math.abs(ev.beat - t) < 0.5 &&
      (!proche || Math.abs(ev.beat - t) < Math.abs(proche.beat - t))
    )
      proche = ev;
  return proche;
}

/**
 * La pose du fantôme au temps `nb` : chaque coup gardé jusque-là y joue son geste, comme le jugement l'anime pour le
 * personnage (`leftPress`) : un saut donné en l'air devient un double saut, la durée d'un saut est celle de
 * l'obstacle visé, et en tactile, glisser devant une plaque l'écrase (ADR-0008). Le fantôme n'est pas jugé : ce
 * sont ses gestes qu'on voit, pas ses notes. `notes` : les notes de la chanson.
 */
export function poseDuFantome(f: Fantome, nb: number, notes: Note[]): Pose {
  const p = posePrete();
  for (const c of f.coups) {
    if (c.temps > nb) break;
    const t = c.temps;
    if (c.geste === "reprise") Object.assign(p, posePrete(), { tirs: p.tirs });
    else if (c.geste === "pause") p.glisse = false;
    else if (c.geste === "relache" && c.action === "glisser") p.glisse = false;
    if (c.geste !== "appui") continue;
    if (c.action.startsWith("couloir")) {
      p.tirs.push({ couloir: +c.action.slice(-1), temps: t, ...(c.resultat && { resultat: c.resultat }) });
      continue;
    }
    const proche = obstacleProche(notes, t),
      enLair = p.doubleAt < p.jumpAt && t >= p.jumpAt && t < p.jumpAt + p.jumpAir;
    let lane = c.action === "sauter" ? 1 : c.action === "ecraser" ? 3 : 0;
    if (c.action === "glisser" && c.tactile && proche?.lane === 3) lane = 3;
    if (lane === 1 && proche?.lane === 4) lane = 4;
    else if (lane === 1 && enLair && proche?.lane !== 1) lane = 2;
    const air = proche && proche.lane === lane ? proche.air : 0.8;
    if (lane === 3) {
      p.ecraseAt = t;
      p.jumpAt = p.doubleAt = LOIN;
    } else if (lane === 2) {
      p.doubleAt = t;
      p.doubleAir = air;
    } else if (lane === 1 || lane === 4) {
      p.jumpAt = t;
      p.jumpAir = air;
    } else {
      p.slideUntil = t + 0.55;
      p.jumpAt = p.doubleAt = LOIN;
      p.glisse = true;
    }
  }
  p.tirs = p.tirs.filter((tir) => nb - tir.temps < DUREE_TIR);
  return p;
}

/** Le score du fantôme au temps `nb`, entre ceux du début du temps et du suivant ; au-delà, son dernier score */
export function scoreDuFantome(f: Fantome, nb: number): number {
  const s = f.scores;
  if (!s.length || nb <= 0) return 0;
  const b = Math.floor(nb);
  if (b >= s.length - 1) return s[s.length - 1];
  return s[b] + (s[b + 1] - s[b]) * (nb - b);
}

/** L'avance (positive) ou le retard (négatif) du joueur sur le fantôme, au temps `nb`, arrondi au point */
export const ecartAvecLeFantome = (f: Fantome, nb: number, score: number) => Math.round(score - scoreDuFantome(f, nb));
