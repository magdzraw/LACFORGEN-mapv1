// 3D Globe Visualization using Globe.gl (Three.js / WebGL)
import { normalizeCountryName, countryColors, getGeojsonData } from './map.js?v=2.1';

let globeInstance = null;
let geojsonData = null;
let selectedCountry = null;
let hoveredCountry = null;
let onSelectCallback = null;
let isInitialized = false;

const countryCoordinates = {
  'Argentina': { lat: -38.4, lng: -63.6 },
  'Bolivia': { lat: -16.3, lng: -63.6 },
  'Brasil': { lat: -14.2, lng: -51.9 },
  'Chile': { lat: -35.7, lng: -71.5 },
  'Colombia': { lat: 4.6, lng: -74.1 },
  'Costa Rica': { lat: 9.7, lng: -83.8 },
  'Cuba': { lat: 21.5, lng: -77.8 },
  'Ecuador': { lat: -1.8, lng: -78.2 },
  'Guatemala': { lat: 15.8, lng: -90.2 },
  'México': { lat: 23.6, lng: -102.5 },
  'Perú': { lat: -9.2, lng: -75.0 }
};

export function isGlobeInitialized() {
  return Boolean(globeInstance);
}

export function initGlobe(onCountrySelect) {
  const container = document.getElementById('globe-container');
  if (!container || globeInstance) return;
  if (typeof Globe !== 'function') {
    console.warn('Globe.gl is not available or still loading');
    return;
  }

  onSelectCallback = onCountrySelect;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const globeTexture = isDark 
    ? 'https://unpkg.com/three-globe/example/img/earth-night.jpg' 
    : 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

  const width = container.clientWidth || 600;
  const height = 560;

  globeInstance = Globe()(container)
    .globeImageUrl(globeTexture)
    .backgroundColor('rgba(0,0,0,0)')
    .width(width)
    .height(height)
    .atmosphereColor(isDark ? '#38bdf8' : '#0284c7')
    .atmosphereAltitude(isDark ? 0.18 : 0.14)
    .pointOfView({ lat: -15, lng: -65, altitude: 2.1 }, 0);

  // Auto-rotation explicitly disabled: stays static on Latin America focus
  if (globeInstance.controls) {
    const controls = globeInstance.controls();
    controls.autoRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }

  // Load GeoJSON polygons (use cached from map.js or fetch)
  const existingGeo = getGeojsonData();
  if (existingGeo) {
    geojsonData = existingGeo;
    renderGlobePolygons();
    isInitialized = true;
  } else {
    fetch('./data/lac_countries.json')
      .then(res => res.json())
      .then(data => {
        geojsonData = data;
        renderGlobePolygons();
        isInitialized = true;
      })
      .catch(err => console.error('Error loading GeoJSON for 3D Globe:', err));
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    resizeGlobe();
  });
}

function renderGlobePolygons() {
  if (!globeInstance || !geojsonData) return;

  const currentData = window.currentFilteredData || [];
  const countryStats = {};

  currentData.forEach(item => {
    const cName = normalizeCountryName(item.pais);
    if (!countryStats[cName]) countryStats[cName] = { count: 0 };
    countryStats[cName].count++;
  });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  globeInstance
    .polygonsData(geojsonData.features)
    .polygonAltitude(d => {
      const rawName = d.properties.name || d.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      if (selectedCountry === cName) return 0.08;
      if (hoveredCountry === cName) return 0.05;
      return (countryStats[cName] && countryStats[cName].count > 0) ? 0.025 : 0.005;
    })
    .polygonCapColor(d => {
      const rawName = d.properties.name || d.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const hasData = countryStats[cName] && countryStats[cName].count > 0;
      
      if (selectedCountry === cName) return '#f59e0b';
      if (hoveredCountry === cName) return '#fbbf24';
      if (hasData) {
        return countryColors[cName] || '#0284c7';
      }
      return isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(241, 245, 249, 0.4)';
    })
    .polygonSideColor(d => {
      const rawName = d.properties.name || d.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const hasData = countryStats[cName] && countryStats[cName].count > 0;
      if (selectedCountry === cName) return '#b45309';
      if (hoveredCountry === cName) return '#d97706';
      if (hasData) return 'rgba(0, 0, 0, 0.4)';
      return 'transparent';
    })
    .polygonStrokeColor(d => {
      const rawName = d.properties.name || d.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const hasData = countryStats[cName] && countryStats[cName].count > 0;
      if (selectedCountry === cName) return '#ffffff';
      if (hoveredCountry === cName) return '#ffffff';
      return hasData ? '#ffffff' : 'rgba(148, 163, 184, 0.3)';
    })
    .polygonsTransitionDuration(300)
    .polygonLabel(d => {
      const rawName = d.properties.name || d.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const count = countryStats[cName] ? countryStats[cName].count : 0;
      return `
        <div style="background: rgba(15, 23, 42, 0.92); color: #ffffff; padding: 7px 13px; border-radius: 8px; font-family: Outfit, sans-serif; font-size: 0.82rem; border: 1px solid rgba(255,255,255,0.2); pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
          <div style="font-weight: 700; font-size: 0.92rem; color: #38bdf8; margin-bottom: 2px;">${cName}</div>
          <div style="font-size: 0.8rem;">${count} ${count === 1 ? 'estudio registrado' : 'estudios registrados'}</div>
          <div style="font-size: 0.72rem; color: #f59e0b; font-weight: 600; margin-top: 3px;">👉 Clic para filtrar este país</div>
        </div>
      `;
    })
    .onPolygonHover(hoverD => {
      if (hoverD) {
        const rawName = hoverD.properties.name || hoverD.properties.ADMIN;
        hoveredCountry = normalizeCountryName(rawName);
      } else {
        hoveredCountry = null;
      }
      renderGlobePolygons();
    })
    .onPolygonClick(clickD => {
      if (!clickD) return;
      const rawName = clickD.properties.name || clickD.properties.ADMIN;
      const cName = normalizeCountryName(rawName);
      const isCurrentlySelected = selectedCountry === cName;
      const newCountry = isCurrentlySelected ? null : cName;

      selectedCountry = newCountry;
      renderGlobePolygons();

      if (newCountry && countryCoordinates[newCountry]) {
        const coords = countryCoordinates[newCountry];
        globeInstance.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.4 }, 1200);
      } else {
        globeInstance.pointOfView({ lat: -15, lng: -65, altitude: 2.1 }, 1200);
      }

      if (onSelectCallback) {
        onSelectCallback(newCountry);
      }
    });
}

export function updateGlobe(countryFilter, onCountrySelect) {
  if (onCountrySelect) onSelectCallback = onCountrySelect;
  const normFilter = countryFilter ? normalizeCountryName(countryFilter) : null;
  selectedCountry = normFilter;

  renderGlobePolygons();

  if (globeInstance) {
    if (selectedCountry && countryCoordinates[selectedCountry]) {
      const coords = countryCoordinates[selectedCountry];
      globeInstance.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.4 }, 1200);
    } else if (!selectedCountry) {
      globeInstance.pointOfView({ lat: -15, lng: -65, altitude: 2.1 }, 1200);
    }
  }
}

export function switchGlobeTheme(isDark) {
  if (!globeInstance) return;
  const texture = isDark
    ? 'https://unpkg.com/three-globe/example/img/earth-night.jpg'
    : 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

  globeInstance
    .globeImageUrl(texture)
    .atmosphereColor(isDark ? '#38bdf8' : '#0284c7')
    .atmosphereAltitude(isDark ? 0.18 : 0.14);

  renderGlobePolygons();
}

export function resizeGlobe() {
  const container = document.getElementById('globe-container');
  if (globeInstance && container && container.offsetParent !== null) {
    const w = container.clientWidth || 580;
    globeInstance.width(w).height(560);
  }
}
