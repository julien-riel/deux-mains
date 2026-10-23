// Simulation de non-régression : une chanson entière, jouée dans chaque univers et chaque difficulté,
// dans un faux navigateur (tests/support/navigateur.ts) qui charge les modules de src/.

import { afterEach, describe, expect, it } from "vitest";
import { seuilTrille } from "../src/jeu/jugement";
import { Navigateur, type Difficulte, type Univers } from "./support/navigateur";

// Graine fixe (ADR-0005) : la même chanson à chaque passage
const GRAINE = 4242;
const UNIVERS: Univers[] = ["ville", "boite"];
const DIFFICULTES: Difficulte[] = ["debutant", "facile", "normal", "difficile"];

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
      // Les notes de la partie : la phrase du solo de l'auto-play revient au dernier refrain (ADR-0012)
      expect(etat.perfect).toBe(etat.ev.length);
      expect(etat.health).toBe(100);
      // Les pentes (#12), en Normal et en Difficile : tenues jusqu'au bout
      const pentes = etat.ev.filter((ev) => ev.fin !== undefined);
      expect(pentes.length > 0).toBe(difficulte === "normal" || difficulte === "difficile");
      expect(pentes.every((ev) => ev.state === "done")).toBe(true);
      // Les trilles (#15) n'existent qu'en Normal et en Difficile, et l'auto-play les réussit toutes ; cette
      // chanson-ci n'a pas de note longue en Difficile (le générateur est testé sur d'autres graines)
      const trilles = etat.ev.filter((ev) => ev.trille !== undefined);
      expect(trilles.length > 0).toBe(difficulte === "normal");
      expect(trilles.every((ev) => ev.state === "done" && ev.alternances >= seuilTrille(ev))).toBe(true);
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

    it("une note qui passe sans être jouée fait les dégâts prévus pour la difficulté", async () => {
      await chargerPartie(univers, difficulte);
      nav.presser("Space");
      const S = nav.jeu.state,
        { DIFFS } = await import("../src/chanson/difficultes"),
        D = DIFFS[difficulte];
      // Les notes du premier temps : une seule, ou un accord à deux mains
      const premieres = S.song.ev.filter((ev) => ev.beat === S.song.ev[0].beat);

      nav.avancerJusqua((e) => e.miss > 0, dureeChanson());

      expect(premieres.map((ev) => ev.state)).toEqual(premieres.map(() => "miss"));
      expect(S.miss).toBe(premieres.length);
      expect(S.health).toBe(100 - premieres.reduce((t, ev) => t + (ev.hand === "L" ? D.dmgL : D.dmgR), 0));
      // Elles passent après la fin de la fenêtre « Bien », pas avant
      expect(nav.jeu.songNow() - (premieres[0].beat * 60) / S.song.bpm).toBeGreaterThan(D.win[1]);
    });
  });
});

describe("difficulté retenue", () => {
  it("choisir Débutant recharge la chanson, et le choix est retenu à la visite suivante", async () => {
    await chargerPartie("ville", "normal");
    nav.jeu.load(GRAINE, "debutant");
    expect([nav.jeu.state.diff, nav.jeu.state.mode]).toEqual(["debutant", "title"]);
    expect(nav.stockage.get("deux-mains-diff")).toBe("debutant");
    nav.fermer();

    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-diff": "debutant" } });
    expect(nav.jeu.state.diff).toBe("debutant");
  });
});
