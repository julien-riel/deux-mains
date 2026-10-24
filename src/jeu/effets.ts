// Les effets du jugement : ce que le son et l'image font quand un coup est jugé
import { glisserVoix, harmV, leadTimbre, leadV, playHit, thud, tick } from "../audio/instruments";
import { AC, timeOfBeat } from "../audio/moteur";
import { TH } from "../univers/univers";
import {
  BOSS_X,
  BOSS_Y,
  COL,
  CIBLE_Y,
  GY,
  HITX,
  HUE_BASS,
  LANE_HUE,
  LANE_Y,
  PLONGEE,
  PW,
  PX,
  burst,
  popup,
  reduced,
  teinteDeCouloir,
  yDeCouloir,
} from "../rendu/outils";
import { die } from "./deroulement";
import { S, chordAtBeat, layers } from "./etat";
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
      const y = (LANE_Y[ev.lane] + LANE_Y[ev.trille]) / 2;
      popup(bonus ? `Trille +${bonus}` : "Trille", HITX + 30, y - 26, COL.good);
      burst(HITX, y, LANE_HUE[ev.lane], 22);
      return;
    }
    if (ev.hand === "L" && ev.lane === 3) {
      // L'écrasement (#8) secoue la scène et projette des éclats au ras du sol
      popup(label, PX + 20, GY - 140, color);
      burst(PX + PW / 2, GY - 4, HUE_BASS, 26);
      S.shake = reduced ? 0 : 7;
    } else if (ev.hand === "L") {
      popup(label, PX + 20, GY - 140, color);
      burst(PX + PW / 2, ev.lane === 0 || ev.lane === 5 ? GY - 55 : GY - 20, HUE_BASS, 8);
    } else {
      // Une petite note (#14) éclate moins, entre ses deux couloirs
      const petite = !Number.isInteger(ev.lane);
      popup(label, HITX + 30, yDeCouloir(ev.lane) - 26, color);
      burst(HITX, yDeCouloir(ev.lane), teinteDeCouloir(ev.lane), petite ? 8 : 16);
    }
  },
  accord(grp) {
    popup(grp.some((e) => e.hand === "L") ? "Accord à deux mains" : "Accord", HITX + 140, LANE_Y[3] - 30, COL.good);
  },
  rate(ev) {
    ev.missAt = performance.now();
    if (ev.hand === "L") {
      S.hurtAt = performance.now();
      S.shake = reduced ? 0 : 9;
      thud();
      popup("Aïe", PX + 20, GY - 140, COL.bad);
    } else {
      popup("Raté", HITX + 30, yDeCouloir(ev.lane) - 26, COL.bad);
      // L'ennemi raté plonge sur le joueur : il le frappe à la fin de sa plongée. Ce n'est qu'une image, les
      // dégâts tombent au raté ; une petite note (#14) ne plonge pas. Le choc sonne à l'heure de l'horloge audio
      // (ADR-0004), l'image le suit
      if (Number.isInteger(ev.lane)) {
        thud(maintenant() + PLONGEE / 1000);
        setTimeout(() => {
          S.hurtAt = performance.now();
          S.shake = reduced ? 0 : 6;
          popup("Aïe", PX + 20, GY - 140, COL.bad);
          burst(PX + PW / 2, CIBLE_Y, 355, 12);
        }, PLONGEE);
      }
    }
  },
  lache(ev) {
    // Le serpent (#16) casse sur le couloir où il en était
    popup(
      "Lâché",
      ev.hand === "L" ? PX + 20 : HITX + 30,
      ev.hand === "L" ? GY - 140 : LANE_Y[couloirDe(ev)] - 26,
      COL.bad,
    );
  },
  mauvaisCouloir(lane) {
    tick();
    popup("Mauvais couloir", HITX + 30, LANE_Y[lane] - 26, COL.bad);
  },
  solo(lane, nb) {
    const ch = chordAtBeat(nb);
    leadV(maintenant(), ch.lanes[lane], 0, leadTimbre("refrain"));
    if (layers().choir) harmV(maintenant(), lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12);
    burst(HITX + 40, LANE_Y[lane], LANE_HUE[lane], 10);
  },
  vibrato(ev, points) {
    ev.voice?.vibrer?.(maintenant());
    ev.vibreAt = performance.now();
    if (points) popup(`Vibrato +${points}`, HITX + 30, LANE_Y[ev.lane] - 26, COL.good);
  },
  trille(ev, lane) {
    ev.trilleAt = performance.now();
    burst(HITX, LANE_Y[lane], LANE_HUE[lane], 4);
  },
  glisser(ev, k, beat) {
    glisserVoix(ev, k, beat === null ? maintenant() : timeOfBeat(beat));
  },
  passage(ev, k, parfait) {
    const lane = ev.serpent[k],
      y = LANE_Y[lane] - 26;
    if (parfait === null) {
      tick();
      popup("Raté", HITX + 30, y, COL.bad);
      return;
    }
    ev.passeAt = performance.now();
    popup(parfait ? "Parfait" : "Bien", HITX + 30, y, parfait ? COL.good : COL.fg);
    burst(HITX, LANE_Y[lane], LANE_HUE[lane], 10);
  },
  phrase(notes, points) {
    // La réponse au chanteur (#18) entièrement juste : une gerbe dans chaque couloir de la phrase
    popup(`Phrase juste +${points}`, HITX + 30, LANE_Y[3] - 40, COL.good);
    for (const lane of new Set(notes.map((n) => n.lane))) burst(HITX, LANE_Y[lane], LANE_HUE[lane], 14);
  },
  relais(notes, points) {
    // Le relais réussi (#20) : le bonus entre les deux mains, et une gerbe de chaque côté du passage
    const m = notes.filter((n) => n.hand === "R");
    popup(`Relais +${points}`, HITX + 30, LANE_Y[0] + 44, COL.good);
    burst(HITX, LANE_Y[m[m.length - 1].lane], LANE_HUE[m[m.length - 1].lane], 14);
    burst(PX + PW / 2, GY - 20, HUE_BASS, 14);
  },
  canon(notes, points, touche) {
    // La phrase du canon rejouée juste (#26) : le bonus, une gerbe dans chaque couloir, et le boss touché recule
    popup(`Canon +${points}`, HITX + 30, LANE_Y[3] - 40, COL.good);
    for (const lane of new Set(notes.map((n) => n.lane))) burst(HITX, LANE_Y[lane], LANE_HUE[lane], 10);
    if (!touche || !S.boss) return;
    S.boss.toucheAt = performance.now();
    burst(BOSS_X - 40, BOSS_Y, LANE_HUE[notes[notes.length - 1].lane], 18);
  },
  bossVaincu(points) {
    // Le boss tombe (#26) : il se tait, la scène tremble, et le joueur finit le canon seul
    popup(`Victoire +${points}`, BOSS_X - 60, BOSS_Y - 110, COL.good);
    for (const hue of LANE_HUE) burst(BOSS_X, BOSS_Y, hue, 22);
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
