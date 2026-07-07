> 🇺🇸 English · [🇲🇽 Español](README.es.md)

> ⚠️ Independent project, not affiliated with Tecnológico de Monterrey. Map data from OpenStreetMap and public sources.

# Interactive Map — Campus GDL Tec de Monterrey ("Borrego Merodeador")

An interactive map of Tecnológico de Monterrey's Guadalajara campus to help students navigate the grounds. Displays buildings by category, supports search and filtering, provides walking route navigation along hand-drawn campus paths, and tracks the user's live location.

**Live:** https://luisxavierxd.github.io/MapaInteractivoTEC_GDL/

## Features

- **Building map** — polygons and POIs color-coded by category: Academic, Preparatoria, Sports, Dorms, LIFE, Food, Services, Commercial, Auditoriums, Other
- **Search & filter** — search by name, filter by category
- **Info panel** — click any building to see details; selected building is highlighted with a category pin marker
- **Walking navigation** — custom on-campus router using hand-drawn walkable paths; falls back to OSRM public routing if unavailable
- **Live location** — 🐏 sheep marker updated continuously via `watchPosition`; auto-starts on repeat visits; falls back to main entrance when outside campus bounds
- **Dark / light theme** toggle, persisted across sessions
- **Satellite / street map toggle**
- **Privacy notice** (LFPDPPP-compliant) with persistent consent and always-accessible button
- **Mobile-friendly** sidebar layout

## Stack

- **[Leaflet.js](https://leafletjs.com/)** — interactive maps library
- **[OpenStreetMap](https://www.openstreetmap.org/)** — base map tiles
- **[Esri World Imagery](https://www.arcgis.com/)** — satellite tile layer
- **Custom GeoJSON** — hand-curated building data and walkable path network
- **[OSRM](https://project-osrm.org/)** — public routing fallback (foot profile)

## Campus router

The routing engine (`assets/js/router.js`) builds a graph from GeoJSON LineStrings and runs multi-source Dijkstra. Topology is automatically resolved at load time:

1. **Endpoint gap closure** — LineString endpoints within 3 m of each other are connected
2. **T-intersection splits** — when a path endpoint lies within 3 m of another segment's interior, that segment is split at the projection point
3. **X-intersection splits** — segments that cross in their interiors are detected and split at the crossing point, creating a shared junction node

Route start/end points are projected onto the nearest segment rather than snapped to the nearest vertex, and all building entries are evaluated simultaneously as Dijkstra seeds so the globally optimal entry is chosen automatically.

## Data files

| File | Contents |
|------|----------|
| `data/campus.geojson` | Building polygons and POI points (rendered on map) |
| `data/paths.geojson` | Hand-drawn walkable LineStrings + building entry Points (router only, never rendered) |

## Running locally

A local HTTP server is required so `fetch()` works without CORS errors:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx, no install needed)
npx serve .

# VS Code: Live Server extension → right-click index.html → "Open with Live Server"
```

Then open [http://localhost:8080](http://localhost:8080).

## Structure

```
index.html
data/
  campus.geojson      # Building polygons + POIs (rendered)
  paths.geojson       # Walkable paths + entry points (router only)
assets/
  css/style.css
  js/
    router.js         # CampusRouter — graph build, topology fix, Dijkstra
    map.js            # Leaflet map, UI, search, routing UI, theming
old_maps/             # Previous GeoJSON iterations (reference only)
```

## License

MIT © Luis Xavier
