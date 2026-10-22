---
name: decision-adr
description: Préparer et consigner une décision d'architecture (ADR) pour le projet Deux Mains. Publie une page de décision avec contexte, diagrammes, exemples, options et recommandation, recueille le choix de l'utilisateur, puis écrit l'ADR dans docs/adr/. Utiliser quand une issue ou une implémentation impose un choix structurant, contredit un ADR existant, ou quand l'utilisateur demande de prendre ou de documenter une décision.
---

# Prendre une décision d'architecture

L'utilisateur prend la décision ; ton travail est de la rendre facile à prendre. Il doit comprendre l'enjeu sans lire le code, voir les options côte à côte, et savoir ce que tu recommandes et pourquoi.

## Quand une décision mérite un ADR

- elle est coûteuse à défaire (organisation du code, format de données, outil, dépendance) ;
- elle fixe une règle commune que d'autres issues devront respecter (règle de gameplay, convention) ;
- elle remplace ou contredit un ADR existant.

Un détail d'implémentation local et facile à changer ne mérite pas d'ADR : décide toi-même et mentionne-le dans la pull request.

## Étapes

### 1. Poser la question

Formule la décision en une question, par exemple : « Comment organiser le code pour pouvoir le tester ? ». Si plusieurs décisions sont liées, présente-les sur la même page, mais en questions séparées.

### 2. Rassembler le contexte

- les ADR concernés (`docs/adr/README.md`) ;
- ce qui est vrai aujourd'hui dans le code, avec des références précises ;
- les contraintes : publication en artefact, GitHub Pages, ouverture d'un double-clic, performances, latence audio ;
- l'issue qui a fait naître la question.

### 3. Construire les options

Deux à quatre options réelles, chacune avec :

- son fonctionnement, en quelques phrases ;
- un exemple concret (arborescence de fichiers, extrait de code, commande, scénario de jeu) ;
- ses avantages et ses inconvénients ;
- son coût de mise en place et sa facilité à être défaite.

Puis une recommandation, avec la raison principale et ce qui ferait changer d'avis.

### 4. Publier la page de décision

Fais un artefact : appelle d'abord l'outil Artifact avec `action: "quickstart"`, puis suis ses consignes de design. La page contient, dans cet ordre :

1. **La question**, en titre, et l'issue d'origine.
2. **Le contexte** : pourquoi il faut décider maintenant, ce qui est vrai aujourd'hui.
3. **Des diagrammes** : au minimum un schéma de la situation actuelle et un schéma par option (blocs `<pre class="mermaid">`, ou SVG inline). Ils doivent montrer le mécanisme réel : fichiers, flux de données, étapes.
4. **Les options**, chacune avec son exemple, ses avantages et ses inconvénients.
5. **Un tableau comparatif** sur les critères qui comptent pour cette décision.
6. **La recommandation**, clairement marquée, avec sa raison.
7. **Les réponses possibles** : la liste des choix, numérotés ou lettrés, que l'utilisateur peut donner en réponse (« A », « B avec TypeScript », etc.), plus « autre ».

Écris le fichier de la page dans le répertoire de travail temporaire de la session, pas dans le dépôt.

### 5. Recueillir le choix

Donne le lien de la page, résume la question et ta recommandation en deux ou trois lignes, puis demande le choix (avec l'outil de question à choix multiples si disponible, la recommandation en premier). N'écris pas l'ADR comme accepté avant d'avoir la réponse.

Si l'utilisateur doit réfléchir, tu peux écrire l'ADR au statut **Proposée** en attendant.

### 6. Écrire l'ADR

1. Copie `docs/adr/0000-modele.md` sous le prochain numéro libre : `docs/adr/NNNN-titre-court.md`.
2. Remplis-le : statut **Acceptée**, date du jour, issues liées, lien vers la page de décision, contexte, options considérées, décision avec les règles concrètes qu'elle impose, conséquences.
3. Ajoute la ligne à l'index de `docs/adr/README.md`.
4. Si la décision en remplace une autre, passe l'ancien ADR au statut « Remplacée par [ADR-NNNN](NNNN-titre.md) » et mets l'index à jour. C'est la seule modification permise sur un ADR accepté.
5. Si la décision change une convention décrite dans `CLAUDE.md` (outillage, commandes, organisation), mets `CLAUDE.md` à jour aussi.

L'ADR est commité avec le travail en cours (l'issue ou la pull request qui a fait naître la décision).
