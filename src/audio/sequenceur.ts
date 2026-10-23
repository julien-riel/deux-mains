/* ---------- Séquenceur (double-croches) ---------- */
import { autoNotes, autoSerpents, autoSolo, autoTrilles } from "../jeu/autoplay";
import { S, layers, mesureDeLaChanson, sansFin, sectionAtBar, spb, uneMain } from "../jeu/etat";
import {
  arpV,
  bossV,
  chantV,
  click,
  crash,
  glisserVoix,
  harmV,
  hat,
  kick,
  leadTimbre,
  leadV,
  padV,
  playHit,
  snare,
  stringsV,
} from "./instruments";
import { AC, timeOfBeat } from "./moteur";
import { PAS_PAR_TEMPS, pas } from "../chanson/temps";

export function startScheduler() {
  stopScheduler();
  S.timer = setInterval(schedule, 25);
  schedule();
}
export function stopScheduler() {
  if (S.timer) clearInterval(S.timer);
  S.timer = 0;
}
export function schedule() {
  if (S.mode !== "play") return;
  // En boucle et en jam, la partie n'a pas de fin : le séquenceur continue dans le passage suivant (ADR-0009)
  const ahead = AC.currentTime + 0.12,
    last = sansFin() ? Infinity : S.song.totalBars * 16;
  while (S.nextStep < last) {
    const t = timeOfBeat(S.nextStep / 4);
    if (t > ahead) break;
    if (t >= AC.currentTime - 0.02) playStep(S.nextStep, t);
    S.nextStep++;
  }
}
export const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
// La mesure qui précède un refrain (#8), en mesures de la partie : en boucle, elle précède chaque passage (ADR-0009).
// En jam (#24), il n'y a pas de plaque pour relancer le refrain : l'accompagnement ne se tait jamais.
export function avantRefrain(bar: number) {
  if (S.jam) return false;
  const suivante = sectionAtBar(bar + 1);
  return suivante.kind === "refrain" && mesureDeLaChanson(bar + 1) === suivante.start;
}
export function playStep(step, t) {
  const bar = mesureDeLaChanson(Math.floor(step / 16)),
    s = step % 16,
    sec = sectionAtBar(bar),
    ch = S.song.chords[bar],
    beat = spb(),
    avant = avantRefrain(Math.floor(step / 16));
  chanter(bar, s, t);
  jouerLeBoss(bar, s, t);
  if (s === 0) {
    // La nappe s'éteint avant le dernier temps, sa queue comprise
    if (sec.kind !== "outro") padV(t, ch, avant ? 3 * beat - 0.5 : 4 * beat);
    else if (bar === sec.start) padV(t, ch, 8 * beat);
  }
  // Le « drop » : l'accompagnement se tait pendant le dernier temps avant le refrain, que l'écrasement relance
  if (avant && s >= 12) return autoStep(step, t, sec, ch);
  switch (sec.kind) {
    case "intro":
      if (s === 0) kick(t, 0.7);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.11 : 0.07, false);
      if (bar === sec.start + sec.bars - 1 && s % 4 === 0) click(t, s === 0);
      break;
    case "couplet":
      if (s === 0 || s === 8) kick(t);
      if (s === 4 || s === 12) snare(t);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.13 : 0.08, false);
      break;
    case "refrain":
      // La cymbale du premier temps vient de l'écrasement (#8) : ratée, elle ne sonne pas
      if (s % 4 === 0) kick(t);
      if (s === 4 || s === 12) snare(t, 0.34);
      if (s % 4 === 2) hat(t, 0.12, true);
      else if (s % 2 === 0) hat(t, 0.07, false);
      break;
    case "pont":
      if (s === 0) kick(t, 0.6);
      if (s % 2 === 0) hat(t, 0.06, false);
      break;
    case "polyrythmie":
      // En 3 contre 2 (#19), la batterie ne marque que ce que les deux mains partagent : la grosse caisse sur chaque
      // temps, la caisse claire légère sur 2 et 4, et le charleston discret sur les croches de la mélodie. Les
      // triolets, seule la basse les joue.
      if (s % 4 === 0) kick(t, s === 0 ? 0.85 : 0.55);
      if (s === 4 || s === 12) snare(t, 0.22);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.09 : 0.05, false);
      break;
    case "outro":
      if (s === 0 && bar === sec.start) {
        crash(t, 0.24);
        kick(t);
      }
      break;
  }
  if (sec.kind !== "intro" && sec.kind !== "outro") {
    const L = layers();
    // En 3 contre 2, l'arpège ne joue que sur les temps, pour ne pas brouiller les deux grilles
    const pasArp = sec.kind === "polyrythmie" ? 4 : 2;
    if (L.arp && s % pasArp === 0) arpV(t, ch.lanes[ARP[(s / 2) % 8]] + 12);
    if (L.strings && s === 0) stringsV(t, ch, avant ? 3 * beat - 0.8 : 4 * beat);
  }
  autoStep(step, t, sec, ch);
}
// Le chanteur (#18) chante sa phrase quoi qu'on joue : chaque note tient presque jusqu'à la suivante.
// `bar` est une mesure de la chanson.
function chanter(bar: number, s: number, t: number) {
  const c = S.song.chanteurs?.find((ch) => ch.bar === bar);
  if (!c) return;
  const notes = c.notes,
    i = notes.findIndex((n) => pas(n.beat) === pas(bar * 4) + (s * PAS_PAR_TEMPS) / 4);
  if (i < 0) return;
  const suite = i + 1 < notes.length ? notes[i + 1].beat : (bar + 1) * 4;
  chantV(t, notes[i].midi, 0.85 * (suite - notes[i].beat) * spb());
}
// Le boss de fin (#26) joue ses phrases en canon quoi qu'on joue, tant qu'il tient : tombé, il se tait, et le joueur
// finit le canon seul. Chaque note tient presque jusqu'à la suivante. `bar` est une mesure de la chanson.
function jouerLeBoss(bar: number, s: number, t: number) {
  if (!S.boss || S.boss.vaincu !== null) return;
  const p = S.song.boss.phrases.find((ph) => ph.bar === bar),
    notes = p?.notes ?? [],
    i = notes.findIndex((n) => pas(n.beat) === pas(bar * 4) + (s * PAS_PAR_TEMPS) / 4);
  if (i < 0) return;
  const suite = i + 1 < notes.length ? notes[i + 1].beat : (bar + 1) * 4;
  bossV(t, notes[i].midi, 0.8 * (suite - notes[i].beat) * spb());
}
// Ce que l'auto-play joue à ce pas : les notes de la chanson, et l'improvisation du solo
function autoStep(step, t, sec, ch) {
  // En duo comme avec les deux mains, personne n'est joué automatiquement (#6)
  if (S.auto || uneMain()) {
    // Chaque note sonne à son heure (ADR-0013) : un triolet (#19) tombe entre deux pas du séquenceur
    for (const ev of autoNotes(step)) playHit(ev, timeOfBeat(ev.beat));
    for (const { ev, lane } of autoTrilles(step)) playHit(ev, t, lane);
    for (const { ev, k } of autoSerpents(step)) glisserVoix(ev, k, t);
    const lane = autoSolo(step, sec);
    if (lane !== null) {
      leadV(t, ch.lanes[lane], 0, leadTimbre("refrain"));
      if (layers().choir) harmV(t, lane < 3 ? ch.lanes[lane + 1] : ch.lanes[1] + 12);
    }
  }
}
