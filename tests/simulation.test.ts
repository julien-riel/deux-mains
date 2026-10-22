// Simulation de non-régression : une chanson entière, jouée dans chaque univers et chaque difficulté,
// dans un faux navigateur (tests/support/navigateur.ts) qui charge les modules de src/.

import { afterEach, describe, expect, it } from "vitest";
import { Navigateur, type Difficulte, type Univers } from "./support/navigateur";

// Graine fixe (ADR-0005) : la même chanson à chaque passage
const GRAINE = 4242;
const UNIVERS: Univers[] = ["ville", "boite"];
const DIFFICULTES: Difficulte[] = ["facile", "normal", "difficile"];

let nav: Navigateur;
afterEach(() => nav?.fermer());

async function chargerPartie(univers: Univers, difficulte: Difficulte) {
  nav = await Navigateur.ouvrir();
  nav.jeu.setTheme(univers);
  nav.jeu.load(GRAINE, difficulte);
  expect(nav.jeu.state.mode).toBe("title");
  return nav;
}

const dureeChanson = () => (nav.jeu.state.song.endBeat * 60) / nav.jeu.state.song.bpm;

describe.each(UNIVERS)("Univers %s", (univers) => {
  describe.each(DIFFICULTES)("difficulté %s", (difficulte) => {
    it("l'auto-play termine la chanson sans aucune note ratée", async () => {
      await chargerPartie(univers, difficulte);
      nav.presser("KeyA");
      expect(nav.jeu.state.mode).toBe("play");

      const etat = nav.avancerJusqua((e) => e.mode !== "play", dureeChanson() + 10);

      expect(etat.mode).toBe("done");
      expect(nav.overlay.hidden).toBe(false);
      expect(nav.overlay.innerHTML).toContain("Écoute terminée");
      expect(etat.miss).toBe(0);
      expect(etat.perfect).toBe(etat.song.ev.length);
      expect(etat.health).toBe(100);
    });

    it("une partie sans aucune touche pressée se termine par la mort", async () => {
      await chargerPartie(univers, difficulte);
      nav.presser("Space");
      expect(nav.jeu.state.mode).toBe("play");

      const etat = nav.avancerJusqua((e) => e.mode === "dead" || e.mode === "done", dureeChanson() + 10);

      expect(etat.mode).toBe("dead");
      expect(etat.health).toBe(0);
      expect(etat.perfect + etat.good).toBe(0);
      expect(nav.overlay.hidden).toBe(false);
      expect(nav.overlay.innerHTML).toContain("Reprendre");
    });
  });
});
