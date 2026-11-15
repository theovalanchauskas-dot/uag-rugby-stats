# 🏉 UAG Rugby Gaillac - Application de Statistiques de Match en Direct

Application officielle pour le staff et les **joueuses blessées de l'UAG Rugby Gaillac (Section Féminine)** permettant de saisir et suivre les statistiques de match en direct, synchronisées instantanément sur tous les smartphones et ordinateurs.

---

## 🔴⚫ Identité Visuelle & Couleurs UAG
- **Couleurs officielles :** Rouge Gaillac (`#D90429`), Noir Carbone (`#0C0D10`), Or Gaillac (`#FFB703`)
- **Blason & Symboles :** Écusson officiel intégrant le **Coq Gaillacois** (*Gallus*), le ballon de rugby, le sigle **U.A.G.**, la grappe de raisin du vignoble millénaire de Gaillac et la date de fondation **1901**.

---

## 📋 Catégories issues de votre Note iPhone
L'application intègre rigoureusement toutes les catégories visibles sur votre capture d'écran, organisées par phase de jeu :
1. **Défense** :
   - **Plaquage réussi** (Défense +)
   - **Plaquage manqué** (Défense -)
   - **Grattage** (Ballon récupéré au sol dans le ruck)
2. **Attaque & Rucks** :
   - **Action offensive** (Percées, courses ballon en main, franchissements)
   - **Perte de balle** (Turnovers concédés, en-avants)
   - **Ruck inefficace** (Soutien en retard, ballon perdu au sol)
3. **Score** :
   - **Essai marqué** (Incrémente automatiquement le score du match de +5 !)
4. **Conquête & Touches** :
   - **Lancer réussi** (Lancers en touche captés - spécifique talonneuse N°2)
   - **Lancer manqué** (Lancers en touche perdus ou pas droits)
5. **Discipline & Fautes** :
   - **Pénalité** (Fautes concédées)
   - **Cartons** (⚪ Blanc 10mn, 🟡 Jaune 10mn, 🔴 Rouge expulsion)
6. **Temps de jeu** :
   - **Temps de jeu effectif** (Touches rapides +5', +10', -5')

---

## 🚀 Comment lancer l'application

### En un seul clic (Recommandé)
Double-cliquez sur le fichier ou lancez dans le terminal :
```bash
./start.sh
```
L'application s'ouvre automatiquement dans votre navigateur !

- Sur votre Mac : [http://localhost:8080](http://localhost:8080)
- Sur les smartphones des blessées : l'adresse locale affichée dans le terminal (ex: `http://192.168.1.160:8080`)

---

## 📱 Comment connecter les joueuses blessées sur la touche ?
1. Cliquez sur le bouton **📲 (Partager)** en haut à droite de l'application.
2. Un **QR Code** s'affiche à l'écran.
3. Les joueuses blessées scannent le QR Code avec l'appareil photo de leur iPhone ou Android (sur le même Wi-Fi ou partage 4G du Mac).
4. Elles accèdent immédiatement à l'interface de saisie tactile, sans rien installer !

---

## 📱 Optimisation Mobile-First (Conçue pour Téléphone au Bord du Terrain)

L'application a été entièrement repensée pour une utilisation **exclusive ou prioritaire sur smartphone** (iPhone et Android) :

1. **Barre de Navigation au Pouce (Bottom Tab Bar)** :
   - Onglets situés en bas de l'écran (comme sur Instagram ou les applications iOS natives) pour un accès facile à une seule main : 🏉 **Saisie**, 📊 **Équipe**, ⚡ **Direct**, 📝 **Note**, ⚙️ **Match**.
2. **Mode Écran Allumé (Anti-Veille 💡)** :
   - Empêche automatiquement le téléphone de se mettre en veille pendant le match via l'API Screen Wake Lock (fini le téléphone qui s'éteint toutes les 30 secondes au bord du terrain).
3. **Carrousel Horizontal de Joueuses (1-Tap)** :
   - Bandeau tactile fluide en haut de l'écran pour basculer instantanément entre joueuses (`#2 Nono`, `#1 Léa`, `#8 Camille`...) d'un simple coup de doigt.
4. **Cibles Tactiles Élargies & Retours Haptiques** :
   - Boutons `+` et `−` géants (min 48px), contrastes renforcés pour la lumière du soleil, et vibrations haptiques distinctes (+, −, essai, carton).
5. **Mode d'Affichage Commutable (📱 Cartes vs ⚡ Grille Rapide)** :
   - **Mode Cartes** : grandes touches tactiles très confortables.
   - **Mode Grille 2 Colonnes** : affiche 6 à 8 actions sans aucun scroll sur l'écran !
6. **Vue Fiches Mobiles pour l'Équipe** :
   - Dans l'onglet Équipe, basculez en un clic entre la **Vue Fiches** (fiches synthétiques optimisées smartphone avec jauge de plaquages) et le **Grand Tableau**.
7. **Partage Mobile Natif & WhatsApp** :
   - Bouton **WhatsApp** direct et bouton **Partager** (Web Share API) ouvrant la feuille de partage native iOS/Android pour envoyer la note en 1 seconde aux coachs.
8. **Installation PWA (Comme une vraie application)** :
   - Sur iPhone (Safari) : tapez sur le bouton Partager ➔ **« Sur l'écran d'accueil »**.
   - Sur Android (Chrome) : tapez sur le menu ➔ **« Installer l'application »**.
   - L'application s'ouvre alors en plein écran sans barre d'adresse !

---

## ✨ Optimisations & Nouveautés ergonomiques

### 1. Sélection Joueuse Ultra-Rapide (Carrousel 1-Clic)
- Bandeau carrousel horizontal tactile avec les pastilles de toutes les joueuses (`#2 Nono`, `#1 Léa`, `#8 Camille`, `#10 Sarah`, `#14 Chloé`...).
- Passer d'une joueuse à l'autre en **1 seul tap**, sans ouvrir de menu déroulant.

### 2. Filtres Rapides par Phase de Jeu
- Boutons-filtres : `[🔥 Tout voir]` `[🛡️ Défense]` `[⚡ Attaque]` `[🏉 Score]` `[🎯 Touche]` `[🚩 Fautes]`.
- Réduit la fatigue visuelle et le défilement sur le terrain : une blessée chargée de noter la défense peut n'afficher que les plaquages !

### 3. Notification Toast & Bouton "Annuler" Instantané
- À chaque action enregistrée, un bandeau flottant apparaît : `✅ Nono : +1 Plaquage réussi [↩️ Annuler]`.
- En cas de missclick dans le feu de l'action, un clic sur **Annuler** corrige immédiatement l'erreur.
- La barre d'annulation persistante en bas de l'écran reste également disponible.

### 4. Gestion Authentique des Cartons Rugby (FFR)
- Choix dédié :
  - ⚪ **Carton Blanc** (10 mn pour faute répétée / technique)
  - 🟡 **Carton Jaune** (10 mn pour antijeu / faute grave)
  - 🔴 **Carton Rouge** (Expulsion définitive)

### 5. Ajustement Rapide du Score Rugby
- Cliquez sur le score en haut pour ouvrir le pavé numérique rugby :
  - **+5** (Essai)
  - **+2** (Transformation)
  - **+3** (Pénalité / Drop)
  - **−1** (Correction)

### 6. Tableau de Bord Staff Dynamique (Onglet Équipe)
- Première colonne figée (Nom & N° de la joueuse restent visibles en faisant défiler l'écran sur mobile).
- Filtres de poste : `[Toutes]` `[Avants (1 à 8)]` `[Trois-quarts (9 à 15)]` `[Remplaçantes]`.
- En-têtes cliquables pour trier par n'importe quelle statistique (meilleure plaqueuse, joueuse la plus efficace, essais...).
- Export Excel / CSV en 1 clic.

### 7. Guide Rapide Intégré (Bouton ❓)
- Modale visuelle claire en 4 étapes pour expliquer le fonctionnement aux nouvelles blessées en 30 secondes au bord du terrain.

### 8. Effectif Type UAG en 1 Clic
- Dans l'onglet **Gestion**, un bouton permet de pré-remplir les 15 postes officiels de départ de l'équipe féminine de l'UAG Gaillac.
