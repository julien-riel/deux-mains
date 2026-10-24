/* ---------- Rendu ---------- */
// Le rendu commun à toutes les scènes (ADR-0019) : la scène de la partie (`geometrie.ts`) dessine son fond et son
// sol et donne ses poses ; tout le reste se dessine ici, à la pose donnée, dans l'habillage de l'univers.
import { AC, songNow } from "../audio/moteur";
import { DIFFS } from "../chanson/difficultes";
import { estPetiteNote } from "../chanson/generateur";
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
  phraseDuBossAt,
  precision,
  sansFin,
  sectionAtBar,
  spb,
  type Action,
} from "../jeu/etat";
import { DUREE_TIR, ecartAvecLeFantome, poseDuFantome } from "../jeu/fantome";
import { couloirDe, notesDuRelais, pasDuSerpent, seuilTrille, tempsDuPassage } from "../jeu/jugement";
import { nomDeClasse, notesDeLEcrasement } from "../jeu/pianiste";
import { CRITERES, conseil } from "../jeu/style";
import { estSolo, soloEtRefrain } from "../jeu/variations";
import { clamp } from "../outils";
import { COMMANDES, KEYLABEL, LANE_CODES, MIDI, etatMidiCourt, etiquettesMidi, nomsDeNotes } from "../ui/touches";
import { TH, ennemiDuLieu, placeName } from "../univers/univers";
import { ENNEMIS_BOITE } from "./ennemis-boite";
import { ENNEMIS_VILLE } from "./ennemis-ville";
import { dessinerZones } from "./commandes";
import { dessinerRemontage } from "./remontage";
import {
  boiteBlock,
  boiteBoss,
  boiteBeam,
  boiteChanteur,
  boiteHaut,
  boiteEnemy,
  boiteMarche,
  boitePetite,
  boiteSerpent,
  boitePente,
  boitePlaque,
  boiteTunnel,
} from "./boite";
import { cadreDeLaScene, scene } from "./geometrie";
import {
  COL,
  DEG,
  FONT,
  H,
  HUE_BASS,
  HUE_MEL,
  LANE_HUE,
  PH,
  PLONGEE,
  POITRINE,
  PW,
  W,
  aLaPose,
  cv,
  ecartALaPose,
  formeCouloir,
  g,
  hexA,
  reduced,
  rr,
  teinteDeCouloir,
  txt,
  versLEcran,
  type DessinEnnemi,
} from "./outils";
import type { Pose, Scene, VueDeScene } from "./scenes/contrat";
import {
  villeBeam,
  villeBlock,
  villeBoss,
  villeChanteur,
  villeEnemy,
  villeHaut,
  villeMarche,
  villePetite,
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
// L'harmonie et les couches qu'elle débloque, au centre ; le score et le combo à droite (ceux de chaque joueur en
// duo, #6)
function jauges() {
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
  // Pendant le boss de fin (#26), sa vie prend la place des couches du combo, qui continuent de sonner
  if (S.boss) vieDuBoss(hx, hw);
  else
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
  if (S.practice === "duo") scoresDuo();
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
}
export function render(nb, dt) {
  const song = S.song;
  if (!song) return;
  // L'espace de la scène (W × H) ramené dans son cadre à l'écran : tout le canvas au clavier
  const sc = scene(),
    cadre = cadreDeLaScene();
  g.setTransform(
    (cv.width / W) * (cadre.largeur / W),
    0,
    0,
    (cv.height / H) * (cadre.hauteur / H),
    (cv.width / W) * cadre.x,
    (cv.height / H) * cadre.y,
  );
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
    fin = sansFin() ? Infinity : song.totalBars;
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

  // Le fond de la scène, sous les cibles des couloirs : décor de l'univers et repères du temps (ADR-0019)
  const vue: VueDeScene = {
    nb,
    dt,
    pnow,
    hsl,
    pulsation: bp,
    univers: S.theme,
    cadre,
    accord: chordAtBar,
    // Les sections en 3 contre 2 (#19) ont leurs propres repères rythmiques
    polyrythmie: (b: number) =>
      b >= 0 && b < fin * 4 && sectionAtBar(mesureDeLaChanson(Math.floor(b / 4))).kind === "polyrythmie",
    fin,
    solo: playing && estSolo(curSec),
  };
  sc.fond(vue);
  // Les cibles des couloirs, à leur point d'impact : elles s'allument sous le doigt
  for (let i = 0; i < 4; i++) {
    const held = S.keys[COULOIRS[i]],
      fl = clamp(1 - (pnow - S.laneFlash[i]) / 160, 0, 1),
      p = sc.impact(i);
    formeCouloir(i, p.x, p.y, 17 * p.echelle);
    g.fillStyle = hsl(LANE_HUE[i], 80, 65, held ? 0.3 : fl * 0.5);
    g.fill();
    g.strokeStyle = hsl(LANE_HUE[i], 80, 70, 0.7);
    g.lineWidth = 2;
    g.stroke();
  }
  // Le sol, par-dessus les cibles, sous les notes
  sc.sol(vue);

  // Le boss de fin (#26), derrière les ennemis qu'il envoie
  dessinerBoss(sc, nb, pnow, hsl, playing);
  // Obstacles (main gauche) et ennemis (main droite), sous le fil des relais (#20) ; on prépare deux temps de plus
  // que ce que montre la scène, pour les notes qui entrent dans son champ
  const loin = nb + sc.avance + 2;
  dessinerRelais(sc, nb, pnow, loin);
  for (const ev of S.ev) {
    if (ev.beat > loin) break;
    if (ev.state === "skip" || ev.beat + ev.dur < nb - 3) continue;
    if (ev.grp && ev.grp[0] === ev) drawChordLinks(sc, ev.grp, nb);
    if (ev.hand === "L") drawObstacle(sc, ev, nb, hsl);
    else drawEnemy(sc, ev, nb, pnow, hsl);
  }
  dessinerChanteurs(sc, nb, hsl);

  // Le fantôme du meilleur passage (#32), derrière le personnage
  if (fantomeVisible()) dessinerFantome(sc, nb, ns, pnow, hsl, dt);
  drawPlayer(sc, nb, ns, pnow, hsl, dt);

  // Rayons
  S.beams = S.beams.filter((b) => pnow - b.at < 140);
  g.lineCap = "round";
  for (const b of S.beams) {
    const a = 1 - (pnow - b.at) / 140;
    g.strokeStyle =
      b.ok === false ? hexA(COL.bad, a) : b.ok ? hsl(LANE_HUE[b.lane], 85, 75, a) : hexA(COL.muted, a * 0.6);
    g.lineWidth = 3;
    const cible = sc.impact(b.lane);
    g.beginPath();
    g.moveTo(S.gun[0], S.gun[1]);
    g.lineTo(cible.x, cible.y);
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
    const cible = sc.impact(couloirDe(ev));
    g.lineTo(cible.x, cible.y + (Math.random() * 2 - 1) * (2 + (reduced ? 0 : 5 * v)));
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

  // Rail de gauche : ce que joue chaque touche maintenant, à la hauteur du point d'impact de son couloir, et de
  // celui du personnage pour la basse
  const sol = sc.impact("basse").y;
  const rail = g.createLinearGradient(0, 0, 200, 0);
  const rc = TH().rail;
  rail.addColorStop(0, hexA(rc, 0.94));
  rail.addColorStop(0.75, hexA(rc, 0.6));
  rail.addColorStop(1, hexA(rc, 0));
  g.fillStyle = rail;
  g.fillRect(-12, 92, 212, sol - 92);
  txt("ACCORD", 24, 112, `600 10px ${FONT.mono}`, COL.muted);
  txt(ch.name, 24, 138, `700 22px ${FONT.display}`, hsl(ch.hue, 75, 72));
  // En mode pianiste (#53), les touches sont les notes de l'accord, à jouer à n'importe quelle octave
  const pianiste = nomsDeNotes();
  for (let i = 0; i < 4; i++) {
    const etiquette = pianiste ? nomDeClasse(ch.lanes[i]) : KEYLABEL[LANE_CODES[i]],
      y = sc.impact(i).y;
    keycap(24, y - 15, etiquette, hsl(LANE_HUE[i], 80, 70), down(COULOIRS[i]));
    txt(DEG[i], 64, y - 3, `600 10px ${FONT.mono}`, COL.muted);
    txt(NOTE[ch.lanes[i] % 12], 64, y + 13, `600 15px ${FONT.mono}`, COL.fg);
    if (S.formes) {
      formeCouloir(i, 158, y, 8);
      g.fillStyle = hsl(LANE_HUE[i], 80, 70);
      g.fill();
    }
  }
  const fond = pianiste ? nomDeClasse(ch.bass) : null;
  keycap(24, sol - 80, fond ?? KEYLABEL.KeyW, COL.bass, down("sauter"));
  keycap(24, sol - 40, fond ?? KEYLABEL.KeyS, COL.bass, down("glisser") || (autoFor("L") && ns < S.slideUntil));
  // Dans un escalier (#13), sauter monte d'une marche et glisser en descend une : le rail montre la marche
  const marche = marcheProche(nb);
  if (marche) {
    const monte = marche.lane === 4,
      [yl, ye] = monte ? [sol - 68, sol - 52] : [sol - 28, sol - 12];
    txt(monte ? "MONTER ↑" : "DESCENDRE ↓", 64, yl, `600 10px ${FONT.mono}`, hsl(HUE_BASS, 90, 70));
    txt(noteName(marche.midi), 64, ye, `600 14px ${FONT.mono}`, COL.fg);
    txt(monte ? "GLISSER · FOND." : "OCTAVE", 64, monte ? sol - 28 : sol - 68, `600 10px ${FONT.mono}`, COL.muted);
    txt(noteName(monte ? ch.bass : ch.bass + 12), 64, monte ? sol - 12 : sol - 52, `600 14px ${FONT.mono}`, COL.fg);
  } else {
    // Sauter joue l'octave ; sauter une seconde fois en l'air, la quinte au-dessus (#7)
    txt("OCTAVE · 2× QUINTE", 64, sol - 68, `600 10px ${FONT.mono}`, COL.muted);
    txt(noteName(ch.bass + 12), 64, sol - 52, `600 14px ${FONT.mono}`, COL.fg);
    txt(noteName(ch.bass + 12 + ch.ints[2]), 118, sol - 52, `600 14px ${FONT.mono}`, COL.fg);
    txt("GLISSER · FOND.", 64, sol - 28, `600 10px ${FONT.mono}`, COL.muted);
    txt(noteName(ch.bass), 64, sol - 12, `600 14px ${FONT.mono}`, COL.fg);
  }

  g.restore();

  // HUD : une composition (#28) ou un air du répertoire (ADR-0018) montre son titre à la place du lieu
  const compo = S.song.source?.genre === "partition" ? S.song.source : null;
  txt(
    `${S.essai ? `ESSAI · ${S.essai.essai.titre.toUpperCase()}` : compo?.repertoire ? TH().repertoire.nom.toUpperCase() : compo ? TH().editeur.nom.toUpperCase() : `${TH().unit.toUpperCase()} N° ${S.seed}`} · ${DIFFS[S.diff].label.toUpperCase()}`,
    24,
    36,
    `600 11px ${FONT.mono}`,
    COL.muted,
  );
  txt(compo ? compo.titre.trim() || TH().editeur.sansTitre : placeName(), 24, 62, `700 17px ${FONT.display}`, COL.fg);
  txt(`${song.keyName} · ${song.bpm} BPM`, 24, 84, `500 13px ${FONT.body}`, COL.muted);
  const duo = S.practice === "duo";
  // En jam (#24), il n'y a ni harmonie, ni couches, ni score
  if (!S.jam) jauges();
  if (fantomeVisible()) ecartFantome(nb);
  const badge = [
    S.relecture ? "RÉÉCOUTE" : "",
    // En jam (#24), les deux mains jouent librement, quelles que soient les mains choisies
    S.jam
      ? "JAM"
      : S.auto
        ? "AUTO-PLAY"
        : ({ L: "MAIN GAUCHE SEULE", R: "MAIN DROITE SEULE", duo: "DUO" }[S.practice] ?? ""),
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
    g.fillStyle = S.jam ? COL.good : S.auto ? COL.mel : S.practice === "L" ? COL.bass : duo ? COL.fg : COL.mel;
    g.fill();
    txt(badge, W - 24 - bw / 2, 96, `600 11px ${FONT.mono}`, COL.ink, "center");
  }
  // En duo, le score total reste affiché, discrètement, pour le comparer aux parties en solo
  if (duo && !S.jam)
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
    enBoucle = playing ? S.bouclePartie && S.bouclePartie.sec : song.sections[S.boucle],
    // En jam (#24), toutes les sections du corps de la chanson tournent
    rejouee = (s) =>
      s === enBoucle || (playing && S.jam && s.start >= S.jam.start && s.start < S.jam.start + S.jam.bars);
  const secHue = { intro: null, couplet: HUE_BASS, refrain: HUE_MEL, pont: 320, polyrythmie: 45, outro: null };
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
    if (rejouee(s)) {
      rr(x - 1, 561, w + 2, 24, 6);
      g.strokeStyle = COL.mel;
      g.lineWidth = 2;
      g.stroke();
    }
    txt(s.name, x + 8, 577, `500 11px ${FONT.body}`, (s === curSec && playing) || rejouee(s) ? COL.fg : COL.muted);
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
  const aide = COMMANDES.tactile
      ? ""
      : S.jam
        ? "ÉCHAP : QUITTER LA JAM"
        : `${KEYLABEL.KeyA} : AUTO-PLAY · ÉCHAP : PAUSE`,
    petit = `600 11px ${FONT.mono}`;
  if (aide) txt(aide, W - 24, 608, petit, COL.muted, "right");
  if (etiquettesMidi()) {
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
  if (playing) noteDeStyle(nb);
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
    // Le jugement s'affiche près de sa note
    txt(p.text, p.x, p.y - k * 28, `700 15px ${FONT.display}`, p.color, "center");
    g.globalAlpha = 1;
  }
  // Le remontage entre deux lieux (#27), par-dessus la scène au repos du lieu qui suit
  if (S.mode === "remontage") dessinerRemontage(pnow);
  // En mode tactile, les zones fixes autour de la scène (#79, ADR-0019)
  if (COMMANDES.tactile) dessinerZones(nb, pnow);
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

// Une silhouette de la réponse au chanteur (#18) se tient entre les deux couloirs du milieu : elle n'en montre aucun
const VOIE_SILHOUETTE = 1.5;
// La voie où l'on voit un ennemi encore à jouer : une silhouette ne montre pas son couloir
const voieVisible = (ev) => (ev.reponse ? VOIE_SILHOUETTE : ev.lane);

// Accords : une barre relie les ennemis à tirer ensemble, un pointillé descend vers l'obstacle du même temps
export function drawChordLinks(sc: Scene, grp, nb) {
  const live = grp.filter((e) => e.state === "pending");
  if (live.length < 2) return;
  const sol = sc.poser(grp[0].beat, "basse", nb);
  if (sc.horsChamp(sol, "devant", 40)) return;
  const rs = live.filter((e) => e.hand === "R"),
    l = live.find((e) => e.hand === "L"),
    // Les ennemis du plus haut couloir au plus bas
    poses = rs
      .map(voieVisible)
      .sort((u, v) => v - u)
      .map((voie) => sc.poser(grp[0].beat, voie, nb));
  g.save();
  g.lineCap = "round";
  if (rs.length > 1) {
    g.strokeStyle = hexA(COL.fg, 0.6);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(poses[0].x, poses[0].y);
    g.lineTo(poses[poses.length - 1].x, poses[poses.length - 1].y);
    g.stroke();
  }
  if (l && rs.length) {
    const bas = poses[poses.length - 1];
    g.setLineDash([5, 6]);
    g.strokeStyle = hexA(COL.fg, 0.45);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bas.x, bas.y + 18);
    g.lineTo(sol.x, sol.y - 2);
    g.stroke();
  }
  g.restore();
}

// Le point d'une note où s'attache le fil d'un relais (#20) : l'ennemi, ou le haut de l'obstacle ; une fois passée
// la ligne de tir (ou le personnage), il y reste accroché
function pointDeRelais(sc: Scene, ev, nb): Pose {
  const voie = ev.hand === "R" ? ev.lane : "basse",
    p = ev.beat < nb ? sc.impact(voie) : sc.poser(ev.beat, voie, nb);
  if (ev.hand === "R") return p;
  return { ...p, y: p.y - (ev.lane >= 4 ? hauteurMarche(ev.midi) + 10 : 44) * p.echelle };
}
/**
 * Le passage de relais (#20) : un fil relie la dernière note de la main qui commence la phrase à la première de
 * celle qui la finit, aux couleurs des deux mains. Il se tend et s'éclaire quand la première main a joué toute sa
 * part (le relais est passé), et disparaît dès que la seconde main a joué sa première note, ou qu'une note de la
 * phrase est ratée.
 */
function dessinerRelais(sc: Scene, nb, pnow, loin) {
  const vus = new Set<number>();
  for (const ev of S.ev) {
    if (ev.beat > loin) break;
    if (ev.relais === undefined || vus.has(ev.relais)) continue;
    vus.add(ev.relais);
    const phrase = notesDuRelais(ev),
      main = phrase[0].hand,
      part = phrase.filter((e) => e.hand === main),
      de = part[part.length - 1],
      vers = phrase.find((e) => e.hand !== main);
    if (!vers || vers.state !== "pending" || phrase.some((e) => e.state === "miss")) continue;
    const passe = part.every((e) => e.state === "hit"),
      p1 = pointDeRelais(sc, de, nb),
      p2 = pointDeRelais(sc, vers, nb);
    if (sc.horsChamp(p1, "devant", 40)) continue;
    const { x: x1, y: y1 } = p1,
      { x: x2, y: y2 } = p2,
      cx = (x1 + x2) / 2,
      cy = Math.min(y1, y2) - 46,
      couleur = (e) => (e.hand === "R" ? COL.mel : COL.bass),
      a = passe ? 0.95 : 0.6,
      fil = g.createLinearGradient(x1, y1, x2, y2);
    fil.addColorStop(0, hexA(couleur(de), a));
    fil.addColorStop(1, hexA(couleur(vers), a));
    g.save();
    g.lineCap = "round";
    g.strokeStyle = fil;
    g.lineWidth = passe ? 4 : 2.5;
    // Les tirets coulent de la première main vers la seconde
    g.setLineDash([9, 7]);
    g.lineDashOffset = reduced ? 0 : -((pnow / 30) % 16);
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo(cx, cy, x2, y2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = hexA(couleur(vers), a);
    g.beginPath();
    g.arc(x2, y2, passe ? 5 : 3.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    txt(
      "RELAIS",
      (x1 + 2 * cx + x2) / 4,
      (y1 + 2 * cy + y2) / 4 - 8,
      `600 11px ${FONT.mono}`,
      hexA(COL.fg, a),
      "center",
    );
  }
}

// La hauteur d'une pente (#12) au-dessus du sol, à la fraction p de sa longueur : elle monte ou descend avec la note
export const RAMPE = 46;
export const hauteurPente = (ev, p) => RAMPE * (ev.fin > ev.midi ? p : 1 - p);

/** La hauteur d'une marche d'escalier (#13) : elle suit sa note, pour que l'escalier se lise en montant ou en descendant */
export const hauteurMarche = (midi: number) => clamp(14 + (midi - 31) * 2, 12, 70);

// L'obstacle est dessiné légèrement en avance sur le temps : on appuie quand il est encore devant,
// et il passe sous le personnage au sommet du saut (ou pendant la glissade). La plaque (#8) et les marches (#13)
// ne le sont pas : on y arrive pile sur le temps. Il se dessine debout sur le sol de sa pose ; le tunnel et la
// pente se tendent du début à la fin de leur note.
export function drawObstacle(sc: Scene, ev, nb, hsl) {
  const devance = ev.lane >= 3 ? 0 : ev.lane >= 1 ? 0.315 * ev.air : 0.25,
    p0 = sc.poser(ev.beat, "basse", nb),
    p = sc.poser(ev.beat + devance, "basse", nb);
  // Un obstacle long n'est oublié devant qu'à sa longueur du bord
  if (sc.horsChamp(p, "derriere", 80) || sc.horsChamp(sc.poser(ev.beat - ev.dur, "basse", nb), "devant", 80)) return;
  if (!p.visible) return;
  if (ev.state === "pending")
    aLaPose(p0, (x0, sol) => {
      g.beginPath();
      g.moveTo(x0 - 6, sol + 9);
      g.lineTo(x0, sol + 2);
      g.lineTo(x0 + 6, sol + 9);
      g.closePath();
      g.fillStyle = hexA(COL.bass, 0.9);
      g.fill();
    });
  const missed = ev.state === "miss" || ev.state === "broken",
    passed = ev.state === "hit" || ev.state === "done";
  const fill = missed ? hexA(COL.bad, 0.85) : hsl(HUE_BASS, 90, 62, passed ? 0.4 : 1);
  const ink = hexA(COL.ink, 0.85),
    boite = S.theme === "boite",
    // En mode pianiste (#53), l'obstacle porte sa note, à jouer à n'importe quelle octave sous la séparation
    note = nomsDeNotes() ? nomDeClasse(ev.midi) : null;
  if (ev.lane === 3)
    aLaPose(p, (x, sol) => {
      (boite ? boitePlaque : villePlaque)(x, sol, fill, passed);
      g.beginPath();
      g.moveTo(x - 7, sol - 42);
      g.lineTo(x, sol - 34);
      g.lineTo(x + 7, sol - 42);
      g.strokeStyle = fill;
      g.lineWidth = 2.5;
      g.stroke();
      // La plaque s'écrase en frappant ensemble la fondamentale et la quinte
      const touches = note
        ? notesDeLEcrasement(chordAtBar(Math.floor(ev.beat / 4)))
            .map(nomDeClasse)
            .join("+")
        : KEYLABEL.Space;
      txt(touches, x, sol - 50, `600 13px ${FONT.mono}`, fill, "center");
    });
  else if (ev.lane >= 4)
    aLaPose(p, (x, sol) => {
      // La marche d'un escalier (#13) : sauter monte, glisser descend, et la flèche le rappelle
      const monte = ev.lane === 4,
        haut = hauteurMarche(ev.midi);
      (boite ? boiteMarche : villeMarche)(x, sol, haut, fill, monte);
      txt(
        `${note ?? (monte ? KEYLABEL.KeyW : KEYLABEL.KeyS)} ${monte ? "↑" : "↓"}`,
        x,
        sol - haut - 24,
        `600 13px ${FONT.mono}`,
        fill,
        "center",
      );
    });
  else if (ev.lane >= 1)
    aLaPose(p, (x, sol) => {
      // Le haut obstacle (#7) passe sous le personnage au sommet du double saut ; un saut simple le heurte
      const haut = ev.lane === 2 ? (boite ? 48 : 68) : 0;
      if (ev.lane === 2) (boite ? boiteHaut : villeHaut)(x, sol, fill);
      else if (boite) boiteBlock(x, sol, fill);
      else villeBlock(x, sol, fill);
      g.beginPath();
      g.moveTo(x - 7, sol - 44 - haut);
      g.lineTo(x, sol - 52 - haut);
      g.lineTo(x + 7, sol - 44 - haut);
      g.strokeStyle = fill;
      g.lineWidth = 2.5;
      g.stroke();
      txt(note ?? KEYLABEL.KeyW, x, sol - 58 - haut, `600 13px ${FONT.mono}`, fill, "center");
    });
  else if (ev.fin !== undefined) {
    // La pente (#12) commence et finit avec la note : le personnage la parcourt en glissade, pile sur le temps
    const a = p0.x,
      b = sc.poser(ev.beat + ev.dur, "basse", nb).x,
      sol = p0.y,
      monte = ev.fin > ev.midi;
    (boite ? boitePente : villePente)(a, b, sol, sol - hauteurPente(ev, 0), sol - hauteurPente(ev, 1), fill);
    if (ev.state === "holding") {
      const px = clamp(sc.impact("basse").x, a, b);
      g.strokeStyle = hsl(HUE_BASS, 95, 80, 0.8);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(a, sol - hauteurPente(ev, 0) - 6);
      g.lineTo(px, sol - hauteurPente(ev, (px - a) / (b - a)) - 6);
      g.stroke();
    }
    const ly = sol - RAMPE - 46;
    rr(a + 4, ly - 14, note ? 102 : 84, 18, 4);
    g.fillStyle = hexA(COL.ink, 0.7);
    g.fill();
    txt(`${note ?? KEYLABEL.KeyS} tenu ${monte ? "↗" : "↘"}`, a + 10, ly, `600 13px ${FONT.mono}`, fill);
  } else if (ev.dur > 0) {
    // Le tunnel finit avant la fin de la note : on se relève une fois sorti
    const a = p.x - 16,
      b = sc.poser(ev.beat + ev.dur, "basse", nb).x - 20,
      sol = p.y;
    g.fillStyle = hsl(HUE_BASS, 40, 60, 0.1);
    g.fillRect(a, sol - 409, b - a, 324);
    if (boite) boiteTunnel(a, b, sol, fill);
    else villeTunnel(a, b, sol, fill);
    if (ev.state === "holding") {
      const px = clamp(sc.impact("basse").x, a, b);
      rr(a, sol - 85, px - a, 42, 6);
      g.fillStyle = hsl(HUE_BASS, 95, 80, 0.45);
      g.fill();
    }
    rr(a + 4, sol - 73, note ? 84 : 66, 18, 4);
    g.fillStyle = hexA(COL.ink, 0.7);
    g.fill();
    txt(`${note ?? KEYLABEL.KeyS} tenu`, a + 10, sol - 59, `600 13px ${FONT.mono}`, fill);
  } else
    aLaPose(p, (x, sol) => {
      if (boite) boiteBeam(x, sol, fill);
      else villeBeam(x, sol, fill);
      txt(note ?? KEYLABEL.KeyS, x, sol - 51, `600 13px ${FONT.mono}`, ink, "center");
    });
}

/** La force du vibrato à l'image (#17) : 1 au tapotement, puis s'éteint en 0,6 s ; 0 hors note tenue */
const ondulation = (ev, pnow) =>
  ev.state === "holding" && ev.vibreAt !== undefined ? clamp(1 - (pnow - ev.vibreAt) / 600, 0, 1) : 0;
/** Le tracé d'une bande de 16 px de haut entre x1 et x2, dont les bords ondulent d'une amplitude `amp` à partir de
 * la ligne de tir, en x0 */
function bandeOndulee(x1, x2, y, amp, pnow, x0) {
  const onde = (x) => amp * Math.sin((x - x0) / 12 - pnow / 55);
  g.beginPath();
  for (let x = x1; x < x2 + 4; x += 4) g.lineTo(Math.min(x, x2), y - 8 + onde(Math.min(x, x2)));
  for (let x = x2; x > x1 - 4; x -= 4) g.lineTo(Math.max(x, x1), y + 8 + onde(Math.max(x, x1)));
  g.closePath();
}
// Les ennemis de la mélodie de chaque univers, un par lieu : le drone et le papillon de nuit, puis les autres
const DESSINS: Record<string, Record<string, DessinEnnemi>> = {
  ville: { drone: villeEnemy, ...ENNEMIS_VILLE },
  boite: { papillon: boiteEnemy, ...ENNEMIS_BOITE },
};
/** L'ennemi de la mélodie du lieu de la chanson, dans l'univers en cours */
const dessinEnnemi = () => DESSINS[S.theme][ennemiDuLieu().dessin];
export function drawEnemy(sc: Scene, ev, nb, pnow, hsl) {
  if (ev.state === "hit" || ev.state === "done") return;
  // L'ennemi à sa pose, la fin de sa note, et la ligne de tir de son couloir
  const p = sc.poser(ev.beat, ev.lane, nb),
    pFin = sc.poser(ev.beat + ev.dur, ev.lane, nb),
    tir = sc.impact(ev.lane),
    e = p.echelle;
  let x = p.x;
  const x2 = pFin.x;
  // Un ennemi raté plonge sur le joueur, même quand son couloir est déjà sorti de l'écran
  if ((sc.horsChamp(pFin, "derriere", 0) && ev.state !== "miss") || sc.horsChamp(p, "devant", 40)) return;
  if (ev.reponse && ev.state === "pending") return dessinerSilhouette(sc, ev, nb, hsl);
  const y = p.y + Math.sin(nb * Math.PI + ev.beat * 1.7) * 3 * e;
  let a = 1;
  if (ev.state === "miss" || ev.state === "broken")
    a = clamp(1 - (pnow - ev.missAt) / 500, 0, 1) * 0.8 || (ev.state === "broken" ? 0.3 : 0);
  // Une petite note (#14) ratée s'efface sur place
  if (estPetiteNote(ev)) return void (a > 0 && p.visible && dessinerPetite(ev, { ...p, y }, a, nb, hsl));
  // Raté, l'ennemi plonge sur le joueur : son couloir s'efface, lui survit jusqu'à la fin de son rebond
  const plonge = ev.state === "miss" ? pnow - ev.missAt : null;
  if (a <= 0 && (plonge === null || plonge >= PLONGEE + REBOND)) return;
  // Une scène peut cacher un ennemi encore dans son couloir ; il se montre quand il plonge
  if (!p.visible && plonge === null) return;
  // Le couloir de l'ennemi : celui où en est le serpent (#16), qui change en chemin
  let yh = y,
    lane = ev.lane;
  if (ev.trille !== undefined) [x, yh] = dessinerTrille(sc, ev, x, x2, y, nb, pnow, hsl, a);
  else if (ev.serpent) [x, yh, lane] = dessinerSerpent(sc, ev, x, nb, pnow, hsl, a);
  const hue = LANE_HUE[lane],
    col = ev.state === "miss" ? hexA(COL.bad, a) : hsl(hue, 80, 68, a);
  if (ev.dur > 0 && ev.trille === undefined && !ev.serpent) {
    // La note tenue se tend de l'ennemi (ou de la ligne de tir, tenue) à la fin de sa note
    const sx = ev.state === "holding" ? tir.x : x,
      v = ondulation(ev, pnow);
    if (x2 > sx) {
      // Pendant le vibrato (#17), l'ennemi allongé ondule et s'éclaire
      if (v > 0 && !reduced) bandeOndulee(sx, x2, y, 6 * v, pnow, tir.x);
      else rr(sx, y - 8 * e, x2 - sx, 16 * e, 8 * e);
      g.fillStyle = hsl(hue, 80, 68, (0.3 + 0.35 * v) * a);
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      g.stroke();
    }
    if (ev.state === "holding") x = tir.x;
  }
  // Halo à la forme du couloir : il reste sur le couloir, qu'il marque, même quand l'ennemi s'en écarte
  formeCouloir(lane, x, yh, 24 * e);
  g.fillStyle = hsl(hue, 80, 68, 0.12 * a);
  g.fill();
  if (S.formes) {
    g.strokeStyle = ev.state === "miss" ? hexA(COL.bad, 0.6 * a) : hsl(hue, 80, 68, 0.6 * a);
    g.lineWidth = 2;
    g.stroke();
  }
  // La menace monte sur les quatre derniers temps avant la ligne de tir : l'ennemi se réveille et vise le joueur.
  // Une note simple fond alors vers lui en courbe, et revient sur son couloir pile à la ligne ; ratée, elle plonge.
  const m = ev.state === "holding" ? 1 : clamp(1 - (ev.beat - nb) / 4, 0, 1);
  let ex = x,
    ey = yh,
    ea = a;
  if (plonge !== null) [ex, ey, ea] = plongee(sc, x, yh, plonge);
  else if (ev.state === "pending" && ev.dur === 0 && !reduced) {
    const k = 22 * Math.sin(Math.PI * m),
      [dx, dy] = ecartALaPose(p, -0.35 * k, 0.94 * k);
    ex += dx;
    ey += dy;
  }
  const ecol = ev.state === "miss" ? hexA(COL.bad, ea) : hsl(hue, 80, 68, ea);
  dessinEnnemi()(ex, ey, ev, ecol, ea, nb, hsl, m, e, p.angle);
  // En mode pianiste (#53), l'ennemi porte la note à jouer : les deux d'une trille, la prochaine d'un serpent
  if (nomsDeNotes() && ev.state !== "miss" && ev.state !== "broken") {
    const k = ev.serpent ? Math.min((ev.state === "holding" ? (ev.troncon ?? 0) : -1) + 1, ev.serpent.length - 1) : 0,
      nom =
        ev.trille !== undefined
          ? `${nomDeClasse(ev.midi)}~${nomDeClasse(ev.midiTrille)}`
          : nomDeClasse(ev.serpent ? ev.midiSerpent[k] : ev.midi);
    txt(nom, ex, ey - 30 * e, `700 13px ${FONT.mono}`, hexA(COL.fg, 0.9 * a), "center");
  }
  // Les ennemis issus du solo (#9) portent une étoile qui scintille : c'est la phrase du joueur qui revient
  if (ev.reprise)
    etoile(ex, ey - 34 * e, (8 + (reduced ? 0 : 1.5 * Math.sin(pnow / 140 + ev.beat))) * e, hsl(hue, 95, 85, ea));
}
/** Le rebond d'un ennemi après sa frappe, en ms */
const REBOND = 380;
/**
 * La plongée d'un ennemi raté, `t` ms après le raté, depuis sa place sur le couloir : il prend un peu d'élan, fond
 * sur le joueur, là où la scène le place, et le frappe à hauteur de poitrine au bout de `PLONGEE` ms (le coup est
 * dans `effets.rate`), puis rebondit en s'effaçant. Renvoie sa place et son opacité.
 */
function plongee(sc: Scene, x: number, y: number, t: number): [number, number, number] {
  const joueur = sc.impact("basse"),
    cx = joueur.x,
    cy = joueur.y - POITRINE;
  if (t < PLONGEE) {
    const p = t / PLONGEE,
      e = p * p;
    return [x + (cx - x) * e, y + (cy - y) * e - 18 * Math.sin(Math.PI * p), 1];
  }
  const q = clamp((t - PLONGEE) / REBOND, 0, 1);
  return [cx + 40 * q, cy - 60 * q + 30 * q * q, 1 - q];
}
/**
 * Une silhouette de la réponse au chanteur (#18) : l'ennemi de l'univers en gris, entre deux couloirs, sans la
 * forme de son couloir. Son couloir ne se révèle qu'au coup : réussie, elle éclate dans son couloir ; ratée, elle
 * y apparaît en rouge.
 */
function dessinerSilhouette(sc: Scene, ev, nb, hsl) {
  const p = sc.poser(ev.beat, VOIE_SILHOUETTE, nb);
  if (!p.visible) return;
  const e = p.echelle,
    x = p.x,
    y = p.y + Math.sin(nb * Math.PI + ev.beat * 1.7) * 3 * e,
    gris = (h, s, l, a = 1) => hsl(h, s * 0.15, l, a);
  g.beginPath();
  g.arc(x, y, 22 * e, 0, Math.PI * 2);
  g.setLineDash([4, 5]);
  g.strokeStyle = hexA(COL.muted, 0.7);
  g.lineWidth = 1.5;
  g.stroke();
  g.setLineDash([]);
  dessinEnnemi()(x, y, ev, gris(250, 10, 78), 0.85, nb, gris, 0, e, p.angle);
  txt("?", x, y - 26 * e, `700 16px ${FONT.display}`, COL.muted, "center");
}
/**
 * Le boss de fin (#26) : il arrive pendant l'intro et plane à droite, derrière les couloirs. Il ouvre son pavillon
 * (ou ses ailes) sur chaque note qu'il joue ; ses notes approchent sur la ligne du chanteur, aux couleurs de leurs
 * couloirs : on lit sa phrase une mesure avant de la rejouer. Touché, il recule et s'éclaire ; tombé, il chute et se
 * tait ; à l'outro, s'il tient encore, il s'enfuit. Les mesures sont celles de la partie (ADR-0009).
 */
function dessinerBoss(sc: Scene, nb, pnow, hsl, playing) {
  const boss = S.boss;
  if (!boss) return;
  const ici = Math.floor(nb / 4);
  let ouvert = 0;
  for (let bar = Math.max(0, ici - 1); boss.vaincu === null && bar <= ici + 2; bar++) {
    const p = phraseDuBossAt(bar);
    if (!p) continue;
    const decale = 4 * (bar - p.bar);
    for (const n of p.notes) {
      const b = n.beat + decale,
        pn = sc.poser(b, "chanteur", nb);
      if (b >= nb && !sc.horsChamp(pn, "devant", 20) && pn.visible)
        aLaPose(pn, (xn, yn) => croche(xn, yn, hsl(LANE_HUE[n.lane], 80, 72, 0.85)));
      // La note qu'il joue en ce moment ouvre son pavillon, puis il se referme
      if (playing && nb - b >= 0 && nb - b < 0.4) ouvert = Math.max(ouvert, 1 - (nb - b) / 0.4);
    }
  }
  const outro = S.song.sections.find((s) => s.kind === "outro"),
    sec = sectionAtBar(clamp(ici, 0, S.song.totalBars - 1));
  // Il plane à la place que la scène lui donne
  const ancre = sc.boss;
  let x = ancre.x,
    y = ancre.y + (reduced ? 0 : 7 * Math.sin((pnow / 1000) * 1.6)),
    a = 0.9,
    rot = 0;
  // Il arrive pendant l'intro
  if (playing && nb < 6) x += (1 - clamp(nb / 6, 0, 1)) ** 2 * 340;
  if (boss.vaincu !== null) {
    const e = Math.max(0, nb - boss.vaincu);
    [y, rot, a] = [y + 30 * e * e, 0.3 * e, a * clamp(1 - e / 4, 0, 1)];
  } else if (playing && outro && !S.bouclePartie && nb > outro.start * 4) {
    const e = nb - outro.start * 4;
    [x, y, rot] = [x + 50 * e * e, y - 30 * e, -0.15];
  }
  if (a <= 0 || sc.horsChamp({ ...ancre, x, y }, "devant", 220) || !ancre.visible) return;
  const touche = clamp(1 - (pnow - boss.toucheAt) / 350, 0, 1);
  aLaPose({ ...ancre, x: x + (reduced ? 0 : 14 * touche), y }, (bx, by) =>
    (S.theme === "boite" ? boiteBoss : villeBoss)(
      bx,
      by,
      {
        ouvert,
        touche,
        phase: sec.boss ?? (sec.kind === "intro" ? 1 : 3),
        vaincu: boss.vaincu !== null,
        a,
        t: pnow / 1000,
        rot,
      },
      hsl,
    ),
  );
}
/** La vie du boss de fin (#26) dans le HUD : son nom, puis une barre d'un segment par vie, « vaincu » quand il tombe */
function vieDuBoss(hx: number, hw: number) {
  const b = S.boss,
    bx = hx + 150,
    bw = hw - 150,
    vaincu = b.vaincu !== null;
  txt(TH().boss.nom.toUpperCase(), hx, 75, `600 11px ${FONT.mono}`, vaincu ? COL.good : COL.fg);
  rr(bx, 66, bw, 10, 5);
  g.fillStyle = COL.panel;
  g.fill();
  if (b.vie > 0) {
    rr(bx, 66, Math.max(10, (bw * b.vie) / b.max), 10, 5);
    g.fillStyle = "hsl(350,75%,60%)";
    g.fill();
  }
  for (let k = 1; k < b.max; k++) {
    g.fillStyle = hexA(COL.ink, 0.8);
    g.fillRect(bx + (bw * k) / b.max - 0.5, 66, 1, 10);
  }
  if (vaincu) txt("VAINCU", bx + bw / 2, 75, `700 10px ${FONT.mono}`, COL.good, "center");
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
function dessinerChanteurs(sc: Scene, nb, hsl) {
  const ici = Math.floor(nb / 4);
  for (let bar = Math.max(0, ici - 3); bar <= ici + 2; bar++) {
    const c = chanteurAtBar(bar);
    if (!c) continue;
    const decale = 4 * (bar - c.bar),
      debut = bar * 4,
      fin = debut + 8;
    for (const n of c.notes) {
      const pn = sc.poser(n.beat + decale, "chanteur", nb);
      if (n.beat + decale >= nb && !sc.horsChamp(pn, "devant", 20) && pn.visible)
        aLaPose(pn, (xn, yn) => croche(xn, yn, hexA(COL.fg, 0.55)));
    }
    // Il se tient sur la ligne de tir, arrive avec ses notes et repart avec elles, en s'élevant
    let p = sc.impact("chanteur"),
      monte = 0,
      a = 1;
    if (nb < debut - 0.5) p = sc.poser(debut - 0.5, "chanteur", nb);
    else if (nb > fin) {
      const e = nb - fin;
      [p, monte, a] = [sc.poser(fin, "chanteur", nb), -40 * e, clamp(1 - e / 1.5, 0, 1)];
    }
    if (sc.horsChamp(p, "devant", 40) || a <= 0 || !p.visible) continue;
    // La bouche s'ouvre sur chaque note chantée, puis se referme
    const age = c.notes.map((n) => nb - n.beat - decale).find((d) => d >= 0 && d < 0.4),
      ouvert = age === undefined ? 0 : 1 - age / 0.4;
    let y = p.y + monte;
    if (!reduced) y += 3 * Math.sin(nb * Math.PI);
    aLaPose({ ...p, y }, (x, y) => {
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
    });
  }
}
/**
 * La petite note (#14) : un petit ennemi entre deux couloirs, dans un halo pointillé en deux moitiés aux couleurs
 * de ses deux couloirs, avec ses deux touches : l'une ou l'autre le touche (ADR-0010). L'univers l'habille.
 */
function dessinerPetite(ev, p: Pose, a, nb, hsl) {
  aLaPose(p, (x, y) => dessinerPetiteEn(ev, x, y, a, nb, hsl));
}
function dessinerPetiteEn(ev, x, y, a, nb, hsl) {
  const bas = ev.lane - 0.5,
    haut = ev.lane + 0.5,
    rate = ev.state === "miss";
  g.save();
  g.setLineDash([3, 3]);
  g.lineWidth = 2;
  for (const [l, debut] of [
    [haut, Math.PI],
    [bas, 0],
  ]) {
    g.beginPath();
    g.arc(x, y, 14, debut, debut + Math.PI);
    g.strokeStyle = rate ? hexA(COL.bad, 0.6 * a) : hsl(LANE_HUE[l], 80, 68, 0.8 * a);
    g.stroke();
  }
  g.restore();
  const col = rate ? hexA(COL.bad, a) : hsl(teinteDeCouloir(ev.lane), 80, 72, a);
  (S.theme === "boite" ? boitePetite : villePetite)(x, y, col, a, nb, hsl);
  if (ev.state === "pending")
    txt(
      // En mode pianiste (#53), la petite note se joue avec sa vraie note, hors de l'accord (ADR-0010)
      nomsDeNotes() ? nomDeClasse(ev.midi) : `${KEYLABEL[LANE_CODES[bas]]}·${KEYLABEL[LANE_CODES[haut]]}`,
      x + 18,
      y + 4,
      `600 10px ${FONT.mono}`,
      hexA(COL.fg, 0.7 * a),
    );
}
/** Une étoile à quatre branches, de rayon r */
/** Les trois étoiles d'un critère, pleines jusqu'à la note : renvoie leur largeur */
function etoiles(x, y, n, a) {
  for (let i = 0; i < 3; i++) etoile(x + 7 + 17 * i, y, 7, i < n ? hexA(COL.good, a) : hexA(COL.muted, 0.35 * a));
  return 51;
}
// Combien de temps la note de style du solo (#22) reste affichée après le solo, en temps
const DUREE_STYLE = 12;
/**
 * La note de style du solo (#22), au début du refrain qui le suit : les trois critères et leurs étoiles, puis le
 * conseil pour le plus faible. Elle tient entre les deux couloirs du haut, sous les ennemis, comme la bannière.
 */
function noteDeStyle(nb: number) {
  const style = S.reprise.style,
    cible = style && !S.bouclePartie && soloEtRefrain(S.song.sections);
  if (!cible) return;
  const age = nb - (cible.solo.start + cible.solo.bars) * 4;
  if (age < 0 || age >= DUREE_STYLE) return;
  const a = Math.min(1, age / 0.5, (DUREE_STYLE - age) / 2),
    bot = autoFor("R"),
    titre = bot ? "STYLE DE L'AUTO-PLAY" : "STYLE DU SOLO",
    fTitre = `600 11px ${FONT.mono}`,
    fNom = `600 12px ${FONT.mono}`;
  // Largeur de la ligne des critères, pour la centrer : le titre, puis chaque nom suivi de ses étoiles
  g.font = fTitre;
  let w = g.measureText(titre).width;
  g.font = fNom;
  for (const c of CRITERES) w += 28 + g.measureText(c.nom.toUpperCase()).width + 8 + 51;
  const cx = W / 2 + 60,
    texte = bot ? "" : conseil(style);
  g.font = `500 14px ${FONT.body}`;
  const large = Math.max(w, texte ? g.measureText(texte).width : 0);
  rr(cx - large / 2 - 18, 170, large + 36, texte ? 54 : 32, 12);
  g.fillStyle = hexA(COL.ink, 0.62 * a);
  g.fill();
  let x = cx - w / 2;
  txt(titre, x, 191, fTitre, hexA(COL.muted, a));
  g.font = fTitre;
  x += g.measureText(titre).width;
  for (const c of CRITERES) {
    x += 28;
    const nom = c.nom.toUpperCase();
    txt(nom, x, 191, fNom, hexA(COL.fg, a));
    g.font = fNom;
    x += g.measureText(nom).width + 8;
    x += etoiles(x, 186, style[c.cle], a);
  }
  if (texte) txt(texte, cx, 214, `500 14px ${FONT.body}`, hexA(COL.fg, 0.9 * a), "center");
}
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
function dessinerSerpent(sc: Scene, ev, x, nb, pnow, hsl, a): [number, number, number] {
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
    // La place du corps au temps b : la pose de son premier couloir, glissée vers chaque couloir suivant pendant la
    // courbe de son passage
    pointDe = (b: number): [number, number] => {
      const p0 = sc.poser(b, s[0], nb);
      let px = p0.x,
        py = p0.y;
      for (let k = 1; k < s.length; k++) {
        const w = marche((b - tempsDuPassage(ev, k) + demi) / (2 * demi)),
          de = sc.poser(b, s[k - 1], nb),
          vers = sc.poser(b, s[k], nb);
        px += (vers.x - de.x) * w;
        py += (vers.y - de.y) * w;
      }
      return [px, py + onde(b)];
    },
    // Le corps n'entre que dans le champ de la scène
    devant = (b: number) => sc.horsChamp(sc.poser(b, s[0], nb), "devant", 40),
    debut = tenu ? nb : ev.beat,
    couleur = (l: number, alpha: number) =>
      ev.state === "miss" ? hexA(COL.bad, alpha * a) : hsl(LANE_HUE[l], 80, 68, alpha * a);
  // Le corps, tronçon par tronçon : chacun a la couleur de son couloir
  const troncons = s.map((l, k) => {
    const pts: [number, number][] = [],
      fin = tempsDuPassage(ev, k + 1);
    for (let b = Math.max(debut, tempsDuPassage(ev, k)); b < fin && !devant(b); b += sc.echantillon)
      pts.push(pointDe(b));
    if (pts.length && !devant(fin)) pts.push(pointDe(fin));
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
    const pk = sc.poser(b, s[k], nb);
    formeCouloir(s[k], pk.x, pk.y, 8 * pk.echelle);
    g.strokeStyle = couleur(s[k], 0.9);
    g.lineWidth = 2;
    g.stroke();
  }
  if (!tenu) return [x, pointDe(ev.beat)[1], s[0]];
  const [tx, ty] = pointDe(nb);
  return [tx, ty, s[clamp(Math.floor((nb - ev.beat) / pas), 0, s.length - 1)]];
}
/**
 * La trille (#15) : une bande qui couvre ses deux couloirs, traversée d'un zigzag en double-croches de l'un à
 * l'autre. L'ennemi vibre entre les deux couloirs ; pendant la trille, il suit le dernier couloir appuyé et le
 * compte des alternances s'affiche. Renvoie la place de l'ennemi.
 */
function dessinerTrille(sc: Scene, ev, x, x2, y, nb, pnow, hsl, a): [number, number] {
  // Les deux couloirs de la trille au temps de la note, et le balancement de l'ennemi
  const de = sc.poser(ev.beat, ev.lane, nb),
    balance = y - de.y,
    y2 = y - de.y + sc.poser(ev.beat, ev.trille, nb).y,
    haut = Math.min(y, y2),
    tenue = ev.state === "holding",
    tir = sc.impact(ev.lane),
    sx = tenue ? tir.x : x,
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
    // Le zigzag passe d'un couloir à l'autre à chaque double-croche
    for (let k = 0; k <= 4 * ev.dur; k++) {
      const q = sc.poser(ev.beat + k / 4, k % 2 ? ev.trille : ev.lane, nb);
      g.lineTo(q.x, q.y + balance);
    }
    g.strokeStyle = hsl(hue, 80, 68, (0.55 + 0.45 * v) * a);
    g.lineWidth = 2 + 2 * v;
    g.stroke();
    g.restore();
  }
  if (!tenue) return [x, reduced ? y : (y + y2) / 2 + ((y - y2) / 2) * Math.sin(pnow / 45)];
  const n = ev.alternances ?? 0,
    seuil = seuilTrille(ev);
  txt(`${n}/${seuil}`, tir.x + 26, haut - 14, `600 12px ${FONT.mono}`, n >= seuil ? COL.good : COL.fg);
  return [tir.x, ev.dernier === ev.trille ? y2 : y];
}

/** La prochaine note de la main gauche si c'est une marche d'escalier (#13) qui arrive dans le temps qui vient */
function marcheProche(nb: number) {
  const ev = S.ev.find((e) => e.hand === "L" && e.state === "pending" && e.beat >= nb - 0.2);
  return ev && ev.lane >= 4 && ev.beat - nb < 1 ? ev : null;
}
/** Ce qui fait la pose du personnage, en secondes de la chanson : celle du joueur, ou celle du fantôme (#32) */
interface PoseDuPersonnage {
  jumpAt: number;
  jumpAir: number;
  doubleAt: number;
  doubleAir: number;
  slideUntil: number;
  ecraseAt: number;
  /** La touche de glissade est tenue */
  glisse: boolean;
}
const poseDuJoueur = (): PoseDuPersonnage => ({
  jumpAt: S.jumpAt,
  jumpAir: S.jumpAir,
  doubleAt: S.doubleAt,
  doubleAir: S.doubleAir,
  slideUntil: S.slideUntil,
  ecraseAt: S.ecraseAt,
  glisse: !!S.keys.glisser,
});

/** Le fantôme court un peu derrière le personnage, pour qu'on le voie même quand ils font le même geste */
const RECUL_FANTOME = 30;
/** Le fantôme du meilleur passage (#32) se voit pendant la partie, s'il y en a un et que le réglage le montre */
const fantomeVisible = () => !!S.fantome && S.voirFantome && !S.relecture && (S.mode === "play" || S.mode === "pause");

// Le fantôme du meilleur passage (#32) : le personnage en transparence, un peu en retrait, qui fait les gestes de la
// partie gardée à leurs temps, et ses tirs. Il ne se blesse pas et ne suit pas les pentes : il n'est pas jugé.
function dessinerFantome(sc: Scene, nb: number, ns: number, pnow: number, hsl, dt: number) {
  const sp = spb(),
    p = poseDuFantome(S.fantome, nb, S.song.ev),
    enSecondes = (t: number) => t * sp,
    // Le retrait, en arrière du personnage dans le sens de lecture de la scène
    [rx, ry] = ecartALaPose(sc.impact("basse"), -RECUL_FANTOME, 0);
  g.save();
  g.globalAlpha = 0.32;
  g.translate(rx, ry);
  const [gx, gy] = drawPlayer(
    sc,
    nb,
    ns,
    pnow,
    hsl,
    dt,
    {
      jumpAt: enSecondes(p.jumpAt),
      jumpAir: enSecondes(p.jumpAir),
      doubleAt: enSecondes(p.doubleAt),
      doubleAir: enSecondes(p.doubleAir),
      slideUntil: enSecondes(p.slideUntil),
      ecraseAt: enSecondes(p.ecraseAt),
      glisse: p.glisse,
    },
    true,
  );
  g.lineCap = "round";
  g.lineWidth = 2;
  for (const tir of p.tirs) {
    const a = 1 - (nb - tir.temps) / DUREE_TIR;
    g.strokeStyle = tir.resultat === "rate" ? hexA(COL.bad, a) : hsl(LANE_HUE[tir.couloir], 85, 75, a);
    g.beginPath();
    const cible = sc.impact(tir.couloir);
    g.moveTo(gx, gy);
    g.lineTo(cible.x - rx, cible.y - ry);
    g.stroke();
  }
  g.restore();
}

// L'avance ou le retard sur le fantôme (#32), sous le score : en vert quand on mène, en rouge quand il mène
function ecartFantome(nb: number) {
  const d = ecartAvecLeFantome(S.fantome, nb, S.score),
    signe = d > 0 ? "+" : d < 0 ? "−" : "±";
  txt(
    `${TH().fantome} ${signe}${Math.abs(d).toLocaleString("fr-CA")}`,
    W - 24,
    92,
    `600 12px ${FONT.mono}`,
    d > 0 ? COL.good : d < 0 ? COL.bad : COL.muted,
    "right",
  );
}

/**
 * Dessine le personnage, ou le fantôme du meilleur passage (#32) dans la pose qu'on lui donne, debout sur le sol
 * de la scène à son point d'impact (la basse), et renvoie le bout de son arme, d'où partent les tirs.
 */
export function drawPlayer(
  sc: Scene,
  nb,
  ns,
  pnow,
  hsl,
  dt,
  pose: PoseDuPersonnage = poseDuJoueur(),
  fantome = false,
): [number, number] {
  const ici = sc.impact("basse");
  let yOff = 0,
    sliding = false,
    jumping = false,
    ecrase = 0;
  // L'écrasement (#8) : le personnage s'aplatit sur la plaque, puis rebondit un peu
  const e = (ns - pose.ecraseAt) / (0.5 * spb()),
    impact = !auRepos() && e >= 0 && e < 1;
  if (!auRepos()) {
    // Le double saut (#7) part de la hauteur atteinte au second appui, monte plus haut et redescend au sol
    const haut = (p: number) => Math.sin(Math.PI * Math.pow(p, 0.6)),
      double = pose.doubleAt >= pose.jumpAt,
      p = double ? (ns - pose.doubleAt) / pose.doubleAir : (ns - pose.jumpAt) / pose.jumpAir;
    if (p >= 0 && p < 1) {
      jumping = true;
      yOff = double
        ? -(122 * haut(clamp((pose.doubleAt - pose.jumpAt) / pose.jumpAir, 0, 1)) * (1 - p) + 110 * haut(p))
        : -122 * haut(p);
    } else if (impact && e < 0.3) ecrase = 1 - e / 0.3;
    else if (impact) {
      jumping = true;
      yOff = -16 * Math.sin((Math.PI * (e - 0.3)) / 0.7);
    } else if (pose.glisse || ns < pose.slideUntil) {
      sliding = true;
      // Sur une pente tenue (#12), la glissade suit la rampe
      const pente = !fantome && S.ev.find((ev) => ev.state === "holding" && ev.fin !== undefined);
      if (pente) yOff = -hauteurPente(pente, clamp((ns / spb() - pente.beat) / pente.dur, 0, 1));
    }
  }
  const run = S.mode === "play" && !jumping && !sliding && !ecrase,
    ph = nb * Math.PI;
  const arme = aLaPose(ici, (cx, sol): [number, number] => {
    const w = sliding ? 60 : PW * (1 + 0.35 * ecrase),
      h = sliding ? 30 : PH * (1 - 0.35 * ecrase) - (run ? Math.abs(Math.sin(ph)) * 3 : 0);
    const x = cx - w / 2,
      y = sol + yOff - h,
      hurt = !fantome && pnow - S.hurtAt < 260;
    const s = run ? Math.sin(ph) : jumping ? 0.6 : 0,
      hipY = y + h - 14;
    const gy = sliding ? y + 14 : y + 32;
    if (impact) {
      // L'onde de choc s'élargit au sol
      g.strokeStyle = hsl(HUE_BASS, 90, 70, 0.6 * (1 - e));
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(cx, sol, 24 + 90 * e, 5 + 10 * e, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath();
    g.ellipse(cx, sol + 3, Math.max(6, w * 0.6 * (1 + yOff / 300)), 4, 0, 0, Math.PI * 2);
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
      // La clé du fantôme tourne avec celle du personnage, sans la faire tourner deux fois plus vite
      if (!fantome) S.keyAng = (S.keyAng || 0) + dt * spin;
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
        skate(x + 14, sol - 1);
        skate(x + w - 18, sol - 1);
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
    return [x + w + 12, gy];
  });
  const ecran = versLEcran(ici, arme[0], arme[1]);
  if (!fantome) S.gun = ecran;
  return ecran;
}
