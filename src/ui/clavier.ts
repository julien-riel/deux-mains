import { songNow } from "../audio/moteur";
import { presser, relacher } from "../jeu/actions";
import { finish, lancerJam, newRun, pause, quitterJam, resumeCP, unpause } from "../jeu/deroulement";
import { noter } from "../jeu/enregistrement";
import { S, airEnCours, enComposition, spb } from "../jeu/etat";
import { peutReecouter, quitterReecoute, reecouter } from "../jeu/reecoute";
import { appliquerCalibrage, fermerCalibrage, lancerCalibrage, taper } from "./calibrage";
import { choisirLieu, enchainer, fermerCarte, lieuNumero, ouvrirCarte } from "./carte";
import { aRemonter, overlay, show } from "./ecrans";
import { fermerEditeur, jouerBrouillon, ouvrirEditeur } from "./editeur";
import { fermerMenuEssais, menuEssais, ouvrirEssai, taperChiffre, validerChiffres } from "./essais";
import { collerCode, copierCode, ouvrirSauvegarde } from "./progression";
import { basculerBoss, nouvelleChanson, quitterEssai } from "./reglages";
import { lancerRemontage, passerLeRemontage, taperRemontage } from "./remontage";
import { airNumero, editerAir, fermerRepertoire, jouerAir, ouvrirRepertoire } from "./repertoire";
import { ACTION_DE, CLAVIER, KEYLABEL, etiquettes } from "./touches";

overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "start" || act === "restart") newRun();
  else if (act === "listen") newRun(true);
  else if (act === "jam") lancerJam();
  else if (act === "quitter-jam") quitterJam();
  else if (act === "resume") resumeCP();
  else if (act === "continue") unpause();
  else if (act === "quitter-boucle") finish();
  else if (act === "reecouter") reecouter();
  else if (act === "quitter-reecoute") quitterReecoute();
  else if (act === "new") nouvelleChanson();
  else if (act === "essais") menuEssais();
  else if (act === "essai") ouvrirEssai(b.dataset.essai, true);
  else if (act === "titre") fermerMenuEssais();
  else if (act === "quitter-essai") quitterEssai();
  else if (act === "carte") ouvrirCarte();
  else if (act === "lieu") choisirLieu(b.dataset.lieu);
  else if (act === "suivant") enchainer();
  else if (act === "sauvegarde") ouvrirSauvegarde();
  else if (act === "copier") copierCode();
  else if (act === "coller") collerCode(document.querySelector<HTMLTextAreaElement>("#code-colle")?.value ?? "");
  else if (act === "boss") basculerBoss();
  else if (act === "editeur") ouvrirEditeur();
  else if (act === "repertoire") ouvrirRepertoire();
  else if (act === "fermer-repertoire") fermerRepertoire();
  else if (act === "air") jouerAir(b.dataset.air);
  else if (act === "editer-air") editerAir();
});

/* ---------- Entrées ---------- */
addEventListener("keydown", (e) => {
  const t = e.target as HTMLInputElement;
  if (t && ((t.tagName === "INPUT" && t.type !== "radio") || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
    return;
  const c = e.code;
  if (S.mode === "play") {
    if (c in KEYLABEL || c === "Space" || c === "Escape") e.preventDefault();
    if (e.repeat) return;
    // Échap quitte la jam (#24) ; dans une partie, il la met en pause
    if (c === "Escape") return S.jam ? quitterJam() : pause();
    // Pendant la réécoute (#23), la partie se rejoue toute seule : seule la pause répond
    if (S.relecture) return;
    if (c === "KeyA" && !S.jam) {
      S.auto = !S.auto;
      if (S.auto) S.autoUsed = true;
      noter(S.enregistrement, { temps: songNow() / spb(), geste: "auto", auto: S.auto });
      S.banner = {
        text: S.auto ? "Auto-play" : "À toi de jouer",
        sub: S.auto ? `${KEYLABEL.KeyA} pour reprendre la main` : "",
        at: performance.now(),
      };
      return;
    }
    if (ACTION_DE[c]) presser(ACTION_DE[c], songNow());
    return;
  }
  if (S.mode === "remontage") {
    // Le remontage (#27) : n'importe quelle touche d'une main fait le tour de cette main ; Échap le passe
    if (c in KEYLABEL || c === "Space" || c === "Escape") e.preventDefault();
    if (e.repeat) return;
    if (c === "Escape") passerLeRemontage();
    else if (ACTION_DE[c]) taperRemontage(ACTION_DE[c]);
    return;
  }
  if (e.repeat) return;
  if (S.mode === "editeur") {
    // L'éditeur (#28) : sur un bouton de la grille, Espace et Entrée le touchent ; ailleurs, ils jouent le brouillon
    const surBouton = t?.tagName === "BUTTON";
    if (c === "Escape") {
      if (S.editeur.vue === "rangement") {
        S.editeur.vue = "grille";
        show("editeur");
      } else fermerEditeur();
    } else if (surBouton) return;
    else if (c === "KeyA") jouerBrouillon(true);
    else if (c === "Space" || c === "Enter") {
      e.preventDefault();
      jouerBrouillon(false);
    }
    return;
  }
  if (S.mode === "calib") {
    const fini = S.calib.resultat !== undefined;
    if (c === "Escape") fermerCalibrage();
    else if (!fini && (c === "Space" || ACTION_DE[c])) {
      e.preventDefault();
      taper();
    } else if (fini && c === "Enter") {
      e.preventDefault();
      if (S.calib.resultat === null) lancerCalibrage();
      else appliquerCalibrage();
    }
  } else if (S.mode === "essais") {
    // La liste des essais : le numéro tapé lance l'essai, en deux chiffres au-delà de neuf
    const n = /^(?:Digit|Numpad)(\d)$/.exec(c);
    if (n) taperChiffre(n[1]);
    else if ((c === "Enter" || c === "NumpadEnter") && validerChiffres()) e.preventDefault();
    else if (c === "Escape") fermerMenuEssais();
  } else if (S.mode === "carte") {
    // La carte (#25) : un chiffre prépare la chanson du lieu de ce numéro
    const n = /^Digit([1-9])$/.exec(c),
      lieu = n && lieuNumero(+n[1]);
    if (lieu) choisirLieu(lieu);
    else if (c === "KeyS") ouvrirSauvegarde();
    else if (c === "Escape") fermerCarte();
  } else if (S.mode === "sauvegarde") {
    if (c === "Escape") ouvrirCarte();
  } else if (S.mode === "repertoire") {
    // Le répertoire (ADR-0018) : un chiffre prépare l'air de ce numéro
    const n = /^(?:Digit|Numpad)([1-9])$/.exec(c),
      air = n && airNumero(+n[1]);
    if (air) jouerAir(air.id);
    else if (c === "Escape") fermerRepertoire();
  } else if (S.mode === "title") {
    // L'essai de la jam (#24) n'a qu'un départ : la jam
    const jam = !!S.essai?.essai.jam,
      // L'essai du remontage (#27) le propose d'abord, puis le laisse recommencer (R)
      remonter = aRemonter();
    if (c === "Space" || c === "Enter") {
      e.preventDefault();
      if (jam) lancerJam();
      else if (remonter) lancerRemontage(false);
      else newRun();
    } else if (c === "KeyJ") lancerJam();
    else if (c === "KeyA" && remonter) lancerRemontage(true);
    else if (c === "KeyA" && !jam) newRun(true);
    else if (c === "KeyR" && S.essai?.essai.remontage) lancerRemontage(false);
    else if (c === "KeyN") nouvelleChanson();
    else if (c === "KeyE") menuEssais();
    else if (c === "KeyC") ouvrirCarte();
    else if (c === "KeyB" && !S.essai) basculerBoss();
    else if (c === "KeyM") ouvrirRepertoire();
    // Un air du répertoire (ADR-0018) s'ouvre dans l'éditeur, et Échap revient au répertoire
    else if (c === "KeyP" && airEnCours()) editerAir();
    else if (c === "Escape" && airEnCours()) ouvrirRepertoire();
    // L'éditeur (#28) : hors essai, ou dans l'essai de l'éditeur ; une composition y revient aussi par Échap
    else if (c === "KeyP" && (!S.essai || S.essai.essai.partition)) ouvrirEditeur();
    else if (c === "Escape" && S.essai) quitterEssai();
    else if (c === "Escape" && enComposition()) ouvrirEditeur();
  } else if (S.mode === "pause" && S.jam) {
    if (c === "Space") {
      e.preventDefault();
      unpause();
    } else if (c === "Escape") quitterJam();
  } else if (S.mode === "pause") {
    if (c === "Escape" || c === "Space") {
      e.preventDefault();
      unpause();
    } else if (c === "Enter") {
      e.preventDefault();
      if (S.relecture) quitterReecoute();
      else newRun();
    } else if (c === "KeyB" && S.bouclePartie) finish();
  } else if (S.mode === "dead" || S.mode === "done") {
    if (c === "KeyR" && S.mode === "dead") resumeCP();
    else if (c === "KeyR" && peutReecouter()) reecouter();
    else if (c === "KeyA") newRun(true);
    else if (c === "Enter") {
      e.preventDefault();
      newRun();
    } else if (c === "KeyN") nouvelleChanson();
    else if (c === "KeyB" && S.mode === "done" && !S.essai && !enComposition()) basculerBoss();
    else if (c === "KeyE" && S.essai) menuEssais();
    // Un air joué (ADR-0018) revient au répertoire, une composition jouée (#28) à l'éditeur
    else if (c === "KeyM") ouvrirRepertoire();
    else if (c === "KeyP" && airEnCours()) editerAir();
    else if (c === "Escape" && airEnCours()) ouvrirRepertoire();
    else if (c === "KeyP" && enComposition()) ouvrirEditeur();
    else if (c === "Escape" && S.essai) quitterEssai();
    else if (c === "Escape" && enComposition()) ouvrirEditeur();
    else if (c === "KeyC") ouvrirCarte();
    else if (c === "ArrowRight" && S.mode === "done" && !S.essai && !enComposition()) enchainer();
  }
});
addEventListener("keyup", (e) => {
  const a = ACTION_DE[e.code];
  if (a) relacher(a, S.mode === "play" ? songNow() : 0);
});
addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

// Étiquettes selon la disposition réelle du clavier (AZERTY, etc.)
try {
  (navigator as Navigator & { keyboard: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard
    .getLayoutMap()
    .then((m) => {
      for (const c of Object.keys(CLAVIER)) {
        const v = m.get(c);
        // La barre d'espace n'a pas d'étiquette dans la disposition : on garde « Espace »
        if (v && v.trim()) CLAVIER[c] = v.toUpperCase();
      }
      etiquettes();
      document
        .querySelectorAll<HTMLElement>("kbd[data-code]")
        .forEach((el) => (el.textContent = CLAVIER[el.dataset.code]));
      if (S.mode === "title") show("title");
    })
    .catch(() => {});
} catch {
  /* API absente : on garde les étiquettes QWERTY */
}
