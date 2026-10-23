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
  - `jeu/` : état de la partie, couche d'actions, jugement des coups, table des touches MIDI, auto-play, variations de la partie (reprise du solo), déroulement (départ, pause, mort, reprise), et les effets du jugement sur le son et l'image ;
  - `audio/` : moteur Web Audio, instruments, séquenceur ;
  - `rendu/` : outils de dessin, scène et HUD, décors de la Ville et de la Boîte ;
  - `univers/` : définitions des univers (textes, couleurs) ;
  - `essais/` : les scénarios du mode essai et la fabrique de leurs chansons courtes ;
  - `ui/` : écrans, touches, clavier, tactile, clavier MIDI (accès Web MIDI), réglages, menu des essais ;
  - `main.ts` : amorçage et boucle d'images.

  `chanson/`, `essais/`, `jeu/jugement.ts`, `jeu/calibrage.ts`, `jeu/midi.ts` et `jeu/variations.ts` (la reprise du solo, ADR-0012) sont de la logique pure : ils n'importent rien de `rendu/`, `audio/` ou `ui/`, et n'utilisent ni `document`, ni `window`, ni `AudioContext`. ESLint le vérifie. Le jugement agit sur le son et l'image par les effets qu'on lui branche (`brancherEffets`).

- `tests/` : les tests Vitest, dont la simulation qui joue une chanson entière dans chaque univers.
- `dist/deux-mains.html` : le jeu construit, en un seul fichier. C'est lui qu'on publie. Non versionné.
- `docs/adr/` : le registre des décisions d'architecture. Lire l'index `docs/adr/README.md` avant de modifier un comportement structurant.

## Façon de travailler

- **Issues** : skill `ecrire-issue`.
- **Implémentation** : skill `implementer-issue` (pertinence, ADR, tests, formatage, pull request).
- **Décisions** : skill `decision-adr`. Quand une décision d'architecture doit être prise, publier d'abord une page de décision (artefact) avec contexte, diagrammes, exemples, options et recommandation, puis écrire l'ADR une fois le choix fait.
- Un ADR accepté ne se contourne pas : on le remplace par un nouvel ADR.

## Mode essai

Un essai fait tomber directement sur une fonctionnalité : une chanson courte (une douzaine de mesures) où elle revient dès les premières mesures, dans l'univers et la difficulté choisis, l'autre main en auto-play si besoin. La phrase « à vérifier » reste affichée sur la scène.

- **Où** : le registre `ESSAIS` dans `src/essais/registre.ts`. La fabrique `src/essais/fabrique.ts` assemble des mesures d'une chanson générée (`assembler`), réécrit la basse avec des motifs (même notation que `DIFFS`), peut changer les accords d'un morceau (`accords`), faire marcher la basse en escaliers (`marcher`) et ajouter des événements (`accorder`, puis `finaliser`). Le générateur n'est jamais modifié pour un essai.
- **Ajouter un essai** : une entrée dans `ESSAIS` avec `id` (minuscules et tirets), `titre`, `verifier` (ce qu'on doit voir ou entendre), `issue`, `univers`, `diff`, `mains` (`both`, `L`, `R` ou `duo`, un joueur par main), `chanson()` et `repere(ev)` (les notes qui portent la fonctionnalité). `tests/essais.test.ts` vérifie automatiquement que la chanson est valide, que le repère apparaît dans les quatre premières mesures et au moins quatre fois, et que l'auto-play la joue sans faute.
- **Ouvrir un essai** : `npm run dev` puis `http://localhost:5173/?essai=<id>` (ou `#essai=<id>`) ; dans `dist/deux-mains.html` ou l'artefact publié, le bouton « Essais » de l'écran titre (touche `E`), puis le numéro de l'essai. Échap quitte les essais et rend les réglages du joueur.

## Outillage

Décidé par ADR-0007 : TypeScript, Vite (avec `vite-plugin-singlefile`), Vitest, Prettier et ESLint. Uniquement des dépendances de développement.

| Commande         | Rôle                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`    | Serveur de développement avec rechargement à chaud                                         |
| `npm test`       | Tests Vitest (unitaires et simulation), avec un seuil de couverture de 90 % des lignes     |
| `npm run build`  | Produit `dist/deux-mains.html`, le fichier à publier                                       |
| `npm run format` | Prettier en écriture sur tout le projet (`npm run format:check` pour vérifier sans écrire) |
| `npm run lint`   | ESLint                                                                                     |

Les tests unitaires (`generateur`, `jugement`, `autoplay`) importent directement la logique pure, sans faux navigateur : les effets du jugement y sont des espions. La couverture des lignes de `chanson/`, de `jeu/jugement.ts`, de `jeu/midi.ts` et de `jeu/variations.ts` doit rester d'au moins 90 %, sinon `npm test` échoue.

La simulation charge `src/main.ts` dans un faux navigateur (`tests/support/navigateur.ts`) et lit l'état en important les modules. L'instantané du générateur (`tests/instantanes/chansons.json`) prouve que les chansons ne changent pas ; ne le régénérer (`npx vitest run -u`) que pour un changement voulu du générateur.

Pour publier le jeu en artefact : `npm run build`, puis republier `dist/deux-mains.html` à l'adresse du prototype.
