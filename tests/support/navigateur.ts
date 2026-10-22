// Faux navigateur pour faire tourner le jeu complet dans Node.
//
// Avant d'importer src/main.ts, on remplace les globales du navigateur par des imitations qui fournissent
// juste ce que le jeu utilise : document, canvas 2D, Web Audio, minuteries, clavier et localStorage.
// Une seule horloge simulée fait avancer à la fois AudioContext.currentTime, performance.now(),
// setInterval (le séquenceur) et requestAnimationFrame (la boucle d'images).
//
// Chaque Navigateur repart de modules neufs (vi.resetModules), donc d'une partie neuve.

import { vi } from "vitest";
import type { Etat } from "../../src/jeu/etat";

export type Difficulte = "facile" | "normal" | "difficile";
export type Univers = "ville" | "boite";

export interface InterfaceJeu {
  state: Etat;
  load(seed: number, diff: Difficulte): void;
  setTheme(v: Univers): void;
  setPractice(v: "both" | "L" | "R"): void;
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
    setValueAtTime: () => p,
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

function element(extra: Record<string, unknown> = {}) {
  return {
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    addEventListener: () => {},
    blur: () => {},
    ...extra,
  };
}

/* ---------- Navigateur ---------- */
export class Navigateur {
  readonly horloge = new Horloge();
  readonly overlay = element();
  jeu: InterfaceJeu;
  private ecouteurs = new Map<string, Ecouteur[]>();
  private images: ((t: number) => void)[] = [];
  private minuteries = new Map<number, { fn: () => void; ms: number; prochaine: number }>();
  private prochainId = 1;

  /** Installe le faux navigateur, puis charge le jeu comme le ferait la page. */
  static async ouvrir() {
    const nav = new Navigateur();
    nav.installer();
    vi.resetModules();
    await import("../../src/main");
    const { S } = await import("../../src/jeu/etat");
    const reglages = await import("../../src/ui/reglages");
    nav.jeu = { state: S, load: reglages.load, setTheme: reglages.setTheme, setPractice: reglages.setPractice };
    return nav;
  }

  /** Remet les vraies globales de Node. */
  fermer() {
    vi.unstubAllGlobals();
  }

  private installer() {
    const ms = () => this.horloge.secondes * 1000;
    const elements: Record<string, ReturnType<typeof element>> = {
      "#game": element({
        width: 1200,
        height: 620,
        getContext: () => contexte2d(),
        getBoundingClientRect: () => ({ width: 1200, height: 620 }),
      }),
      "#overlay": this.overlay,
      "#seed": element(),
      "#songline": element(),
      "#new": element(),
    };
    const parId = new Map<string, ReturnType<typeof element>>();
    const stockage = new Map<string, string>();

    const fenetre: Record<string, unknown> = {
      document: {
        documentElement: {},
        activeElement: null,
        hidden: false,
        querySelector: (s: string) => elements[s] ?? element(),
        querySelectorAll: () => [],
        getElementById: (id: string) => parId.get(id) ?? parId.set(id, element()).get(id),
        addEventListener: () => {},
      },
      navigator: {},
      performance: { now: ms },
      localStorage: {
        getItem: (k: string) => stockage.get(k) ?? null,
        setItem: (k: string, v: string) => void stockage.set(k, String(v)),
      },
      matchMedia: () => ({ matches: false }),
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

  private emettre(type: string, e: Record<string, unknown>) {
    for (const fn of this.ecouteurs.get(type) ?? []) fn(e);
  }
}
