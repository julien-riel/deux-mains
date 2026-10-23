// Serpent (#16) : un ennemi qui traverse les couloirs ; on le suit au rayon d'une touche à l'autre, et le son glisse
// de note en note. Parcours au clavier dans le faux navigateur, sur l'essai « serpent », la main gauche en auto-play.

import { afterEach, describe, expect, it } from "vitest";
import { mtof } from "../src/chanson/theorie";
import { LANE_CODES } from "../src/ui/touches";
import { evenementsClavier, faire } from "./support/appuis";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

const spb = () => 60 / nav.jeu.state.song.bpm;
function attendre(t: number) {
  while (nav.jeu.songNow() < t) nav.image(t - nav.jeu.songNow() > 0.02 ? 1 / 60 : 0.001);
}

async function ouvrirEssai() {
  nav = await Navigateur.ouvrir({ adresse: { search: "?essai=serpent" } });
  nav.presser("Space");
  const S = nav.jeu.state;
  return { S, sp: S.ev.find((ev) => ev.serpent && ev.serpent.length === 4) };
}

describe("serpent au clavier", () => {
  it("suivi touche par touche, chaque passage est jugé et la même voix glisse par chaque note, sans se couper", async () => {
    const { S, sp } = await ouvrirEssai();
    // Le joueur parfait enfonce la touche du couloir suivant avant de lever l'ancienne
    for (const e of evenementsClavier(
      [sp],
      (beat) => beat * spb(),
      (_, lane) => LANE_CODES[lane],
    )) {
      attendre(e.at);
      faire(nav, e);
      if (e.geste === "presser") expect(sp.state).toBe("holding");
    }
    attendre((sp.beat + sp.dur) * spb() + 0.05);
    // La tête et ses trois passages : quatre « Parfait » pour la main droite (la gauche joue toute seule)
    expect([sp.state, sp.troncon, S.parMain.R.perfect, S.miss, S.health]).toEqual(["done", 3, 4, 0, 100]);
    // La voix de la tête glisse jusqu'à la note de chaque couloir, à l'heure de chaque passage (sur l'horloge audio)
    const audio = nav.horloge.audio - nav.jeu.songNow();
    for (let k = 1; k < 4; k++) {
      const vers = mtof(sp.midiSerpent[k]),
        heure = (sp.beat + (k * sp.dur) / 4) * spb() + audio;
      expect(
        nav.horloge.glissements.some((g) => Math.abs(g.vers - vers) < 0.01 && Math.abs(g.debut - heure) < 0.02),
      ).toBe(true);
    }
  });

  it("tout lâcher casse le serpent, avec les dégâts d'une note tenue lâchée", async () => {
    const { S, sp } = await ouvrirEssai();
    attendre(sp.beat * spb());
    nav.presser(LANE_CODES[sp.lane]);
    attendre((sp.beat + sp.dur / 8) * spb());
    nav.relacher(LANE_CODES[sp.lane]);
    expect([sp.state, S.combo, S.health]).toEqual(["broken", 0, 94]);
    expect(S.pops.some((p) => p.text === "Lâché")).toBe(true);
  });

  it("la pause pendant un serpent le compte comme réussi", async () => {
    const { S, sp } = await ouvrirEssai();
    attendre(sp.beat * spb());
    nav.presser(LANE_CODES[sp.lane]);
    nav.presser("Escape");
    expect([S.mode, sp.state, S.miss, S.health]).toEqual(["pause", "done", 0, 100]);
  });

  it("rejouer l'essai remet chaque serpent à son premier couloir", async () => {
    const { sp } = await ouvrirEssai();
    attendre(sp.beat * spb());
    nav.presser(LANE_CODES[sp.lane]);
    attendre((sp.beat + sp.dur / 4) * spb() - 0.01);
    nav.presser(LANE_CODES[sp.serpent[1]]);
    expect(sp.troncon).toBe(1);
    nav.presser("Escape");
    nav.presser("Enter");
    expect(nav.jeu.state.song.ev.every((ev) => ev.troncon === undefined && ev.lacheAt === undefined)).toBe(true);
  });
});
