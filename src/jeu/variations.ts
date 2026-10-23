/* ---------- Variations de la partie : la reprise du solo (#9, ADR-0012) ---------- */
// Logique pure (ADR-0007). La graine fait la chanson, qui ne change jamais (ADR-0005) ; la partie garde en plus
// ce qui s'est joué au solo libre. Sa meilleure phrase de deux mesures revient dans une phrase sur deux du
// refrain qui suit le solo, dans les notes de la partie (`S.ev`), comme les passages d'une boucle (ADR-0009).
// L'auto-play improvise à partir de la graine : sa phrase revient aussi, toujours la même.
import { mulberry32 } from "../chanson/aleatoire";
import type { Accord, Note, Section } from "../chanson/types";
import { clamp } from "../outils";
import { S } from "./etat";
import { noterLeStyle, type Style } from "./style";

/** Une note jouée au solo : sa croche depuis le début du solo (ou de la phrase), et son couloir */
export interface NoteDuSolo {
  croche: number;
  couloir: number;
}

/** Ce que la partie garde du solo : les notes jouées, la phrase choisie, sa note de style (#22), et si le choix
 * est fait */
export interface Reprise {
  solo: NoteDuSolo[];
  phrase: NoteDuSolo[] | null;
  style: Style | null;
  faite: boolean;
}
export const repriseNeuve = (): Reprise => ({ solo: [], phrase: null, style: null, faite: false });

/** Les réglages de mélodie de la difficulté qui comptent pour la phrase reprise (voir `DIFFS`) */
export interface ReglagesPhrase {
  max: number;
  odd: number;
  surLesTemps?: boolean;
}

/** En dessous de trois notes au solo, le refrain reste celui du générateur */
export const NOTES_MIN = 3;
/** Une phrase dure deux mesures, soit 16 croches */
const PHRASE = 16;

/** Le solo libre : un pont, sauf le pont en mains croisées (#21), dont la mélodie est écrite */
export const estSolo = (sec: Section) => sec.kind === "pont" && !sec.croisee;

/** Le solo libre dont la phrase revient, et le refrain qui le suit : le dernier refrain de la forme fixe */
export function soloEtRefrain(sections: Section[]): { solo: Section; refrain: Section } | null {
  for (let i = sections.length - 2; i >= 0; i--)
    if (estSolo(sections[i]) && sections[i + 1].kind === "refrain")
      return { solo: sections[i], refrain: sections[i + 1] };
  return null;
}

/** Les temps de début des phrases remplacées : une sur deux, à partir de la deuxième. Seules celles-là peuvent
 * l'être à temps : la première entre à l'écran avant la fin du solo. */
export function phrasesReprises(refrain: Section): number[] {
  const debuts: number[] = [];
  for (let k = 1; 2 * k + 2 <= refrain.bars; k += 2) debuts.push((refrain.start + 2 * k) * 4);
  return debuts;
}

/** Garde une note du solo, recalée sur la croche la plus proche ; une seule note par croche, la première */
export function noter(solo: NoteDuSolo[], croche: number, couloir: number, croches: number) {
  croche = Math.round(croche);
  if (croche < 0 || croche >= croches || solo.some((n) => n.croche === croche)) return;
  solo.push({ croche, couloir });
}

/**
 * L'improvisation de l'auto-play au solo : une note par croche, une fois sur deux à peu près, par degrés voisins.
 * Elle est tirée de la graine (ADR-0012) : la même à chaque partie, pour que sa reprise soit reproductible.
 */
export function improviser(graine: number, croches: number): NoteDuSolo[] {
  const rng = mulberry32(graine * 7919 + 1),
    notes: NoteDuSolo[] = [];
  let couloir = 1;
  for (let croche = 0; croche < croches; croche++) {
    if (rng() >= 0.55) continue;
    const r = rng();
    couloir = clamp(couloir + (r < 0.4 ? -1 : r < 0.8 ? 1 : 0), 0, 3);
    notes.push({ croche, couloir });
  }
  return notes;
}

// Plus une croche tombe sur un temps fort, plus elle compte : premier temps, temps 3, autres temps, contretemps
const force = (croche: number) => (croche % 8 === 0 ? 3 : croche % 4 === 0 ? 2 : croche % 2 === 0 ? 1 : 0);

/**
 * La meilleure phrase de deux mesures du solo, ou null si le solo a moins de `NOTES_MIN` notes. On compare les
 * phrases qui commencent sur une mesure : le plus de notes, puis la variété des couloirs, et un bonus si elle
 * finit sur la fondamentale ; à égalité, la plus récente, celle qu'on a encore en tête. La phrase garde au plus `max` notes de la difficulté, les plus fortes ; elle est
 * recalée sur le temps quand la difficulté ne joue pas à contretemps (Débutant et Facile).
 */
export function meilleurePhrase(solo: NoteDuSolo[], P: ReglagesPhrase, croches: number): NoteDuSolo[] | null {
  const surLeTemps = P.surLesTemps || !P.odd,
    notes = new Map<number, number>();
  for (const n of [...solo].sort((a, b) => a.croche - b.croche)) {
    const c = surLeTemps ? Math.min(croches - 2, 2 * Math.round(n.croche / 2)) : n.croche;
    if (!notes.has(c)) notes.set(c, n.couloir);
  }
  if (notes.size < NOTES_MIN) return null;
  let meilleure: NoteDuSolo[] = null,
    record = -1;
  for (let debut = 0; debut + PHRASE <= croches; debut += 8) {
    const phrase = [...notes]
      .filter(([c]) => c >= debut && c < debut + PHRASE)
      .map(([c, couloir]) => ({ croche: c - debut, couloir }))
      .sort((a, b) => force(b.croche) - force(a.croche) || a.croche - b.croche)
      .slice(0, P.max)
      .sort((a, b) => a.croche - b.croche);
    if (!phrase.length) continue;
    const score =
      2 * phrase.length + new Set(phrase.map((n) => n.couloir)).size + (phrase.at(-1).couloir === 0 ? 2 : 0);
    if (score >= record) [meilleure, record] = [phrase, score];
  }
  return meilleure;
}

const memeTemps = (a: Note, b: Note) => a.beat - b.beat || (a.hand < b.hand ? -1 : 1);

/**
 * Les notes de la partie avec la phrase reprise : dans chaque phrase remplacée du refrain, la mélodie du
 * générateur laisse la place à la phrase, jouée sur les degrés de l'accord de chaque mesure (ADR-0003). Les
 * notes de basse de ces phrases sont copiées, pour relier les nouveaux accords sans toucher à la chanson.
 */
export function reprendre(ev: Note[], chords: Accord[], refrain: Section, phrase: NoteDuSolo[]): Note[] {
  const debuts = phrasesReprises(refrain),
    dedans = (beat: number) => debuts.some((b) => beat >= b - 0.01 && beat < b + PHRASE / 2 - 0.01);
  const neuves: Note[] = ev
    .filter((e) => e.hand === "L" && dedans(e.beat))
    .map((e) => ({ ...e, grp: undefined, passage: undefined }));
  for (const b of debuts)
    for (const n of phrase) {
      const beat = b + n.croche / 2,
        bar = Math.floor(beat / 4),
        ch = chords[bar];
      neuves.push({
        hand: "R",
        beat,
        dur: 0,
        lane: n.couloir,
        bar,
        kind: refrain.kind,
        vel: 1,
        midi: ch.lanes[n.couloir],
        harm: n.couloir < 3 ? ch.lanes[n.couloir + 1] : ch.lanes[1] + 12,
        state: "pending",
        reprise: true,
      });
    }
  neuves.sort(memeTemps);
  // Les notes du même temps forment un accord, comme dans le générateur
  for (let i = 0; i < neuves.length;) {
    let j = i;
    while (j < neuves.length && neuves[j].beat === neuves[i].beat) j++;
    if (j - i > 1) {
      const grp = neuves.slice(i, j);
      grp.forEach((e) => (e.grp = grp));
    }
    i = j;
  }
  return [...ev.filter((e) => !dedans(e.beat)), ...neuves].sort(memeTemps);
}

/* ---------- Dans la partie ---------- */
// Pas de reprise en boucle (ADR-0009) : la section rejouée n'a pas de solo suivi d'un refrain à remplir

/** Une note jouée au solo par une personne ou par l'auto-play, au temps `nb` de la partie */
export function noterAuSolo(sec: Section, nb: number, couloir: number) {
  const cible = soloEtRefrain(S.song.sections);
  if (S.bouclePartie || S.reprise.faite || !cible || cible.solo !== sec) return;
  noter(S.reprise.solo, (nb - sec.start * 4) * 2, couloir, sec.bars * 8);
}

/**
 * À la fin du solo, le note (#22), choisit la phrase et la fait revenir dans les notes de la partie. Renvoie la
 * phrase reprise, ou null (pas encore la fin du solo, déjà fait, en boucle, ou solo trop pauvre).
 */
export function reprendreLeSolo(nb: number, P: ReglagesPhrase): NoteDuSolo[] | null {
  const cible = soloEtRefrain(S.song.sections);
  if (S.bouclePartie || S.reprise.faite || !cible || nb < (cible.solo.start + cible.solo.bars) * 4) return null;
  S.reprise.faite = true;
  S.reprise.style = noterLeStyle(S.reprise.solo);
  const phrase = meilleurePhrase(S.reprise.solo, P, cible.solo.bars * 8);
  S.reprise.phrase = phrase;
  if (phrase) S.ev = reprendre(S.ev, S.song.chords, cible.refrain, phrase);
  return phrase;
}
