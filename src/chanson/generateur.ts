/* ---------- Générateur de chanson ---------- */
import { clamp } from "../outils";
import { mulberry32 } from "./aleatoire";
import { DIFFS, type ReglagesChanteur, type ReglagesPolyrythmie } from "./difficultes";
import { PAS_PAR_MESURE, enTemps, relierAccords } from "./temps";
import { NOTE_FR, PROGS, dansLAccord, gammeDe, makeChord, notesEntre } from "./theorie";
import type { Accord, Chanson, Chanteur, Genre, Note, Section } from "./types";

// Un motif de 2 mesures (16 croches) : rythme, puis contour en degrés voisins
export function genMotif(rng, P, occ, refrain) {
  for (let tries = 0; tries < 60; tries++) {
    const notes = [];
    let last = -99;
    // Accords à deux mains : une note forcée sur certains temps forts où la basse joue aussi
    const forced = new Set(P.cross.filter((s) => occ[s] && rng() < P.crossP));
    for (let s = 0; s < 16; s++) {
      if (forced.has(s)) {
        notes.push({ s, lane: 0, dur: 0, cross: true });
        last = s;
        continue;
      }
      if (s - last < P.gap) continue;
      if (P.surLesTemps && s % 2) continue;
      let p = s % 2 === 0 ? P.even : P.odd;
      if (s % 4 === 0) p += 0.1;
      if (refrain) p += 0.08;
      if (occ[s]) {
        if (P.avoid === "all") continue;
        if (P.avoid === "mostly" && !(s % 8 === 0 && rng() < 0.3)) continue;
      }
      if (rng() < p) {
        notes.push({ s, lane: 0, dur: 0 });
        last = s;
      }
    }
    if (notes.length < 3 || notes.length > P.max) continue;
    let lane = refrain ? 2 + Math.floor(rng() * 2) : Math.floor(rng() * 3);
    notes.forEach((n, i) => {
      if (i > 0) {
        const r = rng();
        let d = r < 0.35 ? -1 : r < 0.7 ? 1 : r < 0.85 ? 0 : rng() < 0.5 ? -2 : 2;
        if (n.s - notes[i - 1].s === 1 && Math.abs(d) > 1) d = Math.sign(d);
        lane = clamp(lane + d, 0, 3);
      }
      n.lane = lane;
    });
    notes[notes.length - 1].lane = 2; // la question finit sur la quinte
    notes.forEach((n, i) => {
      const next = i < notes.length - 1 ? notes[i + 1].s : 16;
      if (P.holdP && next - n.s >= 4 && rng() < P.holdP) n.dur = Math.min(next - n.s - 2, 4);
      // Une note longue peut devenir une trille (#15), avec le couloir au-dessus ou au-dessous
      if (n.dur > 0 && !n.cross && P.trilleP && rng() < P.trilleP) n.tr = rng() < 0.5 ? 1 : -1;
    });
    // Accords main droite : une deuxième note de l'accord, à deux degrés (fondamentale + quinte…) ou au degré voisin
    notes.forEach((n) => {
      const strong = n.s % 4 === 0;
      if (n.dur > 0 || (P.dyadStrong && (!strong || n.cross))) return;
      if (rng() < P.dyadP * (strong ? 1.5 : 1))
        n.extra = [rng() < 0.6 ? (n.lane <= 1 ? n.lane + 2 : n.lane - 2) : n.lane < 3 ? n.lane + 1 : n.lane - 1];
    });
    return notes;
  }
  return [
    { s: 2, lane: 1, dur: 0 },
    { s: 6, lane: 2, dur: 0 },
    { s: 10, lane: 1, dur: 0 },
    { s: 14, lane: 2, dur: 0 },
  ];
}
/**
 * Les serpents (#16) : dans une phrase, une suite de deux à quatre notes régulières qui montent ou descendent
 * couloir par couloir peut se fondre en un seul serpent, qu'on suit au rayon d'une touche à l'autre. Ses notes
 * gardent leurs temps ; il peut glisser un couloir ou deux plus loin, dans le silence qui suit. Il reste dans sa
 * mesure (un seul accord), son dernier couloir dure un pas, et il laisse au moins une croche avant la note
 * suivante. La dernière note de la phrase, qui la conclut, n'en fait jamais partie, ni les notes tenues, les
 * trilles ou les accords. Renvoie une copie de la phrase ; le hasard n'est tiré que pour une suite qui convient.
 */
export function fondreSerpents(rng, phrase, P) {
  const notes = phrase.map((n) => ({ ...n }));
  for (let i = 0; i < notes.length - 2; i++) {
    const a = notes[i],
      pas = notes[i + 1].s - a.s,
      sens = notes[i + 1].lane - a.lane;
    if (Math.abs(sens) !== 1 || !P.serpentPas.includes(pas)) continue;
    let j = i;
    while (j < i + 3 && j + 1 < notes.length - 1) {
      const n = notes[j + 1];
      if (n.s - notes[j].s !== pas || n.lane - notes[j].lane !== sens || n.cross) break;
      j++;
    }
    const suite = notes.slice(i, j + 1),
      mesure = Math.floor(a.s / 8),
      // Le serpent de nb couloirs tient dans sa mesure et laisse une croche avant la note suivante
      tient = (nb: number) => {
        const fin = a.s + nb * pas;
        return Math.floor((fin - 1) / 8) === mesure && notes[j + 1].s >= fin + 1;
      };
    if (j === i || !tient(j - i + 1) || suite.some((n) => n.dur > 0 || n.extra) || rng() >= P.serpentP) continue;
    // Il peut glisser plus loin, d'un couloir de l'accord à la fois, s'il a la place avant la note suivante
    let nb = j - i + 1;
    const dans = (lane: number) => lane >= 0 && lane <= 3;
    while (nb < 4 && tient(nb + 1) && dans(a.lane + nb * sens) && rng() < P.serpentP) nb++;
    a.sp = { sens, nb, pas };
    a.dur = nb * pas;
    notes.splice(i + 1, j - i);
  }
  return notes;
}
/**
 * Les petites notes (#14, ADR-0010) : sur la croche faible libre juste avant une note sur le temps (dans la même
 * mesure), une petite note peut relier la note d'avant à celle-ci. Elle se place entre le couloir de la note
 * d'arrivée et son voisin du côté de la note d'avant (d'en dessous si les deux notes sont sur le même couloir,
 * d'au-dessus pour la fondamentale) : une petite note mène toujours à une note de l'accord. Elle n'entre ni dans une note tenue,
 * ni dans une trille, ni dans un serpent, ni dans un accord : la note d'avant est une note simple, et celle
 * d'après n'est ni une trille ni un serpent. Sa hauteur dépend de l'accord : elle se calcule note par note
 * (`petiteNote`). Renvoie une copie de la phrase ; le hasard n'est tiré que pour une place qui convient.
 */
export function semerPetitesNotes(rng, phrase, P) {
  const notes = [];
  phrase.forEach((a, i) => {
    notes.push({ ...a });
    const b = phrase[i + 1];
    if (!b) return;
    // Elle vient du côté de la note d'avant ; après la même note, d'en dessous (d'au-dessus pour la fondamentale)
    const s = b.s - 1,
      sens = Math.sign(b.lane - a.lane) || (b.lane > 0 ? 1 : -1);
    if (s % 2 === 0 || s <= a.s || b.s % 8 === 0) return;
    if (a.dur > 0 || a.extra || a.tr || a.sp || b.tr || b.sp) return;
    if (rng() < P.petitesP) notes.push({ s, lane: b.lane - sens / 2, dur: 0, petite: sens });
  });
  return notes;
}
export function vary(rng, m, nMut) {
  const c = m.map((n) => ({ ...n }));
  for (let k = 0; k < nMut && c.length > 1; k++) {
    const i = Math.floor(rng() * (c.length - 1));
    c[i].lane = clamp(c[i].lane + (rng() < 0.5 ? -1 : 1), 0, 3);
  }
  return c;
}
// La réponse se résout sur la fondamentale
export function answer(rng, m, P) {
  const c = vary(rng, m, 1),
    L = c.length;
  c[L - 1].lane = 0;
  if (L > 1 && c[L - 2].lane === 0) c[L - 2].lane = 1;
  c[L - 1].dur = P.holdP > 0 && 16 - c[L - 1].s >= 4 ? Math.min(16 - c[L - 1].s - 2, 4) : 0;
  // La fondamentale tenue peut se poser en trille avec la tierce (#15)
  c[L - 1].tr = c[L - 1].dur > 0 && P.trilleP && rng() < P.trilleP ? 1 : 0;
  if (P.triad && !c[L - 1].tr) c[L - 1].extra = [1, 2]; // la phrase se pose sur l'accord complet
  return c;
}

/**
 * Les notes de basse d'une mesure, d'après un motif de `DIFFS`. La longueur du motif donne sa division (ADR-0013) :
 * 8 signes pour des croches, 12 pour des triolets (#19) ; chaque position se calcule en pas de la grille de 12 par
 * temps (`enTemps`), pour que toutes les notes d'un même temps tombent sur le même nombre. Glisser joue la
 * fondamentale, sauter l'octave,
 * le double saut la quinte au-dessus de l'octave, et l'écrasement la fondamentale accentuée (ADR-0003). Le
 * tunnel et les pentes (#12) se tiennent sur les « - » : la pente montante glisse de la fondamentale à
 * l'octave, la descendante de l'octave à la fondamentale. `plaque` : la première note devient une plaque (#8).
 * Les marches d'un escalier (#13), « / » pour monter et « \ » pour descendre, jouent dans l'ordre les notes de
 * `marches` (voir `escalier`).
 */
export function notesDeBasse(
  motif: string,
  bar: number,
  ch: Accord,
  kind: Genre,
  plaque: boolean,
  marches: number[] = [],
): Note[] {
  if (PAS_PAR_MESURE % motif.length) throw new Error(`Motif de basse « ${motif} » : ${motif.length} signes`);
  const signe = PAS_PAR_MESURE / motif.length;
  let marche = 0;
  const notes: Note[] = [];
  for (let k = 0; k < motif.length; k++) {
    const c = plaque && k === 0 ? "P" : motif[k];
    if (c === "." || c === "-") continue;
    let dur = 0;
    if (c === "T" || c === "M" || c === "B") {
      let n = 1;
      while (k + n < motif.length && motif[k + n] === "-") n++;
      dur = enTemps(n * signe);
    }
    const lane = { P: 3, W: 1, D: 2, "/": 4, "\\": 5 }[c] ?? 0;
    const note: Note = {
      hand: "L",
      beat: enTemps(bar * PAS_PAR_MESURE + k * signe),
      dur,
      lane,
      bar,
      kind,
      midi: lane >= 4 ? marches[marche++] : [ch.bass, ch.bass + 12, ch.bass + 12 + ch.ints[2], ch.bass][lane],
      state: "pending",
    };
    if (c === "M") note.fin = ch.bass + 12;
    if (c === "B") [note.midi, note.fin] = [ch.bass + 12, ch.bass];
    notes.push(note);
  }
  return notes;
}

// Une note tenue (tunnel, pente) commencée avant la croche `k` déborde-t-elle sur elle ?
function deborde(motif: string, k: number) {
  for (let j = 0; j < k; j++) {
    if (!"TMB".includes(motif[j])) continue;
    let n = 1;
    while (j + n < 8 && motif[j + n] === "-") n++;
    if (j + n > k) return true;
  }
  return false;
}

// La note d'arrivée d'un escalier : celle que joue le début du motif de la mesure suivante, la fondamentale grave
// (glisser, tunnel, pente montante) ou l'octave (sauter, pente descendante) ; null pour tout autre début
function arriveeDe(motif: string | null, ch: Accord) {
  const c = motif ? motif[0] : ".";
  return "STM".includes(c) ? ch.bass : "WB".includes(c) ? ch.bass + 12 : null;
}

/**
 * Un escalier de walking bass (#13, ADR-0010) à la fin d'une mesure : la basse marche par degrés voisins de la
 * `gamme` jusqu'à la fondamentale de l'accord `suivant`, sur la note que joue le début de la mesure suivante.
 * Elle part de la fondamentale (glisser) ou de l'octave (sauter) de l'accord en cours, puis joue une marche par
 * temps jusqu'au bout de la mesure : trois marches depuis le premier temps, deux depuis le deuxième, une depuis le
 * troisième, selon le nombre de notes de la gamme entre le départ et l'arrivée. Sur le troisième temps (fort), la
 * marche doit être une note de l'accord ; les temps 2 et 4 prennent n'importe quelle note de la gamme. Renvoie le
 * motif réécrit et les notes des marches (le plus long escalier possible), ou null si aucun ne convient.
 */
export function escalier(motif: string, ch: Accord, suivant: Accord, motifSuivant: string | null, gamme: number[]) {
  const arrivee = arriveeDe(motifSuivant, suivant);
  if (arrivee === null) return null;
  let meilleur: { depart: number; marches: number[]; k: number } = null;
  for (const depart of [ch.bass, ch.bass + 12]) {
    const marches = notesEntre(depart, arrivee, gamme),
      k = 2 * (3 - marches.length);
    // L'escalier ne remplace que des notes simples (glisser, sauter) et des silences : les tunnels, pentes et
    // doubles sauts restent
    if (marches.length < 1 || marches.length > 3 || deborde(motif, k) || /[^.SW]/.test(motif.slice(k))) continue;
    // Une note déjà là au départ garde son geste : elle peut être l'arrivée de l'escalier de la mesure d'avant
    if ((motif[k] === "S" && depart !== ch.bass) || (motif[k] === "W" && depart !== ch.bass + 12)) continue;
    if (marches.some((m, i) => k + 2 * (i + 1) === 4 && !dansLAccord(ch, m))) continue;
    if (!meilleur || marches.length > meilleur.marches.length) meilleur = { depart, marches, k };
  }
  if (!meilleur) return null;
  const { depart, marches, k } = meilleur,
    pas = arrivee > depart ? "/" : "\\";
  return {
    motif: motif.slice(0, k) + (depart === ch.bass ? "S" : "W") + marches.map(() => "." + pas).join("") + ".",
    marches,
  };
}

/** Une petite note de la mélodie (#14), entre deux couloirs voisins */
export const estPetiteNote = (ev: Note) => ev.hand === "R" && !Number.isInteger(ev.lane);

/**
 * Une petite note entre les couloirs `lane - 0,5` et `lane + 0,5` (ADR-0010) : la note de la `pentatonique` entre
 * leurs deux degrés, la plus proche de celui où elle mène (celui du haut si `monte`). Sans note de la pentatonique
 * entre les deux, pas de petite note : null.
 */
export function petiteNote(
  lane: number,
  monte: boolean,
  beat: number,
  bar: number,
  ch: Accord,
  kind: Genre,
  pentatonique: number[],
): Note | null {
  const bas = ch.lanes[lane - 0.5],
    haut = ch.lanes[lane + 0.5],
    entre = monte ? notesEntre(bas, haut, pentatonique) : notesEntre(haut, bas, pentatonique);
  if (!entre.length) return null;
  return { hand: "R", beat, dur: 0, lane, bar, kind, vel: 0.8, midi: entre[entre.length - 1], state: "pending" };
}

/** Le couloir voisin d'une trille (#15), dans le sens `sens` (1 au-dessus, -1 au-dessous), retourné au bord */
export function voisin(lane: number, sens: number) {
  const v = lane + sens;
  return v < 0 || v > 3 ? lane - sens : v;
}

/**
 * Les couloirs d'un serpent (#16) de `nb` couloirs à partir de `lane`, dans le sens `sens` (1 monte, -1 descend).
 * S'il n'a pas la place, il part dans l'autre sens, ou raccourcit (quatre couloirs ne partent que d'un bord).
 */
export function couloirsDuSerpent(lane: number, sens: number, nb: number) {
  const place = (s: number) => (s > 0 ? 3 - lane : lane) + 1;
  if (place(sens) < nb && place(-sens) > place(sens)) sens = -sens;
  return Array.from({ length: Math.min(nb, place(sens)) }, (_, k) => lane + k * sens);
}

/**
 * Une note de la mélodie : le couloir joue son degré de l'accord, avec l'harmonie au degré au-dessus (ADR-0003).
 * `trille` : la note longue devient une trille (#15) avec ce couloir voisin, qui joue lui aussi son degré.
 * `serpent` : la note longue devient un serpent (#16) qui traverse ces couloirs, chacun sur son degré.
 */
export function noteDeMelodie(
  lane: number,
  beat: number,
  dur: number,
  bar: number,
  ch: Accord,
  kind: Genre,
  vel = 1,
  trille?: number,
  serpent?: number[],
): Note {
  const note: Note = {
    hand: "R",
    beat,
    dur,
    lane,
    bar,
    kind,
    vel,
    midi: ch.lanes[lane],
    harm: lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12,
    state: "pending",
  };
  if (trille !== undefined && dur > 0) [note.trille, note.midiTrille] = [trille, ch.lanes[trille]];
  if (serpent && serpent.length > 1 && dur > 0)
    [note.serpent, note.midiSerpent] = [serpent, serpent.map((l) => ch.lanes[l])];
  return note;
}

/**
 * Le chanteur (#18) de la mesure `bar` et la réponse du joueur sur la mesure suivante. Le chanteur chante quatre
 * notes, des degrés de l'accord de sa mesure (ADR-0003), sur un des rythmes de la difficulté ; chaque degré de
 * `couloirs` y revient au moins une fois. La réponse rejoue les mêmes degrés au même rythme, dans l'accord de
 * sa mesure : la mélodie se transpose comme partout ailleurs. Ses notes sont des silhouettes (`reponse`).
 */
export function phraseDuChanteur(
  rng: () => number,
  R: ReglagesChanteur,
  bar: number,
  chords: Accord[],
  kind: Genre,
): { chanteur: Chanteur; reponse: Note[] } {
  const rythme = R.rythmes[Math.floor(rng() * R.rythmes.length)],
    croches = [...rythme].flatMap((c, k) => (c === "x" ? [k] : [])),
    lanes = [...R.couloirs];
  while (lanes.length < croches.length) lanes.push(R.couloirs[Math.floor(rng() * R.couloirs.length)]);
  // Mélange de Fisher-Yates, tiré de la graine (ADR-0005)
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const notes = croches.map((k, i) => ({ beat: bar * 4 + k / 2, lane: lanes[i], midi: chords[bar].lanes[lanes[i]] }));
  const reponse = notes.map((n) => {
    const note = noteDeMelodie(n.lane, n.beat + 4, 0, bar + 1, chords[bar + 1], kind);
    note.reponse = true;
    return note;
  });
  return { chanteur: { bar, notes }, reponse };
}

/* ---------- Phrases en relais (#20) ---------- */

/** Les phrases du couplet et du refrain qui peuvent devenir un relais : la deuxième du couplet (la première expose
 * le thème, la troisième laisse la place au chanteur, la dernière garde sa cadence) et la troisième du refrain (la
 * première commence sur la plaque, la deuxième et la quatrième peuvent reprendre le solo). */
export const PHRASES_EN_RELAIS: Partial<Record<Genre, number>> = { couplet: 1, refrain: 2 };

/** Les motifs de basse des deux mesures d'un relais, dans la notation de `DIFFS` : la basse monte l'arpège de son
 * accord avant que la mélodie le reprenne, ou le descend après elle. Ses marches (« / » et « \ ») jouent la tierce
 * et la quinte : la touche ne choisit que le geste (ADR-0010). */
export const MOTIFS_RELAIS = { monte: ["S././.W.", "........"], descend: ["........", "W.\\.\\.S."] };

/**
 * Une phrase en relais (#20) sur les mesures `bar` et `bar + 1` : une main joue l'arpège de l'accord sur les quatre
 * temps de la première mesure, l'autre le continue dans le même sens sur la seconde, et chaque main se tait sur la
 * mesure de l'autre. En montant, la basse va de sa fondamentale à son octave (glisser, deux marches, sauter), puis
 * la mélodie monte de la fondamentale à l'octave ; en descendant, la mélodie descend de l'octave à la fondamentale,
 * puis la basse reprend une octave plus bas, de son octave à sa fondamentale. Chaque main joue les degrés de
 * l'accord de sa mesure (ADR-0003), et la mélodie y joue sans harmonie : on n'entend qu'une ligne. Toutes les notes
 * portent `relais`, la mesure du début.
 */
export function phraseEnRelais(monte: boolean, bar: number, chords: Accord[], kind: Genre): Note[] {
  const notes: Note[] = [];
  (monte ? MOTIFS_RELAIS.monte : MOTIFS_RELAIS.descend).forEach((motif, i) => {
    const ch = chords[bar + i],
      marches = [ch.bass + ch.ints[1], ch.bass + ch.ints[2]];
    notes.push(...notesDeBasse(motif, bar + i, ch, kind, false, monte ? marches : marches.reverse()));
  });
  const m = monte ? bar + 1 : bar;
  for (let t = 0; t < 4; t++) {
    const note = noteDeMelodie(monte ? t : 3 - t, m * 4 + t, 0, m, chords[m], kind);
    delete note.harm;
    notes.push(note);
  }
  for (const n of notes) n.relais = bar;
  return notes;
}

/* ---------- Pont en mains croisées (#21) ---------- */

export const NOM_CROISEE = "Mains croisées";

/** La mélodie du pont en mains croisées : le thème du couplet, puis sa réponse qui se pose sur la fondamentale.
 * Une mélodie déjà entendue, pour que le joueur n'ait à réapprendre que la lecture de la scène retournée. */
export const phrasesCroisees = <T>(couplet: T[]): T[] => [couplet[0], couplet[3]];

/* ---------- Section en 3 contre 2 (#19, ADR-0013) ---------- */

export const NOM_POLYRYTHMIE = "3 contre 2";

/**
 * La mélodie d'une section en 3 contre 2 (#19) : elle reste en croches, aux places de `R.melodie` (une mesure en
 * huit croches, x une note), pendant que la basse joue ses triolets. Ses couloirs marchent par degrés voisins dans
 * l'accord de chaque mesure (ADR-0003), tirés de `rng`, et la dernière note se pose sur la fondamentale.
 */
export function melodieEnPolyrythmie(
  rng: () => number,
  R: ReglagesPolyrythmie,
  start: number,
  bars: number,
  chords: Accord[],
): Note[] {
  const notes: Note[] = [];
  let lane = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < bars; i++) {
    const bar = start + i,
      rythme = R.melodie[i % R.melodie.length];
    for (let k = 0; k < 8; k++) {
      if (rythme[k] !== "x") continue;
      if (notes.length) {
        const r = rng();
        lane = clamp(lane + (r < 0.45 ? -1 : r < 0.9 ? 1 : 0), 0, 3);
      }
      notes.push(noteDeMelodie(lane, bar * 4 + k / 2, 0, bar, chords[bar], "polyrythmie"));
    }
  }
  const derniere = notes.at(-1);
  if (derniere)
    notes[notes.length - 1] = noteDeMelodie(0, derniere.beat, 0, derniere.bar, chords[derniere.bar], "polyrythmie");
  return notes;
}

/**
 * La version du générateur (ADR-0014) : on l'augmente à chaque changement voulu des chansons, c'est-à-dire à chaque
 * régénération de l'instantané (ADR-0005). Ce que la sauvegarde range sur les notes exactes d'une chanson (meilleur
 * score, tags, fantôme) porte cette version dans sa clé, et celui d'une autre version est ignoré.
 */
export const VERSION_GENERATEUR = 2;

// Le tirage d'une chanson : sa progression est le premier nombre tiré, avant la tonalité et le tempo
const tirage = (seed: number) => mulberry32(seed * 9301 + 49297);
const tirerProgression = (rng: () => number) => PROGS[Math.floor(rng() * PROGS.length)];
/** La progression de la chanson d'une graine, sans construire la chanson (même tirage que buildSong) */
export const progressionDe = (seed: number) => tirerProgression(tirage(seed));

/** Les finitions des notes d'une chanson : triées, la durée des sauts, un état neuf et les accords reliés */
export function finirLesNotes(ev: Note[]) {
  ev.sort((a, b) => a.beat - b.beat || (a.hand < b.hand ? -1 : 1));
  const Ls = ev.filter((e) => e.hand === "L");
  Ls.forEach((e, i) => {
    const nx = Ls[i + 1];
    // Le saut qui précède un double saut dure un temps : le second appui doit venir en l'air, même en retard
    e.air = nx && nx.lane === 2 ? 1 : Math.min(0.85, (nx ? nx.beat - e.beat : 2) * 0.8);
  });
  ev.forEach((e) => (e.state = "pending"));
  // Notes simultanées (du même pas, ADR-0013) = un accord : reliées à l'écran, bonus quand l'accord est complet
  relierAccords(ev);
  return ev;
}

export function buildSong(seed: number, diffKey: string): Chanson {
  const rng = tirage(seed);
  // Les chanteurs (#18) ont leur propre tirage : le reste de la chanson ne change pas avec eux
  const rngChant = mulberry32(seed * 6151 + 811);
  const D = DIFFS[diffKey];
  const prog = tirerProgression(rng);
  const keyPc = Math.floor(rng() * 12);
  const bpm = 88 + 4 * Math.floor(rng() * 7);
  // Le pont en mains croisées (#21) a son propre tirage : sans lui, la chanson ne change pas, et avec lui, elle
  // ne fait que s'allonger de ses mesures
  const croisee = D.croiseeP > 0 && mulberry32(seed * 2749 + 3001)() < D.croiseeP;
  // La section en 3 contre 2 (#19) aussi, présence et mélodie : elle s'ajoute entre le dernier refrain et l'outro,
  // après la reprise du solo (ADR-0012), et Débutant, Facile et Normal, qui n'en ont pas, n'y tirent rien
  const rngPoly = D.polyrythmie ? mulberry32(seed * 1693 + 2903) : null,
    polyrythmie = rngPoly !== null && rngPoly() < D.polyrythmie.p;
  const sections = [
    ["Intro", "intro", 2],
    ["Couplet", "couplet", 8],
    ["Refrain", "refrain", 8],
    ...(croisee ? [[NOM_CROISEE, "pont", 4]] : []),
    ["Solo libre", "pont", 4],
    ["Refrain", "refrain", 8],
    ...(polyrythmie ? [[NOM_POLYRYTHMIE, "polyrythmie", 4]] : []),
    ["Outro", "outro", 2],
  ].map(([name, kind, bars]) => ({ name, kind, bars, ...(name === NOM_CROISEE ? { croisee: true } : {}) }) as Section);
  let bar = 0;
  for (const s of sections) {
    s.start = bar;
    bar += s.bars;
  }
  const totalBars = bar;
  const chords = [];
  for (const s of sections)
    for (let i = 0; i < s.bars; i++)
      chords.push(makeChord(keyPc, s.kind === "outro" ? prog.end : prog.chords[i % prog.chords.length]));

  const bassPat = (kind, i) => {
    const a = D.bass[kind];
    return a ? a[i % a.length] : null;
  };
  const occ = (kind) => {
    const o = [];
    for (let b = 0; b < 2; b++) {
      const p = bassPat(kind, b) || "........";
      for (let s = 0; s < 8; s++) o.push(p[s] !== ".");
    }
    return o;
  };
  const M = genMotif(rng, D.mel, occ("couplet"), false);
  const R = genMotif(rng, D.mel, occ("refrain"), true);
  const phrases = {
    couplet: [M, vary(rng, M, 1), M, answer(rng, M, D.mel)],
    refrain: [R, vary(rng, R, 2), R, answer(rng, R, D.mel)],
  };
  // Les serpents (#16) se tirent avec leur propre suite de nombres, une fois par phrase (une phrase répétée garde
  // les siens) : le reste de la chanson ne change pas, et Débutant et Facile, qui n'en ont pas, n'y tirent rien
  if (D.mel.serpentP) {
    const rngSerpents = mulberry32(seed * 7919 + 104729),
      fondues = new Map();
    for (const k of Object.keys(phrases))
      phrases[k] = phrases[k].map((p) => {
        if (!fondues.has(p)) fondues.set(p, fondreSerpents(rngSerpents, p, D.mel));
        return fondues.get(p);
      });
  }

  // Les petites notes (#14) aussi, après les serpents, qu'elles évitent
  if (D.mel.petitesP) {
    const rngPetites = mulberry32(seed * 6151 + 15485863),
      semees = new Map();
    for (const k of Object.keys(phrases))
      phrases[k] = phrases[k].map((p) => {
        if (!semees.has(p)) semees.set(p, semerPetitesNotes(rngPetites, p, D.mel));
        return semees.get(p);
      });
  }
  // Les escaliers (#13) aussi, mesure par mesure : au couplet et au refrain, hors plaque (#8) et hors dernière
  // mesure, pour que la fondamentale d'arrivée reste dans la section
  const rngEscaliers = D.escalierP ? mulberry32(seed * 4999 + 1237) : null;
  // Les relais (#20) aussi, une fois par genre : les deux refrains ont le même (true s'il monte). Un relais remplace
  // toute sa phrase, basse comprise : ses mesures n'ont pas d'escalier, celle d'avant peut le rejoindre par le sien.
  const relais: Partial<Record<Genre, boolean>> = {};
  if (D.relaisP) {
    const rngRelais = mulberry32(seed * 3571 + 7907);
    for (const kind of Object.keys(PHRASES_EN_RELAIS)) if (rngRelais() < D.relaisP) relais[kind] = rngRelais() < 0.5;
  }
  const enRelais = (s: Section, i: number) => s.kind in relais && Math.floor(i / 2) === PHRASES_EN_RELAIS[s.kind],
    motifDe = (s: Section, i: number) =>
      enRelais(s, i) ? MOTIFS_RELAIS[relais[s.kind] ? "monte" : "descend"][i % 2] : bassPat(s.kind, i);

  const ev = [],
    chanteurs: Chanteur[] = [];
  for (const s of sections) {
    for (let i = 0; i < s.bars; i++) {
      const bar = s.start + i,
        plaque = s.kind === "refrain" && i === 0;
      // La phrase en relais (#20) écrit sa basse elle-même
      if (enRelais(s, i)) continue;
      let p = bassPat(s.kind, i),
        marches: number[] = [];
      if (rngEscaliers && p && !plaque && i < s.bars - 1 && (s.kind === "couplet" || s.kind === "refrain")) {
        const e = escalier(p, chords[bar], chords[bar + 1], motifDe(s, i + 1), gammeDe(keyPc, prog, chords[bar]));
        if (e && rngEscaliers() < D.escalierP) ({ motif: p, marches } = e);
      }
      // La plaque à écraser (#8) remplace la première note de basse de chaque refrain
      if (p) ev.push(...notesDeBasse(p, bar, chords[bar], s.kind, plaque, marches));
    }
    // La section en 3 contre 2 (#19) : la basse en triolets vient de son motif, la mélodie reste en croches
    if (s.kind === "polyrythmie") {
      ev.push(...melodieEnPolyrythmie(rngPoly, D.polyrythmie, s.start, s.bars, chords));
      continue;
    }
    const ph = s.croisee ? phrasesCroisees(phrases.couplet) : phrases[s.kind];
    if (!ph) continue;
    for (let k = 0; k < s.bars / 2; k++) {
      // La phrase en relais (#20) : les deux mains se passent l'arpège
      if (enRelais(s, 2 * k)) {
        ev.push(...phraseEnRelais(relais[s.kind], s.start + 2 * k, chords, s.kind));
        continue;
      }
      // L'avant-dernière phrase du couplet laisse la place au chanteur et à sa réponse (#18) : la dernière garde
      // sa cadence, et la réponse ne tombe pas dans le silence d'avant le refrain. Jamais au refrain : la reprise
      // du solo (#9) remplace des phrases du dernier refrain, elle ne croise pas le chanteur.
      if (D.chanteur && s.kind === "couplet" && k === s.bars / 2 - 2) {
        const { chanteur, reponse } = phraseDuChanteur(rngChant, D.chanteur, s.start + 2 * k, chords, s.kind);
        chanteurs.push(chanteur);
        ev.push(...reponse);
        continue;
      }
      for (const n of ph[k % ph.length]) {
        const barIdx = s.start + 2 * k + Math.floor(n.s / 8),
          ch = chords[barIdx];
        const beat = (s.start + 2 * k) * 4 + n.s / 2;
        if (n.petite) {
          const petite = petiteNote(n.lane, n.petite > 0, beat, barIdx, ch, s.kind, gammeDe(keyPc, prog, ch, true));
          if (petite) ev.push(petite);
          continue;
        }
        const extra = [...new Set<number>(n.extra || [])].filter((l) => l !== n.lane);
        const vel = extra.length ? 0.75 : 1;
        // Pas de trille sur une note qui fait partie d'un accord de la main droite
        const trille = n.tr && !extra.length ? voisin(n.lane, n.tr) : undefined;
        // Le serpent (#16) garde son sens s'il a la place ; ses couloirs durent chacun un pas
        const serpent = n.sp && couloirsDuSerpent(n.lane, n.sp.sens, n.sp.nb);
        const dur = serpent ? (serpent.length * n.sp.pas) / 2 : n.dur / 2;
        ev.push(noteDeMelodie(n.lane, beat, dur, barIdx, ch, s.kind, vel, trille, serpent));
        for (const l of extra)
          ev.push({ hand: "R", beat, dur: n.dur / 2, lane: l, bar: barIdx, kind: s.kind, vel, midi: ch.lanes[l] });
      }
    }
  }
  finirLesNotes(ev);
  const names = prog.chords.map((c) => makeChord(keyPc, c).name);
  return {
    seed,
    prog,
    keyPc,
    bpm,
    sections,
    totalBars,
    chords,
    ev,
    chanteurs,
    endBeat: totalBars * 4,
    keyName: `${NOTE_FR[keyPc]} ${prog.mode}`,
    progLabel: names.join(" – "),
  };
}
