const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.static('.'));

// Route pour servir les fichiers statiques
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route pour servir les données GeoJSON
app.get('/data.json', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    } catch (error) {
        console.error('Erreur lors de la lecture de data.json:', error);
        res.status(500).json({ error: 'Impossible de charger les données' });
    }
});
    
// Route pour servir les données résidentielles
app.get('/residentiel.geojson', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'residentiel.geojson'), 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    } catch (error) {
        console.error('Erreur lors de la lecture de residentiel.geojson:', error);
        res.status(500).json({ error: 'Impossible de charger les données résidentielles' });
    }
});

// Route pour proxifier les requêtes GeoServer
app.get('/geoserver/*', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const geoserverUrl = `http://localhost:8080${req.originalUrl}`;
        
        console.log(`Proxification de la requête vers: ${geoserverUrl}`);
        
        const response = await fetch(geoserverUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur GeoServer: ${response.status}`);
        }
        
        const data = await response.text();
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
        
    } catch (error) {
        console.error('Erreur de connexion à GeoServer:', error);
        
        // Fallback vers data.json
        try {
            const data = fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.send(data);
        } catch (fallbackError) {
            res.status(500).json({ error: 'Impossible de charger les données' });
        }
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur Node.js démarré sur http://localhost:${PORT}`);
    console.log(`📁 Fichiers statiques servis depuis: ${__dirname}`);
    console.log(`🗺️  Application de cartographie Anyama disponible`);
    console.log(`\n📋 Instructions:`);
    console.log(`   1. Ouvrez http://localhost:${PORT} dans votre navigateur`);
    console.log(`   2. Les données GeoJSON sont automatiquement chargées`);
    console.log(`   3. Appuyez sur Ctrl+C pour arrêter le serveur`);
    console.log(`\n✨ Fonctionnalités:`);
    console.log(`   ✅ Contournement CORS`);
    console.log(`   ✅ Proxy GeoServer`);
    console.log(`   ✅ Fallback automatique`);
    console.log(`   ✅ Données résidentielles`);
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
    console.error('Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non gérée:', reason);
});

var map = L.map('map').setView([5.4946, -4.0511], 15);
// ajouter openstreetmap comme fond de carte
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
// url de la couche geoserver pour les parcelles
var parcellesUrl = 'http://localhost:8080/geoserver/Projet_Rokia/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Projet_Rokia%3Aparcelle_anyama&maxFeatures=50&outputFormat=application%2Fjson';
// charger les parcelles
var parcelles = [];
fetch(parcellesUrl)
    .then(response => response.json())
    .then(data => {
        parcelles = data.features;
    });


