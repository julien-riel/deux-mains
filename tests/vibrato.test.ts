// Vibrato (#17) : pendant une note tenue de la main droite, tapoter une autre touche fait vibrer la voix et donne
// des points de style, sans casser la note. Parcours au clavier dans le faux navigateur, sur l'essai « vibrato »,
// la main gauche en auto-play.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../src/chanson/types";
import { VIBRATO } from "../src/jeu/jugement";
import { LANE_CODES } from "../src/ui/touches";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm) / 60;
const attendre = (beat: number) => nav.avancerJusqua(() => temps() >= beat, 60);
/** Tapote une touche, et renvoie les points marqués par l'appui lui-même : la basse en auto-play marque aussi */
function tapoter(code: string) {
  const avant = nav.jeu.state.score;
  nav.presser(code);
  const points = nav.jeu.state.score - avant;
  nav.image();
  nav.relacher(code);
  return points;
}

/** L'essai lancé, arrêté sur la première note tenue de la mélodie, touche enfoncée */
async function surLaPremiereTenue() {
  nav = await Navigateur.ouvrir({ adresse: { search: "?essai=vibrato" } });
  nav.presser("Space");
  const S = nav.jeu.state,
    tenue = S.ev.find((ev) => ev.hand === "R" && ev.dur > 0);
  attendre(tenue.beat);
  nav.presser(LANE_CODES[tenue.lane]);
  nav.image();
  return { S, tenue };
}
const autreCouloir = (ev: Note) => LANE_CODES[(ev.lane + 2) % 4];

describe("vibrato", () => {
  it("tapoter pendant la note tenue fait vibrer la voix et l'ennemi, et la note reste tenue jusqu'au bout", async () => {
    const { S, tenue } = await surLaPremiereTenue();
    expect(tenue.state).toBe("holding");
    const vibrer = vi.spyOn(tenue.voice, "vibrer");

    attendre(tenue.beat + 0.5);
    const [score, combo] = [S.score, S.combo];
    nav.presser(autreCouloir(tenue));
    const [style, comboApres] = [S.score - score, S.combo];
    nav.relacher(autreCouloir(tenue));
    nav.image();

    expect(vibrer).toHaveBeenCalledOnce();
    expect(tenue.state).toBe("holding");
    expect(tenue.vibreAt).toBeGreaterThan(0);
    expect([style, comboApres, S.miss]).toEqual([VIBRATO.points, combo, 0]);
    expect(S.pops.some((p) => p.text === `Vibrato +${VIBRATO.points}`)).toBe(true);

    attendre(tenue.beat + tenue.dur);
    nav.relacher(LANE_CODES[tenue.lane]);
    expect(tenue.state).toBe("done");
    expect([S.miss, S.health]).toEqual([0, 100]);
  });

  it("au-delà du plafond, le vibrato sonne encore mais ne rapporte plus", async () => {
    const { tenue } = await surLaPremiereTenue();
    const vibrer = vi.spyOn(tenue.voice, "vibrer"),
      n = VIBRATO.max + 2;
    let style = 0;
    for (let i = 1; i <= n; i++) {
      attendre(tenue.beat + (i * (tenue.dur - 0.2)) / n);
      style += tapoter(autreCouloir(tenue));
    }
    expect(vibrer).toHaveBeenCalledTimes(n);
    expect(style).toBe(VIBRATO.points * VIBRATO.max);
    expect(tenue.state).toBe("holding");
  });

  it("rejouer l'essai remet à zéro les tapotements de chaque note", async () => {
    const { tenue } = await surLaPremiereTenue();
    attendre(tenue.beat + 0.5);
    tapoter(autreCouloir(tenue));
    expect(tenue.vibrato).toBe(1);
    nav.presser("Escape");
    nav.presser("Enter");
    expect(nav.jeu.state.song.ev.every((ev) => ev.vibrato === undefined)).toBe(true);
  });
});
