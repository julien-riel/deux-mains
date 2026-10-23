// Mode pianiste au clavier MIDI (#53, ADR-0011) : la traduction de la vraie note en actions est de la logique pure,
// testée sans faux navigateur, avec les effets du jugement en espions. Les parties jouées au MIDI simulé, le réglage
// et l'essai passent par le faux navigateur.
// Les chansons pures sont fabriquées à 60 BPM : un temps dure une seconde, le temps de la chanson se lit en temps.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeChord } from "../src/chanson/theorie";
import type { Chanson, Main, Note } from "../src/chanson/types";
import { appuyer, presser, relacher } from "../src/jeu/actions";
import { S, autoFor } from "../src/jeu/etat";
import { brancherEffets, type Effets } from "../src/jeu/jugement";
import {
  ENSEMBLE,
  classe,
  couloirDansLAccord,
  dansLAccord,
  etatPianiste,
  lacherNote,
  mainDeNote,
  noteAttendue,
  nomDeClasse,
  notesDeLEcrasement,
  traduire,
  type EtatPianiste,
} from "../src/jeu/pianiste";
import { meilleurScore } from "../src/sauvegarde/format";
import { appuis, coupsAttendus } from "./support/appuis";
import { Navigateur, type Difficulte, type Options } from "./support/navigateur";

const ETAT_NEUF = { ...S };
const SEP = 60;
// Mi♭ majeur (ADR-0005 n'a rien à tirer ici : les accords sont écrits à la main). Mesure 0 : Si♭ (Si♭ Ré Fa Si♭,
// basse Si♭1) ; mesure 1 : Mi♭ (Mi♭ Sol Si♭ Mi♭) ; les mesures 4 et 5 sont le solo libre, sur Si♭.
const SIB = makeChord(3, [7, "M"]),
  MIB = makeChord(3, [0, "M"]);

let effets: { [K in keyof Effets]: ReturnType<typeof vi.fn> };
let etat: EtatPianiste;
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
      "canon",
      "bossVaincu",
      "mourir",
    ].map((k) => [k, vi.fn()]),
  ) as typeof effets;
  brancherEffets(effets as unknown as Effets);
  etat = etatPianiste();
});

function note(hand: Main, beat: number, lane: number, midi: number, autres: Partial<Note> = {}): Note {
  return {
    hand,
    beat,
    lane,
    dur: 0,
    bar: Math.floor(beat / 4),
    kind: "couplet",
    midi,
    air: 0.8,
    state: "pending",
    ...autres,
  };
}
function partie(ev: Note[]) {
  Object.assign(S, structuredClone(ETAT_NEUF), { diff: "normal", mode: "play", practice: "both" });
  S.song = {
    bpm: 60,
    totalBars: 8,
    chords: [SIB, MIB, SIB, SIB, SIB, SIB, SIB, SIB],
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
/** Joue une note au MIDI en mode pianiste, comme src/ui/midi.ts : traduite, puis pressée par la couche d'actions */
function jouer(n: number, ns: number, tenir = false) {
  const t = traduire(n, SEP, ns, etat);
  if (!t) return t;
  presser(t.action, t.ns, false, t.hauteur);
  // Une fausse note est relâchée aussitôt, une touche brève un peu après ; une touche tenue, par le test
  if (t.breve) relacher(t.action, t.ns);
  else if (!tenir) relacher(t.action, t.ns + 0.05);
  return t;
}
const reussie = (ev: Note) => ev.state === "hit" || ev.state === "holding" || ev.state === "done";

describe("hauteurs à l'octave près (logique pure)", () => {
  it("nomme les notes sans octave, et compare leur classe", () => {
    expect([classe(70), classe(-2), nomDeClasse(70), nomDeClasse(61), nomDeClasse(48)]).toEqual([
      10,
      10,
      "Si♭",
      "Do♯",
      "Do",
    ]);
    expect([mainDeNote(59, SEP), mainDeNote(60, SEP), mainDeNote(47, 48)]).toEqual(["L", "R", "L"]);
  });

  it("les degrés de l'accord, et l'écrasement en fondamentale et quinte", () => {
    expect(SIB.lanes).toEqual([70, 74, 77, 82]);
    expect([dansLAccord(SIB, 62), dansLAccord(SIB, 89), dansLAccord(SIB, 61), dansLAccord(SIB, 63)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(notesDeLEcrasement(SIB).map(nomDeClasse)).toEqual(["Si♭", "Fa"]);
  });

  it("le couloir d'une note dans l'accord : son degré, l'octave dès une octave au-dessus de la séparation", () => {
    expect([58, 62, 65, 70, 82, 94].map((n) => couloirDansLAccord(SIB, n, SEP))).toEqual([0, 1, 2, 0, 3, 3]);
    // Hors de l'accord : le degré le plus proche (Do♯ près de Ré, Mi♭ entre Ré et Fa, La près de Si♭)
    expect([61, 63, 69].map((n) => couloirDansLAccord(SIB, n, SEP))).toEqual([1, 1, 0]);
  });

  it("la note attendue d'une trille, d'un serpent et d'une petite note", () => {
    const trille = note("R", 1, 0, 70, { trille: 1, midiTrille: 74 }),
      serpent = note("R", 1, 0, 70, { serpent: [0, 1, 2], midiSerpent: [70, 74, 77] }),
      petite = note("R", 1, 1.5, 75);
    expect([noteAttendue(trille), noteAttendue(trille, 1), noteAttendue(serpent, 2), noteAttendue(petite)]).toEqual([
      70, 74, 77, 75,
    ]);
  });
});

describe("main droite en mode pianiste", () => {
  it("la tierce de l'accord, à n'importe quelle octave au-dessus de la séparation, tire dans le couloir 1", () => {
    for (const n of [62, 74, 86]) {
      const [ev] = partie([note("R", 1, 1, 74)]);
      expect(jouer(n, 1)).toEqual({ action: "couloir1", ns: 1, hauteur: n });
      expect(ev.state).toBe("hit");
    }
  });

  it("une note hors de l'accord est un mauvais couloir : le combo casse, la note reste à jouer", () => {
    const [ev] = partie([note("R", 1, 1, 74)]);
    S.combo = 5;
    jouer(61, 1);
    expect(effets.mauvaisCouloir).toHaveBeenCalledOnce();
    expect([ev.state, S.combo, S.health]).toEqual(["pending", 0, 100]);
  });

  it("une autre note de l'accord n'est pas la bonne non plus", () => {
    const [ev] = partie([note("R", 1, 1, 74)]);
    expect(jouer(65, 1).action).toBe("couloir2");
    expect(ev.state).toBe("pending");
    expect(effets.mauvaisCouloir).toHaveBeenCalledWith(2);
  });

  it("compare la note aux notes attendues, pas à l'accord à l'heure de l'appui", () => {
    // La note du couloir 1 tombe au premier temps de la mesure de Mi♭ : un appui 100 ms avant lit encore Si♭
    const [ev] = partie([note("R", 4, 1, 67)]);
    // Ré, la tierce de Si♭, est une fausse note sur Mi♭ : un mauvais couloir, la note reste à jouer
    expect(jouer(62, 3.9).breve).toBe(true);
    expect(effets.mauvaisCouloir).toHaveBeenCalledOnce();
    expect(ev.state).toBe("pending");
    jouer(67, 3.95);
    expect(ev.state).toBe("hit");
  });

  it("dans un accord, la plus grave des deux fondamentales est le couloir 0, la plus aiguë le couloir 3", () => {
    const [bas, haut] = partie([note("R", 1, 0, 70), note("R", 1, 3, 82)]);
    bas.grp = haut.grp = [bas, haut];
    expect(traduire(82, SEP, 1, etat).action).toBe("couloir3");
    expect(traduire(70, SEP, 1, etat).action).toBe("couloir0");
    jouer(70, 1);
    jouer(82, 1);
    expect([bas.state, haut.state]).toEqual(["hit", "hit"]);
    expect(effets.accord).toHaveBeenCalledOnce();
  });

  it("une note tenue se tient tant que la touche l'est", () => {
    const [ev] = partie([note("R", 1, 2, 77, { dur: 2 })]);
    const t = jouer(65, 1, true);
    expect(ev.state).toBe("holding");
    relacher(t.action, 3);
    expect(ev.state).toBe("done");
  });

  it("une petite note (ADR-0010) se joue avec sa vraie note, jamais avec une touche voisine", () => {
    // Mi♭ entre la tierce (Ré) et la quinte (Fa) de Si♭
    const [ev] = partie([note("R", 1.5, 1.5, 75)]);
    jouer(74, 1.5);
    expect(ev.state).toBe("pending");
    jouer(77, 1.5);
    expect(ev.state).toBe("pending");
    expect(jouer(63, 1.5).action).toBe("couloir1");
    expect(ev.state).toBe("hit");
    // En position fixe, la touche voisine la touchait : c'est toujours le cas sans note jouée
    const [fixe] = partie([note("R", 1.5, 1.5, 75)]);
    presser("couloir2", 1.5);
    expect(fixe.state).toBe("hit");
  });

  it("une trille alterne ses deux vraies notes ; une autre note n'alterne pas", () => {
    const [ev] = partie([note("R", 1, 0, 70, { dur: 1, trille: 1, midiTrille: 74 })]);
    const t = jouer(62, 1);
    expect([t.action, ev.state]).toEqual(["couloir1", "holding"]);
    jouer(70, 1.25);
    jouer(61, 1.5);
    expect(ev.alternances).toBe(1);
  });

  it("un serpent passe au couloir suivant avec la note de ce couloir", () => {
    const [ev] = partie([note("R", 1, 0, 70, { dur: 1.5, serpent: [0, 1, 2], midiSerpent: [70, 74, 77] })]);
    jouer(70, 1, true);
    expect(ev.state).toBe("holding");
    expect(jouer(62, 1.5, true).action).toBe("couloir1");
    expect(ev.troncon).toBe(1);
    // Une fausse note au passage suivant ne le prend pas
    jouer(66, 2);
    expect(ev.troncon).toBe(1);
    jouer(65, 2, true);
    expect(ev.troncon).toBe(2);
  });

  it("une silhouette du chanteur se joue avec la note entendue", () => {
    const [ev] = partie([note("R", 1, 2, 77, { reponse: true })]);
    expect(jouer(65, 1).action).toBe("couloir2");
    expect(ev.state).toBe("hit");
    const [faux] = partie([note("R", 1, 2, 77, { reponse: true })]);
    jouer(61, 1);
    expect(faux.state).toBe("miss");
  });

  it("pendant le solo libre, toute note de l'accord sonne et compte, les autres sont des erreurs", () => {
    partie([]);
    S.combo = 4;
    expect(jouer(62, 17).action).toBe("couloir1");
    expect(jouer(82, 17.5).action).toBe("couloir3");
    expect(effets.solo.mock.calls.map(([lane]) => lane)).toEqual([1, 3]);
    expect(S.score).toBe(50);
    jouer(61, 18);
    expect(effets.solo).toHaveBeenCalledTimes(2);
    expect(effets.mauvaisCouloir).toHaveBeenCalledWith(1);
    expect([S.combo, S.score]).toEqual([0, 50]);
  });

  it("sans note attendue, une note de l'accord tire dans le vide, sans pénalité", () => {
    partie([note("R", 8, 0, 70)]);
    expect(jouer(65, 1).action).toBe("couloir2");
    jouer(61, 1.5);
    expect(effets.tir).toHaveBeenCalledWith(2, null);
    expect([S.combo, S.health, S.miss]).toEqual([0, 100, 0]);
    expect(effets.mauvaisCouloir).not.toHaveBeenCalled();
  });
});

describe("main gauche en mode pianiste", () => {
  it("la fondamentale fait glisser et sauter, à n'importe quelle octave sous la séparation ; une autre note rate", () => {
    const [glisse, saute] = partie([note("L", 1, 0, 34), note("L", 2, 1, 46)]);
    expect(jouer(46, 1)).toEqual({ action: "glisser", ns: 1, hauteur: 46 });
    expect(jouer(58, 2).action).toBe("sauter");
    expect([glisse.state, saute.state]).toEqual(["hit", "hit"]);
    const [faux] = partie([note("L", 1, 0, 34)]);
    jouer(41, 1);
    expect(faux.state).toBe("miss");
  });

  it("la quinte en l'air fait le double saut ; la fondamentale en l'air le rate", () => {
    const [saut, double] = partie([note("L", 1, 1, 46), note("L", 1.4, 2, 53)]);
    jouer(46, 1);
    expect(jouer(41, 1.4).action).toBe("sauter");
    expect([saut.state, double.state]).toEqual(["hit", "hit"]);
    const [, rate] = partie([note("L", 1, 1, 46), note("L", 1.4, 2, 53)]);
    jouer(46, 1);
    jouer(46, 1.4);
    expect(rate.state).toBe("miss");
  });

  it("un saut simple ne se joue pas avec la quinte", () => {
    const [saut] = partie([note("L", 1, 1, 46)]);
    jouer(53, 1);
    expect(saut.state).toBe("miss");
  });

  it("un tunnel se tient avec la fondamentale enfoncée", () => {
    const [tunnel] = partie([note("L", 1, 0, 34, { dur: 2 })]);
    const t = jouer(34, 1, true);
    expect(tunnel.state).toBe("holding");
    relacher(t.action, 3);
    expect(tunnel.state).toBe("done");
  });

  it("une marche d'escalier se joue avec sa note : en sautant pour monter, en glissant pour descendre", () => {
    const [monte, descend] = partie([note("L", 1, 4, 36), note("L", 2, 5, 39)]);
    expect(jouer(48, 1).action).toBe("sauter");
    expect(jouer(51, 2).action).toBe("glisser");
    expect([monte.state, descend.state]).toEqual(["hit", "hit"]);
  });

  it("l'écrasement demande la fondamentale et la quinte frappées ensemble, jugé à l'heure de la première", () => {
    const [plaque] = partie([note("L", 24, 3, 34, { kind: "refrain" })]);
    expect(jouer(46, 24)).toBeNull();
    expect(plaque.state).toBe("pending");
    expect(jouer(53, 24.03)).toEqual({ action: "ecraser", ns: 24, hauteur: 34 });
    expect(plaque.state).toBe("hit");
    expect(S.perfect).toBe(1);
  });

  it("dans l'autre ordre aussi ; une note relâchée ou trop ancienne n'attend plus son partenaire", () => {
    const [plaque] = partie([note("L", 24, 3, 34, { kind: "refrain" })]);
    // Une fondamentale relâchée avant la quinte n'attend plus
    expect(jouer(46, 23.9)).toBeNull();
    lacherNote(etat, 46);
    expect(jouer(53, 23.92)).toBeNull();
    // Une quinte trop ancienne non plus : la fondamentale qui suit attend à son tour
    expect(jouer(46, 23.92 + ENSEMBLE * 1.2)).toBeNull();
    expect(plaque.state).toBe("pending");
    // La fondamentale attend, la quinte la rejoint : l'écrasement est jugé à l'heure de la première
    const t = jouer(41, 24.06);
    expect([t.action, t.hauteur]).toEqual(["ecraser", 34]);
    expect(t.ns).toBeCloseTo(23.92 + ENSEMBLE * 1.2);
    expect(plaque.state).toBe("hit");
  });

  it("une fausse note sur la plaque la rate", () => {
    const [plaque] = partie([note("L", 24, 3, 34, { kind: "refrain" })]);
    jouer(48, 24);
    expect(plaque.state).toBe("miss");
  });

  it("sans obstacle attendu : la fondamentale grave glisse, celle de l'octave sous la séparation saute, la quinte saute", () => {
    partie([note("L", 20, 0, 34)]);
    expect([46, 58, 53, 48].map((n) => traduire(n, SEP, 1, etat)?.action ?? null)).toEqual([
      "glisser",
      "sauter",
      "sauter",
      null,
    ]);
  });
});

describe("couche d'actions", () => {
  it("la note jouée s'enregistre avec l'appui, et marque la partie comme jouée en mode pianiste", () => {
    partie([note("R", 1, 1, 74)]);
    S.enregistrement = {
      graine: 1,
      difficulte: "normal",
      essai: null,
      mains: "both",
      vitesse: 1,
      auto: false,
      coups: [],
      finie: false,
    };
    expect(S.pianiste).toBe(false);
    appuyer("couloir1", 1, false, 62);
    expect(S.enregistrement.coups[0]).toEqual({
      temps: 1,
      geste: "appui",
      action: "couloir1",
      hauteur: 62,
      resultat: "parfait",
    });
    expect(S.pianiste).toBe(true);
    expect(autoFor("R")).toBe(false);
  });
});

/* ---------- Dans le jeu, au MIDI simulé ---------- */
const GRAINE = 3;
let nav: Navigateur;
afterEach(() => nav?.fermer());

const PIANISTE: Options = {
  stockage: { "deux-mains-pianiste": "oui" },
  midi: { permission: "granted", claviers: ["Piano test"] },
};
async function ouvrir(options: Options = PIANISTE) {
  nav = await Navigateur.ouvrir(options);
  return nav.jeu.state;
}
const spb = () => 60 / nav.jeu.state.song.bpm;

/**
 * La touche d'un pianiste parfait pour un appui : la vraie note, au-dessus de la séparation pour la main droite (une
 * octave plus haut pour le couloir 3), dans la deuxième octave sous la séparation pour la main gauche. La plaque
 * se joue avec deux touches, la fondamentale et la quinte.
 */
function touches(ev: Note, lane: number) {
  const S = nav.jeu.state,
    sep = 60;
  if (ev.hand === "R") return [sep + classe(noteAttendue(ev, lane)) + (lane === 3 ? 12 : 0)];
  if (ev.lane !== 3) return [sep - 24 + classe(ev.midi)];
  const ch = S.song.chords[Math.floor(ev.beat / 4)];
  return notesDeLEcrasement(ch).map((n) => sep - 24 + classe(n));
}
/** Joue toute la chanson en vraie hauteur, à l'heure exacte de chaque note, comme un pianiste parfait */
function jouerAuPiano(maxSecondes: number) {
  const S = nav.jeu.state;
  const relaches: { at: number; notes: number[] }[] = [];
  const gestes = S.song.ev
    .flatMap((ev) => appuis(ev).map((a) => ({ ev, lane: a.lane, at: a.beat * spb(), fin: a.fin })))
    .sort((a, b) => a.at - b.at);
  let i = 0;
  const fin = nav.horloge.secondes + maxSecondes;
  while (S.mode === "play" && nav.horloge.secondes < fin) {
    nav.image();
    const t = nav.jeu.songNow();
    for (const r of relaches.filter((r) => r.at <= t)) for (const n of r.notes) nav.relacherMidi(n, t - r.at);
    relaches.splice(0, relaches.length, ...relaches.filter((r) => r.at > t));
    while (i < gestes.length && gestes[i].at <= t) {
      const { ev, lane, at, fin: finGeste } = gestes[i++],
        notes = touches(ev, lane);
      for (const n of notes) nav.noteMidi(n, t - at);
      relaches.push({ at: finGeste === null ? at + 0.05 : finGeste * spb(), notes });
    }
  }
  return S;
}

describe("jouer en mode pianiste au clavier MIDI", () => {
  it.each<Difficulte>(["facile", "normal", "difficile"])(
    "une chanson entière en %s, en vraie hauteur, sans aucune note ratée",
    async (diff) => {
      const S = await ouvrir();
      nav.jeu.load(GRAINE, diff);
      nav.presser("Space");
      jouerAuPiano(S.song.endBeat * spb() + 10);
      expect(S.mode).toBe("done");
      expect(S.miss).toBe(0);
      expect(S.perfect).toBe(coupsAttendus(S.song.ev));
      // L'écran de fin le signale, et le score n'est pas gardé comme record de la graine
      expect(nav.overlay.innerHTML).toContain("mode pianiste");
      expect(nav.overlay.innerHTML).toContain("ne compte pas pour le record");
      expect(meilleurScore(S.sauvegarde, GRAINE, diff)).toBeUndefined();
      expect(S.sauvegarde.carte[S.theme]).toContain(S.song.prog.name);
    },
  );

  it("les touches de la position fixe n'y jouent plus : il faut la vraie note", async () => {
    const S = await ouvrir();
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    const ev = S.song.ev.find((e) => e.hand === "R" && e.lane === 1 && !e.grp);
    S.auto = true;
    while (nav.jeu.songNow() < ev.beat * spb() - 0.5) nav.image();
    S.auto = false;
    while (nav.jeu.songNow() < ev.beat * spb()) nav.image();
    // Mi4, la tierce de la position fixe, n'est pas la tierce de cet accord
    if (classe(ev.midi) !== 4) {
      nav.noteMidi(64);
      expect(ev.state).toBe("pending");
    }
    nav.noteMidi(60 + classe(ev.midi));
    expect(ev.state === "hit" || ev.state === "holding").toBe(true);
  });

  it("la scène montre les noms des notes attendues plutôt que les touches de la position fixe", async () => {
    const S = await ouvrir();
    nav.jeu.load(GRAINE, "normal");
    expect(nav.overlay.innerHTML).toContain("mode pianiste : joue la vraie note");
    nav.presser("Space");
    nav.image();
    const ch = S.song.chords[0];
    expect(nav.textes).toEqual(expect.arrayContaining(ch.lanes.map(nomDeClasse)));
    expect(nav.textes).not.toContain("Mi4");
  });
});

describe("réglage du mode pianiste", () => {
  it("désactivé par défaut, caché tant que le MIDI n'est pas activé, et retenu d'une visite à l'autre", async () => {
    await ouvrir({ midi: { claviers: ["Piano test"] } });
    expect(nav.trouver("#champ-pianiste").hidden).toBe(true);
    nav.cliquer("#midi-activer");
    await nav.promesses();
    expect(nav.trouver("#champ-pianiste").hidden).toBe(false);
    expect(nav.overlay.innerHTML).toContain("Clavier MIDI · Gauche : <kbd>Do3</kbd> glisser");
    nav.jeu.setPianiste(true);
    expect(nav.stockage.get("deux-mains-pianiste")).toBe("oui");
    expect(nav.overlay.innerHTML).toContain("mode pianiste");
    nav.fermer();

    await ouvrir({ stockage: { "deux-mains-pianiste": "oui" } });
    expect(nav.trouver("#champ-pianiste").hidden).toBe(true);
    nav.jeu.setPianiste(false);
    expect(nav.stockage.get("deux-mains-pianiste")).toBe("non");
  });

  it("désactivé, le MIDI joue en position fixe comme avant", async () => {
    const S = await ouvrir({ stockage: { "deux-mains-pianiste": "non" }, midi: PIANISTE.midi });
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    const ev = S.song.ev[0];
    while (nav.jeu.songNow() < ev.beat * spb()) nav.image();
    nav.noteMidi(ev.hand === "L" ? [48, 55, 55, 52][ev.lane] : [60, 64, 67, 72][ev.lane]);
    expect(reussie(ev)).toBe(true);
    expect(S.pianiste).toBe(false);
  });
});

describe("essai pianiste", () => {
  it("sans clavier MIDI : l'essai l'explique, montre les noms des notes et se joue en auto-play", async () => {
    const S = await ouvrir({ adresse: { search: "?essai=pianiste" } });
    expect(nav.overlay.innerHTML).toContain("mode pianiste : joue la vraie note");
    expect(nav.overlay.innerHTML).toContain("Pas de MIDI dans ce navigateur");
    nav.presser("KeyA");
    nav.image();
    expect(nav.textes).toContain("MIDI · INDISPONIBLE ICI");
    expect(nav.textes).toEqual(expect.arrayContaining(["Sol", "Si♭", "Ré"]));
    while (S.mode === "play") nav.image();
    expect(S.mode).toBe("done");
    expect(S.miss).toBe(0);
  });

  it("au clavier MIDI, l'essai joue en vraie hauteur même si le réglage est désactivé", async () => {
    const S = await ouvrir({ adresse: { search: "?essai=pianiste" }, midi: PIANISTE.midi });
    nav.presser("Space");
    jouerAuPiano(S.song.endBeat * spb() + 10);
    expect(S.mode).toBe("done");
    expect(S.miss).toBe(0);
    expect(S.perfect).toBe(coupsAttendus(S.song.ev));
    expect(nav.overlay.innerHTML).toContain("mode pianiste");
  });
});
