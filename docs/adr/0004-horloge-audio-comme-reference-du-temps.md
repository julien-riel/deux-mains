# ADR-0004 : Prendre l'horloge audio comme référence du temps

- **Statut** : Acceptée
- **Date** : 2026-10-21
- **Issues liées** : aucune

## Contexte

Dans un jeu de rythme, un décalage de quelques dizaines de millisecondes entre l'image, le son et le jugement des coups se sent immédiatement. Les minuteries JavaScript (`setTimeout`, `requestAnimationFrame`) dérivent et sont suspendues en arrière-plan.

## Options considérées

### Option A : horloge de l'image (`requestAnimationFrame`)

Simple, mais la musique et l'image se désynchronisent dès qu'une image saute.

### Option B : horloge Web Audio (`AudioContext.currentTime`)

L'horloge matérielle du son sert de référence unique ; l'image et le jugement s'y alignent.

## Décision

Option B :

- La position dans la chanson se calcule toujours depuis `AudioContext.currentTime`, moins la latence de sortie (`outputLatency`).
- Un séquenceur passe toutes les 25 ms et programme les sons 120 ms à l'avance, à l'heure exacte.
- Un coup en avance fait partir la note pile sur le temps (quantification) ; un coup en retard la fait partir tout de suite.
- La pause suspend l'`AudioContext`, ce qui gèle toute la chanson d'un coup.
- En auto-play, le son est programmé par le séquenceur, et l'animation suit au moment où on l'entend.

## Conséquences

- **Positives** : synchronisation stable, pause et reprise propres, la musique reste belle même avec un jeu imprécis.
- **Négatives** : il faut un premier geste de l'utilisateur pour démarrer l'audio, et la latence de sortie varie selon le matériel.
- **À surveiller** : un réglage de calibrage de la latence sera probablement nécessaire.
