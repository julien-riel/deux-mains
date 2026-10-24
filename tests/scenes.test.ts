// Le contrat de scène (ADR-0019) : une scène ne fournit que sa géométrie et son décor, et tout le reste se dessine
// à la pose qu'elle donne. La scène de côté reproduit la lecture d'avant ; la scène d'une partie se choisit avec sa
// chanson. Le choix est de la logique pure ; les poses et le dessin passent par le faux navigateur.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ESSAIS } from "../src/essais/registre";
import { SCENES, sceneDeLaPartie } from "../src/jeu/scenes";
import type { Pose, Scene, Voie } from "../src/rendu/scenes/contrat";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

const VOIES: Voie[] = [0, 1, 2, 3, 0.5, 1.5, 2.5, "chanteur", "basse"];

describe("choix de la scène", () => {
  it("connaît les quatre scènes d'ADR-0019", () => {
    expect(SCENES).toEqual(["cote", "colonnes", "disque", "horizon"]);
  });

  it("prend la scène imposée par l'essai, sinon la scène de côté", () => {
    expect(sceneDeLaPartie()).toBe("cote");
    expect(sceneDeLaPartie(null)).toBe("cote");
    expect(sceneDeLaPartie({})).toBe("cote");
    expect(sceneDeLaPartie({ scene: "disque" })).toBe("disque");
  });

  it("chaque essai qui impose une scène impose une scène dessinée", async () => {
    nav = await Navigateur.ouvrir();
    const { SCENES_DESSINEES } = await import("../src/rendu/geometrie");
    for (const e of ESSAIS.filter((e) => e.scene)) expect(SCENES_DESSINEES).toHaveProperty(e.scene);
  });

  it("se choisit avec la chanson : l'essai impose la sienne, la chanson suivante revient à la scène de côté", async () => {
    nav = await Navigateur.ouvrir();
    const { chargerEssai } = await import("../src/ui/reglages");
    chargerEssai({ ...ESSAIS[0], scene: "horizon" });
    expect(nav.jeu.state.scene).toBe("horizon");
    nav.jeu.load(4242, "normal");
    expect(nav.jeu.state.scene).toBe("cote");
  });

  it("dessine la scène de côté à la place d'une scène qui n'est pas encore dessinée", async () => {
    nav = await Navigateur.ouvrir();
    const { scene, SCENES_DESSINEES } = await import("../src/rendu/geometrie");
    expect(Object.keys(SCENES_DESSINEES)).toEqual(["cote", "colonnes"]);
    expect(scene().id).toBe("cote");
    nav.jeu.state.scene = "disque";
    expect(scene().id).toBe("cote");
  });
});

describe("scène de côté", () => {
  async function cote() {
    nav = await Navigateur.ouvrir();
    const { COTE } = await import("../src/rendu/scenes/cote");
    const { W } = await import("../src/rendu/outils");
    return { COTE, W };
  }

  it("pose une note au temps nb à son point d'impact, debout, à sa taille", async () => {
    const { COTE } = await cote();
    for (const nb of [0, 13.37, 250])
      for (const voie of VOIES) {
        const p = COTE.poser(nb, voie, nb);
        expect(p).toEqual(COTE.impact(voie));
        expect([p.echelle, p.angle, p.visible]).toEqual([1, 0, true]);
      }
  });

  it("pose une note un temps plus tard 150 pixels à droite, sur la même hauteur", async () => {
    const { COTE } = await cote();
    for (const voie of VOIES) {
      const ici = COTE.poser(10, voie, 10),
        apres = COTE.poser(11, voie, 10);
      expect(apres.x - ici.x).toBe(150);
      expect(apres.y).toBe(ici.y);
    }
  });

  it("étage les couloirs de la fondamentale (en bas) à l'octave, le chanteur au-dessus et le sol en dessous", async () => {
    const { COTE } = await cote();
    const y = (v: Voie) => COTE.impact(v).y;
    expect(y("basse")).toBeGreaterThan(y(0));
    expect([y(0), y(0.5), y(1), y(1.5), y(2), y(2.5), y(3)]).toEqual(
      [...[y(0), y(0.5), y(1), y(1.5), y(2), y(2.5), y(3)]].sort((a, b) => b - a),
    );
    expect(y(1.5)).toBe((y(1) + y(2)) / 2);
    expect(y("chanteur")).toBeLessThan(y(3));
    // Le personnage court à gauche de la ligne de tir
    expect(COTE.impact("basse").x).toBeLessThan(COTE.impact(0).x);
  });

  it("montre six temps à l'avance, jusqu'au bord droit, et oublie ce qui sort du champ", async () => {
    const { COTE, W } = await cote();
    expect(COTE.poser(COTE.avance, 2, 0).x).toBe(W);
    expect(COTE.horsChamp(COTE.poser(COTE.avance, 2, 0), "devant", 0)).toBe(false);
    expect(COTE.horsChamp(COTE.poser(COTE.avance + 1, 2, 0), "devant", 40)).toBe(true);
    expect(COTE.horsChamp(COTE.poser(COTE.avance + 1, 2, 0), "derriere", 40)).toBe(false);
    expect(COTE.horsChamp(COTE.poser(-3, 2, 0), "derriere", 40)).toBe(true);
    expect(COTE.horsChamp(COTE.poser(-3, 2, 0), "devant", 40)).toBe(false);
    // Un serpent se trace d'un point tous les quatre pixels
    expect(COTE.poser(COTE.echantillon, 0, 0).x - COTE.impact(0).x).toBeCloseTo(4, 9);
  });
});

describe("scène en colonnes", () => {
  async function colonnes(tactile = false) {
    nav = await Navigateur.ouvrir({ tactile });
    const { COLONNES, CHUTE, xDeColonne } = await import("../src/rendu/scenes/colonnes");
    const { COTE } = await import("../src/rendu/scenes/cote");
    const outils = await import("../src/rendu/outils");
    const zones = await import("../src/rendu/zones");
    return { COLONNES, CHUTE, xDeColonne, COTE, W: outils.W, H: outils.H, ...zones };
  }
  const COULOIRS = [0, 1, 2, 3, 0.5, 1.5, 2.5];

  it("pose une note au sol de sa colonne au moment de son temps, à sa taille, bien droite", async () => {
    const { COLONNES } = await colonnes();
    for (const nb of [0, 13.37, 250])
      for (const voie of VOIES) {
        const p = COLONNES.poser(nb, voie, nb);
        expect(p).toEqual(COLONNES.impact(voie));
        expect([p.echelle, p.angle, p.visible]).toEqual([1, 0, true]);
      }
  });

  it("aligne les points d'impact des couloirs juste au-dessus du sol, de gauche à droite", async () => {
    const { COLONNES, COTE } = await colonnes();
    const sol = COLONNES.impact("basse");
    // La basse reste de côté : le personnage, le sol et les obstacles de la scène de côté
    expect(sol).toEqual(COTE.impact("basse"));
    expect(COLONNES.poser(12, "basse", 10)).toEqual(COTE.poser(12, "basse", 10));
    const impacts = COULOIRS.map((v) => COLONNES.impact(v));
    expect(new Set(impacts.map((p) => p.y)).size).toBe(1);
    expect(impacts[0].y).toBeLessThan(sol.y);
    expect(sol.y - impacts[0].y).toBeLessThanOrEqual(40);
    const xs = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((v) => COLONNES.impact(v).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(COLONNES.impact(1.5).x).toBe((COLONNES.impact(1).x + COLONNES.impact(2).x) / 2);
    // Le personnage court à gauche de la première colonne
    expect(sol.x).toBeLessThan(COLONNES.impact(0).x);
  });

  it("garde la note dans l'avion jusqu'au largage, puis la fait tomber droit dans sa colonne", async () => {
    const { COLONNES, CHUTE } = await colonnes();
    for (const voie of COULOIRS) {
      const temps = 40,
        impact = COLONNES.impact(voie);
      // Dans la soute : cachée, pas encore entrée dans le champ, à droite et plus haut que sa colonne
      const soute = COLONNES.poser(temps, voie, temps - CHUTE - 0.5);
      expect(soute.visible).toBe(false);
      expect(COLONNES.horsChamp(soute, "devant", 40)).toBe(true);
      expect(soute.x).toBeGreaterThan(impact.x);
      expect(soute.y).toBeLessThan(impact.y);
      // Larguée : elle descend à chaque instant, sans quitter sa colonne
      let avant = -Infinity;
      for (let nb = temps - CHUTE; nb <= temps; nb += 0.125) {
        const p = COLONNES.poser(temps, voie, nb);
        expect(p.visible).toBe(true);
        expect(COLONNES.horsChamp(p, "devant", 0)).toBe(false);
        expect(Math.abs(p.x - impact.x)).toBeLessThanOrEqual(6);
        expect(p.y).toBeGreaterThan(avant);
        avant = p.y;
      }
      // Passé son temps, elle s'enfonce sous le sol et sort du champ
      expect(COLONNES.horsChamp(COLONNES.poser(temps, voie, temps + 0.1), "derriere", 0)).toBe(false);
      expect(COLONNES.horsChamp(COLONNES.poser(temps, voie, temps + 2), "derriere", 0)).toBe(true);
    }
  });

  it("largue d'un même avion les notes d'une colonne plus à gauche une croche plus tard", async () => {
    const { COLONNES, CHUTE } = await colonnes();
    const nb = 10,
      a = COLONNES.poser(nb + CHUTE + 1, 3, nb),
      b = COLONNES.poser(nb + CHUTE + 1.5, 2, nb);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
  });

  it("au clavier, place chaque colonne là où sera sa zone de doigt, à droite d'une bande d'un cinquième", async () => {
    const { xDeColonne, zonesTactiles, W, H } = await colonnes();
    const zones = zonesTactiles(W, H);
    for (let i = 0; i < 4; i++) {
      const z = zones.couloirs[i];
      expect(xDeColonne(i)).toBeCloseTo(z.x + z.largeur / 2, 9);
    }
    expect(xDeColonne(0) - (xDeColonne(1) - xDeColonne(0)) / 2).toBeCloseTo(W / 5, 9);
  });

  it("en mode tactile, met chaque colonne exactement au-dessus de sa zone", async () => {
    const { COLONNES, xDeColonne, zonesDansLaScene, W, H } = await colonnes(true);
    const { cadreDeLaScene } = await import("../src/rendu/geometrie");
    const { zonesTactiles } = await import("../src/rendu/zones");
    expect(cadreDeLaScene()).toEqual(zonesTactiles(W, H).scene);
    zonesDansLaScene(W, H).forEach((z, i) => {
      expect(xDeColonne(i)).toBeCloseTo(z.x + z.largeur / 2, 9);
      expect(COLONNES.impact(i).x).toBeCloseTo(z.x + z.largeur / 2, 9);
      // Ramenée à l'écran par le cadre de la scène, la colonne tombe au milieu de sa zone
      const c = cadreDeLaScene(),
        zone = zonesTactiles(W, H).couloirs[i];
      expect(c.x + (xDeColonne(i) * c.largeur) / W).toBeCloseTo(zone.x + zone.largeur / 2, 9);
    });
  });

  it("montre la légende des couloirs au pied de leur colonne, et ses essais la dessinent dès la première mesure", async () => {
    for (const id of ["colonnes-ville", "colonnes-boite"]) {
      nav = await Navigateur.ouvrir({ adresse: { search: `?essai=${id}` } });
      const { scene } = await import("../src/rendu/geometrie");
      const outils = await import("../src/rendu/outils");
      expect(nav.jeu.state.scene).toBe("colonnes");
      expect(scene().id).toBe("colonnes");
      const sc = scene();
      for (let i = 0; i < 4; i++) {
        const e = sc.etiquette(i);
        expect(Math.abs(e.x + 70 - sc.impact(i).x)).toBeLessThan(1e-9);
        expect(e.y).toBeGreaterThan(sc.impact("basse").y);
      }
      // L'auto-play la joue dès la première mesure : les ennemis tombent en parachute, les avions passent
      const fillText = vi.spyOn(outils.g, "fillText");
      nav.presser("KeyA");
      nav.avancerJusqua(() => nav.horloge.secondes > 4, 10);
      nav.image();
      expect(fillText).toHaveBeenCalledWith("FONDAMENTALE", sc.etiquette(0).x + 40, expect.any(Number));
      nav.fermer();
    }
  });
});

describe("rendu commun", () => {
  // Une scène de côté penchée et agrandie, dont le personnage est déplacé : de quoi voir que le rendu commun suit
  // les poses qu'on lui donne
  async function scenePenchee(): Promise<{ penchee: Scene; cote: Scene }> {
    const { COTE } = await import("../src/rendu/scenes/cote");
    const pencher = (p: Pose): Pose => ({ ...p, echelle: 2, angle: 0.3 });
    const penchee: Scene = {
      ...COTE,
      id: "disque",
      poser: (beat, voie, nb) => pencher(COTE.poser(beat, voie, nb)),
      impact: (voie) => {
        const p = pencher(COTE.impact(voie));
        return voie === "basse" ? { ...p, x: p.x + 100 } : p;
      },
    };
    const { SCENES_DESSINEES } = await import("../src/rendu/geometrie");
    SCENES_DESSINEES.disque = penchee;
    return { penchee, cote: COTE };
  }

  it("dessine les ennemis, les obstacles et le personnage à la pose donnée par la scène", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=accords" } });
    nav.presser("KeyA");
    nav.avancerJusqua(() => nav.horloge.secondes > 6, 10);
    const { penchee } = await scenePenchee();
    const outils = await import("../src/rendu/outils");
    const gunCote = [...nav.jeu.state.gun];
    const espions = { rotate: vi.fn(), scale: vi.fn(), translate: vi.fn() };
    Object.assign(outils.g, espions);
    nav.jeu.state.scene = "disque";
    nav.image();
    // Les ennemis tournent et grossissent avec leur couloir
    expect(espions.rotate).toHaveBeenCalledWith(0.3);
    expect(espions.scale).toHaveBeenCalledWith(2, 2);
    // Le personnage se tient au point d'impact de la basse : son arme est à la pose, tournée et agrandie
    const basse = penchee.impact("basse");
    expect(espions.translate).toHaveBeenCalledWith(basse.x, basse.y);
    expect(nav.jeu.state.gun).not.toEqual(gunCote);
    const [gx, gy] = nav.jeu.state.gun;
    expect(Math.hypot(gx - basse.x, gy - basse.y)).toBeGreaterThan(Math.hypot(gunCote[0] - 229, gunCote[1] - 505));
  });

  it("ramène tout le dessin dans le cadre de la scène, tout l'écran au clavier", async () => {
    nav = await Navigateur.ouvrir();
    const { cadreDeLaScene } = await import("../src/rendu/geometrie");
    const outils = await import("../src/rendu/outils");
    expect(cadreDeLaScene()).toEqual({ x: 0, y: 0, largeur: outils.W, hauteur: outils.H });
    const setTransform = vi.fn();
    Object.assign(outils.g, { setTransform });
    nav.image();
    expect(setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
  });
});
