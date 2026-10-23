// Calibrage de la latence (#30) : la mesure du décalage, puis un joueur toujours en retard de 80 ms
// qui calibre et obtient ensuite des « Parfait ».

import { afterEach, describe, expect, it } from "vitest";
import { mesurerDecalage } from "../src/jeu/calibrage";
import { evenementsClavier, faire } from "./support/appuis";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005) : la même chanson à chaque passage
const GRAINE = 4242;
const RETARD = 0.08;
// Le double saut (#7) est un second appui sur sauter, en l'air ; l'écrasement (#8) se fait sur Espace
const TOUCHE: Record<string, string[]> = {
  L: ["KeyS", "KeyW", "KeyW", "Space"],
  R: ["KeyJ", "KeyK", "KeyL", "Semicolon"],
};

describe("mesure du décalage", () => {
  const clics = Array.from({ length: 16 }, (_, k) => 10 + k * 0.6);

  it("mesure un retard constant", () => {
    expect(
      mesurerDecalage(
        clics.map((c) => c + 0.08),
        clics,
      ),
    ).toBeCloseTo(0.08, 6);
  });

  it("mesure une avance, en négatif", () => {
    expect(
      mesurerDecalage(
        clics.map((c) => c - 0.03),
        clics,
      ),
    ).toBeCloseTo(-0.03, 6);
  });

  it("ignore les coups accidentels", () => {
    const coups = clics.map((c, k) => c + (k === 3 ? 0.25 : k === 9 ? -0.2 : 0.05));
    expect(mesurerDecalage(coups, clics)).toBeCloseTo(0.05, 6);
  });

  it("refuse de mesurer avec trop peu de coups", () => {
    expect(
      mesurerDecalage(
        clics.slice(0, 5).map((c) => c + 0.05),
        clics,
      ),
    ).toBeNull();
  });
});

let nav: Navigateur;
afterEach(() => nav?.fermer());

/** Avance jusqu'à l'heure audio voulue, image par image puis à la milliseconde près. */
function jusquaAudio(t: number) {
  while (nav.horloge.audio < t) nav.image(t - nav.horloge.audio > 0.02 ? 1 / 60 : 0.001);
}
// Le temps de la chanson tel qu'on l'entend, sans la correction du décalage
function jusquaChanson(t: number) {
  const S = nav.jeu.state;
  jusquaAudio(t + S.t0 - (S.startBeat * 60) / S.song.bpm);
}

/** Calibre en tapant sur Espace avec un retard constant sur chaque clic. */
function calibrer(retard: number) {
  nav.cliquer("#calibrer");
  const S = nav.jeu.state;
  expect(S.mode).toBe("calib");
  for (const c of S.calib.clics) {
    jusquaAudio(c + retard);
    nav.presser("Space");
    nav.relacher("Space");
  }
  nav.avancerJusqua((e) => e.calib.resultat !== undefined, 5);
  return S.calib.resultat;
}

/** Joue toute la chanson au clavier, chaque note avec le même retard sur ce qu'on entend. */
function jouerEnRetard(retard: number) {
  const S = nav.jeu.state,
    spb = 60 / S.song.bpm;
  const evenements = evenementsClavier(
    S.song.ev,
    (beat) => beat * spb + retard,
    (ev, lane) => TOUCHE[ev.hand][lane],
  );
  for (const e of evenements) {
    jusquaChanson(e.at);
    faire(nav, e);
  }
  return nav.avancerJusqua((e) => e.mode !== "play", 10);
}

describe("écran de calibrage", () => {
  it("affiche le décalage mesuré en millisecondes, puis l'applique et le garde", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");

    const resultat = calibrer(RETARD);

    expect(resultat).toBeCloseTo(RETARD, 2);
    expect(nav.overlay.innerHTML).toContain(`+${Math.round(resultat * 1000)} ms`);
    nav.presser("Enter");
    expect(nav.jeu.state.mode).toBe("title");
    expect(nav.jeu.state.decalage).toBe(Math.round(resultat * 1000) / 1000);
    expect(nav.stockage.get("deux-mains-decalage")).toBe(String(Math.round(resultat * 1000)));
  });

  it("un joueur en retard de 80 ms obtient des « Parfait » après calibrage", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    calibrer(RETARD);
    nav.presser("Enter");

    nav.presser("Space");
    const etat = jouerEnRetard(RETARD);

    expect(etat.mode).toBe("done");
    expect(etat.perfect).toBe(etat.song.ev.length);
  });

  it("sans calibrage, le même joueur n'obtient que des « Bien »", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");

    nav.presser("Space");
    const etat = jouerEnRetard(RETARD);

    expect(etat.mode).toBe("done");
    expect(etat.perfect).toBe(0);
    expect(etat.good).toBe(etat.song.ev.length);
  });

  it("le décalage est aussi appliqué à l'affichage", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-decalage": "80" } });
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    jusquaChanson(6);
    const { visualBeat } = await import("../src/rendu/scene");
    const S = nav.jeu.state;
    expect((visualBeat() * 60) / S.song.bpm).toBeCloseTo(6 - 0.08, 2);
  });

  it("au toucher, le coup compte à l'heure de l'événement", async () => {
    nav = await Navigateur.ouvrir({ tactile: true });
    nav.jeu.load(GRAINE, "normal");
    nav.cliquer("#calibrer");
    const S = nav.jeu.state;
    for (const c of S.calib.clics) {
      jusquaAudio(c + 0.1);
      nav.toucher(1, 600, 300, 0.03);
      nav.lever(1);
    }
    nav.avancerJusqua((e) => e.calib.resultat !== undefined, 5);
    expect(S.calib.resultat).toBeCloseTo(0.07, 2);
  });

  it("avec trop peu de coups, propose de recommencer", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.cliquer("#calibrer");
    const S = nav.jeu.state;
    for (const c of S.calib.clics.slice(0, 3)) {
      jusquaAudio(c);
      nav.presser("Space");
    }
    nav.avancerJusqua((e) => e.calib.resultat !== undefined, 15);
    expect(S.calib.resultat).toBeNull();
    expect(nav.overlay.innerHTML).toContain("Pas assez de coups");
    nav.presser("Enter");
    expect(S.mode).toBe("calib");
    expect(S.calib.resultat).toBeUndefined();
  });

  it("Échap annule sans changer le réglage", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-decalage": "40" } });
    nav.jeu.load(GRAINE, "normal");
    nav.cliquer("#calibrer");
    nav.presser("Escape");
    expect(nav.jeu.state.mode).toBe("title");
    expect(nav.jeu.state.decalage).toBe(0.04);
  });
});

describe("réglage à la main", () => {
  it("le champ Décalage change le réglage et le garde", async () => {
    nav = await Navigateur.ouvrir();
    nav.saisir("#decalage", "-40");
    expect(nav.jeu.state.decalage).toBe(-0.04);
    expect(nav.stockage.get("deux-mains-decalage")).toBe("-40");
  });

  it("le réglage gardé est repris à la visite suivante", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-decalage": "60" } });
    expect(nav.jeu.state.decalage).toBe(0.06);
  });

  it("le réglage reste entre −300 et +300 ms", async () => {
    nav = await Navigateur.ouvrir();
    nav.saisir("#decalage", "900");
    expect(nav.jeu.state.decalage).toBe(0.3);
  });
});
