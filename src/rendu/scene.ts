/* ---------- Rendu ---------- */
import { AC, songNow } from "../audio/moteur";
import { DIFFS } from "../chanson/difficultes";
import { NOTE, noteName } from "../chanson/theorie";
import {
  COULOIRS,
  S,
  autoFor,
  auRepos,
  chanteurAtBar,
  chordAtBar,
  layers,
  mesureDeLaChanson,
  mult,
  passageAt,
  precision,
  sectionAtBar,
  spb,
  type Action,
} from "../jeu/etat";
import { couloirDe, pasDuSerpent, seuilTrille, tempsDuPassage } from "../jeu/jugement";
import { clamp } from "../outils";
import { COMMANDES, KEYLABEL, LANE_CODES, MIDI, etatMidiCourt } from "../ui/touches";
import { TH, placeName } from "../univers/univers";
import {
  boiteBack,
  boiteBlock,
  boiteBeam,
  boiteChanteur,
  boiteHaut,
  boiteEnemy,
  boiteSerpent,
  boiteGround,
  boitePente,
  boitePlaque,
  boiteTunnel,
  drawComb,
} from "./boite";
import {
  COL,
  DEG,
  FONT,
  GY,
  H,
  HITX,
  HUE_BASS,
  HUE_MEL,
  LANE_HUE,
  LANE_Y,
  PH,
  PPB,
  PW,
  PX,
  W,
  cv,
  formeCouloir,
  g,
  hexA,
  reduced,
  rr,
  txt,
} from "./outils";
import {
  villeBack,
  villeBeam,
  villeBlock,
  villeChanteur,
  villeEnemy,
  villeGround,
  villeHaut,
  villePente,
  villePlaque,
  villeSerpent,
  villeTunnel,
} from "./ville";

export function visualBeat() {
  if (!AC || auRepos()) return S.titleBeat;
  if (S.mode === "dying" || S.mode === "dead") {
    const e = Math.min(1.4, AC.currentTime - S.deathAt);
    return S.deathBeat + (e - (e * e) / 2.8) / spb();
  }
  return songNow() / spb();
}

// Duo local (#6) : le score et le combo de chaque joueur, aux couleurs de sa main, la mélodie à droite
function scoresDuo() {
  for (const hand of ["L", "R"] as const) {
    const m = S.parMain[hand],
      x = hand === "R" ? W - 24 : W - 214,
      col = hand === "R" ? COL.mel : COL.bass;
    txt(hand === "R" ? "MÉLODIE" : "BASSE", x, 22, `600 11px ${FONT.mono}`, col, "right");
    txt(m.score.toLocaleString("fr-CA"), x, 48, `600 24px ${FONT.mono}`, col, "right");
    txt(
      `COMBO ${m.combo}  ×${mult(hand).toLocaleString("fr-CA")}`,
      x,
      70,
      `600 12px ${FONT.mono}`,
      m.combo >= 8 ? col : hexA(col, 0.6),
      "right",
    );
  }
}
export function render(nb, dt) {
  const song = S.song;
  if (!song) return;
  g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  const sp = spb(),
    ns = nb * sp,
    pnow = performance.now(),
    playing = !auRepos();
  const sat = playing ? 0.3 + 0.7 * clamp((S.health - 10) / 65, 0, 1) : 1;
  const hsl = (h, s, l, a = 1) => `hsla(${h},${Math.round(s * sat)}%,${l}%,${a})`;
  const bp = Math.exp(-(((nb % 1) + 1) % 1) * 5);
  // Mesure de la chanson : en boucle, elle revient au début de la section (ADR-0009)
  const curBar = clamp(mesureDeLaChanson(Math.floor(nb / 4)), 0, song.totalBars - 1),
    curSec = sectionAtBar(curBar),
    ch = song.chords[curBar],
    fin = S.bouclePartie ? Infinity : song.totalBars;
  const down = (a: Action) => S.keys[a] || pnow - (S.keyFlash[a] || -1e9) < 120;

  let shx = 0,
    shy = 0;
  if (S.shake > 0.2) {
    shx = (Math.random() * 2 - 1) * S.shake;
    shy = (Math.random() * 2 - 1) * S.shake;
    S.shake *= Math.pow(0.0005, dt);
  } else S.shake = 0;
  g.save();
  g.translate(shx, shy);

  // Décor de l'univers choisi
  if (S.theme === "boite") boiteBack(nb, hsl, bp);
  else villeBack(nb, hsl, bp);

  // Zones d'accord (ciel, alignées sur la ligne de tir)
  const bFirst = Math.max(0, Math.floor(nb / 4) - 1),
    bLast = Math.min(fin - 1, Math.floor((nb + (W - HITX) / PPB) / 4) + 1);
  for (let bar = bFirst; bar <= bLast; bar++) {
    const c = chordAtBar(bar),
      x0 = HITX + (bar * 4 - nb) * PPB;
    g.fillStyle = hsl(c.hue, 70, 60, 0.07);
    g.fillRect(x0, 96, 4 * PPB, GY - 136);
    g.fillStyle = hsl(c.hue, 70, 65, 0.45);
    g.fillRect(x0, 96, 2, GY - 136);
    txt(c.name, x0 + 10, 122, `700 20px ${FONT.display}`, hsl(c.hue, 75, 72, 0.95));
  }
  for (let b = Math.ceil(nb - 2); b < nb + 7; b++) {
    if (b % 4 === 0) continue;
    g.fillStyle = "rgba(239,234,248,.05)";
    g.fillRect(HITX + (b - nb) * PPB, 134, 1, 286);
  }
  // Couloirs et ligne de tir
  const solo = playing && curSec.kind === "pont";
  for (let i = 0; i < 4; i++) {
    g.fillStyle = hsl(LANE_HUE[i], 60, 70, solo ? 0.14 + 0.1 * bp : 0.08);
    g.fillRect(HITX, LANE_Y[i] - 1, W - HITX, 2);
  }
  g.fillStyle = hexA(COL.mel, 0.3);
  g.fillRect(HITX - 1, 135, 2, 280);
  for (let i = 0; i < 4; i++) {
    const held = S.keys[COULOIRS[i]],
      fl = clamp(1 - (pnow - S.laneFlash[i]) / 160, 0, 1);
    formeCouloir(i, HITX, LANE_Y[i], 17);
    g.fillStyle = hsl(LANE_HUE[i], 80, 65, held ? 0.3 : fl * 0.5);
    g.fill();
    g.strokeStyle = hsl(LANE_HUE[i], 80, 70, 0.7);
    g.lineWidth = 2;
    g.stroke();
  }
  if (S.theme === "boite") drawComb(pnow, hsl);

  // Sol, teinté par l'accord (aligné sur le personnage)
  if (S.theme === "boite") boiteGround(nb, hsl);
  else villeGround(nb, hsl);
  for (let bar = bFirst; bar <= bLast + 1 && bar < fin; bar++) {
    const c = chordAtBar(bar),
      x0 = PX + PW / 2 + (bar * 4 - nb) * PPB;
    g.fillStyle = hsl(c.hue, 60, 55, 0.14);
    g.fillRect(x0, GY, 4 * PPB, 40);
  }
  for (let b = Math.ceil(nb - 2); b < nb + 8; b++) {
    g.fillStyle = b % 4 === 0 ? hexA(COL.bass, 0.5) : "rgba(239,234,248,.12)";
    g.fillRect(PX + PW / 2 + (b - nb) * PPB, GY + 4, 2, b % 4 === 0 ? 14 : 7);
  }
  g.fillStyle = hexA(COL.bass, 0.65);
  g.fillRect(-12, GY, W + 24, 2);
  g.fillStyle = TH().under;
  g.fillRect(-12, GY + 40, W + 24, H - GY - 28);

  // Obstacles (main gauche) et ennemis (main droite)
  for (const ev of S.ev) {
    if (ev.beat > nb + 8) break;
    if (ev.state === "skip" || ev.beat + ev.dur < nb - 3) continue;
    if (ev.grp && ev.grp[0] === ev) drawChordLinks(ev.grp, nb);
    if (ev.hand === "L") drawObstacle(ev, nb, hsl);
    else drawEnemy(ev, nb, pnow, hsl);
  }
  dessinerChanteurs(nb, hsl);

  drawPlayer(nb, ns, pnow, hsl, dt);

  // Rayons
  S.beams = S.beams.filter((b) => pnow - b.at < 140);
  g.lineCap = "round";
  for (const b of S.beams) {
    const a = 1 - (pnow - b.at) / 140;
    g.strokeStyle =
      b.ok === false ? hexA(COL.bad, a) : b.ok ? hsl(LANE_HUE[b.lane], 85, 75, a) : hexA(COL.muted, a * 0.6);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(S.gun[0], S.gun[1]);
    g.lineTo(HITX, LANE_Y[b.lane]);
    g.stroke();
  }
  for (const ev of S.ev) {
    if (ev.beat > nb) break;
    // Pas de rayon tenu pour une trille (#15) : chaque appui tire le sien
    if (ev.state !== "holding" || ev.hand !== "R" || ev.trille !== undefined) continue;
    // Le vibrato (#17) fait trembler le rayon plus fort
    const v = ondulation(ev, pnow);
    g.strokeStyle = hsl(LANE_HUE[couloirDe(ev)], 85, 75, 0.7 + 0.3 * Math.random());
    g.lineWidth = 4 + 2 * v;
    g.beginPath();
    g.moveTo(S.gun[0], S.gun[1]);
    // Le rayon tenu sur un serpent (#16) suit le couloir où le joueur en est
    g.lineTo(HITX, LANE_Y[couloirDe(ev)] + (Math.random() * 2 - 1) * (2 + (reduced ? 0 : 5 * v)));
    g.stroke();
  }

  // Particules
  S.parts = S.parts.filter((p) => (p.life += dt) < p.max);
  for (const p of S.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    g.fillStyle = hsl(p.hue, 85, 72, 1 - p.life / p.max);
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }

  // Rail de gauche : ce que joue chaque touche maintenant
  const rail = g.createLinearGradient(0, 0, 200, 0);
  const rc = TH().rail;
  rail.addColorStop(0, hexA(rc, 0.94));
  rail.addColorStop(0.75, hexA(rc, 0.6));
  rail.addColorStop(1, hexA(rc, 0));
  g.fillStyle = rail;
  g.fillRect(-12, 92, 212, GY - 92);
  txt("ACCORD", 24, 112, `600 10px ${FONT.mono}`, COL.muted);
  txt(ch.name, 24, 138, `700 22px ${FONT.display}`, hsl(ch.hue, 75, 72));
  for (let i = 0; i < 4; i++) {
    keycap(24, LANE_Y[i] - 15, KEYLABEL[LANE_CODES[i]], hsl(LANE_HUE[i], 80, 70), down(COULOIRS[i]));
    txt(DEG[i], 64, LANE_Y[i] - 3, `600 10px ${FONT.mono}`, COL.muted);
    txt(NOTE[ch.lanes[i] % 12], 64, LANE_Y[i] + 13, `600 15px ${FONT.mono}`, COL.fg);
    if (S.formes) {
      formeCouloir(i, 158, LANE_Y[i], 8);
      g.fillStyle = hsl(LANE_HUE[i], 80, 70);
      g.fill();
    }
  }
  keycap(24, GY - 80, KEYLABEL.KeyW, COL.bass, down("sauter"));
  // Sauter joue l'octave ; sauter une seconde fois en l'air, la quinte au-dessus (#7)
  txt("OCTAVE · 2× QUINTE", 64, GY - 68, `600 10px ${FONT.mono}`, COL.muted);
  txt(noteName(ch.bass + 12), 64, GY - 52, `600 14px ${FONT.mono}`, COL.fg);
  txt(noteName(ch.bass + 12 + ch.ints[2]), 118, GY - 52, `600 14px ${FONT.mono}`, COL.fg);
  keycap(24, GY - 40, KEYLABEL.KeyS, COL.bass, down("glisser") || (autoFor("L") && ns < S.slideUntil));
  txt("GLISSER · FOND.", 64, GY - 28, `600 10px ${FONT.mono}`, COL.muted);
  txt(noteName(ch.bass), 64, GY - 12, `600 14px ${FONT.mono}`, COL.fg);

  g.restore();

  // HUD
  txt(
    `${S.essai ? `ESSAI · ${S.essai.essai.titre.toUpperCase()}` : `${TH().unit.toUpperCase()} N° ${S.seed}`} · ${DIFFS[S.diff].label.toUpperCase()}`,
    24,
    36,
    `600 11px ${FONT.mono}`,
    COL.muted,
  );
  txt(placeName(), 24, 62, `700 17px ${FONT.display}`, COL.fg);
  txt(`${song.keyName} · ${song.bpm} BPM`, 24, 84, `500 13px ${FONT.body}`, COL.muted);
  const hx = 430,
    hw = 340,
    hv = clamp(S.health, 0, 100);
  txt(TH().meter, hx, 34, `600 11px ${FONT.mono}`, COL.muted);
  txt(String(Math.round(hv)), hx + hw, 34, `600 12px ${FONT.mono}`, COL.fg, "right");
  rr(hx, 42, hw, 10, 5);
  g.fillStyle = COL.panel;
  g.fill();
  if (hv > 0) {
    rr(hx, 42, Math.max(10, (hw * hv) / 100), 10, 5);
    g.fillStyle = `hsl(${Math.round(hv * 1.45)},72%,62%)`;
    g.fill();
  }
  for (const q of [25, 50, 75]) {
    g.fillStyle = hexA(COL.ink, 0.8);
    g.fillRect(hx + (hw * q) / 100, 42, 2, 10);
  }
  const L = layers();
  [L.arp, L.choir, L.strings]
    .map((on, i) => [TH().layers[i], on])
    .forEach(([n, on], i) => {
      const x = hx + i * 104;
      g.beginPath();
      g.arc(x + 4, 71, 4, 0, Math.PI * 2);
      g.fillStyle = on ? COL.good : hexA(COL.muted, 0.35);
      g.fill();
      txt(n, x + 14, 75, `500 12px ${FONT.body}`, on ? COL.fg : hexA(COL.muted, 0.6));
    });
  const duo = S.practice === "duo";
  if (duo) scoresDuo();
  else {
    txt(S.score.toLocaleString("fr-CA"), W - 24, 46, `600 30px ${FONT.mono}`, COL.fg, "right");
    txt(
      `COMBO ${S.combo}  ×${mult().toLocaleString("fr-CA")}`,
      W - 24,
      70,
      `600 12px ${FONT.mono}`,
      S.combo >= 8 ? COL.good : COL.muted,
      "right",
    );
  }
  const badge = [
    S.auto ? "AUTO-PLAY" : ({ L: "MAIN GAUCHE SEULE", R: "MAIN DROITE SEULE", duo: "DUO" }[S.practice] ?? ""),
    S.vitessePartie < 1 ? `VITESSE ${Math.round(S.vitessePartie * 100)} %` : "",
    S.bouclePartie ? "BOUCLE" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  let bw = 0;
  if (badge && playing) {
    g.font = `600 11px ${FONT.mono}`;
    bw = g.measureText(badge).width + 24;
    rr(W - 24 - bw, 82, bw, 20, 10);
    g.fillStyle = S.auto ? COL.mel : S.practice === "L" ? COL.bass : duo ? COL.fg : COL.mel;
    g.fill();
    txt(badge, W - 24 - bw / 2, 96, `600 11px ${FONT.mono}`, COL.ink, "center");
  }
  // En duo, le score total reste affiché, discrètement, pour le comparer aux parties en solo
  if (duo)
    txt(
      `TOTAL ${S.score.toLocaleString("fr-CA")}`,
      W - 24 - (bw && bw + 10),
      96,
      `600 11px ${FONT.mono}`,
      COL.muted,
      "right",
    );

  // Forme de la chanson, avec la section en boucle mise en évidence : celle de la partie, ou celle choisie au repos
  const fx0 = 24,
    fw = W - 48,
    perBar = fw / song.totalBars,
    prog = clamp(mesureDeLaChanson(nb / 4), 0, song.totalBars),
    enBoucle = playing ? S.bouclePartie && S.bouclePartie.sec : song.sections[S.boucle];
  const secHue = { intro: null, couplet: HUE_BASS, refrain: HUE_MEL, pont: 320, outro: null };
  for (const s of song.sections) {
    const x = fx0 + s.start * perBar,
      w = s.bars * perBar - 3;
    rr(x, 562, w, 22, 5);
    g.fillStyle = COL.panel;
    g.fill();
    const done = clamp(prog - s.start, 0, s.bars) * perBar;
    if (done > 0) {
      g.save();
      rr(x, 562, w, 22, 5);
      g.clip();
      g.fillStyle = secHue[s.kind] == null ? hexA(COL.muted, 0.35) : hsl(secHue[s.kind], 70, 62, 0.45);
      g.fillRect(x, 562, Math.min(done, w), 22);
      g.restore();
    }
    if (s === enBoucle) {
      rr(x - 1, 561, w + 2, 24, 6);
      g.strokeStyle = COL.mel;
      g.lineWidth = 2;
      g.stroke();
    }
    txt(s.name, x + 8, 577, `500 11px ${FONT.body}`, (s === curSec && playing) || s === enBoucle ? COL.fg : COL.muted);
  }
  g.fillStyle = COL.fg;
  g.fillRect(fx0 + prog * perBar - 1, 557, 2, 32);
  txt(
    `MESURE ${Math.min(song.totalBars, Math.max(1, mesureDeLaChanson(Math.floor(nb / 4)) + 1))} / ${song.totalBars}`,
    24,
    608,
    `600 11px ${FONT.mono}`,
    COL.muted,
  );
  // Compteur de passages, et précision du dernier passage terminé
  if (S.bouclePartie && playing) {
    const k = passageAt(nb),
      d = S.bouclePartie.passages[k - 1];
    txt(
      `${S.bouclePartie.sec.name.toUpperCase()} EN BOUCLE · PASSAGE ${k + 1}${
        k > 0 ? ` · DERNIER PASSAGE ${d ? `${Math.round(precision(d.parfait, d.bien, d.rate) * 100)} %` : "—"}` : ""
      }`,
      W / 2,
      608,
      `600 11px ${FONT.mono}`,
      COL.fg,
      "center",
    );
  }
  // Aide du clavier, et indicateur du clavier MIDI (#10) : quand il est branché, ou pendant l'essai du MIDI
  const aide = COMMANDES.tactile ? "" : `${KEYLABEL.KeyA} : AUTO-PLAY · ÉCHAP : PAUSE`,
    petit = `600 11px ${FONT.mono}`;
  if (aide) txt(aide, W - 24, 608, petit, COL.muted, "right");
  if (MIDI.etat === "connecte" || S.essai?.essai.midi) {
    g.font = petit;
    const dx = aide ? g.measureText(aide).width + 16 : 0;
    txt(etatMidiCourt(), W - 24 - dx, 608, petit, MIDI.etat === "connecte" ? COL.good : COL.muted, "right");
  }

  // Décompte (intro, ou mesure de reprise)
  if (S.mode === "play") {
    const cBar = S.startBeat > 0 ? S.startBeat : 4;
    if (nb >= cBar && nb < cBar + 4) {
      const n = Math.floor(nb - cBar) + 1,
        f = 1 - (nb % 1);
      txt(
        String(n),
        W / 2 + 60,
        320,
        `700 96px ${FONT.display}`,
        `rgba(239,234,248,${(0.2 + 0.7 * f).toFixed(2)})`,
        "center",
      );
      if (S.startBeat > 0)
        txt(S.bouclePartie ? "Boucle" : "Reprise", W / 2 + 60, 210, `500 18px ${FONT.body}`, COL.muted, "center");
    } else if (S.startBeat === 0 && nb < 4) {
      txt("Prêt ?", W / 2 + 60, 300, `700 44px ${FONT.display}`, hexA(COL.fg, 0.85), "center");
    }
  }
  // Bannière de section
  if (S.banner && playing) {
    const age = (pnow - S.banner.at) / 1000;
    if (age < 1.8) {
      const a = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 1.6;
      txt(S.banner.text, W / 2 + 60, 280, `700 46px ${FONT.display}`, hexA(COL.fg, a), "center");
      if (S.banner.sub) txt(S.banner.sub, W / 2 + 60, 316, `500 17px ${FONT.body}`, hexA(COL.fg, a * 0.8), "center");
    }
  }
  // Vignette rouge quand l'harmonie est basse
  if (playing && S.health < 40) {
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, hexA(COL.bad, 0));
    vg.addColorStop(1, hexA(COL.bad, (1 - S.health / 40) * 0.35));
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }
  // Jugements
  S.pops = S.pops.filter((p) => pnow - p.at < 650);
  for (const p of S.pops) {
    const k = (pnow - p.at) / 650;
    g.globalAlpha = 1 - k;
    txt(p.text, p.x, p.y - k * 28, `700 15px ${FONT.display}`, p.color, "center");
    g.globalAlpha = 1;
  }
}

export function keycap(x, y, label, color, down) {
  rr(x, y + (down ? 2 : 0), 30, 30, 6);
  g.fillStyle = down ? color : hexA(COL.panel, 0.9);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.stroke();
  // Une touche MIDI (« Sol3 ») s'écrit plus petit pour tenir dans la touche
  const taille = String(label).length > 2 ? 10 : 14;
  txt(
    label,
    x + 15,
    y + 19 + taille / 7 + (down ? 2 : 0),
    `600 ${taille}px ${FONT.mono}`,
    down ? COL.ink : COL.fg,
    "center",
  );
}

/** La hauteur des silhouettes de la réponse au chanteur (#18) : entre deux couloirs, elle n'en indique aucun */
export const Y_SILHOUETTE = (LANE_Y[1] + LANE_Y[2]) / 2;
/** La hauteur du chanteur (#18) et de ses notes, au-dessus des couloirs */
export const Y_CHANTEUR = LANE_Y[3] - 50;
// La hauteur où l'on voit un ennemi encore à jouer : une silhouette ne montre pas son couloir
const yVisible = (ev) => (ev.reponse ? Y_SILHOUETTE : LANE_Y[ev.lane]);

// Accords : une barre relie les ennemis à tirer ensemble, un pointillé descend vers l'obstacle du même temps
export function drawChordLinks(grp, nb) {
  const live = grp.filter((e) => e.state === "pending");
  if (live.length < 2) return;
  const d = (grp[0].beat - nb) * PPB,
    xe = HITX + d,
    xl = PX + PW / 2 + d;
  if (xl > W + 40) return;
  const rs = live.filter((e) => e.hand === "R"),
    l = live.find((e) => e.hand === "L");
  g.save();
  g.lineCap = "round";
  if (rs.length > 1) {
    const ys = rs.map(yVisible);
    g.strokeStyle = hexA(COL.fg, 0.6);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(xe, Math.min(...ys));
    g.lineTo(xe, Math.max(...ys));
    g.stroke();
  }
  if (l && rs.length) {
    const yLow = Math.max(...rs.map(yVisible));
    g.setLineDash([5, 6]);
    g.strokeStyle = hexA(COL.fg, 0.45);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(xe, yLow + 18);
    g.lineTo(xl, GY - 2);
    g.stroke();
  }
  g.restore();
}

// La hauteur d'une pente (#12) au-dessus du sol, à la fraction p de sa longueur : elle monte ou descend avec la note
export const RAMPE = 46;
export const hauteurPente = (ev, p) => RAMPE * (ev.fin > ev.midi ? p : 1 - p);

// L'obstacle est dessiné légèrement en avance sur le temps : on appuie quand il est encore devant,
// et il passe sous le personnage au sommet du saut (ou pendant la glissade). La plaque (#8) ne l'est pas :
// on retombe dessus pile sur le temps.
export function drawObstacle(ev, nb, hsl) {
  const x0 = PX + PW / 2 + (ev.beat - nb) * PPB;
  const x = x0 + (ev.lane === 3 ? 0 : ev.lane >= 1 ? 0.315 * ev.air : 0.25) * PPB;
  if (x < -80 || x0 > W + 80 + ev.dur * PPB) return;
  if (ev.state === "pending") {
    g.beginPath();
    g.moveTo(x0 - 6, GY + 9);
    g.lineTo(x0, GY + 2);
    g.lineTo(x0 + 6, GY + 9);
    g.closePath();
    g.fillStyle = hexA(COL.bass, 0.9);
    g.fill();
  }
  const missed = ev.state === "miss" || ev.state === "broken",
    passed = ev.state === "hit" || ev.state === "done";
  const fill = missed ? hexA(COL.bad, 0.85) : hsl(HUE_BASS, 90, 62, passed ? 0.4 : 1);
  const ink = hexA(COL.ink, 0.85),
    boite = S.theme === "boite";
  if (ev.lane === 3) {
    (boite ? boitePlaque : villePlaque)(x, fill, passed);
    g.beginPath();
    g.moveTo(x - 7, GY - 42);
    g.lineTo(x, GY - 34);
    g.lineTo(x + 7, GY - 42);
    g.strokeStyle = fill;
    g.lineWidth = 2.5;
    g.stroke();
    txt(KEYLABEL.Space, x, GY - 50, `600 13px ${FONT.mono}`, fill, "center");
  } else if (ev.lane >= 1) {
    // Le haut obstacle (#7) passe sous le personnage au sommet du double saut ; un saut simple le heurte
    const haut = ev.lane === 2 ? (boite ? 48 : 68) : 0;
    if (ev.lane === 2) (boite ? boiteHaut : villeHaut)(x, fill);
    else if (boite) boiteBlock(x, fill);
    else villeBlock(x, fill);
    g.beginPath();
    g.moveTo(x - 7, GY - 44 - haut);
    g.lineTo(x, GY - 52 - haut);
    g.lineTo(x + 7, GY - 44 - haut);
    g.strokeStyle = fill;
    g.lineWidth = 2.5;
    g.stroke();
    txt(KEYLABEL.KeyW, x, GY - 58 - haut, `600 13px ${FONT.mono}`, fill, "center");
  } else if (ev.fin !== undefined) {
    // La pente (#12) commence et finit avec la note : le personnage la parcourt en glissade, pile sur le temps
    const a = x0,
      b = x0 + ev.dur * PPB,
      monte = ev.fin > ev.midi;
    (boite ? boitePente : villePente)(a, b, GY - hauteurPente(ev, 0), GY - hauteurPente(ev, 1), fill);
    if (ev.state === "holding") {
      const px = clamp(PX + PW / 2, a, b);
      g.strokeStyle = hsl(HUE_BASS, 95, 80, 0.8);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(a, GY - hauteurPente(ev, 0) - 6);
      g.lineTo(px, GY - hauteurPente(ev, (px - a) / (b - a)) - 6);
      g.stroke();
    }
    const ly = GY - RAMPE - 46;
    rr(a + 4, ly - 14, 84, 18, 4);
    g.fillStyle = hexA(COL.ink, 0.7);
    g.fill();
    txt(`${KEYLABEL.KeyS} tenu ${monte ? "↗" : "↘"}`, a + 10, ly, `600 13px ${FONT.mono}`, fill);
  } else if (ev.dur > 0) {
    // Le tunnel finit avant la fin de la note : on se relève une fois sorti
    const a = x - 16,
      b = x0 + ev.dur * PPB - 20;
    g.fillStyle = hsl(HUE_BASS, 40, 60, 0.1);
    g.fillRect(a, 96, b - a, 324);
    if (boite) boiteTunnel(a, b, fill);
    else villeTunnel(a, b, fill);
    if (ev.state === "holding") {
      const px = clamp(PX + PW / 2, a, b);
      rr(a, 420, px - a, 42, 6);
      g.fillStyle = hsl(HUE_BASS, 95, 80, 0.45);
      g.fill();
    }
    rr(a + 4, 432, 66, 18, 4);
    g.fillStyle = hexA(COL.ink, 0.7);
    g.fill();
    txt(`${KEYLABEL.KeyS} tenu`, a + 10, 446, `600 13px ${FONT.mono}`, fill);
  } else {
    if (boite) boiteBeam(x, fill);
    else villeBeam(x, fill);
    txt(KEYLABEL.KeyS, x, 454, `600 13px ${FONT.mono}`, ink, "center");
  }
}

/** La force du vibrato à l'image (#17) : 1 au tapotement, puis s'éteint en 0,6 s ; 0 hors note tenue */
const ondulation = (ev, pnow) =>
  ev.state === "holding" && ev.vibreAt !== undefined ? clamp(1 - (pnow - ev.vibreAt) / 600, 0, 1) : 0;
/** Le tracé d'une bande de 16 px de haut entre x1 et x2, dont les bords ondulent d'une amplitude `amp` */
function bandeOndulee(x1, x2, y, amp, pnow) {
  const onde = (x) => amp * Math.sin((x - HITX) / 12 - pnow / 55);
  g.beginPath();
  for (let x = x1; x < x2 + 4; x += 4) g.lineTo(Math.min(x, x2), y - 8 + onde(Math.min(x, x2)));
  for (let x = x2; x > x1 - 4; x -= 4) g.lineTo(Math.max(x, x1), y + 8 + onde(Math.max(x, x1)));
  g.closePath();
}
export function drawEnemy(ev, nb, pnow, hsl) {
  if (ev.state === "hit" || ev.state === "done") return;
  let x = HITX + (ev.beat - nb) * PPB;
  const x2 = HITX + (ev.beat + ev.dur - nb) * PPB;
  if (x2 < 0 || x > W + 40) return;
  if (ev.reponse && ev.state === "pending") return dessinerSilhouette(ev, x, nb, hsl);
  const y = LANE_Y[ev.lane] + Math.sin(nb * Math.PI + ev.beat * 1.7) * 3;
  let a = 1;
  if (ev.state === "miss" || ev.state === "broken")
    a = clamp(1 - (pnow - ev.missAt) / 500, 0, 1) * 0.8 || (ev.state === "broken" ? 0.3 : 0);
  if (a <= 0) return;
  // Le couloir de l'ennemi : celui où en est le serpent (#16), qui change en chemin
  let yh = y,
    lane = ev.lane;
  if (ev.trille !== undefined) [x, yh] = dessinerTrille(ev, x, x2, y, nb, pnow, hsl, a);
  else if (ev.serpent) [x, yh, lane] = dessinerSerpent(ev, x, nb, pnow, hsl, a);
  const hue = LANE_HUE[lane],
    col = ev.state === "miss" ? hexA(COL.bad, a) : hsl(hue, 80, 68, a);
  if (ev.dur > 0 && ev.trille === undefined && !ev.serpent) {
    const sx = ev.state === "holding" ? HITX : x,
      v = ondulation(ev, pnow);
    if (x2 > sx) {
      // Pendant le vibrato (#17), l'ennemi allongé ondule et s'éclaire
      if (v > 0 && !reduced) bandeOndulee(sx, x2, y, 6 * v, pnow);
      else rr(sx, y - 8, x2 - sx, 16, 8);
      g.fillStyle = hsl(hue, 80, 68, (0.3 + 0.35 * v) * a);
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      g.stroke();
    }
    if (ev.state === "holding") x = HITX;
  }
  // Halo à la forme du couloir, autour de l'ennemi de l'univers
  formeCouloir(lane, x, yh, 24);
  g.fillStyle = hsl(hue, 80, 68, 0.12 * a);
  g.fill();
  if (S.formes) {
    g.strokeStyle = ev.state === "miss" ? hexA(COL.bad, 0.6 * a) : hsl(hue, 80, 68, 0.6 * a);
    g.lineWidth = 2;
    g.stroke();
  }
  if (S.theme === "boite") boiteEnemy(x, yh, ev, col, a, nb, hsl);
  else villeEnemy(x, yh, ev, col, a, nb, hsl);
  // Les ennemis issus du solo (#9) portent une étoile qui scintille : c'est la phrase du joueur qui revient
  if (ev.reprise) etoile(x, yh - 34, 8 + (reduced ? 0 : 1.5 * Math.sin(pnow / 140 + ev.beat)), hsl(hue, 95, 85, a));
}
/**
 * Une silhouette de la réponse au chanteur (#18) : l'ennemi de l'univers en gris, entre deux couloirs, sans la
 * forme de son couloir. Son couloir ne se révèle qu'au coup : réussie, elle éclate dans son couloir ; ratée, elle
 * y apparaît en rouge.
 */
function dessinerSilhouette(ev, x, nb, hsl) {
  const y = Y_SILHOUETTE + Math.sin(nb * Math.PI + ev.beat * 1.7) * 3,
    gris = (h, s, l, a = 1) => hsl(h, s * 0.15, l, a);
  g.beginPath();
  g.arc(x, y, 22, 0, Math.PI * 2);
  g.setLineDash([4, 5]);
  g.strokeStyle = hexA(COL.muted, 0.7);
  g.lineWidth = 1.5;
  g.stroke();
  g.setLineDash([]);
  (S.theme === "boite" ? boiteEnemy : villeEnemy)(x, y, ev, gris(250, 10, 78), 0.85, nb, gris);
  txt("?", x, y - 26, `700 16px ${FONT.display}`, COL.muted, "center");
}
/** Une croche dessinée, sans couleur de couloir : une note chantée (#18) */
function croche(x, y, couleur) {
  g.fillStyle = g.strokeStyle = couleur;
  g.beginPath();
  g.ellipse(x, y + 5, 5, 3.6, -0.4, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x + 3.4, y - 9, 1.6, 14);
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x + 5, y - 9);
  g.quadraticCurveTo(x + 12, y - 4, x + 9, y + 2);
  g.stroke();
}
/**
 * Les chanteurs (#18) : chacun arrive avant sa phrase, se pose au-dessus de la ligne de tir pendant qu'il chante
 * et que le joueur répond, puis s'envole. Ses notes approchent sur sa ligne, en croches neutres : on les entend,
 * sans couloir. À côté de lui, ce qu'il faut faire (écouter, puis répéter) et les coups de la réponse. Les mesures
 * sont celles de la partie : en boucle, chaque passage a son chanteur (ADR-0009).
 */
function dessinerChanteurs(nb, hsl) {
  const ici = Math.floor(nb / 4);
  for (let bar = Math.max(0, ici - 3); bar <= ici + 2; bar++) {
    const c = chanteurAtBar(bar);
    if (!c) continue;
    const decale = 4 * (bar - c.bar),
      debut = bar * 4,
      fin = debut + 8;
    for (const n of c.notes) {
      const xn = HITX + (n.beat + decale - nb) * PPB;
      if (n.beat + decale >= nb && xn < W + 20) croche(xn, Y_CHANTEUR, hexA(COL.fg, 0.55));
    }
    let x = HITX,
      y = Y_CHANTEUR,
      a = 1;
    if (nb < debut - 0.5) x = HITX + (debut - 0.5 - nb) * PPB;
    else if (nb > fin) {
      const e = nb - fin;
      [x, y, a] = [HITX - e * PPB, y - 40 * e, clamp(1 - e / 1.5, 0, 1)];
    }
    if (x > W + 40 || a <= 0) continue;
    // La bouche s'ouvre sur chaque note chantée, puis se referme
    const age = c.notes.map((n) => nb - n.beat - decale).find((d) => d >= 0 && d < 0.4),
      ouvert = age === undefined ? 0 : 1 - age / 0.4;
    if (!reduced) y += 3 * Math.sin(nb * Math.PI);
    (S.theme === "boite" ? boiteChanteur : villeChanteur)(x, y, ouvert, a, nb, hsl);
    txt(nb < debut + 4 ? "ÉCOUTE" : "RÉPÈTE", x + 38, y - 18, `600 12px ${FONT.mono}`, hexA(COL.fg, a));
    S.ev
      .filter((e) => e.reponse && e.bar === bar + 1)
      .forEach((e, i) => {
        g.beginPath();
        g.arc(x + 96 + 11 * i, y - 22, 4, 0, Math.PI * 2);
        const coup = e.state === "pending" ? COL.muted : e.state === "miss" ? COL.bad : COL.good;
        g.fillStyle = hexA(coup, a * (e.state === "pending" ? 0.5 : 1));
        g.fill();
      });
  }
}
/** Une étoile à quatre branches, de rayon r */
function etoile(x, y, r, couleur) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4 - Math.PI / 2,
      d = i % 2 ? r * 0.32 : r;
    g.lineTo(x + d * Math.cos(ang), y + d * Math.sin(ang));
  }
  g.closePath();
  g.fillStyle = couleur;
  g.fill();
}
/**
 * Le serpent (#16) : un corps qui suit ses couloirs l'un après l'autre, chacun pendant un pas, et passe de l'un au
 * suivant par une courbe douce centrée sur le temps du passage. L'univers l'habille (câble lumineux dans la Ville,
 * ruban de papillons dans la Boîte, ADR-0006). Une marque à la forme du couloir annonce chaque passage à venir.
 * Pendant le serpent, la tête reste sur la ligne de tir et monte ou descend avec le corps. Renvoie la place de la
 * tête et son couloir.
 */
function dessinerSerpent(ev, x, nb, pnow, hsl, a): [number, number, number] {
  const tenu = ev.state === "holding",
    s = ev.serpent,
    pas = pasDuSerpent(ev),
    // La courbe d'un passage dure un tiers de pas, un quart de temps au plus
    demi = Math.min(pas / 6, 0.125),
    marche = (u: number) => {
      u = clamp(u, 0, 1);
      return u * u * (3 - 2 * u);
    },
    onde = (b: number) => (reduced ? 0 : 3 * Math.sin((b - nb) * 5 + pnow / 160)),
    yDe = (b: number) =>
      s.reduce(
        (y, l, k) =>
          k ? y + (LANE_Y[l] - LANE_Y[s[k - 1]]) * marche((b - tempsDuPassage(ev, k) + demi) / (2 * demi)) : y,
        LANE_Y[s[0]],
      ) + onde(b),
    xDe = (b: number) => HITX + (b - nb) * PPB,
    debut = tenu ? nb : ev.beat,
    couleur = (l: number, alpha: number) =>
      ev.state === "miss" ? hexA(COL.bad, alpha * a) : hsl(LANE_HUE[l], 80, 68, alpha * a);
  // Le corps, tronçon par tronçon : chacun a la couleur de son couloir
  const troncons = s.map((l, k) => {
    const pts: [number, number][] = [],
      fin = tempsDuPassage(ev, k + 1);
    for (let b = Math.max(debut, tempsDuPassage(ev, k)); b < fin && xDe(b) < W + 40; b += 4 / PPB)
      pts.push([xDe(b), yDe(b)]);
    if (pts.length && xDe(fin) < W + 40) pts.push([xDe(fin), yDe(fin)]);
    return { lane: l, pts };
  });
  (S.theme === "boite" ? boiteSerpent : villeSerpent)(
    troncons.filter((t) => t.pts.length > 1),
    couleur,
    nb,
  );
  // Les passages à venir, à la forme de leur couloir (#31)
  for (let k = 1; k < s.length; k++) {
    const b = tempsDuPassage(ev, k);
    if (b < debut || (tenu && k <= ev.troncon)) continue;
    formeCouloir(s[k], xDe(b), LANE_Y[s[k]], 8);
    g.strokeStyle = couleur(s[k], 0.9);
    g.lineWidth = 2;
    g.stroke();
  }
  if (!tenu) return [x, yDe(ev.beat), s[0]];
  return [HITX, yDe(nb), s[clamp(Math.floor((nb - ev.beat) / pas), 0, s.length - 1)]];
}
/**
 * La trille (#15) : une bande qui couvre ses deux couloirs, traversée d'un zigzag en double-croches de l'un à
 * l'autre. L'ennemi vibre entre les deux couloirs ; pendant la trille, il suit le dernier couloir appuyé et le
 * compte des alternances s'affiche. Renvoie la place de l'ennemi.
 */
function dessinerTrille(ev, x, x2, y, nb, pnow, hsl, a): [number, number] {
  const y2 = y - LANE_Y[ev.lane] + LANE_Y[ev.trille],
    haut = Math.min(y, y2),
    tenue = ev.state === "holding",
    sx = tenue ? HITX : x,
    v = tenue && ev.trilleAt !== undefined ? clamp(1 - (pnow - ev.trilleAt) / 250, 0, 1) : 0,
    hue = LANE_HUE[ev.lane];
  if (x2 > sx) {
    rr(sx, haut - 8, x2 - sx, Math.abs(y2 - y) + 16, 8);
    g.fillStyle = hsl(hue, 80, 68, (0.12 + 0.2 * v) * a);
    g.fill();
    g.save();
    g.beginPath();
    g.rect(sx, 0, x2 - sx, H);
    g.clip();
    g.beginPath();
    for (let k = 0; k <= 4 * ev.dur; k++) g.lineTo(HITX + (ev.beat + k / 4 - nb) * PPB, k % 2 ? y2 : y);
    g.strokeStyle = hsl(hue, 80, 68, (0.55 + 0.45 * v) * a);
    g.lineWidth = 2 + 2 * v;
    g.stroke();
    g.restore();
  }
  if (!tenue) return [x, reduced ? y : (y + y2) / 2 + ((y - y2) / 2) * Math.sin(pnow / 45)];
  const n = ev.alternances ?? 0,
    seuil = seuilTrille(ev);
  txt(`${n}/${seuil}`, HITX + 26, haut - 14, `600 12px ${FONT.mono}`, n >= seuil ? COL.good : COL.fg);
  return [HITX, ev.dernier === ev.trille ? y2 : y];
}

export function drawPlayer(nb, ns, pnow, hsl, dt) {
  const cx = PX + PW / 2;
  let yOff = 0,
    sliding = false,
    jumping = false,
    ecrase = 0;
  // L'écrasement (#8) : le personnage s'aplatit sur la plaque, puis rebondit un peu
  const e = (ns - S.ecraseAt) / (0.5 * spb()),
    impact = !auRepos() && e >= 0 && e < 1;
  if (!auRepos()) {
    // Le double saut (#7) part de la hauteur atteinte au second appui, monte plus haut et redescend au sol
    const haut = (p: number) => Math.sin(Math.PI * Math.pow(p, 0.6)),
      double = S.doubleAt >= S.jumpAt,
      p = double ? (ns - S.doubleAt) / S.doubleAir : (ns - S.jumpAt) / S.jumpAir;
    if (p >= 0 && p < 1) {
      jumping = true;
      yOff = double
        ? -(122 * haut(clamp((S.doubleAt - S.jumpAt) / S.jumpAir, 0, 1)) * (1 - p) + 110 * haut(p))
        : -122 * haut(p);
    } else if (impact && e < 0.3) ecrase = 1 - e / 0.3;
    else if (impact) {
      jumping = true;
      yOff = -16 * Math.sin((Math.PI * (e - 0.3)) / 0.7);
    } else if (S.keys.glisser || ns < S.slideUntil) {
      sliding = true;
      // Sur une pente tenue (#12), la glissade suit la rampe
      const pente = S.ev.find((ev) => ev.state === "holding" && ev.fin !== undefined);
      if (pente) yOff = -hauteurPente(pente, clamp((ns / spb() - pente.beat) / pente.dur, 0, 1));
    }
  }
  const run = S.mode === "play" && !jumping && !sliding && !ecrase,
    ph = nb * Math.PI;
  const w = sliding ? 60 : PW * (1 + 0.35 * ecrase),
    h = sliding ? 30 : PH * (1 - 0.35 * ecrase) - (run ? Math.abs(Math.sin(ph)) * 3 : 0);
  const x = cx - w / 2,
    y = GY + yOff - h,
    hurt = pnow - S.hurtAt < 260;
  const s = run ? Math.sin(ph) : jumping ? 0.6 : 0,
    hipY = y + h - 14;
  const gy = sliding ? y + 14 : y + 32;
  if (impact) {
    // L'onde de choc s'élargit au sol
    g.strokeStyle = hsl(HUE_BASS, 90, 70, 0.6 * (1 - e));
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(cx, GY, 24 + 90 * e, 5 + 10 * e, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "rgba(0,0,0,.35)";
  g.beginPath();
  g.ellipse(cx, GY + 3, Math.max(6, w * 0.6 * (1 + yOff / 300)), 4, 0, 0, Math.PI * 2);
  g.fill();
  g.lineCap = "round";

  if (S.theme === "boite") {
    // Automate à remonter : la clé tourne vite quand le ressort est tendu, et s'arrête avec lui
    const spin =
      S.mode === "play"
        ? 1.5 + (5 * S.health) / 100
        : S.mode === "dying"
          ? 2 * Math.max(0, 1 - (AC.currentTime - S.deathAt) / 1.4)
          : auRepos()
            ? 1
            : 0;
    S.keyAng = (S.keyAng || 0) + dt * spin;
    const brass = hsl(42, 65, 55),
      porcelain = hurt ? COL.bad : hsl(198, 30, 62);
    if (!sliding) {
      g.strokeStyle = brass;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - 5, hipY);
      g.lineTo(cx - 5 + s * 8, y + h);
      g.moveTo(cx + 5, hipY);
      g.lineTo(cx + 5 - s * 8, y + h);
      g.stroke();
    }
    let hx, hy, kx, ky;
    if (sliding) {
      rr(x, y + 6, w - 18, h - 6, 10);
      g.fillStyle = porcelain;
      g.fill();
      hx = x + w - 11;
      hy = y + 14;
      kx = x;
      ky = y + 16;
    } else {
      rr(x + 4, y + 20, w - 8, h - 32, 9);
      g.fillStyle = porcelain;
      g.fill();
      g.fillStyle = brass;
      g.fillRect(x + 4, y + 34, w - 8, 3);
      hx = cx;
      hy = y + 11;
      kx = x + 4;
      ky = y + 32;
    }
    g.beginPath();
    g.arc(hx, hy, 11, 0, Math.PI * 2);
    g.fillStyle = hurt ? COL.bad : COL.fg;
    g.fill();
    g.fillStyle = COL.ink;
    g.beginPath();
    g.arc(hx + 5, hy - 1, 1.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hsl(350, 70, 75, 0.6);
    g.beginPath();
    g.arc(hx + 3, hy + 5, 2.5, 0, Math.PI * 2);
    g.fill();
    // Clé de remontage dans le dos
    const kw = 1 + 7 * Math.abs(Math.cos(S.keyAng));
    g.fillStyle = brass;
    g.fillRect(kx - 9, ky - 1.5, 9, 3);
    g.strokeStyle = brass;
    g.lineWidth = 2.5;
    for (const d of [-5, 5]) {
      g.beginPath();
      g.ellipse(kx - 13, ky + d, kw, 4.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // Diapason doré en guise d'arme
    g.strokeStyle = hsl(45, 85, 62);
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x + w - 6, gy);
    g.lineTo(x + w + 4, gy);
    g.moveTo(x + w + 4, gy - 4);
    g.lineTo(x + w + 4, gy + 4);
    g.moveTo(x + w + 4, gy - 4);
    g.lineTo(x + w + 15, gy - 4);
    g.moveTo(x + w + 4, gy + 4);
    g.lineTo(x + w + 15, gy + 4);
    g.stroke();
  } else {
    // Coursier en patins, casquette et casque audio, mégaphone de la radio pirate
    const skate = (fx, fy) => {
      rr(fx - 7, fy - 5, 14, 4, 2);
      g.fillStyle = hsl(255, 20, 28);
      g.fill();
      g.fillStyle = hsl(330, 85, 62);
      g.beginPath();
      g.arc(fx - 4, fy, 2, 0, Math.PI * 2);
      g.arc(fx + 4, fy, 2, 0, Math.PI * 2);
      g.fill();
    };
    if (!sliding) {
      g.strokeStyle = hsl(HUE_BASS, 90, 62);
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(cx - 6, hipY);
      g.lineTo(cx - 6 + s * 9, y + h - 4);
      g.moveTo(cx + 6, hipY);
      g.lineTo(cx + 6 - s * 9, y + h - 4);
      g.stroke();
      skate(cx - 6 + s * 9, y + h - 1);
      skate(cx + 6 - s * 9, y + h - 1);
    } else {
      skate(x + 14, GY - 1);
      skate(x + w - 18, GY - 1);
    }
    const bh = sliding ? h - 6 : h - 12;
    rr(x, y, w, bh, 12);
    g.fillStyle = hurt ? COL.bad : COL.fg;
    g.fill();
    rr(x + w - 18, y + 8, 14, 9, 4);
    g.fillStyle = hsl(HUE_MEL, 85, 68);
    g.fill();
    rr(x + 2, y - 4, w - 8, 9, 4);
    g.fillStyle = hsl(330, 85, 62);
    g.fill();
    rr(x + w - 10, y + 1, 16, 4, 2);
    g.fill();
    g.strokeStyle = hsl(HUE_BASS, 90, 62);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x + w / 2 - 2, y + 12, w / 2 - 2, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    g.fillStyle = hsl(HUE_BASS, 90, 62);
    rr(x - 2, y + 9, 6, 10, 3);
    g.fill();
    g.beginPath();
    g.moveTo(x + w - 4, gy - 3);
    g.lineTo(x + w + 13, gy - 8);
    g.lineTo(x + w + 13, gy + 8);
    g.lineTo(x + w - 4, gy + 3);
    g.closePath();
    g.fillStyle = hsl(HUE_MEL, 85, 68);
    g.fill();
  }
  S.gun = [x + w + 12, gy];
}
