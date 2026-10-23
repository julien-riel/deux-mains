// Reprise du solo (#9, ADR-0012) : les notes jouées au solo libre sont gardées, et la meilleure phrase revient
// dans une phrase sur deux du dernier refrain, dans les notes de la partie. La chanson de la graine ne change pas ;
// l'auto-play improvise à partir de la graine, donc sa reprise est toujours la même.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong } from "../src/chanson/generateur";
import type { Chanson, Note, Section } from "../src/chanson/types";
import { autoSolo } from "../src/jeu/autoplay";
import { S, sectionAtBar } from "../src/jeu/etat";
import { brancherEffets, rightPress, type Effets } from "../src/jeu/jugement";
import {
  improviser,
  meilleurePhrase,
  noter,
  phrasesReprises,
  reprendre,
  reprendreLeSolo,
  soloEtRefrain,
  type NoteDuSolo,
} from "../src/jeu/variations";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005) : Intro 0–1, Couplet 2–9, Refrain 10–17, Solo libre 18–21, Refrain 22–29, Outro 30–31
const GRAINE = 4242;
const SOLO: Section = { name: "Solo libre", kind: "pont", bars: 4, start: 18 };
const REFRAIN: Section = { name: "Refrain", kind: "refrain", bars: 8, start: 22 };
const ETAT_NEUF = { ...S };
const n = (croche: number, couloir: number): NoteDuSolo => ({ croche, couloir });
// Les notes du dernier refrain de la main droite, dans les phrases reprises (mesures 24–25 et 28–29) ou non
const droite = (ev: Note[], de: number, a: number) =>
  ev.filter((e) => e.hand === "R" && e.bar >= de && e.bar <= a).map(({ beat, lane, midi }) => ({ beat, lane, midi }));

describe("le solo enregistré", () => {
  it("chaque note est recalée sur la croche la plus proche, une seule par croche, dans le solo seulement", () => {
    const solo: NoteDuSolo[] = [];
    noter(solo, 0.2, 1, 32);
    noter(solo, 2.6, 2, 32);
    noter(solo, 3.4, 0, 32); // même croche : la première note reste
    noter(solo, -0.6, 3, 32);
    noter(solo, 31.6, 3, 32);
    expect(solo).toEqual([n(0, 1), n(3, 2)]);
  });

  it("le solo et le dernier refrain se trouvent dans la forme de la chanson", () => {
    const song = buildSong(GRAINE, "normal");
    expect(soloEtRefrain(song.sections)).toEqual({ solo: SOLO, refrain: REFRAIN });
    expect(soloEtRefrain(song.sections.filter((s) => s.kind !== "pont"))).toBeNull();
    // La première phrase entre à l'écran avant la fin du solo : seules la deuxième et la quatrième sont reprises
    expect(phrasesReprises(REFRAIN)).toEqual([24 * 4, 28 * 4]);
    expect(phrasesReprises({ ...REFRAIN, bars: 4 })).toEqual([24 * 4]);
  });
});

describe("l'improvisation de l'auto-play", () => {
  it("est tirée de la graine : la même à chaque fois, différente d'une graine à l'autre", () => {
    expect(improviser(GRAINE, 32)).toEqual(improviser(GRAINE, 32));
    expect(improviser(GRAINE, 32)).not.toEqual(improviser(GRAINE + 1, 32));
  });

  it("avance par degrés voisins, sur les quatre couloirs, une croche sur deux à peu près", () => {
    const notes = improviser(GRAINE, 32);
    expect(notes.length).toBeGreaterThan(8);
    expect(notes.length).toBeLessThan(28);
    notes.forEach((x, i) => {
      expect(x.couloir).toSatisfy((c: number) => c >= 0 && c <= 3);
      if (i) expect(Math.abs(x.couloir - notes[i - 1].couloir)).toBeLessThanOrEqual(1);
    });
  });
});

describe("la meilleure phrase", () => {
  const normal = DIFFS.normal.mel;

  it("moins de trois notes au solo : pas de phrase", () => {
    expect(meilleurePhrase([], normal, 32)).toBeNull();
    expect(meilleurePhrase([n(0, 1), n(4, 2)], normal, 32)).toBeNull();
    expect(meilleurePhrase([n(0, 1), n(4, 2), n(9, 0)], normal, 32)).toEqual([n(0, 1), n(4, 2), n(9, 0)]);
  });

  it("garde les deux mesures qui ont le plus de notes, recomptées depuis le début de la phrase", () => {
    const solo = [n(1, 1), n(17, 1), n(20, 2), n(22, 3), n(26, 2)];
    expect(meilleurePhrase(solo, normal, 32)).toEqual([n(1, 1), n(4, 2), n(6, 3), n(10, 2)]);
  });

  it("à nombre égal, préfère la variété, puis une fin sur la fondamentale", () => {
    expect(meilleurePhrase([n(0, 1), n(2, 1), n(4, 1), n(16, 1), n(18, 2), n(20, 3)], normal, 32)).toEqual([
      n(0, 1),
      n(2, 2),
      n(4, 3),
    ]);
    expect(meilleurePhrase([n(0, 1), n(2, 2), n(4, 3), n(16, 1), n(18, 2), n(20, 0)], normal, 32)).toEqual([
      n(0, 1),
      n(2, 2),
      n(4, 0),
    ]);
  });

  it("garde au plus les notes de la difficulté, les plus fortes dans la mesure", () => {
    const solo = Array.from({ length: 16 }, (_, c) => n(c, c % 4));
    const phrase = meilleurePhrase(solo, normal, 32);
    expect(phrase).toHaveLength(normal.max);
    expect(phrase.map((x) => x.croche)).toEqual([0, 1, 2, 4, 6, 8, 10, 12, 14]);
    expect(meilleurePhrase(solo, DIFFS.debutant.mel, 32)).toHaveLength(DIFFS.debutant.mel.max);
  });

  it("en Débutant et en Facile, la phrase est recalée sur le temps", () => {
    for (const diff of ["debutant", "facile"] as const)
      expect(meilleurePhrase([n(1, 0), n(3, 1), n(4, 2), n(15, 3)], DIFFS[diff].mel, 16)).toEqual([
        n(2, 0),
        n(4, 1),
        n(14, 3),
      ]);
  });
});

describe("la phrase reprise dans les notes de la partie", () => {
  const phrase = [n(0, 0), n(3, 1), n(4, 2), n(12, 3), n(14, 0)];

  it("remplace la mélodie des phrases 2 et 4, sur les degrés de l'accord de chaque mesure, sans toucher à la chanson", () => {
    const song = buildSong(GRAINE, "normal"),
      avant = JSON.stringify(droite(song.ev, 0, 31)),
      ev = reprendre(song.ev, song.chords, REFRAIN, phrase);

    expect(JSON.stringify(droite(song.ev, 0, 31))).toBe(avant);
    for (const debut of [96, 112]) {
      const reprises = ev.filter((e) => e.hand === "R" && e.beat >= debut && e.beat < debut + 8);
      expect(reprises.map((e) => [e.beat - debut, e.lane])).toEqual(phrase.map((x) => [x.croche / 2, x.couloir]));
      for (const e of reprises) {
        expect([e.reprise, e.dur, e.kind, e.bar]).toEqual([true, 0, "refrain", Math.floor(e.beat / 4)]);
        expect(e.midi).toBe(song.chords[e.bar].lanes[e.lane]);
      }
    }
    // Les phrases 1 et 3, et tout le reste de la chanson, gardent les notes du générateur
    for (const [de, a] of [
      [0, 23],
      [26, 27],
      [30, 31],
    ])
      expect(droite(ev, de, a)).toEqual(droite(song.ev, de, a));
    expect(ev.filter((e) => e.bar < 24 || (e.bar > 25 && e.bar < 28) || e.bar > 29)).toEqual(
      song.ev.filter((e) => e.bar < 24 || (e.bar > 25 && e.bar < 28) || e.bar > 29),
    );
  });

  it("garde la basse, triée et reliée en accords à deux mains avec la phrase, par des copies", () => {
    const song = buildSong(GRAINE, "normal"),
      ev = reprendre(song.ev, song.chords, REFRAIN, phrase),
      basse = (l: Note[]) => l.filter((e) => e.hand === "L" && e.bar >= 24 && e.bar <= 25);
    expect(basse(ev).map(({ beat, lane, midi }) => [beat, lane, midi])).toEqual(
      basse(song.ev).map(({ beat, lane, midi }) => [beat, lane, midi]),
    );
    expect(basse(ev).some((e) => song.ev.includes(e))).toBe(false);
    ev.forEach((e, i) => i && expect(e.beat).toBeGreaterThanOrEqual(ev[i - 1].beat));
    const accord = ev.find((e) => e.beat === 96 && e.hand === "L");
    expect(accord.grp.map((e) => e.hand)).toEqual(["L", "R"]);
    expect(accord.grp.every((e) => e.grp === accord.grp)).toBe(true);
  });
});

/* ---------- Dans la partie, sans navigateur ---------- */
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
      "tir",
      "mourir",
    ].map((k) => [k, vi.fn()]),
  ) as typeof effets;
  brancherEffets(effets as unknown as Effets);
});
function partie(reglages: Partial<typeof S> = {}): Chanson {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", song: buildSong(GRAINE, "normal") });
  Object.assign(S, reglages);
  S.ev = S.song.ev;
  return S.song;
}
const spb = () => 60 / S.song.bpm;

describe("pendant la partie", () => {
  it("les tirs du solo sont gardés avec leur couloir et leur croche, ceux d'ailleurs non", () => {
    partie();
    rightPress(2, (SOLO.start * 4 + 1.02) * spb());
    rightPress(0, (SOLO.start * 4 + 7.4) * spb());
    rightPress(1, (REFRAIN.start * 4 + 1) * spb());
    expect(S.reprise.solo).toEqual([n(2, 2), n(15, 0)]);
  });

  it("à la fin du solo, la phrase est choisie une fois et revient dans les notes de la partie", () => {
    const song = partie();
    for (const [beat, lane] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [3.5, 0],
    ])
      rightPress(lane, (SOLO.start * 4 + beat) * spb());
    expect(reprendreLeSolo(REFRAIN.start * 4 - 0.1, DIFFS.normal.mel)).toBeNull();
    expect(S.ev).toBe(song.ev);

    expect(reprendreLeSolo(REFRAIN.start * 4, DIFFS.normal.mel)).toEqual([n(0, 0), n(2, 1), n(4, 2), n(7, 0)]);
    expect(S.reprise.faite).toBe(true);
    expect(S.ev.filter((e) => e.reprise).map((e) => e.beat)).toEqual([96, 97, 98, 99.5, 112, 113, 114, 115.5]);
    // Choisie une fois : le solo n'est plus écouté
    rightPress(3, (SOLO.start * 4 + 12) * spb());
    expect(reprendreLeSolo(REFRAIN.start * 4 + 1, DIFFS.normal.mel)).toBeNull();
    expect(S.reprise.solo).toHaveLength(4);
  });

  it("avec un solo de moins de trois notes, le dernier refrain reste celui du générateur", () => {
    const song = partie();
    rightPress(0, SOLO.start * 4 * spb());
    rightPress(2, (SOLO.start * 4 + 4) * spb());
    expect(reprendreLeSolo(REFRAIN.start * 4, DIFFS.normal.mel)).toBeNull();
    expect([S.reprise.faite, S.reprise.phrase, S.ev]).toEqual([true, null, song.ev]);
  });

  it("en boucle, rien n'est gardé ni repris", () => {
    const song = partie();
    S.bouclePartie = { sec: SOLO, cree: 1, passages: [] };
    for (let b = 0; b < 4; b++) rightPress(b, (SOLO.start * 4 + b) * spb());
    expect(S.reprise.solo).toEqual([]);
    expect(reprendreLeSolo(REFRAIN.start * 4, DIFFS.normal.mel)).toBeNull();
    expect(S.ev).toBe(song.ev);
  });

  it("l'improvisation de l'auto-play est gardée elle aussi, en auto-play comme en « Main gauche seule »", () => {
    for (const reglages of [{ auto: true }, { practice: "L" as const }]) {
      partie(reglages);
      const joues: NoteDuSolo[] = [];
      for (let step = SOLO.start * 16; step < REFRAIN.start * 16; step++) {
        const lane = autoSolo(step, sectionAtBar(Math.floor(step / 16)));
        if (lane !== null) joues.push(n(step / 2 - SOLO.start * 8, lane));
      }
      expect(joues).toEqual(improviser(GRAINE, 32));
      expect(S.reprise.solo).toEqual(joues);
    }
  });
});

/* ---------- Parcours complets, dans le faux navigateur ---------- */
let nav: Navigateur;
afterEach(() => nav?.fermer());

/** Le temps de la partie, en temps */
const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm * nav.jeu.state.vitessePartie) / 60;
/** Tape une touche au temps donné de la partie */
function taper(code: string, beat: number) {
  nav.avancerJusqua(() => temps() >= beat, 60);
  nav.presser(code);
  nav.relacher(code);
}
const repris = (ev: Note[]) => ev.filter((e) => e.reprise);

describe("la reprise en jouant", () => {
  it("en auto-play, la phrase du bot revient, annoncée, toujours la même pour la graine ; la chanson ne change pas", async () => {
    const parties: Note[][] = [];
    for (let i = 0; i < 2; i++) {
      nav = await Navigateur.ouvrir();
      nav.jeu.load(GRAINE, "normal");
      const S = nav.jeu.state;
      nav.presser("KeyA");
      nav.avancerJusqua((s) => s.reprise.faite, 120);
      expect(S.banner.sub).toBe("Le refrain reprend le solo");
      nav.avancerJusqua((s) => s.mode !== "play", 120);
      expect([S.mode, S.miss]).toEqual(["done", 0]);
      const phrase = meilleurePhrase(improviser(GRAINE, 32), DIFFS.normal.mel, 32);
      expect(S.reprise.phrase).toEqual(phrase);
      expect(repris(S.ev).map((e) => e.bar)).toEqual([
        ...phrase.map((x) => 24 + Math.floor(x.croche / 8)),
        ...phrase.map((x) => 28 + Math.floor(x.croche / 8)),
      ]);
      expect(repris(S.ev).every((e) => e.state === "hit")).toBe(true);
      // La chanson de la graine est intacte
      const neuve = buildSong(GRAINE, "normal");
      expect(droite(S.song.ev, 0, 31)).toEqual(droite(neuve.ev, 0, 31));
      parties.push(S.ev);
      nav.fermer();
    }
    expect(parties[0].map(({ beat, lane, hand }) => [beat, lane, hand])).toEqual(
      parties[1].map(({ beat, lane, hand }) => [beat, lane, hand]),
    );
  });

  it("dans l'essai, la main droite seule : le solo joué au clavier revient au refrain, transposé, avec une étoile", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=reprise-solo" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    const { solo, refrain } = soloEtRefrain(S.song.sections),
      b0 = solo.start * 4;
    expect(S.practice).toBe("R");
    taper("KeyJ", b0);
    taper("KeyK", b0 + 1);
    taper("KeyL", b0 + 2);
    taper("KeyJ", b0 + 3);
    expect(S.reprise.solo).toEqual([n(0, 0), n(2, 1), n(4, 2), n(6, 0)]);
    nav.avancerJusqua((s) => s.reprise.faite, 30);
    expect(S.banner.sub).toBe("Le refrain reprend ton solo");

    const reprises = repris(S.ev),
      debut = (refrain.start + 2) * 4;
    expect(reprises.map((e) => [e.beat, e.lane])).toEqual([
      [debut, 0],
      [debut + 1, 1],
      [debut + 2, 2],
      [debut + 3, 0],
      [debut + 16, 0],
      [debut + 17, 1],
      [debut + 18, 2],
      [debut + 19, 0],
    ]);
    for (const e of reprises) expect(e.midi).toBe(S.song.chords[e.bar].lanes[e.lane]);

    // Les ennemis repris, avec leur étoile, sont dessinés à l'écran avant d'arriver
    nav.avancerJusqua(() => temps() >= debut - 2, 30);
    expect(S.ev.some((e) => e.reprise && e.state === "pending")).toBe(true);
  });

  it("sans rien jouer au solo, le dernier refrain est celui du générateur", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=reprise-solo" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    const { solo } = soloEtRefrain(S.song.sections);
    taper("KeyJ", solo.start * 4 + 1);
    taper("KeyK", solo.start * 4 + 2);
    nav.avancerJusqua((s) => s.reprise.faite, 30);
    expect([S.reprise.phrase, S.ev === S.song.ev, repris(S.ev)]).toEqual([null, true, []]);
    expect(S.banner.sub).toBe("");
  });

  it("une mort après le solo garde la phrase à la reprise ; une mort pendant le solo efface ce qui a été joué", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=reprise-solo" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    const { solo, refrain } = soloEtRefrain(S.song.sections);
    for (let b = 0; b < 4; b++) taper(["KeyJ", "KeyK", "KeyL", "Semicolon"][b], solo.start * 4 + b);
    nav.avancerJusqua((s) => s.reprise.faite, 30);
    const phrase = S.reprise.phrase;
    expect(phrase).toHaveLength(4);
    S.health = 1;
    nav.avancerJusqua((s) => s.mode === "dead", 60);
    expect(S.cp.sec).toBe(refrain);
    nav.presser("KeyR");
    expect(S.mode).toBe("play");
    expect(S.reprise.phrase).toBe(phrase);
    expect(repris(S.ev).every((e) => e.state === "pending")).toBe(true);
    expect(repris(S.ev)).toHaveLength(8);
    nav.fermer();

    // Les deux mains au clavier : la basse ratée au solo fait mourir
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=reprise-solo" } });
    const T = nav.jeu.state;
    nav.jeu.setPractice("both");
    nav.presser("Space");
    taper("KeyJ", solo.start * 4 + 1);
    expect(T.reprise.solo).toHaveLength(1);
    T.health = 1;
    nav.avancerJusqua((s) => s.mode === "dead", 30);
    expect(T.cp.sec).toBe(soloEtRefrain(T.song.sections).solo);
    nav.presser("KeyR");
    expect([T.mode, T.reprise.solo, T.reprise.faite]).toEqual(["play", [], false]);
  });

  it("une nouvelle partie repart de la chanson de la graine", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    const S = nav.jeu.state;
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.mode !== "play", 120);
    expect(repris(S.ev).length).toBeGreaterThan(0);
    nav.presser("Enter");
    expect([S.mode, S.ev === S.song.ev, S.reprise.solo, S.reprise.faite]).toEqual(["play", true, [], false]);
  });

  it("en boucle sur le solo ou sur le dernier refrain, pas de reprise", async () => {
    for (const boucle of [3, 4]) {
      nav = await Navigateur.ouvrir();
      nav.jeu.load(GRAINE, "normal");
      nav.jeu.setBoucle(boucle);
      const S = nav.jeu.state;
      nav.presser("KeyA");
      nav.avancerJusqua(() => temps() >= (REFRAIN.start + 8) * 4 + 8, 120);
      expect([S.mode, S.reprise.solo, S.reprise.faite, repris(S.ev)]).toEqual(["play", [], false, []]);
      nav.fermer();
    }
  });
});
