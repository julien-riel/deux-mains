// Déroulement d'une partie : départ, reprise, pause, mort, fin, et l'avancée du temps image par image
import { tapeStop } from "../audio/instruments";
import { AC, B, initAudio, songNow } from "../audio/moteur";
import { startScheduler, stopScheduler } from "../audio/sequenceur";
import { DIFFS } from "../chanson/difficultes";
import { burst, COL, HITX, LANE_HUE, LANE_Y, popup, W } from "../rendu/outils";
import { overlay, show } from "../ui/ecrans";
import { COMMANDES } from "../ui/touches";
import { fantomeEnJeu, noterFinDePartie } from "../ui/progression";
import { TH } from "../univers/univers";
import { oublierTouches } from "./actions";
import { autoAlterner, autoHit, autoPasser } from "./autoplay";
import type { Note } from "../chanson/types";
import {
  COULOIRS,
  S,
  autoFor,
  bossNeuf,
  cleDesTraces,
  mesureDeLaChanson,
  passageAt,
  sectionAtBar,
  spb,
  statsNeuves,
  uneMain,
} from "./etat";
import { noter, noterScore, reprendre } from "./enregistrement";
import { corpsDeLaChanson } from "./jam";
import { completeHold, finirTrille, gagner, missEv, suivreSerpent } from "./jugement";
import { enregistrer, finirReecoute, garderLaPartie, rejouer } from "./reecoute";
import { pointsDeStyle } from "./style";
import { estSolo, repriseNeuve, reprendreLeSolo } from "./variations";

/* ---------- Partie ---------- */
export function resetRun() {
  Object.assign(S, {
    // L'harmonie de départ : celle gagnée au remontage avant ce lieu (#27, ADR-0015), sinon 100
    health: S.depart ?? 100,
    combo: 0,
    maxCombo: 0,
    score: 0,
    perfect: 0,
    good: 0,
    miss: 0,
    parMain: statsNeuves(),
    accordsDuo: { reussis: 0, total: 0 },
    relais: { reussis: 0, total: 0 },
    cp: null,
    curSec: null,
    banner: null,
    jumpAt: -99,
    doubleAt: -99,
    slideUntil: -99,
    ecraseAt: -99,
    keys: {},
    beams: [],
    parts: [],
    pops: [],
    autoQ: [],
    keyFlash: {},
    ev: S.song.ev,
    bouclePartie: null,
    jam: null,
    // Une nouvelle partie repart de la chanson de la graine : la reprise du solo d'avant est oubliée (ADR-0012)
    reprise: repriseNeuve(),
    // Le boss de fin (#26) repart avec toute sa vie
    boss: bossNeuf(S.song),
    // Les traces des notes parfaites (#29) : celles de la sauvegarde restent sur le décor, la partie en peint d'autres
    traces: { cle: cleDesTraces(), nouvelles: [] },
    // Le mode pianiste (#53) se constate à la première note jouée ainsi
    pianiste: false,
    // Seule une partie neuve a un fantôme (#32) : ni la réécoute, ni la jam
    fantome: null,
  });
  oublierTouches();
  for (const ev of S.song.ev) {
    ev.state = "pending";
    ev.voice = null;
    ev.auto = false;
    ev.vibrato = ev.vibreAt = ev.ecart = ev.dernier = ev.alternances = ev.trilleAt = undefined;
    ev.troncon = ev.lacheAt = ev.passeAt = undefined;
  }
}
/** Lance la partie au temps `beat`, à la vitesse choisie, ou à celle d'une partie réécoutée (#23) */
export function startAt(beat: number, vitesse = S.vitesse) {
  initAudio();
  if (AC.state === "suspended") AC.resume();
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setValueAtTime(0.0001, t);
  B.master.gain.linearRampToValueAtTime(0.8, t + 0.05);
  B.filt.frequency.cancelScheduledValues(t);
  B.filt.frequency.setValueAtTime(18000, t);
  // La vitesse choisie s'applique au départ : une partie ralentie ou en boucle est un entraînement, son score n'est pas classé
  S.vitessePartie = vitesse;
  if (vitesse < 1 || S.bouclePartie) S.autoUsed = true;
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
  S.autoUsed = auto || uneMain();
  const sec = S.song.sections[S.boucle];
  if (sec) S.bouclePartie = { sec, cree: 0, passages: [] };
  // La partie s'enregistre (#23), sauf en boucle ; le fantôme du meilleur passage la suit (#32), sauf en boucle aussi
  enregistrer();
  S.fantome = fantomeEnJeu();
  if (!sec) return startAt(0);
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
        // Chaque passage a son relais (#20), désigné comme lui par sa mesure de début
        relais: ev.relais === undefined ? undefined : ev.relais + k * sec.bars,
        // De même pour les phrases du canon contre le boss (#26)
        canon: ev.canon === undefined ? undefined : ev.canon + k * sec.bars,
        state: "pending",
        auto: false,
        voice: null,
        missAt: undefined,
        vibrato: undefined,
        vibreAt: undefined,
        ecart: undefined,
        dernier: undefined,
        alternances: undefined,
        trilleAt: undefined,
        troncon: undefined,
        lacheAt: undefined,
        passeAt: undefined,
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
/* ---------- Jam (#24) ---------- */
/** Lance la jam sur la chanson en cours : l'intro, puis son corps en boucle, sans une seule note à jouer. Rien ne
 * s'enregistre : la jam ne se réécoute pas (#23). */
export function lancerJam() {
  resetRun();
  S.jam = corpsDeLaChanson(S.song.sections);
  S.ev = [];
  // Le boss de fin (#26) ne vient pas en jam : on joue sur l'accompagnement seul
  S.boss = null;
  S.auto = false;
  S.autoUsed = true;
  S.enregistrement = null;
  startAt(0);
  S.banner = {
    text: "Jam",
    sub: COMMANDES.tactile ? "Pause pour quitter" : "Échap pour quitter",
    at: performance.now(),
  };
}
/** Quitte la jam pour l'écran de départ de la même chanson */
export function quitterJam() {
  stopScheduler();
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setTargetAtTime(0, t, 0.05);
  resetRun();
  S.mode = "title";
  show("title");
}
// La jam n'a rien à juger : le temps qui avance n'annonce que les sections qui reviennent
function avancerEnJam(nb: number) {
  const bar = Math.floor(nb / 4);
  if (bar < 0) return;
  const sec = sectionAtBar(bar);
  if (sec === S.curSec) return;
  S.curSec = sec;
  if (sec.kind !== "intro") S.banner = { text: sec.name, sub: "", at: performance.now() };
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
    // En duo, chaque joueur retrouve ses coups du point de reprise, avec un combo neuf
    parMain: { L: { ...cp.parMain.L, combo: 0 }, R: { ...cp.parMain.R, combo: 0 } },
    accordsDuo: { ...cp.accordsDuo },
    relais: { ...cp.relais },
    // Le boss de fin (#26) retrouve sa vie du point de reprise
    boss: cp.boss && { ...cp.boss },
    health: 100,
    combo: 0,
    keys: {},
    jumpAt: -99,
    doubleAt: -99,
    slideUntil: -99,
    ecraseAt: -99,
  });
  // En boucle, une mort fait reprendre la boucle au début de la section
  if (S.bouclePartie) return armerBoucle();
  // Une mort après le solo garde la phrase reprise ; une mort avant sa fin efface ce qui a été joué (ADR-0012)
  if (!S.reprise.faite) S.reprise.solo = [];
  const b0 = cp.sec.start * 4;
  // L'enregistrement garde la partie d'avant la mort jusqu'au début de la section, puis celle d'après (#23)
  reprendre(S.enregistrement, b0, S.practice, S.auto);
  for (const ev of S.ev) {
    ev.voice = null;
    ev.auto = false;
    ev.vibrato = ev.vibreAt = ev.ecart = ev.dernier = ev.alternances = ev.trilleAt = undefined;
    ev.troncon = ev.lacheAt = ev.passeAt = undefined;
    ev.state = ev.beat >= b0 - 0.01 ? "pending" : "skip";
  }
  S.autoQ = [];
  startAt(Math.max(0, b0 - 4));
}
/** Les notes tenues et les trilles (#15) en cours sont réussies : la pause ne doit pas faire perdre */
export function finirLesTenues() {
  for (const ev of S.ev)
    if (ev.state === "holding" && ev.trille !== undefined) finirTrille(ev, true);
    else if (ev.state === "holding") completeHold(ev, true);
}
export function pause() {
  if (S.mode !== "play") return;
  // Pendant la réécoute (#23), la pause ne touche pas à la partie rejouée : seules ses pauses à elle comptent
  if (!S.relecture) {
    finirLesTenues();
    S.keys = {};
    noter(S.enregistrement, { temps: songNow() / spb(), geste: "pause" });
  }
  S.mode = "pause";
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
  // La fin d'une partie se garde pour la réécouter ; la fin d'une réécoute rend le bilan de la partie (#23)
  if (S.relecture) finirReecoute();
  else {
    garderLaPartie();
    // La progression (#25) est notée avant l'écran de fin, qui dit ce qu'elle a gagné ; pas après une réécoute
    noterFinDePartie();
  }
  show("done");
}

/** L'avancée du temps, image par image. Pendant la réécoute (#23), les coups enregistrés se rejouent à leur temps. */
export function update(nb: number) {
  if (S.relecture) nb = rejouer(nb, avancer);
  if (S.mode === "play") (S.jam ? avancerEnJam : avancer)(nb);
}

function avancer(nb: number) {
  const song = S.song,
    ns = nb * spb(),
    wg = DIFFS[S.diff].win[1];
  const bar = Math.floor(nb / 4);
  // Le score au début de chaque temps, auquel se comparera le fantôme de cette partie (#32)
  noterScore(S.enregistrement, nb, S.score);
  // À la fin du solo, sa meilleure phrase revient dans le refrain qui suit (#9, ADR-0012), et sa note de style
  // rapporte ses points (#22) avant le point de reprise du refrain : une mort au refrain ne les fait pas perdre
  const soloEnCours = !S.reprise.faite,
    phrase = reprendreLeSolo(nb, DIFFS[S.diff].mel);
  if (soloEnCours && S.reprise.style) {
    const points = pointsDeStyle(S.reprise.style);
    gagner(points, "R");
    popup(`+${points} STYLE`, W / 2 + 60, LANE_Y[1] + 40, COL.good);
  }
  if (bar >= 0 && mesureDeLaChanson(bar) < song.totalBars) {
    const sec = sectionAtBar(bar);
    if (sec !== S.curSec) {
      S.curSec = sec;
      S.cp = {
        sec,
        score: S.score,
        perfect: S.perfect,
        good: S.good,
        miss: S.miss,
        maxCombo: S.maxCombo,
        parMain: structuredClone(S.parMain),
        accordsDuo: { ...S.accordsDuo },
        relais: { ...S.relais },
        boss: S.boss && { ...S.boss },
      };
      // La section en 3 contre 2 (#19) dit ce que joue chaque main ; une phase du boss (#26) dit ce qu'il fait, et à
      // l'outro, s'il tient encore, il s'enfuit
      const fuite = S.boss && S.boss.vaincu === null && sec.kind === "outro" && !S.bouclePartie;
      if (sec.kind !== "intro")
        S.banner = {
          text: sec.boss ? `${TH().boss.nom} · ${sec.name}` : fuite ? TH().boss.nom : sec.name,
          sub: estSolo(sec)
            ? TH().solo
            : sec.kind === "polyrythmie"
              ? TH().polyrythmie
              : sec.boss
                ? TH().boss.phases[sec.boss - 1]
                : fuite
                  ? TH().boss.fuite
                  : "",
          at: performance.now(),
        };
    }
  }
  if (phrase)
    S.banner = {
      text: S.curSec.name,
      sub: autoFor("R") ? "Le refrain reprend le solo" : "Le refrain reprend ton solo",
      at: performance.now(),
    };
  if (S.autoQ.length) {
    const due = S.autoQ.filter((q) => q.at <= ns);
    S.autoQ = S.autoQ.filter((q) => q.at > ns);
    for (const q of due) {
      if (q.ev && q.trille !== undefined) {
        autoAlterner(q.ev, q.trille);
        continue;
      }
      if (q.ev && q.passage !== undefined) {
        autoPasser(q.ev, q.passage);
        continue;
      }
      if (q.ev) {
        if (q.ev.state === "pending") autoHit(q.ev);
        continue;
      }
      const pnow = performance.now();
      S.keyFlash[COULOIRS[q.solo]] = pnow;
      S.laneFlash[q.solo] = pnow;
      S.beams.push({ lane: q.solo, at: pnow, ok: true });
      burst(HITX + 40, LANE_Y[q.solo], LANE_HUE[q.solo], 10);
      gagner(25, "R");
    }
  }
  if (S.bouclePartie) entretenirBoucle(nb);
  for (const ev of S.ev) {
    if (ev.beat > nb + 1) break;
    if (autoFor(ev.hand) && ev.state === "pending" && !ev.auto && ns >= ev.beat * spb()) autoHit(ev);
    if (ev.state === "pending" && ns - ev.beat * spb() > wg) {
      missEv(ev);
      if (S.mode !== "play") return;
    } else if (ev.state === "holding" && ev.serpent) {
      // Le serpent (#16) juge ses passages au fil du temps, et se finit quand ils le sont tous
      suivreSerpent(ev, ns);
      if (S.mode !== "play") return;
    } else if (ev.state === "holding" && ns >= (ev.beat + ev.dur) * spb()) {
      // La trille (#15) se juge à sa fin, sur ses alternances : ratée, elle fait des dégâts
      if (ev.trille === undefined) completeHold(ev, false);
      else finirTrille(ev);
      if (S.mode !== "play") return;
    }
  }
  if (!S.bouclePartie && nb >= song.endBeat) return finish();
  const h = S.health,
    cut = h >= 75 ? 18000 : 450 * Math.pow(18000 / 450, h / 75);
  B.filt.frequency.setTargetAtTime(cut, AC.currentTime, 0.12);
}
