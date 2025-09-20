// Configuration de la carte
let map;
let allParcelles = [];
let filteredParcelles = [];
let parcelleLayer;
let quartierLayer;

// Coordonnées UTM pour Anyama (Zone 30N)
const UTM_ZONE = 30;
const UTM_FALSE_EASTING = 500000;
const UTM_FALSE_NORTHING = 0;

// Conversion UTM vers Lat/Lng (approximation simple)
function utmToLatLngSimple(easting, northing) {
    // Coordonnées de référence d'Anyama, Côte d'Ivoire
    const ANYAMA_LAT = 5.4958; // Latitude d'Anyama
    const ANYAMA_LNG = -4.0519; // Longitude d'Anyama
    
    // Coordonnées moyennes de vos données UTM
    const AVG_EASTING = 385000;
    const AVG_NORTHING = 610000;
    
    // Facteur d'échelle pour ajuster la taille des parcelles
    const SCALE_FACTOR = 0.00001;
    
    // Conversion simple : décalage par rapport à Anyama
    const lat = ANYAMA_LAT + (easting - AVG_EASTING) * SCALE_FACTOR;
    const lng = ANYAMA_LNG + (northing - AVG_NORTHING) * SCALE_FACTOR;
    
    return {
        lat: lat,
        lng: lng
    };
}

// Conversion de géométrie UTM vers Lat/Lng
function convertGeometry(geometry) {
    if (!geometry || !geometry.coordinates) return geometry;
    
    if (geometry.type === 'MultiPolygon') {
        return {
            ...geometry,
            coordinates: geometry.coordinates.map(polygon => 
                polygon.map(ring => 
                    ring.map(coord => {
                        if (coord.length >= 2) {
                            const converted = utmToLatLngSimple(coord[0], coord[1]);
                            return [converted.lng, converted.lat];
                        }
                        return coord;
                    })
                )
            )
        };
    }
    
    return geometry;
}

// Initialisation de la carte
function initMap() {
    // Créer la carte
    map = L.map('map', {
        center: [5.4944, -4.0519], 
        zoom: 19,
        zoomControl: false
    });

    // Ajouter la couche de tuiles
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //     attribution: '© OpenStreetMap contributors',
    //     maxZoom: 19
    // }).addTo(map);

    // Initialiser les contrôles personnalisés
    initMapControls();
    initCollapsibleControls();
    
    // Charger les données
    loadParcellesData();
}

// Chargement des données des parcelles
async function loadParcellesData() {
    try {
        showLoading(true);
        
        // Charger via le serveur Node.js (proxy pour contourner CORS)
        // Suppression de maxFeatures pour récupérer toutes les données
        const wfsUrl = '/geoserver/Projet_Rokia/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Projet_Rokia%3Aparcelle_anyama&outputFormat=application%2Fjson&srsName=EPSG%3A404000';
        
        console.log('Chargement de TOUTES les données depuis GeoServer via proxy:', wfsUrl);
        
        const response = await fetch(wfsUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Données reçues depuis GeoServer:', data);
        console.log(`Nombre total de features: ${data.totalFeatures || 'Non spécifié'}`);
        console.log(`Nombre de features retournées: ${data.numberReturned || data.features?.length || 0}`);
        
        if (data.features && Array.isArray(data.features)) {
            allParcelles = data.features;
            filteredParcelles = [...allParcelles];
            
            // Afficher les parcelles sur la carte
            displayParcelles();
            
            // Mettre à jour les filtres
            updateFilters();
            
            // Mettre à jour le compteur de parcelles
            updateParcelleCount();
            
            console.log(`${allParcelles.length} parcelles chargées depuis GeoServer`);
            
            // Ajuster la vue pour afficher toutes les parcelles
            if (allParcelles.length > 0) {
                const bounds = L.geoJSON(allParcelles.map(feature => ({
                    ...feature,
                    geometry: convertGeometry(feature.geometry)
                }))).getBounds();
                map.fitBounds(bounds, { padding: [20, 20] });
            }
        } else {
            throw new Error('Format de données invalide depuis GeoServer');
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        
        // Essayer de charger par lots si l'erreur est due à la taille
        if (error.message.includes('timeout') || error.message.includes('too large') || error.message.includes('413')) {
            console.log('Tentative de chargement par lots...');
            await loadParcellesDataInBatches();
        } else {
            // Afficher un message d'erreur
            const errorMessage = `Erreur lors du chargement des données de la carte:\n\n${error.message}\n\nUtilisation des données de démonstration...`;
            
            // Créer une notification d'erreur plus élégante
            showErrorNotification(errorMessage);
            
            // Utiliser les données GeoJSON fournies en fallback
            allParcelles = getFallbackData();
            filteredParcelles = [...allParcelles];
            displayParcelles();
            updateFilters();
            updateParcelleCount();
        }
    } finally {
        showLoading(false);
    }
}

// Chargement des données par lots (si nécessaire)
async function loadParcellesDataInBatches() {
    try {
        showLoading(true);
        console.log('Chargement par lots...');
        
        const batchSize = 1000; // Taille de chaque lot
        let allFeatures = [];
        let startIndex = 0;
        let hasMoreData = true;
        
        while (hasMoreData) {
            const wfsUrl = `/geoserver/Projet_Rokia/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Projet_Rokia%3Aparcelle_anyama&maxFeatures=${batchSize}&startIndex=${startIndex}&outputFormat=application%2Fjson&srsName=EPSG%3A404000`;
            
            console.log(`Chargement du lot ${Math.floor(startIndex/batchSize) + 1}...`);
            
            const response = await fetch(wfsUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.features && Array.isArray(data.features)) {
                allFeatures = allFeatures.concat(data.features);
                console.log(`${data.features.length} parcelles chargées dans ce lot. Total: ${allFeatures.length}`);
                
                // Vérifier s'il y a plus de données
                hasMoreData = data.features.length === batchSize;
                startIndex += batchSize;
            } else {
                hasMoreData = false;
            }
        }
        
        allParcelles = allFeatures;
        filteredParcelles = [...allParcelles];
        
        // Afficher les parcelles sur la carte
        displayParcelles();
        
        // Mettre à jour les filtres
        updateFilters();
        
        // Mettre à jour le compteur de parcelles
        updateParcelleCount();
        
        console.log(`${allParcelles.length} parcelles chargées au total par lots`);
        
        // Ajuster la vue pour afficher toutes les parcelles
        if (allParcelles.length > 0) {
            const bounds = L.geoJSON(allParcelles.map(feature => ({
                ...feature,
                geometry: convertGeometry(feature.geometry)
            }))).getBounds();
            map.fitBounds(bounds, { padding: [20, 20] });
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement par lots:', error);
        showErrorNotification(`Erreur lors du chargement par lots: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Données de fallback
function getFallbackData() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "parcelle_anyama.26244",
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": [[[[385572.35019099, 611102.48950141, 108.767], [385548.26411608, 611063.93067628, 108.767], [385556.94392398, 611112.13403026, 108.767], [385572.35019099, 611102.48950141, 108.767]]]]
                },
                "geometry_name": "geom",
                "properties": {
                    "gid": 26244,
                    "id": 26244,
                    "commune": "ANYAMA",
                    "quartiers": "AHOUABO",
                    "ilot": "11",
                    "lot": "47196",
                    "nature_lot": "Non Bâti",
                    "statut": 0
                }
            },
            {
                "type": "Feature",
                "id": "parcelle_anyama.185",
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": [[[[381050.8403, 616966.2342, 0], [381084.034, 616979.8282, 0], [381092.4381, 616959.3072, 0], [381059.2444, 616945.7132, 0], [381050.8403, 616966.2342, 0]]]]
                },
                "geometry_name": "geom",
                "properties": {
                    "gid": 185,
                    "id": 185,
                    "commune": "ANYAMA",
                    "quartiers": "THOMASSET",
                    "ilot": null,
                    "lot": "46",
                    "nature_lot": "Abandonné",
                    "statut": 0
                }
            },
            {
                "type": "Feature",
                "id": "parcelle_anyama.209",
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": [[[[380522.3002, 607425.5991, -0.0000235], [380499.2162, 607423.0391, -0.0000235], [380496.8062, 607451.2671, -0.0000235], [380518.3162, 607453.8931, -0.0000235], [380522.3002, 607425.5991, -0.0000235]]]]
                },
                "geometry_name": "geom",
                "properties": {
                    "gid": 209,
                    "id": 209,
                    "commune": "ANYAMA",
                    "quartiers": "EBIMPE",
                    "ilot": null,
                    "lot": "3456",
                    "nature_lot": "Non Bâti",
                    "statut": 0
                }
            }
        ]
    }.features;
}

// Affichage des parcelles sur la carte
function displayParcelles() {
    // Supprimer la couche existante
    if (parcelleLayer) {
        map.removeLayer(parcelleLayer);
    }

    // Convertir les géométries UTM vers Lat/Lng
    const convertedFeatures = filteredParcelles.map(feature => ({
        ...feature,
        geometry: convertGeometry(feature.geometry)
    }));

    // Créer la couche GeoJSON
    parcelleLayer = L.geoJSON(convertedFeatures, {
        style: function(feature) {
            const nature = feature.properties.nature_lot;
            return getParcelleStyle(nature);
        },
        onEachFeature: function(feature, layer) {
            // Popup d'information avec style personnalisé
            const popupContent = createPopupContent(feature);
            layer.bindPopup(popupContent, {
                className: 'custom-popup',
                maxWidth: 350,
                closeButton: true,
                autoPan: true,
                keepInView: true
            });
            
            // Effet de survol amélioré
            layer.on('mouseover', function(e) {
                this.setStyle({
                    weight: 3,
                    opacity: 0.9,
                    fillOpacity: 0.8,
                    color: '#2c3e50'
                });
                this.bringToFront();
            });
            
            layer.on('mouseout', function(e) {
                this.setStyle({
                    weight: 1,
                    opacity: 0.6,
                    fillOpacity: 0.6,
                    color: '#2c3e50'
                });
            });
            
            // Effet de clic
            layer.on('click', function(e) {
                this.setStyle({
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.7,
                    color: '#e74c3c'
                });
            });
        }
    });

    // Ajouter la couche à la carte
    parcelleLayer.addTo(map);
}

// Style des parcelles selon leur nature
function getParcelleStyle(nature) {
    const styles = {
        'Bâti': { color: '#2ecc71', fillColor: '#2ecc71', weight: 1, opacity: 0.6, fillOpacity: 0.4 },
        'Non Bâti': { color: '#f39c12', fillColor: '#f39c12', weight: 1, opacity: 0.6, fillOpacity: 0.4 },
        'En Construction': { color: '#e74c3c', fillColor: '#e74c3c', weight: 1, opacity: 0.6, fillOpacity: 0.4 },
        'InachevÃ©': { color: '#9b59b6', fillColor: '#9b59b6', weight: 1, opacity: 0.6, fillOpacity: 0.4 },
        'AbandonnÃ©': { color: '#e67e22', fillColor: '#e67e22', weight: 1, opacity: 0.6, fillOpacity: 0.4 },
        'Terrain Nu ClÃ´turÃ©': { color: '#f1c40f', fillColor: '#f1c40f', weight: 1, opacity: 0.6, fillOpacity: 0.4 },
        'default': { color: '#95a5a6', fillColor: '#95a5a6', weight: 1, opacity: 0.6, fillOpacity: 0.4 }
    };
    
    return styles[nature] || styles['default'];
}

// Création du contenu du popup
function createPopupContent(feature) {
    const props = feature.properties;
    
    // Définir les couleurs selon la nature du lot
    const getNatureColor = (nature) => {
        switch(nature) {
            case 'Bâti': return '#2ecc71';
            case 'Non Bâti': return '#f39c12';
            case 'En Construction': return '#e74c3c';
            case 'Inachevé': return '#9b59b6';
            case 'Abandonné': return '#95a5a6';
            default: return '#95a5a6';
        }
    };
    
    const natureColor = getNatureColor(props.nature_lot);
    
    return `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Parcelle ${props.id}</h3>
                <span class="nature-badge" style="background-color: ${natureColor}">
                    ${props.nature_lot || 'N/A'}
                </span>
            </div>
            <div class="popup-body">

                <div class="popup-field">
                    <span class="icon">🏛️</span>
                    <strong>Commune:</strong> ${props.commune || 'N/A'}
                </div>

                <div class="popup-field">
                    <span class="icon">🏘️</span>
                    <strong>Quartier:</strong> ${props.quartiers || 'N/A'}
                </div>
                <div class="popup-field">
                    <span class="icon">🏢</span>
                    <strong>Ilot:</strong> ${props.ilot || 'N/A'}
                </div>
                <div class="popup-field">
                    <span class="icon">📋</span>
                    <strong>Lot:</strong> ${props.lot || 'N/A'}
                </div>
                
                
            </div>
        </div>
    `;
}

// Mise à jour des filtres
function updateFilters() {
    updateQuartierFilter();
    updateIlotFilter();
    updateLotFilter();
}

// Filtre par quartier
function updateQuartierFilter() {
    const quartierSelect = document.getElementById('quartier');
    const quartiers = [...new Set(allParcelles.map(p => p.properties.quartiers).filter(Boolean))].sort();
    
    quartierSelect.innerHTML = '<option value="">-- Tous les quartiers --</option>';
    quartiers.forEach(quartier => {
        const option = document.createElement('option');
        option.value = quartier;
        option.textContent = quartier;
        quartierSelect.appendChild(option);
    });
    
    // Supprimer les anciens event listeners
    quartierSelect.removeEventListener('change', filterParcelles);
    quartierSelect.addEventListener('change', function() {
        filterParcelles();
        // Si un quartier spécifique est sélectionné, centrer dessus
        if (this.value) {
            centerOnSpecificQuartier(this.value);
        }
    });
    
    console.log(`Filtre quartier mis à jour avec ${quartiers.length} quartiers:`, quartiers);
}

// Filtre par ilot
function updateIlotFilter() {
    const ilotSelect = document.getElementById('ilot');
    const ilots = [...new Set(allParcelles.map(p => p.properties.ilot).filter(Boolean))].sort((a, b) => {
        // Trier numériquement si possible, sinon alphabétiquement
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return String(a).localeCompare(String(b));
    });
    
    ilotSelect.innerHTML = '<option value="">-- Tous les ilots --</option>';
    ilots.forEach(ilot => {
        const option = document.createElement('option');
        option.value = ilot;
        option.textContent = ilot;
        ilotSelect.appendChild(option);
    });
    
    // Supprimer les anciens event listeners
    ilotSelect.removeEventListener('change', filterParcelles);
    ilotSelect.addEventListener('change', function() {
        filterParcelles();
        // Si un ilot spécifique est sélectionné, centrer dessus
        if (this.value) {
            centerOnSpecificIlot(this.value);
        }
    });
    
    console.log(`Filtre ilot mis à jour avec ${ilots.length} ilots:`, ilots);
}

// Filtre par lot
function updateLotFilter() {
    const lotSelect = document.getElementById('lot');
    const lots = [...new Set(allParcelles.map(p => p.properties.lot).filter(Boolean))].sort((a, b) => {
        // Trier numériquement si possible, sinon alphabétiquement
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return String(a).localeCompare(String(b));
    });
    
    lotSelect.innerHTML = '<option value="">-- Tous les lots --</option>';
    lots.forEach(lot => {
        const option = document.createElement('option');
        option.value = lot;
        option.textContent = lot;
        lotSelect.appendChild(option);
    });
    
    // Supprimer les anciens event listeners
    lotSelect.removeEventListener('change', filterParcelles);
    lotSelect.addEventListener('change', function() {
        filterParcelles();
        // Si un lot spécifique est sélectionné, centrer plus précisément
        if (this.value) {
            centerOnSpecificLot(this.value);
        }
    });
    
    console.log(`Filtre lot mis à jour avec ${lots.length} lots:`, lots);
}

// Filtrage des parcelles
function filterParcelles() {
    const quartier = document.getElementById('quartier').value;
    const ilot = document.getElementById('ilot').value;
    const lot = document.getElementById('lot').value;
    
    console.log('Filtrage avec:', { quartier, ilot, lot });
    
    filteredParcelles = allParcelles.filter(parcelle => {
        const props = parcelle.properties;
        const quartierMatch = !quartier || props.quartiers === quartier;
        const ilotMatch = !ilot || props.ilot === ilot;
        const lotMatch = !lot || props.lot === lot;
        
        return quartierMatch && ilotMatch && lotMatch;
    });
    
    console.log(`${filteredParcelles.length} parcelles après filtrage sur ${allParcelles.length} total`);
    
    displayParcelles();
    updateParcelleCount();
    
    // Centrer automatiquement sur la zone sélectionnée
    centerOnFilteredArea();
}

// Centrage automatique sur la zone filtrée
function centerOnFilteredArea() {
    if (filteredParcelles.length === 0) {
        console.log('Aucune parcelle à centrer');
        return;
    }
    
    // Convertir les géométries UTM vers Lat/Lng pour le calcul des limites
    const convertedFeatures = filteredParcelles.map(feature => ({
        ...feature,
        geometry: convertGeometry(feature.geometry)
    }));
    
    // Créer une couche temporaire pour calculer les limites
    const tempLayer = L.geoJSON(convertedFeatures);
    const bounds = tempLayer.getBounds();
    
    // Centrer la carte sur les limites calculées avec un padding
    map.fitBounds(bounds, { 
        padding: [20, 20],
        maxZoom: 16 // Limiter le zoom maximum pour éviter un zoom trop proche
    });
    
    console.log(`Carte centrée sur ${filteredParcelles.length} parcelles filtrées`);
}

// Centrage précis sur un quartier spécifique
function centerOnSpecificQuartier(quartierValue) {
    const quartierParcelles = filteredParcelles.filter(parcelle => 
        parcelle.properties.quartiers === quartierValue
    );
    
    if (quartierParcelles.length === 0) {
        console.log(`Aucune parcelle trouvée pour le quartier ${quartierValue}`);
        return;
    }
    
    // Convertir les géométries UTM vers Lat/Lng
    const convertedFeatures = quartierParcelles.map(feature => ({
        ...feature,
        geometry: convertGeometry(feature.geometry)
    }));
    
    // Créer une couche temporaire pour calculer les limites
    const tempLayer = L.geoJSON(convertedFeatures);
    const bounds = tempLayer.getBounds();
    
    // Centrer sur le quartier avec un zoom approprié
    map.fitBounds(bounds, { 
        padding: [15, 15],
        maxZoom: 15 // Zoom approprié pour un quartier
    });
    
    console.log(`Carte centrée sur le quartier ${quartierValue} (${quartierParcelles.length} parcelles)`);
}

// Centrage précis sur un ilot spécifique
function centerOnSpecificIlot(ilotValue) {
    const ilotParcelles = filteredParcelles.filter(parcelle => 
        parcelle.properties.ilot === ilotValue
    );
    
    if (ilotParcelles.length === 0) {
        console.log(`Aucune parcelle trouvée pour l'ilot ${ilotValue}`);
        return;
    }
    
    // Convertir les géométries UTM vers Lat/Lng
    const convertedFeatures = ilotParcelles.map(feature => ({
        ...feature,
        geometry: convertGeometry(feature.geometry)
    }));
    
    // Créer une couche temporaire pour calculer les limites
    const tempLayer = L.geoJSON(convertedFeatures);
    const bounds = tempLayer.getBounds();
    
    // Centrer sur l'ilot avec un zoom approprié
    map.fitBounds(bounds, { 
        padding: [12, 12],
        maxZoom: 17 // Zoom approprié pour un ilot
    });
    
    console.log(`Carte centrée sur l'ilot ${ilotValue} (${ilotParcelles.length} parcelles)`);
}

// Centrage précis sur un lot spécifique
function centerOnSpecificLot(lotValue) {
    const lotParcelles = filteredParcelles.filter(parcelle => 
        parcelle.properties.lot === lotValue
    );
    
    if (lotParcelles.length === 0) {
        console.log(`Aucune parcelle trouvée pour le lot ${lotValue}`);
        return;
    }
    
    // Convertir les géométries UTM vers Lat/Lng
    const convertedFeatures = lotParcelles.map(feature => ({
        ...feature,
        geometry: convertGeometry(feature.geometry)
    }));
    
    // Créer une couche temporaire pour calculer les limites
    const tempLayer = L.geoJSON(convertedFeatures);
    const bounds = tempLayer.getBounds();
    
    // Centrer avec un zoom plus proche pour un lot spécifique
    map.fitBounds(bounds, { 
        padding: [10, 10],
        maxZoom: 18 // Zoom plus proche pour un lot spécifique
    });
    
    console.log(`Carte centrée sur le lot ${lotValue} (${lotParcelles.length} parcelles)`);
}

// Mise à jour du compteur de parcelles
function updateParcelleCount() {
    const countElement = document.getElementById('parcelleCount');
    if (countElement) {
        countElement.textContent = `${filteredParcelles.length} parcelles affichées`;
    }
}

// Réinitialiser les filtres
function resetFilters() {
    document.getElementById('quartier').value = '';
    document.getElementById('ilot').value = '';
    document.getElementById('lot').value = '';
    
    filteredParcelles = [...allParcelles];
    displayParcelles();
    updateParcelleCount();
    
    // Centrer sur toutes les parcelles
    centerOnFilteredArea();
    
    console.log('Filtres réinitialisés');
}

// Contrôles de la carte
function initMapControls() {
    // Contrôles de pan
    const panButtons = document.querySelectorAll('.pan-button');
    panButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.classList.contains('active')) {
                const direction = this.textContent;
                const currentCenter = map.getCenter();
                const offset = 0.01; // Décalage en degrés
                
                let newLat = currentCenter.lat;
                let newLng = currentCenter.lng;
                
                switch(direction) {
                    case '↖': newLat += offset; newLng -= offset; break;
                    case '↑': newLat += offset; break;
                    case '↗': newLat += offset; newLng += offset; break;
                    case '←': newLng -= offset; break;
                    case '→': newLng += offset; break;
                    case '↙': newLat -= offset; newLng -= offset; break;
                    case '↓': newLat -= offset; break;
                    case '↘': newLat -= offset; newLng += offset; break;
                }
                
                map.setView([newLat, newLng], map.getZoom());
            }
        });
    });
    
    // Contrôles de zoom
    const zoomButtons = document.querySelectorAll('.zoom-button');
    zoomButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.textContent === '+') {
                map.zoomIn();
            } else {
                map.zoomOut();
            }
        });
    });
}

// Contrôles rétractables
function initCollapsibleControls() {
    const widgets = document.querySelectorAll('.map-widget');
    
    widgets.forEach(widget => {
        const header = widget.querySelector('.widget-header');
        const content = widget.querySelector('.widget-content');
        const expandIcon = widget.querySelector('.expand-icon');
        
        header.addEventListener('click', function() {
            const isCollapsed = content.style.display === 'none';
            
            if (isCollapsed) {
                content.style.display = 'block';
                expandIcon.textContent = 'expand_less';
                widget.classList.remove('collapsed');
            } else {
                content.style.display = 'none';
                expandIcon.textContent = 'expand_more';
                widget.classList.add('collapsed');
            }
        });
    });
}

// Affichage du loading
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// Notification d'erreur
function showErrorNotification(message) {
    // Créer une notification d'erreur élégante
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
        <div class="error-content">
            <span class="material-symbols-outlined">error</span>
            <div class="error-text">
                <h4>Erreur de chargement</h4>
                <p>${message}</p>
            </div>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-suppression après 10 secondes
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation de l\'application de cartographie Anyama');
    initMap();
    
    // Ajouter l'événement pour le bouton de réinitialisation
    const resetButton = document.getElementById('resetFilters');
    if (resetButton) {
        resetButton.addEventListener('click', resetFilters);
    }
});
