// Boucle (#5, ADR-0009) : une section rejouée sans fin. Le temps de la partie ne recule jamais ; chaque passage
// est une copie des notes de la section, décalée d'une section, et la musique repart sans coupure.

import { afterEach, describe, expect, it } from "vitest";
import type { Section } from "../src/chanson/types";
import { S as SPur, mesureDeLaChanson, passageAt } from "../src/jeu/etat";
import { Navigateur } from "./support/navigateur";

// Graine fixe (ADR-0005) : Intro 1-2, Couplet 3-10, Refrain 11-18, Solo libre 19-22, Refrain 23-30, Outro 31-32
const GRAINE = 4242;
const REFRAIN = 2;

describe("conversion entre le temps de la partie et la chanson", () => {
  const refrain: Section = { name: "Refrain", kind: "refrain", bars: 8, start: 10 };

  it("hors boucle, la mesure de la partie est celle de la chanson", () => {
    SPur.bouclePartie = null;
    expect([0, 10, 17, 18, 40].map(mesureDeLaChanson)).toEqual([0, 10, 17, 18, 40]);
  });

  it("en boucle, les mesures après la section reviennent à son début, passage après passage", () => {
    SPur.bouclePartie = { sec: refrain, cree: 1, passages: [] };
    expect([9, 10, 17, 18, 25, 26, 34].map(mesureDeLaChanson)).toEqual([9, 10, 17, 10, 17, 10, 10]);
    // Le décompte (mesure 9) compte dans le premier passage
    expect([36, 40, 71.9, 72, 104].map(passageAt)).toEqual([0, 0, 0, 1, 2]);
    SPur.bouclePartie = null;
  });
});

let nav: Navigateur;
afterEach(() => nav?.fermer());

async function ouvrir(boucle: number) {
  nav = await Navigateur.ouvrir();
  nav.jeu.load(GRAINE, "normal");
  nav.jeu.setBoucle(boucle);
  return nav.jeu.state;
}
/** Le temps de la partie, en temps */
const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm * nav.jeu.state.vitessePartie) / 60;
const notesDe = (sec: Section) =>
  nav.jeu.state.song.ev.filter((ev) => ev.beat >= sec.start * 4 && ev.beat < (sec.start + sec.bars) * 4);

describe("réglage Boucle", () => {
  it("propose aucune boucle ou chacune des sections de la chanson", async () => {
    const S = await ouvrir(-1);
    const options = document.querySelector("#boucle");
    expect(options.innerHTML).toContain(`<option value="-1">Aucune</option>`);
    for (const [i, s] of S.song.sections.entries())
      expect(options.innerHTML).toContain(
        `<option value="${i}">${s.name} · mesures ${s.start + 1} à ${s.start + s.bars}</option>`,
      );
  });

  it("choisir une section l'annonce sur l'écran de départ et la met en évidence ; elle reste pour la chanson suivante", async () => {
    await ouvrir(-1);
    expect(nav.overlay.innerHTML).not.toContain("boucle");
    nav.saisir("#boucle", String(REFRAIN));
    expect(nav.jeu.state.boucle).toBe(REFRAIN);
    expect(nav.overlay.innerHTML).toContain("boucle : Refrain");
    nav.jeu.load(GRAINE + 1, "normal");
    expect(nav.jeu.state.boucle).toBe(REFRAIN);
  });

  it("la partie commence par la mesure de décompte qui précède la section", async () => {
    const S = await ouvrir(REFRAIN);
    nav.presser("Space");
    const sec = S.song.sections[REFRAIN];

    expect(S.mode).toBe("play");
    expect(S.startBeat).toBe(sec.start * 4 - 4);
    expect(S.bouclePartie.sec).toBe(sec);
    // Seules les notes de la section sont là, en deux passages, décalés d'une section
    const n = notesDe(sec);
    expect(S.ev.map((ev) => ev.beat)).toEqual([...n.map((ev) => ev.beat), ...n.map((ev) => ev.beat + sec.bars * 4)]);
    expect(S.ev.every((ev) => ev.state === "pending")).toBe(true);
    // Les accords sont reliés entre copies du même passage
    for (const ev of S.ev)
      if (ev.grp) for (const e of ev.grp) expect([S.ev.includes(e), e.passage]).toEqual([true, ev.passage]);
  });
});

describe("retour en boucle", () => {
  it("l'auto-play joue trois passages consécutifs sans note ratée, sans que le temps ne recule", async () => {
    const S = await ouvrir(REFRAIN);
    const sec = S.song.sections[REFRAIN],
      n = notesDe(sec).length;
    nav.presser("KeyA");
    const pas: number[] = [];
    let avant = nav.jeu.songNow();
    while (temps() < (sec.start + 3 * sec.bars) * 4 + 1) {
      nav.image();
      pas.push(nav.jeu.songNow() - avant);
      avant = nav.jeu.songNow();
      // Jamais plus de trois passages en mémoire : le précédent, celui en cours et le suivant
      expect(new Set(S.ev.map((ev) => ev.passage)).size).toBeLessThanOrEqual(3);
    }

    expect(S.mode).toBe("play");
    expect(S.miss).toBe(0);
    expect(S.bouclePartie.passages.slice(0, 3)).toEqual([0, 1, 2].map(() => ({ parfait: n, bien: 0, rate: 0 })));
    // Chaque image avance le temps de la partie d'1/60 s, y compris aux points de boucle
    expect(Math.min(...pas)).toBeCloseTo(1 / 60, 9);
    expect(Math.max(...pas)).toBeCloseTo(1 / 60, 9);
  });

  it("les obstacles et ennemis de la section réapparaissent à chaque passage, à jouer", async () => {
    const S = await ouvrir(REFRAIN);
    const sec = S.song.sections[REFRAIN],
      L = sec.bars * 4,
      n = notesDe(sec);
    nav.presser("KeyA");
    nav.avancerJusqua(() => temps() >= sec.start * 4 + 2 * L, 120);

    // Le troisième passage existe déjà, avant d'entrer à l'écran, avec les notes de la section décalées
    const troisieme = S.ev.filter((ev) => ev.passage === 3);
    expect(troisieme.map((ev) => [ev.hand, ev.lane, ev.beat - 3 * L])).toEqual(
      n.map((ev) => [ev.hand, ev.lane, ev.beat]),
    );
    expect(troisieme.every((ev) => ev.state === "pending" && !ev.auto)).toBe(true);
    // La chanson elle-même ne bouge pas
    expect(S.song.ev.length).toBeGreaterThan(n.length);
  });

  it("à la fin de la section, la musique repart au début, sans silence ni décalage", async () => {
    const S = await ouvrir(REFRAIN);
    const sec = S.song.sections[REFRAIN],
      fin = (sec.start + sec.bars) * 4;
    nav.presser("KeyA");
    nav.avancerJusqua(() => temps() >= fin + sec.bars * 4 + 5, 120);
    const { timeOfBeat } = await import("../src/audio/moteur");
    const sons = nav.horloge.sons;
    const sonneA = (b: number) => sons.some((s) => Math.abs(s.debut - timeOfBeat(b)) < 1e-9);

    // Au refrain, la batterie frappe chaque croche : autour de chaque point de boucle, aucune ne manque, sauf
    // pendant le temps de silence qui précède chaque passage (#8)
    for (const pt of [fin, fin + sec.bars * 4])
      for (let b = pt - 4; b < pt + 4; b += 0.5)
        if (b < pt - 1 || b >= pt) expect(sonneA(b), `croche au temps ${b}`).toBe(true);
    // La cymbale du début du refrain (un bruit de 1,9 s) revient à chaque passage, pile sur le temps
    const cymbales = sons.filter((s) => Math.abs(s.fin - s.debut - 1.9) < 1e-9).map((s) => s.debut);
    for (const b of [sec.start * 4, fin, fin + sec.bars * 4])
      expect(cymbales.some((t) => Math.abs(t - timeOfBeat(b)) < 1e-9)).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5])("la section n° %s se joue en boucle, deux passages sans note ratée", async (i) => {
    const S = await ouvrir(i);
    const sec = S.song.sections[i];
    nav.presser("KeyA");
    nav.avancerJusqua(() => temps() >= (sec.start + 2 * sec.bars) * 4 + 1, 120);

    const n = notesDe(sec).length,
      parfaits = (k: number) => S.bouclePartie.passages[k]?.parfait ?? 0;
    expect(S.mode).toBe("play");
    expect(S.miss).toBe(0);
    expect([parfaits(0), parfaits(1)]).toEqual([n, n]);
  });
});

describe("affichage pendant la boucle", () => {
  it("le compteur de passages et la précision du dernier passage s'affichent", async () => {
    const S = await ouvrir(REFRAIN);
    const sec = S.song.sections[REFRAIN];
    nav.presser("KeyA");
    nav.avancerJusqua(() => temps() >= sec.start * 4 + 1, 30);
    expect(nav.textes).toContain("REFRAIN EN BOUCLE · PASSAGE 1");
    expect(nav.textes.some((t) => t.includes("BOUCLE") && t.includes("AUTO-PLAY"))).toBe(true);

    nav.avancerJusqua(() => temps() >= (sec.start + sec.bars) * 4 + 1, 60);
    expect(nav.textes).toContain("REFRAIN EN BOUCLE · PASSAGE 2 · DERNIER PASSAGE 100 %");
  });

  it("se combine avec la vitesse et le mode une main", async () => {
    const S = await ouvrir(REFRAIN);
    nav.jeu.setVitesse(0.5);
    nav.jeu.setPractice("R");
    nav.presser("Space");
    nav.image();

    expect([S.vitessePartie, S.bouclePartie?.sec.name]).toEqual([0.5, "Refrain"]);
    expect(nav.textes).toContain("MAIN DROITE SEULE · VITESSE 50 % · BOUCLE");
  });
});

describe("mort et sortie de la boucle", () => {
  it("une mort fait reprendre au début de la section, toujours en boucle", async () => {
    const S = await ouvrir(REFRAIN);
    const sec = S.song.sections[REFRAIN];
    nav.presser("Space");
    nav.avancerJusqua((e) => e.mode === "dead", 120);
    expect(nav.overlay.innerHTML).toContain("Reprendre au refrain");

    nav.presser("KeyR");
    expect(S.mode).toBe("play");
    expect(S.startBeat).toBe(sec.start * 4 - 4);
    expect(S.bouclePartie.sec).toBe(sec);
    expect(S.bouclePartie.passages).toEqual([]);
    expect(new Set(S.ev.map((ev) => ev.passage))).toEqual(new Set([0, 1]));
    expect(S.ev.every((ev) => ev.state === "pending")).toBe(true);
  });

  it("l'écran de pause propose de quitter la boucle ; la partie est alors un entraînement, score non classé", async () => {
    await ouvrir(REFRAIN);
    nav.presser("Space");
    nav.image();
    nav.presser("Escape");
    expect(nav.overlay.innerHTML).toContain("Quitter la boucle");

    nav.presser("KeyB");
    expect(nav.jeu.state.mode).toBe("done");
    expect(nav.overlay.innerHTML).toContain("entraînement, score non classé");
    expect(nav.overlay.innerHTML).toContain("Entraînement terminé");
    expect(nav.overlay.innerHTML).toContain("Refrain en boucle · aucun passage terminé");
  });

  it("à la sortie, l'écran de fin donne le nombre de passages et la précision du dernier", async () => {
    const S = await ouvrir(REFRAIN);
    const sec = S.song.sections[REFRAIN];
    nav.presser("KeyA");
    nav.avancerJusqua(() => temps() >= (sec.start + 2 * sec.bars) * 4 + 1, 120);
    nav.presser("Escape");
    nav.toucherBouton("quitter-boucle");

    expect(nav.overlay.innerHTML).toContain("auto-play, score non classé");
    expect(nav.overlay.innerHTML).toContain(
      "Refrain en boucle · 2 passages terminés · dernier passage : précision 100 %",
    );
  });

  it("hors boucle, la pause ne propose pas de quitter la boucle", async () => {
    await ouvrir(-1);
    nav.presser("Space");
    nav.image();
    nav.presser("Escape");
    expect(nav.overlay.innerHTML).not.toContain("Quitter la boucle");
    nav.presser("KeyB");
    expect(nav.jeu.state.mode).toBe("pause");
  });
});
