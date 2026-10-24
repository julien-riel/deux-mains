// L'éditeur de partitions (#28, ADR-0016) : les opérations de la grille (logique pure), les compositions dans la
// sauvegarde (nouvelle version du document, ADR-0014), puis le parcours dans le faux navigateur : l'essai de
// l'éditeur, l'écoute, le retour, et le meilleur score rangé sous p:empreinte, jamais sous une clé de graine.

import { afterEach, describe, expect, it } from "vitest";
import { composer, empreinteDe, estSoloLibre, lirePartition, type Partition } from "../src/chanson/partition";
import { partitionExemple } from "../src/essais/registre";
import {
  CHOIX_DE_GENRE,
  LIGNES,
  ajouterMesure,
  ajouterSection,
  changerDivision,
  changerGenre,
  deplacerSection,
  lireCase,
  motifsDeLaMesure,
  partitionNeuve,
  regler,
  retirerMesure,
  retirerSection,
  toucher,
} from "../src/jeu/editeur";
import { decoder, encoder, encoderPartition } from "../src/sauvegarde/code";
import {
  MAX_COMPOSITIONS,
  VERSION,
  clePartition,
  compositions,
  fusionner,
  lireDocument,
  noterReussite,
  rangerComposition,
  retirerComposition,
  sauvegardeVide,
} from "../src/sauvegarde/format";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

// Les lignes de la grille : 0 à 3 les couloirs (octave à fondamentale), 4 sauter, 5 glisser
const [OCTAVE, QUINTE, , FOND, SAUTER, GLISSER] = [0, 1, 2, 3, 4, 5];
const couplet = (p: Partition) => p.sections[1];
// Une partition qui écrit un pont en mains croisées (#21), comme avant ADR-0019, et son code de partage
const PONT_CROISE: Partition = {
  v: 1,
  titre: "Pont croisé",
  ton: 7,
  bpm: 112,
  diff: "facile",
  prog: "I–V–vi–IV",
  sections: [
    { genre: "intro", mesures: 1, basse: ["S......."], melodie: [] },
    { genre: "pont", mesures: 2, basse: ["S...W..."], melodie: ["0.1.2.3.", "3.2.1.0."], croisee: true },
    { genre: "outro", mesures: 1, basse: ["S......."], melodie: ["0-------"] },
  ],
};
const CODE_PONT_CROISE =
  "DMP1.eyJ2IjoxLCJ0aXRyZSI6IlBvbnQgY3JvaXPDqSIsInRvbiI6NywiYnBtIjoxMTIsImRpZmYiOiJmYWNpbGUiLCJwcm9nIjoiSeKAk1bigJN2aeKAk0lWIiwic2VjdGlvbnMiOlt7ImdlbnJlIjoiaW50cm8iLCJtZXN1cmVzIjoxLCJiYXNzZSI6WyJTLi4uLi4uLiJdLCJtZWxvZGllIjpbXX0seyJnZW5yZSI6InBvbnQiLCJtZXN1cmVzIjoyLCJiYXNzZSI6WyJTLi4uVy4uLiJdLCJtZWxvZGllIjpbIjAuMS4yLjMuIiwiMy4yLjEuMC4iXSwiY3JvaXNlZSI6dHJ1ZX0seyJnZW5yZSI6Im91dHJvIiwibWVzdXJlcyI6MSwiYmFzc2UiOlsiUy4uLi4uLi4iXSwibWVsb2RpZSI6WyIwLS0tLS0tLSJdfV19";

describe("la grille de l'éditeur", () => {
  it("un cylindre neuf est une partition valide et vide : intro, couplet de quatre mesures, outro", () => {
    const p = partitionNeuve("Essai");
    expect(lirePartition(p)).toEqual(p);
    expect(p.sections.map((s) => [s.genre, s.mesures])).toEqual([
      ["intro", 1],
      ["couplet", 4],
      ["outro", 1],
    ]);
    expect(composer(p).ev).toEqual([]);
    expect(LIGNES.map((l) => l.signe)).toEqual(["3", "2", "1", "0", "W", "S"]);
  });

  it("toucher une case vide pose la note de sa ligne, la toucher encore la retire ; l'ancienne partition reste", () => {
    const p = partitionNeuve(),
      a = toucher(p, 1, 0, QUINTE, 2, "note");
    expect(couplet(a).melodie[0]).toBe("..2.....");
    expect(couplet(p).melodie[0]).toBe("........");
    expect(lireCase(couplet(a).melodie[0], QUINTE, 2)).toEqual({ etat: "note", signe: "2" });
    expect(lireCase(couplet(a).melodie[0], OCTAVE, 2)).toEqual({ etat: "vide" });
    // Une note par croche et par main : l'octave remplace la quinte
    const b = toucher(a, 1, 0, OCTAVE, 2, "note");
    expect(couplet(b).melodie[0]).toBe("..3.....");
    expect(couplet(toucher(b, 1, 0, OCTAVE, 2, "note")).melodie[0]).toBe("........");
    // La basse : sauter, puis glisser à la même croche
    const c = toucher(toucher(p, 1, 3, SAUTER, 4, "note"), 1, 3, GLISSER, 4, "note");
    expect(couplet(c).basse[3]).toBe("....S...");
    // Les notes posées jouent les degrés de l'accord (ADR-0003)
    const ch = composer(a).chords[1];
    expect(composer(a).ev.map((e) => [e.beat, e.midi])).toEqual([[5, ch.lanes[2]]]);
  });

  it("l'outil tenue allonge la note de sa ligne jusqu'à la case ; toucher la tenue la coupe", () => {
    let p = toucher(partitionNeuve(), 1, 0, FOND, 1, "note");
    p = toucher(p, 1, 0, FOND, 4, "tenue");
    expect(couplet(p).melodie[0]).toBe(".0---...");
    expect(lireCase(couplet(p).melodie[0], FOND, 3)).toEqual({ etat: "suite" });
    expect(composer(p).ev[0].dur).toBe(2);
    // Raccourcir avec la tenue, puis couper avec l'outil note
    expect(couplet(toucher(p, 1, 0, FOND, 2, "tenue")).melodie[0]).toBe(".0-.....");
    expect(couplet(toucher(p, 1, 0, FOND, 3, "note")).melodie[0]).toBe(".0-.....");
    // Une note posée au milieu d'une tenue la coupe et ne la prolonge pas
    expect(couplet(toucher(p, 1, 0, QUINTE, 2, "note")).melodie[0]).toBe(".02.....");
    // Sans note à allonger dans la ligne, la tenue pose une note
    expect(couplet(toucher(p, 1, 0, OCTAVE, 6, "tenue")).melodie[0]).toBe(".0---.3.");
    // Glisser devient tunnel ; coupé à une croche, il redevient glisser ; sauter ne se tient pas
    let b = toucher(partitionNeuve(), 1, 0, GLISSER, 0, "note");
    b = toucher(b, 1, 0, GLISSER, 3, "tenue");
    expect(couplet(b).basse[0]).toBe("T---....");
    expect(couplet(toucher(b, 1, 0, GLISSER, 1, "note")).basse[0]).toBe("S.......");
    const w = toucher(toucher(partitionNeuve(), 1, 0, SAUTER, 0, "note"), 1, 0, SAUTER, 2, "tenue");
    expect(couplet(w).basse[0]).toBe("W.W.....");
    // Une pente descendante (écrite dans un code) s'allonge sur la ligne sauter
    const pente = {
      ...partitionNeuve(),
      sections: [{ genre: "couplet" as const, mesures: 1, basse: ["B-......"], melodie: [] }],
    };
    expect(toucher(pente, 0, 0, SAUTER, 4, "tenue").sections[0].basse[0]).toBe("B----...");
  });

  it("au solo libre, la mélodie ne s'écrit pas ; passer en solo l'efface, en sortir rend une mélodie vide", () => {
    let p = toucher(partitionNeuve(), 1, 0, QUINTE, 0, "note");
    p = changerGenre(p, 1, "pont");
    expect([estSoloLibre(couplet(p)), couplet(p).melodie]).toEqual([true, []]);
    expect(toucher(p, 1, 0, QUINTE, 0, "note")).toBe(p);
    expect(changerDivision(p, 1, 0, "R")).toBe(p);
    expect(couplet(toucher(p, 1, 0, GLISSER, 0, "note")).melodie).toEqual([]);
    expect(lirePartition(ajouterMesure(p, 1))).not.toBeNull();
  });

  it("les mains croisées ne se choisissent plus ; un pont écrit en mains croisées s'affiche comme un pont (ADR-0019)", () => {
    expect(CHOIX_DE_GENRE.map((c) => c.choix)).toEqual(["intro", "couplet", "refrain", "pont", "polyrythmie", "outro"]);
    expect(CHOIX_DE_GENRE.map((c) => c.nom)).not.toContain("Mains croisées");
    const p = lirePartition(PONT_CROISE),
      pont = p.sections[1];
    expect([pont.genre, pont.croisee, CHOIX_DE_GENRE.find((c) => c.choix === pont.genre).nom]).toEqual([
      "pont",
      true,
      "Solo libre",
    ]);
    // Sa mélodie écrite reste modifiable ; changer son genre lui retire sa marque
    expect(toucher(p, 1, 0, QUINTE, 1, "note").sections[1]).toMatchObject({
      croisee: true,
      melodie: ["021.2.3.", "3.2.1.0."],
    });
    expect(changerGenre(p, 1, "refrain").sections[1]).not.toHaveProperty("croisee");
    expect(changerGenre(p, 1, "pont").sections[1]).toMatchObject({ genre: "pont", melodie: [] });
  });

  it("passer une main en triolets ne garde que les notes sur les temps, en notes simples (ADR-0013)", () => {
    const p = {
      ...partitionNeuve(),
      sections: [{ genre: "couplet" as const, mesures: 1, basse: ["T-.WS.W."], melodie: ["0-1.2.3a"] }],
    };
    const t = changerDivision(p, 0, 0, "L");
    expect(t.sections[0].basse[0]).toBe("S.....S..W..");
    expect(t.sections[0].melodie[0]).toBe("0-1.2.3a");
    expect(changerDivision(t, 0, 0, "L").sections[0].basse[0]).toBe("S...S.W.");
    expect(changerDivision(p, 0, 0, "R").sections[0].melodie[0]).toBe("0..1..2..3..");
    // Les deux mains de la mesure se lisent chacune dans sa division
    expect(motifsDeLaMesure(t.sections[0], 0)).toEqual({ basse: "S.....S..W..", melodie: "0-1.2.3a" });
    expect(lirePartition(t)).not.toBeNull();
  });

  it("mesures et sections s'ajoutent, se retirent et se déplacent, dans les limites de la notation", () => {
    const p = partitionNeuve();
    expect(couplet(ajouterMesure(p, 1)).mesures).toBe(5);
    expect(couplet(retirerMesure(p, 1)).mesures).toBe(3);
    expect(retirerMesure(retirerMesure(retirerMesure(p, 1), 1), 1).sections[1].mesures).toBe(1);
    const une = { ...p, sections: [p.sections[0]] };
    expect(retirerMesure(une, 0)).toBe(une);
    expect(retirerSection(une, 0)).toBe(une);
    const r = ajouterSection(p, 1, "refrain");
    expect(r.sections.map((s) => s.genre)).toEqual(["intro", "couplet", "refrain", "outro"]);
    expect(retirerSection(r, 2).sections.map((s) => s.genre)).toEqual(["intro", "couplet", "outro"]);
    expect(deplacerSection(r, 2, -1).sections.map((s) => s.genre)).toEqual(["intro", "refrain", "couplet", "outro"]);
    expect(deplacerSection(r, 0, -1)).toBe(r);
    // Une section a au plus 32 mesures, une partition 64 et 16 sections
    let pleine = p;
    for (let i = 0; i < 40; i++) pleine = ajouterMesure(pleine, 1);
    expect(couplet(pleine).mesures).toBe(32);
    for (let i = 0; i < 20; i++) pleine = ajouterSection(pleine, 1);
    expect(pleine.sections.reduce((n, s) => n + s.mesures, 0)).toBe(64);
    expect(ajouterSection(pleine, 1)).toBe(pleine);
    expect(ajouterMesure(pleine, 0)).toBe(pleine);
    expect(lirePartition(pleine)).not.toBeNull();
  });

  it("les réglages sont ramenés dans leurs limites, une valeur inconnue est ignorée", () => {
    const p = partitionNeuve();
    expect(regler(p, "titre", "x".repeat(50)).titre).toHaveLength(40);
    expect(regler(p, "ton", "14").ton).toBe(2);
    expect(regler(p, "bpm", "300").bpm).toBe(180);
    expect(regler(p, "bpm", "10").bpm).toBe(60);
    expect(regler(p, "bpm", "abc").bpm).toBe(p.bpm);
    expect(regler(p, "diff", "difficile").diff).toBe("difficile");
    expect(regler(p, "diff", "extreme").diff).toBe(p.diff);
    expect(regler(p, "prog", "Vamp dorien").prog).toBe("Vamp dorien");
    expect(regler(p, "prog", "Bossa nova").prog).toBe(p.prog);
  });
});

describe("les compositions dans la sauvegarde (ADR-0014)", () => {
  it("un document de la version 1 migre vers la version actuelle, sans composition", () => {
    const v1 = JSON.stringify({ v: 1, carte: { ville: ["Royal Road"] }, chansons: {} });
    expect(VERSION).toBeGreaterThanOrEqual(2);
    expect(lireDocument(v1)).toEqual({
      etat: "ok",
      doc: { v: VERSION, carte: { ville: ["Royal Road"] }, chansons: {} },
    });
  });

  it("les compositions sont rangées sous leur empreinte recalculée ; une composition illisible est laissée", () => {
    const p = partitionExemple(),
      texte = JSON.stringify({ v: 2, carte: {}, chansons: {}, compositions: { faux: p, autre: { v: 1 }, x: 3 } });
    expect(lireDocument(texte).doc.compositions).toEqual({ [empreinteDe(p)]: p });
    expect(lireDocument(JSON.stringify({ v: 2, carte: {}, chansons: {}, compositions: "non" })).doc).toEqual(
      sauvegardeVide(),
    );
  });

  it("ranger remplace la version d'où vient le brouillon, retirer l'enlève, le maximum est tenu", () => {
    const p = partitionExemple(),
      q = { ...p, titre: "Valse du grenier, reprise" };
    let doc = rangerComposition(sauvegardeVide(), p);
    expect(compositions(doc)).toEqual([p]);
    doc = rangerComposition(doc, q, empreinteDe(p));
    expect(compositions(doc)).toEqual([q]);
    doc = rangerComposition(doc, p);
    expect(compositions(doc)).toEqual([q, p]);
    expect(compositions(retirerComposition(doc, empreinteDe(q)))).toEqual([p]);
    expect(retirerComposition(retirerComposition(doc, empreinteDe(q)), empreinteDe(p))).toEqual(sauvegardeVide());
    let plein = sauvegardeVide();
    for (let i = 0; i < MAX_COMPOSITIONS; i++) plein = rangerComposition(plein, { ...p, titre: `n° ${i}` });
    expect(rangerComposition(plein, { ...p, titre: "de trop" })).toBeNull();
    // Ranger à nouveau une composition déjà rangée ne compte pas en plus
    expect(rangerComposition(plein, { ...p, titre: "n° 3" })).not.toBeNull();
  });

  it("le code de sauvegarde garde les compositions ; fusionner les additionne sans doublon", () => {
    const p = partitionExemple(),
      q = { ...p, titre: "Autre" },
      ici = rangerComposition(sauvegardeVide(), p),
      ailleurs = rangerComposition(rangerComposition(sauvegardeVide(), p), q);
    expect(decoder(encoder(ici))).toEqual({ etat: "ok", doc: ici });
    expect(compositions(fusionner(ici, ailleurs))).toEqual([p, q]);
    expect(fusionner(sauvegardeVide(), sauvegardeVide()).compositions).toBeUndefined();
  });

  it("une composition garde son meilleur score sous p:empreinte, sans réussir de lieu", () => {
    const cle = clePartition("abc");
    let { doc, progres } = noterReussite(sauvegardeVide(), { univers: "boite", cle, score: 500 });
    expect([doc.chansons, doc.carte, progres]).toEqual([
      { "p:abc": { meilleur: 500 } },
      {},
      { lieu: null, record: true },
    ]);
    ({ doc, progres } = noterReussite(doc, { univers: "boite", cle, score: 400 }));
    expect([doc.chansons[cle].meilleur, progres.record]).toEqual([500, false]);
  });
});

describe("l'éditeur dans le jeu", () => {
  it("l'essai ouvre l'éditeur sur l'exemple ; on y écrit, on range dans la progression fictive, on écoute", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=editeur" } });
    const S = nav.jeu.state;
    expect([S.mode, S.essai.essai.id, S.theme, S.editeur.partition]).toEqual([
      "editeur",
      "editeur",
      "boite",
      partitionExemple(),
    ]);
    expect(nav.overlay.innerHTML).toContain("Le cylindre à perforer");
    expect(nav.overlay.innerHTML).toContain('value="Valse du grenier"');
    expect(nav.overlay.innerHTML).toContain('data-act="ed-case"');

    // Planter un picot à la tierce, première croche de la deuxième mesure du couplet
    expect(S.editeur.section).toBe(1);
    nav.toucherBouton("ed-case", { mesure: "1", ligne: "2", k: "1" });
    expect(couplet(S.editeur.partition).melodie[1]).toBe("211.0...");
    // Un titre qui contient du HTML est échappé
    nav.overlay.emettre("change", { target: { dataset: { champ: "titre" }, value: "<b>Ma valse</b>" } });
    expect(nav.overlay.innerHTML).toContain("&lt;b&gt;Ma valse&lt;/b&gt;");
    nav.overlay.emettre("change", { target: { dataset: { champ: "bpm" }, value: "120" } });
    nav.toucherBouton("ed-plus");
    expect([S.editeur.partition.bpm, couplet(S.editeur.partition).mesures]).toEqual([120, 5]);

    // Ranger : la progression fictive de l'essai le garde, la vraie sauvegarde n'est pas écrite
    nav.toucherBouton("ed-ranger");
    expect(compositions(S.essai.sauvegarde)).toEqual([S.editeur.partition]);
    expect(nav.stockage.get("deux-mains-sauvegarde")).toBeUndefined();

    // Le code de partage, puis un code collé qui remplace le brouillon
    nav.toucherBouton("ed-rangement");
    expect(nav.overlay.innerHTML).toContain(encoderPartition(S.editeur.partition));
    nav.trouver("#code-partition-colle").value = encoderPartition(partitionExemple());
    nav.toucherBouton("ed-coller");
    expect([S.editeur.partition, S.editeur.vue]).toEqual([partitionExemple(), "grille"]);
    nav.trouver("#code-partition-colle").value = "DMP1.abimé";
    nav.toucherBouton("ed-rangement");
    nav.toucherBouton("ed-coller");
    expect(S.editeur.message).toContain("pas un code de partition valide");

    // Écouter : la composition s'installe et l'auto-play la joue sans faute
    nav.presser("Escape");
    expect([S.mode, S.editeur.vue]).toEqual(["editeur", "grille"]);
    nav.presser("KeyA");
    expect([S.mode, S.song.source]).toEqual([
      "play",
      { genre: "partition", empreinte: empreinteDe(partitionExemple()), titre: "Valse du grenier" },
    ]);
    nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
    expect([S.mode, S.miss, S.health]).toEqual(["done", 0, 100]);
    expect(nav.overlay.innerHTML).toContain("Essai terminé");
    expect(nav.overlay.innerHTML).toContain('data-act="editeur"');
    nav.presser("KeyP");
    expect(S.mode).toBe("editeur");

    // Quitter les essais oublie le brouillon d'exemple et rend la chanson du joueur
    nav.presser("Escape");
    nav.presser("Escape");
    expect([S.essai, S.editeur, S.song.source?.genre]).toEqual([null, null, "graine"]);
  });

  it("hors essai : P ouvre la console, une composition jouée garde son score sous p:empreinte et rend la difficulté", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-diff": "difficile", "deux-mains-theme": "ville" } });
    const S = nav.jeu.state,
      graine = S.seed;
    nav.presser("KeyP");
    expect([S.mode, S.editeur.partition]).toEqual(["editeur", partitionNeuve()]);
    expect(nav.overlay.innerHTML).toContain("La console de la radio pirate");

    // Une courte composition : une mesure, une note par main
    S.editeur.partition = {
      ...partitionNeuve("Courte"),
      diff: "facile",
      sections: [{ genre: "couplet", mesures: 1, basse: ["S......."], melodie: ["..0....."] }],
    };
    nav.presser("Space");
    expect([S.mode, S.diff, S.autoUsed]).toEqual(["play", "facile", false]);
    // L'auto-play joue à la place du joueur sans compter comme tel : la partie reste classée
    S.auto = true;
    nav.avancerJusqua((s) => s.mode !== "play", 20);
    expect(S.mode).toBe("done");
    const cle = clePartition(empreinteDe(S.editeur.partition));
    const doc = JSON.parse(nav.stockage.get("deux-mains-sauvegarde"));
    expect(Object.keys(doc.chansons)).toEqual([cle]);
    expect(doc.carte).toEqual({});
    expect(nav.overlay.innerHTML).toContain("Console · Courte");
    expect(nav.overlay.innerHTML).not.toContain('data-act="suivant"');

    // Retour à l'éditeur, puis à la chanson du joueur, dans sa difficulté
    nav.presser("Escape");
    expect(S.mode).toBe("editeur");
    nav.presser("Escape");
    expect([S.mode, S.seed, S.diff, S.song.source]).toEqual([
      "title",
      graine,
      "difficile",
      { genre: "graine", graine, diff: "difficile" },
    ]);
    expect(nav.stockage.get("deux-mains-diff")).toBe("difficile");
  });

  it("un code DMP1 avec un pont en mains croisées se colle, s'affiche comme un pont et se joue à l'endroit (ADR-0019)", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": "ville" } });
    const S = nav.jeu.state;
    nav.presser("KeyP");
    nav.toucherBouton("ed-rangement");
    nav.trouver("#code-partition-colle").value = CODE_PONT_CROISE;
    nav.toucherBouton("ed-coller");
    expect([S.editeur.partition, S.editeur.vue]).toEqual([lirePartition(PONT_CROISE), "grille"]);
    // Dans les onglets et dans la liste des genres, le pont écrit est un pont ; les mains croisées n'y sont plus
    nav.toucherBouton("ed-section", { section: "1" });
    expect(nav.overlay.innerHTML).toContain('aria-selected="true">Solo libre <small>2</small>');
    expect(nav.overlay.innerHTML).not.toContain("Mains croisées");
    expect(nav.overlay.innerHTML).not.toContain('value="croisee"');

    // Écouter : l'auto-play le joue sans faute, sans annonce ni bascule de la scène, ses notes écrites jouées
    nav.presser("KeyA");
    const textes = new Set<string>(),
      bannieres = new Set<string>();
    nav.avancerJusqua(
      (s) => {
        nav.textes.forEach((t) => textes.add(t));
        if (s.curSec?.croisee && s.banner) bannieres.add(`${s.banner.text} · ${s.banner.sub}`);
        return s.mode !== "play";
      },
      (S.song.endBeat * 60) / S.song.bpm + 10,
    );
    expect([S.mode, S.miss, S.health]).toEqual(["done", 0, 100]);
    expect(S.song.ev.filter((e) => e.hand === "R" && e.bar >= 1 && e.bar < 3).map((e) => e.state)).toEqual(
      Array(8).fill("hit"),
    );
    expect([...textes].filter((t) => /CROIS|ENDROIT|⇅/.test(t))).toEqual([]);
    expect([...bannieres]).toEqual(["Mains croisées · "]);
  });
});
