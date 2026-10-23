# ADR-0014 : Garder la progression dans un document versionné du navigateur, avec un code de sauvegarde à copier

- **Statut** : Acceptée
- **Date** : 2026-10-23
- **Issues liées** : #25 ; à suivre par #28, #29, #32, et peut-être #23
- **Artefact de décision** : https://claude.ai/artifact/DHPaMew5QGbfRt9tyNHYcB (question 2)

## Contexte

Plusieurs issues sauvegardent quelque chose d'une visite à l'autre : les lieux réussis de la carte du monde (#25), les tags d'une graine (#29), la meilleure partie par graine et difficulté (#32, au format d'enregistrement des coups de #23), les compositions (#28). #25 demande de décider une fois pour toutes.

Le jeu vit à trois endroits, qui ont trois origines différentes : la page d'artefact claude.ai, le fichier HTML ouvert d'un double-clic, et GitHub Pages (`julien-riel.github.io`, origine partagée par tous les projets du compte). Une sauvegarde faite sur l'un n'existe pas sur les deux autres. Partout, le stockage du navigateur peut manquer ou refuser (navigation privée, données effacées, aperçus de l'artefact), et le jeu doit rester jouable sans lui. Le lien d'artefact ne transmet à la page qu'une ancre simple : un code ne peut pas passer par l'adresse sur claude.ai, il faut un champ où le coller.

Ce qui était vrai avant cette décision :

- Les réglages sont dans le stockage du navigateur, une clé par réglage, en chaîne brute : `deux-mains-diff`, `-theme`, `-hands`, `-vitesse`, `-commandes`, `-decalage`, `-formes` (`ui/reglages.ts`, lus dans `main.ts`) et `-separation` (`ui/midi.ts`). Chaque accès est dans un `try/catch`. Il n'y a ni numéro de version, ni migration, ni format commun.
- Rien ne garde de progression.
- ADR-0005 : changer le générateur change les chansons. Ce qu'on range sur les notes d'une graine (tags, fantôme, meilleur score) ne vaut que pour une version du générateur.

## Options considérées

### Option 2A : un document versionné dans le stockage du navigateur

Une seule clé contient un document JSON avec un numéro de version. Un module pur valide, migre et répare le document ; un adaptateur mince lit et écrit le stockage dans un `try/catch`. Sans stockage, le jeu tourne avec une sauvegarde en mémoire. Simple, synchrone, sans compte, pareil aux trois endroits ; mais une sauvegarde effacée est perdue, et rien ne passe d'un endroit à l'autre.

### Option 2B : 2A, plus un code de sauvegarde à copier et à coller

Le même document, et un écran qui affiche un code texte (le document encodé, préfixé de sa version) à copier, avec un champ pour coller un code. Le joueur garde lui-même sa progression et la transporte entre l'artefact, le fichier et GitHub Pages, ou d'un appareil à l'autre. Le même encodage servira au partage des compositions (#28). Le joueur doit penser à copier son code.

### Option 2C : un dépôt à adaptateurs, dont la base de données de claude.ai

La sauvegarde passe par une interface asynchrone ; sur claude.ai, pour un joueur connecté, elle va dans la base de l'artefact, ailleurs dans le stockage du navigateur. Elle résiste au nettoyage du navigateur sur claude.ai, mais met du code propre à une plateforme dans le jeu, absent des deux autres endroits, et demande de déclarer des capacités à chaque publication.

### Option 2D : pas de stockage, tout dans un code

Le jeu ne garde rien ; il donne un code à la fin d'une chanson, que le joueur recolle à sa prochaine visite. Aucun souci de stockage, mais pénible au quotidien, et ne remplit pas « d'une visite à l'autre » sans effort (#25, #32).

## Décision

Option 2B : la progression est un document JSON versionné, rangé sous une seule clé du stockage du navigateur, et le joueur peut le copier et le coller sous la forme d'un code de sauvegarde.

### Où

- `src/sauvegarde/format.ts` : le document, sa lecture, sa réparation, ses migrations, et ce qu'on y note (`noterReussite`, `fusionner`). `src/sauvegarde/code.ts` : le code. Ce sont des modules purs : sous la règle ESLint des modules purs (ADR-0007), et sous le seuil de couverture de 90 % des lignes.
- `src/ui/stockage.ts` est le seul module qui lit ou écrit la sauvegarde dans le stockage. Tout accès y est dans un `try/catch`.
- `src/ui/progression.ts` charge la sauvegarde au démarrage, la note à la fin d'une chanson et gère le code ; `S.sauvegarde` garde le document du joueur, et `progression()` (`jeu/etat.ts`) donne celui qui compte en ce moment.

### Clé et document

La clé est `deux-mains-sauvegarde`. Le document de la version 1 :

```json
{
  "v": 1,
  "carte": { "ville": ["I–V–vi–IV", "Royal Road"], "boite": ["Vamp dorien"] },
  "chansons": { "g1:4242:normal": { "meilleur": 48210 } }
}
```

- `v` : un entier, la version du format (`VERSION`).
- `carte` : pour chaque univers (une clé de `THEMES`), les lieux réussis, par **nom de progression** (`PROGS[i].name`), dans l'ordre de leur réussite. Ces noms deviennent des identifiants de la sauvegarde : renommer une progression demande une migration.
- `chansons` : ce qui dépend des notes exactes d'une chanson, sous sa clé. Une chanson générée a la clé `g<VERSION_GENERATEUR>:<graine>:<difficulté>` (`cleChanson`) ; une chanson écrite à la main (#28) aura la clé `p:<empreinte de sa partition>`. En version 1, une entrée ne porte que `meilleur`, le meilleur score classé.

Ce qui viendra, chacun par sa migration : les tags d'une chanson (#29) et le fantôme du meilleur passage (#32, au format d'enregistrement de #23) dans l'entrée de la chanson ; les compositions (#28) dans un champ `compositions` à la racine.

### Versions et migrations

- Tout changement du format, même l'ajout d'un champ facultatif, augmente `VERSION` et ajoute une migration `MIGRATIONS[v]` qui fait passer un document de `v` à `v + 1`. Un document ancien passe par chaque migration jusqu'à la version du jeu. Augmenter la version même pour un ajout protège les données : un jeu plus ancien (un vieux fichier local, une page d'artefact pas encore rechargée) qui ne connaît pas le nouveau champ ne réécrira pas le document en le perdant.
- Un document d'une version plus récente que le jeu n'est jamais écrasé : le jeu en lit ce qu'il comprend, continue avec en mémoire, et n'écrit plus la clé (`STOCKAGE.etat = "lecture-seule"`).
- Un texte illisible (pas du JSON, pas d'entier `v`, migration manquante) est mis de côté sous `deux-mains-sauvegarde-illisible`, pas effacé ; le jeu repart d'un document vide. Un document lisible mais abîmé en partie garde ce qui a la bonne forme.

### Version du générateur

`VERSION_GENERATEUR` (`src/chanson/generateur.ts`) augmente à chaque changement voulu des chansons, c'est-à-dire à chaque régénération de l'instantané (ADR-0005). Ce qui dépend des notes exactes (meilleur score, tags, fantôme) est rangé sous une clé qui la contient, et le suivi d'une autre version est ignoré. La carte, liée aux progressions et pas aux notes, ne porte pas de version du générateur.

Un test (`tests/sauvegarde.test.ts`) relie la version à l'empreinte SHA-256 de `tests/instantanes/chansons.json` : si l'instantané change, le test échoue tant qu'on n'a pas augmenté `VERSION_GENERATEUR` et ajouté la nouvelle empreinte. Un instantané qui change sans que les chansons changent (des graines ajoutées) garde sa version : on ajoute sa nouvelle empreinte à la liste de la version en cours.

### Code de sauvegarde

- Forme : `DM` + la version du document + `.` + le JSON du document en UTF-8, encodé en base64url sans remplissage : `DM1.eyJ2IjoxLC…`. Pas de compression en version 1 : le document est petit. Si un code devient trop long, une forme compressée prendra un autre préfixe, sans casser les codes existants.
- Lecture : espaces et retours à la ligne ignorés ; la version du préfixe doit être celle du document ; un code d'une version plus ancienne est migré ; un code d'une version plus récente est refusé en disant pourquoi ; un code abîmé est refusé.
- Coller un code **fusionne** : les lieux réussis s'additionnent et chaque chanson garde le meilleur des deux scores (`fusionner`). Rien n'est perdu ; il n'y a pas de « remplacer ».
- Le même encodage servira au partage des partitions de #28, avec leur propre préfixe (`DMP`).
- L'écran « Code de sauvegarde » s'ouvre depuis la carte. Copier passe par le presse-papiers ; s'il refuse, le code reste affiché dans un champ à sélectionner.

### Robustesse

- Le jeu se joue sans stockage : la progression vit alors en mémoire, et l'écran du code prévient qu'il faut le copier.
- On écrit à la fin d'une chanson (`finish`), ou quand un code est collé, jamais à chaque image.
- Une chanson compte si elle est finie avec un score classé : ni auto-play, ni une seule main, ni ralenti, ni boucle (`S.autoUsed` faux, pas de boucle).
- Les essais ne lisent ni n'écrivent la sauvegarde du joueur. Un essai peut porter une progression fictive (`Essai.progression`), copiée en mémoire à son ouverture : la carte, le décor et le code de l'essai l'utilisent, et ce qu'il gagne s'y ajoute sans jamais atteindre le stockage.

### Ce qui reste hors du document

- Les réglages gardent leurs clés actuelles (`deux-mains-diff`, `-theme`, `-hands`, `-vitesse`, `-commandes`, `-decalage`, `-formes`, `-separation`) et ne voyagent pas dans le code : le décalage, les commandes et la séparation MIDI dépendent de l'appareil.
- Le ressort gagné entre deux souvenirs (#27) n'est pas sauvegardé.
- Quand le stockage sera plein (fantômes de #32), les fantômes les plus anciens partiront d'abord ; la règle s'écrira avec #32.

## Conséquences

- **Positives** : un seul format pour toutes les fonctionnalités qui gardent quelque chose, testé sans navigateur ; une issue de secours quand le stockage est vidé ; un passage entre les trois endroits et entre appareils, sans compte ni réseau ; un encodage commun avec les partitions partagées.
- **Négatives** : le joueur doit penser à copier son code ; chaque changement de format demande une migration et une version ; les noms de progression deviennent des identifiants qu'on ne renomme plus librement ; régénérer l'instantané oblige à augmenter `VERSION_GENERATEUR`, ce qui fait oublier les meilleurs scores.
- **À surveiller** : si l'artefact devient l'endroit principal où l'on joue et que des joueurs perdent leur progression, ajouter l'adaptateur claude.ai de l'option 2C derrière `ui/stockage.ts` ; le format et ces règles ne changent pas. Si les codes deviennent trop longs (fantômes, compositions), ajouter la forme compressée.
