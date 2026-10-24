// L'éditeur de partitions (#28, ADR-0016) : l'ouvrir, y toucher la grille, écouter et jouer le brouillon, le ranger
// dans la sauvegarde et le partager par un code. Le brouillon reste en mémoire entre deux écoutes. Pendant un essai,
// on range dans sa progression fictive : la sauvegarde du joueur n'est jamais touchée.
import { playHit } from "../audio/instruments";
import { AC, B, initAudio } from "../audio/moteur";
import { composer, empreinteDe, lirePartition, type Partition } from "../chanson/partition";
import { PAS_PAR_MESURE, enTemps, memeTemps } from "../chanson/temps";
import {
  LIGNES,
  ajouterMesure,
  ajouterSection,
  changerDivision,
  changerGenre,
  deplacerSection,
  partitionNeuve,
  regler,
  retirerMesure,
  retirerSection,
  toucher,
  type ChoixDeGenre,
  type Outil,
  type Reglage,
} from "../jeu/editeur";
import { newRun } from "../jeu/deroulement";
import { S, airEnCours, enComposition, progression, type EditeurEnCours } from "../jeu/etat";
import { decoderPartition, encoderPartition } from "../sauvegarde/code";
import { MAX_COMPOSITIONS, compositions, rangerComposition, retirerComposition } from "../sauvegarde/format";
import { overlay, show } from "./ecrans";
import { titreDe } from "./ecran-editeur";
import { remplacer } from "./progression";
import { chargerComposition, diffDuJoueur, load } from "./reglages";

/** Un éditeur neuf sur cette partition ; ouvert pendant un essai, il disparaît en quittant les essais */
const editeurSur = (partition: Partition, rangee: string | null = null): EditeurEnCours => ({
  partition,
  section: Math.min(1, partition.sections.length - 1),
  outil: "note",
  vue: "grille",
  rangee,
  message: "",
  ...(S.essai ? { essai: true as const } : {}),
});

// Redessine l'éditeur en gardant la grille défilée au même endroit, et le focus sur la même case (clavier)
function afficher() {
  if (S.mode !== "editeur") return;
  const grille = overlay.querySelector?.<HTMLElement>(".cylindre"),
    x = grille?.scrollLeft ?? 0,
    y = overlay.scrollTop ?? 0,
    actif = document.activeElement as HTMLElement | null,
    cle = actif?.dataset?.act && overlay.contains?.(actif) ? { ...actif.dataset } : null;
  show("editeur");
  const nouvelle = overlay.querySelector?.<HTMLElement>(".cylindre");
  if (nouvelle) nouvelle.scrollLeft = x;
  overlay.scrollTop = y;
  if (cle) {
    const filtre = Object.entries(cle)
      .map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${v}"]`)
      .join("");
    overlay.querySelector?.<HTMLElement>(`button${filtre}, select${filtre}`)?.focus();
  }
}
const dire = (message: string) => {
  S.editeur.message = message;
  afficher();
};

/** Ouvre l'éditeur sur le brouillon en cours, ou sur un cylindre vide ; pendant un essai, sur `exemple` */
export function ouvrirEditeur(exemple?: Partition) {
  if (exemple) S.editeur = editeurSur(exemple);
  S.editeur ??= editeurSur(partitionNeuve());
  S.editeur.vue = "grille";
  S.editeur.message = "";
  S.mode = "editeur";
  afficher();
}

/** Quitte l'éditeur : l'écran de départ ; après avoir joué une composition, celui de la chanson du joueur */
export function fermerEditeur() {
  // Un air du répertoire ouvert dans l'éditeur (ADR-0018) : on revient à son écran de départ
  if (enComposition() && !airEnCours() && !S.essai) return load(S.seed, diffDuJoueur());
  S.mode = "title";
  show("title");
}

/** Joue le brouillon, ou l'écoute en auto-play : la composition s'installe comme une chanson */
export function jouerBrouillon(auto: boolean) {
  const p = lirePartition(S.editeur.partition);
  if (!p) return dire("Ce brouillon n'est pas une partition valide.");
  chargerComposition(p);
  newRun(auto);
}

// Fait entendre la note qu'on vient de poser, dans l'accord de sa mesure (ADR-0003)
function entendre(mesure: number, ligne: number, k: number) {
  const E = S.editeur,
    L = LIGNES[ligne],
    sec = E.partition.sections[E.section],
    bar = E.partition.sections.slice(0, E.section).reduce((n, s) => n + s.mesures, 0) + mesure,
    motif = (L.main === "L" ? sec.basse : sec.melodie)[mesure % (L.main === "L" ? sec.basse : sec.melodie).length],
    temps = enTemps(bar * PAS_PAR_MESURE + (k * PAS_PAR_MESURE) / motif.length),
    note = composer(E.partition).ev.find(
      (e) => e.hand === L.main && memeTemps(e.beat, temps) && (L.main === "L" || e.lane === L.couloir),
    );
  if (!note) return;
  initAudio();
  if (AC.state === "suspended") AC.resume();
  const t = AC.currentTime;
  B.master.gain.cancelScheduledValues(t);
  B.master.gain.setValueAtTime(0.8, t);
  playHit(note, t + 0.02);
}

/** Range le brouillon dans la progression qui compte, à la place de la version d'où il vient */
export function rangerBrouillon() {
  const E = S.editeur,
    doc = rangerComposition(progression(), E.partition, E.rangee ?? undefined);
  if (!doc)
    return dire(`Il y a déjà ${MAX_COMPOSITIONS} compositions rangées : retires-en une avant d'en ranger une autre.`);
  remplacer(doc);
  E.rangee = empreinteDe(E.partition);
  dire(`« ${titreDe(E.partition)} » est rangé${S.essai ? " (dans la progression fictive de l'essai)" : ""}.`);
}

/** Ouvre un code de partition collé : il remplace le brouillon */
export function ouvrirCode(code: string) {
  const lu = decoderPartition(code);
  if (lu.etat === "plus-recente")
    return dire("Ce code vient d'une version plus récente du jeu : ouvre-le dans la dernière version.");
  if (lu.etat === "invalide") return dire("Ce code n'est pas un code de partition valide : vérifie qu'il est complet.");
  S.editeur = editeurSur(
    lu.partition,
    compositions(progression()).some((p) => empreinteDe(p) === empreinteDe(lu.partition))
      ? empreinteDe(lu.partition)
      : null,
  );
  S.editeur.message = `« ${titreDe(lu.partition)} » est ouvert.`;
  afficher();
}

/** Copie le code du brouillon ; si le presse-papiers refuse, le joueur le sélectionne lui-même */
function copierCode() {
  const manuel = () => dire("Sélectionne le code ci-dessus et copie-le (Ctrl+C, ou un appui long).");
  try {
    navigator.clipboard.writeText(encoderPartition(S.editeur.partition)).then(() => dire("Code copié."), manuel);
  } catch {
    manuel();
  }
}

// Change le brouillon ; la section choisie reste dans la partition
function modifier(p: Partition) {
  const E = S.editeur;
  E.partition = p;
  E.section = Math.min(E.section, p.sections.length - 1);
  E.message = "";
  afficher();
}

/* ---------- Gestes ---------- */
overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  const act = b?.dataset.act;
  if (!act?.startsWith("ed-") || !S.editeur) return;
  const E = S.editeur,
    p = E.partition,
    s = E.section,
    d = b.dataset;
  if (act === "ed-case") {
    const [mesure, ligne, k] = [+d.mesure, +d.ligne, +d.k],
      q = toucher(p, s, mesure, ligne, k, E.outil);
    modifier(q);
    try {
      entendre(mesure, ligne, k);
    } catch {
      /* son indisponible */
    }
  } else if (act === "ed-division") modifier(changerDivision(p, s, +d.mesure, d.main as "L" | "R"));
  else if (act === "ed-section") {
    E.section = +d.section;
    E.message = "";
    afficher();
  } else if (act === "ed-ajouter-section") {
    const q = ajouterSection(p, s);
    if (q === p) return dire("La partition est pleine : retire une section ou des mesures.");
    modifier(q);
    E.section = s + 1;
    afficher();
  } else if (act === "ed-retirer-section") modifier(retirerSection(p, s));
  else if (act === "ed-avant" || act === "ed-apres") {
    const sens = act === "ed-avant" ? -1 : 1,
      q = deplacerSection(p, s, sens);
    if (q !== p) E.section = s + sens;
    modifier(q);
  } else if (act === "ed-plus") {
    const q = ajouterMesure(p, s);
    if (q === p) return dire("Plus de place : une section a au plus 32 mesures, une partition 64.");
    modifier(q);
  } else if (act === "ed-moins") modifier(retirerMesure(p, s));
  else if (act === "ed-outil") {
    E.outil = d.outil as Outil;
    afficher();
  } else if (act === "ed-jouer") jouerBrouillon(false);
  else if (act === "ed-ecouter") jouerBrouillon(true);
  else if (act === "ed-ranger") rangerBrouillon();
  else if (act === "ed-rangement" || act === "ed-grille") {
    E.vue = act === "ed-rangement" ? "rangement" : "grille";
    E.message = "";
    afficher();
  } else if (act === "ed-ouvrir") {
    const choisie = compositions(progression()).find((c) => empreinteDe(c) === d.empreinte);
    if (choisie) S.editeur = editeurSur(choisie, d.empreinte);
    afficher();
  } else if (act === "ed-supprimer") {
    remplacer(retirerComposition(progression(), d.empreinte));
    if (E.rangee === d.empreinte) E.rangee = null;
    dire("Composition retirée.");
  } else if (act === "ed-copier") copierCode();
  else if (act === "ed-coller")
    ouvrirCode(document.querySelector<HTMLTextAreaElement>("#code-partition-colle")?.value ?? "");
  else if (act === "ed-nouveau") {
    S.editeur = editeurSur(partitionNeuve());
    afficher();
  } else if (act === "ed-fermer") fermerEditeur();
});

// Les réglages de la partition et le genre de la section : listes et champs de l'éditeur
overlay.addEventListener("change", (e) => {
  const champ = (e.target as HTMLInputElement)?.dataset?.champ,
    valeur = (e.target as HTMLInputElement).value;
  if (!champ || !S.editeur || S.mode !== "editeur") return;
  if (champ === "genre") modifier(changerGenre(S.editeur.partition, S.editeur.section, valeur as ChoixDeGenre));
  else modifier(regler(S.editeur.partition, champ as Reglage, valeur));
});
