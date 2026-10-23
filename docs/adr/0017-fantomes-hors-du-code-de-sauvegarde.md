# ADR-0017 : Garder les fantômes sur l'appareil, hors du code de sauvegarde

- **Statut** : Acceptée
- **Date** : 2026-10-23
- **Issues liées** : #32 ; touche #33
- **Artefact de décision** : https://claude.ai/artifact/1YeJua2EZuCQvuRqGTT7GH
- **Remplace** : un seul point de l'[ADR-0014](0014-sauvegarde-versionnee-et-code-de-sauvegarde.md), « le code de sauvegarde est le document entier » ; le reste de l'ADR-0014 tient

## Contexte

L'ADR-0014 range la progression dans un document JSON versionné, et fait du code de sauvegarde (`DM<version>.…`) ce document entier, encodé en base64url. Il prévoit que le fantôme du meilleur passage (#32) entre dans l'entrée de sa chanson, et qu'une forme compressée, sous un autre préfixe, prendra le relais si les codes deviennent trop longs.

Avec #32, l'entrée d'une chanson gagne `fantome` : la partie du record, au format d'enregistrement de la réécoute (#23), avec son score au début de chaque temps (`src/jeu/fantome.ts`). Mesuré sur les chansons générées, un fantôme pèse en JSON environ 10 ko en Débutant, 20 ko en Normal et 38 ko en Difficile ; une sauvegarde en garde jusqu'à 20 (`MAX_FANTOMES`). Le reste du document (carte, meilleurs scores, traces de #29, compositions de #28) pèse de quelques centaines d'octets à quelques kilo-octets. Avec les fantômes, le code passerait de moins d'un kilo-octet à un mégaoctet environ : ce ne serait plus un code qu'on copie et qu'on colle.

## Options considérées

### Option A : les fantômes restent sur l'appareil

Le code porte le document sans les fantômes ; ils restent dans le stockage du navigateur où ils ont été joués. Le code reste court et rien ne change pour le joueur qui le copie. En contrepartie, un fantôme ne passe pas de l'artefact au fichier local ou à GitHub Pages, ni d'un appareil à l'autre, et il disparaît avec les données du navigateur ; on le regagne en rejouant la chanson.

### Option B : les fantômes dans le code, tels quels

Le code reste le document entier. Il atteint environ 1 Mo avec vingt fantômes : impossible à copier, à coller ou à garder dans une note.

### Option C : la forme compressée prévue par l'ADR-0014

Les fantômes entrent dans un code compressé (deflate, `CompressionStream`), sous un nouveau préfixe (`DMZ…`). C'est le chemin prévu par l'ADR-0014, mais les codes restent de 3 à 6 ko par fantôme, jusqu'à 100 ko environ, et la copie comme le collage deviennent asynchrones.

### Option D : seulement le fantôme le plus récent dans le code

Un entre-deux : le code porte un seul fantôme, le dernier gardé. Il double ou triple la taille du code pour un fantôme choisi presque au hasard, et pose une règle de plus à expliquer.

## Décision

Option A : le code de sauvegarde porte le document sans ce qui est propre à l'appareil, c'est-à-dire aujourd'hui les fantômes.

- `pourLeCode` (`src/sauvegarde/format.ts`) donne le document du code : chaque entrée de chanson sans son `fantome`, le reste inchangé (meilleur score, traces, carte, compositions). `encoder` (`src/sauvegarde/code.ts`) l'utilise ; la forme du code (préfixe, version, base64url) ne change pas.
- Coller un code **fusionne** toujours (`fusionner`) et garde les fantômes d'ici. Un fantôme suit son meilleur score : si le score qui l'emporte vient d'un code, qui n'a jamais de fantôme, l'entrée garde le fantôme d'ici, qui reste le meilleur passage joué sur cet appareil.
- Le stockage du navigateur garde le document entier, fantômes compris ; leur nombre et leur départ quand la place manque suivent la règle écrite avec #32 dans l'ADR-0014 (« Ce qui reste hors du document »).
- Ce qui s'ajoutera plus tard au document et sera propre à l'appareil, ou trop lourd pour un code, suivra la même règle : `pourLeCode` le retire, et cet ADR le dit.

## Conséquences

- **Positives** : le code reste court (moins d'un kilo-octet sans compositions) et synchrone ; aucun nouveau préfixe ni format compressé à maintenir ; les codes déjà copiés restent valides.
- **Négatives** : le fantôme ne voyage pas entre l'artefact, le fichier local et GitHub Pages, ni d'un appareil à l'autre, et un navigateur vidé le perd ; le code n'est plus, à la lettre, le document entier.
- **À surveiller** : un partage de fantômes entre joueurs (#33) demanderait un format de fantôme à part, avec son propre code ou son propre fichier, et pas le code de sauvegarde. Si des joueurs réclament leurs fantômes d'un appareil à l'autre, revoir l'option C pour ce format à part plutôt que pour le code de sauvegarde.
