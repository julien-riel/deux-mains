// Les chansons ne changent pas : 20 graines × 4 difficultés comparées à un instantané pris avant le découpage
// en modules (#2), Débutant ajouté avec #40. Si un changement du générateur est voulu, régénérer avec `npx vitest run -u` et le dire.

import { expect, it } from "vitest";
import { buildSong } from "../src/chanson/generateur";
import { DIFFICULTES, GRAINES, decrireChanson } from "./support/instantane";

it("le générateur produit les mêmes chansons que l'instantané", async () => {
  const resultat: Record<string, ReturnType<typeof decrireChanson>> = {};
  for (const diff of DIFFICULTES) {
    for (const graine of GRAINES) resultat[`${graine} ${diff}`] = decrireChanson(buildSong(graine, diff));
  }
  await expect(JSON.stringify(resultat, null, 2) + "\n").toMatchFileSnapshot("./instantanes/chansons.json");
});
