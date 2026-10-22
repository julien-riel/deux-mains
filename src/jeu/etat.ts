/* ---------- État ---------- */
import type { Chanson, Main, Note, Section } from "../chanson/types";
import { clamp } from "../outils";

export type Mode = "title" | "calib" | "play" | "pause" | "dying" | "dead" | "done";

/** Ce que le joueur fait, quelle que soit la commande : clavier, tactile ou MIDI (ADR-0008) */
export type Action = "sauter" | "glisser" | "couloir0" | "couloir1" | "couloir2" | "couloir3";
export const COULOIRS: Action[] = ["couloir0", "couloir1", "couloir2", "couloir3"];

/** Point de reprise : le début de la section en cours et le score à ce moment-là */
export interface PointDeReprise {
  sec: Section;
  score: number;
  perfect: number;
  good: number;
  miss: number;
  maxCombo: number;
}

/** Le calibrage en cours : les clics du métronome et les coups du joueur, à l'heure où on les entend */
export interface Calibrage {
  clics: number[];
  coups: number[];
  fin: number;
  /** Le décalage mesuré en secondes, null s'il n'a pas pu l'être ; absent tant que le métronome joue */
  resultat?: number | null;
}

/** L'état de la partie, partagé par tous les modules */
export interface Etat {
  song: Chanson;
  seed: number;
  diff: string;
  mode: Mode;
  health: number;
  combo: number;
  maxCombo: number;
  score: number;
  perfect: number;
  good: number;
  miss: number;
  // Horloge de la partie (ADR-0004), et le décalage du joueur mesuré par le calibrage, en secondes
  startBeat: number;
  decalage: number;
  calib: Calibrage;
  t0: number;
  nextStep: number;
  timer: ReturnType<typeof setInterval> | 0;
  deathAt: number;
  deathBeat: number;
  titleBeat: number;
  curSec: Section;
  cp: PointDeReprise;
  banner: { text: string; sub: string; at: number };
  // Entrées et animation
  keys: Partial<Record<Action, boolean>>;
  jumpAt: number;
  jumpAir: number;
  slideUntil: number;
  hurtAt: number;
  shake: number;
  gun: number[];
  laneFlash: number[];
  beams: { lane: number; at: number; ok: boolean | null }[];
  parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; size: number }[];
  pops: { text: string; x: number; y: number; color: string; at: number }[];
  // Auto-play et réglages
  auto: boolean;
  autoUsed: boolean;
  autoQ: { at: number; ev?: Note; solo?: number }[];
  autoLane: number;
  keyFlash: Partial<Record<Action, number>>;
  practice: string;
  theme: string;
  keyAng: number;
}

export const S: Etat = {
  song: null,
  seed: 1,
  diff: "normal",
  mode: "title",
  health: 100,
  combo: 0,
  maxCombo: 0,
  score: 0,
  perfect: 0,
  good: 0,
  miss: 0,
  startBeat: 0,
  decalage: 0,
  calib: null,
  t0: 0,
  nextStep: 0,
  timer: 0,
  deathAt: 0,
  deathBeat: 0,
  titleBeat: 4,
  curSec: null,
  cp: null,
  banner: null,
  keys: {},
  jumpAt: -99,
  jumpAir: 0.5,
  slideUntil: -99,
  hurtAt: -1e9,
  shake: 0,
  gun: [260, 470],
  laneFlash: [-1e9, -1e9, -1e9, -1e9],
  beams: [],
  parts: [],
  pops: [],
  auto: false,
  autoUsed: false,
  autoQ: [],
  autoLane: 1,
  keyFlash: {},
  practice: "both",
  theme: "ville",
  keyAng: 0,
};
export const spb = () => 60 / S.song.bpm;
// Sur l'écran de départ et pendant le calibrage, la scène tourne au repos
export const auRepos = () => S.mode === "title" || S.mode === "calib";

export const mult = () => 1 + Math.min(3, Math.floor(S.combo / 10)) * 0.5;
export const sectionAtBar = (bar: number) =>
  S.song.sections.find((s) => bar >= s.start && bar < s.start + s.bars) || S.song.sections[S.song.sections.length - 1];
export const chordAtBeat = (b: number) => S.song.chords[clamp(Math.floor(b / 4), 0, S.song.totalBars - 1)];
export const layers = () => {
  const ok = S.health >= 50;
  return { arp: ok && S.combo >= 8, choir: ok && S.combo >= 20, strings: ok && S.combo >= 35 };
};
// La main qui joue toute seule : les deux en auto-play, ou l'autre main en entraînement
export const autoFor = (hand: Main) => S.auto || (S.practice !== "both" && S.practice !== hand);
