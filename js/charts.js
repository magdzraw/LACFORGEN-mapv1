// Chart.js visualizations for LACFORGEN Dashboard
import { normalizeCountryName, countryColors } from './map.js';

let stackedBarChart = null;
let donutChart = null;

const defaultCountryColorsList = [
  '#2563eb', '#059669', '#eab308', '#ea580c', '#06b6d4',
  '#8b5cf6', '#dc2626', '#ec4899', '#0d9488', '#6366f1', '#84cc16'
];

const markerColors = {
  'Microsatélites (SSR)': '#0284c7',
  'SNP (Single Nucleotide Polymorphisms)': '#10b981',
  'GBS o RADseq': '#8b5cf6',
  'Secuenciación de ADN cloroplastidial o mitocondrial': '#f59e0b',
  'AFLP (Amplified Fragment Length Polymorphism)': '#ec4899',
  'Genoma completo': '#6366f1',
  'RAPD (Random Amplified Polymorphic DNA)': '#14b8a6',
  'Otro': '#94a3b8'
};

const studyColors = [
  '#004a7c', '#0284c7', '#059669', '#10b981', '#d97706', '#8b5cf6', '#ec4899', '#64748b'
];

function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    isDark,
    text: isDark ? '#cbd5e1' : '#475569',
    grid: isDark ? '#1e293b' : '#f1f5f9',
    borderColor: isDark ? '#111827' : '#ffffff'
  };
}

export function renderCharts(filteredData, onMarkerSelect, onStudySelect, onCountrySelect) {
  renderStackedBar(filteredData, onMarkerSelect, onCountrySelect);
  renderDonut(filteredData, onStudySelect);
}

export function updateChartsTheme() {
  const theme = getThemeColors();
  
  if (stackedBarChart) {
    stackedBarChart.options.scales.x.grid.color = theme.grid;
    stackedBarChart.options.scales.x.ticks.color = theme.text;
    stackedBarChart.options.scales.y.ticks.color = theme.text;
    stackedBarChart.options.plugins.legend.labels.color = theme.text;
    stackedBarChart.update();
  }

  if (donutChart) {
    donutChart.options.plugins.legend.labels.color = theme.text;
    donutChart.data.datasets[0].borderColor = theme.borderColor;
    donutChart.update();
  }
}

// 1. 100% Stacked Bar Chart: Marcadores en el Eje, Países apilados
function renderStackedBar(data, onMarkerSelect, onCountrySelect) {
  const ctx = document.getElementById('stacked-bar-canvas');
  if (!ctx) return;

  if (stackedBarChart) {
    stackedBarChart.destroy();
  }

  const theme = getThemeColors();

  // Count countries per marker
  const markerCounts = {};
  const allCountriesSet = new Set();

  data.forEach(item => {
    const marker = item.marcador || 'Otro';
    const country = normalizeCountryName(item.pais) || 'No especificado';
    allCountriesSet.add(country);

    if (!markerCounts[marker]) {
      markerCounts[marker] = { total: 0, byCountry: {} };
    }
    markerCounts[marker].byCountry[country] = (markerCounts[marker].byCountry[country] || 0) + 1;
    markerCounts[marker].total++;
  });

  // Sort markers descending by total studies
  const sortedMarkers = Object.keys(markerCounts).sort((a, b) => markerCounts[b].total - markerCounts[a].total);

  // List of all countries present, sorted alphabetically
  const countriesList = Array.from(allCountriesSet).sort((a, b) => a.localeCompare(b, 'es'));

  // Prepare 100% stacked datasets for each country
  const datasets = countriesList.map((country, idx) => {
    const dataValues = sortedMarkers.map(marker => {
      const mData = markerCounts[marker];
      const count = mData.byCountry[country] || 0;
      return mData.total > 0 ? Number(((count / mData.total) * 100).toFixed(1)) : 0;
    });

    const rawCounts = sortedMarkers.map(marker => {
      return markerCounts[marker].byCountry[country] || 0;
    });

    return {
      label: country,
      data: dataValues,
      rawCounts: rawCounts,
      backgroundColor: countryColors[country] || defaultCountryColorsList[idx % defaultCountryColorsList.length],
      borderRadius: 2
    };
  });

  stackedBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedMarkers,
      datasets: datasets
    },
    options: {
      indexAxis: 'y', // Horizontal bars (Markers on Y-axis)
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            color: theme.text,
            font: { size: 10.5, family: "'Outfit', sans-serif" },
            padding: 8
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const dataset = context.dataset;
              const pct = context.parsed.x;
              const raw = dataset.rawCounts ? dataset.rawCounts[context.dataIndex] : 0;
              return ` ${dataset.label}: ${pct}% (${raw} ${raw === 1 ? 'estudio' : 'estudios'})`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          max: 100,
          ticks: {
            callback: value => value + '%',
            color: theme.text,
            font: { size: 10 }
          },
          grid: { color: theme.grid }
        },
        y: {
          stacked: true,
          ticks: {
            color: theme.text,
            font: { size: 10.5, weight: '600' },
            callback: function(value) {
              const label = this.getLabelForValue(value);
              return label.length > 28 ? label.substring(0, 26) + '…' : label;
            }
          },
          grid: { display: false }
        }
      },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const el = elements[0];
          const countryName = datasets[el.datasetIndex].label;
          if (onCountrySelect) onCountrySelect(countryName);
        }
      }
    }
  });
}

// 2. Donut Chart: Tipo de Estudio
let currentDonutMode = 'estudio'; // 'estudio' or 'marcador'

function renderDonut(data, onSelect) {
  const ctx = document.getElementById('donut-canvas');
  if (!ctx) return;

  if (donutChart) {
    donutChart.destroy();
  }

  const theme = getThemeColors();

  // Count by field
  const counts = {};
  data.forEach(item => {
    const key = currentDonutMode === 'estudio' 
      ? (item.estudio || 'Otros')
      : (item.marcador || 'Otro');
    counts[key] = (counts[key] || 0) + 1;
  });

  const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const values = labels.map(l => counts[l]);
  const total = values.reduce((a, b) => a + b, 0);

  const colors = labels.map((l, i) => {
    if (currentDonutMode === 'marcador') {
      return markerColors[l] || studyColors[i % studyColors.length];
    }
    return studyColors[i % studyColors.length];
  });

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        hoverOffset: 6,
        borderWidth: 2,
        borderColor: theme.borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            color: theme.text,
            font: { size: 10.5, family: "'Outfit', sans-serif" },
            generateLabels: (chart) => {
              const data = chart.data;
              return data.labels.map((label, i) => {
                const val = data.datasets[0].data[i];
                const pct = total > 0 ? ((val / total) * 100).toFixed(0) : 0;
                return {
                  text: `${label} (${pct}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: isNaN(data.datasets[0].data[i]),
                  index: i
                };
              });
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${val} estudios (${pct}%)`;
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const selectedLabel = labels[index];
          if (onSelect) onSelect(selectedLabel, currentDonutMode);
        }
      }
    }
  });
}

// Allow toggling donut mode between Estudio and Marcador
export function toggleDonutMode(mode, data, onSelect) {
  currentDonutMode = mode;
  renderDonut(data, onSelect);
}
