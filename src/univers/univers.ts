// Les univers ne touchent qu'à l'habillage : décor, sons, textes (ADR-0006)
import { S } from "../jeu/etat";

export interface Univers {
  label: string;
  unit: string;
  meter: string;
  /** Noms des trois couches que le combo ajoute (arpèges, chœurs, cordes) */
  layers: string[];
  /** Le lieu de chaque progression */
  places: Record<string, string>;
  solo: string;
  deadTag: string;
  deadTitle: string;
  rail: string;
  under: string;
}

// Deux univers : mêmes mécaniques, habillage différent (décor, sons, textes)
export const THEMES: Record<string, Univers> = {
  ville: {
    label: "La Ville Muette",
    unit: "Quartier",
    meter: "VOLUME DU QUARTIER",
    layers: ["Radios", "Fenêtres", "Toits"],
    places: {
      "I–V–vi–IV": "Le Centre-ville",
      "vi–IV–I–V": "Les Ruelles",
      "Royal Road": "Le Quartier néon",
      "Vamp dorien": "Le Marché de nuit",
      "Cadence andalouse": "Le Port",
      "Canon de Pachelbel": "La Cathédrale",
    },
    solo: "En ondes : la radio pirate est à toi",
    deadTag: "Coupure de courant",
    deadTitle: "Le quartier s'est éteint",
    rail: "#0e0b1f",
    under: "#0b0916",
  },
  boite: {
    label: "La Boîte à musique",
    unit: "Souvenir",
    meter: "RESSORT",
    layers: ["Engrenages", "Carillon", "Violon"],
    places: {
      "I–V–vi–IV": "Un anniversaire",
      "vi–IV–I–V": "Un départ",
      "Royal Road": "Une première danse",
      "Vamp dorien": "Un après-midi de pluie",
      "Cadence andalouse": "Une dispute",
      "Canon de Pachelbel": "Un mariage",
    },
    solo: "La figurine se souvient : joue ce que tu veux",
    deadTag: "Ressort détendu",
    deadTitle: "La boîte s'est arrêtée",
    rail: "#1a120b",
    under: "#120c08",
  },
};

export const TH = (): Univers => THEMES[S.theme];
export const placeName = () => TH().places[S.song.prog.name];
