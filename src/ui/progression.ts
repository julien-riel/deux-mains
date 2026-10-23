// La sauvegarde (ADR-0014) : la lire au démarrage, noter une chanson réussie, copier ou coller le code. Pendant un
// essai, tout se passe dans sa progression fictive, en mémoire : un essai n'écrit jamais dans la sauvegarde du
// joueur (#25).
import { LIEUX } from "../jeu/carte";
import { S, cleDesTraces, progression } from "../jeu/etat";
import { decoder, encoder } from "../sauvegarde/code";
import { nouveauFantome, type Fantome } from "../jeu/fantome";
import {
  fantomeDeLaChanson,
  fusionner,
  lieuxReussis,
  noterReussite,
  noterTraces,
  type Sauvegarde,
} from "../sauvegarde/format";
import { ECRAN_CODE, carteDisponible } from "./ecran-carte";
import { show } from "./ecrans";
import { ecrireSauvegarde, lireSauvegarde } from "./stockage";

/** Au démarrage : la progression gardée par le navigateur */
export function chargerSauvegarde() {
  S.sauvegarde = lireSauvegarde();
}

/** La progression qui compte change : celle de l'essai reste en mémoire, celle du joueur est rangée */
export function remplacer(doc: Sauvegarde) {
  if (S.essai) S.essai.sauvegarde = doc;
  // Le stockage plein a pu faire partir des fantômes (#32) : la mémoire suit ce qui a été rangé
  else S.sauvegarde = ecrireSauvegarde(doc) ?? doc;
}

/** Le fantôme du meilleur passage de la chanson en place (#32), sous sa clé (`cleDesTraces`), ou null : ni boss, ni
 * boucle, ni jam n'en ont */
export function fantomeEnJeu(): Fantome | null {
  const cle = cleDesTraces();
  if (cle === null || S.bouclePartie || S.jam) return null;
  return fantomeDeLaChanson(progression(), cle);
}

/**
 * À la fin d'une chanson : si elle est réussie avec un score classé (ni auto-play, ni une seule main, ni ralenti,
 * ni boucle, ni jam), son lieu devient réussi dans l'univers, la chanson garde son meilleur score et les traces de
 * ses notes parfaites (#29), et un nouveau record garde sa partie, que le fantôme rejouera (#32). On écrit ici, une
 * fois par chanson, jamais à chaque image.
 */
export function noterFinDePartie() {
  S.progres = null;
  // Le boss de fin (#26) n'est pas la chanson de sa graine : il n'allume pas son lieu et ne garde pas son score
  // (le noter demandera une nouvelle version du format, ADR-0014)
  if (S.bouclePartie || S.jam || S.autoUsed || S.song.boss || (S.essai && !S.essai.sauvegarde)) return;
  const enr = S.enregistrement,
    cle = cleDesTraces(),
    partition = S.song.source?.genre === "partition",
    // Un score du mode pianiste (#53) ne se compare pas à ceux de la position fixe (ADR-0011) : il n'est pas gardé
    // comme record, ni comme fantôme (le ranger à part demanderait une nouvelle version du format, ADR-0014). Le lieu
    // d'une chanson du jeu et les traces des notes parfaites restent gagnés. Une chanson d'essai n'est pas celle de
    // sa graine : elle ne garde un score, sous la clé de l'essai, que si sa progression fictive en porte déjà un à
    // battre, celui de son fantôme (#32) ; une composition (#28) garde toujours le sien.
    classee = !S.pianiste && (!S.essai || partition || progression().chansons[cle]?.meilleur !== undefined);
  if (partition && !classee) return remplacer(avecTraces(progression()));
  const { doc, progres } = noterReussite(progression(), {
    univers: S.theme,
    // Une composition (#28, ADR-0016) garde son meilleur score sous l'empreinte de sa partition, et ne réussit pas
    // de lieu : la carte se gagne avec les chansons du jeu
    ...(!partition && { lieu: S.song.prog.name }),
    ...(classee && {
      cle,
      score: S.score,
      ...(enr?.finie && { fantome: nouveauFantome(enr, Date.now()) }),
    }),
  });
  remplacer(avecTraces(doc));
  S.progres = progres;
}
// Les traces peintes par les notes parfaites de la partie (#29) rejoignent celles que la chanson garde déjà : celles
// d'un essai, sous sa clé, dans sa progression fictive
function avecTraces(doc: Sauvegarde) {
  const { cle, nouvelles } = S.traces;
  return cle !== null && cle === cleDesTraces() ? noterTraces(doc, cle, nouvelles) : doc;
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
