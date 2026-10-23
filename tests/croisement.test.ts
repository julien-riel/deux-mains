// Mains croisées (#21) : en Difficile, un pont peut retourner la scène. Le générateur (graines de l'instantané,
// ADR-0005), le retournement (logique pure, ADR-0007), puis le jugement et l'auto-play avec des effets espions :
// les touches et les fenêtres ne changent pas. Le rendu se vérifie à l'œil, dans l'essai « mains-croisees ».

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { NOM_CROISEE, buildSong, estPetiteNote } from "../src/chanson/generateur";
import type { Chanson, Note, Section } from "../src/chanson/types";
import { autoNotes, autoSolo } from "../src/jeu/autoplay";
import { ANNONCE, BASCULE, retournement } from "../src/jeu/croisement";
import { S, spb } from "../src/jeu/etat";
import { brancherEffets, leftPress, rightPress, type Effets } from "../src/jeu/jugement";
import { estSolo, soloEtRefrain } from "../src/jeu/variations";
import { DIFFICULTES, GRAINES } from "./support/instantane";
import { Navigateur } from "./support/navigateur";

const croiseeDe = (c: Chanson) => c.sections.find((s) => s.croisee);
const dans = (diff: string) => GRAINES.map((graine) => buildSong(graine, diff));
const AVEC = dans("difficile").filter(croiseeDe);
const resume = (ev: Note) => [ev.hand, ev.beat, ev.lane, ev.midi, ev.dur];
const notesDe = (c: Chanson, sec: Section) =>
  c.ev.filter((ev) => ev.beat >= sec.start * 4 && ev.beat < (sec.start + sec.bars) * 4);

/** La même chanson générée sans pont en mains croisées */
function sansCroisee(graine: number) {
  const avant = DIFFS.difficile.croiseeP;
  DIFFS.difficile.croiseeP = 0;
  try {
    return buildSong(graine, "difficile");
  } finally {
    DIFFS.difficile.croiseeP = avant;
  }
}

describe("le pont en mains croisées dans le générateur", () => {
  it.each(DIFFICULTES.filter((d) => d !== "difficile"))("en %s, jamais", (diff) => {
    for (const c of dans(diff)) {
      expect(croiseeDe(c)).toBeUndefined();
      expect(c.totalBars).toBe(32);
    }
  });

  it("en Difficile, une chanson sur deux environ : quatre mesures de pont entre le premier refrain et le solo", () => {
    expect(AVEC.length).toBeGreaterThanOrEqual(GRAINES.length / 4);
    expect(AVEC.length).toBeLessThanOrEqual((3 * GRAINES.length) / 4);
    for (const c of AVEC) {
      const sec = croiseeDe(c);
      expect(c.sections.map((s) => s.name)).toEqual([
        "Intro",
        "Couplet",
        "Refrain",
        NOM_CROISEE,
        "Solo libre",
        "Refrain",
        "Outro",
      ]);
      expect([sec.kind, sec.bars, sec.start, c.totalBars, c.endBeat]).toEqual(["pont", 4, 18, 36, 144]);
      // Ce pont a une mélodie écrite : le solo libre reste celui d'après, et c'est lui que reprend le refrain (#9)
      expect(estSolo(sec)).toBe(false);
      expect(soloEtRefrain(c.sections).solo.name).toBe("Solo libre");
    }
  });

  it("sans lui, la chanson ne change pas ; avec lui, elle ne fait que s'allonger de ses quatre mesures", () => {
    for (const c of AVEC) {
      const sec = croiseeDe(c),
        debut = sec.start * 4,
        sans = sansCroisee(c.seed);
      expect(croiseeDe(sans)).toBeUndefined();
      expect(c.ev.filter((ev) => ev.beat < debut).map(resume)).toEqual(
        sans.ev.filter((ev) => ev.beat < debut).map(resume),
      );
      expect(c.ev.filter((ev) => ev.beat >= debut + 16).map(resume)).toEqual(
        sans.ev.filter((ev) => ev.beat >= debut).map((ev) => resume({ ...ev, beat: ev.beat + 16 })),
      );
      expect(c.chords.filter((_, bar) => bar < sec.start || bar >= sec.start + 4)).toEqual(sans.chords);
      expect(c.chanteurs).toEqual(sans.chanteurs);
    }
  });

  it("sa mélodie reprend le thème du couplet puis sa réponse, et sa basse est celle du pont de la difficulté", () => {
    // Le rythme et les couloirs d'une phrase de deux mesures, sans les petites notes qui dépendent de l'accord
    const phrase = (c: Chanson, bar: number) =>
      c.ev
        .filter((ev) => ev.hand === "R" && !estPetiteNote(ev) && ev.bar >= bar && ev.bar < bar + 2)
        .map((ev) => [ev.beat - bar * 4, ev.lane, ev.dur]);
    for (const c of AVEC) {
      const sec = croiseeDe(c),
        couplet = c.sections[1];
      expect(phrase(c, sec.start)).toEqual(phrase(c, couplet.start));
      expect(phrase(c, sec.start + 2)).toEqual(phrase(c, couplet.start + 6));
      expect(phrase(c, sec.start).length).toBeGreaterThan(0);
      for (let bar = sec.start; bar < sec.start + 4; bar++)
        expect(
          c.ev.filter((ev) => ev.hand === "L" && ev.bar === bar).map((ev) => [ev.beat - bar * 4, ev.lane, ev.dur]),
        ).toEqual([
          [0, 0, 2],
          [2, 0, 0],
          [3, 1, 0],
        ]);
      expect(notesDe(c, sec).every((ev) => ev.kind === "pont" && ev.relais === undefined && !ev.reponse)).toBe(true);
    }
  });
});

describe("le retournement de la scène", () => {
  const sections: Section[] = [
    { name: "Refrain", kind: "refrain", bars: 8, start: 2 },
    { name: NOM_CROISEE, kind: "pont", bars: 4, start: 10, croisee: true },
    { name: "Solo libre", kind: "pont", bars: 4, start: 14 },
  ];
  const debut = 40,
    fin = 56;

  it("à l'endroit loin du pont, annoncé une mesure avant, retourné pendant tout le pont, puis remis droit", () => {
    expect(retournement(sections, debut - ANNONCE - 0.01)).toEqual({ k: 1, annonce: null });
    expect(retournement(sections, debut - ANNONCE)).toEqual({ k: 1, annonce: "entree" });
    expect(retournement(sections, debut - BASCULE).k).toBe(1);
    expect(retournement(sections, debut - BASCULE / 2).k).toBeCloseTo(0);
    expect(retournement(sections, debut - 0.01).annonce).toBe("entree");
    expect(retournement(sections, debut)).toEqual({ k: -1, annonce: null });
    expect(retournement(sections, debut + 8)).toEqual({ k: -1, annonce: null });
    expect(retournement(sections, fin - BASCULE)).toEqual({ k: -1, annonce: "sortie" });
    expect(retournement(sections, fin)).toEqual({ k: -1, annonce: "sortie" });
    expect(retournement(sections, fin + BASCULE / 2).k).toBeCloseTo(0);
    expect(retournement(sections, fin + BASCULE)).toEqual({ k: 1, annonce: null });
    // La bascule est continue : la scène s'aplatit sur son axe, puis se déplie de l'autre côté
    const ks = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((t) => retournement(sections, debut - BASCULE + t).k);
    ks.slice(1).forEach((k, i) => expect(k).toBeLessThan(ks[i]));
  });

  it("en boucle (ADR-0009), le pont reste retourné d'un passage à l'autre, et une autre section ne se retourne pas", () => {
    expect(retournement(sections, debut - 1, sections[1]).k).toBeCloseTo(0);
    expect(retournement(sections, fin + 37, sections[1])).toEqual({ k: -1, annonce: null });
    expect(retournement(sections, debut - 1, sections[0])).toEqual({ k: 1, annonce: null });
    expect(retournement(sections, debut + 1, sections[2])).toEqual({ k: 1, annonce: null });
  });

  it("une chanson sans pont en mains croisées ne se retourne jamais", () => {
    const c = buildSong(4242, "difficile");
    expect(croiseeDe(c)).toBeUndefined();
    for (let nb = 0; nb <= c.endBeat; nb += 0.5) expect(retournement(c.sections, nb)).toEqual({ k: 1, annonce: null });
  });
});

describe("le jeu ne change pas pendant les mains croisées", () => {
  const ETAT_NEUF = { ...S };
  let effets: Record<keyof Effets, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    effets = new Proxy({} as typeof effets, { get: (t, k) => (t[k] ??= vi.fn()) });
    brancherEffets(effets as unknown as Effets);
    const song = AVEC[0];
    Object.assign(S, structuredClone(ETAT_NEUF), { diff: "difficile", mode: "play", song: structuredClone(song) });
    S.ev = S.song.ev;
  });

  it("les touches jugent les ennemis et les obstacles comme ailleurs, aux mêmes fenêtres, sans solo libre", () => {
    const sec = croiseeDe(S.song),
      [bien] = DIFFS.difficile.win.slice(1),
      notes = notesDe(S.song, sec),
      ennemi = notes.find((ev) => ev.hand === "R" && Number.isInteger(ev.lane) && !ev.grp && !ev.trille && !ev.serpent),
      obstacle = notes.find((ev) => ev.hand === "L" && ev.dur === 0 && !ev.grp);
    // Un peu avant la fin de la fenêtre « Bien », pas après
    expect(rightPress(ennemi.lane, ennemi.beat * spb() + 0.9 * bien)).toEqual([ennemi]);
    expect(ennemi.state).toBe("hit");
    leftPress(obstacle.lane, obstacle.beat * spb() - 0.9 * bien);
    expect(obstacle.state).toBe("hit");
    // Une touche loin de toute note ne joue pas le solo libre : elle ne compte pas, et rien n'est gardé
    rightPress(0, (sec.start * 4 + 0.25) * spb());
    expect(effets.solo).not.toHaveBeenCalled();
    expect(S.reprise.solo).toEqual([]);
  });

  it("l'auto-play joue toutes les notes du pont, et n'y improvise pas", () => {
    S.auto = true;
    const sec = croiseeDe(S.song),
      solo = S.song.sections.find((s) => s.name === "Solo libre"),
      prises: Note[] = [],
      impro: number[] = [];
    for (let step = sec.start * 16; step < (sec.start + sec.bars) * 16; step++) {
      prises.push(...autoNotes(step));
      if (autoSolo(step, sec) !== null) impro.push(step);
    }
    expect(prises).toEqual(expect.arrayContaining(notesDe(S.song, sec)));
    expect(impro).toEqual([]);
    // Le solo libre d'après, lui, est improvisé
    let notesDuSolo = 0;
    for (let step = solo.start * 16; step < (solo.start + solo.bars) * 16; step++)
      if (autoSolo(step, solo) !== null) notesDuSolo++;
    expect(notesDuSolo).toBeGreaterThan(0);
  });
});

describe("dans l'essai « mains-croisees », au doigt (ADR-0008)", () => {
  // La scène fait 1200 × 620 ; retournée, un couloir passe de sa hauteur à son reflet autour de l'axe de la scène
  const LANE_Y = [395, 315, 235, 155],
    AXE = (92 + 505 + 40) / 2;
  let nav: Navigateur;
  afterEach(() => nav?.fermer());

  it("la scène annonce le pont, le marque pendant qu'il dure, et les bandes suivent les couloirs retournés", async () => {
    nav = await Navigateur.ouvrir({ tactile: true, adresse: { search: "?essai=mains-croisees" } });
    nav.toucherBouton("start");
    const S = nav.jeu.state,
      sec = S.song.sections.find((s) => s.croisee),
      seconde = (beat: number) => (beat * 60) / S.song.bpm,
      // Un ennemi simple de la deuxième mesure du pont, hors du couloir de la tierce, dont le reflet tombe presque à
      // sa hauteur d'avant : touché à son reflet, il n'est réussi que si les bandes suivent la scène retournée
      ev = S.ev.find(
        (e) =>
          e.hand === "R" &&
          e.bar > sec.start &&
          [0, 2, 3].includes(e.lane) &&
          !e.grp &&
          e.trille === undefined &&
          !e.serpent,
      );
    S.auto = true;
    nav.avancerJusqua(() => nav.jeu.songNow() >= seconde(sec.start * 4 - 3), 30);
    expect(nav.textes).toContain("⇅  MAINS CROISÉES : LES TOUCHES NE CHANGENT PAS");
    expect(nav.textes).not.toContain("AUTO-PLAY · MAINS CROISÉES");
    nav.avancerJusqua(() => nav.jeu.songNow() >= seconde(ev.beat) - 0.3, 30);
    expect(nav.textes).toContain("AUTO-PLAY · MAINS CROISÉES");
    S.auto = false;
    nav.avancerJusqua(() => nav.jeu.songNow() >= seconde(ev.beat), 30);
    nav.toucher(1, 1000, 2 * AXE - LANE_Y[ev.lane]);
    nav.image();
    expect(ev.state).toBe("hit");
  });
});
