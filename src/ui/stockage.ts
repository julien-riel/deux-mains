// La sauvegarde dans le stockage du navigateur (ADR-0014) : le seul module qui la lit ou l'écrit. Le stockage peut
// manquer ou refuser (navigation privée, page d'artefact, données effacées) : tout passe par un try/catch, et le jeu
// continue avec la sauvegarde en mémoire. Les réglages, eux, gardent leurs propres clés (ui/reglages.ts).
import { ecrireDocument, lireDocument, retirerUnFantome, sauvegardeVide, type Sauvegarde } from "../sauvegarde/format";

/** La clé de la sauvegarde ; le préfixe sépare le jeu des autres projets de la même origine (GitHub Pages) */
export const CLE = "deux-mains-sauvegarde";
/** Où l'on met de côté une sauvegarde illisible au lieu de l'effacer */
export const CLE_ILLISIBLE = "deux-mains-sauvegarde-illisible";

/**
 * L'état du stockage : `actif`, `indisponible` (il manque ou refuse d'écrire : seul le code de sauvegarde garde la
 * progression), ou `lecture-seule` (il garde la sauvegarde d'une version plus récente du jeu, qu'on ne doit pas
 * écraser).
 */
export type EtatStockage = "actif" | "indisponible" | "lecture-seule";
export const STOCKAGE = { etat: "actif" as EtatStockage };

/** Lit la sauvegarde au démarrage ; une sauvegarde vide si le stockage n'en a pas ou ne répond pas */
export function lireSauvegarde(): Sauvegarde {
  let texte: string | null;
  try {
    texte = localStorage.getItem(CLE);
  } catch {
    STOCKAGE.etat = "indisponible";
    return sauvegardeVide();
  }
  const lecture = lireDocument(texte);
  if (lecture.etat === "illisible")
    try {
      localStorage.setItem(CLE_ILLISIBLE, lecture.brut);
    } catch {
      /* stockage indisponible */
    }
  if (lecture.etat === "plus-recente") STOCKAGE.etat = "lecture-seule";
  return lecture.doc;
}

// Le stockage est plein : le navigateur le dit par une QuotaExceededError (code 22, ou son nom chez Firefox)
const plein = (e: unknown) =>
  e instanceof Error &&
  (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || (e as { code?: number }).code === 22);

/**
 * Range la sauvegarde, et renvoie le document rangé, ou null s'il n'a pas pu l'être. Quand le stockage est plein, les
 * fantômes du meilleur passage (#32) partent un à un, dans l'ordre de `fantomesParAnciennete` (ADR-0014), jusqu'à
 * ce que le document tienne : le document rangé en a alors moins que celui qu'on voulait ranger.
 */
export function ecrireSauvegarde(doc: Sauvegarde): Sauvegarde | null {
  if (STOCKAGE.etat === "lecture-seule") return null;
  for (let essai: Sauvegarde | null = doc; essai; essai = retirerUnFantome(essai))
    try {
      localStorage.setItem(CLE, ecrireDocument(essai));
      STOCKAGE.etat = "actif";
      return essai;
    } catch (e) {
      if (!plein(e)) break;
    }
  STOCKAGE.etat = "indisponible";
  return null;
}
