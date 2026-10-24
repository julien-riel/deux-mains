// Le répertoire (ADR-0018) : des chansons connues du domaine public, écrites en partitions v2. Chaque air est une
// partition valide qui fait entendre sa vraie mélodie ; l'auto-play le joue sans faute ; dans le faux navigateur,
// l'écran du répertoire le prépare dans la difficulté du joueur, range son score sous l'empreinte de sa partition,
// sans réussir de lieu, et l'ouvre dans l'éditeur.

import { afterEach, describe, expect, it } from "vitest";
import { empreinteDe, lirePartition } from "../src/chanson/partition";
import { REPERTOIRE, airDe, composerAir, partitionDe } from "../src/chanson/repertoire";
import { NOTE_FR, PROGS } from "../src/chanson/theorie";
import { clePartition } from "../src/sauvegarde/format";
import { coupsAttendus } from "./support/appuis";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

// La mélodie que fait entendre chaque air, mesure par mesure (les mesures sans mélodie sont sautées), avec les noms
// de notes du jeu (NOTE_FR) : à l'enharmonie près (La♭ pour Sol♯), ce sont les airs qu'on connaît.
const MELODIES: Record<string, string> = {
  "clair-de-lune":
    "Do4 Do4 Do4 Ré4 | Mi4 Ré4 | Do4 Mi4 Ré4 Ré4 | Do4 | Do4 Do4 Do4 Ré4 | Mi4 Ré4 | Do4 Mi4 Ré4 Ré4 | Do4 | Ré5 Ré5 Ré5 Ré5 | La4 La4 | Ré5 Do5 Si4 La4 | Sol4 | Do4 Do4 Do4 Ré4 | Mi4 Ré4 | Do4 Mi4 Ré4 Ré4 | Do4",
  "frere-jacques":
    "Sol4 La4 Si4 Sol4 | Sol4 La4 Si4 Sol4 | Si4 Do5 Ré5 | Si4 Do5 Ré5 | Ré5 Mi5 Ré5 Do5 Si4 Sol4 | Ré5 Mi5 Ré5 Do5 Si4 Sol4 | Sol4 Ré4 Sol4 | Sol4 Ré4 Sol4 | Sol4 La4 Si4 Sol4 | Sol4 La4 Si4 Sol4 | Si4 Do5 Ré5 | Si4 Do5 Ré5 | Ré5 Mi5 Ré5 Do5 Si4 Sol4 | Ré5 Mi5 Ré5 Do5 Si4 Sol4 | Sol4 Ré4 Sol4 | Sol4 Ré4 Sol4",
  "vous-dirai-je":
    "Ré4 Ré4 La4 La4 | Si4 Si4 La4 | Sol4 Sol4 Fa♯4 Fa♯4 | Mi4 Mi4 Ré4 | La4 La4 Sol4 Sol4 | Fa♯4 Fa♯4 Mi4 | La4 La4 Sol4 Sol4 | Fa♯4 Fa♯4 Mi4 | Ré4 Ré4 La4 La4 | Si4 Si4 La4 | Sol4 Sol4 Fa♯4 Fa♯4 | Mi4 Mi4 Ré4",
  "ode-joie":
    "Fa♯4 Fa♯4 Sol4 La4 | La4 Sol4 Fa♯4 Mi4 | Ré4 Ré4 Mi4 Fa♯4 | Fa♯4 Mi4 Mi4 | Fa♯4 Fa♯4 Sol4 La4 | La4 Sol4 Fa♯4 Mi4 | Ré4 Ré4 Mi4 Fa♯4 | Mi4 Ré4 Ré4 | Mi4 Mi4 Fa♯4 Ré4 | Mi4 Fa♯4 Sol4 Fa♯4 Ré4 | Mi4 Fa♯4 Sol4 Fa♯4 Mi4 | Ré4 Mi4 La4 | Fa♯4 Fa♯4 Sol4 La4 | La4 Sol4 Fa♯4 Mi4 | Ré4 Ré4 Mi4 Fa♯4 | Mi4 Ré4 Ré4",
  saints:
    "Mi♭4 Sol4 La♭4 | Si♭4 | Mi♭4 Sol4 La♭4 | Si♭4 | Mi♭4 Sol4 La♭4 | Si♭4 Sol4 | Mi♭4 Sol4 | Fa4 | Sol4 Sol4 Fa4 | Mi♭4 Mi♭4 | Sol4 Si♭4 Si♭4 | La♭4 | Mi♭4 Sol4 La♭4 | Si♭4 Sol4 | Mi♭4 Fa4 | Mi♭4",
  "jingle-bells":
    "La4 La4 La4 | La4 La4 La4 | La4 Do5 Fa4 Sol4 | La4 | Si♭4 Si♭4 Si♭4 Si♭4 | Si♭4 La4 La4 La4 La4 | La4 Sol4 Sol4 La4 | Sol4 Do5 | La4 La4 La4 | La4 La4 La4 | La4 Do5 Fa4 Sol4 | La4 | Si♭4 Si♭4 Si♭4 Si♭4 | Si♭4 La4 La4 La4 La4 | Do5 Do5 Si♭4 Sol4 | Fa4",
  marin:
    "La4 La4 La4 La4 La4 La4 | La4 Ré4 Fa4 La4 | Sol4 Sol4 Sol4 Sol4 Sol4 Sol4 | Sol4 Do4 Mi4 Sol4 | La4 La4 La4 La4 La4 La4 | La4 Si4 Do5 Ré5 | Do5 La4 Sol4 Mi4 | Ré4 Ré4 | La4 La4 | La4 Ré4 Fa4 La4 | Sol4 Sol4 | Sol4 Do4 Mi4 Sol4 | La4 La4 | La4 Si4 Do5 Ré5 | Do5 La4 Sol4 Mi4 | Ré4 Ré4",
  "roi-montagne":
    "Mi4 Fa♯4 Sol4 La4 | Si4 Sol4 Si4 | Si♭4 Fa♯4 Si♭4 | La4 Fa4 La4 | Mi4 Fa♯4 Sol4 La4 | Si4 Sol4 Si4 Mi5 | Ré5 Si4 Sol4 Si4 | Ré5 | Mi4 Fa♯4 Sol4 La4 | Si4 Sol4 Si4 | Si♭4 Fa♯4 Si♭4 | La4 Fa4 La4 | Mi4 Fa♯4 Sol4 La4 | Si4 Sol4 Si4 Mi5 | Ré5 Si4 Sol4 Si4 | Ré5",
  korobeiniki:
    "Do♯5 La♭4 La4 Si4 La4 La♭4 | Fa♯4 Fa♯4 La4 Do♯5 Si4 La4 | La♭4 La4 Si4 Do♯5 | La4 Fa♯4 Fa♯4 | Si4 Ré5 Fa♯5 Mi5 Ré5 | Do♯5 La4 Do♯5 Si4 La4 | La♭4 La♭4 La4 Si4 Do♯5 | La4 Fa♯4 Fa♯4 | Do♯5 La4 | Si4 La♭4 | La4 Fa♯4 | Fa4 La♭4 | Do♯5 La4 | Si4 La♭4 | La4 Do♯5 Fa♯5 | Fa4 | Do♯5 La♭4 La4 Si4 La4 La♭4 | Fa♯4 Fa♯4 La4 Do♯5 Si4 La4 | La♭4 La4 Si4 Do♯5 | La4 Fa♯4 Fa♯4 | Si4 Ré5 Fa♯5 Mi5 Ré5 | Do♯5 La4 Do♯5 Si4 La4 | La♭4 La♭4 La4 Si4 Do♯5 | La4 Fa♯4 Fa♯4",
};

const melodieDe = (id: string) => {
  const c = composerAir(airDe(id), "normal"),
    mesures: string[] = [];
  for (let b = 0; b < c.totalBars; b++) {
    const notes = c.ev
      .filter((e) => e.hand === "R" && e.bar === b)
      .map((e) => NOTE_FR[e.midi % 12] + (Math.floor(e.midi / 12) - 1));
    if (notes.length) mesures.push(notes.join(" "));
  }
  return mesures.join(" | ");
};

describe("les airs du répertoire", () => {
  it("chacun a un identifiant unique, une origine, et une partition v2 valide sur une progression du jeu", () => {
    const ids = REPERTOIRE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(MELODIES).sort()).toEqual([...ids].sort());
    for (const air of REPERTOIRE) {
      expect(air.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(air.origine.length).toBeGreaterThan(5);
      expect(air.partition.v).toBe(2);
      expect(lirePartition(JSON.parse(JSON.stringify(air.partition)))).toEqual(air.partition);
      expect(PROGS.map((p) => p.name)).toContain(air.partition.prog);
      expect(air.partition.sections.some((s) => s.accords)).toBe(true);
      expect(airDe(air.id)).toBe(air);
    }
    expect(airDe("inconnu")).toBeUndefined();
  });

  it("chaque lieu de la carte a son air : les ennemis et les instruments de tous les lieux y passent", () => {
    expect(new Set(REPERTOIRE.map((a) => a.partition.prog)).size).toBe(PROGS.length);
  });

  it.each(REPERTOIRE.map((a) => [a.id] as const))("%s fait entendre sa vraie mélodie", (id) => {
    expect(melodieDe(id)).toBe(MELODIES[id]);
  });

  it("un air se compose dans une difficulté : mêmes notes, une empreinte par difficulté, et sa source", () => {
    const air = REPERTOIRE[0],
      facile = composerAir(air, "facile"),
      difficile = composerAir(air, "difficile");
    expect(facile.source).toEqual({
      genre: "partition",
      empreinte: empreinteDe(partitionDe(air, "facile")),
      titre: air.partition.titre,
      repertoire: air.id,
    });
    expect(facile.ev.map((e) => [e.beat, e.lane, e.midi])).toEqual(difficile.ev.map((e) => [e.beat, e.lane, e.midi]));
    expect(empreinteDe(partitionDe(air, "facile"))).not.toBe(empreinteDe(partitionDe(air, "difficile")));
    expect(partitionDe(air, "facile")).toEqual({ ...air.partition, diff: "facile" });
    // L'air lui-même n'est pas touché
    expect(air.partition.diff).toBe("normal");
  });
});

describe("le répertoire dans le jeu", () => {
  it.each(REPERTOIRE.map((a) => [a.id] as const))(
    "%s : l'auto-play le joue jusqu'au bout sans rater de note",
    async (id) => {
      nav = await Navigateur.ouvrir();
      const S = nav.jeu.state,
        { chargerAir } = await import("../src/ui/reglages");
      chargerAir(airDe(id), "difficile");
      nav.presser("KeyA");
      expect(S.mode).toBe("play");
      nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
      expect([S.mode, S.miss, S.health, S.perfect]).toEqual(["done", 0, 100, coupsAttendus(S.ev)]);
    },
  );

  it("M ouvre le répertoire, un chiffre prépare l'air dans la difficulté du joueur ; son score se range sans lieu", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-diff": "facile", "deux-mains-theme": "ville" } });
    const S = nav.jeu.state,
      graine = S.seed;
    nav.presser("KeyM");
    expect(S.mode).toBe("repertoire");
    expect(nav.overlay.innerHTML).toContain("Les disques de la radio pirate");
    for (const air of REPERTOIRE) expect(nav.overlay.innerHTML).toContain(air.partition.titre.replace("'", "&#39;"));

    // Le premier air, dans la difficulté du joueur
    const air = REPERTOIRE[0];
    nav.presser("Digit1");
    expect([S.mode, S.diff, S.boucle, S.song.source]).toEqual([
      "title",
      "facile",
      -1,
      composerAir(air, "facile").source,
    ]);
    expect(nav.overlay.innerHTML).toContain(air.origine);
    expect(nav.overlay.innerHTML).toContain('data-act="editer-air"');

    // Joué en auto-play sans être compté comme tel : le score est rangé sous p:empreinte, aucun lieu n'est réussi
    nav.presser("Space");
    S.auto = true;
    nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
    expect(S.mode).toBe("done");
    const cle = clePartition(empreinteDe(partitionDe(air, "facile"))),
      doc = JSON.parse(nav.stockage.get("deux-mains-sauvegarde"));
    expect(Object.keys(doc.chansons)).toEqual([cle]);
    expect(doc.carte).toEqual({});
    expect(nav.overlay.innerHTML).toContain(`Disques · ${air.partition.titre}`);
    expect(nav.overlay.innerHTML).not.toContain('data-act="suivant"');

    // Échap revient au répertoire, qui montre le record ; Échap encore, l'écran de départ de l'air
    nav.presser("Escape");
    expect(S.mode).toBe("repertoire");
    expect(nav.overlay.innerHTML).toContain(`record ${doc.chansons[cle].meilleur.toLocaleString("fr-CA")}`);
    nav.presser("Escape");
    expect(S.mode).toBe("title");

    // Une autre difficulté reprend le même air ; N rend une chanson générée, dans la difficulté choisie
    const { chargerAir } = await import("../src/ui/reglages");
    chargerAir(air, "difficile");
    expect([S.diff, S.song.source]).toEqual(["difficile", composerAir(air, "difficile").source]);
    nav.presser("KeyN");
    expect([S.diff, S.song.source?.genre]).toEqual(["difficile", "graine"]);
    expect(S.seed).not.toBe(graine);
    expect(nav.stockage.get("deux-mains-diff")).toBe("difficile");
  });

  it("P ouvre l'air dans l'éditeur, Échap revient à son écran de départ ; le répertoire ne s'ouvre pas en essai", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": "boite" } });
    const S = nav.jeu.state;
    nav.toucherBouton("repertoire");
    expect(nav.overlay.innerHTML).toContain("Les airs de la boîte");
    nav.toucherBouton("air", { air: "ode-joie" });
    expect(S.song.source).toMatchObject({ repertoire: "ode-joie" });
    nav.presser("KeyP");
    expect([S.mode, S.editeur.partition]).toEqual(["editeur", partitionDe(airDe("ode-joie"), S.diff)]);
    nav.presser("Escape");
    expect([S.mode, S.song.source]).toMatchObject(["title", { repertoire: "ode-joie" }]);
    nav.toucherBouton("fermer-repertoire");
    expect(S.mode).toBe("title");

    // Pendant un essai, le répertoire reste fermé
    nav.toucherBouton("essai", { essai: "double-saut" });
    expect(S.essai).not.toBeNull();
    const { ouvrirRepertoire } = await import("../src/ui/repertoire"),
      avant = S.mode;
    ouvrirRepertoire();
    expect(S.mode).toBe(avant);
  });
});
