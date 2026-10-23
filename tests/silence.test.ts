// Le silence avant le refrain (#8) : pendant le dernier temps avant chaque refrain, l'accompagnement se tait. Le
// séquenceur le programme à l'avance (ADR-0004) ; ici, il joue la chanson pas à pas sur des instruments espions.

import { describe, expect, it, vi } from "vitest";
import { playStep } from "../src/audio/sequenceur";
import * as instruments from "../src/audio/instruments";
import { buildSong } from "../src/chanson/generateur";
import { S } from "../src/jeu/etat";
import { DIFFICULTES } from "./support/instantane";

vi.mock("../src/audio/instruments", () =>
  Object.fromEntries(
    [
      "arpV",
      "click",
      "crash",
      "harmV",
      "hat",
      "kick",
      "leadTimbre",
      "leadV",
      "padV",
      "playHit",
      "snare",
      "stringsV",
    ].map((k) => [k, vi.fn()]),
  ),
);

// Graine fixe (ADR-0005)
const GRAINE = 4242;
const ETAT_NEUF = { ...S };

/** Joue toute la chanson, avec un combo qui active toutes les couches, et renvoie les pas où chaque instrument a joué */
function parcourir(diff: string) {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff, mode: "play", combo: 40, song: buildSong(GRAINE, diff) });
  S.ev = S.song.ev;
  const pas = new Map<string, number[]>();
  for (let step = 0; step < S.song.totalBars * 16; step++) {
    vi.clearAllMocks();
    playStep(step, step);
    for (const [nom, f] of Object.entries(instruments))
      if (vi.mocked(f).mock.calls.length) pas.set(nom, [...(pas.get(nom) ?? []), step]);
  }
  return pas;
}
/** Le premier pas de chaque refrain */
const refrains = () => S.song.sections.filter((s) => s.kind === "refrain").map((s) => s.start * 16);

describe("silence avant le refrain", () => {
  it.each(DIFFICULTES)("en %s, ni batterie ni arpège pendant le dernier temps avant chaque refrain", (diff) => {
    const pas = parcourir(diff);
    expect(refrains()).toHaveLength(2);
    for (const nom of ["kick", "snare", "hat", "click", "arpV"])
      for (const d of refrains())
        expect(
          (pas.get(nom) ?? []).filter((s) => s >= d - 4 && s < d),
          nom,
        ).toEqual([]);
    // La batterie joue juste avant le silence, et repart sur le premier temps du refrain
    for (const d of refrains()) {
      expect(pas.get("hat")).toContain(d - 6);
      expect(pas.get("kick")).toContain(d);
    }
  });

  it("la nappe et les cordes de la mesure d'avant s'éteignent avant le silence, leur queue comprise", () => {
    parcourir("normal");
    const spb = 60 / S.song.bpm;
    vi.clearAllMocks();
    for (const d of refrains()) playStep(d - 16, 0);
    const nappes = vi.mocked(instruments.padV).mock.calls.map(([, , dur]) => dur as number),
      cordes = vi.mocked(instruments.stringsV).mock.calls.map(([, , dur]) => dur as number);
    expect([nappes.length, cordes.length]).toEqual([2, 2]);
    // La nappe s'éteint en 0,5 s après sa durée, les cordes en 0,8 s
    for (const dur of nappes) expect(dur + 0.5).toBeLessThanOrEqual(3 * spb + 1e-9);
    for (const dur of cordes) expect(dur + 0.8).toBeLessThanOrEqual(3 * spb + 1e-9);
  });

  it("ailleurs, la nappe tient toute la mesure", () => {
    parcourir("normal");
    const spb = 60 / S.song.bpm;
    vi.clearAllMocks();
    playStep(refrains()[0] + 16, 0);
    expect(vi.mocked(instruments.padV).mock.calls[0][2]).toBeCloseTo(4 * spb, 9);
  });

  it("le séquenceur ne joue plus la cymbale du refrain : elle vient de l'écrasement", () => {
    const pas = parcourir("normal"),
      outro = S.song.sections.find((s) => s.kind === "outro");
    expect(pas.get("crash")).toEqual([outro.start * 16]);
  });
});
