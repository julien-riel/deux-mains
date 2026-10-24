/* ---------- Les zones tactiles dessinées (ADR-0019, question 4A) ---------- */
// En mode tactile, autour de la scène : la colonne de la main gauche (sauter, glisser) et la rangée des quatre doigts
// de la main droite, chacune avec la forme et la couleur de son degré (ADR-0006). Une zone s'allume quand une note
// de son couloir approche, et s'enfonce sous le doigt. La géométrie est dans `zones.ts`, commune à toutes les scènes ;
// l'univers n'habille que les couleurs du pupitre (ADR-0015).
import { COULOIRS, S, autoFor, spb, type Action } from "../jeu/etat";
import { couloirDe } from "../jeu/jugement";
import { clamp } from "../outils";
import { TH } from "../univers/univers";
import { FONT, H, HUE_BASS, LANE_HUE, W, cv, formeCouloir, g, rr, txt } from "./outils";
import type { Cadre } from "./scenes/contrat";
import { zonesTactiles } from "./zones";

/** Combien de temps avant sa note une zone commence à s'allumer, en temps */
export const ANNONCE = 1;
// Le nom de chaque doigt de la main droite, du couloir 0 au couloir 3
const DOIGTS = ["index", "majeur", "annulaire", "auriculaire"];
// L'épaisseur de la lèvre d'une zone : la face descend d'autant quand on la touche
const LEVRE = 8;

// La zone de la main gauche d'un obstacle : en haut, le saut, le double saut et la marche qui monte (#7, #13) ; en
// bas, la glissade, la plaque à écraser et la marche qui descend (#8, ADR-0008)
const zoneDeLaBasse = (lane: number): Action => (lane === 1 || lane === 2 || lane === 4 ? "sauter" : "glisser");

/**
 * Combien chaque zone est allumée au temps `nb`, de 0 à 1 : elle monte pendant le temps qui précède la prochaine
 * note de son couloir (ou de son geste, à gauche), et vaut 1 quand la note est là. Une petite note (#14) allume la
 * zone qui la joue, celle du dessous ; un serpent (#16), le couloir où il en est. La réponse au chanteur (#18) ne
 * montre pas son couloir : elle n'allume rien.
 */
export function annonces(nb: number): Partial<Record<Action, number>> {
  const a: Partial<Record<Action, number>> = {};
  for (const ev of S.ev) {
    if (ev.beat > nb + ANNONCE) break;
    if (ev.state !== "pending" || ev.reponse || ev.beat < nb - 0.05) continue;
    const zone = ev.hand === "L" ? zoneDeLaBasse(ev.lane) : COULOIRS[Math.floor(couloirDe(ev))],
      lueur = clamp(1 - (ev.beat - nb) / ANNONCE, 0, 1);
    if (zone && lueur > 0) a[zone] = Math.max(a[zone] ?? 0, lueur);
  }
  return a;
}

// Une zone : sa lèvre, sa face (qui s'enfonce), la lueur qui monte avant sa note, et l'éclair du coup réussi
function zone(z: Cadre, teinte: number, enfoncee: boolean, annonce: number, eclair: number) {
  const r = Math.min(18, z.hauteur / 4),
    fy = z.y + (enfoncee ? LEVRE - 2 : 0),
    fh = z.hauteur - LEVRE,
    couleur = (l: number, a = 1) => `hsla(${teinte},80%,${l}%,${a})`;
  rr(z.x, z.y + 2, z.largeur, z.hauteur - 2, r);
  g.fillStyle = couleur(enfoncee ? 22 : 28);
  g.fill();
  rr(z.x, fy, z.largeur, fh, r);
  g.fillStyle = TH().rail;
  g.fill();
  g.fillStyle = enfoncee ? couleur(62) : couleur(60, 0.16 + 0.5 * eclair);
  g.fill();
  if (annonce > 0 && !enfoncee) {
    g.save();
    rr(z.x, fy, z.largeur, fh, r);
    g.clip();
    const h = fh * annonce,
      lueur = g.createLinearGradient(0, fy + fh - h, 0, fy + fh);
    lueur.addColorStop(0, couleur(62, 0.55));
    lueur.addColorStop(1, couleur(62, 0.2));
    g.fillStyle = lueur;
    g.fillRect(z.x, fy + fh - h, z.largeur, h);
    g.fillStyle = couleur(82, 0.95);
    g.fillRect(z.x, fy + fh - h - 2, z.largeur, 4);
    g.restore();
  }
  rr(z.x + 4, fy + 4, z.largeur - 8, fh - 8, r - 4);
  g.strokeStyle = couleur(70, enfoncee ? 0 : 0.3 + 0.5 * annonce);
  g.lineWidth = 2;
  g.stroke();
  rr(z.x, fy, z.largeur, fh, r);
  g.strokeStyle = TH().under;
  g.lineWidth = 3;
  g.stroke();
  return { fy, fh };
}

// Un rectangle arrondi ajouté au chemin en cours, sans le recommencer : le trou de la scène dans le pupitre
function trou(x: number, y: number, w: number, h: number, r: number) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Un chevron, vers le haut (sauter) ou vers le bas (glisser)
function chevron(x: number, y: number, haut: boolean, couleur: string) {
  const d = haut ? 1 : -1;
  g.lineCap = g.lineJoin = "round";
  g.beginPath();
  g.moveTo(x - 34, y + 17 * d);
  g.lineTo(x, y - 17 * d);
  g.lineTo(x + 34, y + 17 * d);
  g.strokeStyle = TH().under;
  g.lineWidth = 20;
  g.stroke();
  g.strokeStyle = couleur;
  g.lineWidth = 12;
  g.stroke();
}

/** Dessine les zones tactiles autour de la scène, par-dessus tout ce qui en déborde. Appelé en mode tactile. */
export function dessinerZones(nb: number, pnow: number) {
  g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  const Z = zonesTactiles(W, H),
    s = Z.scene,
    e = Z.sauter.x,
    jouee = S.mode === "play",
    ns = nb * spb(),
    lueurs = jouee ? annonces(nb) : {},
    enfoncee = (a: Action) => S.keys[a] || pnow - (S.keyFlash[a] || -1e9) < 120;
  // Le pupitre : tout ce qui n'est pas la scène, qui s'y découpe aux coins arrondis
  g.beginPath();
  g.rect(0, 0, W, H);
  trou(s.x + e / 2, s.y + e, s.largeur - 1.5 * e, s.hauteur - e, 16);
  g.fillStyle = TH().under;
  g.fill("evenodd");

  // La main gauche : sauter en haut, glisser en bas (la plaque s'écrase en glissant, #8)
  for (const [a, z, haut] of [
    ["sauter", Z.sauter, true],
    ["glisser", Z.glisser, false],
  ] as const) {
    const bas = enfoncee(a) || (a === "glisser" && (enfoncee("ecraser") || (autoFor("L") && ns < S.slideUntil))),
      { fy, fh } = zone(z, HUE_BASS, bas, lueurs[a] ?? 0, 0),
      cx = z.x + z.largeur / 2,
      cy = fy + fh / 2,
      encre = bas ? TH().under : "#fff4e0";
    chevron(cx, cy - 26, haut, bas ? "#fff4e0" : `hsl(${HUE_BASS},90%,62%)`);
    txt(haut ? "SAUTE" : "GLISSE", cx, cy + 30, `700 24px ${FONT.display}`, encre, "center");
    txt("pouce gauche", cx, cy + 54, `600 14px ${FONT.body}`, bas ? TH().under : "rgba(255,244,224,0.6)", "center");
    if (autoFor("L")) txt("AUTO", z.x + 16, fy + 24, `600 11px ${FONT.mono}`, "rgba(255,244,224,0.5)");
  }

  // La main droite : un doigt par couloir, avec la forme et la couleur de son degré
  Z.couloirs.forEach((z, i) => {
    const a = COULOIRS[i],
      bas = enfoncee(a),
      eclair = clamp(1 - (pnow - S.laneFlash[i]) / 300, 0, 1),
      { fy, fh } = zone(z, LANE_HUE[i], bas, lueurs[a] ?? 0, eclair),
      cy = fy + fh / 2,
      fx = z.x + Math.min(48, z.largeur * 0.22),
      taille = 22 * (1 + 0.2 * eclair);
    formeCouloir(i, fx, cy, taille);
    g.fillStyle = bas ? "#fff4e0" : `hsl(${LANE_HUE[i]},80%,65%)`;
    g.fill();
    g.strokeStyle = TH().under;
    g.lineWidth = 3.5;
    g.lineJoin = "round";
    g.stroke();
    const tx = fx + 36;
    txt(DOIGTS[i], tx, cy + 2, `700 21px ${FONT.body}`, bas ? TH().under : "#fff4e0");
    txt("main droite", tx, cy + 22, `600 12px ${FONT.body}`, bas ? TH().under : "rgba(255,244,224,0.55)");
    if (i === 0 && autoFor("R")) txt("AUTO", z.x + 14, fy + 20, `600 11px ${FONT.mono}`, "rgba(255,244,224,0.5)");
  });
}
