// Clavier MIDI (#10, ADR-0011) : la table de position fixe est de la logique pure, testée sans navigateur ; l'accès
// Web MIDI, l'indicateur, le point de séparation et les parties jouées au MIDI passent par le faux navigateur, qui
// imite navigator.requestMIDIAccess.

import { afterEach, describe, expect, it } from "vitest";
import type { Note } from "../src/chanson/types";
import type { Action } from "../src/jeu/etat";
import {
  POSITIONS,
  SEPARATION,
  SEPARATIONS,
  actionDeNote,
  lireMessage,
  noteDeAction,
  nomDeNote,
  touchesMidi,
} from "../src/jeu/midi";
import { appuis, coupsAttendus } from "./support/appuis";
import { Navigateur, type Difficulte, type Options } from "./support/navigateur";

// Graine fixe (ADR-0005) : la même chanson à chaque passage, avec des accords de la main droite en Normal
const GRAINE = 3;
const CLAVIER_TEST = "Clavier test";

let nav: Navigateur;
afterEach(() => nav?.fermer());

describe("table de position fixe (logique pure)", () => {
  it("avec le Do central comme séparation : Do3 Mi3 Sol3 pour la basse, Do4 Mi4 Sol4 Do5 pour les couloirs", () => {
    expect(SEPARATION).toBe(60);
    const table = Object.fromEntries([48, 52, 55, 60, 64, 67, 72].map((n) => [n, actionDeNote(n)]));
    expect(table).toEqual({
      48: "glisser",
      52: "ecraser",
      55: "sauter",
      60: "couloir0",
      64: "couloir1",
      67: "couloir2",
      72: "couloir3",
    });
  });

  it("les autres touches, noires ou blanches, ne font rien", () => {
    const jouent = [];
    for (let n = 0; n < 128; n++) if (actionDeNote(n)) jouent.push(n);
    expect(jouent).toEqual([48, 52, 55, 60, 64, 67, 72]);
  });

  it.each(SEPARATIONS)(
    "séparation %i : les sept touches se déplacent ensemble, la basse dessous, la mélodie dessus",
    (sep) => {
      for (const [ecart, action] of Object.entries(POSITIONS)) {
        expect(actionDeNote(sep + +ecart, sep)).toBe(action);
        expect(noteDeAction(action, sep)).toBe(sep + +ecart);
        const main = ["sauter", "glisser", "ecraser"].includes(action) ? "L" : "R";
        expect(main === "L").toBe(sep + +ecart < sep);
      }
      // Toutes des touches blanches, dans les 128 notes MIDI
      for (const t of touchesMidi(sep)) {
        expect(t.nom).not.toMatch(/[♯♭]/);
        expect(t.note).toBeGreaterThanOrEqual(0);
        expect(t.note).toBeLessThan(128);
      }
    },
  );

  it("nomme les notes en français, avec l'octave du Do central à 4", () => {
    expect([nomDeNote(60), nomDeNote(48), nomDeNote(61), nomDeNote(70), nomDeNote(21)]).toEqual([
      "Do4",
      "Do3",
      "Do♯4",
      "Si♭4",
      "La0",
    ]);
    expect(touchesMidi().map((t) => `${t.nom} ${t.action}`)).toEqual([
      "Do3 glisser",
      "Mi3 ecraser",
      "Sol3 sauter",
      "Do4 couloir0",
      "Mi4 couloir1",
      "Sol4 couloir2",
      "Do5 couloir3",
    ]);
  });

  it("lit les touches enfoncées et relâchées sur tous les canaux, et ignore les autres messages", () => {
    expect(lireMessage([0x90, 60, 100])).toEqual({ enfoncee: true, note: 60 });
    expect(lireMessage([0x9f, 64, 1])).toEqual({ enfoncee: true, note: 64 });
    // Un noteon de vélocité 0 vaut un noteoff
    expect(lireMessage([0x90, 60, 0])).toEqual({ enfoncee: false, note: 60 });
    expect(lireMessage([0x83, 60, 64])).toEqual({ enfoncee: false, note: 60 });
    // Pédale de sustain, changement de programme, horloge, message tronqué
    expect(lireMessage([0xb0, 64, 127])).toBeNull();
    expect(lireMessage([0xc0, 5, 0])).toBeNull();
    expect(lireMessage([0xf8])).toBeNull();
    expect(lireMessage([0x90, 60])).toBeNull();
    expect(lireMessage(null)).toBeNull();
  });
});

/* ---------- Dans le jeu ---------- */
async function ouvrir(options: Options = { midi: { permission: "granted", claviers: [CLAVIER_TEST] } }) {
  nav = await Navigateur.ouvrir(options);
  return nav.jeu.state;
}
async function partie(difficulte: Difficulte = "normal", options?: Options) {
  const S = await ouvrir(options);
  nav.jeu.load(GRAINE, difficulte);
  nav.presser("Space");
  expect(S.mode).toBe("play");
  return S;
}

const spb = () => 60 / nav.jeu.state.song.bpm;
const temps = (ev: Note) => ev.beat * spb();
function attendre(t: number) {
  while (nav.jeu.songNow() < t) nav.image();
  return nav.jeu.songNow() - t;
}
function avancerEnAuto(t: number) {
  nav.jeu.state.auto = true;
  attendre(t - 0.5);
  nav.jeu.state.auto = false;
}

// La touche MIDI d'une note, avec la séparation par défaut : glisser (et tunnels, pentes), sauter (et double saut),
// écraser ; puis les quatre couloirs
const ACTION_DE_NOTE = (ev: Note): Action =>
  ev.hand === "L"
    ? (["glisser", "sauter", "sauter", "ecraser"] as const)[ev.lane]
    : (["couloir0", "couloir1", "couloir2", "couloir3"] as const)[ev.lane];
const TOUCHE_CLAVIER: Record<string, string> = { glisser: "KeyS", sauter: "KeyW", ecraser: "Space" };

/**
 * Un joueur parfait : à l'heure exacte de chaque note, il enfonce sa touche (le message arrive à l'image suivante,
 * avec son horodatage), et la relâche à la fin des notes tenues. Au MIDI, un accord demande toutes ses touches.
 * `auClavier` : les notes jouées au clavier d'ordinateur plutôt qu'au MIDI (un joueur de chaque, en duo).
 */
function jouer(maxSecondes: number, auClavier: (ev: Note) => boolean = () => false) {
  const S = nav.jeu.state;
  const relaches: { at: number; fn: (retard: number) => void }[] = [];
  // Un serpent (#16) se suit touche par touche, en appuis qui se chevauchent
  const gestes = S.song.ev
    .flatMap((ev) => appuis(ev).map((a) => ({ ev: { ...ev, lane: a.lane }, at: a.beat * spb(), fin: a.fin })))
    .sort((a, b) => a.at - b.at);
  let i = 0,
    tour = 0;
  const fin = nav.horloge.secondes + maxSecondes;
  while (S.mode === "play" && nav.horloge.secondes < fin) {
    nav.image();
    const t = nav.jeu.songNow();
    for (const r of relaches.filter((r) => r.at <= t)) r.fn(t - r.at);
    relaches.splice(0, relaches.length, ...relaches.filter((r) => r.at > t));
    while (i < gestes.length && gestes[i].at <= t) {
      const { ev, at: debut, fin: finGeste } = gestes[i++],
        a = ACTION_DE_NOTE(ev),
        retard = t - debut,
        at = finGeste === null ? debut + 0.05 : finGeste * spb();
      if (auClavier(ev)) {
        nav.presser(TOUCHE_CLAVIER[a]);
        relaches.push({ at, fn: () => nav.relacher(TOUCHE_CLAVIER[a]) });
      } else {
        const note = noteDeAction(a);
        nav.noteMidi(note, retard);
        // La moitié des relâchements en noteon de vélocité 0, comme beaucoup de claviers
        const nul = tour++ % 2 === 0;
        relaches.push({ at, fn: (r) => nav.relacherMidi(note, r, nul) });
      }
    }
  }
  return S;
}

describe("accès Web MIDI", () => {
  it("sans Web MIDI, le jeu démarre et se joue au clavier, sans erreur ni indicateur sur la scène", async () => {
    const S = await partie("normal", {});
    expect(nav.trouver("#midi-etat").textContent).toBe("Pas de MIDI dans ce navigateur : il faut Chrome ou Edge.");
    expect(nav.trouver("#midi-activer").hidden).toBe(true);
    nav.toucherBouton("midi");
    nav.image();
    expect(nav.textes.some((t) => t.startsWith("MIDI"))).toBe(false);
    expect(nav.textes).toContain("J");
    const ev = S.song.ev.find((e) => e.hand === "R");
    avancerEnAuto(temps(ev));
    attendre(temps(ev));
    nav.presser(["KeyJ", "KeyK", "KeyL", "Semicolon"][ev.lane]);
    expect(ev.state === "hit" || ev.state === "holding").toBe(true);
  });

  it("ne demande pas la permission au chargement ; le bouton Activer la demande et branche le clavier", async () => {
    await ouvrir({ midi: { claviers: [CLAVIER_TEST] } });
    expect(nav.midi.demandes).toBe(0);
    expect(nav.trouver("#midi-etat").textContent).toBe("Clavier MIDI pas encore activé.");
    expect(nav.trouver("#midi-activer").hidden).toBe(false);
    expect(nav.overlay.innerHTML).not.toContain("Clavier MIDI ·");

    nav.cliquer("#midi-activer");
    await nav.promesses();

    expect(nav.midi.demandes).toBe(1);
    expect(nav.trouver("#midi-etat").textContent).toBe(`Clavier MIDI : ${CLAVIER_TEST}.`);
    expect(nav.trouver("#midi-activer").hidden).toBe(true);
    expect(nav.overlay.innerHTML).toContain("Clavier MIDI · Gauche : <kbd>Do3</kbd> glisser");
    expect(nav.overlay.innerHTML).toContain("Gauche <kbd>W</kbd>");
  });

  it("une permission déjà accordée branche le clavier tout seul, et la scène l'indique avec les touches MIDI", async () => {
    const S = await partie();
    expect(nav.midi.demandes).toBe(1);
    nav.image();
    expect(nav.textes).toContain("MIDI · CLAVIER TEST");
    expect(nav.textes).toEqual(expect.arrayContaining(["Do4", "Mi4", "Sol4", "Do5", "Sol3", "Do3"]));
    // Les touches du clavier d'ordinateur restent celles de l'auto-play et de la pause
    expect(nav.textes).toContain("A : AUTO-PLAY · ÉCHAP : PAUSE");
    expect(S.mode).toBe("play");
  });

  it("dans la page d'artefact, l'accès est refusé : le jeu le dit et se joue au clavier", async () => {
    await ouvrir({ midi: { refuse: true, claviers: [CLAVIER_TEST] } });
    nav.toucherBouton("midi");
    await nav.promesses();
    expect(nav.trouver("#midi-etat").textContent).toContain("La page d'artefact claude.ai bloque les périphériques");
    expect(nav.trouver("#midi-etat").textContent).toContain("deux-mains.html");
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");
    const S = nav.jeu.state;
    const ev = S.song.ev.find((e) => e.hand === "R");
    avancerEnAuto(temps(ev));
    attendre(temps(ev));
    nav.presser(["KeyJ", "KeyK", "KeyL", "Semicolon"][ev.lane]);
    expect(ev.state === "hit" || ev.state === "holding").toBe(true);
  });

  it("une permission refusée d'avance est indiquée sans rien demander", async () => {
    await ouvrir({ midi: { permission: "denied", claviers: [CLAVIER_TEST] } });
    expect(nav.midi.demandes).toBe(0);
    expect(nav.trouver("#midi-etat").textContent).toContain("Accès au MIDI refusé");
  });

  it("suit les claviers branchés et débranchés ; un clavier débranché relâche ses touches", async () => {
    const S = await partie("normal", { midi: { permission: "granted" } });
    expect(nav.trouver("#midi-etat").textContent).toBe("MIDI activé, aucun clavier branché.");
    nav.midi.brancher(CLAVIER_TEST);
    expect(nav.trouver("#midi-etat").textContent).toBe(`Clavier MIDI : ${CLAVIER_TEST}.`);

    const tunnel = S.song.ev.find((ev) => ev.hand === "L" && ev.dur > 0 && ev.fin === undefined);
    avancerEnAuto(temps(tunnel));
    nav.noteMidi(48, attendre(temps(tunnel)));
    expect([S.keys.glisser, tunnel.state]).toEqual([true, "holding"]);
    nav.midi.debrancher(CLAVIER_TEST);
    expect(S.keys.glisser).toBe(false);
    expect(tunnel.state).toBe("broken");
    expect(nav.trouver("#midi-etat").textContent).toBe("MIDI activé, aucun clavier branché.");
  });
});

describe("jouer au clavier MIDI", () => {
  it.each<Difficulte>(["facile", "difficile"])("une chanson entière en %s, sans aucune note ratée", async (diff) => {
    const S = await partie(diff);

    jouer(S.song.endBeat * spb() + 10);

    expect(S.mode).toBe("done");
    expect(S.miss).toBe(0);
    expect(S.perfect).toBe(coupsAttendus(S.song.ev));
  });

  it("juge à l'heure du message, pas à l'heure où il est traité", async () => {
    const S = await partie();
    const ev = S.song.ev[0];
    const retard = attendre(temps(ev) + 0.1) + 0.1;
    nav.noteMidi(noteDeAction(ACTION_DE_NOTE(ev)), retard);
    expect(S.perfect).toBe(1);
  });

  it("une touche maintenue tient un tunnel jusqu'au bout ; relâchée trop tôt, elle le lâche", async () => {
    const S = await partie();
    const [a, b] = S.song.ev.filter((ev) => ev.hand === "L" && ev.dur > 0 && ev.fin === undefined);
    avancerEnAuto(temps(a));
    nav.noteMidi(48, attendre(temps(a)));
    expect(a.state).toBe("holding");
    attendre(temps(a) + a.dur * spb());
    nav.relacherMidi(48, 0, true);
    expect(a.state).toBe("done");

    avancerEnAuto(temps(b));
    nav.noteMidi(48, attendre(temps(b)));
    attendre(temps(b) + (b.dur * spb()) / 2);
    nav.relacherMidi(48);
    expect(b.state).toBe("broken");
  });

  it("une touche maintenue tient un ennemi allongé", async () => {
    const S = await partie();
    const long = S.song.ev.find((ev) => ev.hand === "R" && ev.dur > 0 && !ev.grp);
    avancerEnAuto(temps(long));
    const note = noteDeAction(ACTION_DE_NOTE(long));
    nav.noteMidi(note, attendre(temps(long)));
    expect(long.state).toBe("holding");
    attendre(temps(long) + long.dur * spb());
    nav.relacherMidi(note);
    expect(long.state).toBe("done");
  });

  it("au MIDI, un accord demande toutes ses touches, comme au clavier", async () => {
    const S = await partie();
    const accord = S.song.ev.find((ev) => ev.hand === "R" && ev.grp?.filter((e) => e.hand === "R").length >= 2);
    avancerEnAuto(temps(accord));
    const [a, b] = accord.grp.filter((e) => e.hand === "R");
    nav.noteMidi(noteDeAction(ACTION_DE_NOTE(a)), attendre(temps(accord)));
    expect(a.state === "hit" || a.state === "holding").toBe(true);
    expect(b.state).toBe("pending");
  });

  it("le clavier d'ordinateur joue en même temps que le MIDI", async () => {
    const S = await partie();
    const accord = S.song.ev.find((ev) => ev.hand === "L" && ev.lane === 0 && ev.grp?.some((e) => e.hand === "R"));
    const droite = accord.grp.find((e) => e.hand === "R");
    avancerEnAuto(temps(accord));
    const retard = attendre(temps(accord));
    nav.presser("KeyS");
    nav.noteMidi(noteDeAction(ACTION_DE_NOTE(droite)), retard);
    expect(accord.state === "hit" || accord.state === "holding").toBe(true);
    expect(droite.state === "hit" || droite.state === "holding").toBe(true);
  });

  it("les touches hors de la table ne font rien, sans pénalité", async () => {
    const S = await partie();
    attendre(1);
    for (const n of [21, 47, 50, 59, 61, 62, 65, 71, 73, 108]) nav.noteMidi(n);
    nav.messageMidi([0xb0, 64, 127]);
    expect([S.miss, S.combo, S.health]).toEqual([0, 0, 100]);
    expect(S.keys).toEqual({});
  });

  it("le point de séparation déplace les touches, est retenu, et le relâchement suit la touche pressée", async () => {
    const S = await partie();
    nav.saisir("#separation", "48");
    expect(nav.stockage.get("deux-mains-separation")).toBe("48");
    nav.image();
    expect(nav.textes).toEqual(expect.arrayContaining(["Do3", "Mi3", "Sol3", "Do4", "Sol2", "Do2"]));

    const tunnel = S.song.ev.find((ev) => ev.hand === "L" && ev.dur > 0 && ev.fin === undefined);
    avancerEnAuto(temps(tunnel));
    nav.noteMidi(36, attendre(temps(tunnel)));
    expect(tunnel.state).toBe("holding");
    // Changer la séparation pendant que la touche est tenue : le relâchement revient à glisser
    nav.saisir("#separation", "60");
    attendre(temps(tunnel) + tunnel.dur * spb());
    nav.relacherMidi(36);
    expect([tunnel.state, S.keys.glisser]).toEqual(["done", false]);
    nav.fermer();

    await ouvrir({ stockage: { "deux-mains-separation": "72" }, midi: { permission: "granted", claviers: ["X"] } });
    expect(nav.trouver("#separation").value).toBe("72");
    expect(nav.overlay.innerHTML).toContain("<kbd>Do5</kbd> <kbd>Mi5</kbd> <kbd>Sol5</kbd> <kbd>Do6</kbd>");
  });

  it("pendant le calibrage, une touche MIDI compte comme un coup", async () => {
    const S = await ouvrir();
    nav.cliquer("#calibrer");
    expect(S.mode).toBe("calib");
    nav.noteMidi(30);
    nav.noteMidi(60);
    expect(S.calib.coups.length).toBe(2);
  });
});

describe("duo au clavier MIDI (#6)", () => {
  it("la basse au clavier d'ordinateur, la mélodie au MIDI : une chanson entière sans faute pour les deux", async () => {
    const S = await ouvrir();
    nav.jeu.setPractice("duo");
    nav.jeu.load(GRAINE, "normal");
    nav.presser("Space");

    jouer(S.song.endBeat * spb() + 10, (ev) => ev.hand === "L");

    expect(S.mode).toBe("done");
    expect([S.parMain.L.miss, S.parMain.R.miss]).toEqual([0, 0]);
    expect(S.parMain.L.perfect).toBe(S.song.ev.filter((ev) => ev.hand === "L").length);
    expect(S.parMain.R.perfect).toBe(S.song.ev.filter((ev) => ev.hand === "R").length);
  });

  it("les deux joueurs sur le même clavier MIDI : chacun marque avec sa main", async () => {
    const S = await ouvrir();
    nav.jeu.setPractice("duo");
    nav.jeu.load(GRAINE, "normal");
    // L'écran de départ donne à chaque joueur ses touches MIDI
    expect(nav.overlay.innerHTML).toContain("Clavier MIDI · Basse : <kbd>Do3</kbd> glisser");
    expect(nav.overlay.innerHTML).toContain("· Mélodie : <kbd>Do4</kbd>");
    nav.presser("Space");

    jouer(S.song.endBeat * spb() + 10);

    expect(S.mode).toBe("done");
    expect(S.parMain.L.miss + S.parMain.R.miss).toBe(0);
    expect(S.parMain.L.score).toBeGreaterThan(0);
    expect(S.parMain.R.score).toBeGreaterThan(0);
  });
});

describe("essai midi", () => {
  it("rappelle la table des touches sur un clavier dessiné et sur la scène, et propose d'activer le MIDI", async () => {
    await ouvrir({ adresse: { search: "?essai=midi" }, midi: { claviers: [CLAVIER_TEST] } });
    const html = nav.overlay.innerHTML;
    expect(html).toContain('class="piano"');
    for (const t of ["Do3", "Mi3", "Sol3", "Do4", "Mi4", "Sol4", "Do5"]) expect(html).toContain(`<b>${t}</b>`);
    expect(html).toContain('data-act="midi"');
    expect(nav.trouver("#essai-bandeau").textContent).toContain("la page d'artefact bloque les périphériques");

    nav.toucherBouton("midi");
    await nav.promesses();
    expect(nav.overlay.innerHTML).toContain(`Clavier MIDI : ${CLAVIER_TEST}.`);
    expect(nav.overlay.innerHTML).not.toContain('data-act="midi"');
    nav.presser("Space");
    nav.image();
    expect(nav.textes).toContain("MIDI · CLAVIER TEST");
  });

  it("sans clavier activé, la scène de l'essai montre quand même les touches MIDI et l'état de l'accès", async () => {
    await ouvrir({ adresse: { search: "?essai=midi" }, midi: { claviers: [CLAVIER_TEST] } });
    nav.presser("Space");
    nav.image();
    expect(nav.textes).toContain("MIDI · NON ACTIVÉ");
    expect(nav.textes).toEqual(expect.arrayContaining(["Do4", "Mi4", "Sol4", "Do5", "Sol3", "Do3"]));
  });

  it("sans Web MIDI, l'essai l'explique et se joue quand même au clavier", async () => {
    await ouvrir({ adresse: { search: "?essai=midi" } });
    expect(nav.overlay.innerHTML).toContain("Pas de MIDI dans ce navigateur");
    expect(nav.overlay.innerHTML).not.toContain('data-act="midi"');
    nav.presser("Space");
    nav.image();
    expect(nav.textes).toContain("MIDI · INDISPONIBLE ICI");
  });

  it("se joue au MIDI d'un bout à l'autre", async () => {
    const S = await ouvrir({ adresse: { search: "?essai=midi" }, midi: { permission: "granted", claviers: ["X"] } });
    nav.presser("Space");
    jouer(S.song.endBeat * spb() + 10);
    expect(S.mode).toBe("done");
    expect(S.miss).toBe(0);
    expect(S.perfect).toBe(coupsAttendus(S.song.ev));
  });
});
