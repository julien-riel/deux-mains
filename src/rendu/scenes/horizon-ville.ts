/* ---------- La Ville Muette, vers l'horizon (ADR-0019, #82) ---------- */
// Synthwave : un soleil à bandes sur l'horizon, une route de néon quadrillée à chaque croche, des immeubles le long
// de la route et des poteaux qui tiennent les fils électriques de la mélodie, un fil par rail. Chaque note parfaite
// (#29) rallume un immeuble à son temps, et les immeubles rallumés d'une partie précédente brillent quand on y
// repasse. Le personnage, un coursier en sweat à capuche et casque audio, est vu de dos.
import { COULEUR_BASSE } from "../../jeu/traces";
import { clamp } from "../../outils";
import { COL, FONT, H, LANE_HUE, W, energy, g, hexA, hh, reduced, txt } from "../outils";
import type { GesteDuPersonnage, VueDeScene } from "./contrat";
import { lignesDeVitesse } from "./horizon";
import { AVANCE, RAILS, ROUTE, SOL, VPX, VPY, projeter, tracesVues } from "./perspective";

// Un point à la hauteur `y` au-dessus du sol, décalé de `x` de l'axe de la route, à `dz` temps de profondeur
const P = (x: number, y: number, dz: number) => projeter(x, SOL - y, dz);
// Le bas de l'écran, sur la route, et la demi-largeur de la route là
const S_BAS = (H - VPY) / SOL;
// Le décor s'efface au loin, entre `a` et `b` temps
const fondu = (dz: number, a: number, b: number) => clamp(1 - (dz - a) / (b - a), 0, 1);

export function fondVille(vue: VueDeScene) {
  const { nb, hsl, pulsation: bp } = vue,
    e = energy();
  ciel(vue, e);
  route(nb, hsl, bp, e);
  // Les immeubles (un par demi-temps de chaque côté) et les poteaux (un par temps), du plus loin au plus proche
  const allumes = immeublesAllumes(nb),
    plans: [number, () => void][] = [];
  for (let n = Math.floor((nb + AVANCE + 2) * 2); n >= Math.floor((nb - 0.4) * 2); n--) {
    const dz = n / 2 - nb;
    if (dz < -0.34) continue;
    for (const cote of [-1, 1]) plans.push([dz + 0.15, () => immeuble(cote, n, dz, vue, e, allumes)]);
  }
  for (let k = Math.floor(nb + AVANCE + 2); k >= Math.floor(nb - 0.3); k--) {
    const dz = k - nb;
    if (dz < 0.12) continue;
    for (const cote of [-1, 1]) plans.push([dz, () => poteau(cote, dz, hsl, e)]);
  }
  plans.sort((a, b) => b[0] - a[0]);
  for (const [, dessiner] of plans) dessiner();
  fils(vue);
}

export function solVille(vue: VueDeScene) {
  const { nb, hsl } = vue;
  // Le nom de l'accord au bord de la route, à chaque barre de mesure
  for (let bar = Math.max(0, Math.floor(nb / 4)); bar * 4 < nb + AVANCE && bar < vue.fin; bar++) {
    const dz = bar * 4 - nb;
    if (dz < -0.15) continue;
    const [x, y, s] = P(-ROUTE - 18, 0, dz),
      c = vue.accord(bar),
      taille = Math.round(30 * s);
    if (taille >= 7)
      txt(c.name, x, y, `700 ${taille}px ${FONT.display}`, hsl(c.hue, 80, 72, fondu(dz, 2.5, AVANCE)), "right");
  }
  // Les triolets de la basse en 3 contre 2 (#19) : deux repères de plus sur les bords de la route, dans le temps
  for (let b = Math.ceil(nb - 0.5); b < nb + AVANCE; b++) {
    if (!vue.polyrythmie(b)) continue;
    for (const k of [1, 2]) {
      const dz = b + k / 3 - nb;
      if (dz < -0.1) continue;
      const [x1, y, s] = P(-ROUTE, 0, dz),
        [x2] = P(ROUTE, 0, dz);
      g.fillStyle = hexA(COL.bass, 0.75 * fondu(dz, 2, AVANCE));
      g.fillRect(x1, y - 1.5 * s, 34 * s, Math.max(1, 3 * s));
      g.fillRect(x2 - 34 * s, y - 1.5 * s, 34 * s, Math.max(1, 3 * s));
    }
  }
  g.lineCap = "round";
  for (const [x1, y1, x2, y2, a] of lignesDeVitesse(nb)) {
    g.strokeStyle = hsl(190, 90, 78, a);
    g.lineWidth = 1.5 + (Math.hypot(x1 - VPX, y1 - VPY) / 900) * 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
}

function ciel(vue: VueDeScene, e: number) {
  const { nb, hsl, pulsation: bp, pnow } = vue;
  const haut = g.createLinearGradient(0, 0, 0, VPY);
  haut.addColorStop(0, hsl(262, 75, 5));
  haut.addColorStop(0.58, hsl(282, 75, 17));
  haut.addColorStop(1, hsl(332, 95, 52));
  g.fillStyle = haut;
  g.fillRect(-12, -12, W + 24, VPY + 14);
  // Les étoiles, qui s'effacent vers l'horizon
  for (let i = 0; i < 80; i++) {
    const y = hh(i, 2) * 190,
      a = (0.2 + 0.5 * hh(i, 3)) * (1 - y / 230) * (reduced ? 1 : 0.6 + 0.4 * Math.sin(pnow / 700 + i));
    g.fillStyle = `rgba(255,230,255,${a.toFixed(3)})`;
    g.fillRect(hh(i, 1) * W, y, hh(i, 4) < 0.15 ? 2 : 1, hh(i, 4) < 0.15 ? 2 : 1);
  }
  // Le soleil à bandes, qui bat au temps : les bandes descendent avec la musique
  const cx = VPX,
    cy = VPY - 20,
    r = 96 + 3 * bp,
    halo = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
  halo.addColorStop(0, hsl(330, 100, 60, 0.35 + 0.1 * bp));
  halo.addColorStop(1, hsl(330, 100, 60, 0));
  g.fillStyle = halo;
  g.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 3 + 24);
  g.save();
  g.beginPath();
  const debut = cy - r * 0.18,
    ph = (nb * 0.5) % 1;
  g.rect(cx - r, cy - r, 2 * r, debut - (cy - r));
  let prec = debut;
  for (let i = 0; i < 7; i++) {
    const u = (i + ph) / 7,
      y = debut + u * (cy + r - debut);
    if (y > prec) g.rect(cx - r, prec, 2 * r, y - prec);
    prec = y + (1.2 + 9 * u) * (1 + 0.5 * bp);
  }
  g.rect(cx - r, Math.min(prec, VPY), 2 * r, Math.max(0, VPY - prec));
  g.clip();
  const soleil = g.createLinearGradient(0, cy - r, 0, cy + r * 0.6);
  soleil.addColorStop(0, hsl(52, 100, 70));
  soleil.addColorStop(0.5, hsl(22, 100, 62));
  soleil.addColorStop(1, hsl(330, 100, 58));
  g.fillStyle = soleil;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // La ville lointaine, dont les fenêtres s'allument avec l'énergie de la partie
  for (let x = -20, k = 0; x < W + 20; k++) {
    const w = 14 + hh(k, 5) * 40,
      centre = Math.abs(x + w / 2 - VPX) / 600,
      h = 8 + hh(k, 6) * 26 + centre * 40 + (hh(k, 7) < 0.12 ? 26 : 0);
    g.fillStyle = hsl(272, 70, 12);
    g.fillRect(x, VPY - h, w, h + 2);
    g.fillStyle = hsl(36, 100, 74, 0.3 + 0.4 * e);
    for (let yy = VPY - h + 4; yy < VPY - 3; yy += 6)
      for (let xx = x + 3; xx < x + w - 3; xx += 6) if (hh(xx | 0, yy) < 0.1 + 0.3 * e) g.fillRect(xx, yy, 1.5, 1.5);
    x += w + (hh(k, 8) < 0.3 ? 4 : 0);
  }
  // La brume de l'horizon
  const brume = g.createLinearGradient(0, VPY - 60, 0, VPY + 30);
  brume.addColorStop(0, hsl(330, 100, 60, 0));
  brume.addColorStop(0.7, hsl(330, 100, 60, 0.35));
  brume.addColorStop(1, hsl(330, 100, 60, 0));
  g.fillStyle = brume;
  g.fillRect(-12, VPY - 60, W + 24, 90);
}

// La route : l'asphalte mouillé, une ligne par croche (plus vive au temps, plus encore à la mesure) et des bords de
// néon qui battent au temps
function route(nb: number, hsl, bp: number, e: number) {
  const terre = g.createLinearGradient(0, VPY, 0, H);
  terre.addColorStop(0, hsl(276, 70, 15));
  terre.addColorStop(0.2, hsl(276, 70, 7));
  terre.addColorStop(1, hsl(270, 70, 3));
  g.fillStyle = terre;
  g.fillRect(-12, VPY, W + 24, H - VPY + 12);
  const bas = ROUTE * S_BAS;
  g.beginPath();
  g.moveTo(VPX - 2, VPY);
  g.lineTo(VPX + 2, VPY);
  g.lineTo(VPX + bas, H);
  g.lineTo(VPX - bas, H);
  g.closePath();
  const asphalte = g.createLinearGradient(0, VPY, 0, H);
  asphalte.addColorStop(0, hsl(285, 70, 20));
  asphalte.addColorStop(0.3, hsl(275, 70, 9));
  asphalte.addColorStop(1, hsl(272, 70, 5));
  g.fillStyle = asphalte;
  g.fill();
  // Le reflet du soleil
  const reflet = g.createLinearGradient(0, VPY, 0, H);
  reflet.addColorStop(0, hsl(335, 100, 65, 0.45));
  reflet.addColorStop(1, hsl(335, 100, 65, 0));
  g.fillStyle = reflet;
  g.beginPath();
  g.moveTo(VPX - 50, VPY);
  g.lineTo(VPX + 50, VPY);
  g.lineTo(VPX + 130, H);
  g.lineTo(VPX - 130, H);
  g.closePath();
  g.fill();
  // Une ligne par croche
  for (let c = Math.ceil((nb - 0.45) * 2); c / 2 < nb + AVANCE + 1; c++) {
    const [, y, s] = P(0, 0, c / 2 - nb);
    if (y > H + 4) continue;
    const mesure = c % 8 === 0,
      temps = c % 2 === 0,
      a = Math.min(
        1,
        (mesure ? 0.95 : temps ? 0.5 : 0.18) * clamp((s - 0.02) / 0.18, 0, 1) * (1 + (temps ? 0.7 * bp : 0)),
      ),
      l = ROUTE * s;
    g.strokeStyle = mesure ? hsl(318, 100, 74, a) : hsl(325, 100, 62, a);
    g.lineWidth = Math.max(1, (mesure ? 3.2 : 2) * s);
    g.beginPath();
    g.moveTo(VPX - l, y);
    g.lineTo(VPX + l, y);
    g.stroke();
  }
  // Les lignes de la route vers le point de fuite, puis ses bords de néon
  g.strokeStyle = hsl(188, 100, 66, 0.25 + 0.15 * e);
  g.lineWidth = 1.5;
  g.beginPath();
  for (let i = -3; i <= 3; i++) {
    g.moveTo(VPX, VPY);
    g.lineTo(VPX + (i / 4) * bas, H);
  }
  g.stroke();
  for (const [largeur, a] of [
    [14, 0.12],
    [6, 0.3],
    [2.5, 0.95],
  ]) {
    g.strokeStyle = hsl(325, 100, 62, a * (0.8 + 0.4 * bp));
    g.lineWidth = largeur;
    g.beginPath();
    for (const cote of [-1, 1]) {
      g.moveTo(VPX, VPY);
      g.lineTo(VPX + cote * bas, H);
    }
    g.stroke();
  }
}

// Les immeubles rallumés par les traces des notes parfaites (#29) : celui du demi-temps de la note, à gauche pour
// la basse et les deux couloirs de gauche, à droite pour les deux autres ; la fraîcheur de la trace la plus récente
function immeublesAllumes(nb: number): Map<string, number> {
  const allumes = new Map<string, number>();
  for (const { couleur, temps, frais } of tracesVues(nb)) {
    const cle = `${couleur === COULEUR_BASSE || couleur < 2 ? -1 : 1}:${Math.floor(temps * 2)}`;
    allumes.set(cle, Math.max(allumes.get(cle) ?? 0, frais));
  }
  return allumes;
}

function immeuble(cote: number, n: number, dzN: number, vue: VueDeScene, e: number, allumes: Map<string, number>) {
  const { hsl } = vue;
  const h1 = hh(n, 11 + cote),
    h2 = hh(n, 21 + cote),
    h3 = hh(n, 31 + cote),
    dzF = dzN + 0.28 + h1 * 0.14,
    haut = 150 + h2 * 420 + (h2 > 0.85 ? 130 : 0),
    X0 = cote * (500 + h3 * 70),
    large = 280,
    a = fondu(dzN, AVANCE, AVANCE + 2) * clamp((dzN + 0.34) / 0.14, 0, 1);
  if (a <= 0) return;
  const trace = allumes.get(`${cote}:${n}`),
    allume = trace !== undefined || hh(n, 41 + cote) < 0.12 + 0.5 * e,
    flash = trace ?? 0,
    [xn, yn0, sN] = P(X0, 0, dzN),
    [, ynH] = P(X0, haut, dzN),
    [xf, yf0] = P(X0, 0, dzF),
    [, yfH] = P(X0, haut, dzF),
    [xb] = P(X0 + cote * large, 0, dzN);
  g.globalAlpha = a;
  // La façade qui longe la route, puis la face qui regarde la caméra
  g.beginPath();
  g.moveTo(xf, yf0);
  g.lineTo(xf, yfH);
  g.lineTo(xn, ynH);
  g.lineTo(xn, yn0);
  g.closePath();
  g.fillStyle = allume ? hsl(272, 60, 17) : hsl(268, 60, 9);
  g.fill();
  g.fillStyle = allume ? hsl(276, 60, 12) : hsl(268, 60, 6);
  g.fillRect(Math.min(xn, xb), ynH, Math.abs(xb - xn), yn0 - ynH);
  // Les fenêtres, par rangées de 34 pixels : chacune est un quadrilatère, rangé avec les allumées ou les éteintes,
  // puis chaque groupe est rempli d'un coup
  const rangees = Math.floor((haut - 30) / 34),
    eteintes: number[][] = [],
    claires: number[][] = [],
    fenetre = (r: number, c: number) => (allume && hh(n * 31 + r * 7 + c, cote + 50) < 0.72 ? claires : eteintes);
  for (let c = 0; c < 3; c++) {
    const za = dzN + ((c + 0.22) / 3) * (dzF - dzN),
      zb = dzN + ((c + 0.78) / 3) * (dzF - dzN);
    for (let r = 0; r < rangees; r++) {
      const y1 = 26 + r * 34,
        [xa, ya1] = P(X0, y1, za),
        [, ya2] = P(X0, y1 + 18, za),
        [xc, yb1] = P(X0, y1, zb),
        [, yb2] = P(X0, y1 + 18, zb);
      fenetre(r, c).push([xa, ya1, xc, yb1, xc, yb2, xa, ya2]);
    }
  }
  for (let c = 0; c < 5; c++) {
    const [x1] = P(X0 + cote * (22 + c * 52), 0, dzN),
      [x2] = P(X0 + cote * (48 + c * 52), 0, dzN);
    for (let r = 0; r < rangees; r++) {
      const [, y2] = P(X0, 26 + r * 34, dzN),
        [, y1] = P(X0, 26 + r * 34 + 18, dzN);
      fenetre(r, c + 9).push([x1, y1, x2, y1, x2, y2, x1, y2]);
    }
  }
  remplir(eteintes, hsl(265, 50, 30, 0.45));
  remplir(claires, hsl(n % 3 === 0 ? 338 : 38, 100, 68, 0.55 + 0.45 * flash));
  // L'arête éclairée par le néon de la route, et l'éclat de l'immeuble qu'une note parfaite vient de rallumer
  g.strokeStyle = hsl(325, 100, 62, allume ? 0.75 : 0.4);
  g.lineWidth = Math.max(1, 2 * sN);
  g.beginPath();
  g.moveTo(xn, yn0);
  g.lineTo(xn, ynH);
  g.lineTo(xb, ynH);
  g.stroke();
  if (flash > 0) {
    const cx = (xn + xf) / 2,
      cy = (ynH + yn0) / 2,
      r = Math.max(20, (yn0 - ynH) * 0.8),
      eclat = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    eclat.addColorStop(0, hsl(320, 100, 75, 0.5 * flash));
    eclat.addColorStop(1, hsl(320, 100, 75, 0));
    g.fillStyle = eclat;
    g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  g.globalAlpha = 1;
}

// Remplit d'un coup des quadrilatères (x1, y1, … x4, y4)
function remplir(quads: number[][], couleur: string) {
  g.beginPath();
  for (const q of quads) {
    g.moveTo(q[0], q[1]);
    for (let i = 2; i < 8; i += 2) g.lineTo(q[i], q[i + 1]);
    g.closePath();
  }
  g.fillStyle = couleur;
  g.fill();
}

// Un poteau de chaque côté, à chaque temps : il tient les fils de la mélodie et une lampe de rue
function poteau(cote: number, dz: number, hsl, e: number) {
  const [xb, yb, s] = P(cote * 410, 0, dz),
    [xt, yt] = P(cote * 410, SOL - RAILS[1][1] + 20, dz),
    // Il s'efface au loin, et juste avant de passer à côté de la caméra
    a = fondu(dz, AVANCE - 1, AVANCE + 1) * clamp((dz - 0.12) / 0.3, 0, 1);
  g.globalAlpha = a;
  g.strokeStyle = hsl(270, 55, 13);
  g.lineCap = "butt";
  g.lineWidth = Math.max(1.5, 9 * s);
  g.beginPath();
  g.moveTo(xb, yb);
  g.lineTo(xt, yt);
  // Les bras qui tiennent les fils : en haut pour les rails du milieu, plus bas pour ceux des bords
  for (const [x, y] of [RAILS[1], RAILS[0]]) {
    const [x1, y1] = P(cote * 410, SOL - y, dz),
      [x2, y2] = P(cote * Math.abs(x), SOL - y, dz);
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
  g.stroke();
  g.lineWidth = Math.max(1, 6 * s);
  g.strokeStyle = hsl(270, 55, 13);
  // La lampe de rue et son cône de lumière
  const [xl, yl] = P(cote * 300, SOL - RAILS[1][1] + 6, dz),
    lum = 0.25 + 0.6 * e,
    [xs1, ys] = P(cote * 210, 0, dz),
    [xs2] = P(cote * 360, 0, dz),
    cone = g.createLinearGradient(0, yl, 0, ys);
  cone.addColorStop(0, hsl(28, 100, 78, 0.16 * lum));
  cone.addColorStop(1, hsl(28, 100, 78, 0));
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(xl - 10 * s, yl);
  g.lineTo(xl + 10 * s, yl);
  g.lineTo(xs2, ys);
  g.lineTo(xs1, ys);
  g.closePath();
  g.fill();
  g.fillStyle = hsl(28, 100, 80, lum);
  g.fillRect(xl - 12 * s, yl - 2 * s, 24 * s, 5 * s);
  // Le néon qui lèche le poteau côté route
  g.strokeStyle = hsl(325, 100, 62, 0.35);
  g.lineWidth = Math.max(1, 2 * s);
  g.beginPath();
  g.moveTo(xb - cote * 3 * s, yb);
  g.lineTo(xt - cote * 3 * s, yt);
  g.stroke();
  g.globalAlpha = 1;
}

// Les fils électriques : un par rail de la mélodie, à sa couleur, qui pend un peu entre deux poteaux et bat au temps
function fils(vue: VueDeScene) {
  const { nb, hsl, pulsation: bp } = vue;
  g.lineCap = "round";
  for (let r = 0; r < 4; r++) {
    const [x, y] = RAILS[r],
      tracer = () => {
        g.beginPath();
        for (let k = Math.floor(nb - 0.3); k < nb + AVANCE + 1; k++)
          for (let i = 0, premier = true; i <= 8; i++) {
            const u = i / 8,
              dz = k + u - nb;
            if (dz < -0.25) continue;
            const [px, py] = projeter(x, y + 4 * u * (1 - u) * 10, dz);
            if (premier) g.moveTo(px, py);
            else g.lineTo(px, py);
            premier = false;
          }
      };
    tracer();
    g.strokeStyle = "rgba(10,4,20,0.85)";
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = hsl(LANE_HUE[r], 90, 66, 0.14 + 0.1 * bp + (vue.solo ? 0.12 * bp : 0));
    g.lineWidth = 9;
    g.stroke();
    g.strokeStyle = hsl(LANE_HUE[r], 90, 72, 0.6 + 0.3 * bp);
    g.lineWidth = 1.6;
    g.stroke();
  }
}

/**
 * Le coursier vu de dos (#82) : sweat à capuche, bande de néon dans le dos, casque audio. Il court, saute
 * (`haut`), glisse accroupi les jambes écartées, s'écrase sur la plaque ; blessé, il rougit. Dessiné dans le repère
 * de sa pose, ses pieds en (x, sol) ; renvoie sa main levée, d'où partent les tirs.
 */
export function personnageVille(p: GesteDuPersonnage): [number, number] {
  const { hsl } = p,
    gl = p.glisse ? 1 : 0,
    course = p.court ? p.phase / Math.PI : 0,
    bob = p.court ? -Math.abs(Math.sin(course * Math.PI)) * 4 : 0,
    saute = p.haut < -2 ? 1 : 0,
    hanche = -48 + 28 * gl + 8 * saute,
    epaule = -84 + 38 * gl + 6 * saute,
    tete = -98 + 38 * gl + 5 * saute,
    corps = p.blesse ? COL.bad : hsl(268, 60, 30),
    [sx, sy] = [1 + 0.22 * p.ecrase, 1 - 0.24 * p.ecrase];
  g.save();
  g.translate(p.x, p.sol + p.haut);
  g.scale(0.8 * sx, 0.8 * sy);
  g.lineCap = g.lineJoin = "round";
  // Les jambes et les patins
  const ph = Math.sin(course * Math.PI * 2);
  for (const s of [-1, 1]) {
    const fx = saute ? s * 13 : s * (9 + 21 * gl),
      fy = saute ? -26 : gl < 0.5 ? -Math.max(0, s * ph) * 16 : 0,
      kx = s * (14 + 20 * gl) + saute * s * 6,
      ky = gl ? -12 : (hanche + fy) / 2 - 2 - saute * 4;
    g.strokeStyle = hsl(265, 60, 15);
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(s * 8, hanche + bob);
    g.lineTo(kx, ky + bob);
    g.lineTo(fx, fy - 4);
    g.stroke();
    g.fillStyle = hsl(250, 60, 92);
    g.beginPath();
    g.ellipse(fx, fy - 3, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hsl(188, 100, 66);
    g.fillRect(fx - 8, fy - 0.5, 16, 2.5);
  }
  // Les bras : le droit levé vers les rails, le gauche en balancier
  const main: [number, number] = [30, epaule - 30 + bob];
  for (const s of [-1, 1]) {
    const ex = s * 19,
      ey = epaule + 6 + bob,
      [hx, hy] = s > 0 ? main : gl ? [-40, -4] : [-24, ey + 26 + ph * 6];
    g.strokeStyle = hsl(268, 60, 24);
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo((ex + hx) / 2 + s * 4, (ey + hy) / 2 + 4);
    g.lineTo(hx, hy);
    g.stroke();
    g.fillStyle = hsl(20, 60, 85);
    g.beginPath();
    g.arc(hx, hy, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  // Le sweat, et la bande de néon dans le dos
  g.fillStyle = corps;
  g.beginPath();
  g.moveTo(-21, epaule + 4 + bob);
  g.quadraticCurveTo(0, epaule - 6 + bob, 21, epaule + 4 + bob);
  g.lineTo(17, hanche + 4 + bob);
  g.quadraticCurveTo(0, hanche + 8 + bob, -17, hanche + 4 + bob);
  g.closePath();
  g.fill();
  g.strokeStyle = hsl(325, 100, 62, 0.75);
  g.lineWidth = 1.5;
  g.stroke();
  g.strokeStyle = hsl(325, 100, 62);
  g.lineWidth = 3;
  g.beginPath();
  for (const s of [-8, 8]) {
    g.moveTo(s, epaule + 8 + bob);
    g.lineTo(s, hanche + 2 + bob);
  }
  g.stroke();
  // La capuche et le casque audio
  g.fillStyle = hsl(268, 60, 22);
  g.beginPath();
  g.ellipse(0, tete + bob, 15, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hsl(188, 100, 66);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, tete + bob + 2, 15, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke();
  g.fillStyle = hsl(188, 100, 66);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 15, tete + bob + 3, 4.5, 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  return [p.x + main[0] * 0.8 * sx, p.sol + p.haut + main[1] * 0.8 * sy];
}
