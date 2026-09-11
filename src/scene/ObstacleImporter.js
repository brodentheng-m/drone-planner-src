const OBSTACLE_TYPES = ['wall', 'tower', 'hoop', 'cone'];

const DEFAULT_DIMS = {
  wall: { width: 0.5, height: 1.0, depth: 2.0 },
  tower: { width: 0.3, height: 1.5, depth: 0.3 },
  hoop: { width: 0.5, height: 1.0, depth: 0.5 },
  cone: { width: 0.4, height: 0.4, depth: 0.4 }
};

function maybeNum(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toNumber(v, fallback = 0) {
  const n = maybeNum(v);
  return n === undefined ? fallback : n;
}

function normType(t) {
  if (typeof t === 'string' && OBSTACLE_TYPES.includes(t.toLowerCase())) return t.toLowerCase();
  return 'wall';
}

function normRotation(r) {
  if (Array.isArray(r)) return [0, 1, 2].map(i => toNumber(r[i], 0));
  return [0, 0, 0];
}

export class ObstacleImporter {
  parseJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return this._normalizeJSONList(data);
    if (data && Array.isArray(data.obstacles)) return this._normalizeJSONList(data.obstacles);
    if (data && (data.type === 'FeatureCollection' || data.type === 'Feature')) {
      return this._parseGeoJSON(data, {});
    }
    throw new Error('JSON must be an array of obstacles or an object with an "obstacles" array');
  }

  _normalizeJSONList(list) {
    const out = [];
    list.forEach((item, i) => {
      const def = this._coerceJSONDef(item, i);
      if (def) out.push(def);
    });
    return out;
  }

  _coerceJSONDef(item, i) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name
      : (item.label != null ? String(item.label) : undefined);

    const bboxKeys = ['cx', 'cy', 'cz', 'width', 'height', 'depth', 'radius'];
    const hasBBox = bboxKeys.some(k => item[k] !== undefined && item[k] !== null);

    let type = item.type ? normType(item.type) : 'wall';
    let position = null;
    let scale = Array.isArray(item.scale)
      ? [0, 1, 2].map(i => toNumber(item.scale[i], 1))
      : null;

    if (Array.isArray(item.position) && item.position.length >= 3) {
      position = item.position.slice(0, 3).map(v => toNumber(v, 0));
    } else if (item.x !== undefined || item.y !== undefined || item.z !== undefined) {
      position = [toNumber(item.x, 0), toNumber(item.y, 0), toNumber(item.z, 0)];
    }

    if (hasBBox) {
      const cx = maybeNum(item.cx) ?? toNumber(item.x, 0);
      const cz = maybeNum(item.cz) ?? toNumber(item.z, 0);
      const cyExplicit = maybeNum(item.cy) ?? maybeNum(item.y);
      const w = maybeNum(item.width);
      const h = maybeNum(item.height);
      const d = maybeNum(item.depth);
      const r = maybeNum(item.radius);

      if (r !== undefined) {
        type = item.type ? normType(item.type) : 'cone';
        const dims = DEFAULT_DIMS.cone;
        const hh = h ?? r * 2;
        const cy = cyExplicit ?? hh / 2;
        position = [cx, cy, cz];
        scale = [(r * 2) / dims.width, hh / dims.height, (r * 2) / dims.depth];
      } else {
        if (!item.type) {
          type = (h !== undefined && w !== undefined && d !== undefined && h > w && h > d)
            ? 'tower'
            : 'wall';
        }
        const dims = DEFAULT_DIMS[type];
        const cy = cyExplicit ?? (h ?? dims.height) / 2;
        position = [cx, cy, cz];
        scale = [(w ?? dims.width) / dims.width, (h ?? dims.height) / dims.height, (d ?? dims.depth) / dims.depth];
      }
    }

    if (!position) position = [0, 0, 0];

    const def = { type, position, rotation: normRotation(item.rotation) };
    if (name) def.name = name;
    if (scale) def.scale = scale;
    return def;
  }

  parseGeoJSON(text, options = {}) {
    return this._parseGeoJSON(JSON.parse(text), options);
  }

  _parseGeoJSON(data, options = {}) {
    const scale = toNumber(options.scale, 1);
    const features = this._extractFeatures(data);
    const defs = [];
    features.forEach((feature, i) => {
      const def = this._featureToDef(feature, i, scale);
      if (def) defs.push(def);
    });
    return defs;
  }

  _extractFeatures(data) {
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) return data.features;
    if (data.type === 'Feature') return [data];
    if (data.type === 'GeometryCollection' && Array.isArray(data.geometries)) {
      return data.geometries.map(g => ({ type: 'Feature', properties: {}, geometry: g }));
    }
    if (Array.isArray(data.features)) return data.features;
    if (data.type && data.coordinates) return [{ type: 'Feature', properties: data.properties || {}, geometry: data }];
    if (Array.isArray(data)) return data;
    throw new Error('Not a valid GeoJSON document');
  }

  _featureToDef(feature, i, scale) {
    const geom = feature.geometry || feature;
    if (!geom || !geom.type) return null;
    const props = feature.properties || {};
    const name = (props.name != null && String(props.name).trim())
      || (props.title != null ? String(props.title) : null)
      || (feature.id != null ? String(feature.id) : null)
      || `Geo Obstacle ${i + 1}`;
    const height = maybeNum(props.height);
    const width = maybeNum(props.width);
    const depth = maybeNum(props.depth);
    const radius = maybeNum(props.radius);
    const propType = normType(props.type);
    const t = geom.type;

    if (t === 'Point') {
      const c = geom.coordinates || [0, 0];
      const x = toNumber(c[0], 0) * scale;
      const z = toNumber(c[1], 0) * scale;
      const type = props.type ? propType : 'wall';
      return this._grounded(type, x, z, { height, width, depth, radius, name });
    }

    if (t === 'Polygon') {
      const ring = geom.coordinates && geom.coordinates[0];
      const ext = this._ringExtents(ring);
      if (!ext) return null;
      const x = ext.cx * scale;
      const z = ext.cz * scale;
      const type = props.type ? propType : 'wall';
      return this._grounded(type, x, z, {
        height,
        width: (ext.maxX - ext.minX) * scale,
        depth: (ext.maxZ - ext.minZ) * scale,
        radius,
        name
      });
    }

    if (t === 'LineString') {
      const ext = this._ringExtents(geom.coordinates);
      if (!ext) return null;
      const x = ext.cx * scale;
      const z = ext.cz * scale;
      const len = Math.max(ext.maxX - ext.minX, ext.maxZ - ext.minZ) * scale;
      const type = props.type ? propType : 'wall';
      return this._grounded(type, x, z, { height, width, depth: Math.max(len, 0.5), radius, name });
    }

    const pts = [];
    this._collectPoints(geom.coordinates, pts);
    const ext = this._ringExtents(pts);
    if (!ext) return null;
    const x = ext.cx * scale;
    const z = ext.cz * scale;
    const type = props.type ? propType : 'wall';
    const spanX = (ext.maxX - ext.minX) * scale;
    const spanZ = (ext.maxZ - ext.minZ) * scale;
    return this._grounded(type, x, z, {
      height,
      width: spanX > 0 ? spanX : undefined,
      depth: spanZ > 0 ? spanZ : undefined,
      radius,
      name
    });
  }

  _ringExtents(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    let sumX = 0, sumZ = 0, n = 0;
    for (const pt of coords) {
      if (!Array.isArray(pt)) continue;
      const x = maybeNum(pt[0]);
      const z = maybeNum(pt[1]);
      if (x === undefined || z === undefined) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      sumX += x;
      sumZ += z;
      n++;
    }
    if (n === 0) return null;
    return { minX, maxX, minZ, maxZ, cx: sumX / n, cz: sumZ / n };
  }

  _collectPoints(coords, out) {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      out.push(coords);
      return;
    }
    for (const c of coords) this._collectPoints(c, out);
  }

  _grounded(type, x, z, opts = {}) {
    type = normType(type);
    const dims = DEFAULT_DIMS[type];
    const name = opts.name || undefined;
    const rotation = opts.rotation ? normRotation(opts.rotation) : [0, 0, 0];

    if (type === 'hoop') {
      const h = maybeNum(opts.height) ?? 1.0;
      const rot = opts.rotation ? normRotation(opts.rotation) : [Math.PI / 2, 0, 0];
      const def = {
        type: 'hoop',
        position: [toNumber(x), maybeNum(opts.y) ?? h, toNumber(z)],
        rotation: rot,
        scale: [1, 1, 1]
      };
      if (name) def.name = name;
      return def;
    }

    const radius = maybeNum(opts.radius);
    let height = maybeNum(opts.height) ?? dims.height;
    let width = maybeNum(opts.width);
    let depth = maybeNum(opts.depth);

    if (type === 'cone' && radius !== undefined) {
      width = radius * 2;
      depth = radius * 2;
      if (maybeNum(opts.height) === undefined) height = radius * 2;
    }

    width = width ?? dims.width;
    depth = depth ?? dims.depth;
    if (width <= 0) width = dims.width;
    if (height <= 0) height = dims.height;
    if (depth <= 0) depth = dims.depth;

    const y = maybeNum(opts.y) ?? height / 2;
    const def = {
      type,
      position: [toNumber(x), y, toNumber(z)],
      rotation,
      scale: [width / dims.width, height / dims.height, depth / dims.depth]
    };
    if (name) def.name = name;
    return def;
  }

  parseCSV(text) {
    const rows = this._parseCSVrows(text);
    if (rows.length === 0) return [];
    const header = rows[0].map(h => String(h).trim().toLowerCase());
    const defs = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || (row.length === 1 && String(row[0]).trim() === '')) continue;
      const def = this._csvRowToDef(header, row, r);
      if (def) defs.push(def);
    }
    return defs;
  }

  _parseCSVrows(text) {
    const lines = String(text).split(/\r\n|\r|\n/);
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          cells.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      cells.push(cur);
      rows.push(cells);
    }
    return rows;
  }

  _csvRowToDef(header, row, idx) {
    const get = (h) => {
      const i = header.indexOf(h);
      return i >= 0 && i < row.length ? row[i] : undefined;
    };
    const typeRaw = (get('type') || '').toString().trim().toLowerCase();
    const type = OBSTACLE_TYPES.includes(typeRaw) ? typeRaw : 'wall';
    const x = maybeNum(get('x')) ?? 0;
    const z = maybeNum(get('z')) ?? 0;
    const y = maybeNum(get('y')) ?? maybeNum(get('altitude'));
    const height = maybeNum(get('height'));
    const width = maybeNum(get('width'));
    const depth = maybeNum(get('depth'));
    const radius = maybeNum(get('radius'));
    const name = (get('name') != null && String(get('name')).trim()) ? String(get('name')).trim() : undefined;
    const rotation = [
      maybeNum(get('rotation_x')) ?? 0,
      maybeNum(get('rotation_y')) ?? 0,
      maybeNum(get('rotation_z')) ?? 0
    ];

    return this._grounded(type, x, z, { height, width, depth, radius, name, rotation, y });
  }

  parseOBJ(text) {
    const lines = String(text).split(/\r\n|\r|\n/);
    const vertices = [];
    let currentName = null;
    let faceCount = 0;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      const tag = line[0];
      if (tag === 'v') {
        const parts = line.split(/\s+/);
        if (parts[0] === 'v' && parts.length >= 4) {
          vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        }
      } else if (tag === 'o' || tag === 'g') {
        currentName = line.split(/\s+/).slice(1).join(' ') || null;
      } else if (tag === 'f') {
        faceCount++;
      }
    }

    if (vertices.length === 0) return [];

    if (faceCount > 0 || vertices.length > 200) {
      const b = this._bbox(vertices);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const w = Math.max(b.maxX - b.minX, 0.001);
      const h = Math.max(b.maxY - b.minY, 0.001);
      const d = Math.max(b.maxZ - b.minZ, 0.001);
      const type = (h > w && h > d) ? 'tower' : 'wall';
      const dims = DEFAULT_DIMS[type];
      const def = {
        type,
        position: [cx, cy, cz],
        rotation: [0, 0, 0],
        scale: [w / dims.width, h / dims.height, d / dims.depth]
      };
      if (currentName) def.name = currentName;
      return [def];
    }

    return vertices.map((v, i) => {
      const def = {
        type: 'wall',
        position: [v[0], v[1], v[2]],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      };
      def.name = currentName || `OBJ Obstacle ${i + 1}`;
      return def;
    });
  }

  _bbox(vertices) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const v of vertices) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }

  run(text, filenameOrExt, options = {}) {
    const f = String(filenameOrExt || '');
    const m = f.match(/\.([a-z0-9]+)$/i);
    const ext = m ? m[1].toLowerCase() : f.toLowerCase().replace(/^\./, '');
    let obstacles;
    if (ext === 'json') obstacles = this.parseJSON(text);
    else if (ext === 'geojson') obstacles = this.parseGeoJSON(text, options);
    else if (ext === 'csv') obstacles = this.parseCSV(text);
    else if (ext === 'obj') obstacles = this.parseOBJ(text);
    else throw new Error(`Unsupported obstacle file type: ${f || '(none)'}`);
    return { obstacles };
  }
}
