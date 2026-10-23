// Trilles (#15) : un ennemi qui vibre entre deux couloirs voisins ; on alterne leurs deux touches pendant sa durée.
// Parcours au clavier dans le faux navigateur, sur l'essai « trilles », la main gauche en auto-play.

import { afterEach, describe, expect, it } from "vitest";
import { TRILLE, seuilTrille } from "../src/jeu/jugement";
import { LANE_CODES } from "../src/ui/touches";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm) / 60;
const attendre = (beat: number) => nav.avancerJusqua(() => temps() >= beat, 60);
function taper(code: string) {
  nav.presser(code);
  nav.image();
  nav.relacher(code);
}

/** L'essai lancé, et sa première trille jouée au clavier jusqu'à sa fin, en alternances régulières : leur nombre,
 * ou une fonction du seuil de la trille */
async function jouerLaPremiereTrille(alternances: number | ((seuil: number) => number)) {
  nav = await Navigateur.ouvrir({ adresse: { search: "?essai=trilles" } });
  nav.presser("Space");
  const S = nav.jeu.state,
    tr = S.ev.find((ev) => ev.trille !== undefined);
  attendre(tr.beat);
  taper(LANE_CODES[tr.lane]);
  const n = typeof alternances === "number" ? alternances : alternances(seuilTrille(tr));
  for (let k = 1; k <= n; k++) {
    attendre(tr.beat + (k * (tr.dur - 0.1)) / n);
    taper(LANE_CODES[k % 2 ? tr.trille : tr.lane]);
  }
  expect(tr.state).toBe("holding");
  attendre(tr.beat + tr.dur + 0.1);
  return { S, tr };
}

describe("trilles au clavier", () => {
  it("assez d'alternances réussissent la trille, et chacune en plus rapporte des points", async () => {
    const { S, tr } = await jouerLaPremiereTrille((seuil) => seuil + 2);
    expect([tr.state, tr.alternances, S.miss, S.health]).toEqual(["done", seuilTrille(tr) + 2, 0, 100]);
    expect(S.pops.some((p) => p.text === `Trille +${2 * TRILLE.bonus}`)).toBe(true);
  });

  it("sous le seuil, la trille est ratée : elle fait des dégâts et remet le combo à zéro", async () => {
    const { S, tr } = await jouerLaPremiereTrille(2);
    expect([tr.state, S.miss, S.combo]).toEqual(["miss", 1, 0]);
    expect(S.health).toBeLessThan(100);
    expect(S.pops.some((p) => p.text === "Raté")).toBe(true);
  });

  it("la pause pendant une trille la compte comme réussie, sans bonus", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=trilles" } });
    nav.presser("Space");
    const S = nav.jeu.state,
      tr = S.ev.find((ev) => ev.trille !== undefined);
    attendre(tr.beat);
    taper(LANE_CODES[tr.trille]);
    nav.presser("Escape");
    expect([S.mode, tr.state, S.miss]).toEqual(["pause", "done", 0]);
    expect(S.pops.some((p) => p.text === "Trille")).toBe(true);
  });

  it("rejouer l'essai remet à zéro les alternances de chaque trille", async () => {
    const { tr } = await jouerLaPremiereTrille(2);
    expect(tr.alternances).toBe(2);
    nav.presser("Escape");
    nav.presser("Enter");
    expect(nav.jeu.state.song.ev.every((ev) => ev.alternances === undefined && ev.dernier === undefined)).toBe(true);
  });
});
