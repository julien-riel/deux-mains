// Clavier MIDI (#10, ADR-0011) : l'accès Web MIDI, la traduction des messages en actions (la table pure est dans
// src/jeu/midi.ts), l'indicateur des réglages et le point de séparation.
//
// Chrome demande la permission avant d'ouvrir le MIDI : on ne la demande pas au chargement. Si elle est déjà
// accordée, le jeu se branche tout seul ; sinon, le bouton « Activer » la demande. Sans Web MIDI, ou si l'accès
// est refusé (la page d'artefact claude.ai bloque les périphériques), le jeu l'indique et continue sans erreur.
import { heureDe, retardDe, songNow } from "../audio/moteur";
import { presser, relacher } from "../jeu/actions";
import { S, type Action } from "../jeu/etat";
import { SEPARATION, SEPARATIONS, actionDeNote, lireMessage, nomDeNote } from "../jeu/midi";
import { taper } from "./calibrage";
import { overlay, show } from "./ecrans";
import { taperRemontage } from "./remontage";
import { MIDI, etatMidiLong, etiquettes, type EtatMidi } from "./touches";

/* ---------- Ce que le jeu utilise de Web MIDI ---------- */
// Une abstraction minimale de navigator.requestMIDIAccess, que le faux navigateur des tests imite
interface MessageMidi {
  data: ArrayLike<number>;
  timeStamp: number;
}
interface EntreeMidi {
  name?: string | null;
  state?: string;
  onmidimessage: ((e: MessageMidi) => void) | null;
}
interface AccesMidi {
  inputs: { forEach(fn: (entree: EntreeMidi) => void): void };
  onstatechange: (() => void) | null;
}
type DemandeMidi = (options?: { sysex?: boolean }) => Promise<AccesMidi>;
interface NavigateurMidi {
  requestMIDIAccess?: DemandeMidi;
  permissions?: { query(p: { name: string }): Promise<{ state: string }> };
}
const nav = () => navigator as unknown as NavigateurMidi;

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

/* ---------- État de l'accès ---------- */
function changerEtat(etat: EtatMidi) {
  MIDI.etat = etat;
  $("#midi-etat").textContent = etatMidiLong();
  $<HTMLButtonElement>("#midi-activer").hidden = etat !== "inactif" && etat !== "refuse";
  etiquettes();
  if ((S.mode === "title" || S.mode === "essais") && S.song) show(S.mode);
}

/** Demande l'accès au MIDI (après un geste du joueur : Chrome affiche une demande de permission) */
export function activerMidi() {
  const demande = nav().requestMIDIAccess;
  if (!demande) return changerEtat("absent");
  if (MIDI.etat === "attente" || MIDI.etat === "aucun" || MIDI.etat === "connecte") return;
  changerEtat("attente");
  try {
    demande.call(navigator, { sysex: false }).then(brancher, () => changerEtat("refuse"));
  } catch {
    changerEtat("refuse");
  }
}

// Branche chaque clavier, et suit ceux qu'on branche ou débranche pendant la partie
function brancher(acces: AccesMidi) {
  const lister = () => {
    const noms: string[] = [];
    acces.inputs.forEach((entree) => {
      if (entree.state === "disconnected") return;
      entree.onmidimessage = recevoir;
      noms.push(entree.name || "Clavier MIDI");
    });
    // Un clavier débranché ne relâchera plus ses touches : on les relâche pour lui
    if (noms.length < MIDI.entrees.length) toutRelacher();
    MIDI.entrees = noms;
    changerEtat(noms.length ? "connecte" : "aucun");
  };
  acces.onstatechange = lister;
  lister();
}

/* ---------- Des messages aux actions ---------- */
// L'action pressée par chaque note tenue : le relâchement lui revient, même si la séparation a changé entre-temps
const tenues = new Map<number, Action>();

function recevoir(e: MessageMidi) {
  const m = lireMessage(e.data);
  if (!m) return;
  if (m.enfoncee) {
    // Pendant le calibrage, n'importe quelle touche compte comme un coup : la latence du MIDI est mesurée aussi
    if (S.mode === "calib") return taper(retardDe(e.timeStamp));
    const a = actionDeNote(m.note, MIDI.separation);
    // Pendant le remontage (#27), une touche de la table fait le tour de sa main
    if (S.mode === "remontage") {
      if (a) taperRemontage(a, retardDe(e.timeStamp));
      return;
    }
    // Une action déjà tenue par une autre commande (clavier, autre touche) : seule celle-ci la relâchera
    if (!a || S.keys[a]) return;
    presser(a, heureDe(e.timeStamp));
    if (S.keys[a]) tenues.set(m.note, a);
  } else {
    const a = tenues.get(m.note);
    if (!a) return;
    tenues.delete(m.note);
    relacher(a, S.mode === "play" ? heureDe(e.timeStamp) : 0);
  }
}
function toutRelacher() {
  for (const a of tenues.values()) relacher(a, S.mode === "play" ? songNow() : 0);
  tenues.clear();
}

/* ---------- Réglages : activation et point de séparation ---------- */
export function setSeparation(note: number) {
  MIDI.separation = SEPARATIONS.includes(note) ? note : SEPARATION;
  $<HTMLSelectElement>("#separation").value = String(MIDI.separation);
  try {
    localStorage.setItem("deux-mains-separation", String(MIDI.separation));
  } catch {
    /* stockage indisponible */
  }
  etiquettes();
  if (S.mode === "title" && S.song) show("title");
}

$<HTMLSelectElement>("#separation").innerHTML = SEPARATIONS.map(
  (n) => `<option value="${n}">${nomDeNote(n)}${n === SEPARATION ? " (Do central)" : ""}</option>`,
).join("");
$("#separation").addEventListener("change", (e) => {
  const sel = e.target as HTMLSelectElement;
  setSeparation(+sel.value);
  sel.blur();
});
$("#midi-activer").addEventListener("click", activerMidi);
overlay.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
  if (b && b.dataset.act === "midi") activerMidi();
});

/** Au démarrage : le point de séparation retenu, et l'accès au MIDI s'il a déjà été accordé */
export function demarrerMidi() {
  let gardee = SEPARATION;
  try {
    gardee = Number(localStorage.getItem("deux-mains-separation")) || SEPARATION;
  } catch {
    /* stockage indisponible */
  }
  setSeparation(gardee);
  const { requestMIDIAccess, permissions } = nav();
  if (!requestMIDIAccess) return changerEtat("absent");
  changerEtat("inactif");
  try {
    permissions
      ?.query({ name: "midi" })
      .then((p) => {
        if (p.state === "granted") activerMidi();
        else if (p.state === "denied") changerEtat("refuse");
      })
      .catch(() => {});
  } catch {
    /* permission « midi » inconnue de ce navigateur : le bouton reste */
  }
}
