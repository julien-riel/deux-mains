// Générateur de chansons (#3) : la forme, le tempo, les degrés de l'accord (ADR-0003), les règles de chaque
// difficulté et les accords. Graines fixes (ADR-0005) : chaque règle est vérifiée sur les mêmes chansons à chaque passage.

import { describe, expect, it } from "vitest";
import { mulberry32, randomSeed } from "../src/chanson/aleatoire";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong } from "../src/chanson/generateur";
import { PROGS, makeChord, mtof, noteName } from "../src/chanson/theorie";
import type { Chanson, Note } from "../src/chanson/types";
import { DIFFICULTES, GRAINES, decrireChanson } from "./support/instantane";

// Toutes les chansons des graines de l'instantané, dans les quatre difficultés
const CHANSONS = DIFFICULTES.flatMap((diff) => GRAINES.map((graine) => ({ diff, chanson: buildSong(graine, diff) })));
const dans = (diff: string) => CHANSONS.filter((c) => c.diff === diff).map((c) => c.chanson);
const droite = (c: Chanson) => c.ev.filter((ev) => ev.hand === "R");
const gauche = (c: Chanson) => c.ev.filter((ev) => ev.hand === "L");
// Les accords d'une chanson : chaque groupe de notes jouées au même temps, une seule fois
const accords = (c: Chanson) => c.ev.filter((ev) => ev.grp && ev.grp[0] === ev).map((ev) => ev.grp);
const genre = (c: Chanson, ev: Note) => c.sections.find((s) => ev.bar >= s.start && ev.bar < s.start + s.bars).kind;

describe("aléatoire déterministe", () => {
  it("une même graine donne toujours la même suite de nombres", () => {
    const a = mulberry32(42),
      b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("une graine tirée au hasard est entre 1 et 99 999", () => {
    for (let i = 0; i < 200; i++) expect(randomSeed()).toSatisfy((g: number) => g >= 1 && g <= 99999);
  });
});

describe("théorie", () => {
  it("les quatre couloirs sont la fondamentale, la tierce, la quinte et l'octave de l'accord", () => {
    expect(makeChord(0, [0, "M"]).lanes).toEqual([60, 64, 67, 72]);
    expect(makeChord(9, [0, "m"]).lanes).toEqual([69, 72, 76, 81]);
    expect(makeChord(2, [5, "7"]).lanes).toEqual([67, 71, 74, 79]);
    expect(makeChord(0, [9, "m7"]).name).toBe("Am7");
  });

  it("la basse reste dans l'octave grave, de Do1 à Sol♯1", () => {
    for (let pc = 0; pc < 12; pc++) {
      const { bass, pc: p } = makeChord(pc, [0, "M"]);
      expect(bass % 12).toBe(p);
      expect(bass).toSatisfy((b: number) => b >= 33 && b <= 44);
    }
  });

  it("le La 4 est à 440 Hz, et les notes se nomment avec leur octave", () => {
    expect(mtof(69)).toBe(440);
    expect(mtof(81)).toBe(880);
    expect(noteName(60)).toBe("C4");
    expect(noteName(46)).toBe("Bb2");
  });
});

describe("générateur", () => {
  it("une même graine et une même difficulté donnent toujours la même chanson", () => {
    for (const diff of DIFFICULTES)
      for (const graine of GRAINES.slice(0, 5))
        expect(decrireChanson(buildSong(graine, diff))).toEqual(decrireChanson(buildSong(graine, diff)));
  });

  it("deux graines différentes donnent des chansons différentes", () => {
    for (const diff of DIFFICULTES) {
      const empreintes = new Set(GRAINES.map((graine) => decrireChanson(buildSong(graine, diff)).empreinte));
      expect(empreintes.size).toBe(GRAINES.length);
    }
  });

  it("la forme est fixe : Intro 2, Couplet 8, Refrain 8, Solo libre 4, Refrain 8, Outro 2 mesures", () => {
    for (const { chanson } of CHANSONS) {
      expect(chanson.sections.map((s) => [s.name, s.bars, s.start])).toEqual([
        ["Intro", 2, 0],
        ["Couplet", 8, 2],
        ["Refrain", 8, 10],
        ["Solo libre", 4, 18],
        ["Refrain", 8, 22],
        ["Outro", 2, 30],
      ]);
      expect(chanson.totalBars).toBe(32);
      expect(chanson.endBeat).toBe(128);
      expect(chanson.chords).toHaveLength(32);
    }
  });

  it("le tempo est entre 88 et 112 BPM, et la progression fait partie de la liste", () => {
    for (const { chanson } of CHANSONS) {
      expect(chanson.bpm).toSatisfy((bpm: number) => bpm >= 88 && bpm <= 112);
      expect(PROGS).toContain(chanson.prog);
    }
  });

  it("chaque note de la main droite est un degré de l'accord de sa mesure (ADR-0003)", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of droite(chanson)) {
        expect(ev.bar).toBe(Math.floor(ev.beat / 4));
        expect(ev.lane).toSatisfy((l: number) => l >= 0 && l <= 3);
        expect(ev.midi).toBe(chanson.chords[ev.bar].lanes[ev.lane]);
      }
  });

  it("chaque note de la main gauche est la fondamentale (glisser, écraser), l'octave (sauter) ou la quinte au-dessus (double saut)", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of gauche(chanson)) {
        const { bass, ints } = chanson.chords[ev.bar];
        // La pente descendante (#12) part de l'octave : tests/pentes.test.ts
        if (ev.fin !== undefined && ev.fin < ev.midi) expect(ev.midi).toBe(bass + 12);
        else expect(ev.midi).toBe([bass, bass + 12, bass + 12 + ints[2], bass][ev.lane]);
      }
  });

  it("le solo libre n'a aucun ennemi : on y joue ce qu'on veut", () => {
    for (const { chanson } of CHANSONS) expect(droite(chanson).filter((ev) => ev.kind === "pont")).toEqual([]);
  });

  it("les sauts durent moins que l'écart avec l'obstacle suivant, sauf celui qui précède un double saut", () => {
    for (const { chanson } of CHANSONS) {
      const ls = gauche(chanson);
      ls.forEach((ev, i) => {
        const ecart = i + 1 < ls.length ? ls[i + 1].beat - ev.beat : 2;
        expect(ev.air).toBeGreaterThan(0);
        if (ls[i + 1]?.lane !== 2) expect(ev.air).toBeLessThan(ecart);
      });
    }
  });

  it("le saut qui précède un double saut dure jusqu'au second appui, même joué en retard après un premier en avance", () => {
    for (const { diff, chanson } of CHANSONS) {
      const spb = 60 / chanson.bpm,
        bien = DIFFS[diff].win[1],
        ls = gauche(chanson);
      ls.forEach((ev, i) => ls[i + 1]?.lane === 2 && expect(ev.air * spb).toBeGreaterThan(0.5 * spb + 2 * bien));
    }
  });

  it("toutes les notes commencent à jouer, triées par temps", () => {
    for (const { chanson } of CHANSONS) {
      expect(chanson.ev.every((ev) => ev.state === "pending")).toBe(true);
      chanson.ev.forEach((ev, i) => i && expect(ev.beat).toBeGreaterThanOrEqual(chanson.ev[i - 1].beat));
    }
  });
});

describe("hauts obstacles (#7)", () => {
  const hauts = (c: Chanson) => gauche(c).filter((ev) => ev.lane === 2);

  it.each(["debutant", "facile"])("en %s, aucun haut obstacle", (diff) => {
    for (const chanson of dans(diff)) expect(hauts(chanson)).toEqual([]);
  });

  it.each(["normal", "difficile"])("en %s, chaque chanson a des hauts obstacles, au couplet et au refrain", (diff) => {
    for (const chanson of dans(diff)) {
      expect(new Set(hauts(chanson).map((ev) => ev.kind))).toEqual(new Set(["couplet", "refrain"]));
    }
  });

  it("chaque haut obstacle suit un saut, une croche plus tôt : les deux appuis sont espacés d'une croche", () => {
    for (const { chanson } of CHANSONS) {
      const ls = gauche(chanson);
      ls.forEach((ev, i) => ev.lane === 2 && expect([ls[i - 1].lane, ev.beat - ls[i - 1].beat]).toEqual([1, 0.5]));
    }
  });
});

describe("trilles (#15)", () => {
  const trilles = (c: Chanson) => droite(c).filter((ev) => ev.trille !== undefined);

  it.each(["debutant", "facile"])("en %s, aucune trille", (diff) => {
    for (const chanson of dans(diff)) expect(trilles(chanson)).toEqual([]);
  });

  it.each(["normal", "difficile"])("en %s, des chansons ont des trilles", (diff) => {
    expect(dans(diff).filter((c) => trilles(c).length > 0).length).toBeGreaterThanOrEqual(4);
  });

  it("une trille est une note longue qui alterne avec un degré voisin de l'accord, hors accord de la main droite", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of trilles(chanson)) {
        expect(ev.dur).toBeGreaterThanOrEqual(1);
        expect(Math.abs(ev.trille - ev.lane)).toBe(1);
        expect(ev.midiTrille).toBe(chanson.chords[ev.bar].lanes[ev.trille]);
        expect((ev.grp ?? []).filter((e) => e.hand === "R")).toEqual(ev.grp ? [ev] : []);
      }
  });
});

describe("serpents (#16)", () => {
  const serpents = (c: Chanson) => droite(c).filter((ev) => ev.serpent);

  it.each(["debutant", "facile"])("en %s, aucun serpent", (diff) => {
    for (const chanson of dans(diff)) expect(serpents(chanson)).toEqual([]);
  });

  it.each(["normal", "difficile"])("en %s, des chansons ont des serpents", (diff) => {
    expect(dans(diff).filter((c) => serpents(c).length > 0).length).toBeGreaterThanOrEqual(5);
  });

  it("un serpent traverse deux à quatre couloirs voisins dans un seul sens, chacun sur son degré de l'accord", () => {
    const longueurs = new Set<number>();
    for (const { chanson } of CHANSONS)
      for (const ev of serpents(chanson)) {
        const s = ev.serpent;
        longueurs.add(s.length);
        expect(s[0]).toBe(ev.lane);
        expect(s.length).toBeGreaterThanOrEqual(2);
        expect(s.length).toBeLessThanOrEqual(4);
        expect(new Set(s.slice(1).map((l, k) => l - s[k])).size).toBe(1);
        expect(Math.abs(s[1] - s[0])).toBe(1);
        expect(ev.midiSerpent).toEqual(s.map((l) => chanson.chords[ev.bar].lanes[l]));
        expect(ev.midi).toBe(ev.midiSerpent[0]);
        expect(ev.trille).toBeUndefined();
      }
    // Les trois longueurs existent
    expect([...longueurs].sort()).toEqual([2, 3, 4]);
  });

  it("chaque couloir dure une croche ou un temps, et le serpent reste dans sa mesure (un seul accord)", () => {
    for (const { diff, chanson } of CHANSONS)
      for (const ev of serpents(chanson)) {
        const pas = ev.dur / ev.serpent.length;
        expect(DIFFS[diff].mel.serpentPas.map((p: number) => p / 2)).toContain(pas);
        expect(ev.beat + ev.dur).toBeLessThanOrEqual((ev.bar + 1) * 4);
      }
  });

  it("aucune autre note de la main droite pendant un serpent, et au moins une croche avant la suivante", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of serpents(chanson)) {
        const autres = droite(chanson).filter((e) => e !== ev && e.beat >= ev.beat && e.beat < ev.beat + ev.dur + 0.5);
        expect(autres).toEqual([]);
        expect((ev.grp ?? []).filter((e) => e.hand === "R")).toEqual(ev.grp ? [ev] : []);
      }
  });

  it("les serpents ne déplacent pas le reste de la chanson : leurs notes gardent leurs temps", () => {
    // Sans serpent, la même graine donne la même chanson, où chaque serpent était une suite de notes
    for (const diff of ["normal", "difficile"]) {
      const P = DIFFS[diff].mel,
        avant = P.serpentP;
      for (const graine of GRAINES) {
        const avec = buildSong(graine, diff);
        P.serpentP = 0;
        const sans = buildSong(graine, diff);
        P.serpentP = avant;
        const hors = (c: Chanson, tous: Note[]) =>
          c.ev.filter((e) => !tous.some((s) => e.hand === "R" && e.beat >= s.beat && e.beat < s.beat + s.dur));
        const sp = serpents(avec),
          resume = (notes: Note[]) => notes.map(({ hand, beat, lane, dur, midi }) => [hand, beat, lane, dur, midi]);
        expect(resume(hors(avec, sp))).toEqual(resume(hors(sans, sp)));
        // La tête du serpent est la première note de sa suite
        for (const s of sp)
          expect(sans.ev.some((e) => e.hand === "R" && e.beat === s.beat && e.lane === s.lane)).toBe(true);
      }
    }
  });
});

describe("Débutant", () => {
  it("la main droite joue sur les temps uniquement, refrain compris", () => {
    for (const c of dans("debutant")) for (const ev of droite(c)) expect(ev.beat % 1).toBe(0);
  });

  it("la main droite n'a ni note tenue ni accord : une seule note à la fois", () => {
    for (const c of dans("debutant")) {
      expect(droite(c).filter((ev) => ev.dur > 0)).toEqual([]);
      for (const grp of accords(c)) expect(grp.filter((ev) => ev.hand === "R").length).toBeLessThan(2);
    }
  });

  it("les deux mains ne jouent jamais au même moment", () => {
    for (const c of dans("debutant")) {
      const temps = new Set(gauche(c).map((ev) => ev.beat));
      expect(droite(c).filter((ev) => temps.has(ev.beat))).toEqual([]);
      expect(accords(c)).toEqual([]);
    }
  });

  it("la main gauche a au plus un obstacle par mesure, et aucun tunnel", () => {
    for (const c of dans("debutant")) {
      const ls = gauche(c);
      expect(ls.filter((ev) => ev.dur > 0)).toEqual([]);
      for (let bar = 0; bar < c.totalBars; bar++) expect(ls.filter((ev) => ev.bar === bar).length).toBeLessThan(2);
    }
  });
});

describe("Facile", () => {
  it("au couplet, la main droite joue sur les temps uniquement", () => {
    for (const c of dans("facile"))
      for (const ev of droite(c).filter((ev) => genre(c, ev) === "couplet")) expect(ev.beat % 1).toBe(0);
  });

  it("la main droite n'a aucune note tenue", () => {
    for (const c of dans("facile")) expect(droite(c).filter((ev) => ev.dur > 0)).toEqual([]);
  });

  it("les deux mains ne jouent ensemble qu'au premier temps de chaque phrase de deux mesures", () => {
    for (const c of dans("facile"))
      for (const grp of accords(c))
        if (grp.some((ev) => ev.hand === "L") && grp.some((ev) => ev.hand === "R")) expect(grp[0].beat % 8).toBe(0);
  });
});

describe("accords", () => {
  it("les notes d'un même accord de la main droite sont sur des couloirs différents", () => {
    for (const { chanson } of CHANSONS)
      for (const grp of accords(chanson)) {
        const couloirs = grp.filter((ev) => ev.hand === "R").map((ev) => ev.lane);
        expect(new Set(couloirs).size).toBe(couloirs.length);
      }
  });

  it("les notes d'un accord sont jouées au même temps et partagent le même groupe", () => {
    for (const { chanson } of CHANSONS)
      for (const grp of accords(chanson)) {
        expect(grp.length).toBeGreaterThan(1);
        for (const ev of grp) {
          expect(ev.beat).toBe(grp[0].beat);
          expect(ev.grp).toBe(grp);
        }
      }
  });

  it("l'accord complet à trois notes n'existe qu'en Difficile, où chaque chanson en a", () => {
    const triades = (c: Chanson) => accords(c).filter((grp) => grp.filter((ev) => ev.hand === "R").length >= 3);
    for (const diff of ["debutant", "facile", "normal"]) for (const c of dans(diff)) expect(triades(c)).toEqual([]);
    for (const c of dans("difficile")) {
      expect(triades(c).length).toBeGreaterThan(0);
      for (const grp of triades(c))
        expect(grp.filter((ev) => ev.hand === "R").map((ev) => ev.lane)).toEqual(expect.arrayContaining([0, 1, 2]));
    }
  });
});

describe("difficultés", () => {
  it("les fenêtres se resserrent et les dégâts augmentent de Débutant à Difficile", () => {
    const [b, f, n, d] = DIFFICULTES.map((k) => DIFFS[k]);
    for (const i of [0, 1]) expect(b.win[i] > f.win[i] && f.win[i] > n.win[i] && n.win[i] > d.win[i]).toBe(true);
    for (const D of [b, f, n, d]) expect(D.win[0]).toBeLessThan(D.win[1]);
    expect(b.dmgL < f.dmgL && f.dmgL < n.dmgL && n.dmgL <= d.dmgL).toBe(true);
    expect(b.dmgR < f.dmgR && f.dmgR < n.dmgR && n.dmgR <= d.dmgR).toBe(true);
  });

  it("les réglages proposent Débutant, Facile, Normal et Difficile, dans cet ordre", () => {
    expect(Object.values(DIFFS).map((D) => D.label)).toEqual(["Débutant", "Facile", "Normal", "Difficile"]);
  });
});
