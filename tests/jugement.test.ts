// Jugement des coups (#3) : fenêtres, dégâts, mauvais couloir, notes tenues, accords, harmonie et quantification
// (ADR-0004). Logique pure (ADR-0007) : pas de faux navigateur, les effets sonores et visuels sont des espions.
// Les chansons sont fabriquées à 60 BPM : un temps dure une seconde, le temps de la chanson se lit en temps.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import type { Chanson, Main, Note } from "../src/chanson/types";
import { COULOIRS, S, mult } from "../src/jeu/etat";
import {
  TRILLE,
  VIBRATO,
  brancherEffets,
  couloirDe,
  finirTrille,
  leftPress,
  missEv,
  pasDuSerpent,
  release,
  rightPress,
  serpentEnCours,
  seuilTrille,
  suivreSerpent,
  tempsDuPassage,
  type Effets,
} from "../src/jeu/jugement";

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
    vibrato: vi.fn(),
    trille: vi.fn(),
    glisser: vi.fn(),
    passage: vi.fn(),
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

describe("vibrato (#17)", () => {
  it("pendant une note tenue, tapoter un autre couloir fait vibrer la note, sans erreur ni coupure", () => {
    const [ev] = partie([note("R", 4, 0, 2)]);
    rightPress(0, 4);
    const [score, combo] = [S.score, S.combo];
    expect(rightPress(2, 4.5)).toEqual([]);
    expect(ev.state).toBe("holding");
    expect(effets.vibrato).toHaveBeenCalledWith(ev, VIBRATO.points);
    expect([S.score - score, S.combo, S.miss, S.health]).toEqual([VIBRATO.points, combo, 0, 100]);
    expect(effets.mauvaisCouloir).not.toHaveBeenCalled();
    expect(effets.couper).not.toHaveBeenCalled();
    expect(effets.tir).toHaveBeenCalledTimes(1);
    release("R", 2, 4.6);
    expect(ev.state).toBe("holding");
    release("R", 0, 6);
    expect(ev.state).toBe("done");
  });

  it("une note tenue sans vibrato reste réussie ; avec, elle rapporte en plus ses points de style", () => {
    const [a, b] = partie([note("R", 4, 0, 2), note("R", 8, 0, 2)]);
    rightPress(0, 4);
    release("R", 0, 6);
    const sans = S.score;
    rightPress(0, 8);
    rightPress(1, 9);
    release("R", 0, 10);
    expect([a.state, b.state]).toEqual(["done", "done"]);
    expect(S.score - sans).toBe(sans + VIBRATO.points);
  });

  it("les points de style sont plafonnés pour chaque note, le vibrato continue de sonner", () => {
    const [a, b] = partie([note("R", 4, 0, 3), note("R", 8, 1, 3)]);
    rightPress(0, 4);
    let score = S.score;
    for (let i = 0; i < VIBRATO.max + 3; i++) rightPress(2 + (i % 2), 4.2 + i * 0.3);
    expect(S.score - score).toBe(VIBRATO.points * VIBRATO.max);
    expect(effets.vibrato).toHaveBeenCalledTimes(VIBRATO.max + 3);
    expect(effets.vibrato).toHaveBeenLastCalledWith(a, 0);
    expect(a.vibrato).toBe(VIBRATO.max + 3);
    release("R", 0, 7);
    // La note suivante a son propre plafond
    rightPress(1, 8);
    score = S.score;
    rightPress(3, 8.5);
    expect(S.score - score).toBe(VIBRATO.points);
    expect(effets.vibrato).toHaveBeenLastCalledWith(b, VIBRATO.points);
  });

  it("pendant une note tenue, la note suivante d'un autre couloir se joue normalement", () => {
    const [tenue, suivante] = partie([note("R", 4, 0, 2), note("R", 6, 2)]);
    rightPress(0, 4);
    rightPress(2, 6 - DIFFS.normal.win[1] * 0.5);
    expect([tenue.state, suivante.state]).toEqual(["holding", "hit"]);
    expect(effets.vibrato).not.toHaveBeenCalled();
  });

  it("hors note tenue, tapoter garde son comportement : mauvais couloir près d'une note, tir dans le vide sinon", () => {
    const [ev] = partie([note("R", 4, 0, 2), note("R", 12, 1)]);
    rightPress(2, 4);
    expect(effets.mauvaisCouloir).toHaveBeenCalledWith(2);
    expect(S.combo).toBe(0);
    rightPress(0, 4);
    release("R", 0, 6);
    expect(ev.state).toBe("done");
    rightPress(1, 7);
    expect(effets.tir).toHaveBeenLastCalledWith(1, null);
    rightPress(3, 12);
    expect(effets.mauvaisCouloir).toHaveBeenCalledWith(3);
    expect(effets.vibrato).not.toHaveBeenCalled();
  });

  it("une note tenue cassée, ou de la main gauche, ne vibre pas", () => {
    const [basse, melodie] = partie([note("L", 4, 0, 2), note("R", 8, 0, 2)]);
    leftPress(0, 4);
    rightPress(1, 4.5);
    expect(basse.state).toBe("holding");
    rightPress(0, 8);
    release("R", 0, 8.5);
    expect(melodie.state).toBe("broken");
    rightPress(1, 9);
    expect(effets.vibrato).not.toHaveBeenCalled();
  });

  it("pendant le solo libre, tapoter joue le solo", () => {
    partie([note("R", 12, 0, 2)]);
    rightPress(1, 17);
    expect(effets.solo).toHaveBeenCalled();
    expect(effets.vibrato).not.toHaveBeenCalled();
  });
});

describe("trilles (#15)", () => {
  /** Une trille de `dur` temps entre `lane` et `voisin` */
  function trille(beat: number, lane: number, voisin: number, dur = 2): Note {
    return { ...note("R", beat, lane, dur), midi: 60 + lane, trille: voisin, midiTrille: 60 + voisin };
  }
  /** Alterne `n` fois à partir du couloir du premier appui, en appuis réguliers jusqu'à peu avant la fin */
  function alterner(ev: Note, depart: number, n: number) {
    const autre = depart === ev.lane ? ev.trille : ev.lane;
    for (let k = 1; k <= n; k++) rightPress(k % 2 ? autre : depart, ev.beat + (k * (ev.dur - 0.1)) / n);
  }

  it("le seuil est de TRILLE.parTemps alternances par temps de la trille", () => {
    expect(seuilTrille(trille(4, 1, 2, 2))).toBe(Math.floor(2 * TRILLE.parTemps));
    expect(seuilTrille(trille(4, 1, 2, 1))).toBe(Math.floor(TRILLE.parTemps));
  });

  it("alterner les deux touches joue alternativement les deux notes, et chaque changement de couloir compte", () => {
    const [ev] = partie([trille(4, 1, 2)]);
    expect(rightPress(1, 4)).toEqual([ev]);
    alterner(ev, 1, 5);
    expect(ev.state).toBe("holding");
    expect(ev.alternances).toBe(5);
    expect(effets.jouer.mock.calls.map(([, , lane]) => lane)).toEqual([1, 2, 1, 2, 1, 2]);
    expect(effets.trille).toHaveBeenCalledTimes(6);
    expect(effets.tir.mock.calls.every(([, ok]) => ok)).toBe(true);
    // Rien n'est compté avant la fin de la trille
    expect([S.combo, S.perfect, S.score]).toEqual([0, 0, 0]);
  });

  it("la trille peut commencer sur l'un ou l'autre de ses couloirs ; le premier appui sonne sur le temps", () => {
    const [ev] = partie([trille(4, 3, 2)]);
    rightPress(2, 4 - DIFFS.normal.win[1] * 0.5);
    expect([ev.state, ev.dernier, ev.alternances]).toEqual(["holding", 2, 0]);
    expect(effets.jouer).toHaveBeenCalledWith(ev, 4, 2);
  });

  it("appuyer deux fois sur le même couloir joue la note, sans compter d'alternance", () => {
    const [ev] = partie([trille(4, 1, 2)]);
    rightPress(1, 4);
    rightPress(1, 4.3);
    rightPress(2, 4.6);
    rightPress(2, 4.9);
    expect(ev.alternances).toBe(1);
    expect(effets.jouer).toHaveBeenCalledTimes(4);
  });

  it("sous le seuil, la trille est ratée ; au seuil, elle est réussie sans bonus", () => {
    const [a, b] = partie([trille(4, 1, 2), trille(8, 0, 1)]);
    rightPress(1, 4);
    alterner(a, 1, seuilTrille(a) - 1);
    finirTrille(a);
    expect([a.state, S.miss, S.combo, S.health]).toEqual(["miss", 1, 0, 100 - DIFFS.normal.dmgR]);
    expect(effets.rate).toHaveBeenCalledWith(a);
    rightPress(0, 8);
    alterner(b, 0, seuilTrille(b));
    finirTrille(b);
    expect([b.state, S.perfect, S.combo]).toEqual(["done", 1, 1]);
    expect(effets.reussite).toHaveBeenCalledWith(b, true, 0);
  });

  it("au-dessus du seuil, chaque alternance en plus rapporte TRILLE.bonus points", () => {
    const [a, b] = partie([trille(4, 1, 2), trille(8, 1, 2)]);
    rightPress(1, 4);
    alterner(a, 1, seuilTrille(a));
    finirTrille(a);
    const auSeuil = S.score;
    S.combo = 0;
    rightPress(1, 8);
    alterner(b, 1, seuilTrille(b) + 3);
    finirTrille(b);
    expect(S.score - auSeuil).toBe(auSeuil + 3 * TRILLE.bonus);
    expect(effets.reussite).toHaveBeenLastCalledWith(b, true, 3 * TRILLE.bonus);
  });

  it("le premier appui décide du « Parfait » ou du « Bien », compté à la fin", () => {
    const [ev] = partie([trille(4, 1, 2)]);
    rightPress(1, 4 + DIFFS.normal.win[1] * 0.9);
    alterner(ev, 1, seuilTrille(ev));
    finirTrille(ev);
    expect([S.perfect, S.good]).toEqual([0, 1]);
    expect(effets.reussite).toHaveBeenCalledWith(ev, false, 0);
  });

  it("une autre touche pendant la trille ne la casse pas et ne compte pas : ni erreur, ni vibrato", () => {
    const [ev] = partie([trille(4, 1, 2), note("R", 6.05, 3)]);
    rightPress(1, 4);
    rightPress(2, 4.2);
    rightPress(3, 4.4);
    rightPress(0, 4.6);
    rightPress(1, 4.8);
    expect([ev.state, ev.alternances]).toEqual(["holding", 2]);
    expect(effets.tir).toHaveBeenCalledWith(3, null);
    expect(effets.mauvaisCouloir).not.toHaveBeenCalled();
    expect(effets.vibrato).not.toHaveBeenCalled();
    expect(effets.jouer).toHaveBeenCalledTimes(3);
    // Même juste avant la note suivante, dont la fenêtre est ouverte : la trille protège de l'erreur
    rightPress(0, 6 - 0.05);
    expect([S.combo, ev.state]).toEqual([0, "holding"]);
    expect(effets.mauvaisCouloir).not.toHaveBeenCalled();
  });

  it("lâcher les touches de la trille ne la casse pas", () => {
    const [ev] = partie([trille(4, 1, 2)]);
    rightPress(1, 4);
    release("R", 1, 4.1);
    rightPress(2, 4.3);
    release("R", 2, 4.4);
    expect(ev.state).toBe("holding");
    expect(effets.lache).not.toHaveBeenCalled();
  });

  it("pendant une note tenue, la trille qui suit ne fait pas vibrer ; la note tenue garde son vibrato", () => {
    const [tenue, tr] = partie([note("R", 4, 0, 2), trille(7, 2, 3)]);
    rightPress(0, 4);
    rightPress(3, 4.5);
    expect(effets.vibrato).toHaveBeenCalledWith(tenue, VIBRATO.points);
    release("R", 0, 6);
    rightPress(2, 7);
    rightPress(0, 7.5);
    expect(effets.vibrato).toHaveBeenCalledTimes(1);
    expect([tr.state, tr.vibrato]).toEqual(["holding", undefined]);
  });

  it("à la pause, la trille en cours est réussie, sans bonus", () => {
    const [ev] = partie([trille(4, 1, 2)]);
    rightPress(1, 4);
    finirTrille(ev, true);
    expect([ev.state, S.miss, S.perfect]).toEqual(["done", 0, 1]);
    expect(effets.reussite).toHaveBeenCalledWith(ev, true, 0);
  });

  it("un appui hors de la fenêtre ne commence pas la trille", () => {
    const [ev] = partie([trille(4, 1, 2)]);
    rightPress(2, 4 - DIFFS.normal.win[1] * 1.1);
    expect(ev.state).toBe("pending");
    expect(effets.tir).toHaveBeenCalledWith(2, null);
  });

  it("dans un accord à deux mains, la trille compte à sa fin : bonus et accord du duo seulement si elle réussit", () => {
    const [basse, a, basse2, b] = partie([
      ...accord(note("L", 4, 0), trille(4, 1, 2)),
      ...accord(note("L", 8, 0), trille(8, 1, 2)),
    ]);
    rightPress(1, 4);
    leftPress(0, 4);
    expect([basse.state, a.state]).toEqual(["hit", "holding"]);
    expect(effets.accord).not.toHaveBeenCalled();
    expect(S.accordsDuo).toEqual({ reussis: 0, total: 0 });
    for (let k = 1; k <= seuilTrille(a); k++) rightPress(k % 2 ? 2 : 1, 4 + k * 0.3);
    finirTrille(a);
    expect(effets.accord).toHaveBeenCalledWith([basse, a]);
    expect(S.accordsDuo).toEqual({ reussis: 1, total: 1 });
    // Ratée, la trille fait rater l'accord, même si la basse l'a joué
    leftPress(0, 8);
    rightPress(1, 8);
    finirTrille(b);
    expect([basse2.state, b.state]).toEqual(["hit", "miss"]);
    expect(effets.accord).toHaveBeenCalledTimes(1);
    expect(S.accordsDuo).toEqual({ reussis: 1, total: 2 });
  });
});

describe("serpent (#16)", () => {
  /** Un serpent qui traverse ces couloirs, `pas` temps chacun ; chaque couloir joue sa note (60 + couloir) */
  function serpent(beat: number, lanes: number[], pas = 1): Note {
    return {
      ...note("R", beat, lanes[0], lanes.length * pas),
      serpent: lanes,
      midiSerpent: lanes.map((l) => 60 + l),
    };
  }
  // Le joueur au clavier : la touche est enfoncée (ou levée) puis l'action est jugée
  function appuyer(lane: number, ns: number) {
    S.keys[COULOIRS[lane]] = true;
    return rightPress(lane, ns);
  }
  function lever(lane: number, ns: number) {
    S.keys[COULOIRS[lane]] = false;
    release("R", lane, ns);
  }

  it("ses couloirs se partagent également sa durée : un passage à chaque pas", () => {
    const ev = serpent(4, [3, 2, 1, 0], 0.5);
    expect([pasDuSerpent(ev), tempsDuPassage(ev, 1), tempsDuPassage(ev, 3)]).toEqual([0.5, 4.5, 5.5]);
    expect(couloirDe(ev)).toBe(3);
    expect(couloirDe(note("R", 0, 2))).toBe(2);
  });

  it("suivi touche par touche, la tête puis chaque passage sont jugés, et la voix glisse jusqu'à chaque note", () => {
    const [ev] = partie([serpent(4, [0, 1, 2])]);
    appuyer(0, 4);
    expect([ev.state, ev.troncon, serpentEnCours(4.5)]).toEqual(["holding", 0, ev]);
    // En retard, la voix glisse tout de suite ; en avance, pile au temps du passage
    expect(appuyer(1, 5.02)).toEqual([]);
    expect([ev.troncon, couloirDe(ev)]).toEqual([1, 1]);
    appuyer(2, 6 - DIFFS.normal.win[1] * 0.9);
    expect(effets.glisser.mock.calls).toEqual([
      [ev, 1, null],
      [ev, 2, 6],
    ]);
    expect(effets.passage.mock.calls).toEqual([
      [ev, 1, true],
      [ev, 2, false],
    ]);
    expect([S.perfect, S.good, S.combo, S.miss]).toEqual([2, 1, 3, 0]);
    expect(effets.tir.mock.calls.map(([l, ok]) => [l, ok])).toEqual([
      [0, true],
      [1, true],
      [2, true],
    ]);
    // Au bout, il est réussi, même sans lâcher
    suivreSerpent(ev, 6.9);
    expect(ev.state).toBe("holding");
    suivreSerpent(ev, 7);
    expect(ev.state).toBe("done");
    expect(effets.couper).not.toHaveBeenCalled();
  });

  it("l'appui sur le couloir suivant est un passage, pas un vibrato ni un mauvais couloir", () => {
    const [ev] = partie([serpent(4, [1, 2]), note("R", 7, 3)]);
    appuyer(1, 4);
    appuyer(2, 5);
    expect([effets.vibrato, effets.mauvaisCouloir].map((f) => f.mock.calls.length)).toEqual([0, 0]);
    expect([ev.troncon, S.combo]).toEqual([1, 2]);
  });

  it("un autre couloir ne le casse pas et ne compte pas : ni erreur, ni vibrato ; la note qui suit se joue", () => {
    const [ev, apres] = partie([serpent(4, [0, 1, 2]), note("R", 7, 3)]);
    appuyer(0, 4);
    appuyer(3, 4.5);
    appuyer(0, 4.6);
    expect([ev.state, ev.troncon, S.combo, S.score > 0]).toEqual(["holding", 0, 1, true]);
    expect([effets.vibrato, effets.mauvaisCouloir].map((f) => f.mock.calls.length)).toEqual([0, 0]);
    expect(effets.tir).toHaveBeenLastCalledWith(0, null);
    // La note qui suit le serpent, jouée un peu en avance pendant qu'il finit
    appuyer(1, 5);
    appuyer(2, 6);
    appuyer(3, 7 - 0.05);
    expect(apres.state).toBe("hit");
  });

  it("un passage trop tôt n'est pas pris ; non joué à temps, il est raté : combo à zéro, dégâts, le serpent continue", () => {
    const [ev] = partie([serpent(4, [0, 1, 2])]);
    appuyer(0, 4);
    appuyer(1, 5 - DIFFS.normal.win[1] * 1.5);
    expect([ev.troncon, effets.tir.mock.lastCall]).toEqual([0, [1, null]]);
    suivreSerpent(ev, 5 + DIFFS.normal.win[1] * 0.9);
    expect(ev.troncon).toBe(0);
    suivreSerpent(ev, 5 + DIFFS.normal.win[1] * 1.1);
    expect([ev.state, ev.troncon, S.combo, S.miss, S.health]).toEqual(["holding", 1, 0, 1, 100 - DIFFS.normal.dmgR]);
    expect(effets.passage).toHaveBeenLastCalledWith(ev, 1, null);
    expect(effets.glisser).not.toHaveBeenCalled();
    // Le passage suivant se joue encore
    appuyer(2, 6);
    expect([ev.troncon, S.combo]).toEqual([2, 1]);
  });

  it("le chevauchement des touches est toléré : la nouvelle enfoncée avant de lever l'ancienne", () => {
    const [ev] = partie([serpent(4, [2, 1, 0])]);
    appuyer(2, 4);
    appuyer(1, 4.98);
    lever(2, 5.05);
    appuyer(0, 6);
    lever(1, 6.1);
    expect([ev.state, ev.troncon, S.health]).toEqual(["holding", 2, 100]);
  });

  it("relâcher toutes les touches le casse, avec les mêmes dégâts qu'une note tenue lâchée", () => {
    const [tenue, ev] = partie([note("R", 2, 3, 1.5), serpent(4, [0, 1, 2])]);
    appuyer(3, 2);
    lever(3, 2.5);
    const degats = 100 - S.health;
    expect([tenue.state, degats]).toEqual(["broken", 6]);
    appuyer(0, 4);
    appuyer(1, 5);
    lever(0, 5.1);
    expect(ev.state).toBe("holding");
    lever(1, 5.5);
    expect([ev.state, S.combo, 100 - S.health]).toEqual(["broken", 0, 2 * degats]);
    expect(effets.couper).toHaveBeenLastCalledWith(ev);
    expect(effets.lache).toHaveBeenLastCalledWith(ev);
    // Cassé, il ne juge plus ses passages
    suivreSerpent(ev, 7);
    expect([ev.state, S.miss]).toEqual(["broken", 0]);
  });

  it("lever l'ancienne touche juste avant le passage : joué à temps, le passage le rattrape ; sinon il casse", () => {
    const [a, b] = partie([serpent(4, [0, 1]), serpent(8, [3, 2])]);
    appuyer(0, 4);
    lever(0, 5 - DIFFS.normal.win[1] * 0.9);
    expect(a.state).toBe("holding");
    appuyer(1, 5.02);
    expect([a.state, a.troncon, a.lacheAt]).toEqual(["holding", 1, undefined]);
    lever(1, 6);
    expect(a.state).toBe("done");

    appuyer(3, 8);
    lever(3, 9 - DIFFS.normal.win[1] * 0.9);
    suivreSerpent(b, 9 + DIFFS.normal.win[1] * 1.1);
    expect([b.state, S.miss, 100 - S.health]).toEqual(["broken", 0, 6]);
  });

  it("une touche enfoncée de nouveau avant le passage le fait tenir : le passage manqué n'est qu'un raté", () => {
    const [ev] = partie([serpent(4, [0, 1, 2])]);
    appuyer(0, 4);
    lever(0, 4.95);
    appuyer(0, 4.97);
    suivreSerpent(ev, 5.2);
    expect([ev.state, ev.troncon, S.miss]).toEqual(["holding", 1, 1]);
  });

  it("à la fin, lâcher dans la fenêtre le réussit ; trop tôt après le dernier passage, il casse", () => {
    const [a, b] = partie([serpent(4, [1, 2]), serpent(8, [1, 2])]);
    appuyer(1, 4);
    appuyer(2, 5);
    lever(1, 5.05);
    lever(2, 6 - DIFFS.normal.win[1] * 0.9);
    expect(a.state).toBe("done");
    appuyer(1, 8);
    appuyer(2, 9);
    lever(1, 9.05);
    lever(2, 9.5);
    expect(b.state).toBe("broken");
  });

  it("une note tenue d'une autre main, ou la main gauche qui lâche, ne touchent pas au serpent", () => {
    const [ev] = partie([serpent(4, [0, 1])]);
    appuyer(0, 4);
    release("L", 0, 4.5);
    expect(ev.state).toBe("holding");
  });

  it("raté jusqu'à zéro d'harmonie, il s'arrête avec la partie", () => {
    const [ev] = partie([serpent(4, [0, 1, 2, 3], 0.5)]);
    appuyer(0, 4);
    S.health = DIFFS.normal.dmgR;
    effets.mourir.mockImplementation(() => (S.mode = "dying"));
    suivreSerpent(ev, 6);
    expect([S.health, ev.troncon, S.miss]).toEqual([0, 1, 1]);
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

describe("duo local (#6)", () => {
  /** Une partie en duo : chaque joueur tient une main */
  const duo = (ev: Note[], diff = "normal") => {
    const notes = partie(ev, diff);
    S.practice = "duo";
    return notes;
  };

  it("chaque main compte ses coups à part : score, combo, parfaits, bien, ratés, combo max", () => {
    const [r1, , , r3] = duo([note("R", 4, 0), note("L", 5, 0), note("R", 6, 1), note("R", 7, 2), note("L", 8, 1)]);
    rightPress(0, 4);
    leftPress(0, 5.1);
    rightPress(1, 6);
    missEv(r3);
    leftPress(1, 8);
    expect(r1.state).toBe("hit");
    expect(S.parMain.R).toEqual({ score: 600, combo: 0, maxCombo: 2, perfect: 2, good: 0, miss: 1 });
    expect(S.parMain.L).toEqual({ score: 420, combo: 2, maxCombo: 2, perfect: 1, good: 1, miss: 0 });
    // Le total est la somme des deux joueurs, hors bonus d'accord
    expect([S.score, S.perfect, S.good, S.miss]).toEqual([1020, 3, 1, 1]);
  });

  it("une erreur de la basse ne remet à zéro que le combo de la basse, et inversement", () => {
    const [, , l1, , r2] = duo([
      note("R", 4, 0),
      note("L", 4.5, 0),
      note("L", 5, 0),
      note("R", 5.5, 1),
      note("R", 6, 2),
      note("L", 7, 0),
    ]);
    rightPress(0, 4);
    leftPress(0, 4.5);
    missEv(l1);
    expect([S.parMain.L.combo, S.parMain.R.combo]).toEqual([0, 1]);
    rightPress(1, 5.5);
    missEv(r2);
    expect([S.parMain.L.combo, S.parMain.R.combo]).toEqual([0, 0]);
    leftPress(0, 7);
    expect([S.parMain.L.combo, S.parMain.R.combo]).toEqual([1, 0]);
  });

  it("le mauvais couloir et une note tenue lâchée cassent aussi le combo de leur seul joueur", () => {
    duo([note("L", 4, 0), note("R", 5, 0), note("R", 6, 1, 2), note("L", 6.5, 1)]);
    leftPress(0, 4);
    rightPress(0, 5);
    rightPress(3, 5.95);
    expect([S.parMain.L.combo, S.parMain.R.combo]).toEqual([1, 0]);
    rightPress(1, 6);
    leftPress(1, 6.5);
    release("R", 1, 6.6);
    expect([S.parMain.L.combo, S.parMain.R.combo]).toEqual([2, 0]);
  });

  it("l'harmonie est commune : une erreur de n'importe quel joueur la fait baisser", () => {
    const D = DIFFS.normal;
    const [l, r] = duo([note("L", 4, 0), note("R", 5, 0)]);
    missEv(l);
    expect(S.health).toBe(100 - D.dmgL);
    missEv(r);
    expect(S.health).toBe(100 - D.dmgL - D.dmgR);
  });

  it("en duo, le multiplicateur suit le combo de chaque joueur ; hors duo, le combo commun", () => {
    duo([note("L", 4, 0), note("R", 4, 0)]);
    S.parMain.L.combo = 10;
    leftPress(0, 4);
    rightPress(0, 4);
    expect([S.parMain.L.score, S.parMain.R.score]).toEqual([450, 300]);
    expect([mult("L"), mult("R")]).toEqual([1.5, 1]);
    S.practice = "both";
    S.combo = 20;
    expect([mult("L"), mult("R"), mult()]).toEqual([2, 2, 2]);
  });

  it("les accords à deux mains sont comptés à part : réussis, et jugés", () => {
    const notes = duo([
      ...accord(note("L", 4, 0), note("R", 4, 0), note("R", 4, 2)),
      ...accord(note("L", 5, 1), note("R", 5, 1)),
      ...accord(note("R", 6, 0), note("R", 6, 2)),
    ]);
    rightPress(0, 4, true);
    expect(S.accordsDuo).toEqual({ reussis: 0, total: 0 });
    leftPress(0, 4);
    expect(S.accordsDuo).toEqual({ reussis: 1, total: 1 });
    rightPress(1, 5);
    missEv(notes.find((ev) => ev.hand === "L" && ev.beat === 5));
    expect(S.accordsDuo).toEqual({ reussis: 1, total: 2 });
    // Un accord de la main droite seule n'est pas un accord en duo
    rightPress(0, 6, true);
    expect(S.accordsDuo).toEqual({ reussis: 1, total: 2 });
  });

  it("le bonus d'un accord à deux mains va au score total, pas à l'un des joueurs", () => {
    duo(accord(note("L", 4, 0), note("R", 4, 0)));
    rightPress(0, 4);
    leftPress(0, 4);
    expect([S.parMain.L.score, S.parMain.R.score, S.score]).toEqual([300, 300, 800]);
  });
});
