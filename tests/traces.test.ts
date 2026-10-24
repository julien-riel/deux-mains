// Les traces des notes parfaites (#29) : une mécanique commune (ADR-0015), habillée de graffitis lumineux dans la
// Ville et d'étoiles phosphorescentes dans la Boîte. Les règles pures d'abord (la trace, le plafond, la sauvegarde,
// le jugement qui les peint), puis des parcours complets dans le faux navigateur : gardées à la fin d'une chanson
// réussie, retrouvées au passage suivant, jamais écrites par un essai ni par une partie non classée.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAS_PAR_MESURE } from "../src/chanson/temps";
import type { Chanson, Main, Note } from "../src/chanson/types";
import { ESSAIS } from "../src/essais/registre";
import { LIEUX, graineDuLieu } from "../src/jeu/carte";
import { S, cleDesTraces, tracesAffichees } from "../src/jeu/etat";
import { brancherEffets, leftPress, rightPress, type Effets } from "../src/jeu/jugement";
import {
  COULEUR_BASSE,
  TRACES,
  couleurDeLaTrace,
  estTrace,
  mesureDeLaTrace,
  pasDeLaTrace,
  peutAjouter,
  reunir,
  trace,
} from "../src/jeu/traces";
import { decoder, encoder } from "../src/sauvegarde/code";
import {
  VERSION,
  cleChanson,
  cleEssai,
  fusionner,
  lireDocument,
  noterReussite,
  noterTraces,
  sauvegardeVide,
  tracesGardees,
  type Sauvegarde,
} from "../src/sauvegarde/format";
import { Navigateur, type Univers } from "./support/navigateur";

const CLE = "deux-mains-sauvegarde";
/** Une trace de la main droite au pas `p`, dans le couloir `l` */
const t = (p: number, l = 0) => p * 8 + l;

describe("une trace", () => {
  it("garde le pas de sa note et la couleur de son couloir, ou celle de la basse", () => {
    expect(trace("R", 2.5, 3)).toBe(30 * 8 + 3);
    expect(trace("L", 1, 1)).toBe(12 * 8 + COULEUR_BASSE);
    // Une petite note (#14), entre deux couloirs, prend la couleur du couloir du dessous
    expect(couleurDeLaTrace(trace("R", 0, 1.5))).toBe(1);
    // Un triolet tombe sur la grille de douze pas par temps (ADR-0013)
    expect(pasDeLaTrace(trace("R", 4 + 1 / 3, 0))).toBe(52);
    expect(mesureDeLaTrace(trace("R", 4 + 1 / 3, 0))).toBe(1);
  });

  it("a la bonne forme : un entier positif, d'une couleur connue", () => {
    expect([t(3), t(3, COULEUR_BASSE), 0].every(estTrace)).toBe(true);
    expect([-8, 1.5, t(3, 5), "8", null, Number.MAX_SAFE_INTEGER + 1].some(estTrace)).toBe(false);
  });

  it("est plafonnée : une fois chacune, au plus trois par mesure, au plus cent vingt par chanson", () => {
    const mesure = [t(0), t(6, 1), t(12, 2)];
    expect(peutAjouter(mesure, t(0))).toBe(false);
    expect(peutAjouter(mesure, t(18, 3))).toBe(false);
    expect(peutAjouter(mesure, t(PAS_PAR_MESURE))).toBe(true);
    const pleine = Array.from({ length: TRACES.max }, (_, i) => t(i * PAS_PAR_MESURE));
    expect(peutAjouter(pleine, t(TRACES.max * PAS_PAR_MESURE))).toBe(false);
  });

  it("se réunit : les premières gardent leur place, les suivantes s'ajoutent tant que le plafond le permet", () => {
    expect(reunir([t(12), t(0)], [t(6), t(0), t(18)], [t(60)])).toEqual([t(0), t(6), t(12), t(60)]);
    expect(reunir([t(0, 5), -1, t(1)])).toEqual([t(1)]);
    const beaucoup = Array.from({ length: 4 * TRACES.max }, (_, i) => t(i * 6));
    expect(reunir(beaucoup)).toHaveLength(TRACES.max);
  });
});

describe("les traces dans la sauvegarde (ADR-0014)", () => {
  const cle = cleChanson(4242, "normal");

  it("un document de la version 2 passe à la version actuelle, sans trace", () => {
    const v2 = { v: 2, carte: {}, chansons: { [cle]: { meilleur: 10 } } };
    expect(VERSION).toBeGreaterThanOrEqual(3);
    expect(lireDocument(JSON.stringify(v2))).toEqual({
      etat: "ok",
      doc: { v: VERSION, carte: {}, chansons: { [cle]: { meilleur: 10 } } },
    });
  });

  it("des traces abîmées sont laissées de côté une à une, et le plafond s'applique à ce qui reste", () => {
    const doc = lireDocument(
      JSON.stringify({
        v: VERSION,
        carte: {},
        chansons: {
          a: { meilleur: 5, traces: [t(12), "x", t(0), -3, t(1, 7)] },
          b: { traces: [t(0), t(6), t(12), t(18)] },
          c: { traces: "non" },
          d: { meilleur: -1, traces: [] },
        },
      }),
    ).doc;
    expect(doc.chansons).toEqual({
      a: { meilleur: 5, traces: [t(0), t(12)] },
      b: { traces: [t(0), t(6), t(12)] },
    });
  });

  it("une chanson finie ajoute ses nouvelles traces aux anciennes, sans toucher l'ancien document", () => {
    const avant: Sauvegarde = { ...sauvegardeVide(), chansons: { [cle]: { meilleur: 100, traces: [t(0)] } } };
    const apres = noterTraces(avant, cle, [t(6), t(0)]);
    expect(tracesGardees(apres, cle)).toEqual([t(0), t(6)]);
    expect(apres.chansons[cle].meilleur).toBe(100);
    expect(tracesGardees(avant, cle)).toEqual([t(0)]);
    // Rien de nouveau : le même document
    expect(noterTraces(apres, cle, [t(6)])).toBe(apres);
    expect(tracesGardees(noterTraces(sauvegardeVide(), "e:essai", [t(3)]), "e:essai")).toEqual([t(3)]);
  });

  it("un nouveau record garde les traces de la chanson", () => {
    const doc: Sauvegarde = { ...sauvegardeVide(), chansons: { [cle]: { meilleur: 100, traces: [t(0)] } } };
    const r = noterReussite(doc, { univers: "ville", lieu: "Royal Road", graine: 4242, diff: "normal", score: 200 });
    expect(r.doc.chansons[cle]).toEqual({ meilleur: 200, traces: [t(0)] });
  });

  it("fusionner garde le meilleur score et les traces des deux, celles d'ici d'abord", () => {
    const ici: Sauvegarde = {
        ...sauvegardeVide(),
        chansons: { [cle]: { meilleur: 100, traces: [t(0), t(6)] }, "e:x": { traces: [t(1)] } },
      },
      autre: Sauvegarde = {
        ...sauvegardeVide(),
        chansons: { [cle]: { traces: [t(12), t(18), t(48)] }, "e:x": { meilleur: 3 } },
      };
    expect(fusionner(ici, autre).chansons).toEqual({
      [cle]: { meilleur: 100, traces: [t(0), t(6), t(12), t(48)] },
      "e:x": { meilleur: 3, traces: [t(1)] },
    });
  });

  it("les traces voyagent dans le code de sauvegarde", () => {
    const doc: Sauvegarde = { ...sauvegardeVide(), chansons: { [cle]: { meilleur: 1, traces: [t(0), t(54, 4)] } } };
    expect(decoder(encoder(doc))).toEqual({ etat: "ok", doc });
  });
});

describe("le jugement peint les traces", () => {
  const ETAT_NEUF = { ...S };
  beforeEach(() => {
    const espion = new Proxy({}, { get: () => vi.fn() }) as Effets;
    brancherEffets(espion);
  });
  function note(hand: Main, beat: number, lane: number, extra: Partial<Note> = {}): Note {
    return { hand, beat, lane, dur: 0, bar: Math.floor(beat / 4), kind: "couplet", midi: 60, air: 0.8, ...extra };
  }
  // Une partie neuve à 60 BPM (un temps par seconde) sur ces notes, avec les traces de la chanson `cle`
  function partie(ev: Note[], cle: string | null = "test", boss = false) {
    Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", sauvegarde: sauvegardeVide() });
    for (const e of ev) e.state = "pending";
    S.song = {
      bpm: 60,
      ev,
      sections: [{ name: "Couplet", kind: "couplet", bars: 8, start: 0 }],
      ...(boss && { boss: { vie: 3, phrases: [] } }),
    } as unknown as Chanson;
    S.ev = ev;
    S.traces = { cle, nouvelles: [] };
  }

  it("une note « Parfait » laisse sa trace ; une note « Bien » non", () => {
    partie([note("R", 1, 2), note("R", 2, 0), note("L", 3, 1)]);
    rightPress(2, 1);
    rightPress(0, 2.1);
    leftPress(1, 3);
    expect([S.perfect, S.good]).toEqual([2, 1]);
    expect(S.traces.nouvelles).toEqual([trace("R", 1, 2), trace("L", 3, 1)]);
  });

  it("une mesure pleine n'en prend plus, en comptant celles que la sauvegarde garde déjà", () => {
    partie([0, 0.5, 1, 1.5, 4].map((b) => note("R", b, 0)));
    S.seed = 7;
    const cle = cleDesTraces();
    S.traces.cle = cle;
    S.sauvegarde = { ...sauvegardeVide(), chansons: { [cle]: { traces: [trace("R", 3, 1)] } } };
    for (const b of [0, 0.5, 1, 1.5, 4]) rightPress(0, b);
    expect(S.perfect).toBe(5);
    expect(S.traces.nouvelles).toEqual([trace("R", 0, 0), trace("R", 0.5, 0), trace("R", 4, 0)]);
    expect(tracesAffichees()).toEqual(reunir([trace("R", 3, 1)], S.traces.nouvelles));
  });

  it("un passage du serpent (#16) laisse sa trace à son temps, dans son nouveau couloir", () => {
    partie([note("R", 0, 0, { dur: 2, serpent: [0, 2] })]);
    rightPress(0, 0);
    S.keys.couloir0 = true;
    rightPress(2, 1);
    expect(S.traces.nouvelles).toEqual([trace("R", 0, 0), trace("R", 1, 2)]);
  });

  it("le boss de fin (#26) n'est pas la chanson de sa graine : il ne laisse pas de trace", () => {
    partie([note("R", 1, 0)], null, true);
    expect(cleDesTraces()).toBeNull();
    rightPress(0, 1);
    expect([S.perfect, S.traces.nouvelles, tracesAffichees()]).toEqual([1, [], []]);
  });
});

/* ---------- Parcours complets ---------- */
let nav: Navigateur;
afterEach(() => nav?.fermer());

/** Joue la chanson en cours comme un joueur parfait : l'auto-play frappe chaque note, mais la partie reste classée */
function jouerSansFaute(n: Navigateur) {
  const S = n.jeu.state;
  n.presser("Space");
  S.auto = true;
  n.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
  expect([S.mode, S.autoUsed, S.miss]).toEqual(["done", false, 0]);
}
const sauvegardeDe = (n: Navigateur): Sauvegarde => JSON.parse(n.stockage.get(CLE));
// Les coulures des graffitis de la Ville, à la dernière image
const coulures = (n: Navigateur) => n.remplissages.filter((c) => /^hsla\(\d+,\d+%,66%,0\.7\)$/.test(c)).length;
const etat = async () => await import("../src/jeu/etat");

describe.each(["ville", "boite"] as Univers[])("traces dans l'univers %s", (univers) => {
  it("une chanson réussie garde ses traces ; rejouée, elle les retrouve aux mêmes notes, et en ajoute", async () => {
    const graine = graineDuLieu(LIEUX[0]);
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": univers, "deux-mains-diff": "facile" } });
    nav.jeu.load(graine, "facile");
    jouerSansFaute(nav);
    const cle = cleChanson(graine, "facile"),
      gardees = sauvegardeDe(nav).chansons[cle].traces;
    expect(gardees.length).toBeGreaterThan(nav.jeu.state.song.totalBars);
    expect(gardees.length).toBeLessThanOrEqual(TRACES.parMesure * nav.jeu.state.song.totalBars);
    for (let m = 0; m < nav.jeu.state.song.totalBars; m++)
      expect(gardees.filter((x) => mesureDeLaTrace(x) === m).length).toBeLessThanOrEqual(TRACES.parMesure);
    // Chaque trace est celle d'une note de la partie (la reprise du solo y a réécrit le dernier refrain, ADR-0012)
    const notes = new Set(nav.jeu.state.ev.map((ev) => trace(ev.hand, ev.beat, ev.lane)));
    expect(gardees.filter((x) => !notes.has(x))).toEqual([]);
    nav.fermer();

    // Une autre visite : les traces sont là dès l'écran de départ, puis la partie en peint dans les mesures pas pleines
    const texte = JSON.stringify({ v: VERSION, carte: {}, chansons: { [cle]: { traces: gardees.slice(0, 5) } } });
    nav = await Navigateur.ouvrir({
      stockage: { "deux-mains-theme": univers, "deux-mains-diff": "facile", [CLE]: texte },
    });
    nav.jeu.load(graine, "facile");
    expect((await etat()).tracesAffichees()).toEqual(gardees.slice(0, 5));
    jouerSansFaute(nav);
    expect(sauvegardeDe(nav).chansons[cle].traces).toEqual(gardees);
  });

  it("le décor les montre pendant la partie", async () => {
    // Les coulures de peinture sont celles du décor de côté : la chanson tirée au hasard y reste (#83)
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": univers, "deux-mains-scene": "cote" } });
    const S = nav.jeu.state;
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.perfect >= 6, 60);
    expect(S.traces.nouvelles.length).toBeGreaterThan(0);
    nav.image();
    if (univers === "ville") expect(coulures(nav)).toBeGreaterThan(0);
    // L'auto-play peint, mais une partie non classée ne garde rien
    nav.avancerJusqua((s) => s.mode !== "play", 300);
    expect(nav.stockage.has(CLE)).toBe(false);
  });
});

describe("traces sans stockage, et dans les essais", () => {
  it("sans stockage, le jeu se joue et garde les traces en mémoire", async () => {
    nav = await Navigateur.ouvrir({ stockageBloque: true, stockage: {} });
    const S = nav.jeu.state;
    nav.jeu.load(graineDuLieu(LIEUX[1]), "debutant");
    jouerSansFaute(nav);
    expect(tracesGardees(S.sauvegarde, cleChanson(S.seed, "debutant")).length).toBeGreaterThan(0);
  });

  it.each(["graffitis", "etoiles"])(
    "l'essai %s montre d'anciennes traces, y ajoute les nouvelles en mémoire, et ne touche pas la vraie sauvegarde",
    async (id) => {
      const essai = ESSAIS.find((e) => e.id === id),
        texte = JSON.stringify(sauvegardeVide());
      nav = await Navigateur.ouvrir({ stockage: { [CLE]: texte }, adresse: { search: `?essai=${id}` } });
      const S = nav.jeu.state,
        anciennes = tracesGardees(essai.progression(), cleEssai(id));
      expect(S.theme).toBe(essai.univers);
      expect(anciennes.length).toBeGreaterThanOrEqual(4);
      expect((await etat()).tracesAffichees()).toEqual(anciennes);

      jouerSansFaute(nav);
      const apres = tracesGardees(S.essai.sauvegarde, cleEssai(id));
      expect(apres.length).toBeGreaterThan(anciennes.length);
      expect(anciennes.every((x) => apres.includes(x))).toBe(true);
      expect(nav.stockage.get(CLE)).toBe(texte);

      // Rejouer l'essai les retrouve
      nav.presser("Enter");
      expect((await etat()).tracesAffichees()).toEqual(apres);
    },
  );
});
