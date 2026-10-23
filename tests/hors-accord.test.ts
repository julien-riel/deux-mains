// Notes hors accord (ADR-0010) : les gammes, les petites notes de la mélodie (#14) et les escaliers de walking
// bass (#13). Logique pure (ADR-0007) : le générateur, le jugement et l'auto-play, avec des effets espions.
// Graines fixes (ADR-0005) : celles de l'instantané.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong, escalier, estPetiteNote, notesDeBasse, petiteNote } from "../src/chanson/generateur";
import { PROGS, dansLAccord, gammeDe, makeChord, notesEntre } from "../src/chanson/theorie";
import type { Chanson, Main, Note } from "../src/chanson/types";
import { autoHit } from "../src/jeu/autoplay";
import { S } from "../src/jeu/etat";
import { brancherEffets, leftPress, rightPress, type Effets } from "../src/jeu/jugement";
import { DIFFICULTES, GRAINES } from "./support/instantane";

const CHANSONS = DIFFICULTES.flatMap((diff) => GRAINES.map((graine) => ({ diff, chanson: buildSong(graine, diff) })));
const dans = (diff: string) => CHANSONS.filter((c) => c.diff === diff).map((c) => c.chanson);
const petites = (c: Chanson) => c.ev.filter(estPetiteNote);
// Les marches des escaliers seulement : celles des relais (#20) montent ou descendent l'arpège (tests/relais.test.ts)
const marches = (c: Chanson) => c.ev.filter((ev) => ev.hand === "L" && ev.lane >= 4 && ev.relais === undefined);
const gauche = (c: Chanson) => c.ev.filter((ev) => ev.hand === "L");
const prog = (nom: string) => PROGS.find((p) => p.name === nom);
const sectionDe = (c: Chanson, bar: number) => c.sections.find((s) => bar >= s.start && bar < s.start + s.bars);

describe("gammes (ADR-0010)", () => {
  it("la basse prend la gamme de la tonalité, la mélodie sa pentatonique", () => {
    const doMajeur = prog("I–V–vi–IV");
    expect(gammeDe(0, doMajeur, makeChord(0, [0, "M"]))).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(gammeDe(0, doMajeur, makeChord(0, [0, "M"]), true)).toEqual([0, 2, 4, 7, 9]);
    // La mineur naturel, et sa pentatonique mineure
    const laMineur = prog("vi–IV–I–V");
    expect(gammeDe(9, laMineur, makeChord(9, [0, "m"])).sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(gammeDe(9, laMineur, makeChord(9, [0, "m"]), true).sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]);
  });

  it("le Vamp dorien est en dorien : la sixte majeure de l'accord de Ré7 en La", () => {
    const vamp = prog("Vamp dorien");
    expect(gammeDe(9, vamp, makeChord(9, [0, "m7"]))).toContain(6);
    expect(gammeDe(9, vamp, makeChord(9, [5, "7"]))).toContain(6);
  });

  it("une note de l'accord hors de la gamme remplace celle qu'elle contredit : Sol♯ sur le Mi majeur de la cadence andalouse", () => {
    const andalouse = prog("Cadence andalouse"),
      mi = makeChord(9, [7, "M"]);
    expect(mi.name).toBe("E");
    const gamme = gammeDe(9, andalouse, mi);
    expect(gamme).toContain(8);
    expect(gamme).not.toContain(7);
    expect(gammeDe(9, andalouse, mi, true)).toEqual(expect.arrayContaining([8]));
    expect(gammeDe(9, andalouse, mi, true)).not.toContain(7);
    // Sur les autres accords, la gamme reste celle de La mineur
    expect(gammeDe(9, andalouse, makeChord(9, [0, "m"]))).toContain(7);
  });

  it("les notes de la gamme entre deux hauteurs, dans l'ordre où on les rencontre", () => {
    const doMajeur = [0, 2, 4, 5, 7, 9, 11];
    expect(notesEntre(36, 43, doMajeur)).toEqual([38, 40, 41]);
    expect(notesEntre(43, 36, doMajeur)).toEqual([41, 40, 38]);
    expect(notesEntre(36, 38, doMajeur)).toEqual([]);
    expect(notesEntre(36, 36, doMajeur)).toEqual([]);
  });
});

describe("petites notes (#14)", () => {
  it.each(["debutant", "facile"])("en %s, aucune petite note", (diff) => {
    for (const c of dans(diff)) expect(petites(c)).toEqual([]);
  });

  it("en Normal, plusieurs chansons en ont ; en Difficile, toutes", () => {
    expect(dans("normal").filter((c) => petites(c).length).length).toBeGreaterThanOrEqual(5);
    for (const c of dans("difficile")) expect(petites(c).length).toBeGreaterThan(0);
  });

  it("une petite note tombe sur une croche faible, entre deux couloirs voisins, au couplet et au refrain", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of petites(chanson)) {
        expect(ev.beat % 1).toBe(0.5);
        expect([0.5, 1.5, 2.5]).toContain(ev.lane);
        // Et dans le pont en mains croisées (#21), qui reprend des phrases du couplet, jamais au solo libre
        const sec = chanson.sections.find((s) => ev.bar >= s.start && ev.bar < s.start + s.bars);
        expect(["couplet", "refrain", "pont"]).toContain(ev.kind);
        expect(sec.kind !== "pont" || sec.croisee).toBe(true);
        expect([ev.dur, ev.grp?.filter((e) => e.hand === "R").length ?? 1]).toEqual([0, 1]);
      }
  });

  it("elle joue une note de la pentatonique entre les degrés de ses deux couloirs", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of petites(chanson)) {
        const ch = chanson.chords[ev.bar];
        expect(gammeDe(chanson.keyPc, chanson.prog, ch, true)).toContain(ev.midi % 12);
        expect(ev.midi).toBeGreaterThan(ch.lanes[ev.lane - 0.5]);
        expect(ev.midi).toBeLessThan(ch.lanes[ev.lane + 0.5]);
        // Ce n'est aucun des degrés des couloirs (la septième d'un accord de septième peut l'être)
        expect(ch.lanes.map((m) => m % 12)).not.toContain(ev.midi % 12);
      }
  });

  it("elle est toujours suivie, une croche plus tard dans la même mesure, d'une note de l'accord qu'elle rejoint", () => {
    for (const { chanson } of CHANSONS) {
      const droite = chanson.ev.filter((e) => e.hand === "R");
      for (const ev of petites(chanson)) {
        const suivante = droite.find((e) => e.beat > ev.beat);
        expect([suivante.beat - ev.beat, suivante.bar]).toEqual([0.5, ev.bar]);
        expect(Number.isInteger(suivante.lane)).toBe(true);
        expect(Math.abs(suivante.lane - ev.lane)).toBe(0.5);
        expect(suivante.midi).toBe(chanson.chords[ev.bar].lanes[suivante.lane]);
        // Aucune note de la pentatonique entre la petite note et celle qu'elle rejoint
        const penta = gammeDe(chanson.keyPc, chanson.prog, chanson.chords[ev.bar], true);
        expect(notesEntre(ev.midi, suivante.midi, penta)).toEqual([]);
        // Ni trille ni serpent à l'arrivée
        expect([suivante.trille, suivante.serpent]).toEqual([undefined, undefined]);
      }
    }
  });

  it("elle n'entre ni dans une note tenue, ni dans une trille, ni dans un serpent", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of petites(chanson))
        expect(
          chanson.ev.filter((e) => e.hand === "R" && e.dur > 0 && e.beat < ev.beat && e.beat + e.dur > ev.beat),
        ).toEqual([]);
  });

  it("les petites notes ne déplacent pas le reste de la chanson", () => {
    for (const diff of ["normal", "difficile"]) {
      const P = DIFFS[diff].mel,
        avant = P.petitesP;
      for (const graine of GRAINES) {
        const avec = buildSong(graine, diff);
        P.petitesP = 0;
        const sans = buildSong(graine, diff);
        P.petitesP = avant;
        const resume = (c: Chanson) =>
          c.ev.filter((e) => !estPetiteNote(e)).map(({ hand, beat, lane, dur, midi }) => [hand, beat, lane, dur, midi]);
        expect(resume(avec)).toEqual(resume(sans));
      }
    }
  });

  it("sans note de la pentatonique entre les deux couloirs, pas de petite note", () => {
    const doM = makeChord(0, [0, "M"]),
      penta = [0, 2, 4, 7, 9];
    // Do–Mi : Ré ; Mi–Sol : rien ; Sol–Do : La
    expect(petiteNote(0.5, true, 0.5, 0, doM, "couplet", penta).midi).toBe(62);
    expect(petiteNote(1.5, true, 0.5, 0, doM, "couplet", penta)).toBeNull();
    expect(petiteNote(2.5, false, 0.5, 0, doM, "couplet", penta).midi).toBe(69);
    // Entre deux notes possibles, la plus proche de celle qu'elle rejoint
    const fa = makeChord(0, [5, "M"]);
    expect(petiteNote(2.5, true, 0.5, 0, fa, "couplet", penta).midi).toBe(76);
    expect(petiteNote(2.5, false, 0.5, 0, fa, "couplet", penta).midi).toBe(74);
  });
});

describe("escaliers de walking bass (#13)", () => {
  it.each(["debutant", "facile", "normal"])("en %s, aucun escalier", (diff) => {
    for (const c of dans(diff)) expect(marches(c)).toEqual([]);
  });

  it("en Difficile, la plupart des chansons en ont, au couplet et au refrain", () => {
    const avec = dans("difficile").filter((c) => marches(c).length);
    expect(avec.length).toBeGreaterThanOrEqual(GRAINES.length / 2);
    for (const c of avec) for (const ev of marches(c)) expect(["couplet", "refrain"]).toContain(ev.kind);
  });

  it("chaque marche est une note de la gamme, sur un temps, à un degré de la note d'avant, dans le sens de sa touche", () => {
    for (const c of dans("difficile")) {
      const ls = gauche(c);
      ls.forEach((ev, i) => {
        if (ev.lane < 4 || ev.relais !== undefined) return;
        const gamme = gammeDe(c.keyPc, c.prog, c.chords[ev.bar]),
          avant = ls[i - 1];
        expect(gamme).toContain(ev.midi % 12);
        expect([ev.beat % 1, ev.dur, ev.beat - avant.beat]).toEqual([0, 0, 1]);
        expect(Math.sign(ev.midi - avant.midi)).toBe(ev.lane === 4 ? 1 : -1);
        expect(notesEntre(avant.midi, ev.midi, gamme)).toEqual([]);
      });
    }
  });

  it("sur le troisième temps, la marche est une note de l'accord", () => {
    for (const c of dans("difficile"))
      for (const ev of marches(c)) if (ev.beat % 4 === 2) expect(dansLAccord(c.chords[ev.bar], ev.midi)).toBe(true);
  });

  it("la dernière marche mène, d'un degré, à la fondamentale de l'accord suivant au premier temps", () => {
    for (const c of dans("difficile")) {
      const ls = gauche(c);
      ls.forEach((ev, i) => {
        if (ev.lane < 4 || ev.relais !== undefined || ls[i + 1].lane >= 4) return;
        const arrivee = ls[i + 1],
          suivant = c.chords[ev.bar + 1];
        expect([arrivee.beat, ev.beat % 4]).toEqual([(ev.bar + 1) * 4, 3]);
        expect([suivant.bass, suivant.bass + 12]).toContain(arrivee.midi);
        expect(sectionDe(c, arrivee.bar)).toBe(sectionDe(c, ev.bar));
        expect(notesEntre(ev.midi, arrivee.midi, gammeDe(c.keyPc, c.prog, c.chords[ev.bar]))).toEqual([]);
      });
    }
  });

  it("l'escalier part de la fondamentale (glisser) ou de l'octave (sauter) de l'accord", () => {
    for (const c of dans("difficile")) {
      const ls = gauche(c);
      ls.forEach((ev, i) => {
        if (ev.lane < 4 || ev.relais !== undefined || ls[i - 1].lane >= 4) return;
        const depart = ls[i - 1],
          ch = c.chords[ev.bar];
        expect([0, 1]).toContain(depart.lane);
        expect([ch.bass, ch.bass + 12]).toContain(depart.midi);
        expect(depart.dur).toBe(0);
      });
    }
  });

  it("les escaliers gardent les tunnels, les pentes, les doubles sauts et les plaques, et ne touchent pas à la mélodie", () => {
    const avant = DIFFS.difficile.escalierP;
    for (const graine of GRAINES) {
      const avec = buildSong(graine, "difficile");
      DIFFS.difficile.escalierP = 0;
      const sans = buildSong(graine, "difficile");
      DIFFS.difficile.escalierP = avant;
      const speciaux = (c: Chanson) =>
        gauche(c)
          .filter((e) => e.lane === 2 || e.lane === 3 || e.dur > 0)
          .map(({ beat, lane, dur, midi }) => [beat, lane, dur, midi]);
      expect(speciaux(avec)).toEqual(speciaux(sans));
      const droite = (c: Chanson) =>
        c.ev.filter((e) => e.hand === "R").map(({ beat, lane, midi }) => [beat, lane, midi]);
      expect(droite(avec)).toEqual(droite(sans));
    }
  });

  it("de Do à Sol en Do majeur, la basse monte Do, Ré, Mi, Fa vers Sol : trois marches depuis le premier temps", () => {
    const doM = makeChord(0, [0, "M"]),
      solM = makeChord(0, [7, "M"]),
      gamme = gammeDe(0, prog("I–V–vi–IV"), doM);
    const e = escalier("S...W...", doM, solM, "S.......", gamme);
    expect(e).toEqual({ motif: "S./././.", marches: [38, 40, 41] });
    const notes = notesDeBasse(e.motif, 0, doM, "couplet", false, e.marches);
    expect(notes.map((n) => [n.beat, n.lane, n.midi])).toEqual([
      [0, 0, 36],
      [1, 4, 38],
      [2, 4, 40],
      [3, 4, 41],
    ]);
  });

  it("de Do à La mineur, une seule marche depuis le troisième temps, en descendant", () => {
    const doM = makeChord(0, [0, "M"]),
      laM = makeChord(0, [9, "m"]),
      gamme = gammeDe(0, prog("I–V–vi–IV"), doM);
    expect(escalier("S.......", doM, laM, "S.......", gamme)).toEqual({ motif: "S...S.\\.", marches: [35] });
  });

  it("pas d'escalier sans place : arrivée sur une plaque, note tenue qui déborde, marche hors accord au troisième temps", () => {
    const doM = makeChord(0, [0, "M"]),
      solM = makeChord(0, [7, "M"]),
      gamme = gammeDe(0, prog("I–V–vi–IV"), doM);
    expect(escalier("S.......", doM, solM, "P.......", gamme)).toBeNull();
    expect(escalier("S.......", doM, solM, null, gamme)).toBeNull();
    expect(escalier("T-------", doM, solM, "S.......", gamme)).toBeNull();
    expect(escalier("S...M--.", doM, solM, "S.......", gamme)).toBeNull();
    // Le saut déjà au premier temps garde son geste : de l'octave, Mi ne tomberait pas au troisième temps
    expect(escalier("W.......", doM, solM, "S.......", gamme)).toBeNull();
    // Sol vers Do, quatre degrés en descendant : Mi au troisième temps n'est pas dans Sol majeur
    expect(escalier("S.......", solM, makeChord(0, [0, "M"]), "S.......", gamme)).toBeNull();
  });
});

/* ---------- Jugement et auto-play ---------- */

const ETAT_NEUF = { ...S };
let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
beforeEach(() => {
  effets = Object.fromEntries(
    [
      "jouer",
      "couper",
      "reussite",
      "accord",
      "rate",
      "lache",
      "mauvaisCouloir",
      "solo",
      "vibrato",
      "trille",
      "glisser",
      "passage",
      "tir",
      "relais",
      "mourir",
    ].map((k) => [k, vi.fn()]),
  ) as typeof effets;
  brancherEffets(effets);
});
function note(hand: Main, beat: number, lane: number): Note {
  return { hand, beat, lane, dur: 0, bar: Math.floor(beat / 4), kind: "couplet", midi: 60, air: 0.8, state: "pending" };
}
// Une partie à 60 BPM (un temps par seconde), sans solo
function partie(ev: Note[], diff = "difficile") {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff, mode: "play" });
  S.song = {
    bpm: 60,
    ev: ev.sort((a, b) => a.beat - b.beat),
    sections: [{ name: "Couplet", kind: "couplet", bars: 8, start: 0 }],
  } as unknown as Chanson;
  S.ev = S.song.ev;
  return S.ev;
}

describe("jouer les notes hors accord (ADR-0010)", () => {
  it("une petite note se touche avec l'une ou l'autre des deux touches voisines", () => {
    const [a, b] = partie([note("R", 4.5, 0.5), note("R", 6.5, 2.5)]);
    rightPress(0, 4.5);
    rightPress(3, 6.5);
    expect([a.state, b.state]).toEqual(["hit", "hit"]);
    expect([S.perfect, S.combo]).toEqual([2, 2]);
    expect(effets.jouer).toHaveBeenCalledTimes(2);
  });

  it("une autre touche sur une petite note est un mauvais couloir", () => {
    const [a] = partie([note("R", 4.5, 1.5)]);
    rightPress(0, 4.5);
    rightPress(3, 4.5);
    expect(a.state).toBe("pending");
    expect(effets.mauvaisCouloir).toHaveBeenCalledTimes(2);
  });

  it("une petite note puis la note de l'accord qu'elle rejoint, avec la même touche", () => {
    const [a, b] = partie([note("R", 4.5, 0.5), note("R", 5, 1)]);
    rightPress(1, 4.5);
    rightPress(1, 5);
    expect([a.state, b.state]).toEqual(["hit", "hit"]);
  });

  it("dans un escalier, sauter monte d'une marche et glisser en descend une", () => {
    const [monte, descend] = partie([note("L", 5, 4), note("L", 7, 5)]);
    leftPress(1, 5);
    leftPress(0, 7);
    expect([monte.state, descend.state]).toEqual(["hit", "hit"]);
    // Sauter fait sauter le personnage, glisser le fait glisser
    expect(S.slideUntil).toBeGreaterThan(7);
    expect(S.jumpAt).toBe(-99);
  });

  it("le mauvais geste sur une marche la rate", () => {
    const [monte, descend] = partie([note("L", 5, 4), note("L", 7, 5)]);
    leftPress(0, 5);
    leftPress(1, 7);
    leftPress(3, 7.02);
    expect([monte.state, descend.state]).toEqual(["miss", "miss"]);
    expect(S.miss).toBe(2);
  });

  it("une marche montante juste après un saut n'est pas un double saut", () => {
    const [saut, marche] = partie([note("L", 4, 1), note("L", 4.5, 4)]);
    leftPress(1, 4);
    leftPress(1, 4.5);
    expect([saut.state, marche.state]).toEqual(["hit", "hit"]);
    expect(S.doubleAt).toBe(-99);
  });

  it("l'auto-play monte et descend les marches, et touche les petites notes avec la touche du dessous", () => {
    const [monte, descend, petite] = partie([note("L", 5, 4), note("L", 7, 5), note("R", 8.5, 1.5)]);
    S.auto = true;
    autoHit(monte);
    expect(S.keyFlash.sauter).toBeDefined();
    expect(S.jumpAt).toBe(5);
    autoHit(descend);
    expect(S.keyFlash.glisser).toBeDefined();
    expect(S.slideUntil).toBeGreaterThan(7);
    autoHit(petite);
    expect(S.keyFlash.couloir1).toBeDefined();
    expect([monte.state, descend.state, petite.state]).toEqual(["hit", "hit", "hit"]);
    expect([S.perfect, S.miss]).toEqual([3, 0]);
  });
});
