> 🇺🇸 English · [🇲🇽 Español](README.es.md)

# Interactive Map — Campus GDL Tec de Monterrey

Interactive map of Tecnológico de Monterrey's Guadalajara campus to help students navigate the grounds. Displays buildings by category, supports building search and filtering, and provides walking route navigation along hand-drawn campus paths.

## Features

- **Building map** — polygons and POIs rendered from custom GeoJSON, color-coded by category with the **Okabe–Ito** color-blind-safe palette (Academic, Preparatoria, Sports, Dorms, Food, Services, Commercial, Student life). Differential opacity keeps the map readable; permanent building labels appear past a zoom threshold.
- **Fuzzy search** — accent- and case-insensitive search powered by [Fuse.js](https://www.fusejs.io/), with per-building **aliases** (e.g. `A6`, `CETEC`), keyboard navigation (`↑ ↓ Enter Esc`) and the `/` shortcut.
- **Filter & browse** — single-row category chips; the list sorts by walking distance when GPS is on, otherwise alphabetically with sticky category headers.
- **Cross-highlight** — hovering a list item highlights the building on the map and vice-versa (fine pointers only).
- **Info panel** — tap any building for its details, then **Cómo llegar** (directions) or **Desde aquí**.
- **Walking navigation** — custom on-campus router over hand-drawn paths; falls back to public OSRM if path data is unavailable. Waze-style bottom bar with live re-routing.
- **My location + heading** — GPS marker with an optional device-orientation heading cone.
- **Light / dark theme** and a **streets / satellite** basemap toggle (the basemap follows the theme automatically).
- **Mobile bottom sheet** with three snap points (peek / half / full).
- **Installable PWA** — works offline after the first visit (see below).
- **Deep links** — `?b=cetec` opens a building; `?from=a6&to=cetec` opens a computed route.
- **Accessible** — WCAG-minded contrast, visible focus, ARIA combobox/listbox, focus trap, `prefers-reduced-motion`, 44px+ touch targets, landmarks.

## Stack

- **[Leaflet.js](https://leafletjs.com/)** — interactive maps library (canvas renderer)
- **[Fuse.js](https://www.fusejs.io/)** — fuzzy search (CDN, Subresource Integrity)
- **[CARTO basemaps](https://github.com/CartoDB/basemap-styles)** (Positron / Dark Matter) — street tiles
- **[Esri World Imagery](https://www.arcgis.com/)** — satellite tile layer
- **Custom GeoJSON** — hand-curated building data and walkable path network
- **[OSRM](https://project-osrm.org/)** — public routing fallback (foot profile)
- No framework, no build step — plain HTML/CSS/JS served statically (GitHub Pages friendly).

## Install as an app (offline)

The app is a PWA. On first visit it caches its shell, building data and router; after that it loads and lets you compute routes **with no connection** (the campus WiFi drops exactly when you need the map most). Map tiles are cached as you view them — use the **download** button in the header to pre-cache the campus tiles for full offline use.

- **Android/Chrome:** menu → *Add to Home screen*.
- **iOS/Safari:** Share → *Add to Home Screen*.

## Campus router

The routing engine (`assets/js/router.js`) builds a graph from GeoJSON LineStrings and runs multi-source Dijkstra. Topology is automatically resolved at load time:

1. **Endpoint gap closure** — LineString endpoints within 3 m of each other are connected
2. **T-intersection splits** — when a path endpoint lies within 3 m of another segment's interior, that segment is split at the projection point and the endpoint is connected to it
3. **X-intersection splits** — segments that cross in their interiors (no shared node in GeoJSON) are detected and split at the crossing point, creating a shared junction node

Route start/end points are projected onto the nearest segment rather than snapped to the nearest vertex, and all building entries are evaluated simultaneously as Dijkstra seeds so the globally optimal entry is chosen automatically.

## Data files

| File | Contents |
|------|----------|
| `data/campus.geojson` | Building polygons and POI points (rendered on map) |
| `data/paths.geojson` | Hand-drawn walkable LineStrings + building entry Points (router only, never rendered) |

Both files are minified and coordinates are rounded to 6 decimals (~11 cm) to save bandwidth.

### The `aliases` field

To make search find a building by its nickname or short code, add an `aliases` array to that feature's `properties` in `data/campus.geojson`:

```json
{ "type": "Feature",
  "properties": { "name": "Edificio 6 (Prepa)", "aliases": ["A6", "aulas 6", "prepa"] },
  "geometry": { "...": "..." } }
```

Aliases are normalized (accent/case-insensitive) and weighted below the name in the search index. Add as many as you like.

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
manifest.webmanifest  # PWA manifest
sw.js                 # Service worker (offline cache)
data/
  campus.geojson      # Building polygons + POIs (rendered)
  paths.geojson       # Walkable paths + entry points (router only)
assets/
  css/
    tokens.css        # Design system: colors, palette, type, spacing (single source of truth)
    style.css         # Components, layout, responsive, themes
  img/                # PWA icons (192/512)
  js/
    router.js         # CampusRouter — graph build, topology fix, Dijkstra (ES module, lazy-loaded)
    map.js            # Leaflet map, UI, search, routing, sheet, PWA
```

## License

MIT © Luis Xavier
