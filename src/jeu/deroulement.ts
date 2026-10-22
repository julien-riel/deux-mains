// Déroulement d'une partie : départ, reprise, pause, mort, fin, et l'avancée du temps image par image
import { tapeStop } from "../audio/instruments";
import { AC, B, initAudio, songNow } from "../audio/moteur";
import { startScheduler, stopScheduler } from "../audio/sequenceur";
import { DIFFS } from "../chanson/difficultes";
import { burst, HITX, LANE_HUE, LANE_Y } from "../rendu/outils";
import { overlay, show } from "../ui/ecrans";
import { TH } from "../univers/univers";
import { autoHit } from "./autoplay";
import type { Note } from "../chanson/types";
import { COULOIRS, S, autoFor, mesureDeLaChanson, passageAt, sectionAtBar, spb } from "./etat";
import { completeHold, missEv } from "./jugement";

/* ---------- Partie ---------- */
export function resetRun() {
  Object.assign(S, {
    health: 100,
    combo: 0,
    maxCombo: 0,
    score: 0,
    perfect: 0,
    good: 0,
    miss: 0,
    cp: null,
    curSec: null,
    banner: null,
    jumpAt: -99,
    slideUntil: -99,
    keys: {},
    beams: [],
    parts: [],
    pops: [],
    autoQ: [],
    keyFlash: {},
    ev: S.song.ev,
    bouclePartie: null,
  });
  for (const ev of S.song.ev) {
    ev.state = "pending";
    ev.voice = null;
    ev.auto = false;
  }
}
export function startAt(beat) {
  initAudio();
  if (AC.state === "suspended") AC.resume();
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setValueAtTime(0.0001, t);
  B.master.gain.linearRampToValueAtTime(0.8, t + 0.05);
  B.filt.frequency.cancelScheduledValues(t);
  B.filt.frequency.setValueAtTime(18000, t);
  // La vitesse choisie s'applique au départ : une partie ralentie ou en boucle est un entraînement, son score n'est pas classé
  S.vitessePartie = S.vitesse;
  if (S.vitesse < 1 || S.bouclePartie) S.autoUsed = true;
  B.delay.delayTime.setValueAtTime(0.75 * spb(), t);
  S.startBeat = beat;
  S.t0 = t + 0.12;
  S.nextStep = Math.ceil(beat * 4);
  S.mode = "play";
  S.curSec = null;
  overlay.hidden = true;
  const actif = document.activeElement as HTMLElement;
  if (actif && actif.blur) actif.blur();
  startScheduler();
}
export function newRun(auto = false) {
  resetRun();
  S.auto = auto;
  S.autoUsed = auto || S.practice !== "both";
  const sec = S.song.sections[S.boucle];
  if (!sec) return startAt(0);
  S.bouclePartie = { sec, cree: 0, passages: [] };
  armerBoucle();
}

/* ---------- Boucle (#5, ADR-0009) ---------- */
// Les notes d'un passage : des copies de celles de la section, décalées de k sections dans le temps de la partie
function passage(k: number): Note[] {
  const sec = S.bouclePartie.sec,
    b0 = sec.start * 4,
    decale = k * sec.bars * 4,
    copies = new Map<Note, Note>();
  for (const ev of S.song.ev)
    if (ev.beat >= b0 - 0.01 && ev.beat < b0 + sec.bars * 4 - 0.01)
      copies.set(ev, {
        ...ev,
        beat: ev.beat + decale,
        bar: ev.bar + k * sec.bars,
        state: "pending",
        auto: false,
        voice: null,
        missAt: undefined,
        passage: k,
      });
  for (const c of copies.values()) if (c.grp) c.grp = c.grp.map((ev) => copies.get(ev));
  return [...copies.values()];
}
// Départ ou reprise de la boucle : le décompte qui précède la section, puis les deux premiers passages
function armerBoucle() {
  const b = S.bouclePartie;
  b.cree = 1;
  b.passages = [];
  S.ev = [...passage(0), ...passage(1)];
  S.autoQ = [];
  startAt(Math.max(0, b.sec.start * 4 - 4));
}
// Quand un passage commence, on crée le suivant (il entre à l'écran au plus tôt une section plus tard)
// et on retire celui d'avant le précédent, sorti de l'écran depuis longtemps
function entretenirBoucle(nb: number) {
  const b = S.bouclePartie,
    k = passageAt(nb);
  if (k < b.cree) return;
  b.cree = k + 1;
  S.ev = [...S.ev.filter((ev) => ev.passage >= k - 1), ...passage(k + 1)];
  S.banner = { text: b.sec.name, sub: `Passage ${k + 1}`, at: performance.now() };
}
export function resumeCP() {
  const cp = S.cp;
  if (!cp) return newRun();
  Object.assign(S, {
    score: cp.score,
    perfect: cp.perfect,
    good: cp.good,
    miss: cp.miss,
    maxCombo: cp.maxCombo,
    health: 100,
    combo: 0,
    keys: {},
    jumpAt: -99,
    slideUntil: -99,
  });
  // En boucle, une mort fait reprendre la boucle au début de la section
  if (S.bouclePartie) return armerBoucle();
  const b0 = cp.sec.start * 4;
  for (const ev of S.song.ev) {
    ev.voice = null;
    ev.auto = false;
    ev.state = ev.beat >= b0 - 0.01 ? "pending" : "skip";
  }
  S.autoQ = [];
  startAt(Math.max(0, b0 - 4));
}
export function pause() {
  if (S.mode !== "play") return;
  for (const ev of S.ev) if (ev.state === "holding") completeHold(ev, true);
  S.mode = "pause";
  S.keys = {};
  AC.suspend();
  show("pause");
}
export function unpause() {
  overlay.hidden = true;
  AC.resume().then(() => {
    S.mode = "play";
  });
}
export function die() {
  S.deathBeat = songNow() / spb();
  S.deathAt = AC.currentTime;
  S.mode = "dying";
  stopScheduler();
  tapeStop();
}
export function finish() {
  S.mode = "done";
  stopScheduler();
  show("done");
}

export function update(nb) {
  const song = S.song,
    ns = nb * spb(),
    wg = DIFFS[S.diff].win[1];
  const bar = Math.floor(nb / 4);
  if (bar >= 0 && mesureDeLaChanson(bar) < song.totalBars) {
    const sec = sectionAtBar(bar);
    if (sec !== S.curSec) {
      S.curSec = sec;
      S.cp = { sec, score: S.score, perfect: S.perfect, good: S.good, miss: S.miss, maxCombo: S.maxCombo };
      if (sec.kind !== "intro")
        S.banner = { text: sec.name, sub: sec.kind === "pont" ? TH().solo : "", at: performance.now() };
    }
  }
  if (S.autoQ.length) {
    const due = S.autoQ.filter((q) => q.at <= ns);
    S.autoQ = S.autoQ.filter((q) => q.at > ns);
    for (const q of due) {
      if (q.ev) {
        if (q.ev.state === "pending") autoHit(q.ev);
        continue;
      }
      const pnow = performance.now();
      S.keyFlash[COULOIRS[q.solo]] = pnow;
      S.laneFlash[q.solo] = pnow;
      S.beams.push({ lane: q.solo, at: pnow, ok: true });
      burst(HITX + 40, LANE_Y[q.solo], LANE_HUE[q.solo], 10);
      S.score += 25;
    }
  }
  if (S.bouclePartie) entretenirBoucle(nb);
  for (const ev of S.ev) {
    if (ev.beat > nb + 1) break;
    if (autoFor(ev.hand) && ev.state === "pending" && !ev.auto && ns >= ev.beat * spb()) autoHit(ev);
    if (ev.state === "pending" && ns - ev.beat * spb() > wg) {
      missEv(ev);
      if (S.mode !== "play") return;
    } else if (ev.state === "holding" && ns >= (ev.beat + ev.dur) * spb()) completeHold(ev, false);
  }
  if (!S.bouclePartie && nb >= song.endBeat) return finish();
  const h = S.health,
    cut = h >= 75 ? 18000 : 450 * Math.pow(18000 / 450, h / 75);
  B.filt.frequency.setTargetAtTime(cut, AC.currentTime, 0.12);
}
