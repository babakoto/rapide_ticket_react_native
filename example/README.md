# Exemple d'intégration — rapide_ticket_rn

Cette application React Native + Expo est un projet d'exemple et de débogage rapide pour la bibliothèque `rapide-ticket` (`rapide_ticket_rn`). Elle est directement inspirée de l'application `test_rapide_ticket`.

---

## 🛠️ Prérequis

Le package `rapide-ticket` utilise des dépendances natives (comme `react-native-view-shot`, `react-native-sensors`, etc.). Il **ne peut pas** être exécuté directement dans Expo Go. Vous devez utiliser des builds de développement locaux.

### Configuration recommandée

| Outil | Version recommandée |
|---|---|
| Node | ≥ 18 |
| Xcode (macOS) | ≥ 15 |
| CocoaPods | ≥ 1.14 |
| Ruby | ≥ 3.0 |

---

## 📦 Cycle de Test & Développement Rapide

Pour tester vos modifications apportées à la bibliothèque dans le dossier parent `rapide_ticket_rn` :

### 1. Builder et packager la bibliothèque (Racine de la lib)

Depuis la racine du package `/packages/rapide_ticket_rn` (dossier parent) :

```bash
# Compile le TypeScript et génère l'archive rapide-ticket-1.0.3.tgz
npm run pack-local
```

### 2. Mettre à jour l'application exemple

Depuis ce dossier `/packages/rapide_ticket_rn/example` :

```bash
# Installation initiale ou forcer la mise à jour depuis l'archive locale (.tgz)
npm install
```

Si le package a déjà été installé et que vous venez de générer une nouvelle archive `.tgz`, forcez la réinstallation avec :

```bash
npm install ../rapide-ticket-*.tgz --legacy-peer-deps
```

---

## 🚀 Exécution de l'application

Depuis ce dossier `example` :

### iOS

```bash
npx expo run:ios                # Première compilation (génère /ios et exécute pod install)
npx expo run:ios --no-install    # Relances rapides (évite la réinstallation des pods)
```

### Android

```bash
npx expo run:android
```

### Nettoyage de cache (Recommandé en cas de problème de cache Metro)

Si vos modifications de code dans la bibliothèque ne semblent pas se refléter dans l'application, relancez Metro en vidant son cache :

```bash
npx expo start -c
```

---

## 🐛 Fonctionnalités configurées pour le test

- **Déclenchement automatique par Shake** : Secouez l'appareil pour déclencher l'ouverture.
- **Déclenchement par Taps répétés** : Tapez **5 fois** rapidement sur l'écran.
- **Déclenchement manuel** : Via le bouton principal *"Signaler un problème"*.
- **Enregistrement vidéo d'écran (GIF)** : Prise en charge de l'enregistrement de l'écran lors du bug.
- **Deep Linking OAuth** : Intégration de test pour l'authentification avec Jira via Deep Linking.
