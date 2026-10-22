// Les chansons ne changent pas : 20 graines × 3 difficultés comparées à un instantané pris avant le découpage
// en modules (#2). Si un changement du générateur est voulu, régénérer avec `npx vitest run -u` et le dire.

import { expect, it } from "vitest";
import { Navigateur } from "./support/navigateur";
import { DIFFICULTES, GRAINES, decrireChanson } from "./support/instantane";

it("le générateur produit les mêmes chansons que l'instantané", async () => {
  const nav = new Navigateur();
  const resultat: Record<string, ReturnType<typeof decrireChanson>> = {};
  for (const diff of DIFFICULTES) {
    for (const graine of GRAINES) {
      nav.jeu.load(graine, diff);
      resultat[`${graine} ${diff}`] = decrireChanson(nav.jeu.state.song);
    }
  }
  await expect(JSON.stringify(resultat, null, 2) + "\n").toMatchFileSnapshot("./instantanes/chansons.json");
});
