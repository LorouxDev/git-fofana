# 🗺️ Application de Cartographie Anyama

Application web de cartographie interactive pour la commune d'Anyama avec données GeoServer.

## 🚀 Démarrage Rapide

### Option 1 : Script Automatique (Recommandé)
```bash
# Windows
.\start_node.bat

# Linux/Mac
./start_node.sh
```

### Option 2 : Commandes Manuelles
```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer le serveur
npm start
```

## 🌐 Accès à l'Application

- **URL** : http://localhost:8000
- **Port** : 8000
- **Données** : GeoServer (http://localhost:8080)

## ✨ Fonctionnalités

- 🗺️ **Carte Interactive** : Affichage des parcelles d'Anyama
- 🔍 **Filtres Dynamiques** : Quartier, Ilot, Lot
- 📊 **Légende Interactive** : Nature des parcelles
- 🎨 **Thèmes** : Lot, Quartier, Ilot
- 📱 **Interface Responsive** : Compatible mobile/desktop
- 🔄 **Proxy CORS** : Contournement automatique des restrictions

## 📁 Structure du Projet

```
├── index.html          # Interface utilisateur
├── script.js           # Logique JavaScript
├── styles.css          # Styles CSS
├── server.js           # Serveur Node.js (proxy)
├── package.json        # Configuration npm
├── start_node.bat      # Script de démarrage Windows
├── start_node.sh       # Script de démarrage Linux/Mac
└── README.md           # Documentation
```

## 🔧 Configuration

### Prérequis
- Node.js (v14+)
- GeoServer (http://localhost:8080)
- Couche `parcelle_anyama` publiée

### Port
Modifiez la variable `PORT` dans `server.js` si nécessaire.

## 🆘 Dépannage

### Erreur "Module not found"
```bash
npm install
```

### Port déjà utilisé
Modifiez le port dans `server.js` ou arrêtez le processus.

### GeoServer inaccessible
L'application utilisera automatiquement les données de fallback.

## 📞 Support

En cas de problème, vérifiez :
1. Que Node.js est installé : `node --version`
2. Que GeoServer est accessible : http://localhost:8080
3. Les logs du serveur dans la console


