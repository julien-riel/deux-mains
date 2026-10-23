// Polyrythmie 3 contre 2 (#19, ADR-0013) : en Difficile, une section joue la basse en triolets pendant que la
// mélodie reste en croches. Toute position est un multiple de 1/12 de temps, comparée par `pas()` ; l'auto-play
// fait sonner chaque note à son heure, pas à celle du pas du séquenceur.

import { afterEach, describe, expect, it } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { NOM_POLYRYTHMIE, buildSong, melodieEnPolyrythmie, notesDeBasse } from "../src/chanson/generateur";
import { PAS_PAR_TEMPS, enTemps, memeTemps, pas, relierAccords, surLaCroche, surLaGrille } from "../src/chanson/temps";
import { makeChord } from "../src/chanson/theorie";
import type { Chanson, Note, Section } from "../src/chanson/types";
import { autoNotes } from "../src/jeu/autoplay";
import { S } from "../src/jeu/etat";
import { estSolo, soloEtRefrain } from "../src/jeu/variations";
import { LANE_CODES } from "../src/ui/touches";
import { evenementsClavier, faire } from "./support/appuis";
import { DIFFICULTES, GRAINES } from "./support/instantane";
import { Navigateur } from "./support/navigateur";

const CHANSONS = DIFFICULTES.flatMap((diff) => GRAINES.map((graine) => ({ diff, chanson: buildSong(graine, diff) })));
const dans = (diff: string) => CHANSONS.filter((c) => c.diff === diff).map((c) => c.chanson);
const sectionPoly = (c: Chanson) => c.sections.find((s) => s.kind === "polyrythmie");
const notesDe = (c: Chanson, sec: Section) => c.ev.filter((e) => e.bar >= sec.start && e.bar < sec.start + sec.bars);
const resume = (e: Note) => [e.hand, e.beat, e.lane, e.midi, e.dur];

describe("la grille de 12 pas par temps", () => {
  it("pas() donne l'entier du temps, quel que soit le chemin de calcul d'un triolet", () => {
    expect(PAS_PAR_TEMPS).toBe(12);
    expect([0, 0.25, 0.5, 1, 4.75].map(pas)).toEqual([0, 3, 6, 12, 57]);
    // 72 + 1/3 ne s'écrit pas exactement : deux calculs donnent deux nombres, mais le même pas
    const a = 72 + 1 / 3,
      b = enTemps(72 * 12 + 4) + 16 - 16;
    expect(pas(a)).toBe(pas(b));
    expect(memeTemps(a, b)).toBe(true);
    expect(memeTemps(1 / 3, 0.25)).toBe(false);
    expect([1 / 3, 2 / 3, 0.5, 0.25].every(surLaGrille)).toBe(true);
    expect(surLaGrille(0.2)).toBe(false);
    expect([0, 0.5, 3.5].every(surLaCroche)).toBe(true);
    expect([1 / 3, 0.25].some(surLaCroche)).toBe(false);
  });

  it("relierAccords relie les notes du même pas, même à un arrondi près", () => {
    const n = (hand: "L" | "R", beat: number) => ({ hand, beat }) as Note;
    const ev = [n("L", 1), n("R", 1 / 3), n("L", enTemps(4) + 1e-12), n("R", 0.5)];
    relierAccords(ev);
    expect([ev[0].grp, ev[3].grp]).toEqual([undefined, undefined]);
    expect(ev[1].grp).toEqual([ev[1], ev[2]]);
  });

  it("toutes les notes générées, de toutes les difficultés, tombent sur la grille : positions et durées", () => {
    for (const { chanson } of CHANSONS) {
      for (const e of chanson.ev) {
        expect(surLaGrille(e.beat)).toBe(true);
        expect(surLaGrille(e.dur)).toBe(true);
      }
      for (const c of chanson.chanteurs) for (const n of c.notes) expect(surLaGrille(n.beat)).toBe(true);
    }
  });
});

describe("motifs de basse en triolets", () => {
  const ch = makeChord(0, [0, "M"]);

  it("un motif de 12 signes joue trois notes par temps, un motif de 8 des croches, comme avant", () => {
    const triolets = notesDeBasse("SWSS..T--...", 2, ch, "polyrythmie", false);
    expect(triolets.map((n) => [pas(n.beat) - pas(8), n.lane, pas(n.dur)])).toEqual([
      [0, 0, 0],
      [4, 1, 0],
      [8, 0, 0],
      [12, 0, 0],
      [24, 0, 12],
    ]);
    // Le triolet s'écrit toujours de la même façon (enTemps), pour que les égalités tiennent
    expect(triolets[1].beat).toBe(enTemps(2 * 48 + 4));
    expect(notesDeBasse("S..W..T-", 1, ch, "couplet", false).map((n) => [n.beat, n.dur])).toEqual([
      [4, 0],
      [5.5, 0],
      [7, 1],
    ]);
  });

  it("un motif d'une autre longueur est refusé", () => {
    expect(() => notesDeBasse("SWSSW", 0, ch, "couplet", false)).toThrow(/5 signes/);
  });
});

describe("la section en 3 contre 2 dans le générateur", () => {
  it.each(["debutant", "facile", "normal"])("en %s, jamais de polyrythmie", (diff) => {
    expect(DIFFS[diff].polyrythmie).toBeNull();
    for (const c of dans(diff)) {
      expect(sectionPoly(c)).toBeUndefined();
      expect(c.ev.every((e) => surLaCroche(e.beat))).toBe(true);
    }
  });

  it("en Difficile, une partie des chansons l'ont, entre le dernier refrain et l'outro, sans toucher au solo", () => {
    const avec = dans("difficile").filter(sectionPoly);
    expect(avec.length).toBeGreaterThanOrEqual(GRAINES.length / 4);
    expect(avec.length).toBeLessThan(GRAINES.length);
    for (const c of avec) {
      const sec = sectionPoly(c),
        i = c.sections.indexOf(sec);
      expect([sec.name, sec.bars]).toEqual([NOM_POLYRYTHMIE, 4]);
      expect([c.sections[i - 1].kind, c.sections[i + 1].kind]).toEqual(["refrain", "outro"]);
      // Ce n'est pas un solo libre : la reprise du solo (ADR-0012) garde son solo et son refrain
      expect(estSolo(sec)).toBe(false);
      const { solo, refrain } = soloEtRefrain(c.sections);
      expect([solo.name, refrain]).toEqual(["Solo libre", c.sections[i - 1]]);
    }
  });

  it("la basse joue en triolets et la mélodie en croches, deux par temps où la basse en joue trois", () => {
    for (const c of dans("difficile").filter(sectionPoly)) {
      const sec = sectionPoly(c),
        notes = notesDe(c, sec),
        basse = notes.filter((e) => e.hand === "L"),
        melodie = notes.filter((e) => e.hand === "R");
      expect(notes.every((e) => e.kind === "polyrythmie")).toBe(true);
      expect(basse.filter((e) => !surLaCroche(e.beat)).length).toBeGreaterThanOrEqual(16);
      expect(melodie.every((e) => surLaCroche(e.beat) && e.dur === 0)).toBe(true);
      // Chaque note joue le degré de l'accord de sa mesure (ADR-0003), et la phrase se pose sur la fondamentale
      for (const e of melodie) expect(e.midi).toBe(c.chords[e.bar].lanes[e.lane]);
      expect(melodie.at(-1).lane).toBe(0);
      for (let t = sec.start * 4; t < (sec.start + sec.bars) * 4; t++) {
        const dansLeTemps = (e: Note) => pas(e.beat) >= pas(t) && pas(e.beat) < pas(t + 1);
        if (basse.filter(dansLeTemps).length === 3) expect(melodie.filter(dansLeTemps).length).toBe(2);
      }
      // Sur le temps, basse et mélodie forment un accord à deux mains
      const premier = melodie[0];
      expect(premier.grp?.some((e) => e.hand === "L")).toBe(true);
    }
  });

  it("avec ou sans la section, le reste de la chanson ne change pas : elle ne fait que s'allonger", () => {
    const sauve = DIFFS.difficile.polyrythmie;
    try {
      for (const graine of GRAINES) {
        const avec = buildSong(graine, "difficile"),
          sec = sectionPoly(avec);
        if (!sec) continue;
        DIFFS.difficile.polyrythmie = null;
        const sans = buildSong(graine, "difficile");
        DIFFS.difficile.polyrythmie = sauve;
        const fin = sec.start * 4,
          decale = sec.bars * 4;
        expect(avec.ev.filter((e) => e.beat < fin).map(resume)).toEqual(
          sans.ev.filter((e) => e.beat < fin).map(resume),
        );
        expect(
          avec.ev.filter((e) => e.beat >= fin + decale).map((e) => [e.hand, e.beat - decale, e.lane, e.midi]),
        ).toEqual(sans.ev.filter((e) => e.beat >= fin).map((e) => [e.hand, e.beat, e.lane, e.midi]));
      }
    } finally {
      DIFFS.difficile.polyrythmie = sauve;
    }
  });

  it("la mélodie se tire de la graine : la même à chaque fois, jamais en dehors des couloirs", () => {
    const chords = [0, 1, 2, 3].map(() => makeChord(5, [0, "m"])),
      R = DIFFS.difficile.polyrythmie;
    let x = 0;
    const rng = () => (x = (x * 7 + 3) % 10) / 10;
    const a = melodieEnPolyrythmie(rng, R, 0, 4, chords);
    x = 0;
    const b = melodieEnPolyrythmie(rng, R, 0, 4, chords);
    expect(a.map(resume)).toEqual(b.map(resume));
    expect(a.length).toBe(18);
    expect(a.every((e) => e.lane >= 0 && e.lane <= 3)).toBe(true);
  });
});

describe("l'auto-play en triolets", () => {
  it("chaque note est prise par le pas du séquenceur qui la précède, une seule fois", () => {
    const c = dans("difficile").find(sectionPoly);
    Object.assign(S, { mode: "play", auto: true, practice: "both", song: c, ev: c.ev, autoQ: [] });
    for (const e of c.ev) [e.state, e.auto] = ["pending", undefined];
    const prises = new Map<Note, number>();
    for (let step = 0; step < c.totalBars * 16; step++)
      for (const e of autoNotes(step)) {
        expect(prises.has(e)).toBe(false);
        prises.set(e, step);
      }
    expect(prises.size).toBe(c.ev.length);
    for (const [e, step] of prises) expect(Math.floor(pas(e.beat) / 3)).toBe(step);
    // Dans la file de l'animation, chaque note garde son heure à elle
    const triolet = c.ev.find((e) => !surLaCroche(e.beat));
    expect(S.autoQ.find((q) => q.ev === triolet).at).toBeCloseTo((triolet.beat * 60) / c.bpm, 9);
    for (const e of c.ev) [e.state, e.auto] = ["pending", undefined];
  });
});

/* ---------- Dans le jeu ---------- */

let nav: Navigateur;
afterEach(() => nav?.fermer());

const spb = () => 60 / nav.jeu.state.song.bpm;
function attendre(t: number) {
  while (nav.jeu.songNow() < t) nav.image(t - nav.jeu.songNow() > 0.02 ? 1 / 60 : 0.001);
}
// Les touches d'un joueur parfait : W sauter et S glisser à gauche, J K L ; à droite
const touche = (ev: Note, lane: number) => (ev.hand === "L" ? (lane === 1 ? "KeyW" : "KeyS") : LANE_CODES[lane]);

describe("essai « polyrythmie »", () => {
  it("l'auto-play fait sonner chaque triolet à son heure, entre deux pas du séquenceur", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=polyrythmie" } });
    const S = nav.jeu.state;
    nav.presser("KeyA");
    const sec = sectionPoly(S.song),
      triolets = notesDe(S.song, sec).filter((e) => e.hand === "L" && !surLaCroche(e.beat));
    expect(triolets.length).toBeGreaterThanOrEqual(16);
    nav.avancerJusqua(() => nav.jeu.songNow() > (sec.start + sec.bars) * 4 * spb() + 0.5, 120);
    const { timeOfBeat } = await import("../src/audio/moteur");
    for (const e of triolets) {
      // Le son part à l'heure du triolet, qui tombe au moins 40 ms après le pas du séquenceur qui le précède
      const heure = timeOfBeat(e.beat);
      expect(nav.horloge.sons.some((s) => Math.abs(s.debut - heure) < 1e-6)).toBe(true);
      expect(heure - timeOfBeat(Math.floor(e.beat * 4) / 4)).toBeGreaterThan(0.04);
    }
    expect(S.miss).toBe(0);
  });

  it("joué au clavier des deux mains, sans faute, chaque triolet et chaque croche est réussi", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=polyrythmie" } });
    nav.presser("Space");
    const S = nav.jeu.state,
      sec = sectionPoly(S.song),
      notes = notesDe(S.song, sec);
    for (const e of evenementsClavier(notes, (beat) => beat * spb(), touche)) {
      attendre(e.at);
      faire(nav, e);
    }
    attendre((sec.start + sec.bars) * 4 * spb());
    nav.image();
    expect(notes.map((e) => e.state)).toEqual(notes.map(() => "hit"));
  });

  it.each(["L", "R"] as const)(
    "en mode une main (%s), le joueur joue sa grille et l'auto-play l'autre, sans faute",
    async (main) => {
      nav = await Navigateur.ouvrir({ adresse: { search: "?essai=polyrythmie" } });
      nav.jeu.setPractice(main);
      nav.presser("Space");
      const S = nav.jeu.state,
        sec = sectionPoly(S.song),
        notes = notesDe(S.song, sec);
      expect(S.practice).toBe(main);
      for (const e of evenementsClavier(
        notes.filter((n) => n.hand === main),
        (beat) => beat * spb(),
        touche,
      )) {
        attendre(e.at);
        faire(nav, e);
      }
      attendre((sec.start + sec.bars) * 4 * spb());
      nav.image();
      expect(notes.map((e) => e.state)).toEqual(notes.map(() => "hit"));
      expect(notes.filter((e) => e.auto).every((e) => e.hand !== main)).toBe(true);
    },
  );

  it("en boucle sur la section (ADR-0009), l'auto-play rejoue les triolets sans en rater", async () => {
    nav = await Navigateur.ouvrir();
    const graine = GRAINES.find((g) => sectionPoly(buildSong(g, "difficile")));
    nav.jeu.load(graine, "difficile");
    const S = nav.jeu.state,
      i = S.song.sections.findIndex((s) => s.kind === "polyrythmie"),
      sec = S.song.sections[i];
    nav.jeu.setBoucle(i);
    nav.presser("KeyA");
    const temps = () => (nav.jeu.songNow() * S.song.bpm * S.vitessePartie) / 60;
    nav.avancerJusqua(() => temps() >= (sec.start + 2 * sec.bars) * 4 + 1, 120);
    expect([S.mode, S.miss]).toEqual(["play", 0]);
    const n = notesDe(S.song, sec).length;
    expect(S.bouclePartie.passages.slice(0, 2)).toEqual([0, 1].map(() => ({ parfait: n, bien: 0, rate: 0 })));
  });
});
