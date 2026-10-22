# Deux Mains

Jeu de rythme à deux mains : la main gauche joue la basse en faisant sauter et glisser le personnage, la main droite joue la mélodie en tirant sur des ennemis. Les chansons sont générées à partir d'une graine. Deux univers : La Ville Muette et La Boîte à musique.

- Dépôt : https://github.com/julien-riel/deux-mains
- Prototype publié : https://claude.ai/artifact/1XjQovTtdtuq6RFa4Kmx2r (republier le même fichier pour garder cette adresse)

## Langue

Tout est en français : issues, pull requests, messages de commit, ADR, commentaires du code, textes du jeu.

## Organisation

- `index.html` : la structure de la page, qui charge `src/styles.css` et `src/main.ts`.
- `src/` : le code TypeScript, organisé par domaine (ADR-0007) :
  - `chanson/` : théorie (notes, accords, progressions), difficultés, aléatoire et générateur ;
  - `jeu/` : état de la partie, jugement des coups, auto-play, déroulement (départ, pause, mort, reprise), et les effets du jugement sur le son et l'image ;
  - `audio/` : moteur Web Audio, instruments, séquenceur ;
  - `rendu/` : outils de dessin, scène et HUD, décors de la Ville et de la Boîte ;
  - `univers/` : définitions des univers (textes, couleurs) ;
  - `ui/` : écrans, touches, clavier, réglages ;
  - `main.ts` : amorçage et boucle d'images.

  `chanson/` et `jeu/jugement.ts` sont de la logique pure : ils n'importent rien de `rendu/`, `audio/` ou `ui/`, et n'utilisent ni `document`, ni `window`, ni `AudioContext`. ESLint le vérifie. Le jugement agit sur le son et l'image par les effets qu'on lui branche (`brancherEffets`).

- `tests/` : les tests Vitest, dont la simulation qui joue une chanson entière dans chaque univers.
- `dist/deux-mains.html` : le jeu construit, en un seul fichier. C'est lui qu'on publie. Non versionné.
- `docs/adr/` : le registre des décisions d'architecture. Lire l'index `docs/adr/README.md` avant de modifier un comportement structurant.

## Façon de travailler

- **Issues** : skill `ecrire-issue`.
- **Implémentation** : skill `implementer-issue` (pertinence, ADR, tests, formatage, pull request).
- **Décisions** : skill `decision-adr`. Quand une décision d'architecture doit être prise, publier d'abord une page de décision (artefact) avec contexte, diagrammes, exemples, options et recommandation, puis écrire l'ADR une fois le choix fait.
- Un ADR accepté ne se contourne pas : on le remplace par un nouvel ADR.

## Outillage

Décidé par ADR-0007 : TypeScript, Vite (avec `vite-plugin-singlefile`), Vitest, Prettier et ESLint. Uniquement des dépendances de développement.

| Commande         | Rôle                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`    | Serveur de développement avec rechargement à chaud                                         |
| `npm test`       | Tests Vitest (unitaires et simulation)                                                     |
| `npm run build`  | Produit `dist/deux-mains.html`, le fichier à publier                                       |
| `npm run format` | Prettier en écriture sur tout le projet (`npm run format:check` pour vérifier sans écrire) |
| `npm run lint`   | ESLint                                                                                     |

La simulation charge `src/main.ts` dans un faux navigateur (`tests/support/navigateur.ts`) et lit l'état en important les modules. L'instantané du générateur (`tests/instantanes/chansons.json`) prouve que les chansons ne changent pas ; ne le régénérer (`npx vitest run -u`) que pour un changement voulu du générateur.

Pour publier le jeu en artefact : `npm run build`, puis republier `dist/deux-mains.html` à l'adresse du prototype.
