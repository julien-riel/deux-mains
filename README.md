# Deux Mains

Prototype de jeu de rythme à deux mains, dans un défilement horizontal. La main gauche joue la basse en faisant sauter et glisser le personnage par-dessus et sous les obstacles. La main droite joue la mélodie en tirant sur des ennemis. Le niveau et les ennemis forment ensemble la chanson, qui est générée à partir d'une graine.

Tout tient dans un seul fichier, `deux-mains.html` (HTML, Canvas et Web Audio, sans dépendance). Ouvre-le dans un navigateur pour jouer.

## Commandes

| Main | Touche | Action | Note jouée |
|---|---|---|---|
| Gauche | `W` | Sauter par-dessus un bloc | Octave de la basse |
| Gauche | `S` | Glisser sous une barre | Fondamentale |
| Gauche | `S` tenu | Traverser un tunnel | Note tenue |
| Droite | `J` `K` `L` `;` | Tirer dans un couloir | Fondamentale, tierce, quinte, octave de l'accord en cours |
| — | `A` | Activer ou couper l'auto-play | |
| — | `Échap` | Pause | |

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
- Trois difficultés : Facile, Normal, Difficile.

## Pistes pour la suite

- Écrasement et double saut (`Espace`)
- Notes de passage entre les couloirs
- Calibrage de la latence audio
- Contrôles tactiles
- Univers, personnage et histoire
