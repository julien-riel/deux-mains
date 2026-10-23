/* ---------- Sauvegarde : le document ---------- */
// Logique pure (ADR-0007, ADR-0014). La progression du joueur tient dans un seul document JSON versionné, rangé
// sous une seule clé du stockage du navigateur par l'adaptateur `ui/stockage.ts`. Ce module crée, lit, répare et
// migre le document, et y note ce que le joueur gagne. Il ne touche jamais au stockage lui-même.
import { VERSION_GENERATEUR } from "../chanson/generateur";

/** La version du format. Tout changement du format l'augmente et ajoute une migration à MIGRATIONS. */
export const VERSION = 1;

/** Ce que la sauvegarde garde d'une chanson précise, sous sa clé (voir cleChanson) */
export interface SuiviChanson {
  /** Le meilleur score classé : ni auto-play, ni une seule main, ni ralenti, ni boucle */
  meilleur: number;
}

export interface Sauvegarde {
  v: number;
  /** Les lieux réussis de chaque univers (une clé de THEMES), par nom de progression, dans l'ordre de leur réussite */
  carte: Record<string, string[]>;
  /** Ce qui dépend des notes exactes d'une chanson, sous une clé qui porte la version du générateur */
  chansons: Record<string, SuiviChanson>;
}

export const sauvegardeVide = (): Sauvegarde => ({ v: VERSION, carte: {}, chansons: {} });

/**
 * La clé d'une chanson générée : « g » et la version du générateur, la graine, la difficulté (g1:4242:normal).
 * Quand le générateur change (ADR-0005), la clé change avec lui et l'ancien suivi est ignoré. Les chansons écrites
 * à la main (#28) auront leurs clés « p:empreinte ».
 */
export const cleChanson = (graine: number, diff: string, version = VERSION_GENERATEUR) =>
  `g${version}:${graine}:${diff}`;

/* ---------- Lecture ---------- */
/** Une migration fait passer un document brut de la version v à la version v + 1 */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
/** Les migrations, par version de départ : MIGRATIONS[1] fera passer un document de la version 1 à la version 2 */
export const MIGRATIONS: Record<number, Migration> = {};

/**
 * Ce qu'on a trouvé dans le stockage :
 * - `vide` : rien, une première visite ;
 * - `ok` : un document lu, migré au besoin ;
 * - `illisible` : du texte qui n'est pas une sauvegarde ; le jeu repart d'un document vide, et l'adaptateur met
 *   le texte de côté au lieu de l'effacer ;
 * - `plus-recente` : un document d'une version que ce jeu ne connaît pas encore (écrit par un jeu plus récent) ;
 *   le jeu en lit ce qu'il comprend, mais ne doit jamais l'écraser.
 */
export type Lecture =
  { etat: "vide"; doc: Sauvegarde } | { etat: "illisible"; doc: Sauvegarde; brut: string } | LectureObjet;
/** Ce qu'on a trouvé dans un document déjà décodé : il se lit, ou il vient d'une version plus récente */
export type LectureObjet = { etat: "ok"; doc: Sauvegarde } | { etat: "plus-recente"; doc: Sauvegarde; version: number };

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Lit le texte gardé par le stockage (null s'il n'y a rien) */
export function lireDocument(texte: string | null, migrations = MIGRATIONS, version = VERSION): Lecture {
  if (texte === null || texte === "") return { etat: "vide", doc: sauvegardeVide() };
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { etat: "illisible", doc: sauvegardeVide(), brut: texte };
  }
  const lu = lireObjet(brut, migrations, version);
  return lu ?? { etat: "illisible", doc: sauvegardeVide(), brut: texte };
}

/** Lit un document déjà décodé (le stockage ou un code collé) ; null s'il n'a pas la forme d'une sauvegarde */
export function lireObjet(brut: unknown, migrations = MIGRATIONS, version = VERSION): LectureObjet | null {
  if (!estObjet(brut) || !Number.isInteger(brut.v) || (brut.v as number) < 1) return null;
  let doc = brut;
  const v = doc.v as number;
  if (v > version) return { etat: "plus-recente", doc: reparer(doc, version), version: v };
  for (let n = v; n < version; n++) {
    const migrer = migrations[n];
    if (!migrer) return null;
    doc = { ...migrer(doc), v: n + 1 };
  }
  return { etat: "ok", doc: reparer(doc, version) };
}

// Garde ce qui a la bonne forme, laisse tomber le reste : une sauvegarde abîmée en partie reste utilisable
function reparer(brut: Record<string, unknown>, version: number): Sauvegarde {
  const doc: Sauvegarde = { v: version, carte: {}, chansons: {} };
  if (estObjet(brut.carte))
    for (const [univers, lieux] of Object.entries(brut.carte))
      if (Array.isArray(lieux)) doc.carte[univers] = [...new Set(lieux.filter((l) => typeof l === "string"))];
  if (estObjet(brut.chansons))
    for (const [cle, suivi] of Object.entries(brut.chansons))
      if (estObjet(suivi) && Number.isFinite(suivi.meilleur) && (suivi.meilleur as number) >= 0)
        doc.chansons[cle] = { meilleur: suivi.meilleur as number };
  return doc;
}

/** Le texte à ranger dans le stockage */
export const ecrireDocument = (doc: Sauvegarde) => JSON.stringify(doc);

/* ---------- Progression ---------- */
/** Les lieux réussis d'un univers */
export const lieuxReussis = (doc: Sauvegarde, univers: string) => doc.carte[univers] ?? [];

/** Le meilleur score d'une chanson générée, dans la version actuelle du générateur, ou undefined */
export const meilleurScore = (doc: Sauvegarde, graine: number, diff: string) =>
  doc.chansons[cleChanson(graine, diff)]?.meilleur;

/** Ce qu'une chanson réussie a changé : le lieu qu'elle vient d'ajouter à la carte, et un nouveau record */
export interface Progres {
  lieu: string | null;
  record: boolean;
}

/**
 * Note une chanson réussie (finie, score classé) : son lieu, la progression jouée, devient réussi dans l'univers ;
 * pour une chanson générée (`graine`), son meilleur score. Renvoie un nouveau document, l'ancien n'est pas touché.
 */
export function noterReussite(
  doc: Sauvegarde,
  r: { univers: string; lieu: string; graine?: number; diff?: string; score?: number },
): { doc: Sauvegarde; progres: Progres } {
  const avant = lieuxReussis(doc, r.univers),
    nouveau = !avant.includes(r.lieu),
    suivant: Sauvegarde = {
      ...doc,
      carte: { ...doc.carte, [r.univers]: nouveau ? [...avant, r.lieu] : avant },
      chansons: { ...doc.chansons },
    };
  let record = false;
  if (r.graine !== undefined && r.score !== undefined) {
    const cle = cleChanson(r.graine, r.diff),
      ancien = doc.chansons[cle]?.meilleur;
    record = ancien === undefined || r.score > ancien;
    if (record) suivant.chansons[cle] = { meilleur: r.score };
  }
  return { doc: suivant, progres: { lieu: nouveau ? r.lieu : null, record } };
}

/**
 * Réunit deux sauvegardes, par exemple celle du navigateur et un code collé : rien n'est perdu. Les lieux réussis
 * s'additionnent, et chaque chanson garde le meilleur des deux scores.
 */
export function fusionner(ici: Sauvegarde, autre: Sauvegarde): Sauvegarde {
  const doc: Sauvegarde = { v: VERSION, carte: {}, chansons: { ...ici.chansons } };
  for (const univers of new Set([...Object.keys(ici.carte), ...Object.keys(autre.carte)]))
    doc.carte[univers] = [...new Set([...lieuxReussis(ici, univers), ...lieuxReussis(autre, univers)])];
  for (const [cle, suivi] of Object.entries(autre.chansons))
    if (!(cle in doc.chansons) || suivi.meilleur > doc.chansons[cle].meilleur) doc.chansons[cle] = { ...suivi };
  return doc;
}
