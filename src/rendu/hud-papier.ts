/* ---------- Le HUD discret en papier découpé (#78) ---------- */
// Hors de Débutant et des essais, la légende complète (les degrés, les notes et les touches de chaque couloir) quitte
// la scène : la touche ne se montre qu'au point d'impact, sur la cible de son couloir ; celles de la basse, sur deux
// petites étiquettes aux pieds du personnage ; l'accord en cours, sur une étiquette pendue en haut à gauche, qui se
// retourne quand il change. Commun à toutes les scènes (ADR-0019).
import { S } from "../jeu/etat";
import { clamp } from "../outils";
import { FONT, formeCouloir, g, reduced, txt, type Palette } from "./outils";
import type { Pose } from "./scenes/contrat";

const ENCRE = "#17142b",
  PAPIER = "#fbf3df";

/** La légende complète reste en Débutant et dans les essais */
export const legendeComplete = () => S.diff === "debutant" || !!S.essai;

/**
 * La cible d'un couloir, à son point d'impact : sa forme découpée dans du papier, cernée de sa couleur, qui
 * s'allume sous le doigt (`allume`, de 0 à 1), et sa touche écrite dessus.
 */
export function cible(i: number, p: Pose, touche: string, couleur: (a: number) => string, allume: number) {
  const r = 17 * p.echelle;
  formeCouloir(i, p.x + 2, p.y + 3, r);
  g.fillStyle = "rgba(0,0,0,.3)";
  g.fill();
  formeCouloir(i, p.x, p.y, r);
  g.fillStyle = PAPIER;
  g.globalAlpha = 0.85;
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = couleur(0.25 + 0.75 * allume);
  g.fill();
  g.strokeStyle = couleur(1);
  g.lineWidth = 2.5;
  g.stroke();
  const taille = touche.length > 2 ? 10 : 13;
  txt(touche, p.x, p.y + taille * 0.36 + (i === 1 ? 3 : 0), `700 ${taille}px ${FONT.mono}`, ENCRE, "center");
}

// Une petite étiquette de papier avec une touche, enfoncée quand on la joue
function etiquette(x: number, y: number, texte: string, couleur: string, enfoncee: boolean) {
  g.font = `700 12px ${FONT.mono}`;
  const w = Math.max(20, g.measureText(texte).width + 10),
    dy = enfoncee ? 2 : 0;
  g.fillStyle = "rgba(0,0,0,.35)";
  g.fillRect(x - w / 2 + 2, y - 8 + 3, w, 18);
  g.fillStyle = enfoncee ? couleur : PAPIER;
  g.fillRect(x - w / 2, y - 10 + dy, w, 18);
  g.fillStyle = couleur;
  g.fillRect(x - w / 2, y + 6 + dy, w, 2);
  txt(texte, x, y + 4 + dy, `700 12px ${FONT.mono}`, ENCRE, "center");
}
/** Les touches de la basse aux pieds du personnage, en (x, sol) : sauter à gauche, glisser à droite */
export function touchesDeLaBasse(
  x: number,
  sol: number,
  sauter: string,
  glisser: string,
  couleur: string,
  enfoncees: [boolean, boolean],
) {
  etiquette(x - 22, sol + 26, sauter, couleur, enfoncees[0]);
  etiquette(x + 22, sol + 26, glisser, couleur, enfoncees[1]);
}

// L'accord affiché, et l'heure où il a changé : l'étiquette se retourne
let accordAffiche = "",
  retourneAt = -1e9;
/** L'accord en cours, sur une étiquette pendue à un fil, en haut à gauche de la scène */
export function etiquetteDAccord(nom: string, teinte: number, hsl: Palette, pnow: number) {
  if (nom !== accordAffiche) {
    accordAffiche = nom;
    retourneAt = pnow;
  }
  const k = clamp((pnow - retourneAt) / 280, 0, 1),
    retourne = reduced ? 1 : Math.abs(Math.cos(k * Math.PI)) * 0.96 + 0.04,
    balance = reduced ? 0 : Math.sin(pnow / 450) * 0.03 + (1 - k) * 0.1 * Math.sin(k * 20),
    x = 120,
    haut = 92;
  g.save();
  g.strokeStyle = PAPIER;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, haut);
  g.lineTo(x, haut + 14);
  g.stroke();
  g.translate(x, haut + 14);
  g.rotate(balance);
  g.scale(retourne, 1);
  const forme = () => {
    g.beginPath();
    g.moveTo(-20, 0);
    g.lineTo(20, 0);
    g.lineTo(48, 14);
    g.lineTo(48, 62);
    g.lineTo(-48, 62);
    g.lineTo(-48, 14);
    g.closePath();
  };
  g.save();
  g.translate(2, 4);
  forme();
  g.fillStyle = "rgba(0,0,0,.4)";
  g.fill();
  g.restore();
  forme();
  g.fillStyle = PAPIER;
  g.fill();
  g.fillStyle = hsl(teinte, 70, 55);
  g.fillRect(-48, 54, 96, 8);
  g.beginPath();
  g.arc(0, 9, 3.5, 0, Math.PI * 2);
  g.fillStyle = ENCRE;
  g.fill();
  txt(nom, 0, 44, `800 28px ${FONT.display}`, ENCRE, "center");
  g.restore();
}
