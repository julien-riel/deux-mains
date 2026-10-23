// Mode essai : chaque essai du registre construit une chanson courte et valide où sa fonctionnalité revient tôt
// et souvent ; l'auto-play la joue jusqu'au bout ; le menu et l'adresse ouvrent le bon essai, et le quitter rend
// au joueur ses réglages. Le registre est de la logique pure ; les parcours passent par le faux navigateur.

import { afterEach, describe, expect, it } from "vitest";
import { buildSong } from "../src/chanson/generateur";
import type { Chanson } from "../src/chanson/types";
import { accorder, assembler } from "../src/essais/fabrique";
import { ESSAIS, essaiDemande, trouverEssai } from "../src/essais/registre";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

// Une chanson jouable : sections bout à bout, un accord par mesure, des notes triées dans la chanson, des notes
// de basse et de mélodie qui jouent les degrés de l'accord de leur mesure (ADR-0003), et des accords reliés
function verifierChanson(c: Chanson) {
  let bar = 0;
  for (const s of c.sections) {
    expect(s.start).toBe(bar);
    bar += s.bars;
  }
  expect([c.totalBars, c.chords.length, c.endBeat]).toEqual([bar, bar, bar * 4]);
  c.ev.forEach((ev, i) => {
    if (i) expect(ev.beat).toBeGreaterThanOrEqual(c.ev[i - 1].beat);
    expect(ev.beat).toBeGreaterThanOrEqual(0);
    expect(ev.beat + ev.dur).toBeLessThanOrEqual(c.endBeat);
    expect(ev.bar).toBe(Math.floor(ev.beat / 4));
    expect(ev.state).toBe("pending");
    expect([0, 1, 2, 3]).toContain(ev.lane);
    const ch = c.chords[ev.bar];
    if (ev.hand === "L") {
      expect(ev.midi).toBe([ch.bass, ch.bass + 12, ch.bass + 12 + ch.ints[2], ch.bass][ev.lane]);
      expect(ev.air).toBeGreaterThan(0);
    } else expect(ev.midi).toBe(ch.lanes[ev.lane]);
    const memeTemps = c.ev.filter((e) => e.beat === ev.beat);
    expect(ev.grp ?? [ev]).toEqual(memeTemps);
  });
}

describe("registre des essais", () => {
  it("chaque essai a un id d'adresse unique, un titre et une phrase à vérifier", () => {
    const ids = ESSAIS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ESSAIS) {
      expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(e.titre.length).toBeGreaterThan(0);
      expect(e.verifier.length).toBeGreaterThan(20);
      expect(trouverEssai(e.id)).toBe(e);
    }
    expect(ids).toEqual(expect.arrayContaining(["double-saut", "ecrasement"]));
  });

  it.each(ESSAIS.map((e) => [e.id, e] as const))(
    "%s : une chanson courte et valide, où la fonctionnalité arrive dans les quatre premières mesures et revient",
    (_id, e) => {
      const c = e.chanson();
      verifierChanson(c);
      expect(c.totalBars).toBeLessThanOrEqual(20);
      const reperes = c.ev.filter(e.repere);
      expect(reperes.length).toBeGreaterThanOrEqual(4);
      expect(reperes[0].bar).toBeLessThan(4);
    },
  );

  it("chaque ouverture construit une chanson neuve et identique (graine fixe, ADR-0005)", () => {
    for (const e of ESSAIS) {
      const a = e.chanson(),
        b = e.chanson();
      expect(a).not.toBe(b);
      expect(a.ev.map(({ beat, lane, hand, midi, dur }) => ({ beat, lane, hand, midi, dur }))).toEqual(
        b.ev.map(({ beat, lane, hand, midi, dur }) => ({ beat, lane, hand, midi, dur })),
      );
    }
  });

  it("la fabrique recopie la mélodie des mesures choisies et pose une plaque à chaque refrain", () => {
    const c = assembler(4242, "normal", [
      { nom: "Refrain", genre: "refrain", de: 10, mesures: 2 },
      { nom: "Refrain", genre: "refrain", de: 10, mesures: 2 },
    ]);
    const droite = c.ev.filter((e) => e.hand === "R");
    expect(droite.filter((e) => e.bar < 2).map((e) => e.lane)).toEqual(
      droite.filter((e) => e.bar >= 2).map((e) => e.lane),
    );
    expect(c.ev.filter((e) => e.hand === "L" && e.lane === 3).map((e) => e.beat)).toEqual([0, 8]);
  });

  it("la fabrique réécrit la mélodie des genres demandés : couloirs, notes tenues et silences", () => {
    const c = assembler(
      4242,
      "normal",
      [
        { nom: "Couplet", genre: "couplet", de: 2, mesures: 2 },
        { nom: "Refrain", genre: "refrain", de: 10, mesures: 2 },
      ],
      {},
      { couplet: ["0-----.3"] },
    );
    verifierChanson(c);
    const couplet = c.ev.filter((e) => e.hand === "R" && e.bar < 2);
    expect(couplet.map(({ beat, lane, dur }) => ({ beat, lane, dur }))).toEqual([
      { beat: 0, lane: 0, dur: 3 },
      { beat: 3.5, lane: 3, dur: 0 },
      { beat: 4, lane: 0, dur: 3 },
      { beat: 7.5, lane: 3, dur: 0 },
    ]);
    // Le refrain garde la mélodie de la chanson générée
    const source = buildSong(4242, "normal").ev.filter((e) => e.hand === "R" && e.bar >= 10 && e.bar < 12);
    expect(c.ev.filter((e) => e.hand === "R" && e.bar >= 2).map((e) => e.lane)).toEqual(source.map((e) => e.lane));
  });

  it("accorder ajoute un accord à deux mains par mesure de couplet, sans toucher à l'intro", () => {
    const c = accorder(
      assembler(4242, "facile", [
        { nom: "Intro", genre: "intro", de: 0, mesures: 2 },
        { nom: "Couplet", genre: "couplet", de: 2, mesures: 4 },
      ]),
    );
    verifierChanson(c);
    for (let bar = 0; bar < 6; bar++) {
      const ici = c.ev.filter((e) => e.beat === bar * 4);
      expect(ici.filter((e) => e.hand === "R").length).toBe(bar < 2 ? 0 : 2);
    }
  });

  it("l'adresse demande un essai par sa requête ou par son ancre", () => {
    expect(essaiDemande("?essai=double-saut", "")).toBe("double-saut");
    expect(essaiDemande("", "#essai=ecrasement")).toBe("ecrasement");
    expect(essaiDemande("?x=1&essai=tunnel", "#essai=accords")).toBe("tunnel");
    expect(essaiDemande("?x=1", "#haut")).toBeNull();
  });
});

describe.each(ESSAIS.map((e) => [e.id, e] as const))("essai %s", (id, e) => {
  it("ouvert par ?essai=, l'auto-play le joue jusqu'au bout sans rater de note", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: `?essai=${id}` } });
    const S = nav.jeu.state;
    expect([S.mode, S.essai?.essai.id, S.theme, S.diff, S.practice]).toEqual(["title", id, e.univers, e.diff, e.mains]);
    expect(nav.overlay.innerHTML).toContain(e.titre);
    nav.presser("KeyA");
    expect(S.mode).toBe("play");

    nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);

    expect(S.mode).toBe("done");
    expect([S.miss, S.health, S.perfect]).toEqual([0, 100, S.song.ev.length]);
    expect(nav.overlay.innerHTML).toContain("Essai terminé");
    expect(nav.overlay.innerHTML).toContain('data-act="quitter-essai"');
  });
});

describe("accès au mode essai", () => {
  it("le bouton Essais de l'écran titre liste les essais, et en choisir un le lance aussitôt", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state;
    expect(nav.overlay.innerHTML).toContain('data-act="essais"');
    nav.toucherBouton("essais");
    expect(S.mode).toBe("essais");
    for (const e of ESSAIS) {
      expect(nav.overlay.innerHTML).toContain(`data-essai="${e.id}"`);
      expect(nav.overlay.innerHTML).toContain(e.verifier);
    }
    nav.toucherBouton("essai", { essai: "ecrasement" });
    expect([S.mode, S.essai.essai.id, S.practice]).toEqual(["play", "ecrasement", "L"]);
    expect(S.song.ev.some((ev) => ev.lane === 3 && ev.hand === "L")).toBe(true);
  });

  it("au clavier : E ouvre la liste, Échap la ferme, un chiffre lance l'essai de ce numéro", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state;
    nav.presser("KeyE");
    expect(S.mode).toBe("essais");
    nav.presser("Escape");
    expect([S.mode, S.essai]).toEqual(["title", null]);
    nav.presser("KeyE");
    nav.presser("Digit1");
    expect([S.mode, S.essai.essai.id]).toEqual(["play", ESSAIS[0].id]);
  });

  it("#essai= ouvre l'essai, au chargement comme quand l'ancre change ; un id inconnu est ignoré", async () => {
    nav = await Navigateur.ouvrir({ adresse: { hash: "#essai=inconnu" } });
    const S = nav.jeu.state;
    expect([S.mode, S.essai]).toEqual(["title", null]);
    nav.changerAncre("#essai=tunnel");
    expect([S.mode, S.essai.essai.id]).toEqual(["title", "tunnel"]);
    nav.fermer();

    nav = await Navigateur.ouvrir({ adresse: { hash: "#essai=double-saut" } });
    expect(nav.jeu.state.essai.essai.id).toBe("double-saut");
  });

  it("pendant l'essai, la phrase à vérifier reste affichée sur la scène, et le HUD nomme l'essai", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=double-saut" } });
    const bandeau = nav.trouver("#essai-bandeau");
    nav.presser("Space");
    nav.image();
    expect(bandeau.hidden).toBe(false);
    expect(bandeau.textContent).toContain(trouverEssai("double-saut").verifier);
    expect(nav.textes.some((t) => t.startsWith("ESSAI · DOUBLE SAUT"))).toBe(true);
  });

  it("à la mort, on peut rejouer l'essai ou en choisir un autre", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=double-saut" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    nav.avancerJusqua((s) => s.mode === "dead" || s.mode === "done", 120);
    expect(S.mode).toBe("dead");
    expect(nav.overlay.innerHTML).toContain('data-act="essais"');
    expect(nav.overlay.innerHTML).not.toContain('data-act="new"');
    nav.presser("Enter");
    expect([S.mode, S.essai.essai.id]).toEqual(["play", "double-saut"]);
  });

  it("quitter les essais rend les réglages du joueur, sans avoir enregistré ceux de l'essai", async () => {
    const avant = { "deux-mains-diff": "difficile", "deux-mains-theme": "boite", "deux-mains-hands": "both" };
    nav = await Navigateur.ouvrir({ stockage: avant, adresse: { search: "?essai=double-saut" } });
    const S = nav.jeu.state,
      graine = S.seed;
    expect([S.diff, S.theme, S.practice]).toEqual(["normal", "ville", "L"]);
    expect(Object.fromEntries(Object.keys(avant).map((k) => [k, nav.stockage.get(k)]))).toEqual(avant);

    nav.presser("Escape");

    expect([S.essai, S.mode, S.seed, S.diff, S.theme, S.practice]).toEqual([
      null,
      "title",
      graine,
      "difficile",
      "boite",
      "both",
    ]);
    expect(nav.trouver("#essai-bandeau").hidden).toBe(true);
  });

  it("un réglage choisi pendant l'essai est gardé en le quittant ; une nouvelle chanson quitte l'essai", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=accords" } });
    const S = nav.jeu.state,
      diff = S.essai.avant.diff;
    nav.jeu.setTheme("ville");
    expect(nav.stockage.get("deux-mains-theme")).toBe("ville");
    nav.presser("KeyN");
    expect([S.essai, S.theme, S.diff, S.practice]).toEqual([null, "ville", diff, "both"]);
  });
});
