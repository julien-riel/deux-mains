// La sauvegarde (ADR-0014) : la lire au démarrage, noter une chanson réussie, copier ou coller le code. Pendant un
// essai, tout se passe dans sa progression fictive, en mémoire : un essai n'écrit jamais dans la sauvegarde du
// joueur (#25).
import { LIEUX } from "../jeu/carte";
import { S, progression } from "../jeu/etat";
import { decoder, encoder } from "../sauvegarde/code";
import { fusionner, lieuxReussis, noterReussite, type Sauvegarde } from "../sauvegarde/format";
import { ECRAN_CODE, carteDisponible } from "./ecran-carte";
import { show } from "./ecrans";
import { ecrireSauvegarde, lireSauvegarde } from "./stockage";

/** Au démarrage : la progression gardée par le navigateur */
export function chargerSauvegarde() {
  S.sauvegarde = lireSauvegarde();
}

// La progression qui compte change : celle de l'essai reste en mémoire, celle du joueur est rangée
function remplacer(doc: Sauvegarde) {
  if (S.essai) S.essai.sauvegarde = doc;
  else {
    S.sauvegarde = doc;
    ecrireSauvegarde(doc);
  }
}

/**
 * À la fin d'une chanson : si elle est réussie avec un score classé (ni auto-play, ni une seule main, ni ralenti,
 * ni boucle, ni jam), son lieu devient réussi dans l'univers, et une chanson générée garde son meilleur score. On écrit
 * ici, une fois par chanson, jamais à chaque image.
 */
export function noterFinDePartie() {
  S.progres = null;
  if (S.bouclePartie || S.jam || S.autoUsed || (S.essai && !S.essai.sauvegarde)) return;
  const reussite = { univers: S.theme, lieu: S.song.prog.name };
  const { doc, progres } = noterReussite(
    progression(),
    // Une chanson d'essai n'est pas celle de sa graine : elle ne garde pas de score
    S.essai ? reussite : { ...reussite, graine: S.seed, diff: S.diff, score: S.score },
  );
  remplacer(doc);
  S.progres = progres;
}

/* ---------- Code de sauvegarde ---------- */
export function ouvrirSauvegarde() {
  if (!carteDisponible()) return;
  ECRAN_CODE.message = "";
  S.mode = "sauvegarde";
  show("sauvegarde");
}
const dire = (message: string) => {
  ECRAN_CODE.message = message;
  if (S.mode === "sauvegarde") show("sauvegarde");
};

/** Le code de la progression qui compte en ce moment */
export const codeActuel = () => encoder(progression());

/** Copie le code dans le presse-papiers ; s'il refuse, le joueur le sélectionne lui-même dans le champ */
export function copierCode() {
  const manuel = () => dire("Sélectionne le code ci-dessus et copie-le (Ctrl+C, ou un appui long).");
  try {
    navigator.clipboard.writeText(codeActuel()).then(() => dire("Code copié. Garde-le en lieu sûr."), manuel);
  } catch {
    manuel();
  }
}

/** Ajoute à la progression celle d'un code collé ; renvoie vrai s'il a été accepté */
export function collerCode(code: string) {
  const lu = decoder(code);
  if (lu.etat === "invalide") {
    dire("Ce code n'est pas un code de sauvegarde valide : vérifie qu'il est complet.");
    return false;
  }
  if (lu.etat === "plus-recente") {
    dire("Ce code vient d'une version plus récente du jeu : ouvre-le dans la dernière version.");
    return false;
  }
  remplacer(fusionner(progression(), lu.doc));
  const n = lieuxReussis(progression(), S.theme).length;
  dire(`Code chargé : ${n} lieu${n > 1 ? "x" : ""} sur ${LIEUX.length} réussi${n > 1 ? "s" : ""} dans cet univers.`);
  return true;
}
