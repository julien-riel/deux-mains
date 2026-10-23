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
  /** Sous le nom du pont en mains croisées (#21), quand la scène se retourne */
  croisee: string;
  /** Sous le nom de la section en 3 contre 2 (#19) : ce que joue chaque main */
  polyrythmie: string;
  /** Le boss de fin (#26) : son nom, ce que dit la bannière de chaque phase, à sa chute, et quand il s'enfuit */
  boss: { nom: string; phases: string[]; vaincu: string; fuite: string };
  deadTag: string;
  deadTitle: string;
  rail: string;
  under: string;
  /** La carte du monde (#25) : ses noms et ses états, dans les mots de l'univers */
  carte: {
    /** Le nom du bouton et de l'écran */
    nom: string;
    titre: string;
    aFaire: string;
    reussi: string;
    /** Le pluriel de `reussi`, pour le compte : « 3 sur 6 rallumés » */
    reussis: string;
    /** Ce que dit l'écran de fin quand la chanson vient de réussir son lieu */
    gagne: string;
    /** Ce que la progression change dans les niveaux */
    effet: string;
  };
  /** Le remontage entre deux lieux (#27, ADR-0015) : la même mécanique, dans les mots de l'univers */
  remontage: {
    /** Le titre sur la scène, et le bouton qui le lance dans son essai */
    titre: string;
    consigne: string;
    /** Ce que l'écran de départ du lieu annonce : « Ressort de départ : 95 » */
    depart: string;
    /** Le nom des tours : « 7 tours de clé sur 8 » */
    tours: string;
  };
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
    croisee: "La ville à l'envers : tes touches ne changent pas",
    polyrythmie: "Trois pas par temps, deux tirs : la grosse caisse garde le temps",
    boss: {
      nom: "Le Grand Drone",
      phases: [
        "Il joue une phrase : rejoue-la une mesure plus tard",
        "Il accélère : ses phrases se serrent",
        "Dernière phase : il s'emballe",
      ],
      vaincu: "Le drone s'écrase : finis le canon seul",
      fuite: "Le drone s'enfuit, encore debout",
    },
    deadTag: "Coupure de courant",
    deadTitle: "Le quartier s'est éteint",
    rail: "#0e0b1f",
    under: "#0b0916",
    carte: {
      nom: "Carte",
      titre: "La carte de la ville",
      aFaire: "Éteint",
      reussi: "Rallumé",
      reussis: "rallumés",
      gagne: "Le quartier se rallume : ses habitants resteront aux fenêtres.",
      effet: "Chaque quartier rallumé garde des fenêtres allumées au départ des niveaux suivants.",
    },
    remontage: {
      titre: "Relancer le groupe électrogène",
      consigne: "Tourne la manivelle en rythme : chaque tour réussi rallume une rangée de fenêtres.",
      depart: "Volume de départ",
      tours: "tours de manivelle",
    },
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
    croisee: "La boîte se renverse : tes touches ne changent pas",
    polyrythmie: "Le cylindre en trois, le carillon en deux : la grosse caisse garde le temps",
    boss: {
      nom: "La Mite reine",
      phases: [
        "Elle joue une phrase : rejoue-la une mesure plus tard",
        "Elle accélère : ses phrases se serrent",
        "Dernière phase : elle s'affole",
      ],
      vaincu: "La mite tombe : finis le canon seul",
      fuite: "La mite s'envole, encore debout",
    },
    deadTag: "Ressort détendu",
    deadTitle: "La boîte s'est arrêtée",
    rail: "#1a120b",
    under: "#120c08",
    carte: {
      nom: "Album",
      titre: "L'album des souvenirs",
      aFaire: "À retrouver",
      reussi: "Retrouvé",
      reussis: "retrouvés",
      gagne: "Le souvenir revient : son illustration rejoint l'album.",
      effet: "Chaque souvenir retrouvé révèle son illustration, et sa photographie reste accrochée au mur du grenier.",
    },
    remontage: {
      titre: "Remonter la clé",
      consigne: "Accompagne chaque tour de la clé : le ressort se tend.",
      depart: "Ressort de départ",
      tours: "tours de clé",
    },
  },
};

export const TH = (): Univers => THEMES[S.theme];
/** Le lieu de la chanson, ou le boss dans un niveau de boss (#26) */
export const placeName = () => (S.song.boss ? TH().boss.nom : TH().places[S.song.prog.name]);
