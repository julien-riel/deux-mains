// Les effets du jugement : ce que le son et l'image font quand un coup est jugé
import { glisserVoix, harmV, leadTimbre, leadV, playHit, thud, tick } from "../audio/instruments";
import { AC, timeOfBeat } from "../audio/moteur";
import { COL, GY, HITX, HUE_BASS, LANE_HUE, LANE_Y, PW, PX, burst, popup, reduced } from "../rendu/outils";
import { die } from "./deroulement";
import { S, chordAtBeat, layers } from "./etat";
import { couloirDe, type Effets } from "./jugement";

export const effets: Effets = {
  jouer(ev, beat, lane) {
    playHit(ev, beat === null ? AC.currentTime : timeOfBeat(beat), lane);
  },
  couper(ev) {
    if (ev.voice) ev.voice.stop(AC.currentTime);
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
      burst(PX + PW / 2, ev.lane ? GY - 20 : GY - 55, HUE_BASS, 8);
    } else {
      popup(label, HITX + 30, LANE_Y[ev.lane] - 26, color);
      burst(HITX, LANE_Y[ev.lane], LANE_HUE[ev.lane], 16);
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
      popup("Raté", HITX + 30, LANE_Y[ev.lane] - 26, COL.bad);
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
    leadV(AC.currentTime, ch.lanes[lane], 0, leadTimbre("refrain"));
    if (layers().choir) harmV(AC.currentTime, lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12);
    burst(HITX + 40, LANE_Y[lane], LANE_HUE[lane], 10);
  },
  vibrato(ev, points) {
    ev.voice?.vibrer?.(AC.currentTime);
    ev.vibreAt = performance.now();
    if (points) popup(`Vibrato +${points}`, HITX + 30, LANE_Y[ev.lane] - 26, COL.good);
  },
  trille(ev, lane) {
    ev.trilleAt = performance.now();
    burst(HITX, LANE_Y[lane], LANE_HUE[lane], 4);
  },
  glisser(ev, k, beat) {
    glisserVoix(ev, k, beat === null ? AC.currentTime : timeOfBeat(beat));
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
  tir(lane, ok) {
    const at = performance.now();
    S.laneFlash[lane] = at;
    S.beams.push({ lane, at, ok });
  },
  mourir: () => die(),
};
