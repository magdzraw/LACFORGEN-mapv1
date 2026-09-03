// Leaflet Choropleth Map for Latin America & the Caribbean
let mapInstance = null;
let geojsonLayer = null;
let geojsonData = null;
let selectedCountry = null;
let initialBounds = null;
let hasAutoFitted = false;
let infoControl = null;
let currentBaseLayer = null;
let activeBaseLayerKey = 'light';
let layerControl = null;

// Exact color palette corresponding to the stacked bar chart
export const countryColors = {
  'Argentina': '#2563eb',
  'México': '#059669',
  'Brasil': '#eab308',
  'Colombia': '#ea580c',
  'Costa Rica': '#06b6d4',
  'Bolivia': '#8b5cf6',
  'Perú': '#dc2626',
  'Cuba': '#ec4899',
  'Chile': '#0d9488',
  'Guatemala': '#6366f1',
  'Ecuador': '#84cc16'
};

// Standardize country names to Spanish canonical naming across entire app
export function normalizeCountryName(name) {
  if (!name) return '';
  const n = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n === 'brazil' || n === 'brasil') return 'Brasil';
  if (n === 'mexico') return 'México';
  if (n === 'peru') return 'Perú';
  if (n === 'panama') return 'Panamá';
  if (n === 'costa rica') return 'Costa Rica';
  if (n === 'puerto rico') return 'Puerto Rico';
  if (n === 'republica dominicana' || n === 'dominican rep.' || n === 'dominican republic') return 'República Dominicana';
  if (n === 'trinidad y tobago' || n === 'trinidad and tobago') return 'Trinidad y Tobago';
  return name.trim();
}

// 5 Free, high quality tile layers without API key
const tileLayers = {
  light: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  }),
  dark: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
    maxZoom: 18
  }),
  topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; National Geographic, DeLorme, NAVTEQ',
    maxZoom: 18
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  })
};

function getCountryFillColor(cName, count) {
  if (!count || count === 0) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? '#1e293b' : '#f1f5f9';
  }
  return countryColors[cName] || '#0284c7';
}

export function initMap(onCountrySelect) {
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) return;

  const isDarkInitial = document.documentElement.getAttribute('data-theme') === 'dark';
  activeBaseLayerKey = isDarkInitial ? 'dark' : 'light';
  currentBaseLayer = tileLayers[activeBaseLayerKey];

  mapInstance = L.map('map-container', {
    center: [-13.5, -67.0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 8,
    zoomControl: true,
    scrollWheelZoom: false,
    layers: [currentBaseLayer]
  });

  // Multiple Free Tile Layers Switcher (Bottom-Left)
  const baseMaps = {
    "Lienzo Claro": tileLayers.light,
    "Lienzo Oscuro": tileLayers.dark,
    "Satélite Natural": tileLayers.satellite,
    "Topográfico / Relieve": tileLayers.topo,
    "Calles (OpenStreetMap)": tileLayers.osm
  };

  layerControl = L.control.layers(baseMaps, null, {
    position: 'bottomleft',
    collapsed: true
  }).addTo(mapInstance);

  mapInstance.on('baselayerchange', function (e) {
    for (const [k, layer] of Object.entries(tileLayers)) {
      if (layer === e.layer) {
        activeBaseLayerKey = k;
        break;
      }
    }
  });

  // Top-Right Info Box (prevents tooltip overflow completely)
  infoControl = L.control({ position: 'topright' });
  infoControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-info-box');
    div.innerHTML = getDefaultInfoHtml();
    return div;
  };
  infoControl.addTo(mapInstance);

  // Load GeoJSON
  fetch('./data/lac_countries.json')
    .then(res => res.json())
    .then(data => {
      geojsonData = data;
      renderGeojson(onCountrySelect);
    })
    .catch(err => {
      console.error('Error loading GeoJSON:', err);
    });
}

export function switchMapTheme(isDark) {
  if (!mapInstance) return;
  // Automatically switch between light and dark canvas if user hasn't explicitly chosen satellite/topo
  if (activeBaseLayerKey === 'light' && isDark) {
    mapInstance.removeLayer(tileLayers.light);
    mapInstance.addLayer(tileLayers.dark);
    activeBaseLayerKey = 'dark';
  } else if (activeBaseLayerKey === 'dark' && !isDark) {
    mapInstance.removeLayer(tileLayers.dark);
    mapInstance.addLayer(tileLayers.light);
    activeBaseLayerKey = 'light';
  }

  // Refresh country polygon styling for theme
  if (geojsonLayer) {
    geojsonLayer.eachLayer(layer => {
      geojsonLayer.resetStyle(layer);
    });
  }
}

function getDefaultInfoHtml() {
  return `
    <div style="font-family: var(--font-main); font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
      <div style="font-weight: 700; font-size: 0.9rem; color: var(--primary); margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        Detalle Geográfico
      </div>
      <div>Pasa el cursor sobre un país para explorar o haz clic para enfocarlo.</div>
    </div>
  `;
}

function updateInfoBox(countryName, stats) {
  if (!infoControl || !infoControl.getContainer()) return;
  const container = infoControl.getContainer();

  if (!countryName) {
    container.innerHTML = getDefaultInfoHtml();
    return;
  }

  const count = stats ? stats.count : 0;
  const colorBadge = countryColors[countryName] || '#0284c7';

  let html = `
    <div style="font-family: var(--font-main); font-size: 0.82rem; line-height: 1.4;">
      <div style="font-weight: 700; font-size: 0.98rem; color: var(--text-main); border-bottom: 2px solid var(--card-border); padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colorBadge};"></span>
          ${countryName}
        </span>
        <span style="font-size: 0.76rem; background: rgba(2, 132, 199, 0.12); color: var(--primary); padding: 2px 7px; border-radius: 9999px; font-weight: 700;">
          ${count} ${count === 1 ? 'estudio' : 'estudios'}
        </span>
      </div>
  `;

  if (stats && count > 0) {
    const topSpecies = Object.entries(stats.species)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sp, c]) => `<em>${sp}</em> (${c})`)
      .join(', ');

    const topMarkers = Object.entries(stats.markers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, c]) => `<strong>${m}</strong> (${c})`)
      .join(', ');

    html += `
      <div style="margin-bottom: 4px; color: var(--text-main);">
        <span style="color: var(--text-muted); font-size: 0.74rem; text-transform: uppercase; font-weight: 600;">Especies principales:</span><br/>
        <span style="font-size: 0.8rem;">${topSpecies || 'No especificadas'}</span>
      </div>
      <div style="margin-bottom: 4px; color: var(--text-main);">
        <span style="color: var(--text-muted); font-size: 0.74rem; text-transform: uppercase; font-weight: 600;">Marcadores clave:</span><br/>
        <span style="font-size: 0.8rem;">${topMarkers || 'No especificados'}</span>
      </div>
    `;
  } else {
    html += `<div style="color: var(--text-muted); font-style: italic;">Sin estudios registrados en esta selección.</div>`;
  }

  html += `
      <div style="margin-top: 6px; font-size: 0.72rem; color: var(--primary); font-weight: 600;">
        ${selectedCountry === countryName ? '✓ País seleccionado (clic para deseleccionar)' : '👉 Clic para filtrar este país'}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderGeojson(onCountrySelect) {
  if (!geojsonData || !mapInstance) return;

  if (geojsonLayer) {
    mapInstance.removeLayer(geojsonLayer);
  }

  // Calculate stats per country from window.currentFilteredData
  const countryStats = {};
  const currentData = window.currentFilteredData || [];

  currentData.forEach(item => {
    const cName = normalizeCountryName(item.pais);
    if (!countryStats[cName]) {
      countryStats[cName] = {
        count: 0,
        species: {},
        markers: {}
      };
    }
    countryStats[cName].count++;
    
    const sp = item.especie || item.especie_comun || item.especie_cientifico;
    if (sp) countryStats[cName].species[sp] = (countryStats[cName].species[sp] || 0) + 1;

    const mk = item.marcador;
    if (mk) countryStats[cName].markers[mk] = (countryStats[cName].markers[mk] || 0) + 1;
  });

  geojsonLayer = L.geoJSON(geojsonData, {
    style: function (feature) {
      const rawName = feature.properties.name || feature.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const stats = countryStats[cName];
      const count = stats ? stats.count : 0;
      const isSelected = selectedCountry === cName;

      return {
        fillColor: getCountryFillColor(cName, count),
        weight: isSelected ? 3.5 : (count > 0 ? 1.5 : 1.0),
        opacity: 1,
        color: isSelected ? '#f59e0b' : (count > 0 ? '#ffffff' : '#94a3b8'),
        dashArray: count > 0 ? '' : '1',
        fillOpacity: count > 0 ? (isSelected ? 0.95 : 0.82) : 0.2
      };
    },
    onEachFeature: function (feature, layer) {
      const rawName = feature.properties.name || feature.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const stats = countryStats[cName];
      const count = stats ? stats.count : 0;

      // Compact, non-overflowing tooltip
      const tooltipText = `<strong>${cName}</strong>: ${count} ${count === 1 ? 'estudio' : 'estudios'}`;
      layer.bindTooltip(tooltipText, {
        sticky: false,
        direction: 'top',
        offset: [0, -8],
        className: 'compact-map-tooltip'
      });

      // Events
      layer.on({
        mouseover: function (e) {
          const l = e.target;
          l.setStyle({
            weight: 3.5,
            color: '#f59e0b',
            dashArray: '',
            fillOpacity: 0.96
          });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            l.bringToFront();
          }
          updateInfoBox(cName, stats);
        },
        mouseout: function (e) {
          geojsonLayer.resetStyle(e.target);
          if (selectedCountry) {
            updateInfoBox(selectedCountry, countryStats[selectedCountry]);
          } else {
            updateInfoBox(null);
          }
        },
        click: function (e) {
          L.DomEvent.stopPropagation(e);
          const isCurrentlySelected = selectedCountry === cName;
          const newCountry = isCurrentlySelected ? null : cName;

          if (newCountry) {
            mapInstance.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 6, duration: 1.0 });
          } else if (initialBounds) {
            mapInstance.flyToBounds(initialBounds, { padding: [25, 25], duration: 1.0 });
          }

          if (onCountrySelect) {
            onCountrySelect(newCountry);
          }
        }
      });
    }
  }).addTo(mapInstance);

  // Auto-fit bounds on initial load to include all countries with data
  const layersWithData = [];
  geojsonLayer.eachLayer(layer => {
    const rawName = layer.feature.properties.name || layer.feature.properties.ADMIN;
    const cName = normalizeCountryName(rawName);
    const stats = countryStats[cName];
    if (stats && stats.count > 0) {
      layersWithData.push(layer);
    }
  });

  if (layersWithData.length > 0 && !initialBounds) {
    initialBounds = L.featureGroup(layersWithData).getBounds();
  }

  if (!hasAutoFitted && initialBounds) {
    mapInstance.fitBounds(initialBounds, { padding: [25, 25], maxZoom: 5 });
    hasAutoFitted = true;
  }
}

export function updateMap(countryFilter, onCountrySelect) {
  const normFilter = countryFilter ? normalizeCountryName(countryFilter) : null;
  const filterChanged = selectedCountry !== normFilter;
  selectedCountry = normFilter;
  
  renderGeojson(onCountrySelect);

  // If filter was changed from dropdown or clear button, trigger flyToBounds
  if (mapInstance && filterChanged) {
    if (selectedCountry) {
      let targetLayer = null;
      geojsonLayer.eachLayer(layer => {
        const rawName = layer.feature.properties.name || layer.feature.properties.ADMIN;
        if (normalizeCountryName(rawName) === selectedCountry) {
          targetLayer = layer;
        }
      });
      if (targetLayer) {
        mapInstance.flyToBounds(targetLayer.getBounds(), { padding: [50, 50], maxZoom: 6, duration: 1.0 });
      }
    } else if (initialBounds) {
      mapInstance.flyToBounds(initialBounds, { padding: [25, 25], duration: 1.0 });
    }
  }
}
