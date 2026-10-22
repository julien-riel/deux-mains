# ADR-0007 : Passer à des modules TypeScript construits avec Vite, testés avec Vitest

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : #1 (outillage), #2 (découpage en modules), #3 (tests unitaires)
- **Artefact de décision** : https://claude.ai/artifact/T6Sn7arc1vDNxQzwBr58NF
- **Remplace** : [ADR-0002](0002-prototype-en-un-seul-fichier-html.md)

## Contexte

Le skill `implementer-issue` exige des tests automatisés et un formatage Prettier. Or le jeu tient dans un seul fichier `deux-mains.html` d'environ 1 500 lignes, dont tout le script est enfermé dans une seule fonction (ADR-0002). Rien n'est accessible de l'extérieur : la simulation qui a vérifié les deux univers a dû modifier le code source à la volée et simuler tout le navigateur, même pour atteindre une fonction pure du générateur.

Il faut garder ce qui rendait ADR-0002 utile : un jeu publiable comme artefact à la même adresse, compatible avec GitHub Pages, sans dépendance au moment de jouer.

## Options considérées

### Option A : garder un seul fichier, tests par extraction

Le script expose une interface de test ; les tests extraient le script du HTML et l'exécutent dans Node avec un faux navigateur. Aucun build, mais chaque test doit simuler le navigateur et le fichier continue de grossir sans structure.

### Option B : modules dans `src/`, Vite, un seul fichier HTML en sortie

Le code est découpé en modules. Vite sert le jeu en développement et le build produit un seul fichier HTML autonome. Vitest importe directement les modules.

### Option C : modules sans build

La page charge les modules avec `<script type="module">`. Aucun build, mais le jeu ne s'ouvre plus d'un double-clic (les modules sont bloqués en `file://`), et on perd le rechargement à chaud et TypeScript.

Sur le langage : JavaScript (aucune conversion) ou TypeScript (les erreurs de structure sont trouvées avant de jouer). Sur les outils : Prettier seul, ou Prettier avec ESLint.

## Décision

Option B, en TypeScript, avec Prettier et ESLint.

- **Code** : TypeScript dans `src/`, organisé par domaine (par exemple `chanson/`, `jeu/`, `audio/`, `rendu/`, `univers/`, `ui/`, `main.ts`). On commence avec un TypeScript souple, puis on active le mode `strict` une fois le découpage terminé.
- **Build** : Vite avec `vite-plugin-singlefile`. `npm run build` produit `dist/deux-mains.html`, un seul fichier autonome qui s'ouvre d'un double-clic. C'est ce fichier qui est publié comme artefact et sur GitHub Pages. `dist/` n'est pas versionné.
- **Tests** : Vitest, dans `tests/`.
  - Les modules de logique pure (générateur, jugement, accords, auto-play) n'accèdent ni au DOM, ni au canvas, ni à `AudioContext`, pour pouvoir être testés sans faux navigateur.
  - La simulation existante, qui joue une chanson entière dans chaque univers, devient le test de non-régression des parcours complets.
- **Qualité** : Prettier pour la mise en forme, ESLint (règles recommandées et `typescript-eslint`) pour les erreurs probables.
- **Dépendances** : uniquement des dépendances de développement. Le jeu construit ne charge aucune bibliothèque ni aucun fichier extérieur, à part les polices Google Fonts (avec des polices de secours), et tous les sons restent synthétisés (ce point d'ADR-0002 reste valable).
- **Commandes** : `npm run dev`, `npm test`, `npm run build`, `npm run format`, `npm run lint`, décrites dans la section « Outillage » de `CLAUDE.md`.

La migration se fait en trois issues, dans l'ordre, sans changer le comportement du jeu :

1. installer l'outillage et brancher la simulation comme premier test ;
2. découper `deux-mains.html` en modules TypeScript, la simulation devant passer avant et après ;
3. ajouter les tests unitaires du générateur, du jugement et de l'auto-play.

## Conséquences

- **Positives** : vrais tests unitaires, rechargement à chaud en développement, erreurs de structure détectées par TypeScript, code formaté de façon uniforme. Le fichier publié reste unique.
- **Négatives** : il faut Node pour modifier le jeu, et lancer le build avant chaque publication. Le découpage demande un effort ponctuel.
- **À surveiller** : si un module de logique pure finit par importer du code de rendu ou d'audio, la séparation qui rend les tests simples est en train de se perdre.
