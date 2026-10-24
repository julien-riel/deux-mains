// Les effets du jugement : ce que le son et l'image font quand un coup est jugé
import { glisserVoix, harmV, leadTimbre, leadV, playHit, thud, tick } from "../audio/instruments";
import { AC, songNow, timeOfBeat } from "../audio/moteur";
import { TH } from "../univers/univers";
import { casser, pincer } from "../rendu/cordes";
import { scene } from "../rendu/geometrie";
import {
  COL,
  HUE_BASS,
  LANE_HUE,
  PLONGEE,
  POITRINE,
  PW,
  burst,
  popup,
  reduced,
  teinteDeCouloir,
} from "../rendu/outils";
import { froisser } from "../rendu/papier";
import { die } from "./deroulement";
import { S, chordAtBeat, layers, spb } from "./etat";
import { couloirDe, type Effets } from "./jugement";

// L'heure où sonne un coup « tout de suite » : maintenant, ou l'heure où le joueur l'avait joué quand la réécoute
// le rejoue (#23), un peu en avance pour qu'il sonne à l'heure exacte (ADR-0004)
let instant: number | null = null;
const maintenant = () => Math.max(AC.currentTime, instant ?? 0);
/** Fait sonner à l'heure `t` de l'horloge audio les coups joués pendant `f` */
export function aLHeure(t: number, f: () => void) {
  instant = t;
  try {
    f();
  } finally {
    instant = null;
  }
}

// Où se montrent les effets, dans la scène de la partie (ADR-0019) : près du point d'impact d'un couloir, au-dessus
// du personnage (la basse), autour du boss
const couloir = (voie: number) => scene().impact(voie);
const joueur = () => scene().impact("basse");
// Le jugement d'une note de la basse s'affiche au-dessus du personnage
const popupJoueur = (texte: string, couleur: string) => {
  const j = joueur();
  popup(texte, j.x - PW / 2 + 20, j.y - 175, couleur);
};
// Celui d'une note de la mélodie, au-dessus de son couloir, juste après la ligne de tir
const popupCouloir = (texte: string, voie: number, couleur: string) => {
  const c = couloir(voie);
  popup(texte, c.x + 30, c.y - 26, couleur);
};
// Une gerbe d'éclats au point d'impact d'un couloir, décalée de `dx` pixels
const gerbe = (voie: number, n: number, dx = 0) => {
  const c = couloir(voie);
  burst(c.x + dx, c.y, LANE_HUE[voie], n);
};

export const effets: Effets = {
  jouer(ev, beat, lane) {
    playHit(ev, beat === null ? maintenant() : timeOfBeat(beat), lane);
  },
  couper(ev) {
    if (ev.voice) ev.voice.stop(maintenant());
  },
  reussite(ev, perfect, bonus) {
    const label = perfect ? "Parfait" : "Bien",
      color = perfect ? COL.good : COL.fg;
    // La trille réussie (#15) annonce ses points en plus, entre ses deux couloirs
    if (ev.trille !== undefined) {
      const a = couloir(ev.lane),
        y = (a.y + couloir(ev.trille).y) / 2;
      popup(bonus ? `Trille +${bonus}` : "Trille", a.x + 30, y - 26, COL.good);
      pincer(ev.lane, ev.beat, true);
      pincer(ev.trille, ev.beat, true);
      burst(a.x, y, LANE_HUE[ev.lane], 22);
      return;
    }
    if (ev.hand === "L" && ev.lane === 3) {
      // L'écrasement (#8) secoue la scène et projette des éclats au ras du sol
      const j = joueur();
      popupJoueur(label, color);
      burst(j.x, j.y - 4, HUE_BASS, 26);
      S.shake = reduced ? 0 : 7;
    } else if (ev.hand === "L") {
      const j = joueur();
      popupJoueur(label, color);
      burst(j.x, ev.lane === 0 || ev.lane === 5 ? j.y - 55 : j.y - 20, HUE_BASS, 8);
    } else {
      // Une petite note (#14) éclate moins, entre ses deux couloirs
      const petite = !Number.isInteger(ev.lane),
        c = couloir(ev.lane);
      popupCouloir(label, ev.lane, color);
      burst(c.x, c.y, teinteDeCouloir(ev.lane), petite ? 8 : 16);
      // Le tir réussi pince la corde de son couloir (#78)
      pincer(ev.lane, ev.beat, perfect);
    }
  },
  accord(grp) {
    const haut = couloir(3);
    popup(grp.some((e) => e.hand === "L") ? "Accord à deux mains" : "Accord", haut.x + 140, haut.y - 30, COL.good);
  },
  rate(ev) {
    ev.missAt = performance.now();
    if (ev.hand === "L") {
      S.hurtAt = performance.now();
      S.shake = reduced ? 0 : 9;
      thud();
      popupJoueur("Aïe", COL.bad);
      const j = joueur();
      froisser(j.x, j.y - 60, performance.now());
    } else {
      popupCouloir("Raté", ev.lane, COL.bad);
      // Le raté froisse le papier et casse la corde de son couloir, qui se renoue (#78)
      const c = couloir(ev.lane);
      froisser(c.x, c.y, performance.now());
      casser(ev.lane, ev.beat);
      // L'ennemi raté plonge sur le joueur : il le frappe à la fin de sa plongée. Ce n'est qu'une image, les
      // dégâts tombent au raté ; une petite note (#14) ne plonge pas. Le choc sonne à l'heure de l'horloge audio
      // (ADR-0004), l'image le suit
      if (Number.isInteger(ev.lane)) {
        thud(maintenant() + PLONGEE / 1000);
        setTimeout(() => {
          S.hurtAt = performance.now();
          S.shake = reduced ? 0 : 6;
          const j = joueur();
          popupJoueur("Aïe", COL.bad);
          burst(j.x, j.y - POITRINE, 355, 12);
        }, PLONGEE);
      }
    }
  },
  lache(ev) {
    // Le serpent (#16) casse sur le couloir où il en était
    if (ev.hand === "L") popupJoueur("Lâché", COL.bad);
    else popupCouloir("Lâché", couloirDe(ev), COL.bad);
  },
  mauvaisCouloir(lane) {
    tick();
    popupCouloir("Mauvais couloir", lane, COL.bad);
  },
  solo(lane, nb) {
    const ch = chordAtBeat(nb);
    leadV(maintenant(), ch.lanes[lane], 0, leadTimbre("refrain"));
    if (layers().choir) harmV(maintenant(), lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12);
    gerbe(lane, 10, 40);
  },
  vibrato(ev, points) {
    ev.voice?.vibrer?.(maintenant());
    ev.vibreAt = performance.now();
    if (points) popupCouloir(`Vibrato +${points}`, ev.lane, COL.good);
  },
  trille(ev, lane) {
    ev.trilleAt = performance.now();
    gerbe(lane, 4);
  },
  glisser(ev, k, beat) {
    glisserVoix(ev, k, beat === null ? maintenant() : timeOfBeat(beat));
  },
  passage(ev, k, parfait) {
    const lane = ev.serpent[k];
    if (parfait === null) {
      tick();
      popupCouloir("Raté", lane, COL.bad);
      casser(lane, songNow() / spb());
      return;
    }
    ev.passeAt = performance.now();
    popupCouloir(parfait ? "Parfait" : "Bien", lane, parfait ? COL.good : COL.fg);
    gerbe(lane, 10);
    pincer(lane, songNow() / spb(), parfait);
  },
  phrase(notes, points) {
    // La réponse au chanteur (#18) entièrement juste : une gerbe dans chaque couloir de la phrase
    const haut = couloir(3);
    popup(`Phrase juste +${points}`, haut.x + 30, haut.y - 40, COL.good);
    for (const lane of new Set(notes.map((n) => n.lane))) gerbe(lane, 14);
  },
  relais(notes, points) {
    // Le relais réussi (#20) : le bonus entre les deux mains, et une gerbe de chaque côté du passage
    const m = notes.filter((n) => n.hand === "R");
    const bas = couloir(0),
      j = joueur();
    popup(`Relais +${points}`, bas.x + 30, bas.y + 44, COL.good);
    gerbe(m[m.length - 1].lane, 14);
    burst(j.x, j.y - 20, HUE_BASS, 14);
  },
  canon(notes, points, touche) {
    // La phrase du canon rejouée juste (#26) : le bonus, une gerbe dans chaque couloir, et le boss touché recule
    const haut = couloir(3);
    popup(`Canon +${points}`, haut.x + 30, haut.y - 40, COL.good);
    for (const lane of new Set(notes.map((n) => n.lane))) gerbe(lane, 10);
    if (!touche || !S.boss) return;
    S.boss.toucheAt = performance.now();
    const boss = scene().boss;
    burst(boss.x - 40, boss.y, LANE_HUE[notes[notes.length - 1].lane], 18);
  },
  bossVaincu(points) {
    // Le boss tombe (#26) : il se tait, la scène tremble, et le joueur finit le canon seul
    const boss = scene().boss;
    popup(`Victoire +${points}`, boss.x - 60, boss.y - 110, COL.good);
    for (const hue of LANE_HUE) burst(boss.x, boss.y, hue, 22);
    S.shake = reduced ? 0 : 10;
    S.banner = { text: TH().boss.nom, sub: TH().boss.vaincu, at: performance.now() };
  },
  tir(lane, ok) {
    const at = performance.now();
    S.laneFlash[lane] = at;
    S.beams.push({ lane, at, ok });
  },
  // La réécoute (#23) va au bout de la chanson : une mort de la partie y a déjà été suivie d'une reprise
  mourir: () => {
    if (!S.relecture) die();
  },
};
