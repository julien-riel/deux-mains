// Auto-play et entraînement (#3) : le bot joue tout en « Parfait », l'entraînement ne joue que l'autre main,
// et l'improvisation du solo reste sur les couloirs de l'accord. Logique pure : les effets sont des espions.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSong } from "../src/chanson/generateur";
import type { Note } from "../src/chanson/types";
import { S, sectionAtBar } from "../src/jeu/etat";
import { autoHit, autoNotes, autoSolo } from "../src/jeu/autoplay";
import { brancherEffets, type Effets } from "../src/jeu/jugement";

// Graine fixe (ADR-0005), avec des accords et des notes tenues de Facile à Difficile (Débutant n'en a pas)
const GRAINE = 4;
const ETAT_NEUF = { ...S };

let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
beforeEach(() => {
  effets = Object.fromEntries(
    ["jouer", "couper", "reussite", "accord", "rate", "lache", "mauvaisCouloir", "solo", "tir", "mourir"].map((k) => [
      k,
      vi.fn(),
    ]),
  ) as typeof effets;
  brancherEffets(effets);
});

function partie(diff: string, reglages: Partial<typeof S> = {}) {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff, mode: "play", song: buildSong(GRAINE, diff) }, reglages);
  return S.song;
}
/** Le séquenceur parcourt la chanson pas à pas (double-croches) ; renvoie les notes que l'auto-play a prises. */
function parcourir() {
  const prises: Note[] = [];
  for (let step = 0; step < S.song.totalBars * 16; step++) prises.push(...autoNotes(step));
  return prises;
}

describe("auto-play", () => {
  it.each(["debutant", "facile", "normal", "difficile"])(
    "en %s, l'auto-play réussit toutes les notes en « Parfait »",
    (diff) => {
      const song = partie(diff, { auto: true });
      const prises = parcourir();
      expect(prises).toHaveLength(song.ev.length);
      expect(S.autoQ).toHaveLength(song.ev.length);
      for (const q of S.autoQ) autoHit(q.ev);
      expect(song.ev.every((ev) => ev.state === "hit" || ev.state === "holding")).toBe(true);
      expect([S.perfect, S.good, S.miss, S.health]).toEqual([song.ev.length, 0, 0, 100]);
      expect(effets.reussite.mock.calls.every(([, parfait]) => parfait)).toBe(true);
      if (diff === "debutant") expect(effets.accord).not.toHaveBeenCalled();
      else expect(effets.accord).toHaveBeenCalled();
    },
  );

  it("chaque note n'est prise qu'une fois, à l'heure de son temps", () => {
    const song = partie("normal", { auto: true });
    parcourir();
    expect(parcourir()).toEqual([]);
    const spb = 60 / song.bpm;
    for (const q of S.autoQ) expect(q.at).toBeCloseTo(q.ev.beat * spb, 9);
  });

  it("l'auto-play fait sauter, glisser et tirer le personnage comme un joueur", () => {
    const song = partie("difficile", { auto: true });
    const spb = 60 / song.bpm;
    const saut = song.ev.find((ev) => ev.hand === "L" && ev.lane === 1),
      tunnel = song.ev.find((ev) => ev.hand === "L" && ev.dur > 0),
      ennemi = song.ev.find((ev) => ev.hand === "R");
    autoHit(saut);
    expect([S.jumpAt, S.jumpAir]).toEqual([saut.beat * spb, saut.air * spb]);
    autoHit(tunnel);
    expect(S.slideUntil).toBeCloseTo((tunnel.beat + tunnel.dur) * spb, 9);
    autoHit(ennemi);
    expect(S.beams.at(-1)).toMatchObject({ lane: ennemi.lane, ok: true });
  });
});

describe("entraînement", () => {
  it("en « Main gauche seule », seules les notes de la main droite sont jouées automatiquement", () => {
    const song = partie("normal", { practice: "L" });
    const prises = parcourir();
    expect(prises.length).toBe(song.ev.filter((ev) => ev.hand === "R").length);
    expect(prises.every((ev) => ev.hand === "R")).toBe(true);
  });

  it("en « Main droite seule », seules les notes de la main gauche sont jouées automatiquement", () => {
    const song = partie("normal", { practice: "R" });
    const prises = parcourir();
    expect(prises.length).toBe(song.ev.filter((ev) => ev.hand === "L").length);
    expect(prises.every((ev) => ev.hand === "L")).toBe(true);
  });

  it("avec les deux mains, rien n'est joué automatiquement", () => {
    partie("normal");
    expect(parcourir()).toEqual([]);
  });
});

describe("solo libre", () => {
  const improviser = () => {
    const joues: number[] = [];
    for (let step = 0; step < S.song.totalBars * 16; step++) {
      const lane = autoSolo(step, sectionAtBar(Math.floor(step / 16)));
      if (lane !== null) joues.push(step, lane);
    }
    return joues;
  };

  it("l'improvisation reste sur les couloirs de l'accord, pendant le solo seulement", () => {
    const song = partie("normal", { auto: true });
    const solo = song.sections.find((s) => s.kind === "pont");
    const joues = improviser();
    expect(joues.length).toBeGreaterThan(0);
    for (let i = 0; i < joues.length; i += 2) {
      const [step, lane] = [joues[i], joues[i + 1]];
      expect(Math.floor(step / 16)).toSatisfy((b: number) => b >= solo.start && b < solo.start + solo.bars);
      expect(lane).toSatisfy((l: number) => Number.isInteger(l) && l >= 0 && l <= 3);
    }
  });

  it("l'improvisation avance par degrés voisins", () => {
    partie("normal", { auto: true });
    const lanes = improviser().filter((_, i) => i % 2 === 1);
    lanes.forEach((l, i) => i && expect(Math.abs(l - lanes[i - 1])).toBeLessThanOrEqual(1));
  });

  it("en « Main droite seule », le joueur improvise lui-même", () => {
    partie("normal", { practice: "R" });
    expect(improviser()).toEqual([]);
  });
});
