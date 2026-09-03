import { initMap, updateMap, normalizeCountryName, switchMapTheme } from './map.js';
import { renderCharts, toggleDonutMode, updateChartsTheme } from './charts.js';

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1PURcEMg1RgnafRQEy1Bfn_mF8_CXWOsxhqNH_n-mPgc/gviz/tq?tqx=out:csv&gid=603583124';

// Application State
let rawData = [];
let filteredData = [];
let currentPage = 1;
const PAGE_SIZE = 10;

let sortColumn = 'especie';
let sortAsc = true;

const filters = {
  pais: '',
  genero: '',
  especie: '',
  estudio: '',
  marcador: '',
  search: ''
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  setupEventListeners();
  initMap(handleCountryClick);
  await loadData();
});

// Theme Management (Dark Mode)
function setupTheme() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlTheme = urlParams.get('theme');
  const savedTheme = urlTheme || localStorage.getItem('lacfor-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(savedTheme);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }
}

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lacfor-theme', theme);

  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  if (sunIcon && moonIcon) {
    sunIcon.style.display = isDark ? 'block' : 'none';
    moonIcon.style.display = isDark ? 'none' : 'block';
  }

  switchMapTheme(isDark);
  updateChartsTheme();
}

// Load Data from Google Sheets or Fallback
async function loadData() {
  const statusBadge = document.getElementById('status-badge');
  try {
    const response = await fetch(GOOGLE_SHEETS_CSV_URL);
    if (!response.ok) throw new Error('Network response not ok');
    const csvText = await response.text();
    
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        rawData = parseAndCleanRows(results.data);
        if (statusBadge) {
          statusBadge.innerHTML = '<span class="status-dot"></span> Datos en vivo (Google Sheets)';
          statusBadge.className = 'status-badge';
        }
        checkUrlParams();
        populateFilterDropdowns();
        applyFilters();
      },
      error: (err) => {
        console.warn('PapaParse error, using fallback:', err);
        loadFallback();
      }
    });
  } catch (err) {
    console.warn('Could not fetch Google Sheets CSV, using local fallback:', err);
    loadFallback();
  }
}

async function loadFallback() {
  const statusBadge = document.getElementById('status-badge');
  try {
    const res = await fetch('./data/fallback_data.json');
    const data = await res.json();
    rawData = parseAndCleanRows(data);
    if (statusBadge) {
      statusBadge.innerHTML = '<span class="status-dot"></span> Modo local (Respaldo)';
      statusBadge.className = 'status-badge fallback';
    }
    checkUrlParams();
    populateFilterDropdowns();
    applyFilters();
  } catch (e) {
    console.error('Fatal: Could not load fallback data', e);
  }
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  ['pais', 'genero', 'especie', 'estudio', 'marcador'].forEach(key => {
    if (params.has(key)) {
      filters[key] = params.get(key);
      const sel = document.getElementById(`filter-${key}`);
      if (sel) sel.value = filters[key];
    }
  });
}

// Clean and Normalize Data Rows
function parseAndCleanRows(rows) {
  return rows.map((r, index) => {
    const rawCountry = (r['País de origen del estudio'] || r.pais || '').trim();
    const country = normalizeCountryName(rawCountry) || 'No especificado';

    const rawSpecies = (r['Especie arbórea investigada'] || r.especie_comun || '').trim();
    const rawScientific = (r['Nombre científico'] || r.especie_cientifico || '').trim();

    // If 'Especie arbórea investigada' is 'Otra' (or case-insensitive 'otra'), the real species is in 'Nombre científico'
    let finalSpecies = rawSpecies;
    if (!finalSpecies || finalSpecies.toLowerCase() === 'otra' || finalSpecies.toLowerCase() === 'otro') {
      finalSpecies = rawScientific || 'No especificada';
    }

    // Genus extraction: first word of scientific name or final species
    const bestNameForGenus = (rawScientific && rawScientific.toLowerCase() !== 'otra' && rawScientific.toLowerCase() !== 'otro') 
      ? rawScientific 
      : finalSpecies;
    const genus = bestNameForGenus.split(' ')[0].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '').trim();

    const study = (r['Tipo de estudio genético realizado'] || r.estudio || '').trim();
    const marker = (r['Marcadores moleculares utilizados'] || r.marcador || '').trim();
    const doi = (r['DOI o enlace a la publicación (si existe)'] || r.doi || '').trim();
    const investigator = (r['Nombre del investigador o responsable del estudio'] || r.investigador || '').trim();
    const institution = (r['Institución/organización'] || r.institucion || '').trim();
    const comments = (r['Comentarios'] || r.comentarios || '').trim();

    return {
      id: index + 1,
      pais: country,
      especie: finalSpecies,
      nombre_cientifico: rawScientific || finalSpecies,
      genero: genus || 'Otro',
      estudio: study || 'Otros',
      marcador: marker || 'Otro',
      investigador: investigator || 'Anónimo',
      institucion: institution || 'No especificada',
      doi: doi,
      comentarios: comments
    };
  });
}

// Filtering Engine
function applyFilters() {
  filteredData = rawData.filter(item => {
    if (filters.pais) {
      const normFilter = normalizeCountryName(filters.pais);
      const normItem = normalizeCountryName(item.pais);
      if (normFilter !== normItem) return false;
    }
    if (filters.genero && item.genero.toLowerCase() !== filters.genero.toLowerCase()) return false;
    if (filters.especie && item.especie.toLowerCase() !== filters.especie.toLowerCase()) return false;
    if (filters.estudio && item.estudio.toLowerCase() !== filters.estudio.toLowerCase()) return false;
    if (filters.marcador && item.marcador.toLowerCase() !== filters.marcador.toLowerCase()) return false;
    
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match = item.pais.toLowerCase().includes(q) ||
                    item.especie.toLowerCase().includes(q) ||
                    item.genero.toLowerCase().includes(q) ||
                    item.investigador.toLowerCase().includes(q) ||
                    item.institucion.toLowerCase().includes(q) ||
                    item.estudio.toLowerCase().includes(q) ||
                    item.marcador.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Sort alphabetically by species by default (or current sortColumn)
  sortFilteredData();

  window.currentFilteredData = filteredData;
  currentPage = 1;

  updateKPIs();
  updateMap(filters.pais, handleCountryClick);
  renderCharts(filteredData, handleMarkerClick, handleStudyClick, handleCountryClick);
  renderTable();
  renderActiveFilterBadges();
}

function sortFilteredData() {
  filteredData.sort((a, b) => {
    const valA = (a[sortColumn] || '').toString();
    const valB = (b[sortColumn] || '').toString();
    const comp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
    return sortAsc ? comp : -comp;
  });
}

// Update KPI Cards
function updateKPIs() {
  const totalStudiesEl = document.getElementById('kpi-total-studies');
  const totalSpeciesEl = document.getElementById('kpi-total-species');
  const totalCountriesEl = document.getElementById('kpi-total-countries');
  const totalMarkersEl = document.getElementById('kpi-total-markers');

  if (!totalStudiesEl) return;

  const uniqueSpecies = new Set(filteredData.map(d => d.especie).filter(Boolean));
  const uniqueCountries = new Set(filteredData.map(d => d.pais).filter(Boolean));
  const uniqueMarkers = new Set(filteredData.map(d => d.marcador).filter(Boolean));

  totalStudiesEl.textContent = filteredData.length;
  totalSpeciesEl.textContent = uniqueSpecies.size;
  totalCountriesEl.textContent = uniqueCountries.size;
  totalMarkersEl.textContent = uniqueMarkers.size;
}

// Populate Filter Dropdowns
function populateFilterDropdowns() {
  const getUniqueSorted = (key) => {
    return Array.from(new Set(rawData.map(d => d[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
  };

  fillSelect('filter-pais', getUniqueSorted('pais'), 'Todos los Países', filters.pais);
  fillSelect('filter-genero', getUniqueSorted('genero'), 'Todos los Géneros', filters.genero);
  fillSelect('filter-especie', getUniqueSorted('especie'), 'Todas las Especies', filters.especie);
  fillSelect('filter-estudio', getUniqueSorted('estudio'), 'Todos los Tipos', filters.estudio);
  fillSelect('filter-marcador', getUniqueSorted('marcador'), 'Todos los Marcadores', filters.marcador);
}

function fillSelect(elemId, items, defaultText, activeVal) {
  const sel = document.getElementById(elemId);
  if (!sel) return;
  const currentVal = activeVal || sel.value;
  sel.innerHTML = `<option value="">${defaultText}</option>`;
  items.forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    if (val === currentVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

// Render Table of Studies
function renderTable() {
  const tbody = document.getElementById('studies-table-body');
  const infoEl = document.getElementById('table-records-info');
  if (!tbody) return;

  const total = filteredData.length;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageItems = filteredData.slice(startIdx, endIdx);

  if (infoEl) {
    infoEl.textContent = total > 0 
      ? `Mostrando ${startIdx + 1} - ${endIdx} de ${total} registros (ordenados por ${sortColumn})` 
      : '0 registros encontrados';
  }

  tbody.innerHTML = '';
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #64748b;">No se encontraron registros con los filtros actuales.</td></tr>`;
    updatePaginationControls(0);
    return;
  }

  pageItems.forEach(item => {
    const tr = document.createElement('tr');
    
    // Format DOI or link
    let doiLink = '<span style="color: #94a3b8; font-size: 0.8rem;">No disp.</span>';
    if (item.doi) {
      const url = item.doi.startsWith('http') ? item.doi : `https://doi.org/${item.doi}`;
      doiLink = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="doi-link" title="${item.doi}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:3px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>Publicación
      </a>`;
    }

    tr.innerHTML = `
      <td><span class="badge-pill country">${item.pais}</span></td>
      <td><strong style="color: #004a7c;">${item.especie}</strong></td>
      <td>${item.estudio}</td>
      <td><span class="badge-pill marker">${item.marcador}</span></td>
      <td>
        <div style="font-weight: 600;">${item.investigador}</div>
        <div style="font-size: 0.76rem; color: #64748b;">${item.institucion}</div>
      </td>
      <td>${doiLink}</td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationControls(total);
}

function updatePaginationControls(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const pageIndicator = document.getElementById('current-page-display');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (pageIndicator) pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// Active Filter Badges
function renderActiveFilterBadges() {
  const container = document.getElementById('active-filters-container');
  if (!container) return;

  container.innerHTML = '';
  const activeKeys = Object.entries(filters).filter(([k, v]) => Boolean(v));

  if (activeKeys.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const label = document.createElement('span');
  label.style.fontSize = '0.78rem';
  label.style.fontWeight = '600';
  label.style.color = '#64748b';
  label.textContent = 'Filtros aplicados:';
  container.appendChild(label);

  activeKeys.forEach(([key, val]) => {
    const badge = document.createElement('div');
    badge.className = 'filter-badge';
    badge.innerHTML = `
      <span>${capitalize(key)}: <strong>${val}</strong></span>
      <span class="remove-badge" data-key="${key}">&times;</span>
    `;
    container.appendChild(badge);
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Event Handlers for Cross-Filtering
function handleCountryClick(countryName) {
  filters.pais = countryName || '';
  const sel = document.getElementById('filter-pais');
  if (sel) sel.value = filters.pais;
  applyFilters();
}

function handleMarkerClick(markerName) {
  filters.marcador = filters.marcador === markerName ? '' : markerName;
  const sel = document.getElementById('filter-marcador');
  if (sel) sel.value = filters.marcador;
  applyFilters();
}

function handleStudyClick(studyName, mode) {
  if (mode === 'estudio') {
    filters.estudio = filters.estudio === studyName ? '' : studyName;
    const sel = document.getElementById('filter-estudio');
    if (sel) sel.value = filters.estudio;
  } else {
    filters.marcador = filters.marcador === studyName ? '' : studyName;
    const sel = document.getElementById('filter-marcador');
    if (sel) sel.value = filters.marcador;
  }
  applyFilters();
}

// Event Listeners
function setupEventListeners() {
  // Select Filters
  ['pais', 'genero', 'especie', 'estudio', 'marcador'].forEach(key => {
    const sel = document.getElementById(`filter-${key}`);
    if (sel) {
      sel.addEventListener('change', (e) => {
        filters[key] = e.target.value;
        applyFilters();
      });
    }
  });

  // Table Search Input
  const searchInput = document.getElementById('table-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filters.search = e.target.value.trim();
      applyFilters();
    });
  }

  // Clear Filters Button
  const clearBtn = document.getElementById('clear-filters-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      Object.keys(filters).forEach(k => filters[k] = '');
      ['pais', 'genero', 'especie', 'estudio', 'marcador'].forEach(key => {
        const sel = document.getElementById(`filter-${key}`);
        if (sel) sel.value = '';
      });
      if (searchInput) searchInput.value = '';
      applyFilters();
    });
  }

  // Table Column Header Click to Sort
  const headers = document.querySelectorAll('th[data-sort]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = true;
      }
      sortFilteredData();
      renderTable();
    });
  });

  // Remove Filter Badge click
  const badgesContainer = document.getElementById('active-filters-container');
  if (badgesContainer) {
    badgesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-badge')) {
        const key = e.target.getAttribute('data-key');
        if (key && filters.hasOwnProperty(key)) {
          filters[key] = '';
          const sel = document.getElementById(`filter-${key}`);
          if (sel) sel.value = '';
          applyFilters();
        }
      }
    });
  }

  // Pagination Buttons
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const maxPages = Math.ceil(filteredData.length / PAGE_SIZE);
      if (currentPage < maxPages) {
        currentPage++;
        renderTable();
      }
    });
  }

  // Donut Toggle Mode (Estudio vs Marcador)
  const donutToggleEstudio = document.getElementById('donut-toggle-estudio');
  const donutToggleMarcador = document.getElementById('donut-toggle-marcador');
  if (donutToggleEstudio && donutToggleMarcador) {
    donutToggleEstudio.addEventListener('click', () => {
      donutToggleEstudio.classList.add('active');
      donutToggleMarcador.classList.remove('active');
      toggleDonutMode('estudio', filteredData, handleStudyClick);
    });
    donutToggleMarcador.addEventListener('click', () => {
      donutToggleMarcador.classList.add('active');
      donutToggleEstudio.classList.remove('active');
      toggleDonutMode('marcador', filteredData, handleStudyClick);
    });
  }
}
