// Chanteur (#18) : le séquenceur fait chanter sa phrase à l'heure exacte (ADR-0004), quoi que joue le joueur, et
// dans chaque passage d'une boucle (ADR-0009). Ici, il joue la chanson pas à pas sur des instruments espions.

import { describe, expect, it, vi } from "vitest";
import * as instruments from "../src/audio/instruments";
import { playStep } from "../src/audio/sequenceur";
import { buildSong } from "../src/chanson/generateur";
import { S } from "../src/jeu/etat";

vi.mock("../src/audio/instruments", () =>
  Object.fromEntries(
    [
      "arpV",
      "chantV",
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

/** Joue les pas de `de` à `a` (exclu) et renvoie les appels du chanteur : [pas, note, durée en temps] */
function chants(de: number, a: number) {
  const chantV = vi.mocked(instruments.chantV);
  chantV.mockClear();
  for (let step = de; step < a; step++) playStep(step, step);
  return chantV.mock.calls.map(([t, m, d]) => [t, m, Math.round((d / (60 / S.song.bpm)) * 1000) / 1000]);
}

describe("le séquenceur fait chanter le chanteur", () => {
  it("ses quatre notes, chacune sur son pas, tenues presque jusqu'à la suivante", () => {
    Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", song: buildSong(GRAINE, "normal") });
    S.ev = S.song.ev;
    const [ch] = S.song.chanteurs,
      fins = [...ch.notes.slice(1).map((n) => n.beat), (ch.bar + 1) * 4];
    expect(chants(0, S.song.totalBars * 16)).toEqual(
      ch.notes.map((n, i) => [n.beat * 4, n.midi, Math.round(0.85 * (fins[i] - n.beat) * 1000) / 1000]),
    );
  });

  it("en Débutant, personne ne chante", () => {
    Object.assign(S, structuredClone(ETAT_NEUF), {
      diff: "debutant",
      mode: "play",
      song: buildSong(GRAINE, "debutant"),
    });
    S.ev = S.song.ev;
    expect(chants(0, S.song.totalBars * 16)).toEqual([]);
  });

  it("en boucle sur le couplet, il chante à chaque passage", () => {
    const song = buildSong(GRAINE, "facile"),
      sec = song.sections.find((s) => s.kind === "couplet");
    Object.assign(S, structuredClone(ETAT_NEUF), { diff: "facile", mode: "play", song });
    S.ev = song.ev;
    S.bouclePartie = { sec, cree: 1, passages: [] };
    const [ch] = song.chanteurs,
      debut = sec.start * 16,
      longueur = sec.bars * 16;
    const pas = chants(debut, debut + 3 * longueur).map(([t]) => t);
    expect(pas).toEqual([0, 1, 2].flatMap((k) => ch.notes.map((n) => n.beat * 4 + k * longueur)));
  });
});
