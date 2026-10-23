---
name: implementer-issue
description: Implémenter une issue GitHub du projet Deux Mains de bout en bout. Vérifie d'abord que l'issue est encore pertinente et si elle demande de créer ou modifier un ADR, puis implémente avec des tests, formate avec Prettier, et ouvre une pull request. Utiliser quand l'utilisateur demande d'implémenter, de faire, de coder ou de traiter une issue (par exemple « fais l'issue 12 » ou « implémente #12 »).
---

# Implémenter une issue

On part d'une issue écrite avec le skill `ecrire-issue`. Le travail n'est terminé que quand chaque critère d'acceptation est vérifié, que les tests passent et que le code est formaté.

## Étapes

### 1. Lire l'issue et son contexte

```bash
gh issue view N --comments
```

Lis aussi les issues liées et les ADR cités dans la section « Liens », puis l'index `docs/adr/README.md` pour repérer d'autres ADR qui touchent le même code.

### 2. Vérifier que l'issue est encore pertinente

Compare l'issue avec l'état actuel du code et des ADR :

- **Déjà faite** (le code fait déjà ce que décrivent les critères) : montre-le à l'utilisateur et propose de fermer l'issue avec un commentaire qui l'explique. Arrête-toi là.
- **En partie dépassée** (le code a changé, une partie de la portée n'a plus de sens, un critère est impossible) : propose une nouvelle version de l'issue. Modifie-la avec `gh issue edit N --body-file …` après accord, puis continue.
- **Contradictoire** avec un ADR accepté : ne choisis pas toi-même. Passe à l'étape 3.
- **Pertinente** : continue.

### 3. Vérifier les décisions d'architecture

Avant d'écrire du code, demande-toi si l'implémentation :

- va à l'encontre d'un ADR accepté ;
- impose un choix structurant qu'aucun ADR ne couvre (nouvel outil ou dépendance, format de données, organisation du code, règle de gameplay commune, choix coûteux à défaire) ;
- correspond à un « ADR à créer » noté dans l'issue.

Si oui, utilise le skill `decision-adr` : publie la page de décision, attends le choix de l'utilisateur, écris l'ADR. N'implémente jamais en contournant un ADR accepté sans l'avoir remplacé.

### 4. Préparer la branche

```bash
git switch main && git pull --ff-only
git switch -c issue-N-titre-court
```

Si l'arbre de travail contient des modifications sans rapport, demande quoi en faire avant de changer de branche.

### 5. Planifier à partir des critères

Associe chaque critère d'acceptation à une vérification : un test automatisé de préférence, sinon une vérification manuelle précise (ce qu'il faut voir ou entendre). Commence par les tests quand c'est possible : écris-les, vérifie qu'ils échouent pour la bonne raison, puis implémente.

Pour ce projet :

- la logique pure (générateur de chansons, jugement des coups, règles d'accords) se teste avec des tests unitaires, en s'appuyant sur des graines fixes (ADR-0005) ;
- les parcours complets (une chanson entière en auto-play, la mort quand on ne joue pas) se testent avec une simulation sans navigateur ;
- le rendu et le son se vérifient à l'œil et à l'oreille : décris précisément quoi vérifier à l'utilisateur ;
- chaque issue qui ajoute une fonctionnalité jouable ajoute un **scénario d'essai** dans `src/essais/registre.ts` (voir « Mode essai » dans `CLAUDE.md`) : une chanson courte où la fonctionnalité revient dès les premières mesures, avec la phrase « à vérifier ». Les tests de `tests/essais.test.ts` le couvrent automatiquement.

### 6. Implémenter

- Respecte le style du code autour : nommage, densité de commentaires, organisation en sections.
- Respecte les ADR, en particulier ADR-0003 (degrés de l'accord), ADR-0004 (horloge audio) et ADR-0006 (les univers ne touchent qu'à l'habillage).
- Reste dans la portée de l'issue. Si tu trouves autre chose à corriger, note-le pour une nouvelle issue au lieu de l'inclure.

### 7. Vérifier

Lance les commandes décrites dans la section « Outillage » de `CLAUDE.md` :

1. les tests ;
2. Prettier en mode écriture sur les fichiers modifiés, puis en mode vérification sur tout le projet ;
3. le linter, s'il y en a un.

Puis reprends les critères d'acceptation un par un et note pour chacun comment il a été vérifié. Si un critère ne peut pas être vérifié, dis-le clairement plutôt que de le cocher.

Si le jeu est publié comme artefact, republie-le pour que l'utilisateur puisse essayer la nouvelle version.

### 8. Livrer

Commite en français, avec un message qui décrit le changement et se termine par la ligne `Closes #N`. Pousse la branche et ouvre une pull request :

```bash
git push -u origin issue-N-titre-court
gh pr create --title "Titre de l'issue" --body-file /chemin/vers/corps.md
```

Le corps de la pull request contient :

- la ligne `Closes #N`, seule sur sa ligne, avant le résumé ;
- un résumé du changement ;
- les critères d'acceptation cochés, avec la façon dont chacun a été vérifié ;
- les tests ajoutés ;
- les ADR créés, modifiés ou respectés ;
- l'essai ajouté (`id`) et comment l'ouvrir, pour une fonctionnalité jouable ;
- ce qui reste à vérifier à la main.

**Pourquoi `Closes` en anglais** : GitHub ne ferme l'issue à la fusion que s'il reconnaît un de ses mots-clés anglais (`Closes`, `Fixes`, `Resolves`) suivi du numéro. `Ferme #N` ne marche pas. C'est la seule exception à la règle « tout en français ». Si la PR traite plusieurs issues, répète le mot-clé : `Closes #4, closes #5`.

Avant de passer à la suite, vérifie que GitHub a bien relié l'issue à la PR :

```bash
gh pr view --json closingIssuesReferences --jq '.closingIssuesReferences[].number'
```

Le numéro de l'issue doit s'afficher. Sinon, corrige le corps avec `gh pr edit --body-file …`.

Ne fusionne pas la pull request sans l'accord de l'utilisateur. Après une fusion, vérifie avec `gh issue view N --json state` que l'issue est fermée.

### 9. Faire le compte rendu

Donne l'adresse de la pull request, le résultat des tests, et ce que l'utilisateur doit vérifier lui-même (à l'écran ou à l'oreille).

Pour une fonctionnalité jouable, donne aussi l'`id` de son essai et le chemin pour l'ouvrir : `npm run dev` puis `http://localhost:5173/?essai=<id>`, ou le bouton « Essais » de l'écran titre dans `dist/deux-mains.html` ou l'artefact publié. Par exemple : « Ouvre l'essai `double-saut` (Essais, puis 1) ».
