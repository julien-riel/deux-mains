// Formes des couloirs (#31) : chaque couloir se reconnaît à sa forme, et les couleurs des mains et des couloirs
// restent distinctes pour une personne protanope ou deutéranope.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ecart, hex, hsl, type Vision } from "./support/daltonisme";
import { Navigateur } from "./support/navigateur";

const VISIONS: Vision[] = ["normale", "protanopie", "deuteranopie"];

let nav: Navigateur;
afterEach(() => nav?.fermer());

// Le contexte 2D du faux navigateur ne dessine rien : on y branche des espions sur les tracés
async function espionnerDessin() {
  const outils = await import("../src/rendu/outils");
  const g = { arc: vi.fn(), rect: vi.fn(), lineTo: vi.fn() };
  Object.assign(outils.g, g);
  return { outils, g };
}

describe("formes des couloirs", () => {
  it("donne une forme différente à chaque couloir", async () => {
    nav = await Navigateur.ouvrir();
    const { FORMES } = await import("../src/rendu/outils");
    expect(FORMES).toEqual(["rond", "triangle", "carré", "losange"]);
  });

  it("trace un rond, un triangle, un carré et un losange", async () => {
    nav = await Navigateur.ouvrir();
    const { outils, g } = await espionnerDessin();
    const traces = [0, 1, 2, 3].map((i) => {
      for (const f of Object.values(g)) f.mockClear();
      outils.formeCouloir(i, 100, 100, 10);
      return { arc: g.arc.mock.calls.length, rect: g.rect.mock.calls.length, cotes: g.lineTo.mock.calls.length };
    });
    expect(traces).toEqual([
      { arc: 1, rect: 0, cotes: 0 },
      { arc: 0, rect: 0, cotes: 3 },
      { arc: 0, rect: 1, cotes: 0 },
      { arc: 0, rect: 0, cotes: 4 },
    ]);
  });

  it("revient aux ronds quand le réglage est coupé", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.setFormes(false);
    const { outils, g } = await espionnerDessin();
    for (const i of [0, 1, 2, 3]) outils.formeCouloir(i, 100, 100, 10);
    expect(g.arc).toHaveBeenCalledTimes(4);
    expect(g.rect).not.toHaveBeenCalled();
    expect(g.lineTo).not.toHaveBeenCalled();
  });

  it("dessine les formes sur la ligne de tir, dans les deux univers", async () => {
    nav = await Navigateur.ouvrir();
    const { outils, g } = await espionnerDessin();
    const carreSurLaCible = () =>
      g.rect.mock.calls.some(
        ([x, y, w]) => Math.abs(x + w / 2 - outils.HITX) < 1e-9 && Math.abs(y + w / 2 - outils.LANE_Y[2]) < 1e-9,
      );
    for (const univers of ["ville", "boite"] as const) {
      nav.jeu.setTheme(univers);
      nav.jeu.setFormes(true);
      g.rect.mockClear();
      nav.image();
      expect(carreSurLaCible()).toBe(true);
      nav.jeu.setFormes(false);
      g.rect.mockClear();
      nav.image();
      expect(carreSurLaCible()).toBe(false);
    }
  });
});

describe("réglage des formes", () => {
  it("est activé par défaut", async () => {
    nav = await Navigateur.ouvrir();
    expect(nav.jeu.state.formes).toBe(true);
  });

  it("est retenu d'une visite à l'autre", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.setFormes(false);
    expect(nav.stockage.get("deux-mains-formes")).toBe("non");
    nav.fermer();
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-formes": "non" } });
    expect(nav.jeu.state.formes).toBe(false);
    nav.jeu.setFormes(true);
    expect(nav.stockage.get("deux-mains-formes")).toBe("oui");
  });
});

describe("couleurs au simulateur de daltonisme", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const jeton = (nom: string) => css.match(new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})`, "i"))[1];

  it.each(VISIONS)("la main gauche et la main droite restent très différentes en vision %s", (vision) => {
    expect(ecart(hex(jeton("bass")), hex(jeton("mel")), vision)).toBeGreaterThan(40);
  });

  // Certaines paires se rapprochent (la fondamentale et la quinte en deutéranopie, vers ΔE 16) :
  // la couleur seule ne suffit pas toujours, d'où les formes. Mais aucune paire ne se confond.
  it.each(VISIONS)("les quatre couloirs gardent des couleurs distinctes en vision %s", async (vision) => {
    nav = await Navigateur.ouvrir();
    const { LANE_HUE } = await import("../src/rendu/outils");
    const couleurs = LANE_HUE.map((h) => hsl(h, 80, 68));
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) expect(ecart(couleurs[i], couleurs[j], vision)).toBeGreaterThan(10);
  });
});
