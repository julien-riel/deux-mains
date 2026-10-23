/* ---------- Sauvegarde : le code à copier ---------- */
// Logique pure (ADR-0007, ADR-0014). Le code de sauvegarde est le document, en texte qu'on copie et qu'on colle :
// il protège la progression quand le stockage du navigateur est vidé, et la fait passer d'un endroit à l'autre
// (page d'artefact, fichier local, GitHub Pages) ou d'un appareil à l'autre.
//
// Forme : un préfixe, la version du document, un point, puis le JSON du document en UTF-8, encodé en base64url
// (lettres, chiffres, - et _) : « DM1.eyJ2IjoxLC… ». Le même encodage servira aux partitions partagées (#28), avec
// leur propre préfixe.
import { VERSION, lireObjet, type LectureObjet, type Sauvegarde } from "./format";

/** Le préfixe des codes de sauvegarde */
export const PREFIXE = "DM";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Encode du texte en base64url, sans remplissage */
export function base64url(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let s = "";
  for (let i = 0; i < octets.length; i += 3) {
    const n = (octets[i] << 16) | ((octets[i + 1] ?? 0) << 8) | (octets[i + 2] ?? 0),
      reste = Math.min(3, octets.length - i);
    for (let k = 0; k <= reste; k++) s += ALPHABET[(n >> (18 - 6 * k)) & 63];
  }
  return s;
}

/** Décode du base64url ; null si le texte n'en est pas, ou n'est pas de l'UTF-8 valide */
export function depuisBase64url(code: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) return null;
  const octets: number[] = [];
  for (let i = 0; i < code.length; i += 4) {
    const bloc = code.slice(i, i + 4),
      n = [...bloc].reduce((n, c, k) => n | (ALPHABET.indexOf(c) << (18 - 6 * k)), 0);
    for (let k = 0; k < bloc.length - 1; k++) octets.push((n >> (16 - 8 * k)) & 255);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(octets));
  } catch {
    return null;
  }
}

/** Le code d'une sauvegarde, à copier */
export const encoder = (doc: Sauvegarde, prefixe = PREFIXE) => `${prefixe}${doc.v}.${base64url(JSON.stringify(doc))}`;

/**
 * Lit un code collé. Les espaces et les retours à la ligne sont ignorés (un code recopié ou coupé par une
 * messagerie). Le document d'une version ancienne est migré ; celui d'une version plus récente que ce jeu est
 * signalé (`plus-recente`) pour que l'écran le refuse en disant pourquoi ; un code abîmé est `invalide`.
 */
export function decoder(code: string, version = VERSION, prefixe = PREFIXE): LectureObjet | { etat: "invalide" } {
  const m = new RegExp(`^${prefixe}(\\d+)\\.([A-Za-z0-9_-]+)$`).exec(code.replace(/\s+/g, ""));
  const texte = m && depuisBase64url(m[2]);
  if (!texte) return { etat: "invalide" };
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { etat: "invalide" };
  }
  // La version annoncée par le préfixe doit être celle du document : sinon le code a été trafiqué ou abîmé
  if ((brut as { v?: unknown })?.v !== +m[1]) return { etat: "invalide" };
  return lireObjet(brut, undefined, version) ?? { etat: "invalide" };
}
