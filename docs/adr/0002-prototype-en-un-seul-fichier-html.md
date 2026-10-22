# ADR-0002 : Livrer le prototype en un seul fichier HTML sans dépendance

- **Statut** : Acceptée
- **Date** : 2026-10-21
- **Issues liées** : aucune

## Contexte

Le premier objectif était de tester vite la sensation de jeu à deux mains. Le prototype doit s'ouvrir d'un double-clic et se publier comme une page web unique.

## Options considérées

### Option A : un seul fichier `deux-mains.html`
HTML, CSS et JavaScript dans un fichier ; Canvas 2D pour le rendu, Web Audio pour le son, synthétisé en direct (aucun fichier audio).

### Option B : un moteur de jeu (Phaser, PixiJS) et des échantillons audio
Plus de fonctionnalités, mais une installation, un build et des fichiers à charger.

## Décision

Option A pour la phase de prototype. Aucune bibliothèque externe, aucun fichier audio : tous les sons sont synthétisés avec Web Audio.

## Conséquences

- **Positives** : zéro installation, publication immédiate, itérations rapides.
- **Négatives** : le fichier grossit (plus de 1 500 lignes) et le code n'est pas découpé en modules, ce qui rend les tests unitaires difficiles.
- **À surveiller** : dès qu'on veut des tests et un formatage automatique, cette décision doit être revue (voir l'outillage).
