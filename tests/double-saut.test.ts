// Double saut (#7) : un second appui sur sauter, en l'air, franchit un haut obstacle et joue la quinte au-dessus
// de l'octave. Parcours au clavier dans le faux navigateur, avec la main droite en auto-play.

import { afterEach, describe, expect, it } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { noteName } from "../src/chanson/theorie";
import type { Note } from "../src/chanson/types";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005)
const GRAINE = 4242;

let nav: Navigateur;
afterEach(() => nav?.fermer());

/** Une partie en Normal, main gauche seule, arrêtée juste avant le premier haut obstacle et le saut qui le précède */
async function avantLePremierHaut() {
  nav = await Navigateur.ouvrir();
  nav.jeu.load(GRAINE, "normal");
  nav.jeu.setPractice("L");
  nav.presser("Space");
  const S = nav.jeu.state,
    haut = S.ev.find((ev) => ev.hand === "L" && ev.lane === 2),
    saut = S.ev.filter((ev) => ev.hand === "L" && ev.beat < haut.beat).at(-1);
  // Les obstacles d'avant ne comptent pas : on ne joue que celui-ci
  for (const ev of S.ev) if (ev.hand === "L" && ev.beat < saut.beat) ev.state = "skip";
  return { S, saut, haut };
}
const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm) / 60;
function appuyerA(beat: number) {
  nav.avancerJusqua(() => temps() >= beat, 60);
  nav.presser("KeyW");
  nav.image();
  nav.relacher("KeyW");
}

describe("double saut", () => {
  it("deux appuis espacés d'une croche franchissent le haut obstacle", async () => {
    const { S, saut, haut } = await avantLePremierHaut();
    appuyerA(saut.beat);
    appuyerA(haut.beat);
    nav.avancerJusqua(() => temps() >= haut.beat + 1, 10);

    expect([saut.state, haut.state]).toEqual(["hit", "hit"]);
    expect([S.miss, S.health]).toEqual([0, 100]);
    expect(S.doubleAt).toBeGreaterThan(S.jumpAt);
  });

  it("un saut simple heurte le haut obstacle", async () => {
    const { S, saut, haut } = await avantLePremierHaut();
    appuyerA(saut.beat);
    nav.avancerJusqua(() => temps() >= haut.beat + 1, 10);

    expect([saut.state, haut.state]).toEqual(["hit", "miss"]);
    expect([S.miss, S.health]).toEqual([1, 100 - DIFFS.normal.dmgL]);
  });

  it("le rail de gauche affiche la note du double saut : la quinte au-dessus de l'octave", async () => {
    const { S } = await avantLePremierHaut();
    nav.image();
    const ch = S.song.chords[Math.max(0, Math.floor(temps() / 4))];
    expect(nav.textes).toContain(noteName(ch.bass + 12 + ch.ints[2]));
    expect(nav.textes).toContain("OCTAVE · 2× QUINTE");
  });

  it.each(["normal", "difficile"] as const)("en %s, l'auto-play réussit tous les doubles sauts", async (diff) => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, diff);
    nav.presser("KeyA");
    const S = nav.jeu.state,
      doubles = new Set<number>();
    while (S.mode === "play") {
      nav.image();
      doubles.add(S.doubleAt);
    }
    // Les notes de la partie, lues à la fin : la reprise du solo copie celles des phrases reprises (ADR-0012)
    const hauts: Note[] = S.ev.filter((ev) => ev.lane === 2 && ev.hand === "L");
    expect(hauts.length).toBeGreaterThan(0);
    expect(hauts.every((ev) => ev.state === "hit")).toBe(true);
    // Le personnage a fait un double saut pour chacun
    expect(doubles.size - 1).toBe(hauts.length);
    expect(S.miss).toBe(0);
  });
});
