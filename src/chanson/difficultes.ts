// Les quatre difficultés : fenêtres de jugement, dégâts, motifs de basse et réglages de la mélodie

// Basse : une chaîne de 8 croches par mesure (12 triolets en polyrythmie, voir plus bas). S = glisser,
// W = sauter, T = tunnel (tenu sur les « - »), D = double saut (#7), une croche après un W : il finit une phrase de quatre mesures. M et B = pente montante
// et descendante (#12), tenues sur les « - » : elles finissent une phrase de deux mesures et amènent la
// note de la mesure suivante, en Normal et en Difficile. La mélodie évite les notes des deux premiers motifs
// seulement : le double saut ne change pas la main droite. Le générateur remplace la première note de chaque
// refrain par une plaque à écraser (#8).
// Mélodie : surLesTemps garde la main droite sur les temps, même au refrain (Débutant). trilleP : la chance
// qu'une note longue devienne une trille (#15), en Normal et en Difficile. serpentP : la chance qu'une suite de
// notes régulières qui montent ou descendent couloir par couloir devienne un serpent (#16), espacées d'un des
// serpentPas (en croches) : une croche ou un temps en Difficile, un temps seulement en Normal. petitesP : la chance
// que la croche faible libre juste avant une note sur le temps reçoive une petite note (#14, ADR-0010), en Normal
// et en Difficile (voir `semerPetitesNotes` dans le générateur).
// escalierP : la chance qu'une mesure de couplet ou de refrain finisse en escalier de walking bass (#13, ADR-0010),
// en Difficile seulement, quand la gamme le permet (voir `escalier` dans le générateur).
// Chanteur (#18) : l'avant-dernière phrase de chaque couplet devient un chanteur, qui chante quatre notes sur une
// mesure, puis sa réponse, que le joueur répète de mémoire sur la mesure suivante. `couloirs` : les degrés
// chantés, tous présents dans la phrase ; `rythmes` : la place des quatre notes dans la mesure, en croches
// (x une note). Pas de chanteur en Débutant.
// relaisP : la chance qu'une phrase du couplet (la deuxième) et une du refrain (la troisième) deviennent une phrase
// en relais entre les deux mains (#20), en Normal et en Difficile (voir `phraseEnRelais` dans le générateur).
// Polyrythmie (#19, ADR-0013) : en Difficile seulement, une section en 3 contre 2 peut venir entre le dernier
// refrain et l'outro, avec la chance `p`. Sa basse s'écrit en 12 signes par mesure (`bass.polyrythmie`) : la
// longueur d'un motif donne sa division, 8 signes pour des croches, 12 pour des triolets (trois notes par temps).
// Sa mélodie reste en croches : `melodie` donne, mesure par mesure, la place de ses notes (x une note, 8 croches),
// deux croches sur chaque temps où la basse joue trois triolets, pour entendre le 3 contre 2.
export interface ReglagesPolyrythmie {
  p: number;
  melodie: string[];
}
// Boss de fin (#26) : un niveau à part (voir `buildBoss`), dont le boss joue des phrases d'une mesure que le joueur
// rejoue en canon, une mesure plus tard. `couloirs` : les degrés joués ; `basse` : les motifs de basse du niveau, en
// boucle ; `phases` : les rythmes des phrases de chaque phase (x une note), de plus en plus serrés. Sur la mesure de
// la réponse, la phrase évite les notes de basse comme la mélodie (`avoid` : toutes, toutes sauf le premier temps,
// aucune), et garde au moins deux notes.
export interface ReglagesChanteur {
  couloirs: number[];
  rythmes: string[];
}
export interface ReglagesBoss {
  couloirs: number[];
  basse: string[];
  phases: string[][];
}
export const DIFFS = {
  debutant: {
    label: "Débutant",
    win: [0.09, 0.19],
    dmgL: 10,
    dmgR: 4,
    chanteur: null as ReglagesChanteur | null,
    escalierP: 0,
    relaisP: 0,
    polyrythmie: null as ReglagesPolyrythmie | null,
    boss: {
      couloirs: [0, 1, 2],
      basse: ["S.......", "........"],
      phases: [["..x...x.", "....x.x."], ["..x.x.x.", "x.x.x..."], ["x.x.x.x."]],
    },
    bass: {
      couplet: ["S.......", "W......."],
      refrain: ["S.......", "W......."],
      pont: ["S......."],
      outro: ["S.......", "........"],
    },
    mel: {
      even: 0.5,
      odd: 0,
      surLesTemps: true,
      gap: 2,
      avoid: "all",
      holdP: 0,
      trilleP: 0,
      serpentP: 0,
      serpentPas: [],
      petitesP: 0,
      max: 5,
      dyadP: 0,
      dyadStrong: true,
      cross: [],
      crossP: 0,
      triad: false,
    },
  },
  facile: {
    label: "Facile",
    win: [0.075, 0.16],
    dmgL: 14,
    dmgR: 6,
    chanteur: { couloirs: [0, 2], rythmes: ["x.x.x.x."] },
    escalierP: 0,
    relaisP: 0,
    polyrythmie: null as ReglagesPolyrythmie | null,
    boss: {
      couloirs: [0, 1, 2],
      basse: ["S.......", "W......."],
      phases: [["..x...x.", "....x.x."], ["..x.x.x."], ["..x.xxx.", "..xxx.x."]],
    },
    bass: {
      couplet: ["S.......", "W......."],
      refrain: ["S...W..."],
      pont: ["T------."],
      outro: ["S.......", "........"],
    },
    mel: {
      even: 0.5,
      odd: 0,
      gap: 2,
      avoid: "all",
      holdP: 0,
      trilleP: 0,
      serpentP: 0,
      serpentPas: [],
      petitesP: 0,
      max: 6,
      dyadP: 0.12,
      dyadStrong: true,
      cross: [0],
      crossP: 0.7,
      triad: false,
    },
  },
  normal: {
    label: "Normal",
    win: [0.055, 0.125],
    dmgL: 18,
    dmgR: 8,
    chanteur: { couloirs: [0, 1, 2], rythmes: ["x.x.x.x.", "x.x.xx..", "xx..x.x."] },
    escalierP: 0,
    relaisP: 0.6,
    polyrythmie: null as ReglagesPolyrythmie | null,
    boss: {
      couloirs: [0, 1, 2, 3],
      basse: ["S...W...", "S......."],
      phases: [
        ["x.x.x.x.", "x...x.x."],
        ["x.x.xx..", "xx..x.x.", "x.xx..x."],
        ["x.xx.xx.", "xx.x.xx.", "x.xxx.xx"],
      ],
    },
    bass: {
      couplet: ["S...W...", "S...M--.", "S...W...", "T--.WD.."],
      refrain: ["S.W.S.W.", "S.W.B--.", "S.W.S.W.", "S.WD..W."],
      pont: ["T------."],
      outro: ["S.......", "........"],
    },
    mel: {
      even: 0.5,
      odd: 0.14,
      gap: 1,
      avoid: "mostly",
      holdP: 0.12,
      trilleP: 0.5,
      serpentP: 0.6,
      serpentPas: [1, 2],
      petitesP: 0.9,
      max: 9,
      dyadP: 0.16,
      dyadStrong: false,
      cross: [0, 8],
      crossP: 0.5,
      triad: false,
    },
  },
  difficile: {
    label: "Difficile",
    win: [0.045, 0.105],
    dmgL: 20,
    dmgR: 9,
    chanteur: { couloirs: [0, 1, 2, 3], rythmes: ["x.x.x.x.", "x.xx..x.", "xx.x..x.", "x..x.xx."] },
    escalierP: 0.6,
    relaisP: 0.75,
    polyrythmie: { p: 0.6, melodie: ["xx..xx..", "xx..xx..", "xx..xx..", "xxxxxx.."] } as ReglagesPolyrythmie | null,
    boss: {
      couloirs: [0, 1, 2, 3],
      basse: ["S..W..S.", "S.W....."],
      phases: [
        ["x.x.xx..", "xx..x.x."],
        ["x.xx.xx.", "xx.x..xx"],
        ["xxx.x.xx", "x.xxxx.x", "xx.xx.xx"],
      ],
    },
    bass: {
      couplet: ["S..W..S.", "T--.M--.", "S..WD.S.", "S..WB--."],
      refrain: ["S.WSS.W.", "S.WSM--.", "S.WSS.W.", "S.WD.WS."],
      pont: ["T---S.W."],
      // En triolets : trois notes sur les temps 1 et 3, une seule sur les temps 2 et 4, puis trois temps de suite
      polyrythmie: ["SWSS..SWSS..", "SWWS..SWWS..", "SWSS..SWSS..", "SWSSWSSWS..."],
      outro: ["S.......", "........"],
    },
    mel: {
      even: 0.58,
      odd: 0.3,
      gap: 1,
      avoid: "none",
      holdP: 0.15,
      trilleP: 0.7,
      serpentP: 0.7,
      serpentPas: [1, 2],
      petitesP: 0.7,
      max: 11,
      dyadP: 0.22,
      dyadStrong: false,
      cross: [0, 8],
      crossP: 0.5,
      triad: true,
    },
  },
};
