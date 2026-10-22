# ADR-0009 : Dérouler les boucles dans le temps de la partie

- **Statut** : Acceptée
- **Date** : 2026-10-22
- **Issues liées** : #5
- **Artefact de décision** : https://claude.ai/artifact/DtyL2KgHJAZV81Z6GNag38

## Contexte

L'issue #5 fait rejouer une section en boucle, sans coupure de la musique. Une seule horloge donne la position dans la chanson (ADR-0004), mais trois consommateurs la lisent à des moments différents : le séquenceur programme les sons 120 ms en avance (`timeOfBeat`), le son sort après la latence de sortie, et l'image et le jugement suivent le son entendu, corrigé du décalage du joueur (`songNow`, jusqu'à ±300 ms). L'écran montre les notes 6 temps à l'avance et les garde 3 temps après la ligne de tir. Les sections font 2, 4 ou 8 mesures.

La reprise après une mort (`resumeCP`) arrête tout et repart une mesure avant la section : elle coupe la musique. L'issue proposait de « recaler le temps » à la fin de la section en s'en inspirant. Les futures boucles sur des mesures précises s'appuieront sur le mécanisme choisi ici.

## Options considérées

### Option A : recaler l'horloge à la fin de la section

On recule l'horloge d'une section (`S.startBeat -= L`) et on remet les notes de la section à jouer. Il n'y a pas d'instant juste pour le faire : le séquenceur atteint la fin avant le son, et le son avant l'image. Recaler trop tôt fait perdre les dernières notes du passage, recaler trop tard demande au séquenceur une horloge à lui. Les premières notes du passage suivant n'existent pas avant le saut : elles apparaîtraient sur la ligne de tir, sans anticipation.

### Option B : dérouler la boucle dans le temps de la partie

L'horloge ne recule jamais. Le passage _k_ occupe les temps `début + k·L` à `début + (k+1)·L` de la partie. Une fonction convertit la mesure de la partie en mesure de la chanson ; les notes de chaque passage sont des copies de celles de la section, décalées de _k·L_ et créées un passage à l'avance. Le séquenceur, le jugement, l'auto-play et le dessin voient arriver le passage suivant comme une suite ordinaire de la chanson.

### Option C : fabriquer une chanson déroulée au départ

On construit au départ une chanson qui répète la section un grand nombre de fois, et on la joue comme une autre. Peu de code touché, mais la boucle est finie, la partie parcourt des milliers de notes, et deux « chansons » circulent dont une n'est pas celle de la graine.

## Décision

Option B. Une boucle est un déroulement du temps de la partie :

- **Le temps de la partie ne recule jamais** : il se lit sur l'horloge audio comme le veut ADR-0004, en boucle comme hors boucle. Seule une reprise après une mort ou un nouveau départ redémarre l'horloge.
- **Une seule conversion** passe de la mesure de la partie à la mesure de la chanson (`mesureDeLaChanson` dans `jeu/etat.ts`) : hors boucle c'est la même mesure, en boucle elle revient au début de la section. On ne lit jamais `song.chords[bar]` ni `song.sections` avec une mesure de la partie sans passer par elle (`sectionAtBar`, `chordAtBar`, `chordAtBeat`).
- **Les notes jugées sont celles de la partie** (`S.ev`), pas celles de la chanson (`S.song.ev`). Hors boucle ce sont les mêmes ; en boucle, ce sont les copies des passages, chacune marquée de son numéro de passage. Le passage suivant existe toujours avant que ses notes n'entrent à l'écran, et les passages terminés depuis plus d'un passage sont retirés.
- La chanson générée (`S.song`) ne change pas pendant une boucle : la frise de forme l'affiche telle quelle.

## Conséquences

- **Positives** : le point de boucle n'est pas un cas particulier, la musique ne s'interrompt pas, les notes du passage suivant se voient à l'avance même pour une section de 2 mesures, la boucle n'a pas de fin et garde une mémoire constante. Une boucle sur des mesures précises réutilisera le même mécanisme.
- **Négatives** : deux notions de temps à ne pas confondre. Le code qui lit les accords, les sections ou les notes doit passer par la conversion et par `S.ev`.
- **À surveiller** : une lecture directe de `S.song.chords[bar]` ou de `S.song.ev` pendant la partie, qui donnerait un accord ou une note faux en boucle.
