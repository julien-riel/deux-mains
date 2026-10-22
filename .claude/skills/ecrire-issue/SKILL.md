---
name: ecrire-issue
description: Rédiger une issue GitHub pour le projet Deux Mains, avec objectif, description, portée (inclus / exclus), critères d'acceptation, liens vers les autres issues et les ADR. Utiliser quand l'utilisateur veut créer, écrire, rédiger ou découper une issue, un ticket, une tâche ou une fonctionnalité à faire plus tard.
---

# Écrire une issue

Une bonne issue se comprend sans la conversation qui l'a fait naître. Quelqu'un qui ne connaît pas le contexte doit pouvoir l'implémenter et savoir quand elle est terminée.

Les issues sont rédigées en français et créées dans le dépôt GitHub du projet avec `gh`.

## Étapes

### 1. Comprendre le besoin

Reformule en une phrase ce que l'utilisateur veut obtenir et pourquoi. Pose une question seulement si la réponse change le contenu de l'issue (par exemple : quelle difficulté est concernée, ou si un comportement est voulu ou non). Sinon, choisis l'interprétation la plus raisonnable et indique-la dans les notes de l'issue.

Si la demande couvre plusieurs choses indépendantes, propose de la découper en plusieurs issues reliées entre elles.

### 2. Lire le contexte

- Les décisions en vigueur : `docs/adr/README.md`, puis les ADR qui touchent le sujet.
- Les issues existantes, pour éviter les doublons et trouver les liens : `gh issue list --state all --limit 100 --json number,title,state,labels`. Ouvre les plus proches avec `gh issue view N`.
- Le code concerné, pour écrire une portée et des critères réalistes. Cite les fonctions ou les fichiers touchés quand ça aide.
- Les étiquettes disponibles : `gh label list`. N'en crée pas sans le demander.

### 3. Repérer les décisions à prendre

Demande-toi si l'issue :

- contredit un ADR accepté ;
- impose un choix structurant qui n'est couvert par aucun ADR (format de données, outil, organisation du code, règle de gameplay commune, choix difficile à défaire).

Si oui, ne tranche pas toi-même dans l'issue. Deux possibilités :

- la décision est nécessaire pour écrire l'issue : utilise le skill `decision-adr` maintenant, puis reprends l'issue avec la décision prise ;
- la décision peut attendre l'implémentation : note-la dans la section « Liens » comme ADR à créer, avec la question à trancher.

### 4. Rédiger

Utilise exactement ce modèle :

```markdown
## Objectif

Une ou deux phrases : le résultat attendu pour le joueur ou pour le projet, et pourquoi il compte.

## Description

Le comportement attendu, concrètement. Ce qui se passe aujourd'hui, ce qui doit se passer après. Exemples, captures ou extraits de code si ça aide.

## Portée

### Inclus
- Ce que l'issue livre.

### Exclus
- Ce qu'elle ne livre pas, même si c'est proche (et l'issue qui s'en charge, si elle existe).

## Critères d'acceptation

- [ ] Critère vérifiable, formulé comme un comportement observable.
- [ ] Les tests automatisés couvrent …
- [ ] Le code est formaté (Prettier) et les tests passent.

## Liens

- **Issues** : dépend de #N, bloque #N, liée à #N (ou « aucune »).
- **ADR** : respecte ADR-0003 ; remplace ADR-000X ; ADR à créer : « question à trancher » (ou « aucun »).

## Notes

Hypothèses retenues, questions ouvertes, pistes d'implémentation.
```

Règles d'écriture :

- **Titre** : court, à l'infinitif, sans préfixe (« Ajouter le double saut », pas « [Feature] Double saut »).
- **Critères d'acceptation** : chacun doit pouvoir être vérifié par un test ou par une observation précise. « Le double saut fonctionne » ne suffit pas ; « Appuyer deux fois sur `W` en l'air déclenche un second saut, qui joue la quinte » est vérifiable.
- **Exclus** : au moins une ligne. Si rien n'est exclu, c'est souvent que la portée est floue.
- Pour un changement de son ou de musique, décris ce qu'on doit entendre ; pour un changement visuel, ce qu'on doit voir.

### 5. Valider avec l'utilisateur puis créer

Montre le titre, les étiquettes proposées et le corps complet. Crée l'issue après l'accord de l'utilisateur, sauf s'il a déjà demandé de la créer directement :

```bash
gh issue create --title "Titre" --label "etiquette" --body-file /chemin/vers/corps.md
```

Écris le corps dans un fichier temporaire du répertoire de travail temporaire de la session, pas dans le dépôt.

### 6. Relier

Si l'issue dépend d'une autre ou en bloque une autre, ajoute un commentaire sur l'issue liée (`gh issue comment N --body "Liée à #M : …"`), après accord de l'utilisateur.

Donne l'adresse de l'issue créée.
