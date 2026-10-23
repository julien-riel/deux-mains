// Mode essai : la liste des essais, l'ouverture d'un essai, et l'accès direct par l'adresse (?essai=<id> ou #essai=<id>)
import { ESSAIS, essaiDemande, essaiTape, trouverEssai } from "../essais/registre";
import { lancerJam, newRun } from "../jeu/deroulement";
import { S } from "../jeu/etat";
import { show } from "./ecrans";
import { ouvrirEditeur } from "./editeur";
import { chargerEssai } from "./reglages";
import { lancerRemontage } from "./remontage";

/** Ouvre un essai sur son écran de départ, ou le lance tout de suite (`demarrer`, après un geste du joueur) */
export function ouvrirEssai(id: string, demarrer = false) {
  const e = trouverEssai(id);
  if (!e) return false;
  chargerEssai(e);
  // L'essai de l'éditeur (#28) l'ouvre sur sa partition d'exemple, depuis le menu comme par l'adresse
  if (e.partition) ouvrirEditeur(e.partition());
  // L'essai du remontage (#27) commence par le remontage, joué par le joueur
  else if (demarrer && e.remontage) lancerRemontage(false);
  else if (demarrer) (e.jam ? lancerJam : newRun)();
  return true;
}
// Le numéro tapé dans la liste, qui attend peut-être un deuxième chiffre
const DELAI_CHIFFRE = 800;
let saisie = "",
  minuterie: ReturnType<typeof setTimeout> | undefined;
function oublierSaisie() {
  clearTimeout(minuterie);
  saisie = "";
}
/** Ouvre l'essai du numéro qui attend un deuxième chiffre (Entrée, ou la fin du délai) */
export function validerChiffres() {
  const id = saisie && ESSAIS[+saisie - 1]?.id;
  oublierSaisie();
  if (id && S.mode === "essais") ouvrirEssai(id, true);
  return !!id;
}
/** Un chiffre tapé dans la liste : « 3 » ouvre le 3e essai, « 1 » attend un instant un « 2 » pour ouvrir le 12e */
export function taperChiffre(chiffre: string) {
  clearTimeout(minuterie);
  let r = essaiTape(saisie + chiffre);
  // Un chiffre qui ne prolonge aucun numéro recommence la saisie
  if (!r.id && !r.attente) r = essaiTape(chiffre);
  saisie = r.attente;
  if (r.id) ouvrirEssai(r.id, true);
  else if (saisie) minuterie = setTimeout(validerChiffres, DELAI_CHIFFRE);
}

export function menuEssais() {
  oublierSaisie();
  S.mode = "essais";
  show("essais");
}
/** Revient de la liste des essais à l'écran de départ : celui de l'essai ouvert, ou de la chanson */
export function fermerMenuEssais() {
  oublierSaisie();
  S.mode = "title";
  show("title");
}

// Sans geste du joueur, le navigateur n'autorise pas le son : l'adresse ouvre l'écran de départ de l'essai.
// Une ancre changée pendant la partie attend la fin de celle-ci.
function suivreAdresse() {
  const id = essaiDemande(location.search, location.hash);
  if (id && S.mode !== "play" && S.mode !== "dying") ouvrirEssai(id);
}
export function essaiDeLAdresse() {
  suivreAdresse();
  addEventListener("hashchange", suivreAdresse);
}
