# Deux Mains

Jeu de rythme à deux mains : la main gauche joue la basse en faisant sauter et glisser le personnage, la main droite joue la mélodie en tirant sur des ennemis. Les chansons sont générées à partir d'une graine. Deux univers : La Ville Muette et La Boîte à musique.

- Dépôt : https://github.com/julien-riel/deux-mains
- Prototype publié : https://claude.ai/artifact/1XjQovTtdtuq6RFa4Kmx2r (republier le même fichier pour garder cette adresse)

## Langue

Tout est en français : issues, pull requests, messages de commit, ADR, commentaires du code, textes du jeu.

## Organisation

- `deux-mains.html` : le jeu complet (voir ADR-0002).
- `docs/adr/` : le registre des décisions d'architecture. Lire l'index `docs/adr/README.md` avant de modifier un comportement structurant.

## Façon de travailler

- **Issues** : skill `ecrire-issue`.
- **Implémentation** : skill `implementer-issue` (pertinence, ADR, tests, formatage, pull request).
- **Décisions** : skill `decision-adr`. Quand une décision d'architecture doit être prise, publier d'abord une page de décision (artefact) avec contexte, diagrammes, exemples, options et recommandation, puis écrire l'ADR une fois le choix fait.
- Un ADR accepté ne se contourne pas : on le remplace par un nouvel ADR.

## Outillage

À définir : la façon de tester et de formater le code fait l'objet d'une décision en attente (ADR-0007). Une fois cette décision prise, cette section donne les commandes exactes pour les tests, Prettier et le linter.
