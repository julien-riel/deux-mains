// Le remontage entre deux lieux (#27, ADR-0015), dessiné par-dessus la scène au repos : le mécanisme de l'univers
// (la clé de la Boîte, la manivelle de la Ville), la tension qu'il gagne, et la piste des tours qui défilent vers la
// ligne de frappe, aux couleurs de leur main (ADR-0006 : les mêmes dans les deux univers).
import { AC, lat } from "../audio/moteur";
import { S, autoFor } from "../jeu/etat";
import { REMONTAGE, resultatRemontage } from "../jeu/remontage";
import { clamp } from "../outils";
import { COMMANDES, KEYLABEL } from "../ui/touches";
import { TH } from "../univers/univers";
import { boiteCle } from "./boite";
import { COL, FONT, H, W, g, hexA, rr, txt } from "./outils";
import { villeManivelle } from "./ville";

// La piste : la ligne de frappe, et la place d'un temps
const PISTE = { x: 380, y: 500, ppb: 80 };
const reussi = (etat: string) => etat === "parfait" || etat === "bien";
// Un quart de tour par tour réussi, qui s'achève en un quart de seconde après l'appui
const QUART = Math.PI / 2;

export function dessinerRemontage(pnow: number) {
  const r = S.remontage;
  if (!r) return;
  const t = AC.currentTime - lat() - S.decalage - r.debut,
    temps = t / r.spb,
    R = TH().remontage,
    { reussis, total, harmonie } = resultatRemontage(r);

  g.fillStyle = hexA(COL.ink, 0.82);
  g.fillRect(-12, -12, W + 24, H + 24);
  txt(R.titre, W / 2, 112, `700 34px ${FONT.display}`, COL.fg, "center");
  txt(R.consigne, W / 2, 146, `500 16px ${FONT.body}`, COL.muted, "center");

  // Le mécanisme : chaque tour réussi le fait tourner d'un quart de tour, en douceur
  let ang = 0;
  r.tours.forEach((tour, k) => {
    if (!reussi(tour.etat)) return;
    const p = clamp((pnow - r.eclats[k]) / 250, 0, 1);
    ang += QUART * (1 - (1 - p) * (1 - p));
  });
  if (S.theme === "boite") boiteCle(W / 2 - 140, 300, ang, reussis / total);
  else villeManivelle(W / 2 - 200, 300, ang, reussis, total);

  // La tension gagnée : l'harmonie de départ du lieu suivant, de 60 à 100
  const jx = 870,
    jw = 260,
    part = (harmonie - REMONTAGE.min) / (REMONTAGE.max - REMONTAGE.min);
  txt(R.depart.toUpperCase(), jx, 236, `600 11px ${FONT.mono}`, COL.muted);
  txt(String(harmonie), jx + jw, 236, `600 22px ${FONT.mono}`, COL.fg, "right");
  rr(jx, 246, jw, 12, 6);
  g.fillStyle = COL.panel;
  g.fill();
  rr(jx, 246, Math.max(12, jw * (0.15 + 0.85 * part)), 12, 6);
  g.fillStyle = `hsl(${Math.round(harmonie * 1.45)},72%,62%)`;
  g.fill();
  txt(`${reussis} ${R.tours} sur ${total}`, jx, 282, `500 14px ${FONT.body}`, COL.muted);

  // La piste des tours : ils arrivent de la droite vers la ligne de frappe
  g.fillStyle = hexA(COL.fg, 0.12);
  g.fillRect(140, PISTE.y - 1, W - 280, 2);
  g.fillStyle = hexA(COL.fg, 0.6);
  g.fillRect(PISTE.x - 1, PISTE.y - 34, 2, 68);
  const duo = S.practice === "duo";
  r.tours.forEach((tour, k) => {
    const x = PISTE.x + (tour.temps / r.spb - temps) * PISTE.ppb;
    if (x < 120 || x > W - 120) return;
    const couleur = tour.main === "L" ? COL.bass : COL.mel,
      eclat = clamp(1 - (pnow - r.eclats[k]) / 300, 0, 1),
      rayon = 18 + 8 * eclat;
    g.beginPath();
    g.arc(x, PISTE.y, rayon, 0, Math.PI * 2);
    if (tour.etat === "attente") {
      g.fillStyle = hexA(couleur, 0.25);
      g.fill();
      g.strokeStyle = couleur;
      g.lineWidth = 3;
      g.stroke();
    } else {
      g.fillStyle = reussi(tour.etat) ? couleur : hexA(COL.bad, 0.5);
      g.fill();
    }
    const nom = autoFor(tour.main)
      ? "AUTO"
      : tour.main === "L"
        ? duo
          ? "BASSE"
          : "GAUCHE"
        : duo
          ? "MÉLODIE"
          : "DROITE";
    txt(nom, x, PISTE.y + 44, `600 10px ${FONT.mono}`, couleur, "center");
    if (tour.etat === "rate") txt("×", x, PISTE.y + 7, `700 20px ${FONT.display}`, COL.fg, "center");
  });

  // Le décompte, au-dessus de la ligne de frappe
  if (temps >= 0 && temps < REMONTAGE.decompte)
    txt(String(Math.floor(temps) + 1), PISTE.x, PISTE.y - 50, `700 40px ${FONT.display}`, COL.fg, "center");

  // Les commandes : n'importe quelle touche de sa main fait son tour
  const aide = COMMANDES.tactile
    ? "POUCE GAUCHE SUR LA COLONNE DE GAUCHE, POUCE DROIT SUR LES ZONES DU BAS"
    : `GAUCHE : ${KEYLABEL.KeyW} ${KEYLABEL.KeyS} ${KEYLABEL.Space} · DROITE : ${KEYLABEL.KeyJ} ${KEYLABEL.KeyK} ${KEYLABEL.KeyL} ${KEYLABEL.Semicolon} · ÉCHAP : PASSER`;
  txt(aide, W / 2, 596, `600 11px ${FONT.mono}`, COL.muted, "center");
}
