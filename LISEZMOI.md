# Hub — pilule + panneau Contrôles (Windows 11)

Une petite pilule collée en haut au centre de l'écran. Elle affiche la musique en cours (ou l'heure si rien ne joue).
**Clique dessus** : elle s'ouvre en panneau avec l'onglet **Contrôles**. Le panneau se referme quand la souris s'en va.

## Ce qui marche
- **Wi-Fi / Bluetooth** : clic = activer/désactiver
- **Flèche › sur Wi-Fi** : liste des réseaux, connexion (avec mot de passe si besoin), déconnexion
- **Flèche › sur Bluetooth** : appareils associés ; clic sur un casque/une enceinte = connecter ou déconnecter
- **Son** : clic = muet, molette = volume ; **flèche ›** = choisir la sortie audio (casque, enceinte, écran…)
- **Barre de volume** : glisser ou molette
- **Mode sombre** : bascule le thème clair/sombre de Windows
- **Éclairage nocturne** : bascule (méthode non officielle ; si Windows ne suit pas, le réglage Windows s'ouvre)
- **Lecteur** : Spotify, YouTube dans le navigateur, etc. Pochette, titre, précédent / lecture / suivant,
  barre ondulée cliquable pour avancer dans le morceau. Les couleurs s'adaptent à la pochette.
- Quand le morceau change, la pilule s'agrandit 4 secondes pour l'afficher.
- **Ctrl + Alt + Espace** ouvre/ferme le panneau.
- **Mode jeu** : quand un **jeu** est au premier plan (pas Chrome, Discord… même en plein écran), la pilule laisse passer
  les clics. Elle redevient cliquable seulement si tu es dans un menu : souris visible posée dessus, ou souris
  immobile 1 seconde dessus. Quand tu vises vers le haut (curseur caché collé au bord de l'écran), elle reste verrouillée,
  donc un tir ne peut pas l'ouvrir. Ctrl + Alt + Espace marche toujours.
  Les jeux sont reconnus grâce à la liste de Windows (Game Bar), aux dossiers Steam / Riot / Epic / Xbox / EA / Ubisoft / GOG, et au plein écran exclusif.
  Si un programme est mal reconnu : clic droit sur l'icône du hub → « nom.exe » → « C'est un jeu » / « Ce n'est pas un jeu ».
  Le mode jeu se désactive aussi depuis ce menu.
- Pochette : si l'appli (ex. Deezer) ne la donne pas à Windows, le hub la cherche sur Deezer.
- **La pilule** affiche aussi, à côté de la musique ou de l'heure : le **prochain événement** Google Agenda
  (« dans 12 min · Scrim », en couleur quand c'est bientôt) et le **minuteur / chrono** en cours.
- **Notifications** : celles de Windows (Discord, mails…) s'affichent quelques secondes dans la pilule, plus un **rappel 10 min avant**
  chaque événement d'agenda et une alerte (avec son) quand le minuteur se termine. Survole une notification pour la garder, clique pour la fermer.
  Windows doit autoriser l'accès : Paramètres Windows → Confidentialité et sécurité → Notifications.
- **Position** (⚙ Paramètres → Pilule → Position) : **en haut** (par défaut), ou **dans la barre des tâches**, à gauche ou à droite.
  Dans la barre des tâches, aucune fenêtre ne passe dessous (Windows réserve déjà cette zone) et le panneau s'ouvre vers le haut.
  Le curseur « Décalage » règle la distance depuis le bord pour la caler dans un espace libre.
- **Plusieurs écrans** : la pilule va sur l'écran principal, sur un écran choisi, ou suit la souris (⚙ Paramètres → Écran).
- Icône près de l'horloge Windows : clic droit → lancer au démarrage, recharger, **ouvrir le journal** (`hub.log`, utile si quelque chose ne marche pas), quitter.

## Les onglets
La barre d'onglets est en icônes : l'onglet actif affiche son nom, et un indicateur glisse de l'un à l'autre.
- **Aujourd'hui** : grande horloge, météo (ville détectée automatiquement, clique dessus pour la changer), prévisions sur 5 jours,
  calendrier (‹ › pour changer de mois, clic sur un jour = ses événements), **Agenda / Notes** à droite.
  Avec Google Agenda connecté (⚙ Paramètres) : points sous les jours qui ont des événements, liste du jour, clic sur un événement = l'ouvrir dans Google Agenda, **+** = créer un événement ce jour-là.
- **Stats** : processeur, mémoire, carte graphique, disque C:, débit réseau (avec courbes), temps allumé ou batterie.
- **Presse-papier** : historique de ce que tu copies (texte et images). Clic = recopier, épingle = garder, recherche, pause.
  Si la liste reste vide, une petite ligne en dessous dit ce qui bloque (aucune copie détectée, ou l'erreur de Windows).
- **Valorant** : ton rang (avec l'icône) et tes RR, combien de RR gagnés ou perdus aujourd'hui, et tes 10 derniers matchs classés
  (map, ± RR). Clic sur un match = il s'ouvre sur tracker.gg ; bouton « tracker.gg » = ton profil.
  Il faut une clé API gratuite HenrikDev (expliqué dans l'onglet). Ton Riot ID est détecté tout seul si le client Riot est ouvert.
- **Apps** : seulement les applis que tu ajoutes. « Ajouter » → cherche une appli installée ou « Fichier… » pour un .exe / raccourci (jeux hors menu Démarrer). Survol → ✕ pour retirer, glisser-déposer pour réorganiser, recherche + Entrée pour lancer.
- **Fond d'écran** : les images d'un dossier (Images par défaut, « Changer de dossier » pour choisir), clic = appliquer, « Au hasard ».
- **Minuteur** : minuteur (1 à 60 min, ajustable) avec anneau de progression, et chrono avec tours (meilleur / pire tour en couleur).
  Le temps restant s'affiche aussi dans la pilule.
- **Énergie** : verrouiller, veille, déconnexion, redémarrer, éteindre (les trois derniers demandent un 2e clic pour confirmer).
- **⚙ Paramètres** : couleur d'accent (8 au choix + perso), fond du panneau, opacité, ouverture au clic ou au survol,
  aperçu musique, appli de musique (bouton « Ouvrir » quand rien ne joue), onglets affichés, Google Agenda, mode jeu,
  lancement au démarrage, ville météo, taille de l'historique du presse-papier.
- Astuce : la molette sur la barre d'onglets passe d'un onglet à l'autre.

## Léger sur les ressources
- Un seul PowerShell permanent qui **prévient** quand quelque chose change (musique, Wi-Fi, volume, presse-papier…) au lieu d'être interrogé en boucle. Un second est lancé seulement pour les listes / stats / applis, et s'arrête après 1 minute sans servir.
- En jeu (plein écran), les vérifications ralentissent fortement et les animations s'arrêtent.
- Pas d'utilisation de la carte graphique (rien ne vient gêner tes jeux).
- Le code Windows est compilé une seule fois puis gardé en cache : démarrage rapide.
- Pochettes, météo et icônes sont gardées sur le disque : affichage immédiat.

## Installer et lancer
1. Installe **Node.js** (version LTS) : https://nodejs.org
2. Dézippe le dossier, ouvre un terminal dedans (clic droit dans le dossier → « Ouvrir dans le terminal »)
3. `npm install` (une seule fois, ça télécharge Electron)
4. `npm start`

Pour le lancer sans fenêtre de terminal : double-clic sur **lancer.vbs**.

Pour fabriquer l'installateur sur ton PC : `npm run dist` → `dist/Hub-Setup-x.y.z.exe`.

## Le .exe construit automatiquement par GitHub
👉 **Guide pas à pas (avec ou sans ligne de commande) : voir `GITHUB.md`.**

Le fichier `.github/workflows/build.yml` fait construire l'installateur par GitHub (sur un Windows de leurs serveurs).
1. Crée un dépôt sur GitHub (par ex. `hub-pilule`) et envoie-y le dossier (sans `node_modules`, déjà ignoré par `.gitignore`).
2. Pour publier une version : crée un tag qui commence par `v`, par ex. :
   `git tag v1.0.0` puis `git push origin v1.0.0`
3. Va dans l'onglet **Actions** du dépôt : la construction prend quelques minutes.
4. Le fichier `Hub-Setup-1.0.0.exe` apparaît dans **Releases**. Double-clic → le hub s'installe (menu Démarrer, désinstallable
   depuis les Paramètres Windows) et « Lancer au démarrage » fonctionne directement.
Sans tag, tu peux aussi lancer la construction à la main : Actions → « Construire le .exe » → **Run workflow** (le .exe est alors en pièce jointe du run).
Windows peut afficher « Windows a protégé votre ordinateur » au premier lancement (appli non signée) : « Informations complémentaires » → « Exécuter quand même ».

## Les fichiers
- `src/main.js` — la fenêtre transparente, l'icône, les raccourcis
- `src/features.js` — météo, stats, presse-papier, applis, fonds d'écran, énergie
- `src/ps/` — les scripts PowerShell qui parlent à Windows (radios, volume, thème, média)
- `src/renderer/` — l'interface (HTML / CSS / JS) : c'est là pour changer le look (`tabs.js` = les onglets)

Wi-Fi : Windows ne montre la liste des réseaux qu'aux applis autorisées à utiliser la localisation.
Si le hub te le demande, active « Paramètres → Confidentialité → Localisation → Autoriser les applications de bureau ».

Astuce : ouvrir `src/renderer/index.html` directement dans un navigateur affiche l'interface en mode démo.
