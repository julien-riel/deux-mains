// Faux navigateur pour faire tourner le jeu complet dans Node.
//
// Avant d'importer src/main.ts, on remplace les globales du navigateur par des imitations qui fournissent
// juste ce que le jeu utilise : document, canvas 2D, Web Audio, minuteries, clavier, toucher et localStorage.
// Une seule horloge simulée fait avancer à la fois AudioContext.currentTime, performance.now(),
// setInterval (le séquenceur) et requestAnimationFrame (la boucle d'images).
//
// Chaque Navigateur repart de modules neufs (vi.resetModules), donc d'une partie neuve.

import { vi } from "vitest";
import type { Etat } from "../../src/jeu/etat";

export type Difficulte = "debutant" | "facile" | "normal" | "difficile";
export type Univers = "ville" | "boite";

export interface InterfaceJeu {
  state: Etat;
  load(seed: number, diff: Difficulte): void;
  setTheme(v: Univers): void;
  setPractice(v: "both" | "L" | "R"): void;
  setVitesse(v: number): void;
  setCommandes(v: "auto" | "clavier" | "tactile"): void;
  setFormes(oui: boolean): void;
  /** Le temps de la chanson, en secondes */
  songNow(): number;
}

export interface Options {
  /** Un écran tactile sans survol, comme un téléphone */
  tactile?: boolean;
  /** Ce que le navigateur a gardé d'une visite précédente */
  stockage?: Record<string, string>;
}

type Ecouteur = (e: Record<string, unknown>) => void;

/* ---------- Horloge ---------- */
class Horloge {
  secondes = 0;
  audio = 0;
  audioActif = true;
}

/* ---------- Web Audio ---------- */
function parametre(value = 0) {
  const p = {
    value,
    setValueAtTime: (v: number) => {
      p.value = v;
      return p;
    },
    linearRampToValueAtTime: () => p,
    exponentialRampToValueAtTime: () => p,
    setTargetAtTime: () => p,
    cancelScheduledValues: () => p,
  };
  return p;
}

function noeud() {
  return {
    gain: parametre(1),
    frequency: parametre(),
    detune: parametre(),
    Q: parametre(),
    delayTime: parametre(),
    threshold: parametre(),
    knee: parametre(),
    ratio: parametre(),
    attack: parametre(),
    release: parametre(),
    type: "",
    buffer: null,
    onended: null,
    connect: <T>(cible: T) => cible,
    disconnect: () => {},
    start: () => {},
    stop: () => {},
  };
}

function fauxAudioContext(horloge: Horloge) {
  return class {
    // Fréquence basse : la réverbération et le bruit sont des tampons calculés au démarrage
    sampleRate = 8000;
    outputLatency = 0;
    baseLatency = 0;
    destination = noeud();
    get state() {
      return horloge.audioActif ? "running" : "suspended";
    }
    get currentTime() {
      return horloge.audio;
    }
    resume() {
      horloge.audioActif = true;
      return Promise.resolve();
    }
    suspend() {
      horloge.audioActif = false;
      return Promise.resolve();
    }
    createBuffer(canaux: number, longueur: number) {
      const donnees = Array.from({ length: canaux }, () => new Float32Array(longueur));
      return { getChannelData: (i: number) => donnees[i] };
    }
    createGain = noeud;
    createOscillator = noeud;
    createBiquadFilter = noeud;
    createConvolver = noeud;
    createDelay = noeud;
    createDynamicsCompressor = noeud;
    createBufferSource = noeud;
  };
}

/* ---------- Canvas et page ---------- */
// Toutes les méthodes de dessin sont acceptées et ne font rien
function contexte2d() {
  const degrade = { addColorStop: () => {} };
  const cible: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => degrade,
    createRadialGradient: () => degrade,
  };
  return new Proxy(cible, { get: (t, p) => (p in t ? t[p] : () => undefined) });
}

// La scène fait 1200 × 620 pixels, en haut à gauche de la page
const RECTANGLE = { left: 0, top: 0, width: 1200, height: 620 };

function element(extra: Record<string, unknown> = {}) {
  const ecouteurs = new Map<string, Ecouteur[]>();
  return {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    addEventListener: (type: string, fn: Ecouteur) => void ecouteurs.set(type, [...(ecouteurs.get(type) ?? []), fn]),
    emettre: (type: string, e: Record<string, unknown>) => (ecouteurs.get(type) ?? []).forEach((fn) => fn(e)),
    blur: () => {},
    ...extra,
  };
}

// Une requête média dont on peut changer la réponse, comme quand on tourne le téléphone
function requeteMedia(matches: boolean) {
  const ecouteurs: Ecouteur[] = [];
  return {
    matches,
    addEventListener: (_type: string, fn: Ecouteur) => ecouteurs.push(fn),
    changer(v: boolean) {
      this.matches = v;
      ecouteurs.forEach((fn) => fn({ matches: v }));
    },
  };
}

/* ---------- Navigateur ---------- */
export class Navigateur {
  readonly horloge = new Horloge();
  readonly overlay = element();
  readonly scene = element({ getBoundingClientRect: () => RECTANGLE });
  readonly bouton = element({ closest: (s: string) => (s === "button" ? {} : null) });
  readonly boutonPause = element();
  readonly document = element({ hidden: false });
  readonly classes = new Set<string>();
  jeu: InterfaceJeu;
  /** Le localStorage du navigateur */
  readonly stockage = new Map<string, string>();
  private elements: Record<string, ReturnType<typeof element>> = {};
  private medias = new Map<string, ReturnType<typeof requeteMedia>>();
  private ecouteurs = new Map<string, Ecouteur[]>();
  private images: ((t: number) => void)[] = [];
  private minuteries = new Map<number, { fn: () => void; ms: number; prochaine: number }>();
  private prochainId = 1;

  /** Installe le faux navigateur, puis charge le jeu comme le ferait la page. */
  static async ouvrir(options: Options = {}) {
    const nav = new Navigateur();
    for (const [k, v] of Object.entries(options.stockage ?? {})) nav.stockage.set(k, v);
    nav.installer();
    nav.media("(hover: none) and (pointer: coarse)").matches = !!options.tactile;
    vi.resetModules();
    await import("../../src/main");
    const { S } = await import("../../src/jeu/etat");
    const reglages = await import("../../src/ui/reglages");
    const { songNow } = await import("../../src/audio/moteur");
    nav.jeu = {
      state: S,
      load: reglages.load,
      setTheme: reglages.setTheme,
      setPractice: reglages.setPractice,
      setVitesse: reglages.setVitesse,
      setCommandes: reglages.setCommandes,
      setFormes: reglages.setFormes,
      songNow,
    };
    return nav;
  }

  /** Remet les vraies globales de Node. */
  fermer() {
    vi.unstubAllGlobals();
  }

  private installer() {
    const ms = () => this.horloge.secondes * 1000;
    const elements = (this.elements = {
      "#game": element({
        width: 1200,
        height: 620,
        getContext: () => contexte2d(),
        getBoundingClientRect: () => RECTANGLE,
      }),
      "#overlay": this.overlay,
      ".stage": this.scene,
      "#pause": this.boutonPause,
      "#seed": element(),
      "#songline": element(),
      "#new": element(),
    });
    const parId = new Map<string, ReturnType<typeof element>>();
    const stockage = this.stockage;

    const page = this.document;
    const fenetre: Record<string, unknown> = {
      document: {
        documentElement: {
          classList: {
            add: (c: string) => this.classes.add(c),
            remove: (c: string) => this.classes.delete(c),
            toggle: (c: string, oui: boolean) => (oui ? this.classes.add(c) : this.classes.delete(c)),
          },
        },
        activeElement: null,
        get hidden() {
          return page.hidden;
        },
        // Le même élément à chaque recherche, pour garder ses écouteurs
        querySelector: (s: string) => (elements[s] ??= element()),
        querySelectorAll: () => [],
        getElementById: (id: string) => parId.get(id) ?? parId.set(id, element()).get(id),
        addEventListener: page.addEventListener,
      },
      navigator: {},
      performance: { now: ms },
      localStorage: {
        getItem: (k: string) => stockage.get(k) ?? null,
        setItem: (k: string, v: string) => void stockage.set(k, String(v)),
      },
      matchMedia: (requete: string) => this.media(requete),
      getComputedStyle: () => ({ getPropertyValue: () => "#808080" }),
      ResizeObserver: class {
        observe() {}
      },
      AudioContext: fauxAudioContext(this.horloge),
      requestAnimationFrame: (fn: (t: number) => void) => this.images.push(fn),
      setInterval: (fn: () => void, delai: number) => {
        const id = this.prochainId++;
        this.minuteries.set(id, { fn, ms: delai, prochaine: ms() + delai });
        return id;
      },
      clearInterval: (id: number) => this.minuteries.delete(id),
      addEventListener: (type: string, fn: Ecouteur) => {
        this.ecouteurs.set(type, [...(this.ecouteurs.get(type) ?? []), fn]);
      },
    };
    fenetre.window = fenetre;
    for (const [nom, valeur] of Object.entries(fenetre)) vi.stubGlobal(nom, valeur);
  }

  /** Simule une touche pressée, repérée par sa position physique (KeyboardEvent.code). */
  presser(code: string) {
    this.emettre("keydown", { code, repeat: false, target: null, preventDefault: () => {} });
  }

  relacher(code: string) {
    this.emettre("keyup", { code, repeat: false, target: null, preventDefault: () => {} });
  }

  /** Pose un doigt sur la scène, à la position (x, y) en pixels. `retard` : le jeu traite l'événement après coup. */
  toucher(doigt: number, x: number, y: number, retard = 0) {
    this.scene.emettre("pointerdown", this.pointeur(doigt, x, y, retard));
  }

  lever(doigt: number, retard = 0) {
    this.scene.emettre("pointerup", this.pointeur(doigt, 0, 0, retard));
  }

  /** Touche le bouton pause, au-dessus de la scène */
  toucherPause() {
    this.scene.emettre("pointerdown", { ...this.pointeur(99, 900, 20), target: this.bouton });
    this.boutonPause.emettre("click", {});
  }

  /** Clique sur un élément de la page, hors de la scène (bouton des réglages) */
  cliquer(selecteur: string) {
    this.elements[selecteur].emettre("click", {});
  }

  /** Change la valeur d'un champ des réglages */
  saisir(selecteur: string, valeur: string) {
    const champ = this.elements[selecteur];
    champ.value = valeur;
    champ.emettre("change", { target: champ });
  }

  /** Touche un bouton de l'écran affiché (départ, pause, mort, fin), repéré par son action */
  toucherBouton(act: string) {
    this.overlay.emettre("click", { target: { closest: () => ({ dataset: { act } }) } });
  }

  /** Passe dans une autre application, ou en revient */
  cacher(cache: boolean) {
    this.document.hidden = cache;
    this.document.emettre("visibilitychange", {});
  }

  /** Tourne le téléphone */
  orienter(sens: "portrait" | "paysage") {
    this.media("(orientation: portrait)").changer(sens === "portrait");
  }

  /** Avance l'horloge d'une image, en lançant le séquenceur et la boucle d'images quand ils sont dus. */
  image(pas = 1 / 60) {
    this.horloge.secondes += pas;
    if (this.horloge.audioActif) this.horloge.audio += pas;
    const ms = this.horloge.secondes * 1000;
    for (const m of [...this.minuteries.values()]) {
      while (m.prochaine <= ms) {
        m.prochaine += m.ms;
        m.fn();
      }
    }
    const images = this.images;
    this.images = [];
    for (const fn of images) fn(ms);
  }

  /** Avance image par image jusqu'à ce que la condition soit vraie, ou que la durée maximale soit écoulée. */
  avancerJusqua(condition: (etat: Etat) => boolean, maxSecondes: number) {
    const fin = this.horloge.secondes + maxSecondes;
    while (!condition(this.jeu.state) && this.horloge.secondes < fin) this.image();
    return this.jeu.state;
  }

  private media(requete: string) {
    if (!this.medias.has(requete)) this.medias.set(requete, requeteMedia(false));
    return this.medias.get(requete);
  }

  private pointeur(doigt: number, x: number, y: number, retard = 0) {
    const cible = { closest: () => null };
    return {
      pointerId: doigt,
      clientX: x,
      clientY: y,
      timeStamp: this.horloge.secondes * 1000 - retard * 1000,
      target: cible,
      preventDefault: () => {},
    };
  }

  private emettre(type: string, e: Record<string, unknown>) {
    for (const fn of this.ecouteurs.get(type) ?? []) fn(e);
  }
}
