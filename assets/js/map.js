/* ── Categories ───────────────────────────────────────── */
const CATS = {
  academic:   { label: 'Académico',    icon: '🎓', color: '#2563eb', fill: '#3b82f6' },
  school:     { label: 'Preparatoria', icon: '📚', color: '#7c3aed', fill: '#8b5cf6' },
  sports:     { label: 'Deportes',     icon: '⚽', color: '#16a34a', fill: '#4ade80' },
  dorm:       { label: 'Residencias',  icon: '🏠', color: '#059669', fill: '#10b981' },
  life:       { label: 'LIFE',         icon: '🎭', color: '#be185d', fill: '#f472b6' },
  auditorium: { label: 'Auditorios',   icon: '🎤', color: '#7c2d12', fill: '#f97316' },
  food:       { label: 'Comida',       icon: '🍽️', color: '#b45309', fill: '#f59e0b' },
  services:   { label: 'Servicios',    icon: '🏥', color: '#0e7490', fill: '#06b6d4' },
  commercial: { label: 'Comercial',    icon: '🛒', color: '#b91c1c', fill: '#ef4444' },
  other:      { label: 'Otros',        icon: '📍', color: '#475569', fill: '#94a3b8' },
};

function getCategory(p) {
  const b = p.building, a = p.amenity;
  const n = (p.name || '').toLowerCase();

  // OSM-tagged food & drink
  if (['restaurant','cafe','fast_food','food_court','ice_cream'].includes(a) || p.cuisine) return 'food';
  // OSM-tagged commercial
  if (b === 'commercial' || p.shop) return 'commercial';
  // OSM-tagged dormitory + residencias por nombre
  if (b === 'dormitory' || /\bresidencia/.test(n)) return 'dorm';

  // Sports — name-based, checked before building=university
  if (/alberca|atletismo|f[uú]tbol|tenis|padel|domo|gimna|borregos|vestidor|ducha|gradas|cancha|crossfit|voley|ejercicio/.test(n)) return 'sports';

  // Auditorios
  if (/auditorio|congresos/.test(n)) return 'auditorium';

  // LIFE — cultural y recreación no deportiva
  if (/difusi[oó]n|cultural|kiosko|piano|m[uú]sical|hamacas|jardin|e.?sport|ping|ajedrez|futbolito/.test(n)) return 'life';

  // Food — named places without OSM food tags
  if (/cafeter[ií]a|güich|guich|chilaquiles|gongcha|c[oó]rdoba|cocina|comedor|area.de.comer|juvijues|yum/.test(n)) return 'food';

  // Commercial
  if (/tec.?store|bazar|copiroyal|papeler[ií]a|oxxo/.test(n)) return 'commercial';

  // Services — admin, infraestructura, soporte
  if (/caseta|entrada|salida|acceso|admisi[oó]n|direcci[oó]n|rector|administrativ|bienestar|social|lactancia|locatec|tecmed|biciclet|elevador|herramienta|impresora|mentor|soporte|it.?support|servicios?|services|mantenimiento|movilidad|planta.*(agua|tratamiento)/.test(n)) return 'services';
  if (/biblioteca|cosas perdidas|salas?/.test(n)) return 'services';

  // Preparatoria — before building=university
  if (/prepa/.test(n) || b === 'school') return 'school';

  // Academic
  if (b === 'university') return 'academic';
  if (/ingenier[ií]|eiad|emprendimiento|innovaci[oó]n/.test(n)) return 'academic';

  return 'other';
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function endpointLatLng(ep) {
  if (ep._isLocation) return [ep.lat, ep.lng];
  return centroid(ep.geometry);
}
function endpointName(ep) {
  if (!ep) return null;
  if (ep._isLocation) return ep.name;
  return ep.properties?.name || 'Sin nombre';
}

function centroid(geometry) {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[1], geometry.coordinates[0]];
  }
  const ring = geometry.coordinates[0];
  let lat = 0, lng = 0;
  for (const [x, y] of ring) { lng += x; lat += y; }
  return [lat / ring.length, lng / ring.length];
}

function defaultStyle(layer) {
  const cat = getCategory(layer.feature.properties);
  const c = CATS[cat];
  const isPoint = layer instanceof L.CircleMarker;
  return { color: c.color, opacity: 1, weight: isPoint ? 2 : 2.5, fillColor: c.fill, fillOpacity: isPoint ? 0.9 : 0.3 };
}

function humanLabel(key) {
  const map = {
    building: 'Tipo', amenity: 'Servicio', cuisine: 'Cocina',
    opening_hours: 'Horario', website: 'Web', wheelchair: 'Accesible',
    'building:levels': 'Pisos', outdoor_seating: 'Terraza',
  };
  return map[key] || key;
}

function humanValue(key, val) {
  if (key === 'wheelchair') return ({ yes: 'Sí', no: 'No', limited: 'Parcial' }[val] || val);
  if (key === 'outdoor_seating') return val === 'yes' ? 'Sí' : 'No';
  if (key === 'website') return `<a href="${val}" target="_blank" rel="noopener">${val.replace(/^https?:\/\//, '')}</a>`;
  if (key === 'building') {
    const labels = {
      university: 'Universidad', school: 'Escuela', dormitory: 'Residencias',
      commercial: 'Comercial', house: 'Casa', yes: 'Edificio', terrace: 'Terraza',
      roof: 'Techo', residential: 'Residencial', guardhouse: 'Caseta',
    };
    return labels[val] || val;
  }
  if (key === 'amenity') {
    const labels = {
      restaurant: 'Restaurante', cafe: 'Café', fast_food: 'Comida rápida',
      food_court: 'Patio de comidas', library: 'Biblioteca', bank: 'Banco',
      pharmacy: 'Farmacia', clinic: 'Clínica', toilets: 'Baños',
      fuel: 'Gasolinera', ice_cream: 'Heladería', shelter: 'Refugio',
    };
    return labels[val] || val;
  }
  return val;
}

/* ── Map init ─────────────────────────────────────────── */
const MAX_BOUNDS = L.latLngBounds([20.727, -103.462], [20.741, -103.447]);
const ENTRADA_PRINCIPAL = { lat: 20.73151, lng: -103.45346, name: 'Entrada principal' };

function resolveLocation(lat, lng) {
  if (MAX_BOUNDS.contains([lat, lng])) return { lat, lng, name: 'Mi ubicación' };
  return { ...ENTRADA_PRINCIPAL };
}
const map = L.map('map', {
  zoomControl: false,
  minZoom: 17,
  maxZoom: 22,
  maxBounds: MAX_BOUNDS,
  maxBoundsViscosity: 1.0,
}).setView([20.7343, -103.4559], 16);
L.control.zoom({ position: 'topright' }).addTo(map);

map.createPane('polygonPane').style.zIndex = 401;
map.createPane('circlePane').style.zIndex  = 402;

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22,
  maxNativeZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 22,
  maxNativeZoom: 19,
  attribution: 'Tiles &copy; Esri',
});

let isSatellite = true;
satelliteLayer.addTo(map);

document.getElementById('layer-toggle').addEventListener('click', () => {
  isSatellite = !isSatellite;
  const btn = document.getElementById('layer-toggle');
  if (isSatellite) {
    map.removeLayer(osmLayer);
    satelliteLayer.addTo(map);
    btn.textContent = 'Mapa';
  } else {
    map.removeLayer(satelliteLayer);
    osmLayer.addTo(map);
    btn.textContent = 'Satélite';
  }
});

/* ── Campus router ────────────────────────────────────── */
let campusRouter = null;
let entryPoints = []; // { name, lat, lng } — from Point features in paths.geojson

/* ── State ────────────────────────────────────────────── */
let allFeatures = [];
let activeFilter = 'all';
let activeItem = null;
let routeMode = false;
let routeFrom = null;
let routeTo = null;
let routeLayer = null;
let userMarker = null;
let userLocation = null; // { lat, lng, name } cuando se obtiene
let selectedLayer = null;
let selectionMarker = null;
let locationCallbacks = []; // suscriptores que esperan la primera ubicación

/* ── GeoJSON layer ────────────────────────────────────── */
const geoLayer = L.geoJSON(null, {
  filter: feature => {
    if (feature.geometry.type !== 'Point') return true;
    const name = (feature.properties.name || '').toLowerCase().trim();
    return !/^entrada |^acceso /.test(name);
  },
  style: feature => {
    const cat = getCategory(feature.properties);
    const c = CATS[cat];
    return { color: c.color, opacity: 1, weight: 2.5, fillColor: c.fill, fillOpacity: 0.3 };
  },
  pointToLayer(feature, latlng) {
    const cat = getCategory(feature.properties);
    const c = CATS[cat];
    return L.circleMarker(latlng, {
      pane: 'circlePane',
      radius: 8,
      color: c.color,
      weight: 2,
      fillColor: c.fill,
      fillOpacity: 0.9,
    });
  },
  onEachFeature(feature, layer) {
    layer.on('click', () => onBuildingClick(feature, layer));
    layer.on('mouseover', () => {
      if (layer !== selectedLayer)
        layer.setStyle({ fillOpacity: layer instanceof L.CircleMarker ? 1 : 0.55, weight: 2.5 });
    });
    layer.on('mouseout', () => {
      if (layer !== selectedLayer) layer.setStyle(defaultStyle(layer));
    });
  },
});

/* ── Load paths ───────────────────────────────────────── */
fetch('data/paths.geojson')
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(data => {
    entryPoints = data.features
      .filter(f => f.geometry.type === 'Point')
      .map(f => ({
        name: normalize(f.properties.name || ''),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));

    campusRouter = new CampusRouter();
    campusRouter.load(data);
    console.info(`[Router] OK — ${entryPoints.length} entradas, router listo`);
  })
  .catch(err => console.error('[Router] paths.geojson falló — OSRM de respaldo:', err));

/* ── Load data ────────────────────────────────────────── */
fetch('data/campus.geojson')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    data.features.forEach((f, i) => {
      f.properties._fid = f.properties['@id'] || `local_${i}`;
    });
    allFeatures = data.features;
    geoLayer.addData(data);
    geoLayer.addTo(map);
    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
    buildFilterChips();
    renderList(allFeatures);
  })
  .catch(err => console.error('Error cargando GeoJSON:', err));

/* ── Filter chips ─────────────────────────────────────── */
function buildFilterChips() {
  const counts = { all: allFeatures.length };
  for (const cat of Object.keys(CATS)) {
    counts[cat] = allFeatures.filter(f => getCategory(f.properties) === cat).length;
  }

  const container = document.getElementById('filters');
  const makeChip = (key, label) => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip' + (key === 'all' ? ' active' : '');
    btn.dataset.filter = key;
    btn.textContent = label;
    if (key !== 'all') btn.style.setProperty('--chip-color', CATS[key].fill);
    btn.addEventListener('click', () => applyFilter(key));
    return btn;
  };

  container.appendChild(makeChip('all', `Todos (${counts.all})`));
  for (const [key, cat] of Object.entries(CATS)) {
    if (counts[key] > 0)
      container.appendChild(makeChip(key, `${cat.icon} ${cat.label} (${counts[key]})`));
  }
}

function applyFilter(key) {
  activeFilter = key;
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === key);
  });
  const q = document.getElementById('search').value.trim().toLowerCase();
  const filtered = getFiltered(q);
  renderList(filtered);
  updateMapOpacity(filtered);
}

function getFiltered(q) {
  return allFeatures.filter(f => {
    const p = f.properties;
    const name = (p.name || '').toLowerCase();
    const matchCat = activeFilter === 'all' || getCategory(p) === activeFilter;
    const matchQ = !q || name.includes(q) || (p.alt_name || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });
}

function updateMapOpacity(filtered) {
  const ids = new Set(filtered.map(f => f.properties._fid));
  geoLayer.eachLayer(layer => {
    const fid = layer.feature.properties._fid;
    if (ids.has(fid)) {
      layer.setStyle(defaultStyle(layer));
    } else {
      layer.setStyle({ fillOpacity: 0.05, color: '#94a3b8', weight: 0.5 });
    }
  });
}

/* ── Building list ────────────────────────────────────── */
function renderList(features) {
  const ul = document.getElementById('building-list');
  ul.innerHTML = '';

  const named = features.filter(f => f.properties.name);
  const unnamed = features.filter(f => !f.properties.name);

  if (named.length === 0 && unnamed.length === 0) {
    ul.innerHTML = '<li class="list-empty">Sin resultados</li>';
    return;
  }

  for (const f of named) appendItem(ul, f);

  if (unnamed.length > 0) {
    const sep = document.createElement('li');
    sep.className = 'list-empty';
    sep.style.cssText = 'padding:8px 14px;font-size:11px;';
    sep.textContent = `${unnamed.length} edificio${unnamed.length > 1 ? 's' : ''} sin nombre`;
    ul.appendChild(sep);
  }
}

function appendItem(ul, feature) {
  const p = feature.properties;
  const cat = getCategory(p);
  const c = CATS[cat];

  const li = document.createElement('li');
  li.className = 'building-item';
  li.dataset.id = p._fid;
  li.style.setProperty('--item-color', c.fill);
  li.innerHTML = `
    <span class="building-icon">${c.icon}</span>
    <div class="building-item-text">
      <div class="building-item-name">${p.name}</div>
      <div class="building-item-sub">${c.label}</div>
    </div>`;

  li.addEventListener('click', () => {
    const layer = findLayerById(p._fid);
    if (layer) onBuildingClick(feature, layer, true);
  });
  ul.appendChild(li);
}

function findLayerById(id) {
  let found = null;
  geoLayer.eachLayer(l => { if (l.feature.properties._fid === id) found = l; });
  return found;
}

/* ── Building click ───────────────────────────────────── */
function onBuildingClick(feature, layer, fromList = false) {
  if (routeMode) {
    assignRoutePoint(feature);
    return;
  }

  selectBuilding(feature, layer);
  if (!fromList) scrollListToItem(feature.properties._fid);
  if (fromList) {
    const [lat, lng] = centroid(feature.geometry);
    map.setView([lat, lng], Math.max(map.getZoom(), 18), { animate: true });
  }
}

function clearSelection() {
  if (selectedLayer) {
    selectedLayer.setStyle(defaultStyle(selectedLayer));
    selectedLayer = null;
  }
  if (selectionMarker) {
    map.removeLayer(selectionMarker);
    selectionMarker = null;
  }
}

function selectBuilding(feature, layer) {
  clearSelection();

  selectedLayer = layer;
  activeItem = feature;

  const isPoint = layer instanceof L.CircleMarker;
  layer.setStyle({ fillOpacity: isPoint ? 1 : 0.72 });

  const cat = getCategory(feature.properties);
  const c = CATS[cat];
  const [lat, lng] = centroid(feature.geometry);
  selectionMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="selection-pin" style="border-color:${c.color}">${c.icon}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
    zIndexOffset: 950,
    interactive: false,
  }).addTo(map);

  document.querySelectorAll('.building-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === feature.properties._fid);
  });

  showInfoPanel(feature);
}

function scrollListToItem(id) {
  const el = document.querySelector(`.building-item[data-id="${id}"]`);
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ── Info panel ───────────────────────────────────────── */
const INFO_KEYS = ['building', 'amenity', 'cuisine', 'opening_hours', 'website', 'building:levels', 'wheelchair', 'outdoor_seating'];

function showInfoPanel(feature) {
  const p = feature.properties;
  const cat = getCategory(p);
  const c = CATS[cat];

  const panel = document.getElementById('info-panel');
  document.getElementById('info-name').textContent = p.name || 'Sin nombre';

  const badge = document.getElementById('info-category');
  badge.textContent = `${c.icon} ${c.label}`;
  badge.style.cssText = `background:${c.fill}22;color:${c.color};`;

  const fields = document.getElementById('info-fields');
  fields.innerHTML = '';
  for (const key of INFO_KEYS) {
    if (!p[key]) continue;
    const div = document.createElement('div');
    div.className = 'info-field';
    div.innerHTML = `<span class="info-field-label">${humanLabel(key)}</span><span>${humanValue(key, p[key])}</span>`;
    fields.appendChild(div);
  }
  if (p.alt_name) {
    const div = document.createElement('div');
    div.className = 'info-field';
    div.innerHTML = `<span class="info-field-label">También</span><span>${p.alt_name}</span>`;
    fields.appendChild(div);
  }

  panel.classList.remove('hidden');
}

document.getElementById('info-close').addEventListener('click', () => {
  document.getElementById('info-panel').classList.add('hidden');
  clearSelection();
  activeItem = null;
  document.querySelectorAll('.building-item').forEach(el => el.classList.remove('active'));
});

/* ── Route logic ──────────────────────────────────────── */
document.getElementById('route-mode-btn').addEventListener('click', toggleRouteMode);
document.getElementById('cancel-route-mode').addEventListener('click', () => setRouteMode(false));

document.getElementById('btn-set-from').addEventListener('click', () => {
  if (!activeItem) return;
  setRouteEndpoint('from', activeItem);
  document.getElementById('info-panel').classList.add('hidden');
  switchTab('route');
});
document.getElementById('btn-directions').addEventListener('click', () => {
  if (!activeItem) return;
  const destination = activeItem;
  setRouteEndpoint('to', destination);
  document.getElementById('info-panel').classList.add('hidden');

  if (userLocation) {
    routeFrom = { _isLocation: true, lat: userLocation.lat, lng: userLocation.lng, name: 'Mi ubicación' };
    updateRouteUI();
    fetchRoute();
    switchTab('route');
  } else if (navigator.geolocation && locationPermission !== 'denied') {
    requestLocationConsent(() => {
      startLocationWatch();
      routeFrom = { _isLocation: true, lat: null, lng: null, name: 'Obteniendo ubicación…' };
      updateRouteUI();
      switchTab('route');
      onLocation(loc => {
        routeFrom = { _isLocation: true, ...loc };
        updateRouteUI();
        fetchRoute();
      });
    });
  } else {
    switchTab('route');
  }
});

document.getElementById('clear-from').addEventListener('click', () => {
  routeFrom = null;
  updateRouteUI();
  clearRouteLayer();
});
document.getElementById('clear-to').addEventListener('click', () => {
  routeTo = null;
  updateRouteUI();
  clearRouteLayer();
});

function toggleRouteMode() {
  setRouteMode(!routeMode);
}

function setRouteMode(on) {
  routeMode = on;
  const btn = document.getElementById('route-mode-btn');
  const badge = document.getElementById('route-mode-badge');
  if (on) {
    btn.textContent = 'Cancelar modo ruta';
    btn.classList.add('active');
    badge.classList.remove('hidden');
    switchTab('route');
  } else {
    btn.textContent = 'Activar modo ruta';
    btn.classList.remove('active');
    badge.classList.add('hidden');
  }
}

function assignRoutePoint(feature) {
  if (!routeFrom) {
    setRouteEndpoint('from', feature);
  } else if (!routeTo) {
    setRouteEndpoint('to', feature);
    setRouteMode(false);
  } else {
    routeTo = null;          // limpiar ANTES para que fetchRoute no dispare con destino viejo
    clearRouteLayer();
    setRouteEndpoint('from', feature);
  }
}

function setRouteEndpoint(side, feature) {
  if (side === 'from') routeFrom = feature;
  else routeTo = feature;
  updateRouteUI();
  if (routeFrom && routeTo) fetchRoute();
}

function updateRouteUI() {
  const setName = (id, ep) => {
    const el = document.getElementById(id);
    if (ep) {
      el.textContent = endpointName(ep);
      el.classList.remove('placeholder');
    } else {
      el.textContent = 'Selecciona en el mapa';
      el.classList.add('placeholder');
    }
  };
  setName('route-from-name', routeFrom);
  setName('route-to-name', routeTo);

  const hint = document.getElementById('route-hint');
  hint.classList.toggle('hidden', !!(routeFrom || routeTo));
}

function getEntries(ep) {
  if (!ep || ep._isLocation) return [];
  const name = normalize(ep.properties?.name || '');
  // Buildings whose name starts with "entrada" are themselves entrances/guardhouses;
  // route to their centroid projected onto the nearest path, no entry lookup needed.
  if (!name || name.startsWith('entrada ')) return [];
  return entryPoints
    .filter(e => e.name.includes(name))
    .map(e => [e.lat, e.lng]);
}

async function fetchRoute() {
  if (!routeFrom || !routeTo) return;
  if (routeFrom.lat === null || routeTo.lat === null) return;
  const [fromLat, fromLng] = endpointLatLng(routeFrom);
  const [toLat, toLng] = endpointLatLng(routeTo);

  if (campusRouter) {
    const fromEntries = getEntries(routeFrom);
    const toEntries   = getEntries(routeTo);
    const result = campusRouter.route(fromLat, fromLng, toLat, toLng, fromEntries, toEntries);
    if (result) {
      drawRoute(result.path);
      showRouteSummary(result.distance, result.distance / 1.2); // ~1.2 m/s campus walking
    } else {
      showRouteSummary(null, null);
      console.warn('[Router] No se encontró ruta — verifica que los caminos estén conectados');
    }
    return;
  }

  // Fallback: OSRM público
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok') throw new Error(data.code);
    const route = data.routes[0];
    const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    drawRoute(latlngs);
    showRouteSummary(route.distance, route.duration);
  } catch (err) {
    console.error('OSRM error:', err);
    showRouteSummary(null, null);
  }
}

function drawRoute(latlngs) {
  clearRouteLayer();
  routeLayer = L.layerGroup().addTo(map);

  const line = L.polyline(latlngs, {
    color: '#f59e0b', weight: 5, opacity: 0.9,
    lineJoin: 'round', lineCap: 'round',
  }).addTo(routeLayer);

  map.fitBounds(line.getBounds(), { padding: [60, 60] });

  const dot = (color) => `<div style="background:${color};width:14px;height:14px;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`;
  L.marker(latlngs[0],                  { icon: L.divIcon({ className: '', html: dot('#10b981'), iconSize: [14,14], iconAnchor: [7,7] }) }).addTo(routeLayer);
  L.marker(latlngs[latlngs.length - 1], { icon: L.divIcon({ className: '', html: dot('#f59e0b'), iconSize: [14,14], iconAnchor: [7,7] }) }).addTo(routeLayer);
}

function showRouteSummary(distM, durS) {
  const summary = document.getElementById('route-summary');
  if (!distM) {
    summary.classList.remove('visible');
    return;
  }
  const dist = distM < 1000 ? `${Math.round(distM)} m` : `${(distM/1000).toFixed(1)} km`;
  const mins = Math.ceil(durS / 60);
  summary.innerHTML = `
    <div class="route-stat">
      <span class="route-stat-label">Distancia</span>
      <span class="route-stat-value">${dist}</span>
    </div>
    <div class="route-stat">
      <span class="route-stat-label">Caminando ~</span>
      <span class="route-stat-value">${mins} min</span>
    </div>`;
  summary.classList.add('visible');
}

function clearRouteLayer() {
  if (routeLayer) { routeLayer.clearLayers(); map.removeLayer(routeLayer); routeLayer = null; }
  document.getElementById('route-summary').classList.remove('visible');
}

/* ── Search ───────────────────────────────────────────── */
const searchInput = document.getElementById('search');
const searchClear = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.classList.toggle('visible', q.length > 0);
  const filtered = getFiltered(q);
  renderList(filtered);
  updateMapOpacity(filtered);
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  const filtered = getFiltered('');
  renderList(filtered);
  updateMapOpacity(filtered);
});

/* ── Tabs ─────────────────────────────────────────────── */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));
}

/* ── User location ────────────────────────────────────── */
let locationPermission = 'unknown'; // 'unknown' | 'granted' | 'denied'
let locationWatcher = null;

function updateUserMarker(lat, lng) {
  if (userMarker) map.removeLayer(userMarker);
  const icon = L.divIcon({
    className: '',
    html: '<div class="user-sheep">🐏</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}

function startLocationWatch() {
  if (locationWatcher !== null || !navigator.geolocation) return;

  const onPos = pos => {
    const loc = resolveLocation(pos.coords.latitude, pos.coords.longitude);
    userLocation = loc;
    locationPermission = 'granted';
    updateUserMarker(loc.lat, loc.lng);
    if (locationCallbacks.length) {
      locationCallbacks.forEach(cb => cb(loc));
      locationCallbacks = [];
    }
  };

  // Fase 1: posición cacheada para mostrar el borrego de inmediato
  navigator.geolocation.getCurrentPosition(onPos, () => {}, {
    enableHighAccuracy: false, maximumAge: Infinity, timeout: 500,
  });

  // Fase 2: actualizaciones continuas
  locationWatcher = navigator.geolocation.watchPosition(
    onPos,
    () => { locationPermission = 'denied'; },
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
  );
}

// Llama cb(loc) en cuanto haya ubicación; inmediato si ya existe
function onLocation(cb) {
  if (userLocation) { cb(userLocation); return; }
  locationCallbacks.push(cb);
}

function applyLocationRoute(lat, lng) {
  routeFrom = { _isLocation: true, lat, lng, name: 'Mi ubicación' };
  routeTo = activeItem;
  updateRouteUI();
  fetchRoute();
  switchTab('route');
  document.getElementById('info-panel').classList.add('hidden');
}

/* ── Privacy consent ──────────────────────────────────── */
const CONSENT_KEY = 'borrego-location-consent';

function openPrivacyModal(viewOnly = false) {
  const modal = document.getElementById('privacy-modal');
  modal.dataset.mode = viewOnly ? 'view' : 'consent';
  modal.classList.remove('hidden');

  if (viewOnly) {
    const closeBtn = document.getElementById('privacy-close');
    const handler = () => {
      modal.classList.add('hidden');
      closeBtn.removeEventListener('click', handler);
    };
    closeBtn.addEventListener('click', handler);
    return;
  }

  function cleanup() {
    modal.classList.add('hidden');
    document.getElementById('privacy-accept').removeEventListener('click', handleAccept);
    document.getElementById('privacy-reject').removeEventListener('click', handleReject);
  }
  function handleAccept() { localStorage.setItem(CONSENT_KEY, 'granted'); cleanup(); }
  function handleReject() { localStorage.setItem(CONSENT_KEY, 'denied');  cleanup(); }

  document.getElementById('privacy-accept').addEventListener('click', handleAccept);
  document.getElementById('privacy-reject').addEventListener('click', handleReject);
}

function requestLocationConsent(onAccept) {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === 'granted') { onAccept(); return; }
  if (stored === 'denied') {
    alert('Rechazaste el uso de ubicación. Para cambiar esto borra los datos del sitio en la configuración de tu navegador.');
    return;
  }

  const modal = document.getElementById('privacy-modal');
  modal.dataset.mode = 'consent';
  modal.classList.remove('hidden');

  function cleanup() {
    modal.classList.add('hidden');
    document.getElementById('privacy-accept').removeEventListener('click', handleAccept);
    document.getElementById('privacy-reject').removeEventListener('click', handleReject);
  }
  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'granted');
    cleanup();
    onAccept();
  }
  function handleReject() {
    localStorage.setItem(CONSENT_KEY, 'denied');
    cleanup();
  }

  document.getElementById('privacy-accept').addEventListener('click', handleAccept);
  document.getElementById('privacy-reject').addEventListener('click', handleReject);
}

document.getElementById('privacy-link').addEventListener('click', () => openPrivacyModal(true));

document.getElementById('locate-btn').addEventListener('click', () => requestLocationConsent(locateUser));

function locateUser() {
  if (!navigator.geolocation) return alert('Tu navegador no soporta geolocalización.');
  const btn = document.getElementById('locate-btn');
  const prev = btn.textContent;
  btn.textContent = '…'; btn.disabled = true;
  startLocationWatch();
  onLocation(loc => {
    btn.textContent = prev; btn.disabled = false;
    const popupText = loc.name === 'Mi ubicación' ? 'Estás aquí' : 'Fuera del campus — usando Entrada principal';
    userMarker.bindPopup(popupText).openPopup();
    map.setView([loc.lat, loc.lng], 18, { animate: true });
  });
}

document.getElementById('swap-endpoints').addEventListener('click', () => {
  [routeFrom, routeTo] = [routeTo, routeFrom];
  updateRouteUI();
  if (routeFrom && routeTo) fetchRoute();
});

/* ── Mobile sidebar ───────────────────────────────────── */
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
}

document.getElementById('menu-btn').addEventListener('click', openSidebar);
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

/* ── Theme toggle ─────────────────────────────────────── */
const themeBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
  themeBtn.title = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
  localStorage.setItem('borrrego-theme', theme);
}

applyTheme(localStorage.getItem('borrrego-theme') || 'dark');

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

/* ── Auto-ubicación al cargar ─────────────────────────── */
if (localStorage.getItem(CONSENT_KEY) === 'granted' && navigator.geolocation) {
  startLocationWatch();
}
