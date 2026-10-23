export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Un texte venu du joueur ou d'un code collé (le titre d'une composition, #28), sûr à écrire dans du HTML */
export const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
