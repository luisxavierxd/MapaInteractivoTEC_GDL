> [🇺🇸 English](README.md) · 🇲🇽 Español

# Mapa Interactivo — Campus GDL Tec de Monterrey

Mapa interactivo del Campus Guadalajara del Tecnológico de Monterrey para ayudar a los estudiantes a orientarse. Muestra edificios por categoría, permite buscar y filtrar, y ofrece navegación peatonal sobre rutas dibujadas a mano.

## Funcionalidades

- **Mapa de edificios** — polígonos y POIs renderizados desde GeoJSON propio, con código de color por categoría: Académico, Preparatoria, Deportes, Residencias, Comida, Servicios, Comercial, Otros
- **Búsqueda y filtros** — búsqueda por nombre, filtro por categoría
- **Panel de info** — al hacer clic en un edificio se muestran sus detalles
- **Navegación peatonal** — router propio sobre los caminos del campus dibujados a mano; si no hay datos de rutas disponibles, hace fallback a OSRM
- **Mi ubicación** — ruta desde tu posición GPS actual a cualquier edificio
- **Toggleo satélite / mapa de calles**
- **Diseño responsivo** para móvil con sidebar

## Stack

- **[Leaflet.js](https://leafletjs.com/)** — biblioteca de mapas interactivos
- **[OpenStreetMap](https://www.openstreetmap.org/)** — tiles del mapa base
- **[Esri World Imagery](https://www.arcgis.com/)** — capa de satélite
- **GeoJSON personalizado** — datos de edificios y red de caminos caminables editados a mano
- **[OSRM](https://project-osrm.org/)** — fallback de ruteo público (perfil peatonal)

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
data/
  campus.geojson      # Polígonos de edificios + POIs (se renderizan)
  paths.geojson       # Caminos caminables + entradas (solo router)
assets/
  css/style.css
  js/
    router.js         # CampusRouter — grafo, topología, Dijkstra
    map.js            # Mapa Leaflet, UI, búsqueda, interfaz de rutas
```

## Licencia

MIT © Luis Xavier
