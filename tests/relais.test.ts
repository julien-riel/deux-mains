// Phrases en relais (#20) : une main commence l'arpège, l'autre le finit. Le générateur (graines de l'instantané,
// ADR-0005), le jugement avec des effets espions (logique pure, ADR-0007), puis l'essai « relais » au clavier dans
// le faux navigateur : le fil du passage de relais, et le bonus de la phrase entière.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { PHRASES_EN_RELAIS, buildSong, phraseEnRelais } from "../src/chanson/generateur";
import { makeChord } from "../src/chanson/theorie";
import type { Chanson, Note } from "../src/chanson/types";
import { S, mult } from "../src/jeu/etat";
import { RELAIS, brancherEffets, leftPress, missEv, rightPress, type Effets } from "../src/jeu/jugement";
import { phrasesReprises, soloEtRefrain } from "../src/jeu/variations";
import { LANE_CODES } from "../src/ui/touches";
import { evenementsClavier, faire } from "./support/appuis";
import { DIFFICULTES, GRAINES } from "./support/instantane";
import { Navigateur } from "./support/navigateur";

const CHANSONS = DIFFICULTES.flatMap((diff) => GRAINES.map((graine) => ({ diff, chanson: buildSong(graine, diff) })));
const dans = (diff: string) => CHANSONS.filter((c) => c.diff === diff).map((c) => c.chanson);
/** Les relais d'une chanson : leurs notes, par mesure de début */
function relaisDe(c: Chanson) {
  const groupes = new Map<number, Note[]>();
  for (const ev of c.ev) if (ev.relais !== undefined) groupes.set(ev.relais, [...(groupes.get(ev.relais) ?? []), ev]);
  return groupes;
}
const sectionDe = (c: Chanson, bar: number) => c.sections.find((s) => bar >= s.start && bar < s.start + s.bars);
const resume = (ev: Note) => [ev.hand, ev.beat, ev.lane, ev.midi, ev.dur];

describe("phrases en relais dans le générateur", () => {
  it.each(["debutant", "facile"])("en %s, aucun relais", (diff) => {
    for (const c of dans(diff)) expect(relaisDe(c).size).toBe(0);
  });

  it.each(["normal", "difficile"])(
    "en %s, la plupart des chansons en ont : la deuxième phrase du couplet, la troisième de chaque refrain",
    (diff) => {
      const avec = dans(diff).filter((c) => relaisDe(c).size);
      expect(avec.length).toBeGreaterThanOrEqual(GRAINES.length / 2);
      for (const c of avec) {
        for (const bar of relaisDe(c).keys()) {
          const sec = sectionDe(c, bar);
          expect(["couplet", "refrain"]).toContain(sec.kind);
          expect(bar).toBe(sec.start + 2 * PHRASES_EN_RELAIS[sec.kind]);
        }
        // Les deux refrains ont le même relais, dans le même sens
        const refrains = c.sections.filter((s) => s.kind === "refrain"),
          [a, b] = refrains.map((s) => relaisDe(c).get(s.start + 4) ?? []);
        expect(a.map((ev) => [ev.hand, ev.beat % 8, ev.lane])).toEqual(b.map((ev) => [ev.hand, ev.beat % 8, ev.lane]));
      }
    },
  );

  it("une main joue les quatre temps de la première mesure, l'autre ceux de la seconde, et personne d'autre", () => {
    for (const c of [...dans("normal"), ...dans("difficile")])
      for (const [bar, notes] of relaisDe(c)) {
        const ici = c.ev.filter((ev) => ev.beat >= bar * 4 && ev.beat < bar * 4 + 8);
        expect(ici).toEqual(notes);
        expect(notes.map((ev) => [ev.beat, ev.dur])).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((t) => [bar * 4 + t, 0]));
        const [premiere, seconde] = [notes.slice(0, 4), notes.slice(4)];
        expect(new Set(premiere.map((ev) => ev.hand)).size).toBe(1);
        expect(seconde.every((ev) => ev.hand !== premiere[0].hand)).toBe(true);
      }
  });

  it("la ligne passe d'une main à l'autre dans un seul sens, sur l'arpège de l'accord de chaque mesure (ADR-0003)", () => {
    let montees = 0,
      descentes = 0;
    for (const c of [...dans("normal"), ...dans("difficile")])
      for (const [bar, notes] of relaisDe(c)) {
        const basse = notes.filter((ev) => ev.hand === "L"),
          melodie = notes.filter((ev) => ev.hand === "R"),
          monte = notes[0].hand === "L",
          chB = c.chords[basse[0].bar],
          chM = c.chords[melodie[0].bar],
          arpege = [chB.bass, chB.bass + chB.ints[1], chB.bass + chB.ints[2], chB.bass + 12];
        if (monte) montees++;
        else descentes++;
        // La basse : glisser, deux marches, sauter en montant ; sauter, deux marches, glisser en descendant
        expect(basse.map((ev) => [ev.lane, ev.midi])).toEqual(
          monte ? [0, 4, 4, 1].map((l, i) => [l, arpege[i]]) : [1, 5, 5, 0].map((l, i) => [l, arpege[3 - i]]),
        );
        // La mélodie : les quatre degrés, sans harmonie, pour qu'on n'entende qu'une ligne
        const degres = monte ? [0, 1, 2, 3] : [3, 2, 1, 0];
        expect(melodie.map((ev) => [ev.lane, ev.midi, ev.harm])).toEqual(
          degres.map((l) => [l, chM.lanes[l], undefined]),
        );
        expect([basse[0].bar, melodie[0].bar]).toEqual(monte ? [bar, bar + 1] : [bar + 1, bar]);
      }
    expect(montees).toBeGreaterThan(0);
    expect(descentes).toBeGreaterThan(0);
  });

  it("les relais ont leur propre tirage : hors de leurs mesures, la chanson est celle d'avant eux", () => {
    for (const diff of ["normal", "difficile"] as const) {
      const avant = DIFFS[diff].relaisP;
      for (const graine of GRAINES) {
        const avec = buildSong(graine, diff);
        DIFFS[diff].relaisP = 0;
        const sans = buildSong(graine, diff);
        DIFFS[diff].relaisP = avant;
        const mesures = [...relaisDe(avec).keys()].flatMap((b) => [b, b + 1]),
          hors = (c: Chanson) => c.ev.filter((ev) => !mesures.includes(ev.bar));
        expect(relaisDe(sans).size).toBe(0);
        // En Difficile, la mesure d'avant peut rejoindre le relais par un escalier, et les escaliers suivants
        // tirent alors leur hasard autrement : la mélodie, elle, ne change pas
        const main = diff === "normal" ? () => true : (ev: Note) => ev.hand === "R";
        expect(hors(avec).filter(main).map(resume)).toEqual(hors(sans).filter(main).map(resume));
      }
    }
  });

  it("ni au solo, ni dans les phrases que la reprise du solo remplace, ni sur le chanteur", () => {
    for (const c of [...dans("normal"), ...dans("difficile")]) {
      const reprises = phrasesReprises(soloEtRefrain(c.sections).refrain);
      for (const bar of relaisDe(c).keys()) {
        expect(reprises.some((b) => bar * 4 >= b && bar * 4 < b + 8)).toBe(false);
        for (const ch of c.chanteurs) expect([ch.bar, ch.bar + 1]).not.toContain(bar);
        for (const ch of c.chanteurs) expect([ch.bar, ch.bar + 1]).not.toContain(bar + 1);
      }
    }
  });
});

/* ---------- Jugement ---------- */

let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
const ETAT_NEUF = { ...S };
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

// Une partie à 60 BPM (un temps par seconde) : un relais qui monte sur les mesures 1 et 2, un qui descend sur 3 et 4
function partie(practice: "both" | "duo" = "both") {
  const chords = [0, 7, 9, 5, 0, 0].map((off) => makeChord(0, [off, off === 9 ? "m" : "M"]));
  Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", practice });
  S.song = {
    bpm: 60,
    chords,
    ev: [...phraseEnRelais(true, 1, chords, "couplet"), ...phraseEnRelais(false, 3, chords, "couplet")].sort(
      (a, b) => a.beat - b.beat,
    ),
    sections: [{ name: "Couplet", kind: "couplet", bars: 6, start: 0 }],
  } as unknown as Chanson;
  S.ev = S.song.ev;
  return S.ev;
}
// Joue la note pile sur son temps : sauter pour monter une marche, glisser pour en descendre une
function jouer(ev: Note) {
  if (ev.hand === "R") rightPress(ev.lane, ev.beat);
  else leftPress(ev.lane === 1 || ev.lane === 4 ? 1 : 0, ev.beat);
}

describe("jugement des relais", () => {
  it("toute la phrase réussie rapporte le bonus une fois, au score total, multiplié par le combo", () => {
    const notes = partie().filter((ev) => ev.relais === 1);
    notes.forEach((ev, i) => {
      jouer(ev);
      if (i < 7) expect(effets.relais).not.toHaveBeenCalled();
    });
    expect(notes.map((ev) => ev.state)).toEqual(notes.map(() => "hit"));
    const bonus = Math.round(RELAIS.bonus * mult());
    expect(effets.relais).toHaveBeenCalledExactlyOnceWith(notes, bonus);
    expect(S.relais).toEqual({ reussis: 1, total: 1 });
    expect(S.score).toBe(S.parMain.L.score + S.parMain.R.score + bonus);
  });

  it("une note ratée, d'une main ou de l'autre : pas de bonus, et le relais compte comme manqué", () => {
    const ev = partie();
    for (const n of ev) if (n.beat === 6) missEv(n);
    for (const n of ev) if (n.state === "pending" && n.beat !== 13) jouer(n);
    for (const n of ev) if (n.beat === 13) missEv(n);
    expect(effets.relais).not.toHaveBeenCalled();
    expect(S.relais).toEqual({ reussis: 0, total: 2 });
  });

  it("en duo, le relais passe d'un joueur à l'autre : un exploit commun, au combo commun, compté pour l'écran de fin", () => {
    const ev = partie("duo");
    for (const n of ev) jouer(n);
    expect(S.relais).toEqual({ reussis: 2, total: 2 });
    // Le bonus suit le combo commun, celui des deux joueurs : 8 coups réussis au premier, 16 au second (× 1,5)
    expect(effets.relais.mock.calls.map(([, points]) => points)).toEqual([RELAIS.bonus, RELAIS.bonus * 1.5]);
    expect(S.score).toBe(S.parMain.L.score + S.parMain.R.score + RELAIS.bonus * 2.5);
  });
});

/* ---------- Essai au clavier ---------- */

let nav: Navigateur;
afterEach(() => nav?.fermer());

async function essai() {
  nav = await Navigateur.ouvrir({ adresse: { search: "?essai=relais" } });
  nav.presser("Space");
  const S = nav.jeu.state;
  return { S, premier: S.ev.filter((ev) => ev.relais === S.ev[0].relais) };
}
const spb = () => 60 / nav.jeu.state.song.bpm;
function attendre(t: number) {
  while (nav.jeu.songNow() < t) nav.image(t - nav.jeu.songNow() > 0.02 ? 1 / 60 : 0.001);
}
// Les touches d'un joueur parfait : W sauter et S glisser à gauche, J K L ; à droite
const touche = (ev: Note, lane: number) => (ev.hand === "L" ? (lane === 1 ? "KeyW" : "KeyS") : LANE_CODES[lane]);

describe("essai « relais » au clavier", () => {
  it("le fil « RELAIS » relie les deux mains ; la phrase entière jouée aux deux mains affiche le bonus", async () => {
    const { S, premier } = await essai();
    // Le premier relais descend : la mélodie, puis la basse
    expect(premier.map((ev) => ev.hand).join("")).toBe("RRRRLLLL");
    attendre((premier[0].beat - 2) * spb());
    nav.image();
    expect(nav.textes).toContain("RELAIS");
    for (const e of evenementsClavier(premier, (beat) => beat * spb(), touche)) {
      attendre(e.at);
      faire(nav, e);
    }
    attendre((premier[7].beat + 0.5) * spb());
    nav.image();
    expect(premier.map((ev) => ev.state)).toEqual(premier.map(() => "hit"));
    expect(S.relais).toEqual({ reussis: 1, total: 1 });
    expect(nav.textes.some((t) => t.startsWith("Relais +"))).toBe(true);
  });

  it("une note oubliée par la seconde main : ni bonus ni annonce", async () => {
    const { S, premier } = await essai();
    for (const e of evenementsClavier(premier.slice(0, 7), (beat) => beat * spb(), touche)) {
      attendre(e.at);
      faire(nav, e);
    }
    attendre((premier[7].beat + 0.5) * spb());
    nav.image();
    expect(premier[7].state).toBe("miss");
    expect(S.relais).toEqual({ reussis: 0, total: 1 });
    expect(nav.textes.some((t) => t.startsWith("Relais +"))).toBe(false);
  });
});
