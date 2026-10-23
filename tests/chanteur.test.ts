// Chanteur (#18) : un ennemi chante quatre notes sur une mesure, et le joueur les répète de mémoire sur la mesure
// suivante, sur des silhouettes dont le couloir ne se révèle qu'au coup. Parcours au clavier dans le faux
// navigateur, sur l'essai « chanteur » (la main gauche en auto-play), et en boucle sur le couplet (ADR-0009).

import { afterEach, describe, expect, it } from "vitest";
import type { Note } from "../src/chanson/types";
import { CHANTEUR } from "../src/jeu/jugement";
import { LANE_CODES } from "../src/ui/touches";
import { Navigateur } from "./support/navigateur";

let nav: Navigateur;
afterEach(() => nav?.fermer());

const temps = () => (nav.jeu.songNow() * nav.jeu.state.song.bpm * nav.jeu.state.vitessePartie) / 60;
const attendre = (beat: number) => nav.avancerJusqua(() => temps() >= beat, 60);
function taper(code: string) {
  nav.presser(code);
  nav.image();
  nav.relacher(code);
}

/** L'essai lancé, et la réponse au premier chanteur */
async function essai() {
  nav = await Navigateur.ouvrir({ adresse: { search: "?essai=chanteur" } });
  nav.presser("Space");
  const S = nav.jeu.state,
    [ch] = S.song.chanteurs,
    reponse = S.ev.filter((ev) => ev.reponse && ev.bar === ch.bar + 1);
  return { S, ch, reponse };
}
/** Joue chaque note de la réponse sur son temps, dans le couloir donné (le sien par défaut) */
function repondre(reponse: Note[], couloir = (ev: Note) => ev.lane) {
  for (const ev of reponse) {
    attendre(ev.beat);
    taper(LANE_CODES[couloir(ev)]);
  }
}

describe("chanteur au clavier", () => {
  it("pendant que le chanteur chante, il n'y a rien à jouer : tirer ne rate rien et ne réussit rien", async () => {
    const { S, ch } = await essai();
    for (const n of ch.notes) {
      attendre(n.beat);
      taper(LANE_CODES[n.lane]);
    }
    attendre(ch.bar * 4 + 4 - 0.3);
    const R = S.parMain.R;
    expect([R.perfect, R.good, R.miss, S.health]).toEqual([0, 0, 0, 100]);
  });

  it("à l'écran : « ÉCOUTE » pendant qu'il chante, puis « RÉPÈTE » pendant la réponse", async () => {
    const { ch } = await essai();
    attendre(ch.bar * 4 + 1);
    nav.image();
    expect(nav.textes).toContain("ÉCOUTE");
    // Les silhouettes de la réponse arrivent déjà, sans couloir : un point d'interrogation chacune
    expect(nav.textes.filter((t) => t === "?").length).toBe(4);
    attendre(ch.bar * 4 + 5);
    nav.image();
    expect(nav.textes).toContain("RÉPÈTE");
  });

  it("rejouer la phrase dans les bons couloirs réussit les quatre silhouettes et donne le bonus", async () => {
    const { S, reponse } = await essai();
    repondre(reponse);
    nav.image();
    expect(reponse.map((ev) => ev.state)).toEqual(["hit", "hit", "hit", "hit"]);
    expect([S.miss, S.health]).toEqual([0, 100]);
    expect(S.pops.some((p) => p.text === `Phrase juste +${CHANTEUR.bonus}`)).toBe(true);
  });

  it("un mauvais couloir rate la silhouette, et la phrase n'a pas de bonus", async () => {
    const { S, reponse } = await essai();
    repondre(reponse, (ev) => (ev === reponse[1] ? (ev.lane + 1) % 3 : ev.lane));
    nav.image();
    expect(reponse.map((ev) => ev.state)).toEqual(["hit", "miss", "hit", "hit"]);
    expect([S.miss, S.health < 100]).toEqual([1, true]);
    expect(S.pops.some((p) => p.text.startsWith("Phrase juste"))).toBe(false);
  });
});

describe("chanteur en boucle (ADR-0009)", () => {
  it("en boucle sur le couplet, chaque passage a son chanteur et sa réponse, que l'auto-play réussit", async () => {
    nav = await Navigateur.ouvrir();
    nav.jeu.load(4242, "facile");
    const couplet = nav.jeu.state.song.sections.findIndex((s) => s.kind === "couplet");
    nav.jeu.setBoucle(couplet);
    const S = nav.jeu.state,
      sec = S.song.sections[couplet],
      [ch] = S.song.chanteurs;
    nav.presser("KeyA");
    const deuxieme = (ch.bar + sec.bars + 1) * 4;
    attendre(deuxieme + 4);
    const reponses = S.ev.filter((ev) => ev.reponse && ev.state !== "pending");
    // Le premier passage est retiré une fois sorti de l'écran ; le deuxième vient d'être joué
    const passage2 = reponses.filter((ev) => ev.passage === 1);
    expect(passage2.map((ev) => [ev.state, ev.bar, ev.lane])).toEqual(
      ch.notes.map((n) => ["hit", ch.bar + sec.bars + 1, n.lane]),
    );
    expect(S.miss).toBe(0);
  });
});
