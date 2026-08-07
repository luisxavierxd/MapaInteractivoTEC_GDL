'use strict';
/* ============================================================
   map.js — Borrego Merodeador
   Vanilla JS + Leaflet. El mapa es la figura; la UI, el marco.
   ============================================================ */

const $  = (id) => document.getElementById(id);
const mq = (q) => window.matchMedia(q);
const FINE_POINTER = () => mq('(hover: hover) and (pointer: fine)').matches;
const REDUCED_MOTION = () => mq('(prefers-reduced-motion: reduce)').matches;
const WALK_SPEED = 1.35; // m/s — velocidad peatonal (Fase 3.2)

/* ── Categorías: etiqueta + icono (SVG, no emoji) ───────────
   El color es la ÚNICA fuente de verdad y vive en tokens.css.
   categoryColor() lo resuelve una sola vez (necesario para canvas). */
const ICONS = {
  academic:   '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5"/>',
  school:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  sports:     '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  dorm:       '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>',
  food:       '<path d="M7 3v18"/><path d="M4 3v6a3 3 0 0 0 6 0V3"/><path d="M17 3c-1.6 0-2.7 2-2.7 5s1.1 4 2.7 4v9"/>',
  services:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5 5l4.2 4.2M14.8 14.8 19 19M19 5l-4.2 4.2M9.2 14.8 5 19"/>',
  commercial: '<path d="M6 2 4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6l-2-4Z"/><path d="M4 6h16"/><path d="M15 10a3 3 0 0 1-6 0"/>',
  other:      '<path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};
const CATEGORY_STYLE = {
  academic:   { label: 'Académico'    },
  school:     { label: 'Preparatoria' },
  sports:     { label: 'Deportes'     },
  dorm:       { label: 'Residencias'  },
  food:       { label: 'Comida'       },
  services:   { label: 'Servicios'    },
  commercial: { label: 'Comercial'    },
  other:      { label: 'Vida estudiantil' },
};
const ORDER = ['academic','school','sports','dorm','food','services','commercial','other'];

// Aplica el tema ANTES de leer los colores, para que las variantes de modo
// oscuro (p. ej. --cat-commercial-line) se resuelvan con el valor correcto.
try { if (localStorage.getItem('bm.theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch {}

// Resolver colores de CSS una vez (canvas no entiende var()).
const _cs = getComputedStyle(document.documentElement);
function cssVar(name) { return _cs.getPropertyValue(name).trim(); }
const CAT_COLOR = {}, CAT_LINE = {};
for (const k of ORDER) { CAT_COLOR[k] = cssVar(`--cat-${k}`); CAT_LINE[k] = cssVar(`--cat-${k}-line`); }
function categoryColor(cat) { return CAT_COLOR[cat] || CAT_COLOR.other; }
function categoryLine(cat)  { return CAT_LINE[cat]  || CAT_LINE.other; }
function catIcon(cat, size = 22) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[cat] || ICONS.other}</svg>`;
}

/* ── Clasificación de categoría (derivada, no almacenada) ──── */
function getCategory(p) {
  const b = p.building, a = p.amenity;
  const n = (p.name || '').toLowerCase();
  if (['restaurant','cafe','fast_food','food_court','ice_cream'].includes(a) || p.cuisine) return 'food';
  if (b === 'commercial' || p.shop) return 'commercial';
  if (b === 'dormitory') return 'dorm';
  if (/alberca|atletismo|f[uú]tbol|tenis|padel|domo|gimna|borregos|e.?sport|ping|ajedrez|vestidor|ducha|gradas|cancha|futbolito|crossfit|voley|ejercicio/.test(n)) return 'sports';
  if (/cafeter[ií]a|güich|guich|chilaquiles|gongcha|c[oó]rdoba|kiosko|cocina|comedor|area.de.comer|juvijues|yum/.test(n)) return 'food';
  if (/tec.?store|bazar|copiroyal|papeler[ií]a|oxxo/.test(n)) return 'commercial';
  if (/caseta|entrada|salida|acceso|admisi[oó]n|direcci[oó]n|rector|administrativ|bienestar|social|lactancia|locatec|tecmed|congresos|difusi[oó]n|biciclet|elevador|herramienta|impresora|mentor|soporte|it.?support|servicios?|services|mantenimiento|movilidad|planta.*(agua|tratamiento)/.test(n)) return 'services';
  if (/auditorio|biblioteca|cosas perdidas|sal[oó]n|salas?|piano/.test(n)) return 'services';
  // El Centro de Emprendimiento es building=university → cae en 'academic' abajo.
  if (/prepa/.test(n) || b === 'school') return 'school';
  if (b === 'university') return 'academic';
  if (/ingenier[ií]|eiad/.test(n)) return 'academic';
  return 'other';
}
// Etiquetas mayores (visibles a menor zoom para no encabalgar). Los
// sub-edificios ("Edificio 4-3") pasan a menores para reducir el solape.
function isMajor(cat, name) {
  const n = name || '';
  if (/\d+\s*-\s*\d+/.test(n)) return false;
  return cat === 'academic' || cat === 'school' ||
    /auditorio|biblioteca|congresos|card|rector|residencias|eiad|ems|pabell/i.test(n);
}

function normalize(s) {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function centroid(geometry) {
  if (geometry.type === 'Point') return [geometry.coordinates[1], geometry.coordinates[0]];
  // Polygon -> primer anillo; MultiPolygon -> primer anillo del primer polígono.
  const ring = geometry.type === 'MultiPolygon' ? geometry.coordinates[0][0] : geometry.coordinates[0];
  let lat = 0, lng = 0;
  for (const [x, y] of ring) { lng += x; lat += y; }
  return [lat / ring.length, lng / ring.length];
}
function fmtDist(m) { return m < 1000 ? `${Math.round(m/10)*10} m` : `${(m/1000).toFixed(1)} km`; }
function fmtTime(m) { const min = Math.max(1, Math.round(m / WALK_SPEED / 60)); return `${min} min`; }

/* ── Detalle: etiquetas humanas ────────────────────────────── */
function humanLabel(key) {
  return ({ building:'Tipo', amenity:'Servicio', cuisine:'Cocina', opening_hours:'Horario',
    website:'Web', wheelchair:'Accesible', 'building:levels':'Pisos', outdoor_seating:'Terraza' })[key] || key;
}
function humanValue(key, val) {
  if (key === 'wheelchair') return ({ yes:'Sí', no:'No', limited:'Parcial' }[val] || val);
  if (key === 'outdoor_seating') return val === 'yes' ? 'Sí' : 'No';
  if (key === 'website') return `<a href="${val}" target="_blank" rel="noopener">${val.replace(/^https?:\/\//,'')}</a>`;
  if (key === 'building') return ({ university:'Universidad', school:'Escuela', dormitory:'Residencias',
    commercial:'Comercial', house:'Casa', yes:'Edificio', terrace:'Terraza', roof:'Techo',
    residential:'Residencial', guardhouse:'Caseta' }[val] || val);
  if (key === 'amenity') return ({ restaurant:'Restaurante', cafe:'Café', fast_food:'Comida rápida',
    food_court:'Patio de comidas', library:'Biblioteca', bank:'Banco', pharmacy:'Farmacia',
    clinic:'Clínica', toilets:'Baños', fuel:'Gasolinera', ice_cream:'Heladería', shelter:'Refugio' }[val] || val);
  return val;
}

/* ── Tema + basemap ────────────────────────────────────────── */
const LS = { theme:'bm.theme', basemap:'bm.basemap', onboard:'bm.onboarded' };
const load = k => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k,v) => { try { localStorage.setItem(k,v); } catch {} };

const TILE_ATTR_CARTO = '&copy; OpenStreetMap &copy; CARTO';
const tiles = {
  light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom:20, attribution: TILE_ATTR_CARTO }),
  dark:  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',  { maxZoom:20, attribution: TILE_ATTR_CARTO }),
  satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:20, attribution: 'Tiles &copy; Esri' }),
};
// Miniaturas sintéticas (offline-safe, <1KB) para el toggle de capas.
const THUMB = {
  satelite: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%233b5a34'/%3E%3Ccircle cx='16' cy='18' r='12' fill='%234a6b3f'/%3E%3Ccircle cx='41' cy='31' r='14' fill='%235c7a4a'/%3E%3Crect x='30' y='6' width='10' height='10' fill='%237a6b52'/%3E%3Crect x='6' y='40' width='12' height='9' fill='%238a7a5e'/%3E%3C/svg%3E\")",
  calles:   "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23eceff1'/%3E%3Crect y='22' width='56' height='7' fill='%23fff'/%3E%3Crect x='24' width='7' height='56' fill='%23fff'/%3E%3Crect x='4' y='4' width='14' height='14' fill='%23cfe8d0'/%3E%3Crect x='38' y='34' width='14' height='16' fill='%23d9e2e6'/%3E%3C/svg%3E\")",
};

let theme      = load(LS.theme)   === 'dark' ? 'dark' : 'light';
let basemapKind = load(LS.basemap) === 'satelite' ? 'satelite' : 'calles';

function activeTileKey() { return basemapKind === 'satelite' ? 'satelite' : (theme === 'dark' ? 'dark' : 'light'); }
function applyBasemap() {
  for (const t of Object.values(tiles)) if (map.hasLayer(t)) map.removeLayer(t);
  tiles[activeTileKey()].addTo(map).bringToBack();
  $('map').classList.toggle('satellite', basemapKind === 'satelite');
  // El toggle muestra la vista ALTERNATIVA
  const alt = basemapKind === 'satelite' ? 'calles' : 'satelite';
  $('layer-toggle').querySelector('.layer-thumb').style.backgroundImage = THUMB[alt];
  $('layer-toggle').querySelector('.layer-label').textContent = alt === 'satelite' ? 'Satélite' : 'Calles';
  $('layer-toggle').setAttribute('aria-label', `Cambiar a vista ${alt === 'satelite' ? 'satélite' : 'de calles'}`);
}
function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  $('meta-theme-color').setAttribute('content', t === 'dark' ? '#14181B' : '#FFFFFF');
  save(LS.theme, t);
  applyBasemap();
}

/* ── Init mapa ─────────────────────────────────────────────── */
document.documentElement.setAttribute('data-theme', theme);
$('meta-theme-color').setAttribute('content', theme === 'dark' ? '#14181B' : '#FFFFFF');

const map = L.map('map', {
  preferCanvas: true,            // 147 features: canvas > SVG en gama media
  zoomControl: false,
  minZoom: 3, maxZoom: 20,       // zoom libre; el botón de centrar regresa al campus
  attributionControl: true,
}).setView([20.7347, -103.4538], 16);

applyBasemap();

$('theme-toggle').addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark'));
$('layer-toggle').addEventListener('click', () => {
  basemapKind = basemapKind === 'satelite' ? 'calles' : 'satelite';
  save(LS.basemap, basemapKind);
  applyBasemap();
});
$('recenter-btn').addEventListener('click', () => {
  const anim = !REDUCED_MOTION();
  if (navPath && navPath.length) {              // hay ruta activa → encuadra la ruta
    const isMobile = mq('(max-width:768px)').matches;
    map.fitBounds(L.polyline(navPath).getBounds(), {
      paddingTopLeft: isMobile ? [30, 30] : [$('sidebar').offsetWidth + 30, 30],
      paddingBottomRight: [30, isMobile ? Math.round(window.innerHeight * 0.35) : 30],
      animate: anim,
    });
  } else if (campusBounds) {                     // si no, todo el campus
    map.fitBounds(campusBounds, { padding: [24, 24], animate: anim });
  }
});

/* ── Estilos (opacidad diferencial, Fase 2.1) ──────────────── */
// Polígonos y puntos necesitan estilos base distintos: un punto con
// fillOpacity .18 y sin radio queda invisible. Cada revert elige según el tipo.
const STYLE_BASE = (cat) => ({ color: categoryLine(cat), weight: 2, opacity: .9, fillColor: categoryColor(cat), fillOpacity: .18 });
const STYLE_HOVER    = { weight: 3,   fillOpacity: .42 };
const STYLE_SELECTED = { weight: 3.5, fillOpacity: .55 };
const STYLE_DIMMED   = { weight: 1,   opacity: .35, fillOpacity: .05 };
const PT_BASE = (cat) => ({ radius: 6, color: categoryLine(cat), weight: 2, opacity: .9, fillColor: categoryColor(cat), fillOpacity: .7 });
const PT_HOVER    = { radius: 7, weight: 3, fillOpacity: .9 };
const PT_SELECTED = { radius: 7, weight: 3, fillOpacity: .95 };
const PT_DIMMED   = { radius: 5, weight: 1, opacity: .35, fillOpacity: .15 };

const isPoint = (layer) => layer instanceof L.CircleMarker;
const baseStyle = (layer) => isPoint(layer) ? PT_BASE(layer.feature.properties._cat) : STYLE_BASE(layer.feature.properties._cat);
const hoverStyle = (layer) => isPoint(layer) ? PT_HOVER : STYLE_HOVER;
const selStyle = (layer) => isPoint(layer) ? PT_SELECTED : STYLE_SELECTED;
const dimStyle = (layer) => isPoint(layer) ? PT_DIMMED : STYLE_DIMMED;
// Revierte al estilo que corresponde por estado (filtro / selección).
function revertStyle(layer) {
  if (layer === selectedLayer) { layer.setStyle(selStyle(layer)); return; }
  const on = activeFilter === 'all' || layer.feature.properties._cat === activeFilter;
  layer.setStyle(on ? baseStyle(layer) : dimStyle(layer));
}
// Mantiene los puntos por encima de los polígonos (selectables aunque estén dentro).
function pointsToFront() { geoLayer.eachLayer(l => { if (isPoint(l)) l.bringToFront(); }); }

/* ── Estado ────────────────────────────────────────────────── */
let allFeatures = [], buildings = [];   // buildings: registros enriquecidos para búsqueda/orden
let campusRouter = null, entryPoints = [];
let fuse = null;
let activeFilter = 'all';
let selectedLayer = null, activeFeature = null;
let userLocation = null, userMarker = null, userHeading = null;
let campusBounds = null;      // encuadre del campus para el botón de centrar
let mainEntrance = null;      // [lat,lng] de "Entrada principal" (snap si estás fuera)
const registry = new Map();   // _fid -> { feature, layer, item }

/* ── Capa GeoJSON ──────────────────────────────────────────── */
const geoLayer = L.geoJSON(null, {
  style: (f) => STYLE_BASE(getCategory(f.properties)),
  pointToLayer: (f, latlng) => L.circleMarker(latlng, PT_BASE(getCategory(f.properties))),
  onEachFeature(f, layer) {
    const p = f.properties;
    layer.on('click', () => onBuildingClick(f, layer, false));
    layer.on('keypress', (e) => { if (e.originalEvent.key === 'Enter') onBuildingClick(f, layer, false); });
    // Cross-highlight solo en punteros finos (Fase 3.3)
    layer.on('mouseover', () => { if (FINE_POINTER()) highlight(p._fid, 'map'); });
    layer.on('mouseout',  () => { if (FINE_POINTER()) unhighlight(p._fid); });
    // Etiqueta permanente para polígonos con nombre (Fase 2.5)
    if (f.geometry.type === 'Polygon' && p.name) {
      const cat = getCategory(p);
      layer.bindTooltip(p.name, { permanent: true, direction: 'center', className: `bldg-label ${isMajor(cat, p.name) ? 'major' : 'minor'}`, opacity: 1 });
    }
  },
});

/* ── Router: carga diferida (Fase 8.1) ─────────────────────── */
// router.js (grafo + Dijkstra) y paths.geojson solo se cargan la primera
// vez que el usuario pide una ruta, vía import() dinámico.
let routerReady = null;
function ensureRouter() {
  if (routerReady) return routerReady;
  routerReady = (async () => {
    const [{ CampusRouter }, data] = await Promise.all([
      import('./router.js'),   // relativo a map.js (/assets/js/)
      fetch('data/paths.geojson').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]);
    entryPoints = data.features.filter(f => f.geometry.type === 'Point')
      .map(f => ({ name: normalize(f.properties.name || ''), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
    campusRouter = new CampusRouter();
    campusRouter.load(data);
  })().catch(err => { console.error('[Router] carga falló:', err); routerReady = null; });
  return routerReady;
}

/* ── Carga de edificios ────────────────────────────────────── */
fetch('data/campus.geojson')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    data.features.forEach((f, i) => {
      const p = f.properties;
      p._fid = p['@id'] || `local_${i}`;
      p._cat = getCategory(p);
      p._center = centroid(f.geometry);
    });
    // "Entrada principal": destino del snap cuando el usuario está fuera del campus.
    const meFeat = data.features.find(f => normalize(f.properties.name || '') === 'entrada principal');
    if (meFeat) mainEntrance = meFeat.properties._center;

    // Los puntos de entrada del router ("Entrada …") son ayudas de navegación,
    // no destinos: no se renderizan ni entran a la lista/búsqueda.
    const isEntryPoint = (f) => f.geometry.type === 'Point' && normalize(f.properties.name || '').startsWith('entrada');
    allFeatures = data.features.filter(f => !isEntryPoint(f));
    buildings = allFeatures.filter(f => f.properties.name).map(f => {
      const p = f.properties;
      const aliases = Array.isArray(p.aliases) ? p.aliases : [];
      return {
        fid: p._fid, feature: f, name: p.name, cat: p._cat,
        nameNorm: normalize(p.name),
        aliasesNorm: [p.alt_name, p.short_name, ...aliases].filter(Boolean).map(normalize).join(' '),
        categoryNorm: normalize(CATEGORY_STYLE[p._cat].label),
      };
    });

    geoLayer.addData({ type: 'FeatureCollection', features: allFeatures }).addTo(map);
    // Los puntos van por ENCIMA de la geometría: en canvas, bringToFront los
    // pone al final del orden de dibujo, así son visibles y seleccionables
    // aunque caigan dentro de un polígono (el hit-test elige el último).
    pointsToFront();
    // Sin maxBounds: el usuario puede moverse/zoom libremente; el botón de
    // centrar (recenter) reencuadra el campus cuando quiera.
    campusBounds = geoLayer.getBounds();
    map.fitBounds(campusBounds, { padding: [24, 24] });

    // Índice de búsqueda (Fase 4.1)
    if (window.Fuse) fuse = new Fuse(buildings, {
      keys: [{ name:'nameNorm', weight:.7 }, { name:'aliasesNorm', weight:.25 }, { name:'categoryNorm', weight:.05 }],
      threshold: .35, ignoreLocation: true, minMatchCharLength: 2,
    });

    buildChips();
    renderList();
    syncLabels();
    handleDeepLink();
  })
  .catch(err => console.error('Error cargando GeoJSON:', err));

/* ── Etiquetas por umbral de zoom (Fase 2.5) ───────────────── */
const LABEL_MIN_ZOOM = 17, LABEL_ALL_ZOOM = 18;
function syncLabels() {
  const z = map.getZoom();
  const m = $('map');
  m.classList.toggle('labels-off', z < LABEL_MIN_ZOOM);
  m.classList.toggle('labels-all', z >= LABEL_ALL_ZOOM);
}
map.on('zoomend', syncLabels);

/* ── Chips de filtro (Fase 3.1) ────────────────────────────── */
function buildChips() {
  const counts = {};
  for (const f of allFeatures) counts[f.properties._cat] = (counts[f.properties._cat] || 0) + 1;
  const row = $('chip-row');
  row.innerHTML = '';
  for (const key of ORDER) {
    if (!counts[key]) continue;
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.filter = key;
    btn.setAttribute('aria-pressed', 'false');
    btn.style.setProperty('--chip-color', categoryColor(key));
    btn.innerHTML = `<span class="chip-dot" aria-hidden="true"></span>${CATEGORY_STYLE[key].label} <span class="chip-count">${counts[key]}</span>`;
    btn.addEventListener('click', () => applyFilter(activeFilter === key ? 'all' : key));
    row.appendChild(btn);
  }
  $('filter-reset').addEventListener('click', () => applyFilter('all'));
}
function applyFilter(key) {
  activeFilter = key;
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.filter === key)));
  $('filter-reset').hidden = key === 'all';
  renderList();
  updateMapDim();
}
function updateMapDim() {
  registry.forEach(({ layer }) => revertStyle(layer));
}

/* ── Lista de edificios (Fase 3.2) ─────────────────────────── */
// 147 features renderizados de golpe es correcto; virtualizar solo si el
// dataset supera ~400 elementos.
function currentSet() {
  return buildings.filter(b => activeFilter === 'all' || b.cat === activeFilter);
}
function renderList() {
  const ul = $('building-list');
  ul.innerHTML = '';
  registry.forEach(v => { v.item = null; });
  let set = currentSet();

  if (!set.length) { ul.innerHTML = '<li class="list-empty">Sin resultados en esta categoría.</li>'; return; }

  // Siempre agrupado por tipo con separadores. Dentro de cada grupo se ordena
  // por distancia si hay GPS; si no, alfabéticamente.
  const hasLoc = !!userLocation;
  if (hasLoc) set = set.map(b => ({ ...b, dist: haversine(userLocation.lat, userLocation.lng, b.feature.properties._center[0], b.feature.properties._center[1]) }));
  const sortFn = hasLoc ? (a, b) => a.dist - b.dist : (a, b) => a.name.localeCompare(b.name, 'es');

  const addGroup = (list) => { for (const b of list.sort(sortFn)) ul.appendChild(itemEl(b, hasLoc ? b.dist : null)); };

  if (activeFilter === 'all') {
    for (const key of ORDER) {
      const group = set.filter(b => b.cat === key);
      if (!group.length) continue;
      const h = document.createElement('li');
      h.className = 'cat-header';
      h.textContent = CATEGORY_STYLE[key].label;
      ul.appendChild(h);
      addGroup(group);
    }
  } else {
    addGroup(set);   // ya es un solo tipo (chip activo)
  }
}
function itemEl(b, dist) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.className = 'bldg-item';
  btn.dataset.id = b.fid;
  if (activeFeature && activeFeature.properties._fid === b.fid) btn.classList.add('active');
  // -line (oscurecido) para que el glifo cumpla contraste incluso en amarillo
  btn.style.setProperty('--item-color', categoryLine(b.cat));
  const meta = dist != null
    ? `${CATEGORY_STYLE[b.cat].label} · <span class="dist">${fmtDist(dist)} · ${fmtTime(dist)}</span>`
    : CATEGORY_STYLE[b.cat].label;
  btn.innerHTML = `<span class="bldg-ic">${catIcon(b.cat, 20)}</span>
    <span class="bldg-txt"><span class="bldg-name">${b.name}</span><span class="bldg-sub">${meta}</span></span>`;
  btn.addEventListener('click', () => { const r = registry.get(b.fid); if (r) onBuildingClick(r.feature, r.layer, true); });
  if (FINE_POINTER()) {
    btn.addEventListener('mouseover', () => highlight(b.fid, 'list'));
    btn.addEventListener('mouseout',  () => unhighlight(b.fid));
  }
  li.appendChild(btn);
  const r = registry.get(b.fid); if (r) r.item = btn;
  return li;
}

/* ── Registro id → { feature, layer, item } ────────────────── */
function buildRegistry() {
  geoLayer.eachLayer(layer => {
    const p = layer.feature.properties;
    registry.set(p._fid, { feature: layer.feature, layer, item: null });
  });
}
geoLayer.on('add', buildRegistry);

/* ── Cross-highlight lista ↔ mapa (Fase 3.3) ───────────────── */
function highlight(id, source) {
  const r = registry.get(id); if (!r) return;
  if (r.layer !== selectedLayer) r.layer.setStyle(hoverStyle(r.layer));
  if (r.item) {
    r.item.classList.add('is-hot');
    if (source === 'map') r.item.scrollIntoView({ block: 'center', behavior: REDUCED_MOTION() ? 'auto' : 'smooth' });
  }
}
function unhighlight(id) {
  const r = registry.get(id); if (!r) return;
  if (r.layer !== selectedLayer) revertStyle(r.layer);
  if (r.item) r.item.classList.remove('is-hot');
}

/* ── Selección + ficha ─────────────────────────────────────── */
function onBuildingClick(feature, layer, fromList) {
  if (routeSelecting) { assignRouteEndpoint(feature); return; }
  selectBuilding(feature, layer);
  focusBuilding(layer, feature);
  if (!fromList) {
    const r = registry.get(feature.properties._fid);
    if (r && r.item) r.item.scrollIntoView({ block: 'center', behavior: REDUCED_MOTION() ? 'auto' : 'smooth' });
  }
  setDeepLink({ b: shortId(feature) });
}
function selectBuilding(feature, layer) {
  const prev = selectedLayer;
  selectedLayer = layer; activeFeature = feature;
  if (prev && prev !== layer) revertStyle(prev);
  layer.setStyle(selStyle(layer));
  if (!isPoint(layer)) { layer.bringToFront(); pointsToFront(); }  // puntos siempre arriba
  document.querySelectorAll('.bldg-item').forEach(el => el.classList.toggle('active', el.dataset.id === feature.properties._fid));
  showInfo(feature);
  if (mq('(max-width: 768px)').matches) snapSheet(0);   // peek: deja ver la ficha y el mapa
}
function focusBuilding(layer, feature) {
  const isMobile = mq('(max-width: 768px)').matches;
  const b = layer.getBounds ? layer.getBounds() : L.latLngBounds([feature.properties._center, feature.properties._center]);
  const pad = isMobile
    ? { paddingTopLeft: [20, 20], paddingBottomRight: [20, Math.round(window.innerHeight * 0.5)] }
    : { paddingTopLeft: [$('sidebar').offsetWidth + 24, 24], paddingBottomRight: [24, 24] };
  const opts = { ...pad, maxZoom: 19 };
  if (REDUCED_MOTION() || !layer.getBounds) map.fitBounds(b, opts);
  else map.flyToBounds(b, { ...opts, duration: .6 });
}

const INFO_KEYS = ['building','amenity','cuisine','opening_hours','website','building:levels','wheelchair','outdoor_seating'];
function showInfo(feature) {
  const p = feature.properties, cat = p._cat;
  $('info-name').textContent = p.name || 'Sin nombre';
  const badge = $('info-category');
  badge.innerHTML = `<span class="badge-ic">${catIcon(cat, 14)}</span> ${CATEGORY_STYLE[cat].label}`;
  badge.style.setProperty('--cat-color', categoryLine(cat));
  const fields = $('info-fields'); fields.innerHTML = '';
  for (const key of INFO_KEYS) {
    if (!p[key]) continue;
    const div = document.createElement('div'); div.className = 'info-field';
    div.innerHTML = `<span class="info-field-label">${humanLabel(key)}</span><span>${humanValue(key, p[key])}</span>`;
    fields.appendChild(div);
  }
  if (p.alt_name) {
    const div = document.createElement('div'); div.className = 'info-field';
    div.innerHTML = `<span class="info-field-label">También</span><span>${p.alt_name}</span>`;
    fields.appendChild(div);
  }
  const panel = $('info-panel');
  panel.classList.remove('hidden');
  panel.setAttribute('tabindex', '-1');
  panel.focus({ preventScroll: true });   // anuncia el diálogo al lector de pantalla
  document.body.classList.add('info-open');
}
$('info-close').addEventListener('click', () => { const l = selectedLayer; deselect(); if (l) { const r = registry.get(l.feature.properties._fid); r?.item?.focus(); } });
// Esc cierra la ficha (Fase 7 · escape-routes)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('info-panel').classList.contains('hidden') && onboard.hidden) deselect();
});
function deselect() {
  $('info-panel').classList.add('hidden');
  document.body.classList.remove('info-open');
  if (selectedLayer) {
    const prev = selectedLayer;
    selectedLayer = null; activeFeature = null;
    revertStyle(prev);
  }
  document.querySelectorAll('.bldg-item').forEach(el => el.classList.remove('active'));
  setDeepLink({});
}

/* ── Búsqueda (Fase 4) ─────────────────────────────────────── */
const searchInput = $('search'), searchResults = $('search-results'), searchClear = $('search-clear');
let srActive = -1, srItems = [];
let searchTimer = null;

searchInput.addEventListener('input', () => {
  searchClear.hidden = !searchInput.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 120);   // debounce
});
searchClear.addEventListener('click', () => { searchInput.value = ''; searchClear.hidden = true; closeResults(); searchInput.focus(); });

function runSearch() {
  const q = searchInput.value.trim();
  if (!q) { closeResults(); return; }
  const res = fuse ? fuse.search(normalize(q), { limit: 8 }) : [];
  searchResults.innerHTML = '';
  srItems = []; srActive = -1;
  searchInput.removeAttribute('aria-activedescendant');   // opción activa anterior ya no existe
  if (!res.length) {
    searchResults.innerHTML = `<li class="sr-empty">No encontramos <b>«${q}»</b>. Prueba con el nombre corto, como <b>A6</b> o <b>CETEC</b>.</li>`;
    openResults(); searchInput.removeAttribute('aria-activedescendant'); return;
  }
  for (const { item } of res) {
    const li = document.createElement('li');
    li.className = 'sr-item'; li.id = `sr-${item.fid}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
    li.style.setProperty('color', categoryLine(item.cat));
    li.innerHTML = `<span class="sr-ic">${catIcon(item.cat, 20)}</span><span class="sr-name">${item.name}</span><span class="sr-cat">${CATEGORY_STYLE[item.cat].label}</span>`;
    li.addEventListener('click', () => chooseResult(item.fid));
    searchResults.appendChild(li); srItems.push(li);
  }
  openResults();
}
function openResults() { searchResults.hidden = false; searchInput.setAttribute('aria-expanded', 'true'); }
function closeResults() { searchResults.hidden = true; searchInput.setAttribute('aria-expanded', 'false'); searchInput.removeAttribute('aria-activedescendant'); srItems = []; srActive = -1; }
function setActive(i) {
  if (!srItems.length) return;
  srActive = (i + srItems.length) % srItems.length;
  srItems.forEach((el, idx) => el.setAttribute('aria-selected', String(idx === srActive)));
  const el = srItems[srActive];
  el.scrollIntoView({ block: 'nearest' });
  searchInput.setAttribute('aria-activedescendant', el.id);
}
function chooseResult(fid) {
  const r = registry.get(fid); if (!r) return;
  closeResults(); searchInput.blur();
  onBuildingClick(r.feature, r.layer, true);
}
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (searchResults.hidden) runSearch(); else setActive(srActive + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(srActive - 1); }
  else if (e.key === 'Enter') { if (srActive >= 0 && srItems[srActive]) { e.preventDefault(); chooseResult(srItems[srActive].id.slice(3)); } }
  else if (e.key === 'Escape') { if (!searchResults.hidden) closeResults(); else { searchInput.value = ''; searchClear.hidden = true; } }
});
document.addEventListener('click', (e) => { if (!$('search-region').contains(e.target)) closeResults(); });
// Atajo global "/"
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
    e.preventDefault(); searchInput.focus();
  }
});

/* ── Flujo de ruta (Fase 6) ────────────────────────────────── */
let routeFrom = null, routeTo = null, routeLayer = null, routeSelecting = null; // 'from'|'to'|'auto'
let navPath = null, casingLine = null, doneLine = null, pendingLine = null;
let watchId = null;   // watchPosition persistente: avatar que sigue + progreso de ruta

function shortId(f) { return normalize(f.properties.name || f.properties._fid).replace(/\s+/g, '-').slice(0, 40); }
function epLatLng(ep) { return ep._isLocation ? [ep.lat, ep.lng] : ep.feature.properties._center; }
function epName(ep) { return ep ? (ep._isLocation ? ep.name : ep.feature.properties.name) : null; }

function openRouteView() { $('route-view').hidden = false; if (mq('(max-width:768px)').matches) snapSheet(1); }
function closeRouteView() { $('route-view').hidden = true; }

let routeReqId = 0;   // invalida resoluciones de GPS tardías que llegarían a destiempo
$('route-back').addEventListener('click', closeRouteView);
$('btn-directions').addEventListener('click', async () => {
  if (!activeFeature) return;
  const myReq = ++routeReqId;
  routeTo = { feature: activeFeature }; routeFrom = null; deselect();
  openRouteView(); updateRouteUI();
  if (userLocation) {                          // ubicación ya conocida → úsala directo
    routeFrom = { _isLocation: true, ...userLocation, name: 'Mi ubicación' };
    updateRouteUI(); tryRoute(); return;
  }
  // Desconocida: pide el origen en el mapa/lista DE INMEDIATO (no bloquea) y,
  // en paralelo, intenta el GPS; si llega antes de que elijas, lo usa.
  startSelect('from');
  const loc = await getUserLocation();
  if (myReq !== routeReqId || routeFrom) return;   // hubo otra acción o ya elegiste origen
  if (loc) { stopSelect(); routeFrom = { _isLocation: true, ...loc, name: 'Mi ubicación' }; updateRouteUI(); tryRoute(); }
});
$('btn-set-from').addEventListener('click', () => {
  ++routeReqId;
  if (!activeFeature) return;
  routeFrom = { feature: activeFeature }; routeTo = null; deselect();
  openRouteView(); startSelect('to'); updateRouteUI();
});
$('route-select-toggle').addEventListener('click', () => { ++routeReqId; startSelect('auto'); });
$('route-select-cancel').addEventListener('click', () => stopSelect());
$('clear-from').addEventListener('click', () => { routeFrom = null; clearRoute(); updateRouteUI(); });
$('clear-to').addEventListener('click', () => { routeTo = null; clearRoute(); updateRouteUI(); });
$('route-swap').addEventListener('click', () => { [routeFrom, routeTo] = [routeTo, routeFrom]; updateRouteUI(); tryRoute(); });

function startSelect(side) {
  routeSelecting = side;
  // Oculta la capa de ruta para dejar visible la lista y la búsqueda: así el
  // punto puede elegirse desde el teclado (lista/búsqueda), no solo tocando el mapa.
  $('route-view').hidden = true;
  const badge = $('route-select-badge'); badge.hidden = false;
  $('route-select-text').textContent = side === 'to'
    ? 'Elige el destino en la lista o el mapa' : 'Elige el origen en la lista o el mapa';
  if (mq('(max-width:768px)').matches) snapSheet(1);
}
function stopSelect() {
  routeSelecting = null;
  $('route-select-badge').hidden = true;
  if (routeFrom || routeTo) openRouteView();
}
function assignRouteEndpoint(feature) {
  const ep = { feature };
  if (routeSelecting === 'to') { routeTo = ep; stopSelect(); }
  else if (routeSelecting === 'from') { routeFrom = ep; stopSelect(); }
  else { // auto
    if (!routeFrom) { routeFrom = ep; $('route-select-text').textContent = 'Toca un edificio para el destino'; }
    else { routeTo = ep; stopSelect(); }
  }
  updateRouteUI(); tryRoute();
}
function updateRouteUI() {
  const set = (id, ep) => {
    const el = $(id);
    if (ep) { el.textContent = epName(ep); el.classList.remove('placeholder'); }
    else { el.textContent = 'Selecciona en el mapa'; el.classList.add('placeholder'); }
  };
  set('route-from-name', routeFrom); set('route-to-name', routeTo);
}
function tryRoute() { if (routeFrom && routeTo) fetchRoute(); }

function getEntries(ep) {
  if (!ep || ep._isLocation) return [];
  const name = normalize(ep.feature.properties.name || '');
  if (!name || name.startsWith('entrada ')) return [];
  return entryPoints.filter(e => e.name.includes(name)).map(e => [e.lat, e.lng]);
}
async function fetchRoute(silent) {
  if (!routeFrom || !routeTo) return;
  const [fLat, fLng] = epLatLng(routeFrom), [tLat, tLng] = epLatLng(routeTo);
  await ensureRouter();
  if (campusRouter) {
    const result = campusRouter.route(fLat, fLng, tLat, tLng, getEntries(routeFrom), getEntries(routeTo));
    if (result) { drawRoute(result.path); showNav(result.distance, epName(routeTo)); }
    else if (!silent) showRouteError();
    return;
  }
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`;
    const data = await (await fetch(url)).json();
    if (data.code !== 'Ok') throw new Error(data.code);
    const rt = data.routes[0];
    drawRoute(rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
    showNav(rt.distance, epName(routeTo));
  } catch (err) { console.error('OSRM error:', err); if (!silent) showRouteError(); }
}
function drawRoute(latlngs) {
  clearRouteLayer();
  navPath = latlngs;
  routeLayer = L.layerGroup().addTo(map);
  // Tres líneas superpuestas (Fase 6.3): casing blanco de fondo, tramo
  // recorrido (atenuado) y tramo pendiente (acento). El split se actualiza
  // conforme el usuario avanza (updateRouteProgress).
  casingLine  = L.polyline(latlngs, { color: cssVar('--route-casing'), weight: 10, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
  doneLine    = L.polyline([],      { color: cssVar('--route-done'),   weight: 6,  opacity: .5, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
  pendingLine = L.polyline(latlngs, { color: cssVar('--c-accent'),     weight: 6,  opacity: 1,  lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
  // Marcadores: origen círculo hueco, destino pin sólido
  L.marker(latlngs[0], { interactive: false, icon: L.divIcon({ className: '', html: `<div style="width:14px;height:14px;border:3px solid ${cssVar('--route-origin')};background:${cssVar('--c-bg')};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`, iconSize: [14,14], iconAnchor: [7,7] }) }).addTo(routeLayer);
  L.marker(latlngs[latlngs.length-1], { interactive: false, icon: L.divIcon({ className: '', html: `<div style="width:16px;height:16px;background:${cssVar('--c-accent')};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize: [16,16], iconAnchor: [8,8] }) }).addTo(routeLayer);
  const isMobile = mq('(max-width:768px)').matches;
  map.fitBounds(L.polyline(latlngs).getBounds(), {
    paddingTopLeft: isMobile ? [30, 30] : [$('sidebar').offsetWidth + 30, 30],
    paddingBottomRight: [30, isMobile ? Math.round(window.innerHeight * 0.35) : 30],
    animate: !REDUCED_MOTION(),
  });
  updateRouteProgress();   // pinta el avance inmediato si ya hay ubicación
}
function showNav(distM, toName) {
  $('route-summary').hidden = false;
  $('route-summary').innerHTML = `<div><div class="rs-stat-label">Distancia</div><div class="rs-stat-value">${fmtDist(distM)}</div></div><div><div class="rs-stat-label">A pie</div><div class="rs-stat-value">${fmtTime(distM)}</div></div>`;
  $('route-hint').hidden = true;
  $('nav-time').textContent = fmtTime(distM);
  $('nav-dist').textContent = fmtDist(distM);
  $('nav-to').textContent = `Llegando a ${toName || '…'}`;
  $('nav-bar').hidden = false;
  // Eleva la ficha de edificio por encima de la barra de navegación activa.
  document.body.classList.add('nav-active');
  document.body.style.setProperty('--nav-h', $('nav-bar').offsetHeight + 'px');
  // Deep link compartible cuando ambos extremos son edificios (Fase 9.1)
  if (routeFrom?.feature && routeTo?.feature) setDeepLink({ from: shortId(routeFrom.feature), to: shortId(routeTo.feature) });
}
function showRouteError() {
  clearRouteLayer();
  $('nav-bar').hidden = true;
  $('route-summary').hidden = false;
  $('route-summary').innerHTML = `<div class="rs-stat-label" style="text-transform:none">No pudimos calcular la ruta. Verifica que ambos puntos estén dentro del campus.</div>`;
}
function clearRouteLayer() {
  if (routeLayer) { routeLayer.clearLayers(); map.removeLayer(routeLayer); routeLayer = null; }
  navPath = casingLine = doneLine = pendingLine = null;
}
function clearRoute() {
  clearRouteLayer();
  $('route-summary').hidden = true; $('route-hint').hidden = false;
  $('nav-bar').hidden = true;
  document.body.classList.remove('nav-active');
  setDeepLink({});
}
$('nav-cancel').addEventListener('click', () => { routeFrom = routeTo = null; clearRoute(); updateRouteUI(); closeRouteView(); });

/* ── Avance de la ruta (tramo recorrido vs pendiente, Fase 6.3) ─ */
function pathLength(p) { let d = 0; for (let i = 0; i < p.length - 1; i++) d += haversine(p[i][0], p[i][1], p[i+1][0], p[i+1][1]); return d; }
// Proyecta [lat,lng] sobre el segmento a→b (equirectangular local).
function projSeg(p, a, b) {
  const cos = Math.cos(a[0] * Math.PI / 180);
  const bx = (b[1]-a[1])*cos, by = b[0]-a[0];
  const px = (p[1]-a[1])*cos, py = p[0]-a[0];
  const len2 = bx*bx + by*by;
  let t = len2 ? (px*bx + py*by) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const point = [a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1])];
  return { point, dist: haversine(p[0], p[1], point[0], point[1]) };
}
function splitPath(path, loc) {
  let best = { dist: Infinity, i: 0, point: path[0] };
  for (let i = 0; i < path.length - 1; i++) {
    const r = projSeg(loc, path[i], path[i+1]);
    if (r.dist < best.dist) best = { dist: r.dist, i, point: r.point };
  }
  const done = path.slice(0, best.i + 1).concat([best.point]);
  const pending = [best.point].concat(path.slice(best.i + 1));
  return { done, pending, remaining: pathLength(pending), offRoute: best.dist };
}
function updateRouteProgress() {
  if (!navPath || !pendingLine) return;
  // El avance (recorrido vs pendiente) solo aplica cuando navegas desde tu
  // ubicación; en rutas edificio→edificio se muestra toda la ruta pendiente.
  const following = routeFrom && routeFrom._isLocation && userLocation;
  if (!following) { doneLine.setLatLngs([]); pendingLine.setLatLngs(navPath); casingLine.setLatLngs(navPath); return; }
  const s = splitPath(navPath, [userLocation.lat, userLocation.lng]);
  // Desvío grande y con origen = ubicación → recalcular (Fase 6.2)
  if (s.offRoute > 25 && routeFrom && routeFrom._isLocation) {
    $('nav-to').innerHTML = '<span class="recalc">Recalculando…</span>';
    routeFrom = { _isLocation: true, lat: userLocation.lat, lng: userLocation.lng, name: 'Mi ubicación' };
    fetchRoute(true);
    return;
  }
  doneLine.setLatLngs(s.done);
  pendingLine.setLatLngs(s.pending);
  casingLine.setLatLngs(s.pending);
  $('nav-dist').textContent = fmtDist(s.remaining);
  $('nav-time').textContent = fmtTime(s.remaining);
}

/* ── Ubicación en vivo (Fases 5.2 / 9.2) ───────────────────── */
// Aplica snap a la entrada si estás fuera, dibuja el avatar 🐏, refresca la
// lista la primera vez y avanza la ruta si hay una activa.
function setUserLocation(rawLat, rawLng) {
  let lat = rawLat, lng = rawLng;
  if (campusBounds && mainEntrance && !campusBounds.pad(0.15).contains([lat, lng])) [lat, lng] = mainEntrance;
  const first = !userLocation;
  userLocation = { lat, lng };
  drawUser();
  if (first) renderList();
  if (navPath) updateRouteProgress();
  return userLocation;
}
// watchPosition persistente: el avatar aparece al cargar y sigue al usuario.
function startWatch() {
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    pos => setUserLocation(pos.coords.latitude, pos.coords.longitude),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
}
// Petición puntual (para cuando aún no hay fix): alta y luego baja precisión.
function getUserLocation(force) {
  if (userLocation && !force) return Promise.resolve(userLocation);
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    const ok = pos => resolve(setUserLocation(pos.coords.latitude, pos.coords.longitude));
    navigator.geolocation.getCurrentPosition(
      ok,
      () => navigator.geolocation.getCurrentPosition(ok, () => resolve(null), { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}
// El botón de ubicación SOLO centra en tu posición (el avatar ya vive por el watch).
$('locate-btn').addEventListener('click', async () => {
  startWatch();
  const btn = $('locate-btn');
  let loc = userLocation;
  if (!loc) { btn.classList.add('locating'); loc = await getUserLocation(true); btn.classList.remove('locating'); }
  if (!loc) { alert('No se pudo obtener tu ubicación. Revisa los permisos.'); return; }
  map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 18), { animate: !REDUCED_MOTION() });
  requestHeading();   // el rumbo (iOS) requiere un gesto: aquí sí lo hay
});
function drawUser() {
  if (!userLocation) return;
  const html = `<div class="user-dot-wrap"><div class="user-heading"${userHeading==null?' style="display:none"':` style="transform:rotate(${userHeading}deg)"`}></div><div class="user-ram">🐏</div></div>`;
  const icon = L.divIcon({ className: '', html, iconSize: [16,16], iconAnchor: [8,8] });
  if (userMarker) userMarker.setIcon(icon), userMarker.setLatLng([userLocation.lat, userLocation.lng]);
  else userMarker = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
}
let headingRequested = false;
function requestHeading() {
  if (headingRequested) return;   // evita acumular listeners en cada clic de localizar
  headingRequested = true;
  const handler = (e) => { if (e.alpha != null) { userHeading = 360 - e.alpha; drawUser(); } };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') window.addEventListener('deviceorientation', handler, true); }).catch(() => {});
  } else if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', handler, true);
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    window.addEventListener('deviceorientation', handler, true);
  }
}

/* ── Bottom sheet móvil (Fase 5.1) ─────────────────────────── */
const SNAPS = [0.18, 0.55, 0.92];
const sheet = $('sidebar');
let sheetSnap = 0, dragging = false, dragStartY = 0, dragStartTy = 0, lastY = 0, lastT = 0, velocity = 0, sheetMoved = false;

function tyForSnap(i) { return sheet.offsetHeight - SNAPS[i] * window.innerHeight; }
function snapSheet(i) {
  if (!mq('(max-width:768px)').matches) return;
  sheetSnap = Math.max(0, Math.min(SNAPS.length - 1, i));
  sheet.style.transform = `translateY(${tyForSnap(sheetSnap)}px)`;
  sheet.classList.toggle('snap-full', sheetSnap === SNAPS.length - 1);
  document.body.classList.toggle('sheet-full', sheetSnap === SNAPS.length - 1);
}
function onDragStart(e) {
  if (!mq('(max-width:768px)').matches) return;
  dragging = true; sheetMoved = false; sheet.classList.add('dragging');
  dragStartY = e.clientY;
  dragStartTy = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42 || tyForSnap(sheetSnap);
  lastY = e.clientY; lastT = performance.now(); velocity = 0;
  sheet.setPointerCapture?.(e.pointerId);
}
function onDragMove(e) {
  if (!dragging) return;
  const dy = e.clientY - dragStartY;
  if (Math.abs(dy) > 6) sheetMoved = true;
  let ty = Math.max(tyForSnap(SNAPS.length - 1), Math.min(tyForSnap(0) + 40, dragStartTy + dy));
  sheet.style.transform = `translateY(${ty}px)`;
  const now = performance.now(); const dt = now - lastT;
  if (dt > 0) velocity = (e.clientY - lastY) / dt * 1000; // px/s
  lastY = e.clientY; lastT = now;
}
function onDragEnd() {
  if (!dragging) return;
  dragging = false; sheet.classList.remove('dragging');
  const ty = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;
  const currentFrac = (sheet.offsetHeight - ty) / window.innerHeight;
  const projected = currentFrac - (velocity / window.innerHeight) * 0.15;
  let best = 0, bestD = Infinity;
  SNAPS.forEach((s, i) => { const d = Math.abs(s - projected); if (d < bestD) { bestD = d; best = i; } });
  snapSheet(best);
}
$('sheet-handle').addEventListener('pointerdown', onDragStart);
// Tap / Enter / Espacio en el handle: cicla peek → half → full (accesible por teclado)
$('sheet-handle').addEventListener('click', () => {
  if (sheetMoved) { sheetMoved = false; return; }   // fue un arrastre, no un tap
  snapSheet((sheetSnap + 1) % SNAPS.length);
});
$('panel-header').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; onDragStart(e); });
window.addEventListener('pointermove', onDragMove);
window.addEventListener('pointerup', onDragEnd);
window.addEventListener('pointercancel', onDragEnd);
$('sheet-scrim').addEventListener('click', () => snapSheet(1));
window.addEventListener('resize', () => { if (mq('(max-width:768px)').matches) snapSheet(sheetSnap); else sheet.style.transform = ''; });
// Estado inicial en móvil
if (mq('(max-width:768px)').matches) requestAnimationFrame(() => snapSheet(0));

/* ── Onboarding + privacidad (Fase 9.3 / 7) ────────────────── */
const onboard = $('onboard');
function openOnboard() {
  onboard.hidden = false;
  trapFocus(onboard);                 // captura el disparador ANTES de mover el foco
  $('onboard-accept').focus();
}
function closeOnboard() {
  onboard.hidden = true; releaseFocus();
  save(LS.onboard, '1');
  if (mq('(max-width:768px)').matches) snapSheet(1);
  startWatch();   // tras aceptar el aviso de privacidad, activa el avatar en vivo
}
$('onboard-accept').addEventListener('click', closeOnboard);

let _trapEl = null, _trapHandler = null, _lastFocus = null;
function trapFocus(el) {
  _lastFocus = document.activeElement;
  const sel = 'button, [href], input, [tabindex]:not([tabindex="-1"])';
  _trapHandler = (e) => {
    if (e.key === 'Escape') { closeOnboard(); return; }
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll(sel)].filter(n => !n.disabled && n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  _trapEl = el; document.addEventListener('keydown', _trapHandler, true);
}
function releaseFocus() { if (_trapHandler) document.removeEventListener('keydown', _trapHandler, true); _trapHandler = null; if (_lastFocus && _lastFocus.focus) _lastFocus.focus(); }

if (!load(LS.onboard)) openOnboard();
else startWatch();   // visitas siguientes: avatar en vivo desde el arranque

/* ── Deep links (Fase 9.1) ─────────────────────────────────── */
function setDeepLink(params) {
  const url = new URL(location.href);
  url.search = '';
  if (params.b) url.searchParams.set('b', params.b);
  if (params.from) url.searchParams.set('from', params.from);
  if (params.to) url.searchParams.set('to', params.to);
  history.replaceState(null, '', url);
}
function findByShort(short) {
  const s = normalize(short).replace(/-/g, ' ');
  return buildings.find(b => b.nameNorm === s) || buildings.find(b => b.nameNorm.includes(s)) ||
         buildings.find(b => b.aliasesNorm.split(' ').includes(s));
}
function handleDeepLink() {
  const q = new URLSearchParams(location.search);
  if (q.get('from') && q.get('to')) {
    const f = findByShort(q.get('from')), t = findByShort(q.get('to'));
    if (f && t) { routeFrom = { feature: f.feature }; routeTo = { feature: t.feature }; openRouteView(); updateRouteUI(); tryRoute(); return; }
  }
  if (q.get('b')) {
    const b = findByShort(q.get('b'));
    if (b) { const r = registry.get(b.fid); if (r) onBuildingClick(r.feature, r.layer, true); }
  }
}

/* ── PWA: service worker + descarga offline (Fase 8.2) ─────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (load('bm.offline')) $('offline-btn').classList.add('done');
$('offline-btn').addEventListener('click', precacheTiles);

async function precacheTiles() {
  const btn = $('offline-btn');
  if (btn.classList.contains('busy')) return;
  const b = geoLayer.getBounds();
  if (!b.isValid || !b.isValid()) return;
  btn.classList.add('busy'); btn.classList.remove('done');

  const layer = tiles[activeTileKey()];
  const tmpl = layer._url, subs = layer.options.subdomains || 'abc';
  const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
  const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
  const urls = [];
  for (const z of [17, 18]) {
    const x0 = lon2x(b.getWest(), z), x1 = lon2x(b.getEast(), z);
    const y0 = lat2y(b.getNorth(), z), y1 = lat2y(b.getSouth(), z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const s = subs[Math.abs(x + y) % subs.length];
      urls.push(tmpl.replace('{s}', s).replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', ''));
    }
  }
  // Descarga en lotes durante tiempo ocioso; el SW los cachea (SWR).
  const idle = window.requestIdleCallback || (cb => setTimeout(() => cb(), 16));
  let i = 0;
  await new Promise(done => {
    const step = () => {
      Promise.allSettled(urls.slice(i, i + 12).map(u => fetch(u, { mode: 'no-cors' }))).then(() => {
        i += 12; if (i < urls.length) idle(step); else done();
      });
    };
    step();
  });
  btn.classList.remove('busy'); btn.classList.add('done');
  btn.setAttribute('aria-label', 'Mapa descargado para uso sin conexión');
  save('bm.offline', '1');
}
