> [🇺🇸 English](README.md) · 🇲🇽 Español

# Mapa Interactivo — Campus GDL Tec de Monterrey

Mapa interactivo del Campus Guadalajara del Tecnológico de Monterrey para ayudar a los estudiantes a orientarse. Muestra edificios por categoría, permite buscar y filtrar, y ofrece navegación peatonal sobre rutas dibujadas a mano.

## Funcionalidades

- **Mapa de edificios** — polígonos y POIs desde GeoJSON propio, con color por categoría usando la paleta **Okabe–Ito** segura para daltonismo (Académico, Preparatoria, Deportes, Residencias, Comida, Servicios, Comercial, Vida estudiantil). La opacidad diferencial mantiene el mapa legible y las etiquetas aparecen a partir de cierto zoom.
- **Búsqueda difusa** — sin distinguir acentos ni mayúsculas, con [Fuse.js](https://www.fusejs.io/), **alias** por edificio (p. ej. `A6`, `CETEC`), navegación por teclado (`↑ ↓ Enter Esc`) y atajo `/`.
- **Filtrar y explorar** — chips de categoría en una sola fila; la lista se ordena por distancia a pie cuando el GPS está activo, o alfabéticamente con encabezados pegajosos.
- **Resaltado cruzado** — pasar el cursor por un item resalta el edificio en el mapa y viceversa (solo punteros finos).
- **Panel de info** — toca un edificio para ver sus datos y luego **Cómo llegar** o **Desde aquí**.
- **Navegación peatonal** — router propio sobre los caminos dibujados a mano; con fallback a OSRM público. Barra inferior estilo Waze con recálculo en vivo.
- **Mi ubicación + rumbo** — marcador GPS con cono de orientación opcional (sensor del dispositivo).
- **Tema claro / oscuro** y toggle **calles / satélite** (el basemap sigue al tema automáticamente).
- **Bottom sheet móvil** con tres puntos de anclaje (peek / half / full).
- **PWA instalable** — funciona sin conexión tras la primera visita (ver abajo).
- **Deep links** — `?b=cetec` abre un edificio; `?from=a6&to=cetec` abre una ruta calculada.
- **Accesible** — contraste WCAG, foco visible, ARIA combobox/listbox, trampa de foco, `prefers-reduced-motion`, targets táctiles ≥44px, landmarks.

## Stack

- **[Leaflet.js](https://leafletjs.com/)** — biblioteca de mapas interactivos (render en canvas)
- **[Fuse.js](https://www.fusejs.io/)** — búsqueda difusa (CDN con Subresource Integrity)
- **[Basemaps de CARTO](https://github.com/CartoDB/basemap-styles)** (Positron / Dark Matter) — tiles de calles
- **[Esri World Imagery](https://www.arcgis.com/)** — capa de satélite
- **GeoJSON personalizado** — edificios y red de caminos caminables editados a mano
- **[OSRM](https://project-osrm.org/)** — fallback de ruteo público (perfil peatonal)
- Sin framework ni build — HTML/CSS/JS servido de forma estática (compatible con GitHub Pages).

## Instalar como app (sin conexión)

La app es una PWA. En la primera visita cachea su shell, los datos de edificios y el router; después carga y permite calcular rutas **sin conexión** (el WiFi del campus falla justo cuando más necesitas el mapa). Los tiles se cachean conforme los ves — usa el botón de **descarga** en el encabezado para precachear los tiles del campus y tener uso offline completo.

- **Android/Chrome:** menú → *Agregar a pantalla de inicio*.
- **iOS/Safari:** Compartir → *Agregar a inicio*.

## Router de campus

El motor de ruteo (`assets/js/router.js`) construye un grafo a partir de LineStrings GeoJSON y ejecuta Dijkstra multi-fuente. La topología se resuelve automáticamente al cargar:

1. **Cierre de huecos entre extremos** — extremos de LineStrings a menos de 3 m entre sí se conectan automáticamente
2. **Splits de T-intersección** — cuando el extremo de un camino cae dentro de 3 m del interior de otro segmento, ese segmento se parte en el punto proyectado y se conecta al extremo
3. **Splits de cruce X** — segmentos que se cruzan en su interior (sin nodo compartido en el GeoJSON) se detectan y se parten en el punto de cruce, creando un nodo de unión compartido

El inicio y fin de cada ruta se proyectan sobre el segmento más cercano (no sobre el vértice más cercano), y todas las entradas de un edificio se evalúan simultáneamente como semillas de Dijkstra para elegir automáticamente la entrada óptima.

## Archivos de datos

| Archivo | Contenido |
|---------|-----------|
| `data/campus.geojson` | Polígonos de edificios y puntos de interés (se renderizan en el mapa) |
| `data/paths.geojson` | LineStrings caminables dibujados a mano + Points de entradas de edificios (solo para el router, nunca se renderizan) |

Ambos archivos están minificados y las coordenadas redondeadas a 6 decimales (~11 cm) para ahorrar ancho de banda.

### El campo `aliases`

Para que la búsqueda encuentre un edificio por su apodo o clave corta, agrega un arreglo `aliases` en las `properties` de ese feature en `data/campus.geojson`:

```json
{ "type": "Feature",
  "properties": { "name": "Edificio 6 (Prepa)", "aliases": ["A6", "aulas 6", "prepa"] },
  "geometry": { "...": "..." } }
```

Los alias se normalizan (sin acentos ni mayúsculas) y pesan por debajo del nombre en el índice de búsqueda. Agrega los que quieras.

## Correr localmente

Necesitas un servidor HTTP local para que `fetch()` funcione sin errores de CORS:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx, sin instalar nada)
npx serve .

# VS Code: extensión Live Server → clic derecho en index.html → "Open with Live Server"
```

Luego abre [http://localhost:8080](http://localhost:8080).

## Estructura

```
index.html
manifest.webmanifest  # Manifiesto PWA
sw.js                 # Service worker (caché offline)
data/
  campus.geojson      # Polígonos de edificios + POIs (se renderizan)
  paths.geojson       # Caminos caminables + entradas (solo router)
assets/
  css/
    tokens.css        # Sistema de diseño: color, paleta, tipografía, espaciado (fuente única)
    style.css         # Componentes, layout, responsivo, temas
  img/                # Iconos PWA (192/512)
  js/
    router.js         # CampusRouter — grafo, topología, Dijkstra (módulo ES, carga diferida)
    map.js            # Mapa Leaflet, UI, búsqueda, rutas, sheet, PWA
```

## Licencia

MIT © Luis Xavier
