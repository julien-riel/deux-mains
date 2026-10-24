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
  /**
   * L'ennemi de la mélodie de chaque lieu, par progression : son dessin (une clé des ennemis de l'univers, dans
   * `rendu/`), le timbre de ses notes (une clé de `TIMBRES`, dans `audio/instruments.ts`) et leurs noms
   */
  ennemis: Record<string, { dessin: string; timbre: string; nom: string; instrument: string }>;
  solo: string;
  /** Sous le nom de la section en 3 contre 2 (#19) : ce que joue chaque main */
  polyrythmie: string;
  /** Le boss de fin (#26) : son nom, ce que dit la bannière de chaque phase, à sa chute, et quand il s'enfuit */
  boss: { nom: string; phases: string[]; vaincu: string; fuite: string };
  /** Le nom du fantôme du meilleur passage (#32), devant l'écart de score sur la scène */
  fantome: string;
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
  /** L'éditeur de partitions (#28) : une seule mécanique, que chaque univers habille (ADR-0006, ADR-0016) */
  editeur: {
    /** Le nom du bouton */
    nom: string;
    titre: string;
    /** Une note posée sur la grille, au singulier et au pluriel */
    note: string;
    notes: string;
    /** Le titre d'une composition qui n'en a pas */
    sansTitre: string;
    /** Le nom des compositions rangées */
    rangees: string;
    aide: string;
  };
  /** Le répertoire des chansons connues (ADR-0018) : le nom du bouton, le titre de l'écran et ce qu'il dit */
  repertoire: {
    nom: string;
    titre: string;
    aide: string;
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
      "ii–V–I": "Le Club de jazz",
      Blues: "Le Métro",
      "Vamp lydien": "L'Observatoire",
    },
    ennemis: {
      "I–V–vi–IV": { dessin: "drone", timbre: "bell", nom: "Drone", instrument: "cloche" },
      "vi–IV–I–V": { dessin: "pigeon", timbre: "sifflet", nom: "Pigeon espion", instrument: "sifflet" },
      "Royal Road": { dessin: "meduse", timbre: "neon", nom: "Méduse néon", instrument: "synthé néon" },
      "Vamp dorien": { dessin: "lanterne", timbre: "steel", nom: "Lanterne espionne", instrument: "steel-drum" },
      "Cadence andalouse": { dessin: "mouette", timbre: "guitare", nom: "Mouette d'acier", instrument: "guitare" },
      "Canon de Pachelbel": { dessin: "gargouille", timbre: "orgue", nom: "Gargouille", instrument: "orgue" },
      "ii–V–I": { dessin: "trompette", timbre: "trompette", nom: "Sourdine", instrument: "trompette bouchée" },
      Blues: { dessin: "camera", timbre: "harmonica", nom: "Caméra", instrument: "harmonica" },
      "Vamp lydien": { dessin: "satellite", timbre: "theremine", nom: "Satellite espion", instrument: "thérémine" },
    },
    solo: "En ondes : la radio pirate est à toi",
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
    fantome: "FANTÔME",
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
    editeur: {
      nom: "Console",
      titre: "La console de la radio pirate",
      note: "touche allumée",
      notes: "touches allumées",
      sansTitre: "Émission sans titre",
      rangees: "Mes émissions",
      aide: "Allume une touche pour y mettre une note : en haut les quatre couloirs de la mélodie, en bas sauter et glisser. Les notes jouent les degrés de l'accord en cours.",
    },
    repertoire: {
      nom: "Disques",
      titre: "Les disques de la radio pirate",
      aide: "Des airs que toute la ville fredonnait avant le silence, réarrangés pour la radio pirate. Chacun passe dans un quartier, avec ses ennemis, mais ne le rallume pas.",
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
      "ii–V–I": "Un bal masqué",
      Blues: "Un train de nuit",
      "Vamp lydien": "Un rêve",
    },
    ennemis: {
      "I–V–vi–IV": { dessin: "papillon", timbre: "box", nom: "Papillon de nuit", instrument: "boîte à musique" },
      "vi–IV–I–V": { dessin: "hirondelle", timbre: "flute", nom: "Hirondelle de papier", instrument: "flûte à bec" },
      "Royal Road": { dessin: "libellule", timbre: "violon", nom: "Libellule de laiton", instrument: "violon" },
      "Vamp dorien": { dessin: "araignee", timbre: "kalimba", nom: "Araignée d'horlogerie", instrument: "kalimba" },
      "Cadence andalouse": { dessin: "guepe", timbre: "mandoline", nom: "Guêpe de cuivre", instrument: "mandoline" },
      "Canon de Pachelbel": { dessin: "colombe", timbre: "clavecin", nom: "Colombe fêlée", instrument: "clavecin" },
      "ii–V–I": { dessin: "masque", timbre: "piano", nom: "Masque de bal", instrument: "piano jouet" },
      Blues: {
        dessin: "chauvesouris",
        timbre: "barbarie",
        nom: "Chauve-souris de papier",
        instrument: "orgue de Barbarie",
      },
      "Vamp lydien": {
        dessin: "chouette",
        timbre: "verre",
        nom: "Chouette automate",
        instrument: "harmonica de verre",
      },
    },
    solo: "La figurine se souvient : joue ce que tu veux",
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
    fantome: "REFLET",
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
    editeur: {
      nom: "Cylindre",
      titre: "Le cylindre à perforer",
      note: "picot",
      notes: "picots",
      sansTitre: "Cylindre sans titre",
      rangees: "Mes cylindres",
      aide: "Plante un picot pour y mettre une note : en haut les quatre lames de la mélodie, en bas sauter et glisser. Les lames jouent les degrés de l'accord en cours.",
    },
    repertoire: {
      nom: "Airs",
      titre: "Les airs de la boîte",
      aide: "Des airs anciens que la boîte a toujours su jouer. Chacun se joue dans un souvenir, avec ses ennemis ; il ne compte pas pour l'album.",
    },
  },
};

export const TH = (): Univers => THEMES[S.theme];
/** Le lieu de la chanson, ou le boss dans un niveau de boss (#26) */
export const placeName = () => (S.song.boss ? TH().boss.nom : TH().places[S.song.prog.name]);
/** L'ennemi de la mélodie de la chanson : celui du lieu de sa progression, dans l'univers en cours */
export const ennemiDuLieu = () => {
  const e = TH().ennemis;
  return e[S.song?.prog.name] ?? Object.values(e)[0];
};
