# Deux Mains

Prototype de jeu de rythme à deux mains, dans un défilement horizontal. La main gauche joue la basse en faisant sauter et glisser le personnage par-dessus et sous les obstacles. La main droite joue la mélodie en tirant sur des ennemis. Le niveau et les ennemis forment ensemble la chanson, qui est générée à partir d'une graine.

Le jeu est écrit en TypeScript (Canvas et Web Audio, sans dépendance au moment de jouer) et se construit en un seul fichier, `dist/deux-mains.html`, à ouvrir dans un navigateur (voir « Développer »).

## Commandes

| Main   | Touche          | Action                        | Note jouée                                                |
| ------ | --------------- | ----------------------------- | --------------------------------------------------------- |
| Gauche | `W`             | Sauter par-dessus un bloc     | Octave de la basse                                        |
| Gauche | `S`             | Glisser sous une barre        | Fondamentale                                              |
| Gauche | `S` tenu        | Traverser un tunnel           | Note tenue                                                |
| Droite | `J` `K` `L` `;` | Tirer dans un couloir         | Fondamentale, tierce, quinte, octave de l'accord en cours |
| —      | `A`             | Activer ou couper l'auto-play |                                                           |
| —      | `Échap`         | Pause                         |                                                           |

Les touches suivent leur position physique : en AZERTY, le saut est sur `Z` et l'octave sur `M`.

## Principes de gameplay

- **Tout le jeu parle en degrés.** La zone donne l'accord, et chaque action choisit un degré de cet accord. Il est donc impossible de jouer faux.
- **Accords.** Des ennemis reliés par une barre se tirent ensemble. Un pointillé vers un obstacle indique un accord à deux mains.
- **Harmonie.** C'est la barre de vie. Quand elle baisse, la musique s'étouffe, perd ses couches, puis se désaccorde. À zéro, un effet « tape stop » arrête la chanson, et on peut reprendre au début de la section.
- **Combo.** Le combo ajoute des couches : arpèges à 8, chœurs à 20, cordes à 35.
- **Entraînement.** On peut jouer une seule main pendant que l'autre est en auto-play.

## Générateur

- La graine choisit la tonalité, le tempo (88 à 112 BPM) et une progression d'accords : I–V–vi–IV, vi–IV–I–V, Royal Road, vamp dorien, cadence andalouse ou canon de Pachelbel.
- Forme de la chanson : Intro, Couplet, Refrain, Solo libre, Refrain, Outro.
- La basse suit des motifs rythmiques qui dépendent de la difficulté.
- La mélodie est un motif de 2 mesures, répété avec des variations, en question-réponse : la phrase finit sur la quinte, puis sur la fondamentale.
- Quatre difficultés : Débutant, Facile, Normal, Difficile. Débutant garde la main droite sur les temps, sans note tenue ni accord, et les deux mains ne jouent jamais ensemble.

## Développer

Il faut [Node.js](https://nodejs.org/) dans sa dernière version LTS (24, voir `.nvmrc`). Toutes les dépendances sont des outils de développement : le jeu construit n'en charge aucune.

```bash
npm install          # installer l'outillage
npm run dev          # servir le jeu avec rechargement à chaud
npm test             # lancer les tests, dont la simulation, et mesurer la couverture
npm run build        # construire dist/deux-mains.html, le fichier à publier
npm run format       # formater tout le dépôt avec Prettier (format:check pour vérifier sans écrire)
npm run lint         # vérifier src/ et tests/ avec ESLint
```

- **Build** : Vite produit `dist/deux-mains.html`, un seul fichier autonome qui s'ouvre d'un double-clic. Il ne charge rien d'extérieur à part les polices Google Fonts.
- **Simulation** (`tests/simulation.test.ts`) : joue une chanson entière dans chaque univers et chaque difficulté, sans navigateur. Elle vérifie que l'auto-play termine la chanson sans note ratée, et qu'une partie où l'on ne touche à rien se termine par la mort. Le jeu complet (`src/main.ts`) tourne dans un faux navigateur (`tests/support/navigateur.ts`).
- **Instantané du générateur** (`tests/generateur-instantane.test.ts`) : pour 20 graines et les trois difficultés, les chansons doivent rester identiques à `tests/instantanes/chansons.json`.
- **Séparation** (`tests/separation.test.ts`) : ESLint interdit à `src/chanson/` et au jugement d'importer le rendu, l'audio ou l'interface, ou d'utiliser le navigateur.
- Les décisions d'outillage sont dans [ADR-0007](docs/adr/0007-modules-vite-typescript-et-outillage.md).

## Pistes pour la suite

- Écrasement et double saut (`Espace`)
- Notes de passage entre les couloirs
- Calibrage de la latence audio
- Contrôles tactiles
- Univers, personnage et histoire
