> [🇺🇸 English](README.md) · 🇲🇽 Español

> ⚠️ Proyecto independiente, sin afiliación con el Tecnológico de Monterrey. Datos cartográficos de OpenStreetMap y fuentes públicas.

# Mapa Interactivo — Campus GDL Tec de Monterrey ("Borrego Merodeador")

Mapa interactivo del Campus Guadalajara del Tecnológico de Monterrey para ayudar a los estudiantes a orientarse. Muestra edificios por categoría, permite buscar y filtrar, ofrece navegación peatonal sobre rutas dibujadas a mano, y rastrea la ubicación del usuario en tiempo real.

**En vivo:** https://luisxavierxd.github.io/MapaInteractivoTEC_GDL/

## Funcionalidades

- **Mapa de edificios** — polígonos y POIs con código de color por categoría: Académico, Preparatoria, Deportes, Residencias, LIFE, Auditorios, Comida, Servicios, Comercial, Otros
- **Búsqueda y filtros** — búsqueda por nombre, filtro por categoría con toggle (clic en categoría activa para deseleccionar)
- **Panel de info** — clic en edificio muestra sus detalles; resaltado con pin de categoría en su centroide sin opacar los demás
- **Navegación peatonal** — router propio sobre caminos dibujados a mano; fallback a OSRM si no hay datos locales
  - Barra de progreso inferior (estilo Waze) con tiempo y distancia restantes en tiempo real
  - Línea de ruta dividida: tramo recorrido (gris) y tramo pendiente (naranja)
  - Rerouting automático si el usuario se desvía más de 25 m
- **Ubicación en vivo** — marcador borrego 🐏 con círculo azul y pulso animado; GPS de alta precisión con `watchPosition`; se inicia automáticamente en visitas repetidas; respaldo de red + intervalo de refresco si el GPS se congela
- **Modo claro / oscuro** con toggle persistente entre sesiones
- **Toggle satélite / mapa de calles**
- **Aviso de privacidad** (cumple LFPDPPP) con consentimiento persistente y botón siempre visible
- **Diseño responsivo para móvil** — sidebar deslizable, panel de info compacto sin scroll, cierre automático al seleccionar edificio, botones de ubicación y capa integrados en el mapa

## Stack

- **[Leaflet.js](https://leafletjs.com/)** — biblioteca de mapas interactivos
- **[OpenStreetMap](https://www.openstreetmap.org/)** — tiles del mapa base
- **[Esri World Imagery](https://www.arcgis.com/)** — capa de satélite
- **GeoJSON personalizado** — datos de edificios y red de caminos caminables editados a mano
- **[OSRM](https://project-osrm.org/)** — fallback de ruteo público (perfil peatonal)

## Router de campus

El motor de ruteo (`assets/js/router.js`) construye un grafo a partir de LineStrings GeoJSON y ejecuta Dijkstra multi-fuente. La topología se resuelve automáticamente al cargar:

1. **Cierre de huecos entre extremos** — extremos de LineStrings a menos de 3 m entre sí se conectan automáticamente
2. **Splits de T-intersección** — cuando el extremo de un camino cae dentro de 3 m del interior de otro segmento, ese segmento se parte en el punto proyectado
3. **Splits de cruce X** — segmentos que se cruzan en su interior se detectan y se parten en el punto de cruce, creando un nodo de unión compartido

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
    map.js            # Mapa Leaflet, UI, búsqueda, rutas, temas
old_maps/             # Versiones anteriores del GeoJSON (referencia)
```

## Licencia

MIT © Luis Xavier
