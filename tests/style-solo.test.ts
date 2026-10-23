// Note de style du solo libre (#22) : variété, respiration et résolution, d'une à trois étoiles, calculées sur les
// notes que garde la reprise du solo (#9, ADR-0012), et un conseil pour le critère le plus faible.

import { describe, expect, it } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong } from "../src/chanson/generateur";
import { S } from "../src/jeu/etat";
import {
  BRAVO,
  CRITERES,
  conseil,
  noterLeStyle,
  phrasesDuSolo,
  pointsDeStyle,
  resolution,
  respiration,
  variete,
  type Style,
} from "../src/jeu/style";
import { improviser, reprendreLeSolo, type NoteDuSolo } from "../src/jeu/variations";

const n = (croche: number, couloir: number): NoteDuSolo => ({ croche, couloir });
/** Des notes à la suite, une par croche à partir de `de`, sur les couloirs donnés */
const suite = (de: number, couloirs: number[]) => couloirs.map((c, i) => n(de + i, c));

describe("les phrases du solo", () => {
  it("sont coupées par un silence d'au moins un temps entier entre deux notes (trois croches)", () => {
    const solo = [n(0, 0), n(2, 1), n(5, 2), n(6, 3), n(12, 0)];
    expect(phrasesDuSolo(solo)).toEqual([[n(0, 0), n(2, 1)], [n(5, 2), n(6, 3)], [n(12, 0)]]);
  });

  it("suivent l'ordre des croches, quel que soit l'ordre d'arrivée", () => {
    expect(phrasesDuSolo([n(8, 1), n(0, 0), n(1, 2)])).toEqual([[n(0, 0), n(1, 2)], [n(8, 1)]]);
    expect(phrasesDuSolo([])).toEqual([]);
  });
});

describe("la variété", () => {
  it("une seule note répétée : une étoile", () => {
    expect(variete(suite(0, [2, 2, 2, 2, 2, 2]))).toBe(1);
    expect(noterLeStyle(suite(0, Array(16).fill(1))).variete).toBe(1);
  });

  it("deux couloirs bien partagés : deux étoiles ; trop souvent le même : une", () => {
    expect(variete(suite(0, [0, 1, 0, 1]))).toBe(2);
    expect(variete(suite(0, [0, 0, 0, 1]))).toBe(2);
    expect(variete(suite(0, [0, 0, 0, 0, 1]))).toBe(1);
  });

  it("trois couloirs ou plus, sans qu'un seul fasse plus de la moitié des notes : trois étoiles", () => {
    expect(variete(suite(0, [0, 1, 2, 1]))).toBe(3);
    expect(variete(suite(0, [0, 1, 2, 3, 2, 1]))).toBe(3);
    // Trois couloirs, mais toujours le même ou presque : deux étoiles
    expect(variete(suite(0, [1, 1, 1, 0, 2]))).toBe(2);
  });
});

describe("la respiration", () => {
  it("un solo sans aucun silence : une étoile", () => {
    expect(respiration(0)).toBe(1);
    const sansSilence = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map((c, i) => n(c, i % 4));
    expect(noterLeStyle(sansSilence)).toMatchObject({ respiration: 1, silences: 0, phrases: 1 });
  });

  it("un silence : deux étoiles ; deux ou plus : trois", () => {
    expect(respiration(1)).toBe(2);
    expect(respiration(2)).toBe(3);
    expect(respiration(5)).toBe(3);
    expect(noterLeStyle([...suite(0, [0, 1, 2]), ...suite(8, [2, 1, 0])])).toMatchObject({
      respiration: 2,
      silences: 1,
    });
  });
});

describe("la résolution", () => {
  it("un solo dont les phrases finissent sur la fondamentale : trois étoiles", () => {
    const solo = [...suite(0, [1, 2, 0]), ...suite(8, [3, 2, 1, 0]), ...suite(16, [2, 1, 0])];
    expect(noterLeStyle(solo)).toMatchObject({ resolution: 3, phrases: 3 });
  });

  it("l'octave, tout en haut, est aussi la fondamentale (ADR-0003)", () => {
    expect(resolution([suite(0, [0, 1, 2, 3]), suite(8, [2, 1, 0])])).toBe(3);
  });

  it("deux phrases sur trois suffisent pour trois étoiles ; une sur trois en donne deux ; aucune, une", () => {
    const fin = (c: number) => suite(0, [1, c]);
    expect(resolution([fin(0), fin(0), fin(2)])).toBe(3);
    expect(resolution([fin(0), fin(1), fin(2)])).toBe(2);
    expect(resolution([fin(0), fin(1)])).toBe(2);
    expect(resolution([fin(1), fin(2), fin(1)])).toBe(1);
    expect(resolution([fin(2)])).toBe(1);
  });
});

describe("la note de style et son conseil", () => {
  it("moins de trois notes au solo : pas de note", () => {
    expect(noterLeStyle([])).toBeNull();
    expect(noterLeStyle([n(0, 0), n(8, 1)])).toBeNull();
    expect(noterLeStyle([n(0, 0), n(8, 1), n(16, 0)])).not.toBeNull();
  });

  it("le conseil vise le critère le plus faible ; à égalité, le premier dans l'ordre affiché", () => {
    // Une note répétée sans s'arrêter, qui ne finit pas sur la fondamentale : tout à une étoile, conseil de variété
    const repetee = noterLeStyle(suite(0, Array(12).fill(1)));
    expect(repetee).toEqual({ variete: 1, respiration: 1, resolution: 1, faible: "variete", phrases: 1, silences: 0 });
    expect(conseil(repetee)).toBe(CRITERES[0].conseil);
    expect(conseil(repetee)).toMatch(/^Varie/);

    // Varié et résolu, mais sans silence : conseil de respiration
    const essouffle = noterLeStyle(suite(0, [1, 2, 3, 2, 1, 2, 0]));
    expect([essouffle.variete, essouffle.respiration, essouffle.resolution, essouffle.faible]).toEqual([
      3,
      1,
      3,
      "respiration",
    ]);
    expect(conseil(essouffle)).toMatch(/^Respire/);

    // Varié, aéré, mais des phrases qui restent en l'air : conseil de résolution
    const enLair = noterLeStyle([...suite(0, [0, 1, 2]), ...suite(8, [3, 2, 1]), ...suite(16, [0, 1, 2])]);
    expect([enLair.variete, enLair.respiration, enLair.resolution, enLair.faible]).toEqual([3, 3, 1, "resolution"]);
    expect(conseil(enLair)).toMatch(/^Conclus/);
  });

  it("trois étoiles partout : pas de critère faible, un bravo", () => {
    const style = noterLeStyle([...suite(0, [1, 2, 0]), ...suite(8, [2, 3]), ...suite(16, [2, 1, 0])]);
    expect(style).toEqual({ variete: 3, respiration: 3, resolution: 3, faible: null, phrases: 3, silences: 2 });
    expect(conseil(style)).toBe(BRAVO);
  });

  it("chaque critère a un nom, une explication et un conseil", () => {
    expect(CRITERES.map((c) => c.nom)).toEqual(["Variété", "Respiration", "Résolution"]);
    for (const c of CRITERES) expect([c.explication.length, c.conseil.length]).toSatisfy(([a, b]) => a > 10 && b > 20);
  });

  it("rapporte 50 points par étoile", () => {
    const style: Style = { variete: 1, respiration: 2, resolution: 3, faible: "variete", phrases: 2, silences: 1 };
    expect(pointsDeStyle(style)).toBe(300);
  });

  it("l'improvisation de l'auto-play est notée, toujours de la même façon pour une graine", () => {
    const style = noterLeStyle(improviser(4242, 32));
    expect(style).toEqual(noterLeStyle(improviser(4242, 32)));
    // Elle avance par degrés voisins sur les quatre couloirs et laisse des trous : variée et aérée
    expect(style.variete).toBeGreaterThanOrEqual(2);
    expect(style.respiration).toBeGreaterThanOrEqual(2);
  });
});

describe("à la fin du solo, dans la partie", () => {
  it("la note est calculée en même temps que la phrase reprise, une seule fois, et pas en boucle", () => {
    Object.assign(S, { diff: "normal", song: buildSong(4242, "normal"), bouclePartie: null });
    S.ev = S.song.ev;
    S.reprise = { solo: suite(0, [0, 0, 0, 0]), phrase: null, style: null, faite: false };
    expect(reprendreLeSolo(18 * 4, DIFFS.normal.mel)).toBeNull();
    expect(S.reprise.style).toBeNull();
    reprendreLeSolo(22 * 4, DIFFS.normal.mel);
    expect(S.reprise.style).toMatchObject({ variete: 1, respiration: 1, resolution: 3 });
    // Déjà notée : le solo n'est plus écouté
    S.reprise.solo.push(...suite(10, [1, 2, 3]));
    reprendreLeSolo(23 * 4, DIFFS.normal.mel);
    expect(S.reprise.style.variete).toBe(1);

    // En boucle (ADR-0009), rien n'est gardé ni noté
    S.reprise = { solo: suite(0, [0, 1, 2]), phrase: null, style: null, faite: false };
    S.bouclePartie = { sec: S.song.sections[3], cree: 1, passages: [] };
    reprendreLeSolo(22 * 4, DIFFS.normal.mel);
    expect(S.reprise.style).toBeNull();
    S.bouclePartie = null;
  });
});
