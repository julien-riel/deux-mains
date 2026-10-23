// Duo local (#6) : deux joueurs sur un clavier, un par main. Le réglage est retenu, personne n'est joué
// automatiquement, le HUD et l'écran de fin montrent chaque joueur, et la reprise rend à chacun ses coups.
// Le comptage séparé par main est testé sans navigateur dans jugement.test.ts.

import { afterEach, describe, expect, it } from "vitest";
import type { Note } from "../src/chanson/types";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005)
const GRAINE = 4242;

let nav: Navigateur;
afterEach(() => nav?.fermer());

const dureeChanson = () => (nav.jeu.state.song.endBeat * 60) / nav.jeu.state.song.bpm;
const aDeuxMains = (ev: Note) => !!ev.grp && ev.grp.some((e) => e.hand === "L") && ev.grp.some((e) => e.hand === "R");

async function partieEnDuo() {
  nav = await Navigateur.ouvrir();
  nav.jeu.setPractice("duo");
  nav.jeu.load(GRAINE, "normal");
  return nav.jeu.state;
}

describe("duo local (#6)", () => {
  it("le réglage « Duo » est retenu d'une visite à l'autre", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.setPractice("duo");
    expect(nav.stockage.get("deux-mains-hands")).toBe("duo");
    nav.fermer();

    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-hands": "duo" } });
    expect(nav.jeu.state.practice).toBe("duo");
    expect(nav.overlay.innerHTML).toContain(" · duo");
    expect(nav.overlay.innerHTML).toContain("Basse");
    expect(nav.overlay.innerHTML).toContain("Mélodie");
  });

  it("aucune note n'est jouée automatiquement : sans joueurs, l'harmonie commune s'épuise", async () => {
    const S = await partieEnDuo();
    nav.presser("Space");
    expect(S.autoUsed).toBe(false);

    nav.avancerJusqua((s) => s.mode !== "play", dureeChanson());

    expect(["dying", "dead"]).toContain(S.mode);
    expect(S.health).toBe(0);
    expect(S.song.ev.some((ev) => ev.auto)).toBe(false);
    expect(S.parMain.L.miss).toBeGreaterThan(0);
    expect(S.parMain.R.miss).toBeGreaterThan(0);
    expect(S.parMain.L.miss + S.parMain.R.miss).toBe(S.miss);
  });

  it("le HUD affiche le score et le combo de chaque joueur, le badge Duo et, discrètement, le total", async () => {
    const S = await partieEnDuo();
    nav.presser("Space");
    Object.assign(S.parMain.L, { score: 1234, combo: 12 });
    Object.assign(S.parMain.R, { score: 567, combo: 3 });
    S.score = 2001;
    nav.image();

    const t = nav.textes;
    expect(t).toEqual(expect.arrayContaining(["BASSE", "MÉLODIE", "DUO", "COMBO 12  ×1,5", "COMBO 3  ×1", "567"]));
    expect(t.some((s) => /^1\s234$/.test(s))).toBe(true);
    expect(t.some((s) => /^TOTAL 2\s001$/.test(s))).toBe(true);
  });

  it("hors duo, le HUD garde un seul score et un seul combo", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    nav.image();
    expect(nav.textes).not.toContain("BASSE");
    expect(nav.textes.some((s) => s.startsWith("TOTAL"))).toBe(false);
    expect(nav.textes.some((s) => s.startsWith("COMBO 0"))).toBe(true);
  });

  it("l'écran de fin compare les deux joueurs et compte les accords à deux mains réussis", async () => {
    const S = await partieEnDuo();
    nav.presser("KeyA");

    nav.avancerJusqua((s) => s.mode !== "play", dureeChanson() + 10);

    expect(S.mode).toBe("done");
    // Les notes de la partie : la phrase du solo de l'auto-play revient au dernier refrain (ADR-0012)
    const accords = new Set(S.ev.filter(aDeuxMains).map((ev) => ev.grp)).size;
    expect(accords).toBeGreaterThan(0);
    const html = nav.overlay.innerHTML;
    for (const texte of ["Basse", "Mélodie", "Précision", "Parfait", "Raté", "Combo max", "Score total"])
      expect(html).toContain(texte);
    expect(html).toContain(`Accords en duo : ${accords} / ${accords}`);
    // Les phrases en relais (#20) passent d'un joueur à l'autre : un autre exploit commun
    const relais = new Set(S.ev.filter((ev) => ev.relais !== undefined).map((ev) => ev.relais)).size;
    expect(relais).toBeGreaterThan(0);
    expect(html).toContain(`relais passés : ${relais} / ${relais}`);
    expect(S.parMain.L.perfect).toBe(S.ev.filter((ev) => ev.hand === "L").length);
    expect(S.parMain.R.perfect).toBe(S.ev.filter((ev) => ev.hand === "R").length);
  });

  it("l'essai duo s'ouvre en duo, et son écran de fin compare aussi les deux joueurs", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=duo" } });
    const S = nav.jeu.state;
    expect(S.practice).toBe("duo");
    const accords = new Set(S.song.ev.filter(aDeuxMains).map((ev) => ev.grp)).size;
    // Deux accords à deux mains par mesure de couplet et de refrain
    expect(accords).toBeGreaterThanOrEqual(2 * 12 - 2);
    nav.presser("KeyA");

    nav.avancerJusqua((s) => s.mode !== "play", dureeChanson() + 10);

    expect(nav.overlay.innerHTML).toContain("Essai terminé");
    expect(nav.overlay.innerHTML).toContain(`Accords en duo : ${accords} / ${accords}`);
  });

  it("après une mort, la reprise rend à chaque joueur ses coups du point de reprise, avec un combo neuf", async () => {
    const S = await partieEnDuo();
    nav.presser("Space");
    nav.avancerJusqua((s) => s.curSec?.kind === "couplet", 30);
    const L = { score: 500, combo: 7, maxCombo: 9, perfect: 4, good: 2, miss: 1 },
      R = { score: 800, combo: 5, maxCombo: 6, perfect: 3, good: 0, miss: 2 };
    Object.assign(S.cp, { parMain: { L, R }, accordsDuo: { reussis: 2, total: 3 } });

    nav.avancerJusqua((s) => s.mode === "dead", dureeChanson());
    nav.presser("KeyR");

    expect(S.mode).toBe("play");
    expect(S.parMain).toEqual({ L: { ...L, combo: 0 }, R: { ...R, combo: 0 } });
    expect(S.accordsDuo).toEqual({ reussis: 2, total: 3 });
  });
});
