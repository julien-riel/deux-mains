// Les quatre difficultés : fenêtres de jugement, dégâts, motifs de basse et réglages de la mélodie

// Basse : une chaîne de 8 croches par mesure. S = glisser, W = sauter, T = tunnel (tenu sur les « - »),
// D = double saut (#7), une croche après un W : il finit une phrase de quatre mesures. M et B = pente montante
// et descendante (#12), tenues sur les « - » : elles finissent une phrase de deux mesures et amènent la
// note de la mesure suivante, en Normal et en Difficile. La mélodie évite les notes des deux premiers motifs
// seulement : le double saut ne change pas la main droite. Le générateur remplace la première note de chaque
// refrain par une plaque à écraser (#8).
// Mélodie : surLesTemps garde la main droite sur les temps, même au refrain (Débutant). trilleP : la chance
// qu'une note longue devienne une trille (#15), en Normal et en Difficile. serpentP : la chance qu'une suite de
// notes régulières qui montent ou descendent couloir par couloir devienne un serpent (#16), espacées d'un des
// serpentPas (en croches) : une croche ou un temps en Difficile, un temps seulement en Normal.
export const DIFFS = {
  debutant: {
    label: "Débutant",
    win: [0.09, 0.19],
    dmgL: 10,
    dmgR: 4,
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
    bass: {
      couplet: ["S..W..S.", "T--.M--.", "S..WD.S.", "S..WB--."],
      refrain: ["S.WSS.W.", "S.WSM--.", "S.WSS.W.", "S.WD.WS."],
      pont: ["T---S.W."],
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
      max: 11,
      dyadP: 0.22,
      dyadStrong: false,
      cross: [0, 8],
      crossP: 0.5,
      triad: true,
    },
  },
};
