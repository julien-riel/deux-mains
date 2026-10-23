// Pentes (#12) : en Normal et en Difficile, une pente finit une phrase de deux mesures. On la descend en tenant
// glisser : la basse glisse de la fondamentale à l'octave (pente montante) ou de l'octave à la fondamentale
// (descendante). Lâcher avant la fin casse la note, comme un tunnel. Le générateur, le jugement et l'auto-play
// sont de la logique pure ; les parcours au clavier et le son passent par le faux navigateur. La simulation d'une
// chanson entière (tests/simulation.test.ts) vérifie que l'auto-play réussit toutes les pentes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong } from "../src/chanson/generateur";
import { mtof } from "../src/chanson/theorie";
import type { Chanson, Note } from "../src/chanson/types";
import { autoHit } from "../src/jeu/autoplay";
import { S } from "../src/jeu/etat";
import { brancherEffets, leftPress, release, type Effets } from "../src/jeu/jugement";
import { DIFFICULTES, GRAINES } from "./support/instantane";
import { Navigateur, type Univers } from "./support/navigateur";

// Graine fixe (ADR-0005)
const GRAINE = 4242;
const ETAT_NEUF = { ...S };

const CHANSONS = DIFFICULTES.flatMap((diff) => GRAINES.map((graine) => ({ diff, chanson: buildSong(graine, diff) })));
const dans = (diff: string) => CHANSONS.filter((c) => c.diff === diff).map((c) => c.chanson);
const pentes = (c: Chanson) => c.ev.filter((ev) => ev.fin !== undefined);
const section = (c: Chanson, ev: Note) => c.sections.find((s) => ev.bar >= s.start && ev.bar < s.start + s.bars);

describe("pentes du générateur", () => {
  it.each(["debutant", "facile"])("en %s, aucune pente", (diff) => {
    for (const chanson of dans(diff)) expect(pentes(chanson)).toEqual([]);
  });

  it.each(["normal", "difficile"])(
    "en %s, chaque chanson a des pentes montantes et descendantes, au couplet et au refrain",
    (diff) => {
      for (const chanson of dans(diff)) {
        const ps = pentes(chanson);
        expect(new Set(ps.map((ev) => ev.fin > ev.midi))).toEqual(new Set([true, false]));
        expect(new Set(ps.map((ev) => ev.kind))).toEqual(new Set(["couplet", "refrain"]));
      }
    },
  );

  it("une pente glisse entre la fondamentale et l'octave de l'accord de sa mesure (ADR-0003), en tenant glisser", () => {
    for (const { chanson } of CHANSONS)
      for (const ev of pentes(chanson)) {
        const { bass } = chanson.chords[ev.bar];
        expect([ev.midi, ev.fin]).toEqual(ev.fin > ev.midi ? [bass, bass + 12] : [bass + 12, bass]);
        expect(ev.lane).toBe(0);
        expect(ev.dur).toBeGreaterThan(0);
      }
  });

  it("une pente finit une phrase de deux mesures, et se termine avant la note de basse suivante", () => {
    for (const { chanson } of CHANSONS) {
      const gauche = chanson.ev.filter((ev) => ev.hand === "L");
      for (const ev of pentes(chanson)) {
        expect((ev.bar - section(chanson, ev).start) % 2).toBe(1);
        expect(ev.beat - ev.bar * 4).toBeGreaterThanOrEqual(2);
        expect(ev.beat + ev.dur).toBeLessThanOrEqual((ev.bar + 1) * 4);
        const suivante = gauche[gauche.indexOf(ev) + 1];
        if (suivante) expect(suivante.beat).toBeGreaterThan(ev.beat + ev.dur);
      }
    }
  });
});

describe("jugement des pentes", () => {
  let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    effets = Object.fromEntries(
      ["jouer", "couper", "reussite", "accord", "rate", "lache", "mauvaisCouloir", "solo", "tir", "mourir"].map((k) => [
        k,
        vi.fn(),
      ]),
    ) as typeof effets;
    brancherEffets(effets as unknown as Effets);
  });
  // Une pente montante au temps 6, longue d'un temps et demi, à 60 BPM : un temps dure une seconde
  const pente = (): Note => ({
    hand: "L",
    beat: 6,
    dur: 1.5,
    lane: 0,
    bar: 1,
    kind: "couplet",
    midi: 33,
    fin: 45,
    air: 0.8,
    state: "pending",
  });
  function partie(ev: Note) {
    Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", combo: 5 });
    S.song = { bpm: 60, ev: [ev], sections: [{ name: "Couplet", kind: "couplet", bars: 4, start: 0 }] } as never;
    S.ev = S.song.ev;
    return S.ev[0];
  }

  it("glisser dans la fenêtre commence la pente et fait sonner le glissando", () => {
    const ev = partie(pente());
    leftPress(0, 6 + DIFFS.normal.win[0] * 0.9);
    expect(ev.state).toBe("holding");
    expect(effets.jouer).toHaveBeenCalledWith(ev, null);
    expect(S.perfect).toBe(1);
  });

  it("tenue jusqu'au bout, la pente est réussie sans dégâts", () => {
    const ev = partie(pente());
    leftPress(0, 6);
    release("L", 0, 7.5 - DIFFS.normal.win[1] * 0.9);
    expect(ev.state).toBe("done");
    expect([S.health, S.miss]).toEqual([100, 0]);
    expect(effets.couper).not.toHaveBeenCalled();
  });

  it("lâchée avant la fin, la note est coupée, avec les mêmes dégâts qu'un tunnel lâché", () => {
    const ev = partie(pente());
    leftPress(0, 6);
    release("L", 0, 6.7);
    expect(ev.state).toBe("broken");
    expect(effets.couper).toHaveBeenCalledWith(ev);
    expect(effets.lache).toHaveBeenCalledWith(ev);
    const degats = 100 - S.health;

    const tunnel = partie({ ...pente(), fin: undefined, midi: 33 });
    leftPress(0, 6);
    release("L", 0, 6.7);
    expect(tunnel.state).toBe("broken");
    expect(degats).toBe(100 - S.health);
    expect([degats, S.combo]).toEqual([6, 0]);
  });

  it("sauter sur une pente est une erreur de la main gauche", () => {
    const ev = partie(pente());
    leftPress(1, 6);
    expect(ev.state).toBe("miss");
    expect(S.health).toBe(100 - DIFFS.normal.dmgL);
  });

  it("l'auto-play tient la glissade jusqu'au bout de la pente", () => {
    const ev = partie(pente());
    ev.auto = true;
    autoHit(ev);
    expect(ev.state).toBe("holding");
    expect(S.slideUntil).toBe(7.5);
    expect(S.perfect).toBe(1);
  });
});

describe("pentes au clavier", () => {
  let nav: Navigateur;
  afterEach(() => nav?.fermer());

  const spb = () => 60 / nav.jeu.state.song.bpm;
  const temps = () => nav.jeu.songNow() / spb();

  /** Une partie en Normal, main gauche seule, jouée par l'auto-play jusqu'à peu avant la première pente */
  async function avantLaPente(univers: Univers = "ville") {
    nav = await Navigateur.ouvrir();
    nav.jeu.setTheme(univers);
    nav.jeu.load(GRAINE, "normal");
    nav.jeu.setPractice("L");
    nav.presser("Space");
    nav.relacher("Space");
    const S = nav.jeu.state,
      pente = S.ev.find((ev) => ev.fin !== undefined);
    S.auto = true;
    nav.avancerJusqua(() => temps() >= pente.beat - 0.4, 60);
    S.auto = false;
    nav.avancerJusqua(() => temps() >= pente.beat, 1);
    return { S, pente };
  }
  const heureAudio = async (beat: number) => (await import("../src/audio/moteur")).timeOfBeat(beat);

  it("maintenir S le long de la pente fait glisser la basse d'une note à l'autre, jusqu'au bout", async () => {
    const { S, pente } = await avantLaPente();
    const sante = S.health;
    nav.presser("KeyS");
    nav.image();
    expect(pente.state).toBe("holding");
    const arrivee = await heureAudio(pente.beat + pente.dur);
    const glissandos = nav.horloge.glissandos.filter(
      (gl) => gl.de === mtof(pente.midi) && gl.vers === mtof(pente.fin) && Math.abs(gl.fin - arrivee) < 1e-6,
    );
    // L'oscillateur de la basse et sa sous-basse glissent ensemble
    expect(glissandos).toHaveLength(2);
    nav.avancerJusqua(() => temps() >= pente.beat + pente.dur + 0.1, 3);
    nav.relacher("KeyS");
    expect(pente.state).toBe("done");
    expect(S.health).toBe(sante);
  });

  it("lâcher S au milieu de la pente casse la note", async () => {
    const { S, pente } = await avantLaPente();
    const sante = S.health;
    nav.presser("KeyS");
    nav.avancerJusqua(() => temps() >= pente.beat + pente.dur / 2, 3);
    nav.relacher("KeyS");
    expect(pente.state).toBe("broken");
    expect(S.health).toBe(sante - 6);
  });

  it.each(["ville", "boite"] as const)("dans l'univers %s, la pente est dessinée avec sa consigne", async (univers) => {
    const { pente } = await avantLaPente(univers);
    nav.image();
    expect(nav.textes).toContain(`S tenu ${pente.fin > pente.midi ? "↗" : "↘"}`);
  });
});
