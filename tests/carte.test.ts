// La carte du monde (#25) : six lieux par univers, un par progression ; une chanson réussie allume son lieu, et la
// sauvegarde (ADR-0014) le garde d'une visite à l'autre. Les essais ne touchent jamais à la vraie sauvegarde. Les
// règles pures d'abord, puis des parcours complets dans le faux navigateur.

import { afterEach, describe, expect, it } from "vitest";
import { buildSong, progressionDe } from "../src/chanson/generateur";
import { PROGS } from "../src/chanson/theorie";
import { LIEUX, graineDuLieu, lieuSuivant } from "../src/jeu/carte";
import { encoder } from "../src/sauvegarde/code";
import { VERSION, cleChanson, type Sauvegarde } from "../src/sauvegarde/format";
import { THEMES } from "../src/univers/univers";
import { Navigateur, type Univers } from "./support/navigateur";

const CLE = "deux-mains-sauvegarde";
let nav: Navigateur;
afterEach(() => nav?.fermer());

describe("lieux de la carte", () => {
  it("six lieux, un par progression, nommés dans chaque univers", () => {
    expect(LIEUX).toEqual(PROGS.map((p) => p.name));
    expect(LIEUX.length).toBe(6);
    for (const u of Object.values(THEMES)) for (const l of LIEUX) expect(u.places[l]).toBeTruthy();
  });

  it("la progression d'une graine se lit sans construire la chanson", () => {
    for (let graine = 1; graine <= 300; graine += 7)
      expect(progressionDe(graine)).toBe(buildSong(graine, "normal").prog);
  });

  it("chaque lieu a sa chanson, la même dans toutes les difficultés, qui joue sa progression", () => {
    for (const lieu of LIEUX) {
      const graine = graineDuLieu(lieu);
      expect(graineDuLieu(lieu)).toBe(graine);
      for (const diff of ["debutant", "facile", "normal", "difficile"])
        expect(buildSong(graine, diff).prog.name).toBe(lieu);
    }
    expect(new Set(LIEUX.map(graineDuLieu)).size).toBe(6);
    expect(() => graineDuLieu("Le Port")).toThrow();
  });

  it("le lieu suivant est le prochain à faire, en revenant au début ; tout réussi, simplement le suivant", () => {
    const [a, b, c, d, e, f] = LIEUX;
    expect(lieuSuivant([], a)).toBe(b);
    expect(lieuSuivant([b, c], a)).toBe(d);
    expect(lieuSuivant([a, b, c], f)).toBe(d);
    expect(lieuSuivant([a, b, c, d, e], f)).toBe(f);
    expect(lieuSuivant(LIEUX, c)).toBe(d);
    expect(lieuSuivant(LIEUX, f)).toBe(a);
  });
});

/** Joue la chanson en cours comme un joueur parfait : l'auto-play frappe chaque note, mais la partie reste classée */
function jouerSansFaute(n: Navigateur) {
  const S = n.jeu.state;
  n.presser("Space");
  S.auto = true;
  n.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
  expect([S.mode, S.autoUsed, S.miss]).toEqual(["done", false, 0]);
}
const sauvegardeDe = (n: Navigateur): Sauvegarde => JSON.parse(n.stockage.get(CLE));
// Les fenêtres allumées de la Ville, les photographies accrochées dans la Boîte, à la dernière image
const fenetresAllumees = (n: Navigateur) => n.remplissages.filter((c) => c.startsWith("hsla(45,90%,68%")).length;
const photographies = (n: Navigateur) => n.remplissages.filter((c) => c === "hsla(40,45%,42%,1)").length;

describe.each(["ville", "boite"] as Univers[])("carte dans l'univers %s", (univers) => {
  const U = THEMES[univers];

  it("l'écran de départ ouvre la carte ; elle montre les six lieux, tous à faire au premier passage", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": univers } });
    const S = nav.jeu.state;
    expect(nav.overlay.innerHTML).toContain('data-act="carte"');
    expect(nav.overlay.innerHTML).toContain(U.carte.nom);
    nav.presser("KeyC");
    expect(S.mode).toBe("carte");
    const html = nav.overlay.innerHTML;
    expect(html).toContain(U.carte.titre);
    for (const lieu of LIEUX) expect(html).toContain(U.places[lieu]);
    expect(html.match(/class="lieu a-faire/g)).toHaveLength(6);
    expect(html).toContain(`0 sur 6 ${U.carte.reussis}`);
    nav.presser("Escape");
    expect(S.mode).toBe("title");
  });

  it("choisir un lieu prépare sa chanson ; la réussir l'allume, garde le score et propose le lieu suivant", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": univers, "deux-mains-diff": "facile" } });
    const S = nav.jeu.state;
    nav.presser("KeyC");
    nav.presser("Digit3");
    expect([S.mode, S.seed, S.song.prog.name, S.diff]).toEqual(["title", graineDuLieu(LIEUX[2]), LIEUX[2], "facile"]);

    jouerSansFaute(nav);

    expect(sauvegardeDe(nav)).toEqual({
      v: VERSION,
      carte: { [univers]: [LIEUX[2]] },
      // Les notes parfaites y ont laissé leurs traces (#29)
      chansons: { [cleChanson(S.seed, "facile")]: { meilleur: S.score, traces: expect.any(Array) } },
    });
    expect(S.progres).toEqual({ lieu: LIEUX[2], record: true });
    expect(nav.overlay.innerHTML).toContain(U.carte.gagne);
    expect(nav.overlay.innerHTML).toContain(`Suivant : ${U.places[LIEUX[3]]}`);

    nav.presser("KeyC");
    expect(nav.overlay.innerHTML.match(/class="lieu reussi/g)).toHaveLength(1);
    expect(nav.overlay.innerHTML).toContain(`record ${S.score.toLocaleString("fr-CA")}`);
    nav.presser("Escape");
    expect(S.mode).toBe("title");
  });

  it("la progression persiste d'une visite à l'autre, et change le décor dès le départ", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": univers } });
    nav.image();
    const avant = univers === "ville" ? fenetresAllumees(nav) : photographies(nav);
    nav.fermer();

    const sauvegarde: Sauvegarde = { v: VERSION, carte: { [univers]: LIEUX.slice(0, 6) }, chansons: {} };
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-theme": univers, [CLE]: JSON.stringify(sauvegarde) } });
    nav.presser("KeyC");
    expect(nav.overlay.innerHTML.match(/class="lieu reussi/g)).toHaveLength(6);
    expect(nav.overlay.innerHTML).toContain(`6 sur 6 ${U.carte.reussis}`);
    nav.presser("Escape");
    nav.image();
    // Ville : les habitants des quartiers rallumés restent aux fenêtres ; Boîte : les souvenirs pendent au mur
    if (univers === "ville") expect(fenetresAllumees(nav)).toBeGreaterThan(avant * 1.3);
    else {
      expect(avant).toBe(0);
      expect(photographies(nav)).toBeGreaterThan(0);
    }
  });
});

describe("ce qui ne compte pas", () => {
  it("l'auto-play, une seule main ou le ralenti ne réussissent pas de lieu et n'écrivent rien", async () => {
    nav = await Navigateur.ouvrir({ stockage: { "deux-mains-diff": "debutant" } });
    const S = nav.jeu.state;
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.mode !== "play", 300);
    expect(S.mode).toBe("done");
    expect([nav.stockage.has(CLE), S.progres]).toEqual([false, null]);
    expect(nav.overlay.innerHTML).not.toContain(THEMES.ville.carte.gagne);
  });

  it("une boucle quittée n'écrit rien", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state;
    nav.jeu.setBoucle(1);
    nav.presser("Space");
    S.auto = true;
    nav.image();
    nav.presser("Escape");
    nav.presser("KeyB");
    expect([S.mode, nav.stockage.has(CLE)]).toEqual(["done", false]);
  });
});

describe("stockage absent ou abîmé", () => {
  it("sans stockage, le jeu se joue, la carte se remplit en mémoire et l'écran du code prévient", async () => {
    nav = await Navigateur.ouvrir({ stockageBloque: true, stockage: {} });
    const S = nav.jeu.state;
    nav.jeu.load(graineDuLieu(LIEUX[0]), "debutant");
    jouerSansFaute(nav);
    expect(S.sauvegarde.carte.ville).toEqual([LIEUX[0]]);
    nav.presser("KeyC");
    nav.presser("KeyS");
    expect(S.mode).toBe("sauvegarde");
    expect(nav.overlay.innerHTML).toContain("ne garde pas la progression");
    expect(nav.overlay.innerHTML).toContain(encoder(S.sauvegarde));
    nav.presser("Escape");
    expect(S.mode).toBe("carte");
  });

  it("une sauvegarde illisible est mise de côté, pas effacée, et le jeu repart d'une carte vide", async () => {
    nav = await Navigateur.ouvrir({ stockage: { [CLE]: "{abîmée" } });
    const S = nav.jeu.state;
    expect(nav.stockage.get("deux-mains-sauvegarde-illisible")).toBe("{abîmée");
    expect(S.sauvegarde.carte).toEqual({});
    nav.jeu.load(graineDuLieu(LIEUX[1]), "debutant");
    jouerSansFaute(nav);
    expect(sauvegardeDe(nav).carte.ville).toEqual([LIEUX[1]]);
    expect(nav.stockage.get("deux-mains-sauvegarde-illisible")).toBe("{abîmée");
  });

  it("la sauvegarde d'une version plus récente du jeu se lit, mais n'est jamais écrasée", async () => {
    const futur = JSON.stringify({ v: VERSION + 1, carte: { ville: [LIEUX[4]] }, chansons: {}, nouveau: 1 });
    nav = await Navigateur.ouvrir({ stockage: { [CLE]: futur } });
    const S = nav.jeu.state;
    expect(S.sauvegarde.carte.ville).toEqual([LIEUX[4]]);
    nav.jeu.load(graineDuLieu(LIEUX[1]), "debutant");
    jouerSansFaute(nav);
    expect(S.sauvegarde.carte.ville).toEqual([LIEUX[4], LIEUX[1]]);
    expect(nav.stockage.get(CLE)).toBe(futur);
    nav.presser("KeyC");
    nav.presser("KeyS");
    expect(nav.overlay.innerHTML).toContain("version plus récente du jeu");
  });
});

describe("code de sauvegarde", () => {
  it("coller le code d'un autre navigateur ajoute sa progression à celle d'ici, et la range", async () => {
    const ailleurs: Sauvegarde = {
      v: VERSION,
      carte: { ville: [LIEUX[0], LIEUX[5]], boite: [LIEUX[2]] },
      chansons: { "g1:9:normal": { meilleur: 321 } },
    };
    const ici: Sauvegarde = { v: VERSION, carte: { ville: [LIEUX[1]] }, chansons: {} };
    nav = await Navigateur.ouvrir({ stockage: { [CLE]: JSON.stringify(ici) } });
    const S = nav.jeu.state;
    nav.presser("KeyC");
    nav.toucherBouton("sauvegarde");
    expect(nav.overlay.innerHTML).toContain(encoder(ici));

    nav.trouver("#code-colle").value = "n'importe quoi";
    nav.toucherBouton("coller");
    expect(nav.overlay.innerHTML).toContain("pas un code de sauvegarde valide");
    expect(sauvegardeDe(nav)).toEqual(ici);

    nav.trouver("#code-colle").value = encoder({ ...ailleurs, v: VERSION + 1 });
    nav.toucherBouton("coller");
    expect(nav.overlay.innerHTML).toContain("version plus récente");

    nav.trouver("#code-colle").value = `\n${encoder(ailleurs)}\n`;
    nav.toucherBouton("coller");
    expect(S.sauvegarde).toEqual({
      v: VERSION,
      carte: { ville: [LIEUX[1], LIEUX[0], LIEUX[5]], boite: [LIEUX[2]] },
      chansons: { "g1:9:normal": { meilleur: 321 } },
    });
    expect(sauvegardeDe(nav)).toEqual(S.sauvegarde);
    expect(nav.overlay.innerHTML).toContain("Code chargé : 3 lieux sur 6");
    nav.toucherBouton("carte");
    expect(nav.overlay.innerHTML.match(/class="lieu reussi/g)).toHaveLength(3);
  });

  it("copier le code passe par le presse-papiers, ou demande de le sélectionner s'il refuse", async () => {
    nav = await Navigateur.ouvrir();
    nav.presser("KeyC");
    nav.presser("KeyS");
    nav.toucherBouton("copier");
    expect(nav.overlay.innerHTML).toContain("Sélectionne le code");
  });
});

describe("essais de la carte", () => {
  it.each([
    ["carte", "ville"],
    ["album", "boite"],
  ] as const)(
    "l'essai %s montre une progression fictive, la complète en mémoire et ne touche pas la vraie sauvegarde",
    async (id, univers) => {
      const vraie: Sauvegarde = { v: VERSION, carte: { [univers]: [LIEUX[5]] }, chansons: {} },
        texte = JSON.stringify(vraie);
      nav = await Navigateur.ouvrir({ stockage: { [CLE]: texte }, adresse: { search: `?essai=${id}` } });
      const S = nav.jeu.state,
        U = THEMES[univers],
        lieu = S.song.prog.name,
        fictifs = S.essai.sauvegarde.carte[univers];
      expect(fictifs.length).toBeGreaterThanOrEqual(2);
      expect(fictifs).not.toContain(lieu);
      expect(nav.overlay.innerHTML).toContain('data-act="carte"');

      nav.presser("KeyC");
      const html = nav.overlay.innerHTML;
      expect(html.match(/class="lieu reussi/g)).toHaveLength(fictifs.length);
      expect(html).toContain("progression fictive");
      expect(html.match(/disabled/g)).toHaveLength(6);
      // Choisir un lieu quitterait l'essai : la carte de l'essai se regarde seulement
      nav.presser("Digit1");
      expect([S.mode, S.essai?.essai.id]).toEqual(["carte", id]);
      nav.presser("Escape");
      expect(S.mode).toBe("title");

      jouerSansFaute(nav);
      expect(S.essai.sauvegarde.carte[univers]).toEqual([...fictifs, lieu]);
      expect(nav.overlay.innerHTML).toContain(U.carte.gagne);
      expect(nav.stockage.get(CLE)).toBe(texte);

      // Le code de l'essai est celui de la progression fictive ; en coller un ne touche pas non plus la vraie
      nav.presser("KeyC");
      nav.presser("KeyS");
      expect(nav.overlay.innerHTML).toContain(encoder(S.essai.sauvegarde));
      nav.trouver("#code-colle").value = encoder({ v: VERSION, carte: { [univers]: LIEUX }, chansons: {} });
      nav.toucherBouton("coller");
      expect(S.essai.sauvegarde.carte[univers]).toHaveLength(6);
      expect(nav.stockage.get(CLE)).toBe(texte);

      nav.presser("Escape");
      nav.presser("Escape");
      nav.presser("Escape");
      expect([S.essai, S.sauvegarde]).toEqual([null, vraie]);
      expect(nav.stockage.get(CLE)).toBe(texte);
    },
  );

  it("un autre essai ne montre pas de carte et ne note rien", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=double-saut" } });
    const S = nav.jeu.state;
    expect(nav.overlay.innerHTML).not.toContain('data-act="carte"');
    nav.presser("KeyC");
    expect(S.mode).toBe("title");
    nav.presser("Space");
    S.auto = true;
    nav.avancerJusqua((s) => s.mode !== "play", 300);
    expect([S.mode, S.progres, nav.stockage.has(CLE)]).toEqual(["done", null, false]);
  });
});

describe("enchaînement", () => {
  it("Suivant (→) prépare le prochain lieu à faire, dans la difficulté du joueur", async () => {
    const sauvegarde: Sauvegarde = { v: VERSION, carte: { ville: [LIEUX[1], LIEUX[2]] }, chansons: {} };
    nav = await Navigateur.ouvrir({ stockage: { [CLE]: JSON.stringify(sauvegarde), "deux-mains-diff": "debutant" } });
    const S = nav.jeu.state;
    nav.jeu.load(graineDuLieu(LIEUX[0]), "debutant");
    jouerSansFaute(nav);
    expect(nav.overlay.innerHTML).toContain(`Suivant : ${THEMES.ville.places[LIEUX[3]]}`);
    nav.presser("ArrowRight");
    // Le remontage (#27) précède l'écran de départ du lieu suivant ; la partie était en auto-play, lui aussi
    expect([S.mode, S.song.prog.name, S.diff]).toEqual(["remontage", LIEUX[3], "debutant"]);
    nav.avancerJusqua((s) => s.mode !== "remontage", 30);
    expect([S.mode, S.depart]).toEqual(["title", 100]);
    nav.presser("KeyC");
    nav.toucherBouton("lieu", { lieu: LIEUX[5] });
    expect([S.mode, S.seed]).toEqual(["title", graineDuLieu(LIEUX[5])]);
    nav.toucherBouton("carte");
    nav.toucherBouton("titre");
    expect(S.mode).toBe("title");
    jouerSansFaute(nav);
    nav.toucherBouton("suivant");
    expect(S.song.prog.name).toBe(LIEUX[3]);
  });

  it("changer d'univers sur la carte change son habillage : la Carte devient l'Album", async () => {
    nav = await Navigateur.ouvrir();
    nav.presser("KeyC");
    expect(nav.overlay.innerHTML).toContain(THEMES.ville.carte.titre);
    nav.jeu.setTheme("boite");
    expect(nav.jeu.state.mode).toBe("carte");
    expect(nav.overlay.innerHTML).toContain(THEMES.boite.carte.titre);
  });
});
