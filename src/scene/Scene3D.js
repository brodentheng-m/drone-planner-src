import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createDroneMesh, setAllLeds } from './DroneModel.js';
import { FlightTrail } from './FlightTrail.js';
import { ObstacleManager } from './ObstacleManager.js';
import { simulateSwarm, simulateCommands } from './Simulator.js';

const DRONE_TINT_COLORS = [0x58a6ff, 0x3fb950, 0xf0883e, 0xbc8cff, 0x39d2c0, 0xf778ba, 0xd29922, 0xf85149];

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 20, 50);

    const rect = canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 1, 2);

    const perfMode = document.documentElement.classList.contains('perf-mode');

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfMode ? 1 : 1.5));
    this.renderer.shadowMap.enabled = !perfMode;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.15, 0);
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.enabled = true;
    this.controls.addEventListener('change', () => { this.needsRender = true; });

    this.needsRender = true;
    this._scratchVec = new THREE.Vector3();

    this.cameraMode = 1;
    this._camOffset = null;

    this._addLights();
    this._addGround();
    this._addCompass();

    this.droneMeshes = {};
    this.droneTrails = {};
    this.droneLeds = {};
    this.plannedPaths = {};
    this._plannedPathMat = new THREE.LineBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.85 });

    this.swarmResults = null;
    this.simTime = 0;
    this.isPlaying = false;
    this.speed = 1;
    this.onPositionUpdate = null;
    this.onTelemetry = null;
    this.onLog = null;
    this.onCollision = null;
    this.onPlaybackEnd = null;
    this.onProgress = null;
    this._endFired = false;
    this.lastTelemetry = null;
    this.currentCommandIndex = -1;
    this.currentDroneId = null;
    this.activeDroneId = null;
    this.routeMap = {};

    this.obstacleManager = new ObstacleManager(this.scene);
    this.boundaryVisible = true;
    this.boundaryGroup = null;
    this.renderBoundary();

    this.waypointGroup = new THREE.Group();
    this.scene.add(this.waypointGroup);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.canvas.addEventListener('click', (e) => this._onCanvasClick(e));
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
    this.canvas.addEventListener('webglcontextrestored', () => { this.needsRender = true; });

    this._animLoop();
    window.addEventListener('resize', () => this._onResize());

    this._setupTypingMode();
  }

  _setupTypingMode() {
    const codeTextarea = document.getElementById('code-output');
    const typingIndicator = document.getElementById('typing-indicator');
    if (!codeTextarea) return;

    if (typingIndicator) typingIndicator.classList.add('hidden');

    codeTextarea.addEventListener('focus', () => {
      this.controls.enabled = false;
      codeTextarea.classList.add('typing-active');
      if (typingIndicator) typingIndicator.classList.remove('hidden');
    });

    codeTextarea.addEventListener('blur', () => {
      this.controls.enabled = true;
      codeTextarea.classList.remove('typing-active');
      if (typingIndicator) typingIndicator.classList.add('hidden');
    });

    codeTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        codeTextarea.blur();
      }
    });
  }

  _addLights() {
    const ambient = new THREE.AmbientLight(0x303050, 0.4);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x9ecfff, 0x443322, 0.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
    sun.position.set(10, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const key = new THREE.PointLight(0xffeedd, 0.3, 30);
    key.position.set(5, 8, 0);
    this.scene.add(key);
  }

  _addGround() {
    const FT = 0.3048;
    const size = 20;
    const divisions = Math.round(size / FT);

    const grid = new THREE.GridHelper(size, divisions, 0x30363d, 0x21262d);
    grid.material.opacity = 0.6;
    grid.material.transparent = true;
    this.scene.add(grid);

    const majorGrid = new THREE.GridHelper(size, Math.round(size / (FT * 5)), 0x484f58, 0x30363d);
    majorGrid.material.opacity = 0.8;
    majorGrid.material.transparent = true;
    majorGrid.position.y = 0.001;
    this.scene.add(majorGrid);

    const planeGeo = new THREE.PlaneGeometry(size, size);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x0d1117, side: THREE.DoubleSide, roughness: 0.9
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01;
    plane.receiveShadow = true;
    this.scene.add(plane);

    const makeFtLabel = (text, position) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#484f58';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 16);
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.6 }));
      sprite.position.copy(position);
      sprite.scale.set(0.6, 0.3, 1);
      this.scene.add(sprite);
    };

    for (let ft = 5; ft <= Math.round(size / FT); ft += 5) {
      const m = ft * FT;
      if (m > size / 2) break;
      makeFtLabel(`${ft}ft`, new THREE.Vector3(m, 0.02, 0.15));
      makeFtLabel(`${ft}ft`, new THREE.Vector3(-m, 0.02, 0.15));
      makeFtLabel(`${ft}ft`, new THREE.Vector3(0.15, 0.02, m));
      makeFtLabel(`${ft}ft`, new THREE.Vector3(0.15, 0.02, -m));
    }
  }

  _addCompass() {
    const makeLabel = (text, pos) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#8b949e';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 16);
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sprite.position.copy(pos);
      sprite.scale.set(0.4, 0.2, 1);
      this.scene.add(sprite);
    };

    makeLabel('N', new THREE.Vector3(0, 0.05, -3));
    makeLabel('S', new THREE.Vector3(0, 0.05, 3));
    makeLabel('E', new THREE.Vector3(3, 0.05, 0));
    makeLabel('W', new THREE.Vector3(-3, 0.05, 0));
  }

  _ensureDroneMesh(id, colorHex) {
    if (!this.droneMeshes[id]) {
      const mesh = createDroneMesh();
      mesh.position.set(0, 0.05, 0);
      mesh.userData.propellers = [];
      mesh.traverse((c) => {
        if (c.userData.isPropeller) mesh.userData.propellers.push(c);
      });
      this.scene.add(mesh);
      this.droneMeshes[id] = mesh;

      const trail = new FlightTrail(this.scene);
      this.droneTrails[id] = trail;

      this.droneLeds[id] = 'off';
    }

    const mesh = this.droneMeshes[id];
    const colorInt = parseInt(colorHex.replace('#', ''), 16);
    mesh.children.forEach(c => {
      if (c.userData.isFrontIndicator) {
        c.material.color.setHex(colorInt);
      }
    });

    return mesh;
  }

  _removeDroneMesh(id) {
    if (this.droneMeshes[id]) {
      this.scene.remove(this.droneMeshes[id]);
      this.disposeObject3D(this.droneMeshes[id]);
      delete this.droneMeshes[id];
    }
    if (this.droneTrails[id]) {
      this.droneTrails[id].clear();
      delete this.droneTrails[id];
    }
    if (this.plannedPaths[id]) {
      this.scene.remove(this.plannedPaths[id]);
      this.plannedPaths[id].geometry.dispose();
      delete this.plannedPaths[id];
    }
    delete this.droneLeds[id];
  }

   setSwarm(drones) {
    this.needsRender = true;
    const activeIds = new Set(drones.map(d => d.id));

    for (const id of Object.keys(this.droneMeshes)) {
      if (!activeIds.has(id)) this._removeDroneMesh(id);
    }

    for (const drone of drones) {
      this._ensureDroneMesh(drone.id, drone.color);
    }

    this.routeMap = {};
    for (const drone of drones) {
      this.routeMap[drone.id] = [];
    }

    this.swarmResults = simulateSwarm(drones, this.obstacleManager, (cmd, index, state) => {
      this.currentCommandIndex = index;
      if (state && state.id && this.routeMap[state.id]) {
        this.routeMap[state.id].push({ index, posIndex: state.positions.length });
      }
    });
    this._endFired = false;

    for (const id of Object.keys(this.plannedPaths)) {
      this.scene.remove(this.plannedPaths[id]);
      this.plannedPaths[id].geometry.dispose();
    }
    this.plannedPaths = {};

    for (const drone of drones) {
      const result = this.swarmResults[drone.id];
      if (result && result.positions.length > 0) {
        const pts = result.positions.map(p => new THREE.Vector3(p.x, p.z, p.y));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, this._plannedPathMat);
        line.frustumCulled = false;
        this.scene.add(line);
        this.plannedPaths[drone.id] = line;
      }
    }

    for (const drone of drones) {
      const result = this.swarmResults[drone.id];
      const mesh = this.droneMeshes[drone.id];
      if (result.positions.length > 0) {
        const p = result.positions[0];
        mesh.position.set(p.x, p.z, p.y);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(0, 0, 0);
      }
      if (this.droneTrails[drone.id]) {
        this.droneTrails[drone.id].clear();
      }
    }

    this._buildWaypoints(this.activeDroneId);
  }

  setCommands(commands) {
    this.setSwarm([{ id: 'default', commands, color: '#58a6ff', offset: [0, 0, 0] }]);
  }

  setActiveDroneId(id) {
    this.activeDroneId = id;
    this._buildWaypoints(id);
    this.needsRender = true;
  }

  getRoutePoints(droneId) {
    const result = this.swarmResults && this.swarmResults[droneId];
    const boundaries = this.routeMap[droneId];
    if (!result || !boundaries || boundaries.length === 0) return [];

    const points = [];
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1] ? boundaries[i + 1].posIndex : result.positions.length;
      const pos = result.positions[start.posIndex];
      if (!pos) continue;
      points.push({
        x: pos.x,
        y: pos.z,
        z: pos.y,
        commandIndex: start.index
      });

      const span = end - start.posIndex;
      if (span > 30) {
        const midIdx = start.posIndex + Math.floor(span / 2);
        const mid = result.positions[midIdx];
        if (mid) {
          points.push({
            x: mid.x,
            y: mid.z,
            z: mid.y,
            commandIndex: start.index
          });
        }
      }
    }
    return points;
  }

  _clearWaypoints() {
    while (this.waypointGroup.children.length > 0) {
      const child = this.waypointGroup.children[0];
      this.waypointGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  _buildWaypoints(droneId) {
    this._clearWaypoints();
    if (!droneId) return;
    const points = this.getRoutePoints(droneId);
    if (points.length === 0) return;

    const color = new THREE.Color(this.droneMeshes[droneId]
      ? this.droneMeshes[droneId].children.find(c => c.userData.isFrontIndicator)?.material.color.getHex() || 0x00d4ff
      : 0x00d4ff);

    const geometry = new THREE.SphereGeometry(0.045, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85
    });

    points.forEach((pt, i) => {
      let meshMat = material;
      if (color.getHex() !== 0xffffff) {
        meshMat = material.clone();
        meshMat.color.copy(color);
      }
      const mesh = new THREE.Mesh(geometry, meshMat);
      mesh.position.set(pt.x, pt.y + 0.05, pt.z);
      mesh.userData = { isWaypoint: true, commandIndex: pt.commandIndex, waypointIndex: i };
      this.waypointGroup.add(mesh);

      const ringGeo = new THREE.RingGeometry(0.06, 0.07, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.5, side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pt.x, pt.y + 0.05, pt.z);
      ring.rotation.x = -Math.PI / 2;
      ring.userData = { isWaypoint: true, commandIndex: pt.commandIndex, waypointIndex: i };
      this.waypointGroup.add(ring);
    });
  }

  _onCanvasClick(event) {
    if (this.isPlaying) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.waypointGroup.children);
    if (intersects.length === 0) return;

    const hit = intersects.find(i => i.object.userData.isWaypoint);
    if (!hit) return;

    const data = hit.object.userData;
    this.canvas.dispatchEvent(new CustomEvent('waypoint-selected', {
      detail: { commandIndex: data.commandIndex, waypointIndex: data.waypointIndex },
      bubbles: true
    }));
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 2 ? 2 : 1;
    this._camOffset = null;
    if (mode === 1) {
      this.controls.target.set(0, 0.15, 0);
    }
    this.needsRender = true;
  }

  play() {
    if (!this.swarmResults || Object.keys(this.swarmResults).length === 0) {
      if (this.onLog) this.onLog('No commands to play', 'warn');
      return;
    }

    if (this._endFired || this.simTime <= 0) {
      this.simTime = 0;
      this._camOffset = null;
      for (const id of Object.keys(this.droneTrails)) {
        this.droneTrails[id].clear();
      }
      for (const id of Object.keys(this.droneMeshes)) {
        setAllLeds(this.droneMeshes[id], 'off');
        this.droneLeds[id] = 'off';
      }
    }

    this._endFired = false;
    this.isPlaying = true;
    this.needsRender = true;

    let totalFrames = 0;
    for (const id of Object.keys(this.swarmResults)) {
      totalFrames = Math.max(totalFrames, this.swarmResults[id].positions.length);
    }
    if (this.onLog) this.onLog(`Playing swarm: ${Object.keys(this.swarmResults).length} drones, ${totalFrames} frames`, 'success');
  }

  pause() {
    this.isPlaying = false;
    this.needsRender = true;
  }

  stop() {
    this.isPlaying = false;
    this.simTime = 0;
    this._camOffset = null;
    for (const id of Object.keys(this.droneTrails)) {
      this.droneTrails[id].clear();
    }
    for (const [id, result] of Object.entries(this.swarmResults || {})) {
      if (result.positions.length > 0 && this.droneMeshes[id]) {
        const p = result.positions[0];
        this.droneMeshes[id].position.set(p.x, p.z, p.y);
      }
    }
    this.needsRender = true;
  }

  reset() { this.stop(); }
  setSpeed(s) { this.speed = s; }

  setPlaybackFraction(f) {
    if (!this.swarmResults || Object.keys(this.swarmResults).length === 0) return;

    let maxDuration = 0;
    for (const result of Object.values(this.swarmResults)) {
      maxDuration = Math.max(maxDuration, result.totalDuration);
    }
    if (maxDuration <= 0) maxDuration = 1;

    const t = Math.min(1, Math.max(0, f));
    this.isPlaying = false;
    this.simTime = t * maxDuration;
    this._applyFrame(t);

    if (t >= 1 && !this._endFired) {
      this._endFired = true;
      const r = Object.values(this.swarmResults)[0];
      if (this.onPlaybackEnd && r && r.positions.length > 0) this.onPlaybackEnd(r.positions[r.positions.length - 1].z);
    }

    if (this.onProgress) this.onProgress(t);
    this.needsRender = true;
  }

  getObstacles() {
    return this.obstacleManager.getObstacles();
  }

  getObstacleMeshes() {
    return this.obstacleManager.getObstacleMeshes();
  }

  checkCollision(position, droneSize = 0.1) {
    return this.obstacleManager.checkCollision(position, droneSize);
  }

  setCollisionEnabled(enabled) {
    this.obstacleManager.setCollisionEnabled(enabled);
  }

  loadBaseObstacles() {
    this.needsRender = true;
    return this.obstacleManager.loadBaseObstacles();
  }

  clearObstacles() {
    this.needsRender = true;
    this.obstacleManager.clearAll();
  }

  importObstacles(obstacles) {
    this.needsRender = true;
    return this.obstacleManager.importObstacles(obstacles);
  }

  exportObstacles() {
    return this.obstacleManager.exportObstacles();
  }

  removeObstacle(id) {
    this.needsRender = true;
    return this.obstacleManager.removeObstacle(id);
  }

  getRejectedCount() {
    return this.obstacleManager.getRejectedCount();
  }

  getBoundary() {
    return this.obstacleManager.getBoundary();
  }

  setBoundary(bounds) {
    const b = this.obstacleManager.setBoundary(bounds);
    this.renderBoundary();
    this.needsRender = true;
    return b;
  }

  setBoundaryVisible(visible) {
    this.boundaryVisible = !!visible;
    if (this.boundaryGroup) this.boundaryGroup.visible = this.boundaryVisible;
    this.needsRender = true;
  }

  renderBoundary() {
    if (!this.boundaryGroup) {
      this.boundaryGroup = new THREE.Group();
      this.scene.add(this.boundaryGroup);
    }
    while (this.boundaryGroup.children.length > 0) {
      const child = this.boundaryGroup.children[0];
      this.boundaryGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const b = this.obstacleManager.getBoundary();
    const box = new THREE.Box3(
      new THREE.Vector3(b.minX, 0, b.minZ),
      new THREE.Vector3(b.maxX, b.maxY, b.maxZ)
    );
    const helper = new THREE.Box3Helper(box, 0x00d4ff);
    if (helper.material) {
      helper.material.transparent = true;
      helper.material.opacity = 0.5;
      helper.material.depthTest = true;
    }
    this.boundaryGroup.add(helper);
    this.boundaryGroup.visible = this.boundaryVisible;
    this.needsRender = true;
  }

  disposeObject3D(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) {
          o.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      }
    });
  }

  dispose() {
    this.disposeObject3D(this.scene);
    this.renderer.dispose();
  }

  getCurrentCommandIndex() {
    return this.currentCommandIndex;
  }

  getLastTelemetry() {
    return this.lastTelemetry;
  }

  _buildTelemetry(a, b, frac, p) {
    const lerp = (va, vb, fallback) => {
      if (va !== undefined && vb !== undefined) return va + (vb - va) * frac;
      if (va !== undefined) return va;
      if (vb !== undefined) return vb;
      return fallback;
    };
    return {
      speed: lerp(a.speed, b.speed, 0),
      energyUsed: lerp(a.energyUsed, b.energyUsed, 0),
      batteryPercent: lerp(a.batteryPercent, b.batteryPercent, 100),
      turnRadiusM: lerp(a.turnRadiusM, b.turnRadiusM, 0),
      altitude_m: p.z,
      heading: p.heading,
      pitch: p.pitch,
      roll: p.roll
    };
  }

  _applyFrame(t) {
    let firstMesh = null;
    let firstPos = null;
    let firstA = null;
    let firstB = null;
    let firstFrac = 0;

    for (const [id, result] of Object.entries(this.swarmResults)) {
      const mesh = this.droneMeshes[id];
      if (!mesh || result.positions.length === 0) continue;

      const positions = result.positions;
      const rawIdx = t * (positions.length - 1);
      const idx = Math.min(Math.floor(rawIdx), positions.length - 2);
      const frac = rawIdx - idx;
      const a = positions[idx];
      const b = positions[Math.min(idx + 1, positions.length - 1)];
      const p = {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac,
        z: a.z + (b.z - a.z) * frac,
        heading: a.heading + ((b.heading || 0) - (a.heading || 0)) * frac,
        pitch: a.pitch + ((b.pitch || 0) - (a.pitch || 0)) * frac,
        roll: a.roll + ((b.roll || 0) - (a.roll || 0)) * frac,
        led: frac < 0.5 ? a.led : b.led
      };

      mesh.position.set(p.x, p.z, p.y);

      const yaw = -(p.heading || 0) * Math.PI / 180 - Math.PI / 2;
      const pitch = -(p.pitch || 0) * Math.PI / 180;
      const roll = -(p.roll || 0) * Math.PI / 180;

      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(pitch, yaw, roll);

      const propellers = mesh.userData.propellers;
      for (let pi = 0; pi < propellers.length; pi++) {
        propellers[pi].rotation.y += 50 * 0.033;
      }

      if (p.led !== undefined && p.led !== this.droneLeds[id]) {
        this.droneLeds[id] = p.led;
        setAllLeds(mesh, p.led);
      }

      this._scratchVec.set(p.x, p.z, p.y);
      if (this.droneTrails[id]) {
        this.droneTrails[id].addPoint(this._scratchVec);
      }

      if (this.onCollision) {
        const collision = this.checkCollision(this._scratchVec, 0.1);
        if (collision) {
          this.onCollision(collision, id);
        }
      }

      if (!firstMesh) { firstMesh = mesh; firstPos = p; firstA = a; firstB = b; firstFrac = frac; }
    }

    if (this.cameraMode === 1) {
      this.controls.target.set(0, 0.15, 0);
    } else if (this.cameraMode === 2 && firstMesh) {
      const dronePos = firstMesh.position;
      if (!this._camOffset) {
        this._camOffset = new THREE.Vector3().copy(this.camera.position).sub(dronePos);
      }
      this.camera.position.copy(dronePos).add(this._camOffset);
      this.controls.target.copy(dronePos);
    }

    if (this.onPositionUpdate && firstPos) {
      this.onPositionUpdate(firstPos.x, firstPos.y, firstPos.z, firstPos.heading);
    }

    if (firstPos) {
      const telemetry = this._buildTelemetry(firstA, firstB, firstFrac, firstPos);
      this.lastTelemetry = telemetry;
      if (this.onTelemetry) this.onTelemetry(telemetry);
    }
  }

  _animLoop() {
    requestAnimationFrame(() => this._animLoop());

    this.controls.update();

    if (!this.needsRender) return;
    this.needsRender = false;

    if (this.isPlaying && this.swarmResults) {
      this.needsRender = true;
      const dt = 0.033 * this.speed;
      this.simTime += dt;

      let maxDuration = 0;
      for (const result of Object.values(this.swarmResults)) {
        maxDuration = Math.max(maxDuration, result.totalDuration);
      }
      if (maxDuration <= 0) maxDuration = 1;
      const t = Math.min(this.simTime / maxDuration, 1);

      this._applyFrame(t);

      if (t >= 1 && !this._endFired) {
        this._endFired = true;
        this.isPlaying = false;
        this.needsRender = true;
        const r = Object.values(this.swarmResults)[0];
        if (this.onPlaybackEnd && r && r.positions.length > 0) this.onPlaybackEnd(r.positions[r.positions.length - 1].z);
      }

      if (this.onProgress) this.onProgress(t);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    const perfMode = document.documentElement.classList.contains('perf-mode');
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfMode ? 1 : 1.5));
    this.needsRender = true;
  }
}
