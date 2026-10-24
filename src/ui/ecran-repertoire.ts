// L'écran du répertoire (ADR-0018) : les chansons connues du domaine public, leur origine, le lieu où elles se jouent
// et leur record dans la difficulté du joueur. La Ville l'habille en disques de la radio pirate, la Boîte en airs.
import { DIFFS } from "../chanson/difficultes";
import { empreinteDe } from "../chanson/partition";
import { REPERTOIRE, partitionDe, type Air } from "../chanson/repertoire";
import { S, progression } from "../jeu/etat";
import { echapper } from "../outils";
import { clePartition } from "../sauvegarde/format";
import { TH } from "../univers/univers";

/** La difficulté du joueur : celle qu'il retrouvera en quittant une composition ou un air */
export const diffDuRepertoire = () => S.avantComposition?.diff ?? S.diff;

/** Le meilleur score d'un air dans cette difficulté, rangé sous l'empreinte de sa partition, ou undefined */
export const recordDe = (air: Air, diff: string) =>
  progression().chansons[clePartition(empreinteDe(partitionDe(air, diff)))]?.meilleur;

export const boutonRepertoire = (texte = TH().repertoire.nom) =>
  `<button type="button" data-act="repertoire">${texte} <kbd>M</kbd></button>`;

/** La liste des airs : un chiffre lance celui de ce numéro */
export function ecranRepertoire() {
  const R = TH().repertoire,
    diff = diffDuRepertoire();
  const airs = REPERTOIRE.map((air, i) => {
    const p = air.partition,
      record = recordDe(air, diff);
    return `<button type="button" data-act="air" data-air="${air.id}"><kbd>${i + 1}</kbd><span><b>${echapper(p.titre)}</b><small>${air.origine} · ${TH().places[p.prog]} · ${p.bpm} BPM${
      record !== undefined ? ` · record ${record.toLocaleString("fr-CA")}` : ""
    }</small></span></button>`;
  }).join("");
  return `<p class="eyebrow">${TH().label} · ${R.nom} · ${DIFFS[diff].label}</p>
      <h2>${R.titre}</h2>
      <p class="meta">${R.aide}</p>
      <div class="essais repertoire">${airs}</div>
      <div class="actions"><button type="button" data-act="fermer-repertoire">Retour <kbd>Échap</kbd></button></div>`;
}
