# Mapa de Estudios Moleculares sobre Especies Forestales en ALAC

> **Red LACFORGEN &bull; Proyecto GENFOMEC / CYTED**  
> Dashboard web interactivo, de alto rendimiento e independiente de Power BI para la visualización y exploración de estudios moleculares en especies forestales de América Latina y el Caribe (ALAC).

---

## 🚀 Características Principales

* **Independiente y Ágil:** Cero dependencias de licencias de Power BI, servidores intermedios o procesos ETL complejos.
* **Conexión Directa en Tiempo Real:** Ingestión de datos vía streaming CSV en vivo directamente desde la hoja de respuestas de Google Sheets.
* **Respaldo Local Automático:** Si falla la conexión a internet, el sistema conmuta sin interrupciones a un dataset local en caché.
* **Visualizaciones Interactivas con Filtro Cruzado:**
  * **Mapa Coroplético (Leaflet):** Encuadre automático regional, animación de zoom por país, panel flotante de detalle geográfico sin desbordes y 5 capas de mapa libres (satélite, relieve, lienzos claro y oscuro).
  * **Barras 100% Apiladas (Chart.js):** Proporción de países que aplican cada marcador molecular, con colores sincronizados 1:1 con el mapa.
  * **Gráfico de Dona (Chart.js):** Distribución por tipo de investigación genética o técnica molecular.
  * **Explorador de Publicaciones:** Tabla paginada, ordenada alfabéticamente por especie, con buscador de texto completo y enlaces directos a DOIs científicos.
* **Modo Oscuro / Claro Integrado:** Conmutación dinámica con detección automática de preferencia de sistema y persistencia en `localStorage`.

---

## 🛠️ Tecnologías Utilizadas

* **HTML5 & CSS3:** Diseño responsive sin frameworks pesados, con CSS custom properties y glassmorphism.
* **JavaScript (ES Modules):** Arquitectura modular (`app.js`, `map.js`, `charts.js`).
* **Leaflet.js:** Renderizado geoespacial interactivo y capas cartográficas de Esri y OpenStreetMap.
* **Chart.js:** Gráficos analíticos con tooltips y eventos de clic para filtrado interactivo.
* **PapaParse:** Procesamiento y limpieza ultrarrápida del flujo CSV.

---

## 🌐 Publicación en GitHub Pages

Para habilitar este dashboard en GitHub Pages:
1. Sube este repositorio a tu cuenta de GitHub.
2. Ve a **Settings** &rarr; **Pages**.
3. En **Build and deployment**, selecciona:
   * **Source:** `Deploy from a branch`
   * **Branch:** `main` (o `master`) / `/ (root)`.
4. Haz clic en **Save**. En pocos segundos tu dashboard estará disponible públicamente en `https://<tu-usuario>.github.io/<tu-repositorio>/`.
