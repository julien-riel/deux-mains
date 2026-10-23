// Le fantôme du meilleur passage (#32) : après un nouveau record, la partie est gardée dans l'entrée de sa chanson
// (ADR-0014), au format d'enregistrement de la réécoute (#23) ; à la partie suivante, un fantôme du personnage la
// rejoue à l'image, aux mêmes temps, et l'écart de score s'affiche. Quand la place manque, les fantômes les plus
// anciens partent d'abord. Les règles pures d'abord, puis le stockage plein, puis des parcours dans le faux navigateur.

import { afterEach, describe, expect, it, vi } from "vitest";
import { VERSION_GENERATEUR } from "../src/chanson/generateur";
import type { Note } from "../src/chanson/types";
import { fantomeFictif } from "../src/essais/fabrique";
import { trouverEssai } from "../src/essais/registre";
import { noterScore, nouvelEnregistrement, reprendre, type Coup } from "../src/jeu/enregistrement";
import {
  DUREE_TIR,
  MAX_FANTOMES,
  ecartAvecLeFantome,
  lireFantome,
  nouveauFantome,
  poseDuFantome,
  scoreDuFantome,
  type Fantome,
} from "../src/jeu/fantome";
import { decoder, encoder } from "../src/sauvegarde/code";
import {
  VERSION,
  cleChanson,
  cleEssai,
  clePartition,
  fantomeDeLaChanson,
  fantomesParAnciennete,
  fusionner,
  limiterFantomes,
  lireDocument,
  noterReussite,
  pourLeCode,
  retirerUnFantome,
  sauvegardeVide,
  type Sauvegarde,
} from "../src/sauvegarde/format";
import { LANE_CODES } from "../src/ui/touches";
import { evenementsClavier, faire } from "./support/appuis";
import { Navigateur } from "./support/navigateur";

const CLE = "deux-mains-sauvegarde";

/** Un fantôme gardé au moment `le`, avec ces coups et ces scores */
const fantome = (le: number, coups: Coup[] = [], scores: number[] = [0, 100, 300]): Fantome => ({
  ...nouvelEnregistrement({ graine: 4242, difficulte: "normal", essai: null, mains: "both", vitesse: 1, auto: false }),
  coups,
  scores,
  finie: true,
  le,
});
const note = (hand: "L" | "R", lane: number, beat: number, air = 0.8): Note =>
  ({ hand, lane, beat, air, dur: 0, bar: Math.floor(beat / 4) }) as Note;

describe("le fantôme et son score", () => {
  it("garde la partie au format de la réécoute, avec ses temps arrondis au dix-millième, et se relit", () => {
    const enr = nouvelEnregistrement({
      graine: 7,
      difficulte: "facile",
      essai: null,
      mains: "duo",
      vitesse: 1,
      auto: false,
    });
    enr.coups.push(
      { temps: 4.123456789, geste: "appui", action: "sauter", resultat: "parfait", tactile: true },
      { temps: 4.2, geste: "appui", action: "couloir1", hauteur: 64 },
      { temps: 4.5, geste: "relache", action: "sauter" },
      { temps: 5, geste: "auto", auto: true },
      { temps: 6, geste: "mains", mains: "R" },
      { temps: 7, geste: "pause" },
      { temps: 8, geste: "reprise", mains: "both", auto: false },
    );
    enr.scores.push(0, 300);
    enr.finie = true;
    const f = nouveauFantome(enr, 1234);
    expect(f.coups[0].temps).toBe(4.1235);
    expect(f.le).toBe(1234);
    expect(enr.coups[0].temps).toBe(4.123456789);
    expect(lireFantome(JSON.parse(JSON.stringify(f)))).toEqual(f);
  });

  it("un fantôme abîmé ne se lit pas ; un coup abîmé est laissé de côté", () => {
    const f = fantome(1, [{ temps: 1, geste: "appui", action: "couloir2" }]);
    expect(lireFantome(null)).toBeNull();
    expect(lireFantome({ ...f, scores: [0, "x"] })).toBeNull();
    expect(lireFantome({ ...f, le: "hier" })).toBeNull();
    expect(lireFantome({ ...f, graine: "7" })).toBeNull();
    const coups = [
      ...f.coups,
      { temps: "2", geste: "appui", action: "sauter" },
      { temps: 2, geste: "appui", action: "voler" },
      { temps: 2, geste: "relache", action: "voler" },
      { temps: 2, geste: "auto", auto: "oui" },
      { temps: 2, geste: "mains", mains: "trois" },
      { temps: 2, geste: "reprise", mains: "both" },
      { temps: 2, geste: "danse" },
      3,
    ];
    const lu = lireFantome({ ...f, coups, mains: "trois", vitesse: null, essai: 4, boss: true, finie: false });
    expect(lu.coups).toEqual(f.coups);
    expect([lu.mains, lu.vitesse, lu.essai, lu.boss, lu.finie]).toEqual(["both", 1, null, true, false]);
  });

  it("le score de la partie se note au début de chaque temps, et la reprise oublie les temps d'après", () => {
    const enr = nouvelEnregistrement({
      graine: 1,
      difficulte: "facile",
      essai: null,
      mains: "both",
      vitesse: 1,
      auto: false,
    });
    noterScore(enr, -1, 0);
    noterScore(enr, 0.2, 0);
    noterScore(enr, 0.9, 300);
    noterScore(enr, 3.1, 600); // une image en retard : les temps sautés prennent le score du moment
    expect(enr.scores).toEqual([0, 600, 600, 600]);
    noterScore(enr, 5, 900);
    reprendre(enr, 2, "both", false);
    expect(enr.scores).toEqual([0, 600]);
    noterScore(enr, 2, 450);
    expect(enr.scores).toEqual([0, 600, 450]);
    noterScore(null, 3, 0);
  });

  it("le score du fantôme suit ses temps, et l'écart dit l'avance ou le retard du joueur", () => {
    const f = fantome(1, [], [0, 100, 300]);
    expect(scoreDuFantome(f, -2)).toBe(0);
    expect(scoreDuFantome(f, 1)).toBe(100);
    expect(scoreDuFantome(f, 1.5)).toBe(200);
    expect(scoreDuFantome(f, 9)).toBe(300);
    expect(scoreDuFantome({ ...f, scores: [] }, 3)).toBe(0);
    expect(ecartAvecLeFantome(f, 1.5, 450)).toBe(250);
    expect(ecartAvecLeFantome(f, 1.25, 100)).toBe(-50);
  });
});

describe("la pose du fantôme rejoue les coups gardés, aux mêmes temps", () => {
  it("un saut au temps du coup, avec la durée de l'obstacle visé ; rien avant", () => {
    const f = fantome(1, [{ temps: 4.02, geste: "appui", action: "sauter" }]),
      notes = [note("L", 1, 4, 0.6)];
    expect(poseDuFantome(f, 4.01, notes).jumpAt).toBe(-99);
    const p = poseDuFantome(f, 4.3, notes);
    expect([p.jumpAt, p.jumpAir]).toEqual([4.02, 0.6]);
    // Loin de tout obstacle, un saut dure 0,8 temps
    expect(poseDuFantome(f, 4.3, []).jumpAir).toBe(0.8);
  });

  it("un second saut en l'air est un double saut ; une marche d'escalier reste un saut", () => {
    const f = fantome(1, [
      { temps: 4, geste: "appui", action: "sauter" },
      { temps: 4.3, geste: "appui", action: "sauter" },
      { temps: 8, geste: "appui", action: "sauter" },
      { temps: 8.2, geste: "appui", action: "sauter" },
    ]);
    const notes = [note("L", 1, 4), note("L", 2, 4.3, 1.2), note("L", 4, 8, 0.5), note("L", 4, 8.2, 0.5)];
    const p = poseDuFantome(f, 4.5, notes);
    expect([p.jumpAt, p.doubleAt, p.doubleAir]).toEqual([4, 4.3, 1.2]);
    const q = poseDuFantome(f, 8.3, notes);
    expect([q.jumpAt, q.jumpAir]).toEqual([8.2, 0.5]);
  });

  it("glisser tient tant que la touche l'est ; écraser aplatit ; en tactile, glisser devant une plaque l'écrase", () => {
    const f = fantome(1, [
      { temps: 2, geste: "appui", action: "glisser" },
      { temps: 3, geste: "relache", action: "glisser" },
      { temps: 4, geste: "appui", action: "ecraser" },
      { temps: 6, geste: "appui", action: "glisser", tactile: true },
      { temps: 6.1, geste: "pause" },
    ]);
    const notes = [note("L", 3, 6)];
    expect(poseDuFantome(f, 2.8, notes)).toMatchObject({ glisse: true, slideUntil: 2.55 });
    expect(poseDuFantome(f, 3.2, notes).glisse).toBe(false);
    expect(poseDuFantome(f, 4.1, notes)).toMatchObject({ ecraseAt: 4, jumpAt: -99 });
    expect(poseDuFantome(f, 6.05, notes).ecraseAt).toBe(6);
    expect(poseDuFantome(f, 6.2, notes).glisse).toBe(false);
  });

  it("tire dans le couloir du coup, le temps d'un éclair ; une reprise après une mort remet le fantôme au sol", () => {
    const f = fantome(1, [
      { temps: 1, geste: "appui", action: "sauter" },
      { temps: 1.1, geste: "appui", action: "couloir2", resultat: "rate" },
      { temps: 1.2, geste: "appui", action: "couloir0" },
      { temps: 1.25, geste: "reprise", mains: "both", auto: false },
    ]);
    const p = poseDuFantome(f, 1.3, []);
    expect(p.tirs).toEqual([
      { couloir: 2, temps: 1.1, resultat: "rate" },
      { couloir: 0, temps: 1.2 },
    ]);
    expect(p.jumpAt).toBe(-99);
    expect(poseDuFantome(f, 1.1 + DUREE_TIR + 0.01, []).tirs).toEqual([{ couloir: 0, temps: 1.2 }]);
  });
});

describe("le fantôme dans la sauvegarde (ADR-0014)", () => {
  const r = { univers: "ville", lieu: "Royal Road", graine: 4242, diff: "normal" };
  const cle = cleChanson(4242, "normal");

  it("un nouveau record garde la partie comme fantôme de la chanson ; un score moindre ne la remplace pas", () => {
    let { doc, progres } = noterReussite(sauvegardeVide(), { ...r, score: 1000, fantome: fantome(1) });
    expect(progres.record).toBe(true);
    expect(fantomeDeLaChanson(doc, cle)).toEqual(fantome(1));
    ({ doc, progres } = noterReussite(doc, { ...r, score: 900, fantome: fantome(2) }));
    expect([progres.record, fantomeDeLaChanson(doc, cle).le]).toEqual([false, 1]);
    ({ doc } = noterReussite(doc, { ...r, score: 1200, fantome: fantome(3) }));
    expect(doc.chansons[cle]).toEqual({ meilleur: 1200, fantome: fantome(3) });
    // Un record sans partie (pas d'enregistrement) n'en garde pas une ancienne, qui n'est plus le meilleur passage
    ({ doc } = noterReussite(doc, { ...r, score: 1300 }));
    expect(doc.chansons[cle]).toEqual({ meilleur: 1300 });
    // Une composition (#28) garde le sien sous l'empreinte de sa partition
    ({ doc } = noterReussite(doc, { univers: "boite", cle: clePartition("abc"), score: 10, fantome: fantome(4) }));
    expect(fantomeDeLaChanson(doc, clePartition("abc")).le).toBe(4);
    expect(fantomeDeLaChanson(doc, "g1:1:facile")).toBeNull();
  });

  it(`au-delà de ${MAX_FANTOMES} fantômes, ceux d'une autre version du générateur partent d'abord, puis les plus anciens`, () => {
    let doc: Sauvegarde = sauvegardeVide();
    doc.chansons[`g${VERSION_GENERATEUR + 1}:1:facile`] = { meilleur: 5, fantome: fantome(9999) };
    for (let i = 0; i < MAX_FANTOMES - 1; i++)
      doc.chansons[cleChanson(i + 10, "facile")] = { meilleur: 1, fantome: fantome(100 + i) };
    expect(fantomesParAnciennete(doc)[0]).toBe(`g${VERSION_GENERATEUR + 1}:1:facile`);
    ({ doc } = noterReussite(doc, { ...r, score: 1000, fantome: fantome(5000) }));
    expect(fantomesParAnciennete(doc)).toHaveLength(MAX_FANTOMES);
    // Le fantôme périmé est parti, son meilleur score reste
    expect(doc.chansons[`g${VERSION_GENERATEUR + 1}:1:facile`]).toEqual({ meilleur: 5 });
    ({ doc } = noterReussite(doc, { ...r, graine: 77, score: 1, fantome: fantome(6000) }));
    expect(doc.chansons[cleChanson(10, "facile")]).toEqual({ meilleur: 1 });
    expect(fantomesParAnciennete(doc).at(-1)).toBe(cleChanson(77, "normal"));
    expect(fantomesParAnciennete(limiterFantomes(doc, 2))).toEqual([cle, cleChanson(77, "normal")]);
    expect(retirerUnFantome(sauvegardeVide())).toBeNull();
  });

  it("les traces de la chanson (#29) restent avec le fantôme : au record, à son départ et dans le code", () => {
    const avant: Sauvegarde = { ...sauvegardeVide(), chansons: { [cle]: { meilleur: 500, traces: [3, 11] } } };
    const { doc } = noterReussite(avant, { ...r, score: 1000, fantome: fantome(1) });
    expect(doc.chansons[cle]).toEqual({ meilleur: 1000, traces: [3, 11], fantome: fantome(1) });
    expect(retirerUnFantome(doc).chansons[cle]).toEqual({ meilleur: 1000, traces: [3, 11] });
    expect(pourLeCode(doc).chansons[cle]).toEqual({ meilleur: 1000, traces: [3, 11] });
    // Des traces sans score (la progression fictive d'un essai) n'ont pas de fantôme à garder
    const fictive = { v: VERSION, carte: {}, chansons: { e: { traces: [3], fantome: fantome(1) } } };
    expect(lireDocument(JSON.stringify(fictive)).doc.chansons).toEqual({ e: { traces: [3] } });
  });

  it("le code de sauvegarde porte tout sauf les fantômes ; coller un code garde les fantômes d'ici", () => {
    const ici: Sauvegarde = {
      ...sauvegardeVide(),
      chansons: { [cle]: { meilleur: 1000, fantome: fantome(1) }, a: { meilleur: 50, fantome: fantome(2) } },
    };
    expect(pourLeCode(ici).chansons).toEqual({ [cle]: { meilleur: 1000 }, a: { meilleur: 50 } });
    const lu = decoder(encoder(ici));
    expect(lu.etat === "ok" && lu.doc.chansons).toEqual({ [cle]: { meilleur: 1000 }, a: { meilleur: 50 } });
    expect(encoder(ici).length).toBe(encoder(pourLeCode(ici)).length);
    // Le meilleur score d'ailleurs s'ajoute ; le fantôme d'ici reste, celui d'une autre partie aussi
    const code: Sauvegarde = {
      ...sauvegardeVide(),
      chansons: { [cle]: { meilleur: 2000 }, a: { meilleur: 10 }, b: { meilleur: 7, fantome: fantome(3) } },
    };
    const doc = fusionner(ici, code);
    expect(doc.chansons).toEqual({
      [cle]: { meilleur: 2000, fantome: fantome(1) },
      a: { meilleur: 50, fantome: fantome(2) },
      b: { meilleur: 7, fantome: fantome(3) },
    });
    // Un score égal, d'une sauvegarde qui a un fantôme quand celle d'ici n'en a pas : il le donne
    expect(fusionner({ ...ici, chansons: { a: { meilleur: 50 } } }, ici).chansons.a).toEqual(ici.chansons.a);
  });

  it("un document de la version 3 migre sans fantôme ; un fantôme abîmé est laissé, le meilleur score reste", () => {
    expect(VERSION).toBe(4);
    const v3 = { v: 3, carte: {}, chansons: { [cle]: { meilleur: 10, traces: [3] } } };
    expect(lireDocument(JSON.stringify(v3))).toEqual({ etat: "ok", doc: { ...v3, v: VERSION } });
    const abime = { v: 4, carte: {}, chansons: { [cle]: { meilleur: 10, fantome: { coups: "non" } } } };
    expect(lireDocument(JSON.stringify(abime)).doc.chansons).toEqual({ [cle]: { meilleur: 10 } });
    const bon = { v: 4, carte: {}, chansons: { [cle]: { meilleur: 10, fantome: fantome(1) } } };
    expect(lireDocument(JSON.stringify(bon)).doc).toEqual(bon);
  });
});

describe("le stockage plein (ui/stockage.ts)", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Un stockage qui refuse tout texte plus long que `place`, comme un navigateur plein
  function stockagePlein(place: number, erreur = "QuotaExceededError") {
    const ranges = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => ranges.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > place) throw Object.assign(new Error("plein"), { name: erreur });
        ranges.set(k, v);
      },
    });
    return ranges;
  }
  const lourd = (le: number) =>
    fantome(
      le,
      Array.from({ length: 50 }, (_, i) => ({ temps: i, geste: "appui", action: "couloir1" }) as Coup),
    );

  it("les fantômes les plus anciens partent un à un jusqu'à ce que la sauvegarde tienne", async () => {
    const { ecrireSauvegarde, STOCKAGE } = await import("../src/ui/stockage");
    const doc: Sauvegarde = {
      ...sauvegardeVide(),
      chansons: {
        a: { meilleur: 1, fantome: lourd(3) },
        b: { meilleur: 2, fantome: lourd(1) },
        c: { meilleur: 3, fantome: lourd(2) },
      },
    };
    const un = JSON.stringify(lourd(1)).length;
    const ranges = stockagePlein(1.5 * un);
    const range = ecrireSauvegarde(doc);
    expect(range.chansons).toEqual({ a: { meilleur: 1, fantome: lourd(3) }, b: { meilleur: 2 }, c: { meilleur: 3 } });
    expect(JSON.parse(ranges.get(CLE))).toEqual(range);
    expect(STOCKAGE.etat).toBe("actif");

    // Plein même sans aucun fantôme : rien n'est rangé
    stockagePlein(10);
    expect(ecrireSauvegarde(doc)).toBeNull();
    expect(STOCKAGE.etat).toBe("indisponible");
    // Un stockage qui refuse pour une autre raison ne fait partir aucun fantôme
    const refus = stockagePlein(0, "SecurityError");
    expect(ecrireSauvegarde(doc)).toBeNull();
    expect(refus.size).toBe(0);
    STOCKAGE.etat = "actif";
  });
});

describe("l'essai du fantôme", () => {
  it("porte une progression fictive où la chanson d'essai a déjà un meilleur passage, qui laisse passer des notes", () => {
    const e = trouverEssai("fantome"),
      chanson = e.chanson(),
      doc = e.progression(),
      f = fantomeDeLaChanson(doc, cleEssai("fantome"));
    expect(f).toEqual(fantomeFictif(chanson, e.diff, "fantome"));
    expect(doc.chansons[cleEssai("fantome")].meilleur).toBe(f.scores.at(-1));
    const appuis = f.coups.filter((c) => c.geste === "appui");
    expect(appuis.length).toBeLessThan(chanson.ev.length);
    expect(appuis.length).toBeGreaterThan(chanson.ev.length / 2);
    expect(f.scores).toHaveLength(chanson.endBeat + 1);
    expect(f.scores.every((s, i) => i === 0 || s >= f.scores[i - 1])).toBe(true);
    const actions = new Set(appuis.map((c) => c.geste === "appui" && c.action));
    expect(actions.has("sauter") && actions.has("glisser")).toBe(true);
    expect([...actions].some((a) => String(a).startsWith("couloir"))).toBe(true);
  });
});

/* ---------- Dans le jeu ---------- */
let nav: Navigateur;
afterEach(() => nav?.fermer());

const spb = () => 60 / nav.jeu.state.song.bpm;
function attendre(t: number) {
  while (nav.jeu.songNow() < t) nav.image(t - nav.jeu.songNow() > 0.02 ? 1 / 60 : 0.001);
}
// Les touches d'un joueur parfait : S glisser, W sauter (et double saut), Espace écraser ; J K L ; à droite
const touche = (ev: Note, lane: number) =>
  ev.hand === "L" ? ["KeyS", "KeyW", "KeyW", "Space"][lane] : LANE_CODES[lane];
/** Joue la chanson en cours au clavier, sans faute, des deux mains, jusqu'à l'écran de fin */
function jouerAuClavier(auDepart = () => {}) {
  const S = nav.jeu.state;
  nav.presser("Space");
  auDepart();
  for (const e of evenementsClavier(S.song.ev, (beat) => beat * spb(), touche)) {
    attendre(e.at);
    faire(nav, e);
  }
  nav.avancerJusqua((s) => s.mode !== "play", 10);
  expect([S.mode, S.autoUsed]).toEqual(["done", false]);
}
const ecart = () => nav.textes.find((t) => t.startsWith("FANTÔME ") || t.startsWith("REFLET "));

describe("le fantôme dans une partie", () => {
  it("après un nouveau record, la partie est gardée pour sa graine et sa difficulté ; le fantôme la rejoue ensuite", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-diff": "debutant" } });
    const S = nav.jeu.state,
      reecoute = await import("../src/jeu/reecoute");
    // Sans meilleur passage, pas de fantôme
    nav.presser("Space");
    nav.image();
    expect([S.fantome, ecart()]).toEqual([null, undefined]);
    nav.jeu.load(S.seed, "debutant");

    jouerAuClavier();
    const partie = reecoute.dernierePartie(),
      gardee: Sauvegarde = JSON.parse(nav.stockage.get(CLE)),
      f = gardee.chansons[cleChanson(S.seed, "debutant")].fantome;
    expect(S.progres.record).toBe(true);
    expect(nav.overlay.innerHTML).toContain("ton fantôme rejouera ce passage");
    expect(f.coups.length).toBe(partie.coups.length);
    expect(
      f.coups.every((c, i) => c.geste === partie.coups[i].geste && Math.abs(c.temps - partie.coups[i].temps) < 1e-4),
    ).toBe(true);
    expect(f.scores.at(-1)).toBeGreaterThan(0);
    expect(S.sauvegarde.chansons[cleChanson(S.seed, "debutant")].fantome).toEqual(f);

    // La partie suivante court avec le fantôme : il saute au temps où le joueur avait sauté
    nav.jeu.load(S.seed, "debutant");
    nav.presser("Space");
    expect(S.fantome).toEqual(f);
    const saut = f.coups.find((c) => c.geste === "appui" && c.action === "sauter");
    attendre(saut.temps * spb() + 0.05);
    expect(poseDuFantome(S.fantome, nav.jeu.songNow() / spb(), S.song.ev).jumpAt).toBe(saut.temps);
    // Sans jouer, le joueur prend du retard : l'écart est négatif, en rouge
    attendre(Math.max(saut.temps, 12) * spb() + 0.5);
    expect(ecart()).toMatch(/^FANTÔME −\d/);
  });

  it("l'essai court dès la première partie avec son fantôme fictif", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=fantome" } });
    const S = nav.jeu.state,
      fictif = S.essai.sauvegarde.chansons[cleEssai("fantome")].fantome;
    nav.presser("Space");
    expect(S.fantome).toBe(fictif);
    attendre(8 * spb());
    expect(ecart()).toMatch(/^FANTÔME [−±]/);
  });

  it("battre le fantôme de l'essai le remplace par sa partie, en mémoire seulement", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=fantome" } });
    const S = nav.jeu.state,
      cle = cleEssai("fantome");
    jouerAuClavier();
    const mien = S.essai.sauvegarde.chansons[cle];
    expect(S.progres.record).toBe(true);
    expect(nav.overlay.innerHTML).toContain("ton fantôme rejouera ce passage");
    expect(mien.meilleur).toBe(S.score);
    expect(mien.fantome.le).toBeGreaterThan(0);
    expect(nav.stockage.has(CLE)).toBe(false);
  });

  it("le réglage masque le fantôme et l'écart, même en pleine partie, et il est retenu", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=fantome" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    attendre(4 * spb());
    expect(ecart()).toBeDefined();
    nav.jeu.setFantome(false);
    nav.image();
    expect([S.voirFantome, ecart(), nav.stockage.get("deux-mains-fantome")]).toEqual([false, undefined, "masquer"]);
    nav.fermer();

    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-fantome": "masquer" } });
    expect(nav.jeu.state.voirFantome).toBe(false);
    nav.jeu.setFantome(true);
    expect(nav.stockage.get("deux-mains-fantome")).toBe("voir");
  });

  it("une partie en mode pianiste (#53) n'est pas un record : elle ne laisse pas de fantôme", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-diff": "debutant" } });
    const S = nav.jeu.state;
    // Le mode pianiste se constate à la première note jouée ainsi : on le pose d'emblée
    jouerAuClavier(() => (S.pianiste = true));
    expect(S.pianiste).toBe(true);
    const gardee: Sauvegarde = JSON.parse(nav.stockage.get(CLE));
    expect(gardee.chansons[cleChanson(S.seed, "debutant")]?.fantome).toBeUndefined();
    expect(gardee.chansons[cleChanson(S.seed, "debutant")]?.meilleur).toBeUndefined();
  });

  it("dans la Boîte, le fantôme est un reflet", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=fantome" } });
    nav.jeu.setTheme("boite");
    nav.presser("Space");
    attendre(4 * spb());
    expect(ecart()).toMatch(/^REFLET /);
  });
});
