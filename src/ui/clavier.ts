import { songNow } from "../audio/moteur";
import { presser, relacher } from "../jeu/actions";
import { finish, lancerJam, newRun, pause, quitterJam, resumeCP, unpause } from "../jeu/deroulement";
import { noter } from "../jeu/enregistrement";
import { S, spb } from "../jeu/etat";
import { peutReecouter, quitterReecoute, reecouter } from "../jeu/reecoute";
import { appliquerCalibrage, fermerCalibrage, lancerCalibrage, taper } from "./calibrage";
import { choisirLieu, enchainer, fermerCarte, lieuNumero, ouvrirCarte } from "./carte";
import { overlay, show } from "./ecrans";
import { essaiNumero, fermerMenuEssais, menuEssais, ouvrirEssai } from "./essais";
import { collerCode, copierCode, ouvrirSauvegarde } from "./progression";
import { nouvelleChanson, quitterEssai } from "./reglages";
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
  if (e.repeat) return;
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
    // La liste des essais : un chiffre lance l'essai de ce numéro
    const n = /^Digit([1-9])$/.exec(c),
      id = n && essaiNumero(+n[1]);
    if (id) ouvrirEssai(id, true);
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
  } else if (S.mode === "title") {
    // L'essai de la jam (#24) n'a qu'un départ : la jam
    const jam = !!S.essai?.essai.jam;
    if (c === "Space" || c === "Enter") {
      e.preventDefault();
      if (jam) lancerJam();
      else newRun();
    } else if (c === "KeyJ") lancerJam();
    else if (c === "KeyA" && !jam) newRun(true);
    else if (c === "KeyN") nouvelleChanson();
    else if (c === "KeyE") menuEssais();
    else if (c === "KeyC") ouvrirCarte();
    else if (c === "Escape" && S.essai) quitterEssai();
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
    else if (c === "KeyE" && S.essai) menuEssais();
    else if (c === "Escape" && S.essai) quitterEssai();
    else if (c === "KeyC") ouvrirCarte();
    else if (c === "ArrowRight" && S.mode === "done" && !S.essai) enchainer();
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
