/* ---------- Sauvegarde : le document ---------- */
// Logique pure (ADR-0007, ADR-0014). La progression du joueur tient dans un seul document JSON versionné, rangé
// sous une seule clé du stockage du navigateur par l'adaptateur `ui/stockage.ts`. Ce module crée, lit, répare et
// migre le document, et y note ce que le joueur gagne. Il ne touche jamais au stockage lui-même.
import { VERSION_GENERATEUR } from "../chanson/generateur";
import { empreinteDe, lirePartition, type Partition } from "../chanson/partition";

/** La version du format. Tout changement du format l'augmente et ajoute une migration à MIGRATIONS.
 * 2 : les compositions (#28, ADR-0016). */
export const VERSION = 2;

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
  /** Les compositions du joueur (#28), par empreinte de leur partition (ADR-0016) ; absent tant qu'il n'y en a pas */
  compositions?: Record<string, Partition>;
}

/** Le nombre de compositions qu'une sauvegarde garde au plus : le code de sauvegarde reste copiable */
export const MAX_COMPOSITIONS = 24;

export const sauvegardeVide = (): Sauvegarde => ({ v: VERSION, carte: {}, chansons: {} });

/**
 * La clé d'une chanson générée : « g » et la version du générateur, la graine, la difficulté (g1:4242:normal).
 * Quand le générateur change (ADR-0005), la clé change avec lui et l'ancien suivi est ignoré. Les chansons écrites
 * à la main ont leur clé « p:empreinte » (`clePartition`).
 */
export const cleChanson = (graine: number, diff: string, version = VERSION_GENERATEUR) =>
  `g${version}:${graine}:${diff}`;

/**
 * La clé d'une chanson écrite à la main (#28, ADR-0016) : « p » et l'empreinte de sa partition. Elle ne dépend pas
 * de la version du générateur : la partition, elle, ne change pas.
 */
export const clePartition = (empreinte: string) => `p:${empreinte}`;

/* ---------- Lecture ---------- */
/** Une migration fait passer un document brut de la version v à la version v + 1 */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
/** Les migrations, par version de départ : MIGRATIONS[1] fera passer un document de la version 1 à la version 2 */
export const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2 : les compositions (#28) arrivent, facultatives ; un document de la version 1 n'en a pas
  1: (doc) => doc,
};

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
  // Une composition illisible est laissée de côté ; les autres sont rangées sous leur empreinte, recalculée
  if (estObjet(brut.compositions))
    for (const brute of Object.values(brut.compositions)) {
      const p = lirePartition(brute);
      if (p) (doc.compositions ??= {})[empreinteDe(p)] = p;
    }
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
 * pour une chanson générée (`graine`), son meilleur score. Une chanson écrite à la main (#28) donne sa clé (`cle`,
 * voir `clePartition`) et pas de lieu : elle garde son meilleur score sans réussir de lieu sur la carte. Renvoie un
 * nouveau document, l'ancien n'est pas touché.
 */
export function noterReussite(
  doc: Sauvegarde,
  r: { univers: string; lieu?: string; graine?: number; diff?: string; cle?: string; score?: number },
): { doc: Sauvegarde; progres: Progres } {
  const avant = lieuxReussis(doc, r.univers),
    nouveau = r.lieu !== undefined && !avant.includes(r.lieu),
    suivant: Sauvegarde = {
      ...doc,
      carte: { ...doc.carte, ...(r.lieu !== undefined && { [r.univers]: nouveau ? [...avant, r.lieu] : avant }) },
      chansons: { ...doc.chansons },
    };
  let record = false;
  const cle = r.cle ?? (r.graine !== undefined ? cleChanson(r.graine, r.diff) : undefined);
  if (cle !== undefined && r.score !== undefined) {
    const ancien = doc.chansons[cle]?.meilleur;
    record = ancien === undefined || r.score > ancien;
    if (record) suivant.chansons[cle] = { meilleur: r.score };
  }
  return { doc: suivant, progres: { lieu: nouveau ? r.lieu : null, record } };
}

/* ---------- Compositions (#28, ADR-0016) ---------- */
/** Les compositions rangées, de la plus ancienne à la plus récente */
export const compositions = (doc: Sauvegarde): Partition[] => Object.values(doc.compositions ?? {});

/**
 * Range une composition, à la place de celle d'empreinte `remplace` (la version d'où vient le brouillon) s'il y en
 * a une. Renvoie le nouveau document, ou null si la sauvegarde en garde déjà le maximum.
 */
export function rangerComposition(doc: Sauvegarde, p: Partition, remplace?: string): Sauvegarde | null {
  const empreinte = empreinteDe(p),
    gardees = Object.entries(doc.compositions ?? {}).filter(([e]) => e !== remplace && e !== empreinte);
  if (gardees.length >= MAX_COMPOSITIONS) return null;
  return { ...doc, compositions: Object.fromEntries([...gardees, [empreinte, p]]) };
}

/** Retire une composition ; son meilleur score reste, sous sa clé, si elle revient */
export function retirerComposition(doc: Sauvegarde, empreinte: string): Sauvegarde {
  const gardees = Object.entries(doc.compositions ?? {}).filter(([e]) => e !== empreinte),
    suivant: Sauvegarde = { ...doc, compositions: Object.fromEntries(gardees) };
  if (!gardees.length) delete suivant.compositions;
  return suivant;
}

/**
 * Réunit deux sauvegardes, par exemple celle du navigateur et un code collé : rien n'est perdu. Les lieux réussis
 * s'additionnent, chaque chanson garde le meilleur des deux scores, et les compositions s'ajoutent les unes aux
 * autres (la même partition, de même empreinte, n'est gardée qu'une fois).
 */
export function fusionner(ici: Sauvegarde, autre: Sauvegarde): Sauvegarde {
  const doc: Sauvegarde = { v: VERSION, carte: {}, chansons: { ...ici.chansons } };
  for (const univers of new Set([...Object.keys(ici.carte), ...Object.keys(autre.carte)]))
    doc.carte[univers] = [...new Set([...lieuxReussis(ici, univers), ...lieuxReussis(autre, univers)])];
  for (const [cle, suivi] of Object.entries(autre.chansons))
    if (!(cle in doc.chansons) || suivi.meilleur > doc.chansons[cle].meilleur) doc.chansons[cle] = { ...suivi };
  if (ici.compositions || autre.compositions) doc.compositions = { ...ici.compositions, ...autre.compositions };
  return doc;
}
