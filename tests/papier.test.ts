// Le papier découpé de la scène de côté (#78) : la légende complète ne reste qu'en Débutant et dans les essais, la
// touche se montre au point d'impact ; les cordes des couloirs vibrent au tir réussi, cassent au raté et se renouent
// en moins d'une mesure. Parcours dans le faux navigateur ; le reste se vérifie à l'œil (essais papier-ville et
// papier-boite).

import { afterEach, describe, expect, it } from "vitest";
import type { Note } from "../src/chanson/types";
import { Navigateur, type Difficulte } from "./support/navigateur";

// Graine fixe (ADR-0005)
const GRAINE = 4242;
const TOUCHES = ["KeyJ", "KeyK", "KeyL", "Semicolon"];

let nav: Navigateur;
afterEach(() => nav?.fermer());

const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm) / 60;
// Une note simple de la mélodie : ni tenue, ni trille, ni serpent, ni petite note, ni accord de la main droite
const simple = (ev: Note) =>
  ev.hand === "R" &&
  ev.dur === 0 &&
  Number.isInteger(ev.lane) &&
  ev.trille === undefined &&
  !ev.serpent &&
  (!ev.grp || ev.grp.filter((e) => e.hand === "R").length === 1);

describe("légende", () => {
  it.each(["facile", "normal", "difficile"] as Difficulte[])(
    "en %s, la légende quitte la scène : la touche reste au point d'impact, l'accord pend en haut",
    async (diff) => {
      nav = await Navigateur.ouvrir();
      nav.jeu.load(GRAINE, diff);
      nav.presser("Space");
      nav.image();
      expect(nav.textes).not.toContain("FONDAMENTALE");
      expect(nav.textes).not.toContain("OCTAVE · 2× QUINTE");
      expect(nav.textes).toEqual(expect.arrayContaining(["J", "K", "L", ";", "W", "S"]));
      expect(nav.textes).toContain(nav.jeu.state.song.chords[0].name);
    },
  );

  it("en Débutant, la légende complète reste", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(GRAINE, "debutant");
    nav.presser("Space");
    nav.image();
    expect(nav.textes).toEqual(expect.arrayContaining(["FONDAMENTALE", "TIERCE", "QUINTE", "OCTAVE", "ACCORD"]));
  });

  it("dans un essai, la légende complète reste", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=papier-boite" } });
    nav.presser("KeyA");
    nav.image();
    expect(nav.textes).toEqual(expect.arrayContaining(["FONDAMENTALE", "OCTAVE · 2× QUINTE"]));
  });
});

describe("cordes", () => {
  it.each(["papier-ville", "papier-boite"])(
    "%s : un tir réussi fait vibrer la corde de son couloir ; un raté la casse, puis elle se renoue en moins d'une mesure",
    async (essai) => {
      nav = await Navigateur.ouvrir({ adresse: { search: `?essai=${essai}` } });
      const S = nav.jeu.state,
        cordes = await import("../src/rendu/cordes");
      nav.presser("Space");
      const notes = S.ev.filter((ev) => ev.hand === "R"),
        k = notes.findIndex((ev, i) => simple(ev) && notes[i + 1] && simple(notes[i + 1])),
        [juste, ratee] = [notes[k], notes[k + 1]];
      // Les notes d'avant ne comptent pas
      for (const ev of notes.slice(0, k)) ev.state = "skip";

      nav.avancerJusqua(() => temps() >= juste.beat, 30);
      nav.presser(TOUCHES[juste.lane]);
      nav.image();
      nav.relacher(TOUCHES[juste.lane]);
      expect(juste.state).toBe("hit");
      expect(cordes.etatDeLaCorde(juste.lane, performance.now())).toBe("vibre");

      nav.avancerJusqua(() => ratee.state === "miss", 10);
      expect(cordes.etatDeLaCorde(ratee.lane, performance.now())).toBe("cassee");
      // L'auto-play joue la suite ; une mesure plus tard, la corde est renouée et garde son nœud
      const casse = performance.now(),
        mesure = (4 * 60 * 1000) / S.song.bpm;
      S.auto = true;
      nav.avancerJusqua(() => performance.now() - casse >= cordes.CASSEE, 5);
      expect(cordes.etatDeLaCorde(ratee.lane, performance.now())).not.toBe("cassee");
      expect(cordes.CASSEE).toBeLessThan(mesure);
      expect(cordes.noeudsRenoues(performance.now()).some((n) => n.voie === ratee.lane && n.beat === ratee.beat)).toBe(
        true,
      );
    },
  );
});
