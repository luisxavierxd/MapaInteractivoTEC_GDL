console.info('[router.js] cargado');
const SNAP_DECIMALS = 5;   // ~1 m — precision for node deduplication
const SNAP_THRESHOLD = 3;  // m  — auto-connect endpoints closer than this

function snapCoord(n) {
  return parseFloat(n.toFixed(SNAP_DECIMALS));
}

function nodeKey(lng, lat) {
  return `${snapCoord(lng)},${snapCoord(lat)}`;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class CampusRouter {
  constructor() {
    this.nodes = new Map(); // key -> { lat, lng }
    this.edges = new Map(); // key -> [{ to, dist }]
    this.edgeCount = 0;
  }

  load(geojson) {
    this._lineEndpoints = new Set(); // nodes that are first/last coord of a LineString

    for (const feature of geojson.features) {
      const { type, coordinates } = feature.geometry;
      if (type === 'LineString') {
        this._addLine(coordinates);
      } else if (type === 'MultiLineString') {
        for (const line of coordinates) this._addLine(line);
      }
    }

    const fixed = this._resolveTopology();

    console.info(
      `[CampusRouter] ${this.nodes.size} nodos · ${this.edgeCount} aristas` +
      (fixed ? ` · ${fixed} conexiones topológicas (≤${SNAP_THRESHOLD} m)` : '')
    );
  }

  _addLine(coords) {
    if (coords.length < 2) return;
    this._lineEndpoints.add(nodeKey(coords[0][0], coords[0][1]));
    this._lineEndpoints.add(nodeKey(coords[coords.length - 1][0], coords[coords.length - 1][1]));

    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      const k1 = nodeKey(lng1, lat1);
      const k2 = nodeKey(lng2, lat2);

      if (!this.nodes.has(k1)) this.nodes.set(k1, { lat: snapCoord(lat1), lng: snapCoord(lng1) });
      if (!this.nodes.has(k2)) this.nodes.set(k2, { lat: snapCoord(lat2), lng: snapCoord(lng2) });
      if (!this.edges.has(k1)) this.edges.set(k1, []);
      if (!this.edges.has(k2)) this.edges.set(k2, []);

      const dist = haversine(lat1, lng1, lat2, lng2);
      this.edges.get(k1).push({ to: k2, dist });
      this.edges.get(k2).push({ to: k1, dist });
      this.edgeCount++;
    }
  }

  // Fix topology after loading:
  //   1. Close endpoint gaps (two LineString endpoints within SNAP_THRESHOLD
  //      that represent the same logical junction but are slightly apart).
  //   2. T-intersection splits: when a LineString endpoint N projects onto the
  //      interior of segment k1→k2 within SNAP_THRESHOLD, split k1→k2 at the
  //      projection point P (k1↔P, P↔k2) and connect N↔P.
  //      This is geometrically correct — it avoids the "connect N to both k1
  //      and k2" approximation, which allows Dijkstra to use wrong straight-line
  //      costs as shortcuts through empty space.
  _resolveTopology() {
    let count = 0;
    const epList = Array.from(this._lineEndpoints);

    // ── 1. Endpoint-to-endpoint gap closures ─────────────────────────────────
    for (let i = 0; i < epList.length; i++) {
      const kA = epList[i];
      const nA = this.nodes.get(kA);
      if (!nA) continue;
      for (let j = i + 1; j < epList.length; j++) {
        const kB = epList[j];
        const nB = this.nodes.get(kB);
        if (!nB) continue;
        const d = haversine(nA.lat, nA.lng, nB.lat, nB.lng);
        if (d <= 0 || d > SNAP_THRESHOLD) continue;
        if ((this.edges.get(kA) ?? []).some(e => e.to === kB)) continue;
        if (!this.edges.has(kA)) this.edges.set(kA, []);
        if (!this.edges.has(kB)) this.edges.set(kB, []);
        this.edges.get(kA).push({ to: kB, dist: d });
        this.edges.get(kB).push({ to: kA, dist: d });
        count++;
      }
    }

    // ── 2. T-intersection splits ──────────────────────────────────────────────
    // Collect all projections of LineString endpoints onto segment interiors.
    const segSplits = new Map(); // canonKey → { k1, k2, pts: [{t, lat, lng, nKey}] }

    for (const nKey of epList) {
      const node = this.nodes.get(nKey);
      if (!node) continue;
      const cosLat = Math.cos(node.lat * Math.PI / 180);
      const seen = new Set();

      for (const [k1, edgeList] of this.edges) {
        const n1 = this.nodes.get(k1);
        for (const edge of edgeList) {
          const canonKey = k1 < edge.to ? `${k1}|${edge.to}` : `${edge.to}|${k1}`;
          if (seen.has(canonKey)) continue;
          seen.add(canonKey);
          const k2 = edge.to;
          if (k1 === nKey || k2 === nKey) continue;

          const n2 = this.nodes.get(k2);
          const abLat = n2.lat - n1.lat, abLng = (n2.lng - n1.lng) * cosLat;
          const apLat = node.lat - n1.lat, apLng = (node.lng - n1.lng) * cosLat;
          const len2 = abLat * abLat + abLng * abLng;
          if (len2 === 0) continue;

          const t = (apLat * abLat + apLng * abLng) / len2;
          if (t < 1e-4 || t > 1 - 1e-4) continue; // interior only

          const projLat = n1.lat + t * (n2.lat - n1.lat);
          const projLng = n1.lng + t * (n2.lng - n1.lng);
          if (haversine(node.lat, node.lng, projLat, projLng) > SNAP_THRESHOLD) continue;

          if (!segSplits.has(canonKey)) segSplits.set(canonKey, { k1, k2, pts: [] });
          segSplits.get(canonKey).pts.push({ t, lat: projLat, lng: projLng, nKey });
        }
      }
    }

    // ── 3. Segment-segment crossing detection ────────────────────────────────
    // When two segments cross in their interiors (X-intersection drawn in geojson.io
    // without a shared node), split both at the crossing point so routing can use it.
    {
      const allEdges = [];
      const edgeSeen = new Set();
      for (const [k1, adjList] of this.edges) {
        for (const e of adjList) {
          const canon = k1 < e.to ? `${k1}|${e.to}` : `${e.to}|${k1}`;
          if (!edgeSeen.has(canon)) { edgeSeen.add(canon); allEdges.push([k1, e.to]); }
        }
      }
      for (let i = 0; i < allEdges.length; i++) {
        const [a1k, a2k] = allEdges[i];
        const a1 = this.nodes.get(a1k), a2 = this.nodes.get(a2k);
        for (let j = i + 1; j < allEdges.length; j++) {
          const [b1k, b2k] = allEdges[j];
          if (a1k === b1k || a1k === b2k || a2k === b1k || a2k === b2k) continue;
          const b1 = this.nodes.get(b1k), b2 = this.nodes.get(b2k);
          const cosLat = Math.cos(((a1.lat + a2.lat) / 2) * Math.PI / 180);
          const rx = a2.lat - a1.lat, ry = (a2.lng - a1.lng) * cosLat;
          const sx = b2.lat - b1.lat, sy = (b2.lng - b1.lng) * cosLat;
          const qpx = b1.lat - a1.lat, qpy = (b1.lng - a1.lng) * cosLat;
          const rxs = rx * sy - ry * sx;
          if (Math.abs(rxs) < 1e-15) continue;
          const t = (qpx * sy - qpy * sx) / rxs;
          const u = (qpx * ry - qpy * rx) / rxs;
          if (t <= 1e-4 || t >= 1 - 1e-4 || u <= 1e-4 || u >= 1 - 1e-4) continue;
          const crossLat = a1.lat + t * (a2.lat - a1.lat);
          const crossLng = a1.lng + t * (a2.lng - a1.lng);
          const aCanon = a1k < a2k ? `${a1k}|${a2k}` : `${a2k}|${a1k}`;
          const bCanon = b1k < b2k ? `${b1k}|${b2k}` : `${b2k}|${b1k}`;
          if (!segSplits.has(aCanon)) segSplits.set(aCanon, { k1: a1k, k2: a2k, pts: [] });
          segSplits.get(aCanon).pts.push({ t, lat: crossLat, lng: crossLng, nKey: null });
          if (!segSplits.has(bCanon)) segSplits.set(bCanon, { k1: b1k, k2: b2k, pts: [] });
          segSplits.get(bCanon).pts.push({ t: u, lat: crossLat, lng: crossLng, nKey: null });
          count++;
        }
      }
    }

    // Apply splits, one segment at a time.
    for (const { k1, k2, pts } of segSplits.values()) {
      pts.sort((a, b) => a.t - b.t);

      // Merge projections that land within 10 cm of each other.
      const merged = [];
      for (const pt of pts) {
        const prev = merged[merged.length - 1];
        if (prev && haversine(prev.lat, prev.lng, pt.lat, pt.lng) < 0.1) {
          prev.nKeys.push(pt.nKey);
        } else {
          merged.push({ lat: pt.lat, lng: pt.lng, nKeys: [pt.nKey] });
        }
      }

      // Remove the original undirected edge k1↔k2.
      this.edges.set(k1, (this.edges.get(k1) ?? []).filter(e => e.to !== k2));
      this.edges.set(k2, (this.edges.get(k2) ?? []).filter(e => e.to !== k1));

      // Build node chain: k1 → P0 → P1 → ... → k2
      const chain = [k1];
      for (const sp of merged) {
        const sk = nodeKey(sp.lng, sp.lat);
        if (!this.nodes.has(sk)) {
          this.nodes.set(sk, { lat: snapCoord(sp.lat), lng: snapCoord(sp.lng) });
          this.edges.set(sk, []);
        }
        chain.push(sk);

        // Connect each endpoint to its projection point.
        const splitNode = this.nodes.get(sk);
        for (const nKey of sp.nKeys) {
          const nNode = this.nodes.get(nKey);
          if (!nNode || (this.edges.get(nKey) ?? []).some(e => e.to === sk)) continue;
          if (!this.edges.has(nKey)) this.edges.set(nKey, []);
          const d = haversine(nNode.lat, nNode.lng, splitNode.lat, splitNode.lng);
          this.edges.get(nKey).push({ to: sk, dist: d });
          this.edges.get(sk).push({ to: nKey, dist: d });
          count++;
        }
      }
      chain.push(k2);

      // Wire the chain: k1↔P0, P0↔P1, ..., Pn↔k2
      for (let i = 0; i < chain.length - 1; i++) {
        const a = chain[i], b = chain[i + 1];
        if ((this.edges.get(a) ?? []).some(e => e.to === b)) continue;
        const na = this.nodes.get(a), nb = this.nodes.get(b);
        const d = haversine(na.lat, na.lng, nb.lat, nb.lng);
        if (!this.edges.has(a)) this.edges.set(a, []);
        if (!this.edges.has(b)) this.edges.set(b, []);
        this.edges.get(a).push({ to: b, dist: d });
        this.edges.get(b).push({ to: a, dist: d });
        count++;
      }
    }

    return count;
  }

  nearestNode(lat, lng) {
    let bestKey = null, bestDist = Infinity;
    for (const [key, node] of this.nodes) {
      const d = haversine(lat, lng, node.lat, node.lng);
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }
    return { key: bestKey, dist: bestDist };
  }

  // Project (lat, lng) onto the nearest edge in the graph.
  // Returns { k1, k2, dist, projLat, projLng } — segment endpoints + actual projection point.
  _nearestEdgePoint(lat, lng) {
    const cosLat = Math.cos(lat * Math.PI / 180);
    let bestDist = Infinity, bestK1 = null, bestK2 = null;
    let bestProjLat = lat, bestProjLng = lng;
    const seen = new Set();

    for (const [k1, edgeList] of this.edges) {
      const n1 = this.nodes.get(k1);
      for (const edge of edgeList) {
        const pairKey = k1 < edge.to ? `${k1}|${edge.to}` : `${edge.to}|${k1}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const n2 = this.nodes.get(edge.to);
        const abLat = n2.lat - n1.lat;
        const abLng = (n2.lng - n1.lng) * cosLat;
        const apLat = lat - n1.lat;
        const apLng = (lng - n1.lng) * cosLat;
        const len2 = abLat * abLat + abLng * abLng;

        let projLat, projLng;
        if (len2 === 0) {
          projLat = n1.lat; projLng = n1.lng;
        } else {
          const t = Math.max(0, Math.min(1, (apLat * abLat + apLng * abLng) / len2));
          projLat = n1.lat + t * (n2.lat - n1.lat);
          projLng = n1.lng + t * (n2.lng - n1.lng);
        }

        const d = haversine(lat, lng, projLat, projLng);
        if (d < bestDist) {
          bestDist = d; bestK1 = k1; bestK2 = edge.to;
          bestProjLat = projLat; bestProjLng = projLng;
        }
      }
    }

    return bestK1
      ? { k1: bestK1, k2: bestK2, dist: bestDist, projLat: bestProjLat, projLng: bestProjLng }
      : null;
  }

  route(fromLat, fromLng, toLat, toLng, fromEntries = [], toEntries = []) {
    const fromCandidates = fromEntries.length ? fromEntries : [[fromLat, fromLng]];
    const toCandidates   = toEntries.length   ? toEntries   : [[toLat,   toLng  ]];

    // Project every candidate onto its nearest segment.
    const projectAll = (candidates) => {
      const result = [];
      for (const [lat, lng] of candidates) {
        const ep = this._nearestEdgePoint(lat, lng);
        if (!ep) continue;
        const n1 = this.nodes.get(ep.k1), n2 = this.nodes.get(ep.k2);
        result.push({
          k1: ep.k1, k2: ep.k2,
          d1: haversine(ep.projLat, ep.projLng, n1.lat, n1.lng),
          d2: haversine(ep.projLat, ep.projLng, n2.lat, n2.lng),
          projLat: ep.projLat, projLng: ep.projLng,
        });
      }
      return result;
    };

    const fromSnaps = projectAll(fromCandidates);
    const toSnaps   = projectAll(toCandidates);
    if (!fromSnaps.length || !toSnaps.length) return null;

    // Degenerate case: origin and destination projected to exactly the same point.
    if (fromSnaps.length === 1 && toSnaps.length === 1) {
      const fs = fromSnaps[0], ts = toSnaps[0];
      if (fs.k1 === ts.k1 && fs.k2 === ts.k2 &&
          Math.abs(fs.projLat - ts.projLat) < 1e-7 &&
          Math.abs(fs.projLng - ts.projLng) < 1e-7) return null;
    }

    // Multi-source Dijkstra: seed ALL from-projections at once so the algorithm
    // automatically picks the globally optimal entry, not just the closest to any edge.
    const dist = new Map();
    const startProj = new Map(); // start node key → projection {lat, lng}
    const pq = [];

    for (const snap of fromSnaps) {
      for (const [cost, key] of [[snap.d1, snap.k1], [snap.d2, snap.k2]]) {
        if (!dist.has(key) || cost < dist.get(key)) {
          dist.set(key, cost);
          startProj.set(key, { lat: snap.projLat, lng: snap.projLng });
          pq.push([cost, key]);
        }
      }
    }

    // For the destination, track the best projection and leg cost per end node.
    const endProj = new Map(); // end node key → { lat, lng, legCost }
    for (const snap of toSnaps) {
      for (const [key, legCost] of [[snap.k1, snap.d1], [snap.k2, snap.d2]]) {
        if (!endProj.has(key) || legCost < endProj.get(key).legCost)
          endProj.set(key, { lat: snap.projLat, lng: snap.projLng, legCost });
      }
    }
    const endSet = new Set(endProj.keys());

    const prev = new Map(), visited = new Set();

    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [cost, key] = pq.shift();
      if (visited.has(key)) continue;
      visited.add(key);

      for (const edge of (this.edges.get(key) ?? [])) {
        const newCost = cost + edge.dist;
        if (newCost < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, newCost);
          prev.set(edge.to, key);
          pq.push([newCost, edge.to]);
        }
      }
    }

    // Pick the end node that minimises graph cost + last leg to destination projection.
    let bestEndKey = null, bestTotal = Infinity;
    for (const [key, info] of endProj) {
      const c = dist.get(key);
      if (c === undefined) continue;
      const total = c + info.legCost;
      if (total < bestTotal) { bestTotal = total; bestEndKey = key; }
    }
    if (!bestEndKey) return null;

    // Reconstruct path back to whichever start node was actually used.
    const startKeys = new Set(startProj.keys());
    const path = [];
    let cur = bestEndKey, actualStartKey = null;
    while (cur !== undefined) {
      const node = this.nodes.get(cur);
      if (!node) break;
      path.unshift([node.lat, node.lng]);
      if (startKeys.has(cur)) { actualStartKey = cur; break; }
      cur = prev.get(cur);
    }

    const fromProj = startProj.get(actualStartKey) ?? { lat: fromLat, lng: fromLng };
    const toProj   = endProj.get(bestEndKey);

    path.unshift([fromProj.lat, fromProj.lng]);
    path.push([toProj.lat, toProj.lng]);

    return { path, distance: bestTotal };
  }
}
