// La scène du disque (#80, ADR-0019) : le temps est un angle. Ses poses (une note est au point d'impact de son
// anneau au moment de son temps, les anneaux étagés au-dessus du personnage), son champ, le mouvement réduit, le
// niveau du boss de fin qui s'y joue, et le dessin de ce qui dure le long des anneaux, dans le faux navigateur.

import { afterEach, describe, expect, it, vi } from "vitest";
import { sceneDuLieu } from "../src/jeu/scenes";
import type { Pose, Scene, Voie } from "../src/rendu/scenes/contrat";
import { Navigateur, type Univers } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

const VOIES: Voie[] = [0, 1, 2, 3, 0.5, 1.5, 2.5, "chanteur", "basse"];
const COULOIRS = [0, 1, 2, 3];

async function module(options = {}) {
  nav = await Navigateur.ouvrir(options);
  return import("../src/rendu/scenes/disque");
}
// Le centre du disque : là où se croisent les normales du bord
function centre(sc: Scene) {
  const haut = sc.impact("basse"),
    r = Math.hypot(sc.poser(3, "basse", 0).x - haut.x, sc.poser(3, "basse", 0).y - haut.y);
  return { r, haut };
}
const distance = (p: Pose, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

describe("les poses du disque", () => {
  it("pose une note au point d'impact de sa voie au moment de son temps", async () => {
    const { DISQUE } = await module();
    for (const nb of [0, 13.37, 250, 1000.5])
      for (const voie of VOIES) {
        const p = DISQUE.poser(nb, voie, nb),
          i = DISQUE.impact(voie);
        expect(p.x).toBeCloseTo(i.x, 6);
        expect(p.y).toBeCloseTo(i.y, 6);
        expect([p.echelle, p.angle, p.visible]).toEqual([i.echelle, i.angle, i.visible]);
        expect(p.visible).toBe(true);
      }
  });

  it("étage les points d'impact sur une ligne verticale au-dessus du personnage : la fondamentale au plus près", async () => {
    const { DISQUE, ANNEAUX, rayonDe } = await module();
    const y = (v: Voie) => DISQUE.impact(v).y,
      x = DISQUE.impact("basse").x;
    for (const v of VOIES) expect(DISQUE.impact(v).x).toBeCloseTo(x, 9);
    expect([y("basse"), y(0), y(0.5), y(1), y(1.5), y(2), y(2.5), y(3), y("chanteur")]).toEqual(
      [y("basse"), y(0), y(0.5), y(1), y(1.5), y(2), y(2.5), y(3), y("chanteur")].sort((a, b) => b - a),
    );
    // Le centre est sous le personnage, à la distance du rayon du disque ; chaque couloir est à celle de son anneau
    const cy = y("basse") + rayonDe("basse");
    COULOIRS.forEach((i) => expect(cy - y(i)).toBeCloseTo(ANNEAUX[i], 9));
    expect(rayonDe(1.5)).toBe((ANNEAUX[1] + ANNEAUX[2]) / 2);
    // Debout, le personnage et les ennemis à la ligne de jugement
    expect(DISQUE.impact("basse").angle).toBe(0);
    expect(DISQUE.impact(2).angle).toBe(0);
  });

  it("fait tourner une note sur son anneau, d'un angle fixe par temps, dans le sens inverse des aiguilles", async () => {
    const { DISQUE, VITESSE, ANNEAUX } = await module();
    const { haut, r } = centre(DISQUE),
      c = { x: haut.x, y: haut.y + 200 };
    expect(r).toBeGreaterThan(0);
    for (const i of COULOIRS) {
      const ici = DISQUE.poser(10, i, 10),
        avant = DISQUE.poser(11, i, 10);
      // Sur son anneau, un temps plus tôt sur le cercle : à droite du sommet, plus bas
      expect(distance(avant, c)).toBeCloseTo(ANNEAUX[i], 6);
      expect(avant.x).toBeGreaterThan(ici.x);
      expect(avant.y).toBeGreaterThan(ici.y);
      const a = Math.atan2(ici.y - c.y, ici.x - c.x) - Math.atan2(avant.y - c.y, avant.x - c.x);
      expect(a).toBeCloseTo(-VITESSE, 9);
    }
    // Pour le même tempo, une note de l'anneau du dehors avance plus vite à l'écran que celle du dedans
    const pas = (i: number) => distance(DISQUE.poser(1, i, 0), DISQUE.impact(i));
    expect(pas(3)).toBeGreaterThan(pas(0));
    // Les obstacles se tiennent debout sur le bord : leur angle suit la rotation
    expect(DISQUE.poser(1, "basse", 0).angle).toBeCloseTo(VITESSE, 9);
  });

  it("montre ce qui entre à droite du disque, et oublie ce qui sort à gauche", async () => {
    const { DISQUE } = await module();
    for (const voie of VOIES) {
      const entree = DISQUE.poser(DISQUE.avance - 1e-6, voie, 0);
      expect(entree.visible).toBe(true);
      expect(entree.x).toBeGreaterThan(DISQUE.impact(voie).x);
      expect(DISQUE.horsChamp(entree, "devant", 0)).toBe(false);
      // Une note qui naît est petite, et grandit en approchant
      expect(entree.echelle).toBeLessThan(DISQUE.impact(voie).echelle);
      const loin = DISQUE.poser(DISQUE.avance + 1, voie, 0);
      expect([loin.visible, DISQUE.horsChamp(loin, "devant", 20), DISQUE.horsChamp(loin, "derriere", 20)]).toEqual([
        false,
        true,
        false,
      ]);
      const passee = DISQUE.poser(-5, voie, 0);
      expect([
        passee.visible,
        DISQUE.horsChamp(passee, "derriere", 20),
        DISQUE.horsChamp(passee, "devant", 20),
      ]).toEqual([false, true, false]);
      expect(DISQUE.horsChamp(DISQUE.poser(-1, voie, 0), "derriere", 40)).toBe(false);
    }
    // Près de quatre temps à l'avance, comme la scène de côté en montre six sur une ligne plus longue
    expect(DISQUE.avance).toBeCloseTo(3.75, 9);
  });
});

describe("le mouvement réduit", () => {
  it("ralentit la rotation et montre plus de temps à l'avance", async () => {
    const { disque, VITESSE, VITESSE_REDUITE } = await module();
    const vite = disque(VITESSE, false),
      lent = disque(VITESSE_REDUITE, true),
      angle = (sc: Scene) => sc.poser(1, "basse", 0).angle;
    expect(VITESSE_REDUITE).toBeLessThan(VITESSE);
    expect(angle(lent)).toBeLessThan(angle(vite));
    expect(lent.avance).toBeGreaterThan(vite.avance);
    // Les points d'impact ne bougent pas
    for (const v of VOIES) expect(lent.impact(v)).toEqual(vite.impact(v));
  });

  it("supprime le vacillement du disque après un raté", async () => {
    const { vacillement } = await module();
    const rates = [{ beat: 10, voie: 2 as Voie, at: 1000 }];
    const v = vacillement(rates, 1100, false);
    expect(Math.abs(v.a) + Math.abs(v.dy)).toBeGreaterThan(0);
    expect(vacillement(rates, 1100, true)).toEqual({ a: 0, dy: 0 });
    // Il s'amortit en une seconde, et rien sans raté
    expect(vacillement(rates, 2100, false)).toEqual({ a: 0, dy: 0 });
    expect(vacillement([], 1100, false)).toEqual({ a: 0, dy: 0 });
  });

  it("suit le réglage « Mouvement réduit » du navigateur", async () => {
    const { DISQUE: lent, VITESSE_REDUITE } = await module({ mouvementReduit: true });
    expect(lent.poser(1, "basse", 0).angle).toBeCloseTo(VITESSE_REDUITE, 9);
    nav.fermer();
    const { DISQUE: vite, VITESSE } = await module();
    expect(vite.poser(1, "basse", 0).angle).toBeCloseTo(VITESSE, 9);
  });
});

describe.each<Univers>(["ville", "boite"])("le niveau du boss de fin, %s", (univers) => {
  it("s'ouvre dans la scène du disque, et l'auto-play le termine sans faute", async () => {
    nav = await Navigateur.ouvrir();
    const S = nav.jeu.state,
      { scene } = await import("../src/rendu/geometrie");
    nav.jeu.setTheme(univers);
    nav.jeu.load(4242, "normal", true);
    expect([S.scene, scene().id]).toEqual(["disque", "disque"]);
    nav.presser("KeyA");
    nav.avancerJusqua((s) => s.mode !== "play", (S.song.endBeat * 60) / S.song.bpm + 10);
    expect([S.mode, S.miss, S.health, S.boss.vie]).toEqual(["done", 0, 100, 0]);
    // La chanson suivante revient à la scène de son lieu (#83)
    nav.jeu.load(4242, "normal");
    expect(S.scene).toBe(sceneDuLieu(S.song.prog.name));
  });
});

describe("le dessin sur le disque", () => {
  it("montre les essais du disque dès la première mesure, et les dessine sans erreur", async () => {
    for (const id of ["disque-ville", "disque-boite"]) {
      nav = await Navigateur.ouvrir({ adresse: { search: `?essai=${id}` } });
      expect(nav.jeu.state.scene).toBe("disque");
      nav.presser("KeyA");
      nav.avancerJusqua(() => nav.horloge.secondes > 4, 6);
      expect(nav.jeu.state.mode).toBe("play");
      const { scene } = await import("../src/rendu/geometrie");
      expect(scene().id).toBe("disque");
      nav.fermer();
    }
  });

  it("courbe une note tenue le long de son anneau, et grave les traces et les ratés", async () => {
    nav = await Navigateur.ouvrir({ adresse: { search: "?essai=disque-ville" } });
    const S = nav.jeu.state;
    nav.presser("KeyA");
    // Jusqu'au refrain, où les notes tenues et les trilles arrivent
    nav.avancerJusqua(() => nav.jeu.songNow() / (60 / S.song.bpm) > 6 * 4 - 2, 30);
    const outils = await import("../src/rendu/outils");
    const arcs = vi.fn(),
      lignes = vi.fn();
    Object.assign(outils.g, { arc: arcs, lineTo: lignes, clip: vi.fn() });
    // Un raté récent et une trace fraîche
    const note = S.ev.find(
      (e) => e.hand === "R" && e.beat < nav.jeu.songNow() / (60 / S.song.bpm) && e.state !== "miss",
    );
    Object.assign(note, { state: "miss", missAt: performance.now() });
    nav.image();
    // Les anneaux et le bord sont des arcs autour du centre du disque
    const { DISQUE, ANNEAUX } = await import("../src/rendu/scenes/disque");
    const cx = DISQUE.impact("basse").x;
    expect(arcs.mock.calls.some(([x, , r]) => x === cx && r === ANNEAUX[3])).toBe(true);
    // Les bandes des notes tenues sont tracées point par point, et non d'un rectangle droit
    expect(lignes.mock.calls.length).toBeGreaterThan(50);
  });
});
