// Boss de fin (#26) : un niveau à part où le boss joue une phrase et le joueur la rejoue une mesure plus tard, en
// canon. Le générateur (graines de l'instantané, ADR-0005), le jugement avec des effets espions (logique pure,
// ADR-0007), puis le niveau dans le faux navigateur : l'écran de départ, l'auto-play qui bat la Mite reine, la mort et
// la reprise, et la réécoute (#23).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_MESURES, BOSS_PHASES, OCTAVE_DU_BOSS, PART_DE_VIE, buildBoss } from "../src/chanson/boss";
import { DIFFS } from "../src/chanson/difficultes";
import { buildSong } from "../src/chanson/generateur";
import { dansLAccord } from "../src/chanson/theorie";
import type { Chanson, Note } from "../src/chanson/types";
import { S, bossNeuf, mult } from "../src/jeu/etat";
import { BOSS, brancherEffets, missEv, rightPress, type Effets } from "../src/jeu/jugement";
import { appuis } from "./support/appuis";
import { decrireChanson, DIFFICULTES, GRAINES } from "./support/instantane";
import { Navigateur } from "./support/navigateur";

const niveaux = (diff: string) => GRAINES.map((g) => buildBoss(g, diff));
const canonDe = (c: Chanson) => c.ev.filter((ev) => ev.canon !== undefined);

describe("le niveau du boss dans le générateur", () => {
  it.each(DIFFICULTES)(
    "en %s : une intro, trois phases de huit mesures et une outro, sur la chanson de la graine",
    (diff) => {
      for (const c of niveaux(diff)) {
        expect(c.sections.map((s) => [s.name, s.kind, s.bars, s.boss])).toEqual([
          ["Intro", "intro", 2, undefined],
          ["Phase 1", "couplet", BOSS_MESURES, 1],
          ["Phase 2", "refrain", BOSS_MESURES, 2],
          ["Phase 3", "refrain", BOSS_MESURES, 3],
          ["Outro", "outro", 2, undefined],
        ]);
        expect([c.totalBars, c.chords.length, c.endBeat]).toEqual([28, 28, 112]);
        // La tonalité, la progression et le tempo de la chanson de la même graine ; ni chanteur, ni solo
        const chanson = buildSong(c.seed, diff);
        expect([c.keyPc, c.prog, c.bpm]).toEqual([chanson.keyPc, chanson.prog, chanson.bpm]);
        expect(c.chanteurs).toEqual([]);
        expect(c.sections.some((s) => s.kind === "pont")).toBe(false);
        // Une plaque à écraser (#8) ouvre les phases 2 et 3
        expect(c.ev.filter((ev) => ev.hand === "L" && ev.lane === 3).map((ev) => ev.beat)).toEqual([40, 72]);
      }
    },
  );

  it.each(DIFFICULTES)(
    "en %s : le joueur rejoue chaque phrase du boss une mesure plus tard, aux mêmes degrés",
    (diff) => {
      for (const c of niveaux(diff)) {
        const { phrases } = c.boss;
        expect(phrases).toHaveLength(BOSS_PHASES * (BOSS_MESURES - 1));
        for (const sec of c.sections.filter((s) => s.boss)) {
          // Le boss joue sur chaque mesure de la phase sauf la dernière, où le joueur lui répond seul
          const ici = phrases.filter((p) => p.bar >= sec.start && p.bar < sec.start + sec.bars);
          expect(ici.map((p) => p.bar)).toEqual(Array.from({ length: sec.bars - 1 }, (_, k) => sec.start + k));
          // La phase se pose sur la fondamentale
          expect(ici.at(-1).notes.at(-1).lane).toBe(0);
        }
        for (const p of phrases) {
          const reponse = canonDe(c).filter((ev) => ev.canon === p.bar);
          expect(p.notes.length).toBeGreaterThanOrEqual(2);
          expect(reponse.map((ev) => [ev.bar, ev.beat - 4, ev.lane, ev.dur])).toEqual(
            p.notes.map((n) => [p.bar + 1, n.beat, n.lane, 0]),
          );
          // Le boss joue une octave sous le joueur ; le joueur joue sans harmonie : deux voix seulement
          expect(p.notes.map((n) => n.midi)).toEqual(
            p.notes.map((n) => c.chords[p.bar].lanes[n.lane] + OCTAVE_DU_BOSS),
          );
          expect(reponse.every((ev) => ev.harm === undefined && ev.midi === c.chords[ev.bar].lanes[ev.lane])).toBe(
            true,
          );
          expect(p.notes.every((n) => DIFFS[diff].boss.couloirs.includes(n.lane))).toBe(true);
        }
        expect(canonDe(c)).toHaveLength(phrases.reduce((n, p) => n + p.notes.length, 0));
      }
    },
  );

  it.each(DIFFICULTES)(
    "en %s : superposées, les deux voix du canon ne jouent que des notes de l'accord en cours",
    (diff) => {
      for (const c of niveaux(diff))
        for (let bar = 0; bar < c.totalBars; bar++) {
          const boss = c.boss.phrases.find((p) => p.bar === bar)?.notes.map((n) => n.midi) ?? [],
            joueur = canonDe(c)
              .filter((ev) => ev.bar === bar)
              .map((ev) => ev.midi);
          for (const m of [...boss, ...joueur]) expect(dansLAccord(c.chords[bar], m)).toBe(true);
        }
    },
  );

  it.each(DIFFICULTES)("en %s : les phases s'accélèrent, et la réponse évite la basse comme la mélodie", (diff) => {
    const D = DIFFS[diff],
      parPhase = [0, 0, 0];
    for (const c of niveaux(diff)) {
      for (const p of c.boss.phrases)
        parPhase[c.sections.find((s) => p.bar >= s.start && p.bar < s.start + s.bars).boss - 1] += p.notes.length;
      const basse = new Set(c.ev.filter((ev) => ev.hand === "L").map((ev) => ev.beat));
      for (const ev of canonDe(c)) {
        if (!basse.has(ev.beat)) continue;
        expect(D.mel.avoid).not.toBe("all");
        if (D.mel.avoid === "mostly") expect(ev.beat % 4).toBe(0);
      }
      // En Débutant, la réponse reste sur les temps
      if ("surLesTemps" in D.mel) expect(canonDe(c).every((ev) => ev.beat % 1 === 0)).toBe(true);
    }
    expect(parPhase[1]).toBeGreaterThan(parPhase[0]);
    expect(parPhase[2]).toBeGreaterThan(parPhase[1]);
  });

  it("la vie du boss : neuf phrases justes sur dix ; le niveau est le même à chaque fois, et ses phases peuvent raccourcir", () => {
    for (const diff of DIFFICULTES) {
      const c = buildBoss(4242, diff);
      expect(c.boss.vie).toBe(Math.round(c.boss.phrases.length * PART_DE_VIE));
      expect(c.boss.vie).toBeLessThan(c.boss.phrases.length);
      expect(decrireChanson(buildBoss(4242, diff))).toEqual(decrireChanson(c));
    }
    const court = buildBoss(4242, "normal", 4);
    expect([court.totalBars, court.boss.phrases.length, court.boss.vie]).toEqual([16, 9, 8]);
  });

  it("les niveaux de boss ne changent pas : instantané", async () => {
    const resultat: Record<string, ReturnType<typeof decrireChanson>> = {};
    for (const diff of DIFFICULTES)
      for (const graine of GRAINES.slice(0, 6)) resultat[`${graine} ${diff}`] = decrireChanson(buildBoss(graine, diff));
    await expect(JSON.stringify(resultat, null, 2) + "\n").toMatchFileSnapshot("./instantanes/boss.json");
  });
});

/* ---------- Jugement ---------- */
const ETAT_NEUF = { ...S };
let effets: Record<keyof Effets, ReturnType<typeof vi.fn>>;
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
      "phrase",
      "relais",
      "canon",
      "bossVaincu",
      "tir",
      "mourir",
    ].map((k) => [k, vi.fn()]),
  ) as typeof effets;
  brancherEffets(effets as unknown as Effets);
});

// Le boss court de l'essai, à 60 BPM : un temps par seconde. Seule la main droite joue.
function partie() {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play" });
  S.song = { ...buildBoss(4242, "normal", 4), bpm: 60 };
  S.ev = S.song.ev;
  S.boss = bossNeuf(S.song);
  return S.song.boss.phrases.map((p) => S.ev.filter((ev) => ev.canon === p.bar));
}
const jouer = (notes: Note[]) => notes.forEach((ev) => rightPress(ev.lane, ev.beat));

describe("jugement du canon", () => {
  it("une phrase rejouée juste rapporte le bonus et retire une vie au boss ; une note ratée, rien", () => {
    const [premiere, deuxieme] = partie(),
      vie = S.boss.vie;
    jouer(premiere.slice(0, -1));
    expect(effets.canon).not.toHaveBeenCalled();
    jouer(premiere.slice(-1));
    expect(effets.canon).toHaveBeenCalledExactlyOnceWith(premiere, Math.round(BOSS.bonus * mult("R")), true);
    expect(S.boss).toMatchObject({ vie: vie - 1, reussies: 1, total: 1, vaincu: null });

    missEv(deuxieme[0]);
    jouer(deuxieme.slice(1));
    expect(effets.canon).toHaveBeenCalledTimes(1);
    expect(S.boss).toMatchObject({ vie: vie - 1, reussies: 1, total: 2 });
  });

  it("à sa dernière vie, le boss tombe au temps de la phrase : la victoire, puis des phrases qui ne le touchent plus", () => {
    const phrases = partie();
    phrases.slice(0, S.boss.vie).forEach(jouer);
    const fatale = phrases[S.boss.max - 1];
    expect(S.boss).toMatchObject({ vie: 0, vaincu: fatale.at(-1).beat });
    expect(effets.bossVaincu).toHaveBeenCalledExactlyOnceWith(BOSS.victoire);
    // Le joueur finit le canon seul : la phrase rapporte encore son bonus, sans toucher le boss
    jouer(phrases.at(-1));
    expect(effets.canon).toHaveBeenLastCalledWith(phrases.at(-1), expect.any(Number), false);
    expect(S.boss).toMatchObject({ vie: 0, reussies: S.boss.max + 1, total: S.boss.max + 1 });
    expect(effets.bossVaincu).toHaveBeenCalledTimes(1);
  });

  it("en boucle, le boss ne perd pas de vie (ADR-0009), et sans boss, une note de canon n'est qu'une note", () => {
    const [premiere, deuxieme] = partie();
    S.bouclePartie = { sec: S.song.sections[1], cree: 0, passages: [] };
    jouer(premiere);
    expect(effets.canon).toHaveBeenCalledWith(premiere, expect.any(Number), false);
    expect(S.boss).toMatchObject({ vie: S.boss.max, reussies: 1 });
    S.boss = null;
    jouer(deuxieme);
    expect(effets.canon).toHaveBeenCalledTimes(1);
  });
});

/* ---------- Dans le jeu ---------- */
let nav: Navigateur;
afterEach(() => nav?.fermer());
const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm) / 60;

describe("le boss dans le jeu", () => {
  it("B mène de la chanson à son boss et en revient ; la difficulté choisie garde le boss", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state,
      graine = S.seed;
    expect(nav.overlay.innerHTML).toContain("Affronter le boss");
    nav.presser("KeyB");
    expect([S.seed, !!S.song.boss, S.mode, S.boss?.vie]).toEqual([graine, true, "title", S.song.boss.vie]);
    expect(nav.overlay.innerHTML).toContain("Boss de fin");
    expect(nav.overlay.innerHTML).toContain("Le Grand Drone");
    nav.jeu.setTheme("boite");
    expect(nav.overlay.innerHTML).toContain("La Mite reine");
    nav.jeu.load(graine, "facile", true);
    nav.toucherBouton("boss");
    expect([S.seed, S.diff, S.song.boss, S.boss]).toEqual([graine, "facile", undefined, null]);
  });

  it("le boss vaincu n'allume pas le lieu de sa graine et ne garde pas de score (ADR-0014)", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state,
      { noterFinDePartie } = await import("../src/ui/progression");
    nav.presser("KeyB");
    Object.assign(S, { autoUsed: false, score: 12345 });
    noterFinDePartie();
    expect(S.progres).toBeNull();
    expect(nav.stockage.has("deux-mains-sauvegarde")).toBe(false);
  });

  it("l'auto-play bat la Mite reine : elle tombe avant la fin, se tait, et l'écran de fin le dit", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state;
    nav.jeu.setTheme("boite");
    nav.presser("KeyB");
    nav.presser("KeyA");
    nav.image();
    expect(nav.textes).toContain("LA MITE REINE");
    nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
    expect([S.mode, S.miss, S.health]).toEqual(["done", 0, 100]);
    expect(S.boss).toMatchObject({ vie: 0, reussies: S.song.boss.phrases.length, total: S.song.boss.phrases.length });
    expect(S.boss.vaincu).toBeLessThan((S.song.sections.at(-1).start - 1) * 4);
    expect(nav.overlay.innerHTML).toContain("La Mite reine : vaincu");
    expect(nav.overlay.innerHTML).toContain("Retour à la chanson");
  });

  it("une mort pendant une phase reprend au début de la phase, avec la vie qu'avait le boss", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=boss" } });
    const S = nav.jeu.state,
      phase2 = S.song.sections.find((s) => s.boss === 2);
    // L'auto-play joue la phase 1, puis plus personne ne joue
    nav.jeu.setPractice("both");
    nav.presser("KeyA");
    nav.avancerJusqua(() => temps() >= phase2.start * 4 + 0.5, 60);
    const vie = S.boss.vie;
    expect(vie).toBeLessThan(S.boss.max);
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.mode === "dead" || s.mode === "done", 60);
    expect(S.mode).toBe("dead");
    expect(nav.overlay.innerHTML).toContain("Reprendre à la phase 2");
    nav.presser("KeyR");
    expect([S.mode, S.boss.vie]).toEqual(["play", vie]);
  });

  it("la réécoute rejoue le combat : les mêmes phrases justes et la même chute", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=boss" } });
    const S = nav.jeu.state;
    nav.presser("Space");
    // Un joueur qui rate la première note de deux phrases sur trois : le boss tient jusqu'au bout
    const gestes = S.ev
      .filter((ev) => ev.canon !== undefined)
      .filter((ev) => !(ev.canon % 3 !== 0 && S.ev.find((e) => e.canon === ev.canon) === ev))
      .flatMap((ev) => appuis(ev).map((a) => ({ beat: a.beat, code: ["KeyJ", "KeyK", "KeyL", "Semicolon"][a.lane] })));
    for (const g of gestes) {
      while (temps() < g.beat) nav.image();
      nav.presser(g.code);
      nav.relacher(g.code);
    }
    const auBout = () => {
      nav.avancerJusqua(() => temps() >= S.song.endBeat - 0.1, 60);
      const b = { ...S.boss, toucheAt: 0 };
      nav.avancerJusqua((s) => s.mode !== "play", 5);
      return b;
    };
    const partie = auBout();
    expect(S.mode).toBe("done");
    expect(partie.reussies).toBeGreaterThan(0);
    expect(partie.reussies).toBeLessThan(partie.total);
    nav.presser("KeyR");
    expect(S.relecture).not.toBeNull();
    expect(S.boss).toMatchObject({ vie: S.boss.max, reussies: 0 });
    const reecoute = auBout();
    expect(reecoute).toEqual(partie);
    expect(S.boss).toMatchObject({ reussies: partie.reussies, vie: partie.vie });
  });
});
