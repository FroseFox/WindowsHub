# Mettre le Hub sur GitHub et obtenir le .exe

GitHub va construire l'installateur `Hub-Setup-x.y.z.exe` tout seul, sur ses serveurs Windows.
Tu n'as rien à installer pour ça (pas besoin de Node.js sur ton PC).

---

## Méthode 1 : avec GitHub Desktop (la plus simple, sans ligne de commande)

### 1. Préparer
1. Dézippe `hub-pilule.zip` (par ex. dans `Documents\hub-pilule`).
   Supprime le dossier `node_modules` s'il existe (il est énorme et inutile sur GitHub).
2. Installe **GitHub Desktop** : https://desktop.github.com puis connecte-toi avec ton compte GitHub.

### 2. Créer le dépôt
1. GitHub Desktop → **File → Add local repository…** → choisis le dossier `hub-pilule`.
2. Il dit que ce n'est pas encore un dépôt → clique **create a repository** → **Create repository**.
3. En haut, clique **Publish repository**.
   - Nom : `hub-pilule`
   - Décoche « Keep this code private » si tu veux qu'il soit public (au choix, les deux marchent).
   - **Publish repository**.

### 3. Lancer la construction du .exe
1. Va sur ton dépôt sur github.com (GitHub Desktop → **Repository → View on GitHub**).
2. Onglet **Releases** (colonne de droite) → **Create a new release**.
3. **Choose a tag** → tape `v1.0.0` → **Create new tag: v1.0.0 on publish**.
4. Titre : `Hub 1.0.0` → **Publish release**.
5. Onglet **Actions** : la construction « Construire le .exe » démarre (≈ 5 minutes, rond orange puis coche verte).
6. Retourne dans **Releases** → `v1.0.0` : le fichier **`Hub-Setup-1.0.0.exe`** est dans « Assets ». Télécharge-le.

---

## Méthode 2 : en ligne de commande (si tu as Git)

Dans le dossier `hub-pilule` :

```
git init
git add .
git commit -m "Hub 1.0.0"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/hub-pilule.git
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```

(Crée d'abord le dépôt vide `hub-pilule` sur github.com → **New repository**, sans README.)
Ensuite : onglet **Actions** → attendre la coche verte → **Releases** → `Hub-Setup-1.0.0.exe`.

---

## Juste tester, sans créer de version
Onglet **Actions** → **Construire le .exe** (à gauche) → **Run workflow** → **Run workflow**.
Quand c'est fini, clique sur le run → en bas, « Artifacts » → **Hub-Setup** (un .zip qui contient le .exe).

---

## Installer le .exe
1. Double-clic sur `Hub-Setup-1.0.0.exe`.
2. Si Windows affiche **« Windows a protégé votre ordinateur »** (normal : l'appli n'est pas signée) :
   **Informations complémentaires** → **Exécuter quand même**.
3. Le hub s'installe et se lance. Il est dans le menu Démarrer (« Hub ») et se désinstalle depuis
   Paramètres Windows → Applications.
4. Clic droit sur l'icône du hub près de l'horloge → **Lancer au démarrage de Windows**.

Tes réglages (applis, couleurs, agenda…) sont gardés : la version installée lit les mêmes réglages que `npm start`.

---

## Publier une nouvelle version plus tard
> Depuis la 1.3.0, si ton dépôt est **public**, tu n'as plus besoin de télécharger le .exe : le hub voit la nouvelle
> Release tout seul et te propose de l'installer d'un clic. (Dépôt → Settings → tout en bas → Change visibility → Make public.)
> Le nom du tag doit commencer par un chiffre ou un v : `v1.3.1` ou `1.3.1`.

1. Remplace les fichiers modifiés dans le dossier (par ex. le dossier `src`).
2. GitHub Desktop : écris un résumé en bas à gauche → **Commit to main** → **Push origin**.
3. Sur github.com → **Releases** → **Draft a new release** → nouveau tag (`v1.0.1`, `v1.1.0`…) → **Publish release**.
4. Quelques minutes plus tard : `Hub-Setup-1.0.1.exe` dans la release. Lance-le : il remplace l'ancienne version.

## Si la construction échoue
Onglet **Actions** → clique sur le run en rouge → ouvre l'étape en erreur et copie le message pour qu'on regarde.
