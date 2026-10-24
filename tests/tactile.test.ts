// Commandes tactiles (ADR-0008) : une chanson entière jouée au doigt, l'heure du toucher, l'accord à un pouce,
// le doigt maintenu, et les écrans qui se manipulent au doigt.

import { afterEach, describe, expect, it } from "vitest";
import type { Note } from "../src/chanson/types";
import { COULOIRS } from "../src/jeu/etat";
import { actionAuPoint, zonesDansLaScene, zonesTactiles } from "../src/rendu/zones";
import { appuis, coupsAttendus } from "./support/appuis";
import { Navigateur, type Difficulte, type Univers } from "./support/navigateur";

// Graine fixe (ADR-0005) : la même chanson à chaque passage. Celle-ci a des accords de la main droite
// de Facile à Difficile (ils dépendent de la graine : certaines chansons n'en ont aucun en Facile et en Normal ;
// Débutant n'en a jamais).
const GRAINE = 4;
// Une chanson qui a des accords de deux notes à la main droite en Normal
const GRAINE_ACCORDS = 3;
const UNIVERS: Univers[] = ["ville", "boite"];
const DIFFICULTES: Difficulte[] = ["debutant", "facile", "normal", "difficile"];
// Le canvas fait 1200 × 620 : la colonne gauche prend un cinquième de la largeur (240), la rangée du bas un cinquième
// de la hauteur (de 496 à 620), coupée en quatre zones de 240 de large, de l'index à l'auriculaire
const ZONE_X = [360, 600, 840, 1080],
  RANGEE_Y = 560;

let nav: Navigateur;
afterEach(() => nav?.fermer());

async function partieTactile(univers: Univers = "ville", difficulte: Difficulte = "normal", graine = GRAINE) {
  nav = await Navigateur.ouvrir({ tactile: true });
  nav.jeu.setTheme(univers);
  nav.jeu.load(graine, difficulte);
  nav.toucherBouton("start");
  expect(nav.jeu.state.mode).toBe("play");
  return nav.jeu.state;
}

const spb = () => 60 / nav.jeu.state.song.bpm;
const temps = (ev: Note) => ev.beat * spb();

// Où poser le doigt : sur la colonne gauche, en haut pour sauter, en bas pour glisser ou écraser une plaque (#8) ;
// sur la zone du couloir, dans la rangée du bas
function position(ev: Note): [number, number] {
  if (ev.hand === "L") return [100, ev.lane === 1 || ev.lane === 2 ? 100 : 500];
  return [ZONE_X[ev.lane], RANGEE_Y];
}

/** Avance jusqu'au moment de la note, et renvoie le retard de l'image sur la note. */
function attendre(t: number) {
  while (nav.jeu.songNow() < t) nav.image();
  return nav.jeu.songNow() - t;
}

// L'auto-play joue jusqu'à peu avant ce moment, pour arriver vivant aux notes qui viennent tard dans la chanson
function avancerEnAuto(t: number) {
  nav.jeu.state.auto = true;
  attendre(t - 0.5);
  nav.jeu.state.auto = false;
}
const premierAccord = (S: { song: { ev: Note[] } }) =>
  S.song.ev.find((ev) => ev.hand === "R" && ev.grp?.filter((e) => e.hand === "R").length >= 2);

/**
 * Un joueur au doigt : il pose un doigt à l'heure exacte de chaque note (l'événement arrive à l'image suivante,
 * avec son horodatage), et le lève à la fin des notes tenues. Pour un accord de la main droite, un seul pouce.
 */
function jouerAuDoigt(maxSecondes: number) {
  const S = nav.jeu.state;
  const notes = S.song.ev.filter((ev) => ev.hand === "L" || !ev.grp || ev.grp.find((e) => e.hand === "R") === ev);
  // Une trille (#15) se joue en touchant tour à tour ses deux bandes
  const gestes = notes
    .flatMap((ev) => appuis(ev).map((a) => ({ ev: { ...ev, lane: a.lane }, at: a.beat * spb(), fin: a.fin })))
    .sort((a, b) => a.at - b.at);
  const leves: { at: number; doigt: number }[] = [];
  let i = 0,
    doigt = 1;
  const fin = nav.horloge.secondes + maxSecondes;
  while (S.mode === "play" && nav.horloge.secondes < fin) {
    nav.image();
    const t = nav.jeu.songNow();
    for (const l of leves.filter((l) => l.at <= t)) nav.lever(l.doigt, t - l.at);
    leves.splice(0, leves.length, ...leves.filter((l) => l.at > t));
    while (i < gestes.length && gestes[i].at <= t) {
      const g = gestes[i++];
      nav.toucher(doigt, ...position(g.ev), t - g.at);
      leves.push({ at: g.fin === null ? g.at + 0.05 : g.fin * spb(), doigt: doigt++ });
    }
  }
  return S;
}

describe("mode tactile", () => {
  it("s'active tout seul sur un écran tactile, et l'écran de départ s'y adapte", async () => {
    nav = await Navigateur.ouvrir({ tactile: true });
    expect(nav.classes.has("tactile")).toBe(true);
    expect(nav.overlay.innerHTML).toContain('data-act="reglages"');
    expect(nav.overlay.innerHTML).toContain("mode silencieux");
  });

  it("reste au clavier sur un ordinateur", async () => {
    nav = await Navigateur.ouvrir();
    expect(nav.classes.has("tactile")).toBe(false);
    expect(nav.overlay.innerHTML).not.toContain('data-act="reglages"');
    expect(nav.overlay.innerHTML).toContain("Gauche <kbd>W</kbd>");
  });

  it("le réglage Commandes force le clavier ou le tactile", async () => {
    nav = await Navigateur.ouvrir({ tactile: true });
    nav.jeu.setCommandes("clavier");
    expect(nav.classes.has("tactile")).toBe(false);
    nav.jeu.setCommandes("tactile");
    expect(nav.classes.has("tactile")).toBe(true);
  });
});

describe("zones fixes (ADR-0019, #79)", () => {
  it("la colonne gauche prend un cinquième de la largeur, la rangée un cinquième de la hauteur, la scène le reste", () => {
    const z = zonesTactiles(1200, 620);
    expect(z.scene).toEqual({ x: 240, y: 0, largeur: 960, hauteur: 496 });
    // La scène garde les proportions de l'écran : son image n'est pas déformée
    expect(z.scene.largeur / z.scene.hauteur).toBeCloseTo(1200 / 620, 9);
    expect(z.sauter.y + z.sauter.hauteur).toBeLessThan(310);
    expect(z.glisser.y).toBeGreaterThan(310);
    // Quatre zones égales, de gauche à droite, sous la scène
    expect(new Set(z.couloirs.map((c) => c.largeur)).size).toBe(1);
    z.couloirs.forEach((c, i) => {
      expect(c.y).toBeGreaterThanOrEqual(496);
      expect(c.x + c.largeur / 2).toBeCloseTo(ZONE_X[i], 9);
    });
  });

  it("donne l'action de chaque zone, et rien sur la scène", () => {
    expect(actionAuPoint(100, 100, 1200, 620)).toBe("sauter");
    expect(actionAuPoint(100, 500, 1200, 620)).toBe("glisser");
    expect(ZONE_X.map((x) => actionAuPoint(x, RANGEE_Y, 1200, 620))).toEqual(COULOIRS);
    expect(actionAuPoint(1200, 620, 1200, 620)).toBe("couloir3");
    expect(actionAuPoint(600, 300, 1200, 620)).toBeNull();
    // La même géométrie à n'importe quelle taille d'écran
    expect(actionAuPoint(50, 90, 210, 100)).toBe("couloir0");
    expect(actionAuPoint(40, 90, 210, 100)).toBe("glisser");
  });

  it("place les zones sous les quarts de la scène, dans son espace, pour les scènes qui veulent s'y aligner", () => {
    const zones = zonesDansLaScene(1200, 620);
    zones.forEach((c, i) => {
      expect(c.x + c.largeur / 2).toBeCloseTo(((i + 0.5) * 1200) / 4, 9);
      expect(c.y).toBeGreaterThanOrEqual(620);
    });
  });

  it("toucher la zone du majeur presse couloir1, quelle que soit la scène", async () => {
    const S = await partieTactile();
    const { COTE } = await import("../src/rendu/scenes/cote");
    const { SCENES_DESSINEES } = await import("../src/rendu/geometrie");
    // Une scène dont les couloirs ne sont plus à leur hauteur de côté : la zone ne la suit pas
    SCENES_DESSINEES.disque = { ...COTE, id: "disque", impact: () => ({ ...COTE.impact(0), y: 50 }) };
    for (const scene of ["cote", "disque"] as const) {
      S.scene = scene;
      nav.image();
      nav.toucher(1, ZONE_X[1], RANGEE_Y);
      expect(S.keys).toEqual({ couloir1: true });
      nav.lever(1);
    }
    delete SCENES_DESSINEES.disque;
  });

  it("un doigt posé sur la scène ne joue rien", async () => {
    const S = await partieTactile();
    const ev = S.song.ev.find((e) => e.hand === "R");
    nav.toucher(1, 700, 250, attendre(temps(ev)));
    expect(Object.values(S.keys).some(Boolean)).toBe(false);
    expect(ev.state).toBe("pending");
  });

  it("la zone d'un couloir s'allume pendant le temps qui précède sa note, et seulement elle", async () => {
    const S = await partieTactile();
    const { annonces, ANNONCE } = await import("../src/rendu/commandes");
    // Une note seule, sans autre note de son couloir dans les deux temps qui la précèdent
    const ev = S.song.ev.find(
      (e) =>
        e.hand === "R" &&
        Number.isInteger(e.lane) &&
        !e.grp &&
        !S.song.ev.some(
          (o) => o !== e && o.hand === "R" && o.lane === e.lane && o.beat < e.beat && o.beat >= e.beat - 2,
        ),
    );
    expect(annonces(ev.beat - ANNONCE - 0.5)[COULOIRS[ev.lane]] ?? 0).toBe(0);
    expect(annonces(ev.beat - ANNONCE / 2)[COULOIRS[ev.lane]]).toBeCloseTo(0.5, 9);
    expect(annonces(ev.beat)[COULOIRS[ev.lane]]).toBe(1);
    const autres = S.song.ev.filter((e) => e.hand === "R" && Math.abs(e.beat - ev.beat) <= ANNONCE);
    for (const l of [0, 1, 2, 3].filter((l) => !autres.some((e) => Math.floor(e.lane) === l)))
      expect(annonces(ev.beat)[COULOIRS[l]]).toBeUndefined();
    // Un obstacle allume la moitié de la colonne qui le joue
    const saut = S.song.ev.find((e) => e.hand === "L" && e.lane === 1);
    expect(annonces(saut.beat - 0.25).sauter).toBeCloseTo(0.75, 9);
  });

  it("en mode tactile, la scène se dessine dans le rectangle qui reste, et les six zones autour", async () => {
    await partieTactile();
    const { cadreDeLaScene } = await import("../src/rendu/geometrie");
    expect(cadreDeLaScene()).toEqual({ x: 240, y: 0, largeur: 960, hauteur: 496 });
    nav.image();
    for (const t of ["SAUTE", "GLISSE", "index", "majeur", "annulaire", "auriculaire"]) expect(nav.textes).toContain(t);
  });

  it("au clavier, aucune zone n'est dessinée et la scène occupe tout le canvas", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    nav.image();
    const { cadreDeLaScene } = await import("../src/rendu/geometrie");
    expect(cadreDeLaScene()).toEqual({ x: 0, y: 0, largeur: 1200, hauteur: 620 });
    for (const t of ["SAUTE", "GLISSE", "index", "majeur"]) expect(nav.textes).not.toContain(t);
  });
});

describe.each(UNIVERS)("au doigt, univers %s", (univers) => {
  it.each(DIFFICULTES)("une chanson entière en %s, sans aucune note ratée", async (difficulte) => {
    await partieTactile(univers, difficulte);
    const duree = nav.jeu.state.song.endBeat * spb();

    const etat = jouerAuDoigt(duree + 10);

    expect(etat.mode).toBe("done");
    expect(etat.miss).toBe(0);
    expect(etat.perfect).toBe(coupsAttendus(etat.song.ev));
    expect(etat.song.ev.every((ev) => ev.state === "hit" || ev.state === "done")).toBe(true);
  });
});

describe("jugement au doigt", () => {
  it("juge à l'heure du toucher, pas à l'heure où l'événement est traité", async () => {
    const S = await partieTactile();
    const ev = S.song.ev[0];
    const retard = attendre(temps(ev) + 0.1) + 0.1;
    nav.toucher(1, ...position(ev), retard);
    expect(S.perfect).toBe(1);
  });

  it("sans horodatage précis, le même toucher tardif ne serait que « Bien »", async () => {
    const S = await partieTactile();
    const ev = S.song.ev[0];
    attendre(temps(ev) + 0.1);
    nav.toucher(1, ...position(ev));
    expect(S.good).toBe(1);
    expect(S.perfect).toBe(0);
  });

  it("un pouce joue tout un accord de la main droite", async () => {
    const S = await partieTactile("ville", "normal", GRAINE_ACCORDS);
    const accord = premierAccord(S);
    avancerEnAuto(temps(accord));
    const droite = accord.grp.filter((e) => e.hand === "R");
    nav.toucher(1, ...position(droite[1]), attendre(temps(accord)));
    expect(droite.every((e) => e.state === "hit")).toBe(true);
  });

  it("au clavier, un accord demande toujours toutes ses touches", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE_ACCORDS, "normal");
    nav.presser("Space");
    const S = nav.jeu.state;
    const accord = premierAccord(S);
    avancerEnAuto(temps(accord));
    const [a, b] = accord.grp.filter((e) => e.hand === "R");
    attendre(temps(accord));
    nav.presser(["KeyJ", "KeyK", "KeyL", "Semicolon"][a.lane]);
    expect(a.state).toBe("hit");
    expect(b.state).toBe("pending");
  });

  it("un toucher hors de l'accord reste une erreur", async () => {
    const S = await partieTactile("ville", "normal", GRAINE_ACCORDS);
    const accord = premierAccord(S);
    avancerEnAuto(temps(accord));
    const couloirs = accord.grp.filter((e) => e.hand === "R").map((e) => e.lane);
    const ailleurs = [0, 1, 2, 3].find((l) => !couloirs.includes(l));
    nav.toucher(1, ZONE_X[ailleurs], RANGEE_Y, attendre(temps(accord)));
    expect(accord.grp.filter((e) => e.hand === "R").every((e) => e.state === "pending")).toBe(true);
    expect(S.combo).toBe(0);
  });

  it("le doigt maintenu tient un tunnel jusqu'au bout", async () => {
    const S = await partieTactile();
    const tunnel = S.song.ev.find((ev) => ev.hand === "L" && ev.dur > 0);
    avancerEnAuto(temps(tunnel));
    nav.toucher(1, ...position(tunnel), attendre(temps(tunnel)));
    expect(tunnel.state).toBe("holding");
    attendre(temps(tunnel) + tunnel.dur * spb());
    nav.lever(1);
    expect(tunnel.state).toBe("done");
  });

  it("le doigt levé trop tôt lâche le tunnel", async () => {
    const S = await partieTactile();
    const tunnel = S.song.ev.find((ev) => ev.hand === "L" && ev.dur > 0);
    avancerEnAuto(temps(tunnel));
    nav.toucher(1, ...position(tunnel), attendre(temps(tunnel)));
    attendre(temps(tunnel) + (tunnel.dur * spb()) / 2);
    nav.lever(1);
    expect(tunnel.state).toBe("broken");
  });

  it("les deux pouces agissent en même temps", async () => {
    const S = await partieTactile();
    const accord = S.song.ev.find((ev) => ev.hand === "L" && ev.grp?.some((e) => e.hand === "R"));
    const droite = accord.grp.find((e) => e.hand === "R");
    const retard = attendre(temps(accord));
    nav.toucher(1, ...position(accord), retard);
    nav.toucher(2, ...position(droite), retard);
    expect(accord.state === "hit" || accord.state === "holding").toBe(true);
    expect(droite.state === "hit" || droite.state === "holding").toBe(true);
  });
});

describe("écrans au doigt", () => {
  it("le bouton pause met la partie en pause sans jouer de note, et Continuer la reprend", async () => {
    const S = await partieTactile();
    nav.toucherPause();
    expect(S.mode).toBe("pause");
    expect(S.keys).toEqual({});
    expect(nav.overlay.innerHTML).toContain('data-act="continue"');
    nav.toucherBouton("continue");
    await Promise.resolve();
    expect(S.mode).toBe("play");
  });

  it("en portrait, la partie se met en pause", async () => {
    const S = await partieTactile();
    nav.orienter("portrait");
    expect(S.mode).toBe("pause");
  });

  it("au clavier, tourner l'écran ne change rien", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    nav.orienter("portrait");
    expect(nav.jeu.state.mode).toBe("play");
  });

  it("changer d'application met en pause, et la partie reprend là où elle était", async () => {
    const S = await partieTactile();
    attendre(4);
    nav.cacher(true);
    expect(S.mode).toBe("pause");
    const avant = nav.jeu.songNow();
    for (let i = 0; i < 60; i++) nav.image();
    nav.cacher(false);
    nav.toucherBouton("continue");
    await Promise.resolve();
    expect(S.mode).toBe("play");
    expect(nav.jeu.songNow()).toBeCloseTo(avant, 5);
  });

  it("après la mort, le bouton Reprendre se touche", async () => {
    const S = await partieTactile();
    nav.avancerJusqua((e) => e.mode === "dead", S.song.endBeat * spb() + 10);
    expect(S.mode).toBe("dead");
    nav.toucherBouton("resume");
    expect(S.mode).toBe("play");
  });

  it("depuis la pause, le bouton Recommencer repart du début", async () => {
    const S = await partieTactile();
    attendre(4);
    nav.toucherPause();
    nav.toucherBouton("restart");
    expect(S.mode).toBe("play");
    expect(nav.jeu.songNow()).toBeLessThan(0.5);
  });
});
