// Réécoute de fin de partie (#23) : la partie enregistre ses coups (moment, action, résultat), et la réécoute les
// rejoue dans le jugement sur la chanson de la graine (ADR-0005). Elle fait entendre les mêmes notes aux mêmes
// moments, sans les ratées, avec la phrase du solo reprise au refrain (ADR-0012) ; on peut la mettre en pause et la
// quitter. Le format d'enregistrement est de la logique pure ; les parcours passent par le faux navigateur.

import { afterEach, describe, expect, it } from "vitest";
import type { Note } from "../src/chanson/types";
import {
  compteurs,
  coupsDus,
  noter,
  nouvelEnregistrement,
  reglagesDe,
  reprendre,
  resultatEntre,
  type Coup,
  type Enregistrement,
  type ReglagesDePartie,
} from "../src/jeu/enregistrement";
import { appuis } from "./support/appuis";
import { Navigateur } from "./support/navigateur";

const REGLAGES: ReglagesDePartie = {
  graine: 4242,
  difficulte: "facile",
  essai: null,
  mains: "both",
  vitesse: 1,
  auto: false,
};

describe("l'enregistrement des coups", () => {
  it("commence vide avec les réglages de la partie, et garde les coups dans l'ordre où ils sont joués", () => {
    const enr = nouvelEnregistrement(REGLAGES);
    expect(enr).toEqual({ ...REGLAGES, coups: [], scores: [], finie: false });
    noter(enr, { temps: 4, geste: "appui", action: "sauter", resultat: "parfait" });
    noter(enr, { temps: 3.98, geste: "appui", action: "couloir1" }); // horodaté par une autre commande
    noter(enr, { temps: 4.5, geste: "relache", action: "sauter" });
    expect(enr.coups.map((c) => c.temps)).toEqual([4, 3.98, 4.5]);
    expect(reglagesDe(enr)).toEqual(REGLAGES);
    // Sans enregistrement (une boucle), rien ne se passe
    noter(null, { temps: 1, geste: "pause" });
    reprendre(null, 1, "both", false);
  });

  it("à la reprise après une mort, oublie les coups depuis le début de la section et ceux du décompte", () => {
    const enr = nouvelEnregistrement(REGLAGES);
    for (const temps of [2, 6, 9, 11]) noter(enr, { temps, geste: "appui", action: "couloir0" });
    reprendre(enr, 8, "R", true);
    // Le décompte (une mesure avant la section) rejoue des notes passées : ses coups sont ignorés
    noter(enr, { temps: 5, geste: "appui", action: "couloir2" });
    noter(enr, { temps: 8.2, geste: "appui", action: "couloir3" });
    expect(enr.coups).toEqual<Coup[]>([
      { temps: 2, geste: "appui", action: "couloir0" },
      { temps: 6, geste: "appui", action: "couloir0" },
      { temps: 8, geste: "reprise", mains: "R", auto: true },
      { temps: 8.2, geste: "appui", action: "couloir3" },
    ]);
  });

  it("le résultat d'un appui vient des compteurs du jugement : raté, puis Bien, puis Parfait, sinon aucun", () => {
    const avant = compteurs({ perfect: 3, good: 1, miss: 2, combo: 7 } as never);
    expect(avant).toEqual({ perfect: 3, good: 1, miss: 2 });
    expect(resultatEntre(avant, { ...avant, perfect: 4 })).toBe("parfait");
    expect(resultatEntre(avant, { ...avant, perfect: 4, good: 2 })).toBe("bien");
    expect(resultatEntre(avant, { ...avant, miss: 3 })).toBe("rate");
    expect(resultatEntre(avant, avant)).toBeUndefined();
  });

  it("donne les coups dus jusqu'à un temps, à partir du suivant", () => {
    const enr: Enregistrement = nouvelEnregistrement(REGLAGES);
    for (const temps of [1, 2, 2, 3.5]) noter(enr, { temps, geste: "pause" });
    expect(coupsDus(enr, 0, 0.5)).toEqual({ coups: [], suivant: 0 });
    const dus = coupsDus(enr, 0, 2);
    expect([dus.coups.length, dus.suivant]).toEqual([3, 3]);
    expect(coupsDus(enr, 3, 10).suivant).toBe(4);
  });
});

/* ---------- Dans le jeu ---------- */
let nav: Navigateur;
afterEach(() => nav?.fermer());

const TOUCHE: Record<string, string[]> = {
  L: ["KeyS", "KeyW", "KeyW", "Space"],
  R: ["KeyJ", "KeyK", "KeyL", "Semicolon"],
};
const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm * nav.jeu.state.vitessePartie) / 60;
const spb = () => 60 / (nav.jeu.state.song.bpm * nav.jeu.state.vitessePartie);

interface Geste {
  beat: number;
  code: string;
  presser: boolean;
}
/**
 * Un joueur imparfait, image par image : il saute une note sur quatre, joue une note sur cinq en retard (« Bien »),
 * tire une fois dans le vide, et improvise quatre notes au solo.
 */
function partieImparfaite(notes: Note[], solo?: number): Geste[] {
  const gestes: Geste[] = [];
  notes.forEach((ev, i) => {
    if (i % 4 === 3) return;
    const retard = i % 5 === 1 ? 0.1 / spb() : 0;
    for (const a of appuis(ev)) {
      const code = TOUCHE[ev.hand][a.lane];
      gestes.push({ beat: a.beat + retard, code, presser: true });
      gestes.push({ beat: a.fin ?? a.beat + retard + 0.25, code, presser: false });
    }
  });
  if (solo !== undefined) {
    gestes.push({ beat: 1, code: "KeyL", presser: true }, { beat: 1.25, code: "KeyL", presser: false });
    ["KeyJ", "KeyK", "KeyL", "KeyJ"].forEach((code, k) =>
      gestes.push({ beat: solo + k, code, presser: true }, { beat: solo + k + 0.25, code, presser: false }),
    );
    // Une pause au milieu du tunnel du solo, tenu par la main gauche : il est réussi
    gestes.push({ beat: solo + 2.5, code: "pause", presser: true });
  }
  return gestes.sort((a, b) => a.beat - b.beat || +a.presser - +b.presser);
}
// Chaque geste à la première image qui suit son temps, ou à la milliseconde près, entre deux images
async function jouer(gestes: Geste[], entreDeuxImages: boolean) {
  for (const g of gestes) {
    while (temps() < g.beat) nav.image(entreDeuxImages && (g.beat - temps()) * spb() < 0.02 ? 0.001 : 1 / 60);
    if (g.code === "pause") {
      nav.presser("Escape");
      nav.presser("Space");
      await nav.promesses();
    } else if (g.presser) nav.presser(g.code);
    else nav.relacher(g.code);
  }
}

/** Ce qu'on entend et voit d'une partie : l'état de chaque note de la partie, les compteurs, et chaque son programmé
 * à son heure depuis le départ de la chanson */
function trace(depuis: number) {
  const S = nav.jeu.state;
  return {
    notes: S.ev.map((ev) => `${ev.hand}${ev.lane}@${ev.beat}:${ev.state}${ev.reprise ? "*" : ""}`),
    compteurs: [S.score, S.perfect, S.good, S.miss, S.maxCombo],
    sons: nav.horloge.sons
      .slice(depuis)
      .map((s) => Math.round((s.debut - S.t0) * 1e6) / 1e6)
      .sort((a, b) => a - b),
  };
}

/** Mène la partie, ou la réécoute, jusqu'à l'écran de fin, et renvoie sa trace prise juste avant : la réécoute
 * rend ensuite à l'écran de fin le bilan de la partie */
function auBout(depuis = 0) {
  const S = nav.jeu.state;
  nav.avancerJusqua((s) => s.mode !== "play" || temps() >= S.song.endBeat - 0.1, 60);
  const t = trace(depuis);
  nav.avancerJusqua((s) => s.mode !== "play", 5);
  expect(S.mode).toBe("done");
  return t;
}

async function ouvrirEssai() {
  nav = await Navigateur.ouvrir({ adresse: { search: "?essai=reecoute" } });
  return { S: nav.jeu.state, reecoute: await import("../src/jeu/reecoute") };
}

describe("réécouter sa partie", () => {
  // La réécoute ne voit les coups qu'aux images, mais les fait sonner à l'heure exacte où ils ont été joués. Seul
  // le bruit d'un obstacle raté (deux sons) vient à l'image où on le voit passer, et peut glisser d'une image.
  it.each([
    ["aux images", false],
    ["entre deux images", true],
  ])(
    "rejoue les coups du joueur, joués %s : les mêmes notes aux mêmes moments, sans les ratées, solo repris compris",
    async (_, entreDeuxImages) => {
      const { S, reecoute } = await ouvrirEssai();
      const debut = nav.horloge.sons.length;
      nav.presser("Space");
      // Jusqu'à la fin du solo, puis le refrain avec la phrase reprise, dans les notes de la partie
      const { start, bars } = S.song.sections.find((s) => s.kind === "pont"),
        fin = (start + bars) * 4;
      await jouer(
        partieImparfaite(
          S.ev.filter((ev) => ev.beat < fin),
          start * 4,
        ).filter((g) => g.beat < fin),
        entreDeuxImages,
      );
      nav.avancerJusqua((s) => s.reprise.faite, 30);
      await jouer(partieImparfaite(S.ev.filter((ev) => ev.beat >= fin)), entreDeuxImages);
      const partie = auBout(debut),
        enr = reecoute.dernierePartie(),
        ecranDeFin = nav.overlay.innerHTML;
      // Une vraie partie : des Parfait, des Bien, des ratés, et la phrase du solo reprise au refrain
      expect(S.perfect * S.good * S.miss).toBeGreaterThan(0);
      expect(S.ev.some((ev) => ev.reprise && ev.state === "hit")).toBe(true);
      expect(enr.finie).toBe(true);
      expect(enr.coups.filter((c) => c.geste === "pause")).toHaveLength(1);
      expect(S.ev.some((ev) => ev.hand === "L" && ev.dur > 0 && ev.state === "done")).toBe(true);
      expect(enr.coups.some((c) => c.geste === "appui" && c.resultat === "bien")).toBe(true);
      expect(enr.coups.some((c) => c.geste === "appui" && !c.resultat)).toBe(true);
      expect(nav.overlay.innerHTML).toContain('data-act="reecouter"');
      expect(nav.overlay.innerHTML).toContain("Réécouter ma partie");

      const debutReecoute = nav.horloge.sons.length;
      nav.presser("KeyR");
      expect([S.mode, !!S.relecture]).toEqual(["play", true]);
      nav.image();
      expect(nav.textes.some((t) => t.includes("RÉÉCOUTE"))).toBe(true);
      const reecoutee = auBout(debutReecoute);
      expect(S.relecture).toBeNull();
      expect({ ...reecoutee, sons: [] }).toEqual({ ...partie, sons: [] });
      expect(reecoutee.sons.length).toBe(partie.sons.length);
      const decales = reecoutee.sons.filter((t, i) => t !== partie.sons[i]).length;
      expect(decales).toBeLessThanOrEqual(entreDeuxImages ? 2 * S.parMain.L.miss : 0);
      expect(reecoutee.sons.every((t, i) => Math.abs(t - partie.sons[i]) < 1 / 60)).toBe(true);
      // Rejouée, la partie redonne les mêmes coups avec les mêmes résultats ; on peut la réécouter encore
      expect(S.enregistrement.coups).toEqual(enr.coups);
      expect(reecoute.dernierePartie()).toBe(enr);
      expect(nav.overlay.innerHTML).toBe(ecranDeFin);
    },
  );

  it("une partie d'auto-play se réécoute à l'identique", async () => {
    const { S } = await ouvrirEssai();
    const debut = nav.horloge.sons.length;
    nav.presser("KeyA");
    const partie = auBout(debut);
    expect(partie.compteurs[3]).toBe(0);
    expect(nav.overlay.innerHTML).toContain("Réécouter la partie");

    const debutReecoute = nav.horloge.sons.length;
    nav.toucherBouton("reecouter");
    expect([S.mode, S.auto, !!S.relecture]).toEqual(["play", true, true]);
    expect(auBout(debutReecoute)).toEqual(partie);
  });

  it("une mort suivie d'une reprise, puis l'auto-play pris en cours : la réécoute suit la partie gardée", async () => {
    const { S, reecoute } = await ouvrirEssai();
    nav.presser("Space");
    nav.avancerJusqua((s) => s.mode === "dead", 60);
    const b0 = S.cp.sec.start * 4;
    nav.presser("KeyR");
    nav.avancerJusqua(() => temps() >= b0 + 2, 30);
    nav.presser("KeyA");
    // Une pause, et les mains changées pendant la pause, s'enregistrent aussi
    nav.avancerJusqua(() => temps() >= b0 + 6, 30);
    nav.presser("Escape");
    nav.jeu.setPractice("R");
    nav.presser("Space");
    await nav.promesses();
    const partie = auBout();
    expect(reecoute.dernierePartie().coups.map((c) => c.geste)).toEqual(["reprise", "auto", "pause", "mains"]);

    nav.presser("KeyR");
    // Pas de mort dans la réécoute : la reprise remet l'harmonie au début de la section. Avant elle, les notes
    // gardent leur jugement d'avant la mort, au lieu d'être passées comme dans le décompte de la reprise.
    const reecoutee = auBout(),
      apres = (n: string) => +n.split("@")[1].split(":")[0] >= b0;
    expect(reecoutee.compteurs).toEqual(partie.compteurs);
    expect(reecoutee.notes.filter(apres)).toEqual(partie.notes.filter(apres));
  });

  it("se met en pause et se quitte ; les touches du joueur n'y jouent pas, et l'écran de fin revient intact", async () => {
    const { S } = await ouvrirEssai();
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.mode !== "play", 60);
    nav.jeu.setPractice("R");
    const fin = nav.overlay.innerHTML,
      score = S.score;

    nav.presser("KeyR");
    // La réécoute garde les mains de la partie ; un choix fait pendant elle vaudra en la quittant
    expect([S.practice, S.auto]).toEqual(["both", true]);
    nav.avancerJusqua(() => temps() >= 6, 30);
    nav.presser("KeyA");
    nav.presser("KeyJ");
    expect([S.auto, S.keys.couloir0, S.enregistrement.coups]).toEqual([true, undefined, []]);
    nav.jeu.setPractice("L");
    expect(S.practice).toBe("both");

    nav.presser("Escape");
    expect(S.mode).toBe("pause");
    expect(nav.overlay.innerHTML).toContain("Quitter la réécoute");
    expect(nav.overlay.innerHTML).not.toContain('data-act="restart"');
    nav.presser("Space");
    await nav.promesses();
    expect(S.mode).toBe("play");
    nav.image();
    nav.presser("Escape");
    nav.presser("Enter");

    expect([S.mode, S.relecture, S.practice, S.score, S.ev]).toEqual(["done", null, "L", score, []]);
    expect(nav.overlay.innerHTML).toBe(fin);
  });

  it("une partie en boucle ne s'enregistre pas ; une autre chanson fait oublier la dernière partie", async () => {
    const { S } = await ouvrirEssai();
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.mode !== "play", 60);
    expect(nav.overlay.innerHTML).toContain('data-act="reecouter"');
    nav.jeu.setBoucle(1);
    nav.presser("Enter");
    expect([S.enregistrement, S.bouclePartie?.sec.kind]).toEqual([null, "couplet"]);
    nav.presser("Escape");
    nav.presser("KeyB");
    expect(S.mode).toBe("done");
    expect(nav.overlay.innerHTML).not.toContain('data-act="reecouter"');

    nav.jeu.load(7, "facile");
    nav.presser("KeyR");
    expect(S.mode).toBe("title");
  });
});
