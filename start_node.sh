#!/bin/bash

echo "========================================"
echo "  DEMARRAGE DU SERVEUR NODE.JS"
echo "========================================"
echo ""
echo "Installation des dépendances..."
npm install
echo ""
echo "Démarrage du serveur..."
echo ""
echo "Le serveur va démarrer sur http://localhost:8000"
echo "Ouvrez cette URL dans votre navigateur"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

node server.js

