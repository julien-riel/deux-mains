// Jugement des coups (#3) : fenêtres, dégâts, mauvais couloir, notes tenues, accords, harmonie et quantification
// (ADR-0004). Logique pure (ADR-0007) : pas de faux navigateur, les effets sonores et visuels sont des espions.
// Les chansons sont fabriquées à 60 BPM : un temps dure une seconde, le temps de la chanson se lit en temps.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import type { Chanson, Main, Note } from "../src/chanson/types";
import { S } from "../src/jeu/etat";
import { brancherEffets, leftPress, missEv, release, rightPress, type Effets } from "../src/jeu/jugement";

const DIFFICULTES = ["debutant", "facile", "normal", "difficile"] as const;
const ETAT_NEUF = { ...S };

let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
beforeEach(() => {
  effets = {
    jouer: vi.fn(),
    couper: vi.fn(),
    reussite: vi.fn(),
    accord: vi.fn(),
    rate: vi.fn(),
    lache: vi.fn(),
    mauvaisCouloir: vi.fn(),
    solo: vi.fn(),
    tir: vi.fn(),
    mourir: vi.fn(),
  };
  brancherEffets(effets);
});

function note(hand: Main, beat: number, lane: number, dur = 0): Note {
  return { hand, beat, lane, dur, bar: Math.floor(beat / 4), kind: "couplet", midi: 60, air: 0.8, state: "pending" };
}
/** Les notes jouées ensemble forment un accord */
function accord(...notes: Note[]) {
  for (const ev of notes) ev.grp = notes;
  return notes;
}
/** Une partie neuve sur une chanson de 8 mesures à 60 BPM ; les mesures 4 et 5 sont le solo libre. */
function partie(ev: Note[], diff = "normal") {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff, mode: "play" });
  S.song = {
    bpm: 60,
    ev: ev.sort((a, b) => a.beat - b.beat),
    sections: [
      { name: "Couplet", kind: "couplet", bars: 4, start: 0 },
      { name: "Solo libre", kind: "pont", bars: 2, start: 4 },
      { name: "Refrain", kind: "refrain", bars: 2, start: 6 },
    ],
  } as unknown as Chanson;
  S.ev = S.song.ev;
  return S.ev;
}

describe("fenêtres de jugement", () => {
  it.each(DIFFICULTES)("en %s, « Parfait » et « Bien » suivent les fenêtres de la difficulté", (diff) => {
    const [parfait, bien] = DIFFS[diff].win;
    const [a, b, c, d] = partie([note("R", 4, 0), note("R", 6, 1), note("L", 8, 0), note("L", 10, 1)], diff);
    rightPress(0, 4 + parfait * 0.99);
    rightPress(1, 6 - bien * 0.99);
    leftPress(0, 8 - parfait * 0.99);
    leftPress(1, 10 + bien * 0.99);
    expect([a, b, c, d].map((ev) => ev.state)).toEqual(["hit", "hit", "hit", "hit"]);
    expect(effets.reussite.mock.calls.map(([, p]) => p)).toEqual([true, false, true, false]);
    expect([S.perfect, S.good, S.combo]).toEqual([2, 2, 4]);
  });

  it.each(DIFFICULTES)("en %s, un coup hors de la fenêtre « Bien » ne touche rien", (diff) => {
    const bien = DIFFS[diff].win[1];
    const [r, l] = partie([note("R", 4, 2), note("L", 8, 0)], diff);
    rightPress(2, 4 - bien * 1.05);
    rightPress(2, 4 + bien * 1.05);
    leftPress(0, 8 + bien * 1.05);
    expect([r.state, l.state]).toEqual(["pending", "pending"]);
    expect(effets.tir).toHaveBeenCalledWith(2, null);
    expect(effets.reussite).not.toHaveBeenCalled();
    expect([S.health, S.combo, S.miss]).toEqual([100, 0, 0]);
  });

  it("un « Parfait » rapporte plus de points qu'un « Bien »", () => {
    partie([note("R", 4, 0), note("R", 6, 0)]);
    rightPress(0, 4);
    const parfait = S.score;
    rightPress(0, 6.1);
    expect(parfait).toBe(300);
    expect(S.score - parfait).toBe(120);
  });

  it("entre deux notes du même couloir, le coup touche la plus proche", () => {
    const [a, b] = partie([note("R", 4, 0), note("R", 4.1, 0)]);
    rightPress(0, 4.08);
    expect([a.state, b.state]).toEqual(["pending", "hit"]);
  });
});

describe("notes manquées", () => {
  it.each(DIFFICULTES)("en %s, un obstacle ou un ennemi manqué fait les dégâts prévus", (diff) => {
    const { dmgL, dmgR } = DIFFS[diff];
    const [l, r] = partie([note("L", 4, 0), note("R", 6, 1)], diff);
    S.combo = 5;
    missEv(l);
    expect([l.state, S.health, S.combo, S.miss]).toEqual(["miss", 100 - dmgL, 0, 1]);
    missEv(r);
    expect([r.state, S.health, S.miss]).toEqual(["miss", 100 - dmgL - dmgR, 2]);
    expect(effets.rate).toHaveBeenCalledTimes(2);
  });

  it("l'harmonie ne descend pas sous zéro, et la partie s'arrête à zéro", () => {
    const [l] = partie([note("L", 4, 0)]);
    S.health = 5;
    missEv(l);
    expect(S.health).toBe(0);
    expect(effets.mourir).toHaveBeenCalledOnce();
  });
});

describe("mauvais coups", () => {
  it("tirer dans le mauvais couloir remet le combo à zéro, sans dégâts", () => {
    const [ev] = partie([note("R", 4, 1)]);
    S.combo = 12;
    rightPress(3, 4);
    expect([ev.state, S.combo, S.health, S.miss]).toEqual(["pending", 0, 100, 0]);
    expect(effets.mauvaisCouloir).toHaveBeenCalledWith(3);
    expect(effets.tir).toHaveBeenCalledWith(3, false);
  });

  it("sauter au lieu de glisser, ou l'inverse, provoque la collision", () => {
    const { dmgL } = DIFFS.normal;
    const [barre, bloc] = partie([note("L", 4, 0), note("L", 8, 1)]);
    leftPress(1, 4);
    leftPress(0, 8);
    expect([barre.state, bloc.state]).toEqual(["miss", "miss"]);
    expect(S.health).toBe(100 - 2 * dmgL);
  });

  it("sauter ou glisser fait bouger le personnage, même sans obstacle", () => {
    partie([]);
    leftPress(1, 3);
    expect(S.jumpAt).toBe(3);
    leftPress(0, 5);
    expect([S.jumpAt, S.slideUntil]).toEqual([-99, 5.55]);
  });

  it("un second appui sur sauter, en l'air, franchit le haut obstacle et joue sa note (#7)", () => {
    const saut = note("L", 4, 1),
      haut = note("L", 4.5, 2);
    saut.air = 1;
    partie([saut, haut]);
    leftPress(1, 4.02);
    leftPress(1, 4.5);
    expect([saut.state, haut.state]).toEqual(["hit", "hit"]);
    expect([S.doubleAt, S.doubleAir]).toEqual([4.5, 0.8]);
    expect(effets.jouer).toHaveBeenLastCalledWith(haut, null);
    expect([S.combo, S.miss, S.health]).toEqual([2, 0, 100]);
  });

  it("un saut simple heurte le haut obstacle : le second appui doit venir en l'air", () => {
    const { dmgL } = DIFFS.normal;
    const saut = note("L", 4, 1),
      haut = note("L", 4.5, 2);
    saut.air = 0.3;
    partie([saut, haut]);
    leftPress(1, 4);
    // Déjà retombé : c'est un nouveau saut simple, pas un double saut
    leftPress(1, 4.5);
    expect([saut.state, haut.state]).toEqual(["hit", "miss"]);
    expect([S.jumpAt, S.doubleAt]).toEqual([4.5, -99]);
    expect(S.health).toBe(100 - dmgL);
  });

  it("glisser sous un haut obstacle provoque aussi la collision", () => {
    const [haut] = partie([note("L", 4, 2)]);
    leftPress(0, 4);
    expect(haut.state).toBe("miss");
  });

  it("sans obstacle, le second appui en l'air fait un double saut, pas le troisième ; glisser l'interrompt", () => {
    partie([]);
    leftPress(1, 3);
    leftPress(1, 3.3);
    expect([S.jumpAt, S.doubleAt, S.doubleAir]).toEqual([3, 3.3, 0.8]);
    leftPress(1, 3.6);
    expect([S.jumpAt, S.doubleAt]).toEqual([3.6, 3.3]);
    leftPress(0, 5);
    expect([S.jumpAt, S.doubleAt]).toEqual([-99, -99]);
  });

  it("en l'air, un appui près d'un saut ordinaire reste un saut simple", () => {
    const [a, b] = partie([note("L", 4, 1), note("L", 4.6, 1)]);
    leftPress(1, 4);
    leftPress(1, 4.6);
    expect([a.state, b.state]).toEqual(["hit", "hit"]);
    expect([S.jumpAt, S.doubleAt]).toEqual([4.6, -99]);
  });

  it("pendant le solo libre, chaque tir joue une note de l'accord, sans jugement", () => {
    partie([]);
    rightPress(2, 17);
    expect(effets.solo).toHaveBeenCalledWith(2, 17);
    expect(effets.tir).toHaveBeenCalledWith(2, true);
    expect([S.score, S.combo, S.health]).toEqual([25, 0, 100]);
  });
});

describe("notes tenues", () => {
  it.each(["L", "R"] as const)("main %s : lâchée trop tôt, la note est cassée", (main) => {
    const [ev] = partie([note(main, 4, 0, 2)]);
    if (main === "L") leftPress(0, 4);
    else rightPress(0, 4);
    expect(ev.state).toBe("holding");
    release(main, 0, 5);
    expect(ev.state).toBe("broken");
    expect([S.combo, S.health]).toEqual([0, 94]);
    expect(effets.couper).toHaveBeenCalledWith(ev);
    expect(effets.lache).toHaveBeenCalledWith(ev);
  });

  it.each(["L", "R"] as const)("main %s : lâchée près de la fin, la note est réussie", (main) => {
    const [ev] = partie([note(main, 4, 0, 2)]);
    if (main === "L") leftPress(0, 4);
    else rightPress(0, 4);
    const avant = S.score;
    release(main, 0, 6 - DIFFS.normal.win[1] * 0.9);
    expect(ev.state).toBe("done");
    expect(S.score - avant).toBe(150);
    expect(S.health).toBe(100);
    expect(effets.couper).not.toHaveBeenCalled();
  });

  it("lâcher un couloir ne lâche pas la note tenue d'un autre couloir", () => {
    const [ev] = partie([note("R", 4, 1, 2)]);
    rightPress(1, 4);
    release("R", 2, 4.5);
    expect(ev.state).toBe("holding");
  });
});

describe("accords", () => {
  it("le bonus d'accord n'est donné que quand toutes ses notes sont réussies", () => {
    partie(accord(note("R", 4, 0), note("R", 4, 2), note("L", 4, 0)));
    rightPress(0, 4);
    rightPress(2, 4);
    expect(effets.accord).not.toHaveBeenCalled();
    expect(S.score).toBe(600);
    leftPress(0, 4);
    expect(effets.accord).toHaveBeenCalledOnce();
    expect(S.score).toBe(900 + 200 * 2);
  });

  it("une note manquée dans l'accord retire le bonus", () => {
    const [a] = partie(accord(note("R", 4, 0), note("R", 4, 2)));
    missEv(a);
    rightPress(2, 4);
    expect(effets.accord).not.toHaveBeenCalled();
  });

  it("au doigt, toucher un couloir de l'accord joue toutes ses notes de la main droite (ADR-0008)", () => {
    const notes = partie(accord(note("R", 4, 0), note("R", 4, 2), note("L", 4, 0)));
    expect(rightPress(2, 4, true).map((ev) => ev.lane)).toEqual([2, 0]);
    expect(notes.filter((ev) => ev.state === "hit").map((ev) => ev.hand)).toEqual(["R", "R"]);
  });
});

describe("harmonie et combo", () => {
  const huit = () => partie(Array.from({ length: 8 }, (_, i) => note("R", 4 + i, i % 4)));

  it("l'harmonie remonte de 4 toutes les 8 réussites", () => {
    huit();
    S.health = 50;
    for (let i = 0; i < 7; i++) rightPress(i % 4, 4 + i);
    expect(S.health).toBe(50);
    rightPress(3, 11);
    expect(S.health).toBe(54);
  });

  it("l'harmonie ne dépasse pas 100", () => {
    huit();
    S.health = 98;
    for (let i = 0; i < 8; i++) rightPress(i % 4, 4 + i);
    expect(S.health).toBe(100);
  });

  it("le multiplicateur monte d'un demi tous les 10 de combo, jusqu'à ×2,5", () => {
    const [ev] = partie([note("R", 4, 0)]);
    S.combo = 39;
    rightPress(0, 4);
    expect(ev.state).toBe("hit");
    expect([S.combo, S.maxCombo, S.score]).toEqual([40, 40, 750]);
  });
});

describe("quantification (ADR-0004)", () => {
  it("un coup en avance fait partir la note sur son temps", () => {
    const [ev] = partie([note("R", 4, 0)]);
    rightPress(0, 3.95);
    expect(effets.jouer).toHaveBeenCalledWith(ev, 4);
  });

  it("un coup en retard fait partir la note tout de suite", () => {
    const [ev] = partie([note("L", 4, 0)]);
    leftPress(0, 4.05);
    expect(effets.jouer).toHaveBeenCalledWith(ev, null);
  });

  it("une note jouée par l'auto-play ne repart pas : le séquenceur l'a déjà fait sonner", () => {
    const [ev] = partie([note("R", 4, 0)]);
    ev.auto = true;
    rightPress(0, 4);
    expect(ev.state).toBe("hit");
    expect(effets.jouer).not.toHaveBeenCalled();
  });
});
