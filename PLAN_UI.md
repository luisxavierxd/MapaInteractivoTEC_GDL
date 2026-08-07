# Plan de acción — Rediseño UI/UX · Borrego Merodeador (MapaInteractivoTEC_GDL)

> **Para el agente:** este documento es una orden de trabajo ejecutable. Repo: `luisxavierxd/MapaInteractivoTEC_GDL`.
> Stack actual: HTML/CSS/JS vanilla + Leaflet 1.x + GeoJSON propio. Sin build step, sin framework.
> **No migres a ningún framework.** Todo debe seguir funcionando servido como estático desde GitHub Pages.

---

## 0. Antes de tocar nada

```bash
git checkout -b feat/ui-overhaul
```

1. Lee completo `assets/js/map.js`, `assets/css/style.css`, `index.html`.
2. Lee `assets/js/router.js` **solo para entender su API pública** — no lo modifiques, la lógica de ruteo funciona.
3. Inspecciona `data/campus.geojson`: anota los nombres exactos de las propiedades (`name`, `category`/`categoria`, etc.). Todo el plan asume que existe una propiedad de categoría; usa el nombre real que encuentres.
4. Levanta `python -m http.server 8080` y verifica que el estado actual funciona antes de empezar.

**Regla de trabajo:** un commit por fase. Después de cada fase, verifica manualmente que (a) la búsqueda funciona, (b) el ruteo A→B funciona, (c) el GPS funciona, (d) nada rompe en viewport 375px. Si una fase rompe algo, arréglalo antes de seguir.

**Regla de código:** cero dependencias nuevas salvo las explícitamente listadas aquí (Fuse.js). Nada de npm, nada de bundler.

---

## FASE 1 — Sistema de diseño (base para todo lo demás)

### 1.1 Tokens CSS

Crea `assets/css/tokens.css` y enlázalo en `index.html` **antes** de `style.css`.

Dirección visual: el mapa es la figura, la UI es el marco. UI neutra y silenciosa, un único acento cálido reservado exclusivamente para navegación/ruta.

```css
:root {
  /* Neutros — chrome de UI */
  --c-bg:        #FFFFFF;
  --c-surface:   #F5F6F7;
  --c-surface-2: #EBEDEF;
  --c-border:    #DCE0E3;
  --c-text:      #14181B;
  --c-text-mut:  #5C666E;

  /* Acento — SOLO ruta, navegación y acción primaria */
  --c-accent:      #E8590C;
  --c-accent-weak: #FFF0E6;
  --c-accent-ink:  #FFFFFF;

  /* Estado */
  --c-focus: #1971C2;

  /* Tipografía */
  --font-ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fs-xs: 0.6875rem;  /* 11 — metadatos, conteos */
  --fs-sm: 0.8125rem;  /* 13 — cuerpo secundario */
  --fs-md: 0.9375rem;  /* 15 — cuerpo, items de lista */
  --fs-lg: 1.125rem;   /* 18 — título de panel */
  --fs-xl: 1.375rem;   /* 22 — header */
  --lh-tight: 1.25;
  --lh-body: 1.5;

  /* Espaciado — escala de 4 */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
  --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;

  /* Forma y elevación */
  --r-sm: 6px; --r-md: 10px; --r-lg: 16px; --r-pill: 999px;
  --sh-1: 0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.10);
  --sh-2: 0 4px 12px rgba(0,0,0,.12);
  --sh-3: 0 -2px 16px rgba(0,0,0,.16);

  /* Layout */
  --sidebar-w: 380px;
  --z-map: 400; --z-panel: 1000; --z-sheet: 1100; --z-modal: 2000;
}

[data-theme="dark"] {
  --c-bg:        #14181B;
  --c-surface:   #1D2226;
  --c-surface-2: #272D32;
  --c-border:    #363D43;
  --c-text:      #E9ECEF;
  --c-text-mut:  #9BA5AD;
  --c-accent-weak: #3A2015;
  --c-focus: #74C0FC;
}
```

### 1.2 Paleta de categorías (accesible)

Hay 10 categorías. Diez colores categóricos superan el límite de discriminación humana y con deuteranopía (~8% de los hombres) varios colapsan. **Reduce a 8 grupos cromáticos** y usa la paleta Okabe–Ito, que es color-blind safe.

Agrupación (ajusta si el GeoJSON usa otras etiquetas):

| Grupo visual | Categorías originales | Hex |
|---|---|---|
| Académico | Académico | `#0072B2` |
| Preparatoria | Preparatoria | `#56B4E9` |
| Deportes | Deportes | `#009E73` |
| Residencias | Residencias | `#E69F00` |
| Vida estudiantil | LIFE + Auditorios | `#CC79A7` |
| Comida | Comida | `#D55E00` |
| Servicios | Servicios | `#7F7F7F` |
| Comercial | Comercial + Otros | `#F0E442` |

Define como variables (`--cat-academico`, etc.) en `tokens.css` y **elimina todos los hex de categoría hardcodeados** en `map.js`. Reemplaza por una función única:

```js
const CATEGORY_STYLE = { /* categoria -> { color, icon } */ };
function categoryColor(cat) { /* lee getComputedStyle o el objeto */ }
```

Ese objeto es la única fuente de verdad para: relleno del polígono, punto del chip de filtro, icono del item de lista y pin de selección.

> **Nota:** el amarillo `#F0E442` sobre imagen satelital clara tiene contraste pobre. Úsalo solo con borde oscuro (ver 2.1) y verifica en modo satélite antes de dar por buena la fase.

### 1.3 Un solo acento

El naranja hoy aparece en el toggle de tema **y** en la línea de ruta. Diluye el significado.

- Toggle de tema, botón de capas y botón de localizar → neutros (`--c-surface` con borde e icono en `--c-text-mut`).
- Naranja `--c-accent` → exclusivamente: línea de ruta pendiente, botón "Cómo llegar", barra inferior de navegación, chip de filtro activo.

**Criterio de aceptación F1:** ningún hex literal fuera de `tokens.css` (salvo tiles de Leaflet). `grep -rn "#[0-9a-fA-F]\{6\}" assets/js assets/css --include="*.js" --include="*.css" | grep -v tokens.css` devuelve vacío o solo casos justificados.

---

## FASE 2 — Legibilidad del mapa

### 2.1 Opacidad diferencial

Hoy todos los polígonos van a la misma intensidad y compiten entre sí y con el satelital.

En la función `style` del `L.geoJSON`:

```js
const STYLE_BASE = (cat) => ({
  color: categoryColor(cat),
  weight: 2,
  opacity: 0.9,
  fillColor: categoryColor(cat),
  fillOpacity: 0.18,
});
const STYLE_HOVER    = { weight: 3, fillOpacity: 0.42 };
const STYLE_SELECTED = { weight: 3.5, fillOpacity: 0.55 };
const STYLE_DIMMED   = { weight: 1, opacity: 0.35, fillOpacity: 0.05 };
```

- Estado normal: `fillOpacity 0.18`.
- Filtro de categoría activo: la categoría activa a `0.42`, el resto a `STYLE_DIMMED` (**no las ocultes** — quitar polígonos del mapa desorienta; atenuarlas conserva el contexto espacial).
- Seleccionado: `STYLE_SELECTED`.

Transiciones vía CSS sobre los paths SVG:

```css
.leaflet-interactive { transition: fill-opacity .15s ease, stroke-width .15s ease; }
@media (prefers-reduced-motion: reduce) { .leaflet-interactive { transition: none; } }
```

### 2.2 Basemap por defecto = calles tenues

La imagen satelital de Esri tiene ruido altísimo (copas de árbol, autos, techos rojos) y es fondo, no figura. Cámbiala a basemap por defecto:

```js
const BASEMAPS = {
  claro: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20
  }),
  oscuro: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20
  }),
  satelite: /* la capa Esri actual, sin cambios */,
};
```

Reglas:
- Default en primera visita: `claro`.
- Al alternar tema oscuro, si la capa activa es `claro` cambia automáticamente a `oscuro` y viceversa. Hoy el tema oscuro deja un rectángulo blanco brillante ocupando el 80% de la pantalla.
- Si el usuario eligió `satelite` explícitamente, el tema no la toca.
- Persiste la elección en `localStorage` con la misma convención de claves que ya usa el tema.

### 2.3 Toggle de capas con preview

El botón "Mapa" abajo a la derecha es un label ambiguo y aislado. Reemplázalo por el patrón estándar: cuadrado de ~56px con miniatura del basemap **alternativo** y label superpuesto ("Satélite" / "Calles"). Deja `--r-md`, `--sh-2` y `aria-label` descriptivo.

Genera las miniaturas como capturas estáticas de tile (`assets/img/thumb-satelite.jpg`, `thumb-calles.jpg`, ~112px, ≤8 KB cada una).

### 2.4 Encerrar la vista al campus

Hoy se ve más colonia vecina que campus. En la config del mapa:

```js
const CAMPUS_BOUNDS = L.latLngBounds(/* calcula desde campus.geojson con getBounds().pad(0.25) */);
const map = L.map('map', {
  preferCanvas: true,          // 119 polígonos + paths: canvas > SVG en móviles de gama media
  maxBounds: CAMPUS_BOUNDS,
  maxBoundsViscosity: 0.8,
  minZoom: 15,
  maxZoom: 20,
  zoomControl: false,          // se recoloca en 5.x
});
map.fitBounds(CAMPUS_BOUNDS);
```

> **Ojo:** `preferCanvas: true` rompe hover con CSS en los paths. Si activas canvas, mueve las transiciones de 2.1 a interpolación en JS o acepta cambios de estilo instantáneos. Prueba ambas y quédate con canvas — el rendimiento importa más que el fade.

### 2.5 Etiquetas de edificio

Sin labels el mapa es ilegible sin clicar. Añade tooltips permanentes con umbral de zoom:

```js
layer.bindTooltip(name, {
  permanent: true, direction: 'center', className: 'bldg-label', opacity: 1
});

const LABEL_MIN_ZOOM = 17;
function syncLabels() {
  const show = map.getZoom() >= LABEL_MIN_ZOOM;
  document.querySelector('#map').classList.toggle('labels-off', !show);
}
map.on('zoomend', syncLabels); syncLabels();
```

```css
.bldg-label {
  background: none; border: none; box-shadow: none;
  font: 600 var(--fs-xs)/1.1 var(--font-ui);
  color: var(--c-text);
  text-shadow: 0 0 3px var(--c-bg), 0 0 3px var(--c-bg), 0 0 3px var(--c-bg);
  pointer-events: none;
}
.labels-off .bldg-label { display: none; }
```

Si a zoom 17 las etiquetas se encabalgan demasiado, muestra solo edificios de categoría Académico/Preparatoria/Auditorios por debajo de zoom 18 (añade un flag `major: true` a esos features en el GeoJSON).

**Criterio de aceptación F2:** con basemap claro y sin filtro, se distinguen los 10 grupos de categoría y se leen los nombres de los edificios principales sin clicar. En modo oscuro los tiles también son oscuros.

---

## FASE 3 — Panel lateral

### 3.1 Chips de filtro

Problema actual: 10 chips en 5 filas consumen ~25% del alto del panel, y cada chip lleva punto de color + emoji + texto + conteo (triple redundancia; el emoji no mapea a nada en el mapa).

- Elimina el emoji del chip. Conserva punto de color + nombre + conteo.
- Una sola fila con scroll horizontal (`overflow-x: auto; scroll-snap-type: x proximity;`), con máscara de degradado en el borde derecho para señalar que hay más.
- `Todos (119)` sale de la fila y se convierte en botón de reset a la izquierda, visible solo cuando hay un filtro activo, con texto "Limpiar filtro".
- Chip activo: fondo `--c-accent-weak`, borde `--c-accent`, texto `--c-text`. **No uses solo color** para indicar activo — añade `aria-pressed="true"` y un peso tipográfico distinto (600 vs 450).

```css
.chip { min-height: 32px; padding: 0 var(--sp-3); border-radius: var(--r-pill);
        font-size: var(--fs-sm); white-space: nowrap; scroll-snap-align: start; }
.chip-row { display: flex; gap: var(--sp-2); overflow-x: auto; scrollbar-width: none;
            padding-bottom: var(--sp-1); }
.chip-row::-webkit-scrollbar { display: none; }
```

### 3.2 Lista de edificios

Hoy es una lista alfabética plana sin contexto. Cambios:

**a) Orden por distancia cuando hay GPS.** Calcula distancia haversine del usuario al centroide de cada edificio y ordena ascendente. Muestra como metadato del item: `140 m · 2 min` (usa 1.35 m/s como velocidad peatonal). Sin GPS, orden alfabético.

**b) Headers de categoría pegajosos** cuando el orden es alfabético o hay filtro múltiple:

```css
.cat-header { position: sticky; top: 0; z-index: 1;
              background: var(--c-bg); font-size: var(--fs-xs);
              text-transform: uppercase; letter-spacing: .06em;
              color: var(--c-text-mut); padding: var(--sp-2) var(--sp-4); }
```

**c) Estructura del item:**

```
[icono de categoría 32px]  Nombre del edificio        (--fs-md, 500)
                           Categoría · 140 m · 2 min  (--fs-xs, --c-text-mut)
```

Altura mínima 56px (target táctil cómodo). Estado hover/focus con fondo `--c-surface`.

**d) Renderizado.** 119 items renderizados de golpe está bien; **no virtualices todavía**. Si el dataset supera ~400, entonces sí. Documenta el umbral en un comentario y sigue.

### 3.3 Cross-highlight lista ↔ mapa

Esta es la interacción que hace que un mapa se sienta bien construido, y hoy no existe.

Mantén un `Map` de `id -> { layer, listItem }` y expón dos funciones:

```js
function highlight(id, source) { /* aplica STYLE_HOVER al layer + clase .is-hot al item */ }
function unhighlight(id) { /* revierte al estilo que corresponda por estado */ }
```

- `mouseover`/`mouseout` en el item de la lista → `highlight`/`unhighlight` del polígono.
- `mouseover`/`mouseout` en el polígono → misma función + `scrollIntoView({ block:'nearest', behavior:'smooth' })` del item.
- **Solo en punteros finos.** Envuelve los listeners en `matchMedia('(hover: hover) and (pointer: fine)').matches` — en táctil el hover se queda pegado.

### 3.4 `fitBounds` con padding del panel

Error clásico y visible hoy: al seleccionar un edificio queda tapado por el sidebar.

```js
function focusBuilding(layer) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const pad = isMobile
    ? { paddingTopLeft: [20, 20], paddingBottomRight: [20, window.innerHeight * 0.55] }
    : { paddingTopLeft: [document.querySelector('.sidebar').offsetWidth + 24, 24],
        paddingBottomRight: [24, 24] };
  map.flyToBounds(layer.getBounds(), { ...pad, maxZoom: 19, duration: 0.6 });
}
```

Respeta `prefers-reduced-motion`: si está activo, usa `fitBounds` en vez de `flyToBounds`.

**Criterio de aceptación F3:** al hacer clic en cualquier item de la lista, el edificio queda centrado en el área de mapa **visible**, nunca detrás del panel, ni en desktop ni en móvil.

---

## FASE 4 — Búsqueda

### 4.1 Fuzzy + normalización

"CETEC", "cetec", "Cetec" y "A6" deben caer al mismo lugar. Hoy la búsqueda es sensible a acentos y exacta.

Añade Fuse.js por CDN con SRI en `index.html` (~6 KB gz):

```html
<script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js"></script>
```

```js
const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const fuse = new Fuse(buildings, {
  keys: [
    { name: 'nameNorm', weight: 0.7 },
    { name: 'aliasesNorm', weight: 0.25 },
    { name: 'categoryNorm', weight: 0.05 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
});
```

Precalcula `nameNorm`/`aliasesNorm` una vez al cargar el GeoJSON, no en cada tecla. Debounce de 120 ms en `input`.

### 4.2 Alias en el GeoJSON

Añade `"aliases": []` a las `properties` de cada feature en `data/campus.geojson`. Rellena al menos los edificios de alto tráfico:

- `Aulas 6 (Prepa)` → `["A6", "aulas seis", "prepa"]`
- `Centro de Congresos` → `["CC", "congresos"]`
- `CARD` → `["card", "deportivo"]`
- `Difusión Cultural` → `["difusion", "cultural"]`

Deja un comentario en el README explicando el campo para que sea fácil de extender.

### 4.3 Navegación por teclado

- `↑` / `↓` mueven el índice activo entre resultados, `Enter` selecciona, `Esc` limpia y devuelve foco al input.
- Marca el resultado activo con `aria-activedescendant` y el combo `role="combobox"` + `role="listbox"` + `aria-expanded`.
- Atajo global: `/` enfoca el buscador (ignóralo si el foco está en un input). Añade la pista visual `/` como badge dentro del campo, alineado a la derecha, en `--c-text-mut`.

### 4.4 Estados

- **Sin resultados:** "No encontramos *«consulta»*. Prueba con el nombre corto, como A6 o CETEC." — la copia enseña el atajo en el momento en que se necesita.
- **Vacío inicial:** no muestres dropdown; la lista completa ya está debajo.

**Criterio de aceptación F4:** `difusion`, `Difusión`, `DIFUSION` y `cultural` devuelven los mismos resultados. Toda la búsqueda es operable sin ratón.

---

## FASE 5 — Móvil

### 5.1 Bottom sheet en vez de sidebar deslizante

En móvil el sidebar full-screen obliga a cerrarlo para ver el mapa. Reemplázalo por bottom sheet con tres snap points — el patrón al que convergieron Google Maps, Apple Maps y Citymapper de forma independiente, y que permite ver mapa y lista a la vez con una sola mano.

Snaps (fracción del alto de viewport): `peek 0.18` · `half 0.55` · `full 0.92`.

Implementación sin librerías:

```js
const SNAPS = [0.18, 0.55, 0.92];
// Pointer Events (no touch events): funciona con dedo, ratón y stylus.
// Al soltar, elige el snap más cercano considerando posición + velocidad:
//   const projected = currentFrac - velocity * 0.15;
//   const target = SNAPS.reduce((a,b) => Math.abs(b-projected) < Math.abs(a-projected) ? b : a);
```

Requisitos:
- Handle visual de arrastre (barra de 36×4px, `--c-border`, `--r-pill`, centrada, con 12px de padding táctil arriba y abajo).
- El contenido interno solo hace scroll cuando el sheet está en `full`; en los demás snaps `overflow: hidden` para que el drag no compita con el scroll.
- `padding-bottom: env(safe-area-inset-bottom)` para el notch de iOS.
- Al seleccionar un edificio en el mapa → sheet a `half` con el panel de detalle (no a `full`; el usuario quiere seguir viendo el mapa).
- `will-change: transform` durante el drag, quítalo al soltar.

Mantén el sidebar fijo tal cual está en ≥769px. Ambos comparten el mismo HTML; solo cambia el CSS por media query y el módulo de gestos se activa condicionalmente.

### 5.2 Controles del mapa

- Botón de localizar y de capas: 48×48px mínimo, esquina inferior derecha, apilados con `gap: var(--sp-2)`.
- Súbelos por encima del snap `peek` (`bottom: calc(18vh + var(--sp-4))`) y anímalos con el sheet.
- Recoloca el zoom control de Leaflet arriba a la derecha, o **elimínalo en móvil** (el pinch es universal y ganas espacio).

**Criterio de aceptación F5:** en 375×667 se puede buscar, filtrar, seleccionar edificio y ver el mapa sin cerrar nada. Sin scroll horizontal en ninguna vista.

---

## FASE 6 — Flujo de ruta

### 6.1 Elimina la pestaña "Ruta"

Las pestañas *Explorar / Ruta* duplican el flujo: ya existe "Cómo llegar" y "Desde aquí" en el panel de detalle, que es el punto de entrada natural (primero eliges *a dónde*, luego *cómo*).

- Borra las pestañas. El panel tiene un solo modo: explorar.
- "Cómo llegar" → entra al modo ruta con **destino prellenado** y origen = ubicación actual si hay GPS, o "Selecciona en el mapa".
- "Desde aquí" → origen prellenado, destino vacío, modo selección activo.
- El panel de ruta se muestra como capa encima del panel de exploración, con botón de retroceso.

Esto elimina un nivel de navegación y ~40 líneas de gestión de tabs.

### 6.2 Barra inferior de navegación

Ya existe (estilo Waze) y funciona. Ajustes:

- Copia consistente: si el botón dice "Cómo llegar", el estado activo dice "Llegando a X", no "Navegando" ni "Ruta activa".
- Tiempo y distancia con jerarquía clara: tiempo en `--fs-xl` peso 600, distancia en `--fs-sm` `--c-text-mut`.
- Botón de cancelar como icono `✕` con `aria-label="Cancelar ruta"`, alineado a la derecha, nunca como el elemento más prominente.
- Al recalcular ruta (desvío >25 m), muestra un estado transitorio "Recalculando…" en lugar de que los números salten sin explicación.

### 6.3 Línea de ruta

- Tramo recorrido: `--c-text-mut` a `opacity: .5`, weight 5.
- Tramo pendiente: `--c-accent`, weight 6, con casing blanco debajo (`weight: 10, color: #fff`) para que se lea sobre cualquier basemap. Esto es lo que hace legible una ruta sobre satelital.
- Marcadores de origen/destino diferenciados: origen círculo hueco, destino pin sólido.

**Criterio de aceptación F6:** desde un edificio cualquiera se llega a navegación activa en ≤2 toques, y la línea se lee tanto en basemap claro como en satelital.

---

## FASE 7 — Accesibilidad y piso de calidad

Checklist. Cada punto debe quedar verificado, no solo intentado.

- [ ] **Contraste 4.5:1** en todo texto (WCAG 2.2 §1.4.3). Verifica especialmente los chips: texto sobre `--c-accent-weak` y sobre los colores de categoría. Herramienta: DevTools → Inspect → contrast ratio.
- [ ] **El color no es el único canal** (WCAG §1.4.1). Cada categoría tiene además un icono en el item de lista y en el pin de selección. Los chips activos difieren en peso tipográfico, no solo en color.
- [ ] **Focus visible** en todo elemento interactivo:
  ```css
  :focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; border-radius: var(--r-sm); }
  ```
- [ ] **`aria-label` en todo botón de solo icono**: tema, capas, localizar, cerrar, cancelar ruta, handle del sheet.
- [ ] **Trampa de foco** en el modal de aviso de privacidad; `Esc` lo cierra; el foco vuelve al disparador.
- [ ] **`prefers-reduced-motion`** respetado en: `flyToBounds`, transiciones de polígono, animación del sheet, pulso del marcador GPS.
- [ ] **Targets táctiles ≥44×44px** (Apple HIG) en todos los controles del mapa.
- [ ] **Landmarks**: `<aside role="complementary">` para el panel, `<main>` para el mapa, `<h1>` real en el header.
- [ ] El mapa Leaflet no es accesible por teclado por naturaleza — asegúrate de que **toda** funcionalidad esté disponible desde la lista y la búsqueda.

---

## FASE 8 — Rendimiento y offline

### 8.1 Optimización inmediata

- `preferCanvas: true` (ya en 2.4).
- Minifica los GeoJSON: quita whitespace y **redondea coordenadas a 6 decimales** (≈11 cm de precisión, suficiente y ahorra ~30% del archivo).
- `<link rel="preconnect">` a los hosts de tiles.
- Carga diferida del módulo de ruteo: `router.js` solo se necesita cuando el usuario pide una ruta. Conviértelo a módulo ES y usa `import()` dinámico al primer clic en "Cómo llegar".

### 8.2 PWA + offline

El WiFi del campus falla justo cuando más se necesita el mapa. Alta prioridad práctica.

- `manifest.webmanifest`: nombre, `display: standalone`, `theme_color: #14181B`, iconos 192/512 con el borrego.
- `sw.js` con estrategia mixta:
  - **Cache-first** para el app shell (`index.html`, CSS, JS, GeoJSON).
  - **Stale-while-revalidate** para tiles, con cache dedicada y límite de ~300 entradas (LRU manual).
  - Versiona la cache con una constante y limpia las viejas en `activate`.
- Precachea los tiles del bbox del campus en zoom 17–18 al primer uso (son pocos cientos; hazlo en background con `requestIdleCallback` y muestra un toggle "Descargar mapa para uso sin conexión" en vez de hacerlo sin avisar).

**Criterio de aceptación F8:** en DevTools → Network → Offline, tras una visita previa, la app carga y muestra el campus con edificios y permite calcular rutas.

---

## FASE 9 — Extras de alto valor

### 9.1 Deep links

`?b=cetec` abre con ese edificio seleccionado; `?from=a6&to=cetec` abre con la ruta calculada. Actualiza la URL con `history.replaceState` al seleccionar (sin ensuciar el historial). Convierte la app en algo compartible por WhatsApp, que es como realmente circula la información entre estudiantes de nuevo ingreso.

### 9.2 Rumbo del usuario

El marcador 🐏 es hoy un punto: dice *dónde estoy*, no *hacia dónde camino* — que es el problema real del estudiante de primer semestre.

```js
// iOS requiere requestPermission() disparado por un gesto de usuario.
// Ponlo detrás del botón de localizar, no en el load.
if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
  await DeviceOrientationEvent.requestPermission();
}
window.addEventListener('deviceorientationabsolute', e => setHeading(e.alpha), true);
```

Renderiza un cono de ~60° translúcido desde el marcador. Degrada limpio: si no hay sensor o se deniega el permiso, el marcador queda como está, sin mensajes de error.

### 9.3 Onboarding mínimo

En la primera visita (flag en `localStorage`), tras aceptar el aviso de privacidad: sheet en `half` con un texto de tres líneas y el mapa encuadrado al campus. Un empty state es una invitación a actuar, no un espacio muerto.

> Toca cualquier edificio para ver qué hay dentro.
> Filtra por categoría con los chips de arriba.
> ¿Perdido? Toca ⊕ para ubicarte.

Nada de tour multipaso con overlays. Una pantalla, se cierra al primer toque en el mapa.

---

## FASE 10 (opcional, rama aparte) — Migración a vector tiles

**No ejecutes esta fase junto con las demás.** Rama `exp/maplibre`.

Motivación: es la mejora de calidad visual más grande disponible, pero implica reescribir la capa de render.

- **Protomaps + PMTiles**: extrae el bbox del campus a un solo archivo `.pmtiles` (pocos MB) servido desde el mismo GitHub Pages. Ganas control total del estilo (puedes atenuar o apagar los edificios vecinos que hoy compiten con los tuyos), funcionamiento offline real y cero dependencia de servidores de terceros.
- **MapLibre GL JS** con `fill-extrusion` usando `building:levels` de OSM: edificios en 3D. Para orientación en campus, el reconocimiento volumétrico es sustancialmente mejor que la planta — un estudiante reconoce la silueta del edificio, no su huella.
- `router.js` es agnóstico al render y **no requiere cambios**; solo cambia cómo se dibuja la polilínea resultante.

Evalúa con una prueba de concepto de un día antes de comprometerte.

---

## Orden de ejecución y commits

| # | Fase | Commit sugerido |
|---|---|---|
| 1 | Tokens + paleta | `feat(ui): sistema de tokens y paleta accesible` |
| 2 | Legibilidad del mapa | `feat(map): basemap claro, opacidad diferencial, labels y bounds` |
| 3 | Panel lateral | `feat(ui): chips en fila, lista por distancia, cross-highlight, padding de fitBounds` |
| 4 | Búsqueda | `feat(search): fuzzy con Fuse.js, alias y navegación por teclado` |
| 5 | Móvil | `feat(mobile): bottom sheet con snap points` |
| 6 | Flujo de ruta | `refactor(route): elimina tabs, entrada desde panel de edificio` |
| 7 | Accesibilidad | `fix(a11y): contraste, focus visible, aria y reduced-motion` |
| 8 | Perf + PWA | `feat(pwa): service worker, manifest y offline` |
| 9 | Extras | `feat: deep links, rumbo del usuario y onboarding` |

Actualiza `README.md` y `README.es.md` al final: sección de features, el campo `aliases` del GeoJSON y la nota de instalación como PWA.

---

## Bibliografía

- Leaflet API Reference (`fitBounds`, `flyToBounds`, `maxBounds`, `preferCanvas`, `bindTooltip`) — https://leafletjs.com/reference.html
- CARTO Basemap Styles (Positron / Dark Matter) — https://github.com/CartoDB/basemap-styles
- Fuse.js — https://www.fusejs.io/
- Okabe & Ito, *Color Universal Design* (paleta color-blind safe) — https://jfly.uni-koeln.de/color/
- ColorBrewer 2.0 (esquemas cualitativos) — https://colorbrewer2.org/
- WCAG 2.2 §1.4.1 (uso del color) y §1.4.3 (contraste mínimo) — https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices, patrón Combobox — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- Material Design 3, Bottom Sheets — https://m3.material.io/components/bottom-sheets/guidelines
- Apple HIG, Sheets y tamaño de controles — https://developer.apple.com/design/human-interface-guidelines/sheets
- MDN, Pointer Events — https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- MDN, `DeviceOrientationEvent` — https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
- MDN, Service Worker API y estrategias de caché — https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- web.dev, PWA install criteria — https://web.dev/articles/install-criteria
- Protomaps / PMTiles — https://docs.protomaps.com/
- MapLibre GL JS, `fill-extrusion` — https://maplibre.org/maplibre-style-spec/layers/#fill-extrusion
- Nielsen Norman Group, 10 Usability Heuristics — https://www.nngroup.com/articles/ten-usability-heuristics/
