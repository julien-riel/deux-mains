// Mode jam (#24) : la chanson tourne sans fin, sans obstacles ni ennemis, et chaque touche joue le degré de l'accord
// en cours (ADR-0003), sans jugement. La logique pure se teste sans faux navigateur, les effets du jugement sont
// des espions ; les parcours (départ, boucle, sortie, deux univers) passent par le faux navigateur.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSong } from "../src/chanson/generateur";
import type { Note } from "../src/chanson/types";
import { trouverEssai } from "../src/essais/registre";
import { S, autoFor, chordAtBeat, mesureDeLaChanson, sansFin, sectionAtBar, spb, type Action } from "../src/jeu/etat";
import { basseDe, corpsDeLaChanson, noteDeJam } from "../src/jeu/jam";
import { brancherEffets, jouerEnJam, type Effets } from "../src/jeu/jugement";
import { THEMES } from "../src/univers/univers";
import { Navigateur } from "./support/navigateur";

const GRAINE = 4242;
const ETAT_NEUF = { ...S };

let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
beforeEach(() => {
  effets = Object.fromEntries(
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
      "trille",
      "glisser",
      "passage",
      "tir",
      "phrase",
      "relais",
      "mourir",
    ].map((k) => [k, vi.fn()]),
  ) as typeof effets;
  brancherEffets(effets as unknown as Effets);
});

/** Une jam sur la chanson de la graine, en cours de partie */
function enJam(reglages: Partial<typeof S> = {}) {
  const song = buildSong(GRAINE, "normal");
  Object.assign(S, structuredClone(ETAT_NEUF), { mode: "play", song, ev: [], jam: corpsDeLaChanson(song.sections) });
  Object.assign(S, reglages);
}
/** La note jouée par le dernier appel à `effets.jouer` */
const derniereNote = (): Note => effets.jouer.mock.lastCall[0];

describe("jam : logique pure", () => {
  it("rejoue le corps de la chanson, de la fin de l'intro au début de l'outro", () => {
    const { sections } = buildSong(GRAINE, "normal");
    const intro = sections[0],
      outro = sections[sections.length - 1];
    expect([intro.kind, outro.kind]).toEqual(["intro", "outro"]);
    expect(corpsDeLaChanson(sections)).toEqual({ start: intro.bars, bars: outro.start - intro.bars });
    // Sans intro ni outro, toute la chanson tourne
    const corps = sections.filter((s) => s.kind !== "intro" && s.kind !== "outro");
    expect(corpsDeLaChanson(corps)).toEqual({ start: corps[0].start, bars: outro.start - corps[0].start });
    expect(corpsDeLaChanson([intro])).toEqual({ start: 0, bars: intro.bars });
  });

  it("les notes d'un geste sont les degrés de l'accord, comme celles du générateur (ADR-0003)", () => {
    const song = buildSong(GRAINE, "normal");
    for (const ch of song.chords) {
      expect([0, 1, 2, 3].map((g) => noteDeJam("L", g, ch, 0, "couplet").midi)).toEqual([
        ch.bass,
        ch.bass + 12,
        ch.bass + 12 + ch.ints[2],
        ch.bass,
      ]);
      expect([0, 1, 2, 3].map((l) => noteDeJam("R", l, ch, 0, "refrain").midi)).toEqual(ch.lanes);
      expect(noteDeJam("R", 3, ch, 0, "refrain").harm).toBe(ch.lanes[1] + 12);
    }
    // Les notes de basse du générateur sont celles de basseDe
    for (const ev of song.ev.filter((e) => e.hand === "L" && e.lane < 4 && e.fin === undefined))
      expect(ev.midi).toBe(basseDe(song.chords[ev.bar], ev.lane));
  });

  it("le temps de la partie continue après la fin du corps, et revient à son début (ADR-0009)", () => {
    enJam();
    const { start, bars } = S.jam;
    expect(sansFin()).toBe(true);
    expect([start, start + bars - 1, start + bars, start + bars + 1, start + 3 * bars].map(mesureDeLaChanson)).toEqual([
      start,
      start + bars - 1,
      start,
      start + 1,
      start,
    ]);
    expect(sectionAtBar(start + bars).kind).not.toBe("outro");
    S.jam = null;
    expect(sansFin()).toBe(false);
  });

  it("chaque touche joue le degré de l'accord en cours, des deux mains, sans rien juger ni compter", () => {
    enJam();
    const { start, bars } = S.jam;
    // Un temps de la mesure 3 du corps, une fois au premier tour et une fois au troisième
    for (const tour of [0, 2]) {
      const nb = (start + 3 + tour * bars) * 4 + 1,
        ns = nb * spb(),
        ch = S.song.chords[start + 3];
      expect(chordAtBeat(nb)).toBe(ch);
      const attendu: [Action, number][] = [
        ["glisser", ch.bass],
        ["ecraser", ch.bass],
        ["couloir0", ch.lanes[0]],
        ["couloir1", ch.lanes[1]],
        ["couloir2", ch.lanes[2]],
        ["couloir3", ch.lanes[3]],
      ];
      for (const [a, midi] of attendu) {
        jouerEnJam(a, ns);
        expect([derniereNote().midi, effets.jouer.mock.lastCall[1]]).toEqual([midi, null]);
      }
      // Sauter joue l'octave ; un second saut en l'air, la quinte au-dessus (#7)
      S.jumpAt = S.doubleAt = -99;
      jouerEnJam("sauter", ns + 2 * spb());
      expect(derniereNote().midi).toBe(ch.bass + 12);
      jouerEnJam("sauter", ns + 2.3 * spb());
      expect([derniereNote().midi, S.doubleAt]).toEqual([ch.bass + 12 + ch.ints[2], ns + 2.3 * spb()]);
    }
    // Les tirs sont réussis, dans le couloir de la touche ; rien d'autre ne se passe
    expect(effets.tir.mock.calls).toEqual([0, 1, 2, 3, 0, 1, 2, 3].map((l) => [l, true]));
    for (const k of ["reussite", "rate", "mauvaisCouloir", "solo", "mourir"] as const)
      expect(effets[k]).not.toHaveBeenCalled();
    expect([S.score, S.combo, S.health, S.perfect, S.good, S.miss]).toEqual([0, 0, 100, 0, 0, 0]);
    expect(S.slideUntil).toBeGreaterThan(0);
    expect(S.ecraseAt).toBeGreaterThan(0);
  });

  it("aucune main ne joue toute seule en jam, même en entraînement d'une main", () => {
    enJam({ practice: "L" });
    expect([autoFor("L"), autoFor("R")]).toEqual([false, false]);
    S.jam = null;
    expect(autoFor("R")).toBe(true);
  });
});

let nav: Navigateur;
afterEach(() => nav?.fermer());
const temps = () => nav.jeu.songNow() / spbDe(nav.jeu.state);
const spbDe = (s: typeof S) => 60 / (s.song.bpm * s.vitessePartie);

describe("jam : parcours", () => {
  it("l'essai jam tourne sans fin et sans notes dans la Boîte, chaque touche sonne, et Échap le quitte", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=jam" } });
    const S = nav.jeu.state,
      essai = trouverEssai("jam");
    expect([S.mode, S.essai.essai.id, S.theme, S.practice]).toEqual(["title", "jam", essai.univers, "both"]);
    expect(nav.overlay.innerHTML).toContain('data-act="jam"');
    expect(nav.overlay.innerHTML).not.toContain('data-act="listen"');
    nav.presser("Space");
    expect([S.mode, S.ev, S.enregistrement]).toEqual(["play", [], null]);
    expect(S.jam).toEqual(corpsDeLaChanson(S.song.sections));

    // On joue des deux mains pendant le premier tour : chaque touche fait au moins un son
    const touches = ["KeyS", "KeyW", "Space", "KeyJ", "KeyK", "KeyL", "Semicolon"];
    nav.avancerJusqua(() => temps() >= 8, 30);
    for (const code of touches) {
      const avant = nav.horloge.sons.length;
      nav.presser(code);
      nav.relacher(code);
      expect(nav.horloge.sons.length, code).toBeGreaterThan(avant);
      nav.avancerJusqua(() => false, 0.3);
    }
    // La fin de la chanson passe sans écran de fin : la batterie et la nappe continuent, au couplet
    const fin = S.song.endBeat;
    nav.avancerJusqua((s) => s.mode !== "play" || temps() >= fin + 6, 60);
    expect(S.mode).toBe("play");
    expect(temps()).toBeGreaterThan(fin + 5);
    expect(sectionAtBarDe(S, Math.floor(temps() / 4))).not.toBe("outro");
    const t0 = nav.horloge.audio;
    nav.avancerJusqua(() => false, 2);
    expect(nav.horloge.sons.some((s) => s.debut > t0)).toBe(true);
    expect([S.score, S.health, S.miss, S.perfect]).toEqual([0, 100, 0, 0]);
    // Le HUD n'a ni harmonie ni score, et nomme la jam
    nav.image();
    expect(nav.textes).toContain("JAM");
    expect(nav.textes).not.toContain(THEMES.boite.meter);
    expect(nav.textes.some((t) => t.startsWith("COMBO"))).toBe(false);

    nav.presser("Escape");
    expect([S.mode, S.jam, S.essai.essai.id]).toEqual(["title", null, "jam"]);
    expect(nav.overlay.innerHTML).toContain("Jammer");
  });

  it("dans la Ville, J lance la jam depuis l'écran de départ ; les deux mains jouent, et la pause propose d'en sortir", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-hands": "L" } });
    const S = nav.jeu.state;
    expect([S.theme, S.practice, S.mode]).toEqual(["ville", "L", "title"]);
    expect(nav.overlay.innerHTML).toContain('data-act="jam"');
    nav.presser("KeyJ");
    nav.relacher("KeyJ");
    expect([S.mode, S.ev.length, S.auto]).toEqual(["play", 0, false]);
    nav.avancerJusqua(() => temps() >= 5, 30);
    // La main droite joue aussi, même en entraînement de la main gauche
    const avant = nav.horloge.sons.length;
    nav.presser("KeyK");
    expect(nav.horloge.sons.length).toBeGreaterThan(avant);
    expect(S.keys.couloir1).toBe(true);
    nav.relacher("KeyK");
    // L'auto-play ne se prend pas en jam
    nav.presser("KeyA");
    expect(S.auto).toBe(false);

    nav.cacher(true);
    expect(S.mode).toBe("pause");
    expect(nav.overlay.innerHTML).toContain('data-act="quitter-jam"');
    nav.cacher(false);
    nav.presser("Space");
    await nav.promesses();
    expect(S.mode).toBe("play");
    nav.toucherPause();
    nav.toucherBouton("quitter-jam");
    expect([S.mode, S.jam]).toEqual(["title", null]);
    // Une partie lancée ensuite est une partie ordinaire
    nav.presser("Space");
    expect([S.mode, S.jam, S.ev.length > 0]).toEqual(["play", null, true]);
  });
});

function sectionAtBarDe(s: typeof S, bar: number) {
  const b = s.jam && bar >= s.jam.start + s.jam.bars ? s.jam.start + ((bar - s.jam.start) % s.jam.bars) : bar;
  return s.song.sections.find((x) => b >= x.start && b < x.start + x.bars)?.kind;
}
