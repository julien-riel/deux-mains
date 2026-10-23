// Écrasement (#8) : une plaque au premier temps de chaque refrain, à écraser sur Espace. L'accompagnement se tait
// pendant le temps qui précède (tests/silence.test.ts), et l'écrasement réussi joue la fondamentale accentuée avec
// une cymbale. Le générateur et le jugement sont de la logique pure ; les parcours au clavier passent par le faux
// navigateur.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong } from "../src/chanson/generateur";
import type { Chanson, Note } from "../src/chanson/types";
import { S } from "../src/jeu/etat";
import { brancherEffets, leftPress, type Effets } from "../src/jeu/jugement";
import { DIFFICULTES, GRAINES } from "./support/instantane";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005)
const GRAINE = 4242;
const ETAT_NEUF = { ...S };

const CHANSONS = DIFFICULTES.flatMap((diff) => GRAINES.map((graine) => ({ diff, chanson: buildSong(graine, diff) })));
const plaques = (c: Chanson) => c.ev.filter((ev) => ev.hand === "L" && ev.lane === 3);
const refrains = (c: Chanson) => c.sections.filter((s) => s.kind === "refrain");

describe("plaques du générateur", () => {
  it.each(DIFFICULTES)("en %s, une plaque au premier temps de chaque refrain, et nulle part ailleurs", (diff) => {
    for (const { chanson } of CHANSONS.filter((c) => c.diff === diff))
      expect(plaques(chanson).map((ev) => ev.beat)).toEqual(refrains(chanson).map((s) => s.start * 4));
  });

  it("la plaque joue la fondamentale de l'accord, et remplace la note de basse du même temps", () => {
    for (const { chanson } of CHANSONS)
      for (const p of plaques(chanson)) {
        expect([p.midi, p.dur, p.kind]).toEqual([chanson.chords[p.bar].bass, 0, "refrain"]);
        expect(chanson.ev.filter((ev) => ev.hand === "L" && ev.beat === p.beat)).toEqual([p]);
      }
  });
});

describe("jugement de l'écrasement", () => {
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
  // Une plaque au temps 8, à 60 BPM : un temps dure une seconde
  function partie() {
    const plaque: Note = { hand: "L", beat: 8, lane: 3, dur: 0, bar: 2, kind: "refrain", midi: 28, state: "pending" };
    Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", combo: 5 });
    S.song = { bpm: 60, ev: [plaque], sections: [{ name: "Refrain", kind: "refrain", bars: 4, start: 0 }] } as never;
    S.ev = S.song.ev;
    return S.ev[0];
  }

  it("écraser dans la fenêtre réussit la plaque et la fait sonner", () => {
    const plaque = partie();
    leftPress(3, 8 + DIFFS.normal.win[1] * 0.9);
    expect([plaque.state, S.combo, S.health]).toEqual(["hit", 6, 100]);
    expect(effets.jouer).toHaveBeenCalledWith(plaque, null);
    expect(S.ecraseAt).toBeCloseTo(8 + DIFFS.normal.win[1] * 0.9, 9);
  });

  it("sauter ou glisser sur la plaque est une erreur de la main gauche : dégâts et combo remis à zéro", () => {
    for (const lane of [0, 1]) {
      const plaque = partie();
      leftPress(lane, 8);
      expect([plaque.state, S.combo, S.health]).toEqual(["miss", 0, 100 - DIFFS.normal.dmgL]);
      expect(effets.jouer).not.toHaveBeenCalled();
    }
  });

  it("écraser loin d'une plaque ne fait rien", () => {
    const plaque = partie();
    leftPress(3, 7);
    expect([plaque.state, S.combo, S.health]).toEqual(["pending", 5, 100]);
  });
});

describe("écrasement au clavier", () => {
  let nav: Navigateur;
  afterEach(() => nav?.fermer());

  const spb = () => 60 / nav.jeu.state.song.bpm;
  // Les cymbales : un bruit de 1,9 s
  const cymbalesA = (t: number) =>
    nav.horloge.sons.filter((s) => Math.abs(s.fin - s.debut - 1.9) < 1e-9 && Math.abs(s.debut - t) < 0.05);

  /** Une partie en Normal, la main gauche jouée par l'auto-play jusqu'à peu avant la première plaque */
  async function avantLaPlaque() {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.jeu.setPractice("L");
    nav.presser("Space");
    nav.relacher("Space");
    const S = nav.jeu.state,
      plaque = S.ev.find((ev) => ev.hand === "L" && ev.lane === 3);
    S.auto = true;
    nav.avancerJusqua(() => nav.jeu.songNow() >= plaque.beat * spb() - 0.3, 60);
    S.auto = false;
    return { S, plaque };
  }
  const heureAudio = async (beat: number) => (await import("../src/audio/moteur")).timeOfBeat(beat);

  it("Espace sur la plaque la réussit, et l'impact sonne avec la cymbale", async () => {
    const { S, plaque } = await avantLaPlaque();
    nav.avancerJusqua(() => nav.jeu.songNow() >= plaque.beat * spb(), 1);
    nav.presser("Space");
    nav.relacher("Space");
    nav.avancerJusqua(() => nav.jeu.songNow() >= plaque.beat * spb() + 0.5, 1);
    expect(plaque.state).toBe("hit");
    expect(S.miss).toBe(0);
    expect(cymbalesA(await heureAudio(plaque.beat))).toHaveLength(1);
  });

  it("une plaque ratée fait les dégâts de la main gauche, remet le combo à zéro, et le refrain démarre sans l'impact", async () => {
    const { S, plaque } = await avantLaPlaque();
    const sante = S.health;
    nav.avancerJusqua(() => nav.jeu.songNow() >= plaque.beat * spb() + 0.5, 2);
    expect(plaque.state).toBe("miss");
    expect(S.health).toBe(sante - DIFFS.normal.dmgL);
    expect(S.combo).toBeLessThan(3);
    expect(cymbalesA(await heureAudio(plaque.beat))).toEqual([]);
  });

  it("en « Main droite seule », l'écrasement est joué automatiquement, avec l'impact", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.jeu.setPractice("R");
    nav.presser("Space");
    nav.relacher("Space");
    const S = nav.jeu.state,
      [p1, p2] = S.ev.filter((ev) => ev.hand === "L" && ev.lane === 3);
    nav.avancerJusqua(() => nav.jeu.songNow() >= p1.beat * spb() + 0.1, 60);
    expect([p1.state, p1.auto]).toEqual(["hit", true]);
    expect(S.ecraseAt).toBeCloseTo(p1.beat * spb(), 9);
    expect(cymbalesA(await heureAudio(p1.beat))).toHaveLength(1);
    expect(p2.state).toBe("pending");
  });

  it("l'écran de départ montre Espace parmi les touches de la main gauche, au clavier comme au doigt", async () => {
    nav = await Navigateur.ouvrir();
    expect(nav.overlay.innerHTML).toContain("Gauche <kbd>W</kbd> <kbd>S</kbd> <kbd>Espace</kbd>");
    nav.fermer();
    nav = await Navigateur.ouvrir({ tactile: true });
    expect(nav.overlay.innerHTML).toContain("en bas pour glisser ou écraser la plaque");
  });

  it("la fiche de la main gauche explique Espace", () => {
    const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    expect(page).toMatch(/<dt><kbd>Espace<\/kbd><\/dt>\s*<dd>Écraser la plaque/);
  });
});
