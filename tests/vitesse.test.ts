// Vitesse de lecture (#4) : à 50 % et 75 %, tout ralentit ensemble, la chanson reste la même et les fenêtres de
// jugement gardent leur durée en millisecondes. Une partie ralentie est un entraînement, son score n'est pas classé.

import { afterEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import type { Chanson, Note } from "../src/chanson/types";
import { S, VITESSES, spb } from "../src/jeu/etat";
import { brancherEffets, rightPress, type Effets } from "../src/jeu/jugement";
import { evenementsClavier, faire } from "./support/appuis";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005) : la même chanson à chaque passage
const GRAINE = 4242;
// Le double saut (#7) est un second appui sur sauter, en l'air ; l'écrasement (#8) se fait sur Espace
const TOUCHE: Record<string, string[]> = {
  L: ["KeyS", "KeyW", "KeyW", "Space"],
  R: ["KeyJ", "KeyK", "KeyL", "Semicolon"],
};

describe("temps à vitesse réduite", () => {
  const ETAT_NEUF = { ...S };
  const effets = () =>
    Object.fromEntries(
      [
        "jouer",
        "couper",
        "reussite",
        "accord",
        "rate",
        "lache",
        "mauvaisCouloir",
        "solo",
        "vibrato",
        "tir",
        "phrase",
        "relais",
        "mourir",
      ].map((k) => [k, vi.fn()]),
    ) as unknown as { [K in keyof Effets]: ReturnType<typeof vi.fn> };
  const note = (beat: number, lane: number): Note => ({
    hand: "R",
    beat,
    lane,
    dur: 0,
    bar: Math.floor(beat / 4),
    kind: "couplet",
    midi: 60,
    state: "pending",
  });
  /** Une partie sur une chanson à 60 BPM : à 100 %, un temps dure une seconde */
  function partie(vitesse: number, ev: Note[]) {
    Object.assign(S, structuredClone(ETAT_NEUF), { mode: "play", vitessePartie: vitesse });
    S.song = { bpm: 60, ev, sections: [{ name: "Couplet", kind: "couplet", bars: 8, start: 0 }] } as unknown as Chanson;
    S.ev = ev;
    return ev;
  }

  it.each(VITESSES)("à %s, un temps dure 1 / vitesse secondes", (v) => {
    partie(v, []);
    expect(spb()).toBeCloseTo(1 / v, 12);
  });

  it.each(VITESSES)("à %s, les fenêtres « Parfait » et « Bien » gardent leur durée en secondes", (v) => {
    const spies = effets();
    brancherEffets(spies);
    const [parfait, bien] = DIFFS.normal.win;
    const [a, b, c] = partie(v, [note(4, 0), note(8, 1), note(12, 2)]);
    rightPress(0, 4 / v + parfait * 0.99);
    rightPress(1, 8 / v - bien * 0.99);
    rightPress(2, 12 / v + bien * 1.05);
    expect([a.state, b.state, c.state]).toEqual(["hit", "hit", "pending"]);
    expect(spies.reussite.mock.calls.map(([, p]) => p)).toEqual([true, false]);
  });
});

let nav: Navigateur;
afterEach(() => nav?.fermer());

async function ouvrir(vitesse: number, options = {}) {
  nav = await Navigateur.ouvrir(options);
  nav.jeu.setVitesse(vitesse);
  nav.jeu.load(GRAINE, "normal");
  return nav;
}
const dureeChanson = () => (nav.jeu.state.song.endBeat * 60) / nav.jeu.state.song.bpm;
const empreinte = (song: Chanson) =>
  JSON.stringify({
    bpm: song.bpm,
    chords: song.chords.map((ch) => ch.name),
    ev: song.ev.map(({ hand, beat, dur, lane, midi }) => [hand, beat, dur, lane, midi]),
  });

describe("réglage Vitesse", () => {
  it("la vitesse choisie est retenue à la visite suivante", async () => {
    await ouvrir(0.75);
    expect(nav.stockage.get("deux-mains-vitesse")).toBe("0.75");
    nav.fermer();

    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-vitesse": "0.75" } });
    expect(nav.jeu.state.vitesse).toBe(0.75);
    nav.fermer();

    // Une valeur inconnue revient à 100 %
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-vitesse": "3" } });
    expect(nav.jeu.state.vitesse).toBe(1);
  });

  it("la graine et la difficulté donnent la même chanson à toutes les vitesses", async () => {
    const empreintes = [];
    for (const v of VITESSES) {
      await ouvrir(v);
      nav.presser("Space");
      empreintes.push(empreinte(nav.jeu.state.song));
      nav.fermer();
    }
    expect(new Set(empreintes).size).toBe(1);
  });

  it("l'écran de départ et le HUD annoncent la vitesse quand elle n'est pas à 100 %", async () => {
    await ouvrir(0.5);
    expect(nav.overlay.innerHTML).toContain("vitesse 50 %");
    expect(nav.overlay.innerHTML).toContain(
      `${Math.round((2 * nav.jeu.state.song.totalBars * 4 * 60) / nav.jeu.state.song.bpm)} s`,
    );
    nav.jeu.setVitesse(1);
    expect(nav.overlay.innerHTML).not.toContain("vitesse");
  });

  it("à 50 %, une mesure dure deux fois plus longtemps, sons programmés et écho compris", async () => {
    await ouvrir(0.5);
    nav.presser("Space");
    const { B, timeOfBeat } = await import("../src/audio/moteur");
    const mesure = (4 * 60) / nav.jeu.state.song.bpm;
    expect(timeOfBeat(4) - timeOfBeat(0)).toBeCloseTo(2 * mesure, 9);
    expect(B.delay.delayTime.value).toBeCloseTo((0.75 * 2 * 60) / nav.jeu.state.song.bpm, 9);
  });

  it("changer la vitesse pendant la partie ne s'applique qu'au prochain départ", async () => {
    await ouvrir(1);
    nav.presser("Space");
    nav.avancerJusqua(() => nav.jeu.songNow() > 2, 5);
    const avant = nav.jeu.songNow();
    nav.jeu.setVitesse(0.5);
    nav.image();
    expect(nav.jeu.state.vitessePartie).toBe(1);
    expect(nav.jeu.songNow() - avant).toBeCloseTo(1 / 60, 6);
  });

  it.each(VITESSES)("à %s, l'auto-play termine la chanson sans note ratée, dans la durée attendue", async (v) => {
    await ouvrir(v);
    nav.presser("KeyA");
    const debut = nav.horloge.audio;

    const etat = nav.avancerJusqua((e) => e.mode !== "play", dureeChanson() / v + 10);

    expect(etat.mode).toBe("done");
    expect([etat.miss, etat.perfect]).toEqual([0, etat.ev.length]);
    expect(nav.horloge.audio - debut).toBeGreaterThan(dureeChanson() / v);
    expect(nav.horloge.audio - debut).toBeLessThan(dureeChanson() / v + 1);
    // Les trilles (#15) suivent la vitesse : l'auto-play les réussit toutes, même ralenti
    const trilles = etat.ev.filter((ev) => ev.trille !== undefined);
    expect(trilles.length).toBeGreaterThan(0);
    expect(trilles.every((ev) => ev.state === "done")).toBe(true);
  });
});

/** Joue toute la chanson au clavier, chaque note pile sur le temps */
function jouer() {
  const S = nav.jeu.state,
    t = (beat: number) => (beat * 60) / (S.song.bpm * S.vitessePartie);
  const evenements = evenementsClavier(S.song.ev, t, (ev, lane) => TOUCHE[ev.hand][lane]);
  for (const e of evenements) {
    while (nav.jeu.songNow() < e.at) nav.image(e.at - nav.jeu.songNow() > 0.02 ? 1 / 60 : 0.001);
    faire(nav, e);
  }
  return nav.avancerJusqua((e) => e.mode !== "play", 10);
}

describe("score d'une partie ralentie", () => {
  it("à 75 %, l'écran de fin indique « entraînement, score non classé »", async () => {
    await ouvrir(0.75);
    nav.presser("Space");
    const etat = jouer();

    expect(etat.mode).toBe("done");
    expect(etat.miss).toBe(0);
    expect(nav.overlay.innerHTML).toContain("entraînement, score non classé");
    expect(nav.overlay.innerHTML).toContain("Entraînement terminé");
  });

  it("à 100 %, la même partie est classée", async () => {
    await ouvrir(1);
    nav.presser("Space");
    jouer();

    expect(nav.overlay.innerHTML).toContain("précision");
    expect(nav.overlay.innerHTML).not.toContain("non classé");
  });
});
