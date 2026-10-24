// Le remontage entre deux lieux (#27, ADR-0015) : une seule mécanique pour les deux univers. Sa logique est pure
// (tours, jugement, auto-play, harmonie de départ) ; ses parcours passent par le faux navigateur, dans ses deux essais :
// au clavier, au toucher, au clavier MIDI, en duo, d'une seule main et en auto-play.

import { afterEach, describe, expect, it } from "vitest";
import type { Main } from "../src/chanson/types";
import {
  REMONTAGE,
  avancerRemontage,
  creerRemontage,
  harmonieDeDepart,
  jugerTour,
  passerRemontage,
  remontageFini,
  resultatRemontage,
} from "../src/jeu/remontage";
import { THEMES } from "../src/univers/univers";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

// Les fenêtres de jugement de la difficulté Normal, en secondes
const WIN: [number, number] = [0.055, 0.125];
const aucune = () => false;

describe("remontage (logique pure)", () => {
  it("une mesure de décompte, puis huit tours en quatre mesures, un tous les deux temps, main gauche d'abord", () => {
    const r = creerRemontage(0.5);
    expect(r.tours.map((t) => [t.temps, t.main, t.etat])).toEqual(
      [2, 3, 4, 5, 6, 7, 8, 9].map((temps, k) => [temps, k % 2 ? "R" : "L", "attente"]),
    );
    expect(r.fin).toBe((REMONTAGE.decompte + REMONTAGE.mesures * 4) * 0.5);
    expect([remontageFini(r, 9.99), remontageFini(r, 10)]).toEqual([false, true]);
  });

  it("un appui juge le tour le plus proche de sa main : parfait, bien, raté hors de la fenêtre, ignoré au-delà d'un temps", () => {
    const r = creerRemontage(0.5);
    // Trop loin de tout tour de la main gauche, ou un tour de l'autre main : rien
    expect(jugerTour(r, "L", 3, WIN)).toBeNull();
    expect(jugerTour(r, "L", 0.5, WIN)).toBeNull();
    expect(jugerTour(r, "L", 2.04, WIN)).toBe(r.tours[0]);
    expect(jugerTour(r, "R", 3 - 0.1, WIN)).toBe(r.tours[1]);
    // Trop tôt, mais à moins d'un temps : le tour est raté, on ne remonte pas en tapant sans arrêt
    expect(jugerTour(r, "L", 4 - 0.3, WIN)).toBe(r.tours[2]);
    // Un tour déjà jugé ne l'est plus
    expect(jugerTour(r, "L", 4, WIN)).toBeNull();
    expect(r.tours.slice(0, 3).map((t) => t.etat)).toEqual(["parfait", "bien", "rate"]);
  });

  it("le temps qui passe rate les tours manqués ; l'auto-play réussit les tours de ses mains à leur heure", () => {
    const r = creerRemontage(0.5);
    expect(avancerRemontage(r, 1.9, WIN, aucune)).toEqual({ joues: [], rates: [] });
    const gauche = (m: Main) => m === "L";
    const { joues, rates } = avancerRemontage(r, 2.0, WIN, gauche);
    expect([joues, rates]).toEqual([[r.tours[0]], []]);
    expect(r.tours[0]).toMatchObject({ etat: "parfait", auto: true });
    avancerRemontage(r, 10, WIN, gauche);
    expect(r.tours.map((t) => t.etat)).toEqual([
      "parfait",
      "rate",
      "parfait",
      "rate",
      "parfait",
      "rate",
      "parfait",
      "rate",
    ]);
    expect(resultatRemontage(r)).toEqual({ reussis: 4, total: 8, harmonie: 80 });
  });

  it("l'auto-play des deux mains réussit tout le remontage : harmonie de départ 100", () => {
    const r = creerRemontage(0.4);
    for (let t = 0; !remontageFini(r, t); t += 1 / 60) avancerRemontage(r, t, WIN, () => true);
    expect(resultatRemontage(r)).toEqual({ reussis: 8, total: 8, harmonie: 100 });
  });

  it("l'harmonie de départ va de 60 à 100 en ligne droite ; passer rate les tours qui restent", () => {
    expect([0, 1, 4, 7, 8].map((n) => harmonieDeDepart(n, 8))).toEqual([60, 65, 80, 95, 100]);
    expect(harmonieDeDepart(0, 0)).toBe(60);
    const r = creerRemontage(0.5);
    jugerTour(r, "L", 2, WIN);
    passerRemontage(r);
    expect(r.tours.filter((t) => t.etat === "rate")).toHaveLength(7);
    expect(resultatRemontage(r).harmonie).toBe(65);
  });
});

/* ---------- Parcours ---------- */
// L'heure du remontage en cours (le faux navigateur n'a ni latence ni décalage)
const heure = (n: Navigateur) => n.horloge.audio - n.jeu.state.remontage.debut;
/** Avance jusqu'à l'heure du tour k */
function attendreTour(n: Navigateur, k: number) {
  const tour = n.jeu.state.remontage.tours[k];
  n.avancerJusqua(() => heure(n) >= tour.temps, 10);
}
const finir = (n: Navigateur) => n.avancerJusqua((s) => s.mode !== "remontage", 30);
// Les fenêtres allumées de l'immeuble du groupe électrogène, à la dernière image
const fenetres = (n: Navigateur) => n.remplissages.filter((c) => c === "hsla(45,90%,68%,1)").length;

describe("essai remontage-boite", () => {
  it("A le remonte en auto-play : ressort de départ 100, puis l'auto-play joue la chanson sans faute", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=remontage-boite" } });
    const S = nav.jeu.state,
      R = THEMES.boite.remontage;
    expect([S.mode, S.theme, S.depart]).toEqual(["title", "boite", null]);
    expect(nav.overlay.innerHTML).toContain('data-act="remonter"');
    expect(nav.overlay.innerHTML).not.toContain('data-act="start"');

    nav.presser("KeyA");
    expect([S.mode, nav.overlay.hidden]).toEqual(["remontage", true]);
    nav.image();
    expect(nav.textes).toContain(R.titre);
    finir(nav);

    expect([S.mode, S.depart, S.health]).toEqual(["title", 100, 100]);
    expect(nav.overlay.innerHTML).toContain(`${R.depart} : 100 · 8 ${R.tours} sur 8`);
    expect(nav.overlay.innerHTML).toContain('data-act="start"');
    nav.presser("KeyA");
    expect(S.mode).toBe("play");
    nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
    expect([S.mode, S.miss, S.health]).toEqual(["done", 0, 100]);
  });

  it("au toucher et au clavier MIDI : la colonne gauche fait les tours de la gauche, la table MIDI ceux de la droite", async () => {
    nav = await Navigateur.ouvrir({
      tactile: true,
      midi: { permission: "granted", claviers: ["Clavier test"] },
      adresse: { search: "?essai=remontage-boite" },
    });
    const S = nav.jeu.state;
    nav.presser("Space");
    expect(S.mode).toBe("remontage");
    for (let k = 0; k < 8; k++) {
      attendreTour(nav, k);
      if (k % 2 === 0) {
        nav.toucher(1, 200, 450);
        nav.lever(1);
      } else nav.noteMidi(64);
    }
    finir(nav);
    expect([S.mode, S.depart]).toEqual(["title", 100]);
    expect(S.remontage.tours.every((t) => !t.auto)).toBe(true);
  });
});

describe("essai remontage-ville", () => {
  it("au clavier, en rythme : sept tours sur huit donnent un volume de départ de 95, et chacun rallume une rangée", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=remontage-ville" } });
    const S = nav.jeu.state,
      R = THEMES.ville.remontage;
    nav.presser("Space");
    expect(S.mode).toBe("remontage");
    nav.image();
    const avant = fenetres(nav);
    expect(nav.textes).toContain(R.titre);
    // Le dernier tour (main droite) est manqué
    for (let k = 0; k < 7; k++) {
      attendreTour(nav, k);
      nav.presser(k % 2 ? "KeyK" : "KeyW");
    }
    nav.avancerJusqua(() => heure(nav) > S.remontage.tours[7].temps - 0.5, 10);
    expect(fenetres(nav) - avant).toBe(7 * 4);
    finir(nav);

    expect([S.mode, S.depart]).toEqual(["title", 95]);
    expect(nav.overlay.innerHTML).toContain(`${R.depart} : 95 · 7 ${R.tours} sur 8`);
    nav.presser("Space");
    expect([S.mode, S.health]).toEqual(["play", 95]);
  });

  it("R recommence le remontage, Échap le passe : les tours qui restent sont ratés, volume de départ 60", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=remontage-ville" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    nav.presser("Escape");
    expect([S.mode, S.depart, S.health]).toEqual(["title", 60, 60]);
    nav.presser("KeyR");
    expect(S.mode).toBe("remontage");
    finir(nav);
    expect(S.depart).toBe(60);
    // Recommencer la chanson garde son harmonie de départ ; une autre chanson repart à 100
    nav.presser("Space");
    expect(S.health).toBe(60);
    nav.presser("Escape");
    nav.presser("Enter");
    expect([S.mode, S.health]).toEqual(["play", 60]);
    nav.jeu.load(77, "normal");
    expect([S.depart, S.remontage, S.health]).toEqual([null, null, 100]);
  });

  it("d'une seule main, l'autre main tourne toute seule ; en duo, chaque joueur fait les tours de sa main", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=remontage-ville" } });
    const S = nav.jeu.state;
    nav.jeu.setPractice("L");
    nav.presser("Space");
    for (const k of [0, 2, 4, 6]) {
      attendreTour(nav, k);
      nav.presser("KeyS");
    }
    finir(nav);
    expect(S.depart).toBe(100);
    expect(S.remontage.tours.map((t) => !!t.auto)).toEqual([false, true, false, true, false, true, false, true]);

    nav.jeu.setPractice("duo");
    nav.presser("KeyR");
    for (let k = 0; k < 8; k++) {
      attendreTour(nav, k);
      // La main droite ne fait pas les tours de la gauche : le premier joueur manque les siens
      if (k % 2) nav.presser("KeyL");
    }
    finir(nav);
    expect([S.depart, S.remontage.tours.some((t) => t.auto)]).toEqual([80, false]);
  });
});
