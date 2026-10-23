// Les partitions (#28, ADR-0016) : la notation, sa validation, `composer()`, l'empreinte et le code de partage DMP.
// Logique pure, sans faux navigateur. Un instantané de partitions protège la notation : la même partition doit
// toujours donner la même chanson.

import { describe, expect, it } from "vitest";
import {
  VERSION_PARTITION,
  composer,
  empreinteDe,
  graineDe,
  lirePartition,
  normaliser,
  notesDeMelodie,
  type Partition,
} from "../src/chanson/partition";
import { surLaGrille } from "../src/chanson/temps";
import { gammeDe, makeChord, PROGS } from "../src/chanson/theorie";
import { partitionExemple } from "../src/essais/registre";
import { PREFIXE_PARTITION, base64url, decoderPartition, encoderPartition } from "../src/sauvegarde/code";
import { decrireChanson } from "./support/instantane";

// Une partition qui écrit tous les signes de la notation, en croches et en triolets
const riche = (): Partition => ({
  v: VERSION_PARTITION,
  titre: "Toute la notation",
  ton: 2,
  bpm: 104,
  diff: "difficile",
  prog: "Royal Road",
  sections: [
    { genre: "intro", mesures: 1, basse: ["S......."], melodie: [] },
    {
      genre: "couplet",
      mesures: 4,
      basse: ["P..WD.S.", "T--.M--.", "S..WB--.", "SWSSWSSWS..."],
      melodie: ["1~~3_-0.", "0///2.3.", "3-\\-\\-1.", "0a1b2c3."],
    },
    { genre: "pont", mesures: 2, basse: ["T------."], melodie: [] },
    { genre: "pont", croisee: true, mesures: 1, basse: ["S...S..."], melodie: ["0.1.2.3."] },
    { genre: "polyrythmie", mesures: 2, basse: ["SWSS..SWSS.."], melodie: ["01..23.."] },
    { genre: "refrain", mesures: 2, basse: ["S.W.S.W."], melodie: ["012301230123"] },
    { genre: "outro", mesures: 1, basse: ["S......."], melodie: ["0-------"] },
  ],
});

describe("composer une partition", () => {
  it("donne une chanson complète : sections bout à bout, un accord par mesure, la source et sa graine", () => {
    const p = riche(),
      c = composer(p);
    expect(c.sections.map((s) => [s.name, s.kind, s.start, s.bars, !!s.croisee])).toEqual([
      ["Intro", "intro", 0, 1, false],
      ["Couplet", "couplet", 1, 4, false],
      ["Solo libre", "pont", 5, 2, false],
      ["Mains croisées", "pont", 7, 1, true],
      ["3 contre 2", "polyrythmie", 8, 2, false],
      ["Refrain", "refrain", 10, 2, false],
      ["Outro", "outro", 12, 1, false],
    ]);
    expect([c.totalBars, c.chords.length, c.endBeat, c.bpm, c.keyPc]).toEqual([13, 13, 52, 104, 2]);
    expect(c.keyName).toBe("Ré majeur");
    expect(c.source).toEqual({ genre: "partition", empreinte: empreinteDe(p), titre: "Toute la notation" });
    expect(c.seed).toBe(graineDe(empreinteDe(p)));
    expect(c.chanteurs).toEqual([]);
  });

  it("suit la progression depuis le début de chaque section, et l'accord de fin à l'outro", () => {
    const c = composer(riche()),
      prog = PROGS.find((x) => x.name === "Royal Road");
    expect(c.chords[1]).toEqual(makeChord(2, prog.chords[0]));
    expect(c.chords[2]).toEqual(makeChord(2, prog.chords[1]));
    expect(c.chords[5]).toEqual(makeChord(2, prog.chords[0]));
    expect(c.chords[12]).toEqual(makeChord(2, prog.end));
  });

  it("joue des degrés de l'accord (ADR-0003), sur la grille de 12 pas (ADR-0013), triés et reliés en accords", () => {
    const c = composer(riche());
    c.ev.forEach((ev, i) => {
      if (i) expect(ev.beat).toBeGreaterThanOrEqual(c.ev[i - 1].beat);
      expect(surLaGrille(ev.beat) && surLaGrille(ev.dur)).toBe(true);
      expect(ev.bar).toBe(Math.floor(ev.beat / 4));
      expect(ev.beat + ev.dur).toBeLessThanOrEqual((ev.bar + 1) * 4);
      const ch = c.chords[ev.bar];
      if (ev.hand === "R" && Number.isInteger(ev.lane)) expect(ev.midi).toBe(ch.lanes[ev.lane]);
      else if (ev.hand === "R") expect(gammeDe(c.keyPc, c.prog, ch, true)).toContain(ev.midi % 12);
      else if (ev.fin === undefined)
        expect(ev.midi).toBe([ch.bass, ch.bass + 12, ch.bass + 12 + ch.ints[2], ch.bass][ev.lane]);
    });
    // Aucune plaque d'office : seule celle que la partition écrit (P)
    expect(c.ev.filter((e) => e.hand === "L" && e.lane === 3).map((e) => e.beat)).toEqual([4]);
    // Le solo libre n'a pas de mélodie ; la basse du couplet en triolets tombe toutes les 1/3 de temps
    expect(c.ev.filter((e) => e.hand === "R" && e.bar >= 5 && e.bar < 7)).toEqual([]);
    expect(c.ev.filter((e) => e.hand === "L" && e.bar === 4).map((e) => Math.round((e.beat - 16) * 3))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("une liste vide fait taire une main ; un motif plus court que la section est repris en boucle", () => {
    const p = riche();
    p.sections = [{ genre: "couplet", mesures: 3, basse: [], melodie: ["0.......", "1......."] }];
    const c = composer(p);
    expect(c.ev.filter((e) => e.hand === "L")).toEqual([]);
    expect(c.ev.map((e) => [e.beat, e.lane])).toEqual([
      [0, 0],
      [4, 1],
      [8, 0],
    ]);
  });

  it("la mélodie en triolets divise la mesure en douze, les tenues comprises", () => {
    const ch = makeChord(0, [0, "M"]),
      notes = notesDeMelodie("0--1........", 2, ch, "couplet", gammeDe(0, PROGS[0], ch, true));
    expect(notes.map((n) => [n.beat, n.dur, n.lane])).toEqual([
      [8, 1, 0],
      [9, 0, 1],
    ]);
  });

  it("l'exemple de l'essai et la partition riche donnent toujours les mêmes chansons (instantané des partitions)", async () => {
    const resultat = Object.fromEntries(
      [partitionExemple(), riche()].map((p) => [
        p.titre,
        { empreinte: empreinteDe(p), chanson: decrireChanson(composer(p)) },
      ]),
    );
    await expect(JSON.stringify(resultat, null, 2) + "\n").toMatchFileSnapshot("./instantanes/partitions.json");
  });
});

describe("ce qu'une partition permet", () => {
  it("une partition valide se relit normalisée : champs dans l'ordre, rien d'autre", () => {
    const p = { ...riche(), inconnu: 1 } as Partition;
    const lu = lirePartition(JSON.parse(JSON.stringify(p)));
    expect(lu).toEqual(normaliser(riche()));
    expect(Object.keys(lu)).toEqual(["v", "titre", "ton", "bpm", "diff", "prog", "sections"]);
  });

  it("refuse tout ce qui n'est pas permis, sans réparer", () => {
    const avec = (f: (p: Record<string, unknown>) => void) => {
      const p = JSON.parse(JSON.stringify(riche()));
      f(p);
      return lirePartition(p);
    };
    const refusees = [
      lirePartition(null),
      lirePartition([]),
      lirePartition("texte"),
      avec((p) => (p.v = VERSION_PARTITION + 1)),
      avec((p) => (p.v = 0)),
      avec((p) => (p.titre = "x".repeat(41))),
      avec((p) => (p.titre = 3)),
      avec((p) => (p.ton = 12)),
      avec((p) => (p.ton = 1.5)),
      avec((p) => (p.bpm = 59)),
      avec((p) => (p.bpm = 181)),
      avec((p) => (p.diff = "extreme")),
      avec((p) => (p.prog = "Blues")),
      avec((p) => (p.sections = [])),
      avec((p) => (p.sections = Array.from({ length: 17 }, () => (p.sections as unknown[])[1]))),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].genre = "pont-levis")),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].mesures = 0)),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].mesures = 33)),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].basse = "S.......")),
      // Une hauteur écrite en dur, un escalier (ses marches viennent de la gamme), une longueur de motif inconnue
      avec((p) => ((p.sections as Record<string, unknown>[])[1].melodie = ["60......"])),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].basse = ["S./.\\..."])),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].basse = ["S......"])),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].melodie = ["0".repeat(16)])),
      // Le solo libre n'a pas de mélodie écrite ; les mains croisées sont un pont
      avec((p) => ((p.sections as Record<string, unknown>[])[2].melodie = ["0......."])),
      avec((p) => ((p.sections as Record<string, unknown>[])[1].croisee = true)),
      avec((p) => ((p.sections as Record<string, unknown>[])[3].croisee = "oui")),
      // Plus de 64 mesures en tout
      avec(
        (p) =>
          (p.sections = Array.from({ length: 3 }, () => ({ genre: "couplet", mesures: 22, basse: [], melodie: [] }))),
      ),
    ];
    for (const r of refusees) expect(r).toBeNull();
    // Un solo libre peut porter des silences, et 64 mesures passent
    expect(avec((p) => ((p.sections as Record<string, unknown>[])[2].melodie = ["........"]))).not.toBeNull();
    expect(
      avec(
        (p) =>
          (p.sections = Array.from({ length: 2 }, () => ({ genre: "couplet", mesures: 32, basse: [], melodie: [] }))),
      ),
    ).not.toBeNull();
  });
});

describe("empreinte et code de partage", () => {
  it("l'empreinte est stable, et change dès qu'un signe ou le titre change", () => {
    const e = empreinteDe(riche());
    expect(e).toMatch(/^[0-9a-f]{14}$/);
    expect(empreinteDe(riche())).toBe(e);
    const autre = riche();
    autre.sections[1].melodie[0] = "1~~3_-1.";
    expect(empreinteDe(autre)).not.toBe(e);
    expect(empreinteDe({ ...riche(), titre: "Autre" })).not.toBe(e);
    for (const x of ["00000000000000", "ffffffffffffff", e]) expect(graineDe(x)).toBeGreaterThanOrEqual(1);
    expect(graineDe("ffffffffffffff")).toBeLessThanOrEqual(99999);
  });

  it("le code DMP recrée la partition à l'identique, même coupé ou recopié avec des espaces", () => {
    const code = encoderPartition(riche());
    expect(code.startsWith(`${PREFIXE_PARTITION}${VERSION_PARTITION}.`)).toBe(true);
    expect(decoderPartition(code)).toEqual({ etat: "ok", partition: normaliser(riche()) });
    const coupe = ` ${code.slice(0, 12)}\n${code.slice(12)} `;
    expect(decoderPartition(coupe)).toEqual({ etat: "ok", partition: normaliser(riche()) });
    expect(composer((decoderPartition(code) as { partition: Partition }).partition).ev.length).toBe(
      composer(riche()).ev.length,
    );
  });

  it("un code abîmé, étranger ou interdit est refusé ; celui d'une notation plus récente est signalé", () => {
    const code = encoderPartition(riche()),
      json = JSON.stringify(riche());
    for (const faux of [
      "",
      code.slice(0, -5),
      code.replace(/^DMP/, "DM"),
      code.replace(/^DMP1\./, "DMP2."),
      `DMP1.${base64url("pas du json")}`,
      `DMP1.${base64url(json.replace('"ton":2', '"ton":13'))}`,
    ])
      expect(decoderPartition(faux).etat).toBe("invalide");
    const futur = `DMP2.${base64url(json.replace('"v":1', '"v":2'))}`;
    expect(decoderPartition(futur)).toEqual({ etat: "plus-recente", version: 2 });
  });
});
