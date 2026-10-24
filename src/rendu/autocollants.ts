/* ---------- Les jugements en autocollants (#78) ---------- */
// Les jugements (`S.pops`, `popup`) sont des autocollants de bande dessinée : un « Parfait » ou un « Bien » est une
// petite étiquette de papier qui monte au-dessus de son couloir ; tout le reste (un raté, un accord, un bonus) est
// un autocollant qui se colle d'un coup, tient un instant, puis se décolle par un coin et s'envole. Un nouvel
// autocollant fait décoller les précédents. Avec « Mouvement réduit », ils ne tournent pas et s'effacent sans se
// décoller.
import { S } from "../jeu/etat";
import { clamp } from "../outils";
import { COL, FONT, W, g, reduced } from "./outils";

type Pop = (typeof S.pops)[number];

/** Combien de temps un jugement reste sur la scène, en ms */
export const DUREE_AUTOCOLLANT = 1100;
// Les étapes d'un autocollant : il se colle, tient, se décolle, puis s'envole
const COLLE = 200,
  DECOLLE = 260,
  ENVOL = 240,
  DUREE_ETIQUETTE = 650;
const ENCRE = "#17142b",
  PAPIER = "#fbf8f0",
  DOS = "#ece5d6";

/** Une étiquette, pas un autocollant : le jugement ordinaire d'une note */
const etiquette = (p: Pop) => p.text === "Parfait" || p.text === "Bien";

// La couleur de l'encre de chaque genre de jugement : jaune pour un bonus, gris pour un raté, bleu sinon
function teinte(p: Pop) {
  if (p.color === COL.bad) return "#b9bdd0";
  if (p.color === COL.good) return "#ffd23f";
  return "#8fd3ff";
}
const angle = (p: Pop, k: number) => (reduced ? 0 : (((p.at * 7.31 + k) % 1) - 0.5) * 0.4);

/** Les jugements de la scène, à l'heure `pnow` : on les garde le temps de leur animation */
export function dessinerAutocollants(pnow: number) {
  S.pops = S.pops.filter((p) => pnow - p.at < (etiquette(p) ? DUREE_ETIQUETTE : DUREE_AUTOCOLLANT));
  const gros = S.pops.filter((p) => !etiquette(p));
  for (const p of S.pops) {
    if (etiquette(p)) dessinerEtiquette(p, pnow);
    else {
      // Il tient jusqu'à ce qu'un autre se colle, au plus longtemps que prévu
      const suivant = gros.find((q) => q.at > p.at),
        tient = Math.min(DUREE_AUTOCOLLANT - COLLE - DECOLLE - ENVOL, suivant ? suivant.at - p.at - COLLE : Infinity);
      // Un autocollant qu'un autre remplace se décolle deux fois plus vite
      dessinerAutocollant(p, pnow - p.at, Math.max(0, tient), suivant ? 2 : 1);
    }
  }
}

// L'étiquette : un papier blanc, un liseré de la couleur du jugement, le mot à l'encre ; elle monte et s'efface
function dessinerEtiquette(p: Pop, pnow: number) {
  const k = (pnow - p.at) / DUREE_ETIQUETTE,
    police = `700 14px ${FONT.body}`;
  g.save();
  g.translate(p.x - 20, p.y - 6 - (1 - Math.pow(1 - k, 3)) * 22);
  g.rotate(reduced ? 0 : -0.08);
  g.globalAlpha = 1 - k * k;
  g.font = police;
  const w = g.measureText(p.text).width + 16;
  g.fillStyle = "rgba(0,0,0,.35)";
  g.fillRect(2, -9, w, 22);
  g.fillStyle = PAPIER;
  g.fillRect(0, -11, w, 22);
  g.fillStyle = p.color === COL.good ? "#ffd23f" : "#8fd3ff";
  g.fillRect(0, -11, 4, 22);
  g.fillStyle = ENCRE;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(p.text, 9, 1);
  g.restore();
}

/**
 * Un autocollant, `t` ms après qu'il a été posé, qui tient `tient` ms : une silhouette de papier blanc autour du mot,
 * le mot cerné d'encre et rempli de sa couleur. Il se colle en rétrécissant, puis se décolle par un coin : la part
 * décollée se replie et montre le dos du papier.
 */
function dessinerAutocollant(p: Pop, t: number, tient: number, vite: number) {
  const taille = p.text.length > 14 ? 26 : 32,
    police = `800 ${taille}px ${FONT.display}`,
    rot = angle(p, 0),
    coin = (p.at * 3.17) % 1 < 0.5 ? 1 : -1;
  let echelle = 1,
    r = rot,
    dy = 0,
    alpha = 1,
    decolle = 0;
  if (t < COLLE) {
    const k = depasse(clamp(t / COLLE, 0, 1));
    echelle = 1.6 + (1 - 1.6) * k;
    r = angle(p, 0.5) + (rot - angle(p, 0.5)) * k;
    alpha = clamp(t / 60, 0, 1);
  } else if (t > COLLE + tient) {
    const u = (t - COLLE - tient) * vite;
    if (reduced) alpha = 1 - clamp(u / (DECOLLE + ENVOL), 0, 1);
    else {
      decolle = clamp(u / DECOLLE, 0, 1);
      if (u > DECOLLE) {
        const k = clamp((u - DECOLLE) / ENVOL, 0, 1);
        dy = -k * 60;
        alpha = 1 - k;
        r += k * 0.5 * coin;
      }
    }
  }
  if (alpha <= 0) return;
  g.save();
  g.font = police;
  const w = g.measureText(p.text).width + taille,
    h = taille * 1.6;
  // Il reste entier dans la scène, quelle que soit la place de sa note
  g.translate(clamp(p.x, Math.min(W / 2, w / 2 + 8), Math.max(W / 2, W - w / 2 - 8)), p.y + dy);
  g.rotate(r);
  g.scale(echelle, echelle);
  g.globalAlpha = alpha;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  if (decolle <= 0) face(p, taille, true);
  else {
    // Le pli part d'un coin du haut et avance vers le milieu ; la part décollée est retournée de l'autre côté du pli
    const cx = (coin * w) / 2,
      cy = -h / 2,
      long = Math.hypot(cx, cy),
      n = [cx / long, cy / long],
      d = lisse(decolle) * (w + h) * 0.4,
      P = [cx - n[0] * d, cy - n[1] * d],
      demi = (signe: number) => {
        const L = 3000,
          tx = -n[1],
          ty = n[0];
        g.beginPath();
        g.moveTo(P[0] + tx * L, P[1] + ty * L);
        g.lineTo(P[0] - tx * L, P[1] - ty * L);
        g.lineTo(P[0] - tx * L + signe * n[0] * L, P[1] - ty * L + signe * n[1] * L);
        g.lineTo(P[0] + tx * L + signe * n[0] * L, P[1] + ty * L + signe * n[1] * L);
        g.closePath();
      };
    g.save();
    demi(-1);
    g.clip();
    face(p, taille, true);
    g.restore();
    const pn = P[0] * n[0] + P[1] * n[1];
    g.save();
    g.transform(
      1 - 2 * n[0] * n[0],
      -2 * n[0] * n[1],
      -2 * n[0] * n[1],
      1 - 2 * n[1] * n[1],
      2 * pn * n[0],
      2 * pn * n[1],
    );
    demi(1);
    g.clip();
    face(p, taille, false);
    g.restore();
  }
  g.restore();
}
// Une face de l'autocollant : le devant (l'ombre, la silhouette, le mot) ou le dos (la silhouette seule)
function face(p: Pop, taille: number, devant: boolean) {
  const silhouette = (couleur: string, dx = 0, dy = 0) => {
    g.strokeStyle = couleur;
    g.fillStyle = couleur;
    g.lineWidth = taille * 0.5;
    g.strokeText(p.text, dx, dy);
    g.fillText(p.text, dx, dy);
  };
  if (!devant) return silhouette(DOS);
  silhouette("rgba(0,0,0,.35)", 2, 4);
  silhouette(PAPIER);
  g.lineWidth = taille * 0.16;
  g.strokeStyle = ENCRE;
  g.strokeText(p.text, 2, 3);
  g.strokeText(p.text, 0, 0);
  g.fillStyle = teinte(p);
  g.fillText(p.text, 0, 0);
}
const lisse = (t: number) => t * t * (3 - 2 * t);
const depasse = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
