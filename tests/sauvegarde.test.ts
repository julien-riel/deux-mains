// La sauvegarde (ADR-0014) : le document versionné, ses migrations, sa réparation, la progression qu'on y note, la
// fusion de deux sauvegardes et le code à copier. Logique pure, sans faux navigateur.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSION_GENERATEUR } from "../src/chanson/generateur";
import { PREFIXE, base64url, decoder, depuisBase64url, encoder } from "../src/sauvegarde/code";
import {
  VERSION,
  cleChanson,
  ecrireDocument,
  fusionner,
  lieuxReussis,
  lireDocument,
  meilleurScore,
  noterReussite,
  sauvegardeVide,
  type Migration,
  type Sauvegarde,
} from "../src/sauvegarde/format";

const exemple = (): Sauvegarde => ({
  v: VERSION,
  carte: { ville: ["I–V–vi–IV", "Royal Road"], boite: ["Vamp dorien"] },
  chansons: { [cleChanson(4242, "normal")]: { meilleur: 48210 } },
});

describe("document de sauvegarde", () => {
  it("rien dans le stockage : une sauvegarde vide, à la version du format", () => {
    for (const texte of [null, ""]) expect(lireDocument(texte)).toEqual({ etat: "vide", doc: sauvegardeVide() });
    expect(sauvegardeVide()).toEqual({ v: VERSION, carte: {}, chansons: {} });
  });

  it("relit à l'identique ce qu'il a écrit", () => {
    const doc = exemple();
    expect(lireDocument(ecrireDocument(doc))).toEqual({ etat: "ok", doc });
  });

  it("un texte qui n'est pas une sauvegarde est illisible : on repart de zéro en gardant le texte", () => {
    for (const texte of ["{oups", "42", "[]", '"texte"', "null", '{"carte":{}}', '{"v":0}', '{"v":"1"}', '{"v":1.5}'])
      expect(lireDocument(texte)).toEqual({ etat: "illisible", doc: sauvegardeVide(), brut: texte });
  });

  it("une sauvegarde abîmée en partie garde ce qui a la bonne forme", () => {
    const texte = JSON.stringify({
      v: 1,
      carte: { ville: ["Royal Road", 3, "Royal Road", null, "Le Port"], boite: "pas une liste" },
      chansons: {
        "g1:1:normal": { meilleur: 1200 },
        "g1:2:normal": { meilleur: -5 },
        "g1:3:normal": { meilleur: "beaucoup" },
        "g1:4:normal": 7,
      },
      inconnu: true,
    });
    expect(lireDocument(texte)).toEqual({
      etat: "ok",
      doc: { v: 1, carte: { ville: ["Royal Road", "Le Port"] }, chansons: { "g1:1:normal": { meilleur: 1200 } } },
    });
    expect(lireDocument('{"v":1}').doc).toEqual(sauvegardeVide());
  });

  it("une sauvegarde d'une version plus récente se lit autant que possible, et se signale pour ne pas l'écraser", () => {
    const texte = JSON.stringify({ ...exemple(), v: VERSION + 1, nouveau: { quelque: "chose" } });
    expect(lireDocument(texte)).toEqual({ etat: "plus-recente", doc: exemple(), version: VERSION + 1 });
  });

  it("une sauvegarde ancienne passe par chaque migration, de version en version", () => {
    // Un format imaginaire à trois versions : la 1 rangeait les lieux réussis de la Ville seulement, la 2 les
    // rangeait par univers sous un autre nom, la 3 est le format actuel
    const migrations: Record<number, Migration> = {
      1: (d) => ({ lieux: { ville: d.quartiers } }),
      2: (d) => ({ carte: d.lieux, chansons: {} }),
    };
    const lu = lireDocument(JSON.stringify({ v: 1, quartiers: ["Royal Road"] }), migrations, 3);
    expect(lu).toEqual({ etat: "ok", doc: { v: 3, carte: { ville: ["Royal Road"] }, chansons: {} } });
    expect(lireDocument(JSON.stringify({ v: 2, lieux: { boite: ["Vamp dorien"] } }), migrations, 3).doc.carte).toEqual({
      boite: ["Vamp dorien"],
    });
    // Une migration qui manque : le document ne peut pas être lu
    expect(lireDocument(JSON.stringify({ v: 1 }), { 2: migrations[2] }, 3).etat).toBe("illisible");
  });
});

describe("progression", () => {
  it("la clé d'une chanson générée porte la version du générateur, la graine et la difficulté", () => {
    expect(cleChanson(4242, "normal")).toBe(`g${VERSION_GENERATEUR}:4242:normal`);
    expect(cleChanson(7, "difficile", 3)).toBe("g3:7:difficile");
  });

  it("une chanson réussie allume son lieu dans son univers, une seule fois, sans toucher l'ancien document", () => {
    const vide = sauvegardeVide();
    const a = noterReussite(vide, { univers: "ville", lieu: "Royal Road" });
    expect(a.progres).toEqual({ lieu: "Royal Road", record: false });
    expect(lieuxReussis(a.doc, "ville")).toEqual(["Royal Road"]);
    expect(lieuxReussis(a.doc, "boite")).toEqual([]);
    expect(vide).toEqual(sauvegardeVide());

    const b = noterReussite(a.doc, { univers: "ville", lieu: "Royal Road" });
    expect(b.progres.lieu).toBeNull();
    expect(lieuxReussis(b.doc, "ville")).toEqual(["Royal Road"]);
    const c = noterReussite(b.doc, { univers: "boite", lieu: "Royal Road" });
    expect(c.doc.carte).toEqual({ ville: ["Royal Road"], boite: ["Royal Road"] });
  });

  it("une chanson générée garde son meilleur score, par graine et difficulté", () => {
    const r = { univers: "ville", lieu: "Royal Road", graine: 4242, diff: "normal" };
    let { doc, progres } = noterReussite(sauvegardeVide(), { ...r, score: 1000 });
    expect(progres.record).toBe(true);
    expect(meilleurScore(doc, 4242, "normal")).toBe(1000);
    ({ doc, progres } = noterReussite(doc, { ...r, score: 800 }));
    expect([progres.record, meilleurScore(doc, 4242, "normal")]).toEqual([false, 1000]);
    ({ doc, progres } = noterReussite(doc, { ...r, score: 1500 }));
    expect([progres.record, meilleurScore(doc, 4242, "normal")]).toEqual([true, 1500]);
    expect(meilleurScore(doc, 4242, "facile")).toBeUndefined();
  });

  it("le suivi d'une autre version du générateur est ignoré", () => {
    const doc = {
      ...sauvegardeVide(),
      chansons: { [cleChanson(4242, "normal", VERSION_GENERATEUR + 1)]: { meilleur: 9 } },
    };
    expect(meilleurScore(doc, 4242, "normal")).toBeUndefined();
  });

  it("fusionner deux sauvegardes ne perd rien : les lieux s'additionnent, chaque chanson garde son meilleur score", () => {
    const ici: Sauvegarde = {
      v: VERSION,
      carte: { ville: ["I–V–vi–IV", "Royal Road"] },
      chansons: { "g1:1:normal": { meilleur: 500 }, "g1:2:normal": { meilleur: 900 } },
    };
    const collee: Sauvegarde = {
      v: VERSION,
      carte: { ville: ["Royal Road", "Le Port"], boite: ["Vamp dorien"] },
      chansons: { "g1:1:normal": { meilleur: 700 }, "g1:2:normal": { meilleur: 100 }, "g1:3:facile": { meilleur: 50 } },
    };
    expect(fusionner(ici, collee)).toEqual({
      v: VERSION,
      carte: { ville: ["I–V–vi–IV", "Royal Road", "Le Port"], boite: ["Vamp dorien"] },
      chansons: {
        "g1:1:normal": { meilleur: 700 },
        "g1:2:normal": { meilleur: 900 },
        "g1:3:facile": { meilleur: 50 },
      },
    });
    expect(fusionner(ici, sauvegardeVide())).toEqual(ici);
  });
});

describe("code de sauvegarde", () => {
  it("base64url : l'alphabet des adresses, sans remplissage, UTF-8 compris", () => {
    expect(["", "f", "fo", "foo", "foob", "fooba", "foobar"].map(base64url)).toEqual([
      "",
      "Zg",
      "Zm8",
      "Zm9v",
      "Zm9vYg",
      "Zm9vYmE",
      "Zm9vYmFy",
    ]);
    expect(base64url("ÿ?>")).toBe(Buffer.from("ÿ?>").toString("base64url"));
    for (const t of ["I–V–vi–IV", "Après-midi de pluie ♪", "{}"]) expect(depuisBase64url(base64url(t))).toBe(t);
    for (const faux of ["Zm9v!", "Z", "Zm9vY", "_w"]) expect(depuisBase64url(faux)).toBeNull();
  });

  it("le code porte le préfixe et la version, et redonne exactement la sauvegarde", () => {
    const doc = exemple(),
      code = encoder(doc);
    expect(code.startsWith(`${PREFIXE}${VERSION}.`)).toBe(true);
    expect(code).toMatch(/^DM\d+\.[A-Za-z0-9_-]+$/);
    expect(decoder(code)).toEqual({ etat: "ok", doc });
  });

  it("un code recopié avec des espaces ou des retours à la ligne reste valide", () => {
    const code = encoder(exemple()),
      coupe = `  ${code.slice(0, 10)}\n${code.slice(10, 30)} ${code.slice(30)}\n`;
    expect(decoder(coupe)).toEqual({ etat: "ok", doc: exemple() });
  });

  it("un code abîmé, tronqué, trafiqué ou étranger est refusé", () => {
    const code = encoder(exemple());
    for (const faux of [
      "",
      "bonjour",
      code.slice(0, -6),
      code.replace(/^DM1\./, "DM2."),
      code.replace(/^DM/, "XX"),
      `DM1.${base64url("pas du json")}`,
      `DM1.${base64url('{"v":1,"carte":[]')}`,
      `DM1.${base64url("[1]")}`,
    ])
      expect(decoder(faux).etat).toBe("invalide");
  });

  it("un code d'une version plus récente du jeu est signalé, pour être refusé avec sa raison", () => {
    const futur = { ...exemple(), v: VERSION + 1 };
    expect(decoder(encoder(futur)).etat).toBe("plus-recente");
    // Le même code, lu par un jeu plus récent, est accepté
    expect(decoder(encoder(futur), VERSION + 1).etat).toBe("ok");
  });
});

// La version du générateur suit l'instantané : chaque régénération voulue de l'instantané (ADR-0005) doit augmenter
// VERSION_GENERATEUR, sinon les scores et les tags d'une ancienne chanson s'appliqueraient à une nouvelle (ADR-0014).
// Un instantané qui change sans que les chansons changent (des graines ajoutées) garde sa version : on ajoute alors
// sa nouvelle empreinte à la liste de la version en cours.
const EMPREINTES_DE_L_INSTANTANE: Record<number, string[]> = {
  1: ["47a2bad5c0102329ebbe7d53da82aaff945881884faf2d6f747e005ca3b0e2d1"],
};
it("VERSION_GENERATEUR change avec l'instantané du générateur", () => {
  const instantane = readFileSync(new URL("./instantanes/chansons.json", import.meta.url), "utf8").replace(
      /\r\n/g,
      "\n",
    ),
    empreinte = createHash("sha256").update(instantane).digest("hex");
  expect(
    empreinte,
    "L'instantané du générateur a changé : augmenter VERSION_GENERATEUR (src/chanson/generateur.ts) et ajouter " +
      "l'empreinte du nouvel instantané à EMPREINTES_DE_L_INSTANTANE (ADR-0014).",
  ).toBeOneOf(EMPREINTES_DE_L_INSTANTANE[VERSION_GENERATEUR] ?? []);
});
