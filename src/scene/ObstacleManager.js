import * as THREE from 'three';

const OBSTACLE_TYPES = {
  wall: { width: 0.5, height: 1.0, depth: 2.0, color: 0x4a5568 },
  tower: { width: 0.3, height: 1.5, depth: 0.3, color: 0x2d3748 },
  hoop: { innerRadius: 0.4, outerRadius: 0.5, height: 0.05, color: 0xe53e3e },
  cone: { radius: 0.2, height: 0.4, color: 0xfbb6ce }
};

const BASE_OBSTACLES = [
  { type: 'wall', position: [1.0, 0.5, 0.0], rotation: [0, 0, 0], name: 'Wall 1' },
  { type: 'wall', position: [-1.0, 0.5, 0.0], rotation: [0, 0, 0], name: 'Wall 2' },
  { type: 'wall', position: [0.0, 0.5, 1.0], rotation: [0, Math.PI / 2, 0], name: 'Wall 3' },
  { type: 'wall', position: [0.0, 0.5, -1.0], rotation: [0, Math.PI / 2, 0], name: 'Wall 4' },
  { type: 'tower', position: [0.0, 0.75, 0.0], rotation: [0, 0, 0], name: 'Tower' },
  { type: 'hoop', position: [0.8, 1.2, 0.8], rotation: [Math.PI / 2, 0, 0], name: 'Hoop' },
  { type: 'cone', position: [-0.8, 0.2, 0.8], rotation: [0, 0, 0], name: 'Cone 1' },
  { type: 'cone', position: [0.8, 0.2, -0.8], rotation: [0, 0, 0], name: 'Cone 2' }
];

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.obstacleMeshes = {};
    this.collisionEnabled = true;
    this.boundary = { minX: -4, maxX: 4, minZ: -4, maxZ: 4, maxY: 4 };
    this.rejectedCount = 0;
    this._sharedResources = {};
    this.loadBaseObstacles();
  }

  loadBaseObstacles() {
    this.clearAll();
    for (const obs of BASE_OBSTACLES) {
      this.addObstacle(obs);
    }
    return this.obstacles;
  }

  addObstacle(def) {
    const obstacle = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: def.type || 'wall',
      position: new THREE.Vector3(...(def.position || [0, 0, 0])),
      rotation: new THREE.Euler(...(def.rotation || [0, 0, 0])),
      name: def.name || `${def.type} ${this.obstacles.length + 1}`,
      scale: def.scale ? new THREE.Vector3(...def.scale) : new THREE.Vector3(1, 1, 1)
    };

    this.obstacles.push(obstacle);
    this._createMesh(obstacle);
    return obstacle;
  }

  removeObstacle(id) {
    const idx = this.obstacles.findIndex(o => o.id === id);
    if (idx !== -1) {
      const obs = this.obstacles[idx];
      if (this.obstacleMeshes[obs.id]) {
        this.scene.remove(this.obstacleMeshes[obs.id]);
        delete this.obstacleMeshes[obs.id];
      }
      this.obstacles.splice(idx, 1);
      return true;
    }
    return false;
  }

  clearAll() {
    for (const obs of this.obstacles) {
      if (this.obstacleMeshes[obs.id]) {
        this.scene.remove(this.obstacleMeshes[obs.id]);
        delete this.obstacleMeshes[obs.id];
      }
    }
    this.obstacles = [];
    this.obstacleMeshes = {};
    for (const type of Object.keys(this._sharedResources)) {
      const shared = this._sharedResources[type];
      shared.geometry.dispose();
      shared.material.dispose();
    }
    this._sharedResources = {};
  }

  _addShared(type) {
    if (this._sharedResources[type]) return this._sharedResources[type];

    const typeDef = OBSTACLE_TYPES[type];
    if (!typeDef) return null;

    let geometry;
    switch (type) {
      case 'wall':
      case 'tower':
        geometry = new THREE.BoxGeometry(typeDef.width, typeDef.height, typeDef.depth);
        break;
      case 'hoop':
        geometry = new THREE.TorusGeometry(typeDef.outerRadius, typeDef.innerRadius, 8, 24);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(typeDef.radius, typeDef.height, 32);
        break;
      default:
        return null;
    }

    const material = new THREE.MeshStandardMaterial({ color: typeDef.color });
    this._sharedResources[type] = { geometry, material };
    return this._sharedResources[type];
  }

  _createMesh(obstacle) {
    const shared = this._addShared(obstacle.type);
    if (!shared) return;

    const mesh = new THREE.Mesh(shared.geometry, shared.material);
    const perfMode = document.documentElement.classList.contains('perf-mode');
    mesh.castShadow = !perfMode;
    if (obstacle.type === 'wall' || obstacle.type === 'tower') {
      mesh.receiveShadow = true;
    }

    mesh.position.copy(obstacle.position);
    mesh.rotation.copy(obstacle.rotation);
    mesh.scale.copy(obstacle.scale);

    mesh.userData = {
      type: 'obstacle',
      obstacleId: obstacle.id,
      obstacleType: obstacle.type
    };

    this.scene.add(mesh);
    this.obstacleMeshes[obstacle.id] = mesh;
    obstacle._worldBox = new THREE.Box3().setFromObject(mesh);
    return mesh;
  }

  updateObstacle(id, updates) {
    const obstacle = this.obstacles.find(o => o.id === id);
    if (!obstacle) return false;

    if (updates.position) {
      obstacle.position.set(...updates.position);
    }
    if (updates.rotation) {
      obstacle.rotation.set(...updates.rotation);
    }
    if (updates.scale) {
      obstacle.scale.set(...updates.scale);
    }

    const mesh = this.obstacleMeshes[id];
    if (mesh) {
      mesh.position.copy(obstacle.position);
      mesh.rotation.copy(obstacle.rotation);
      mesh.scale.copy(obstacle.scale);
      obstacle._worldBox = new THREE.Box3().setFromObject(mesh);
    }

    return true;
  }

  getObstacles() {
    return this.obstacles.map(obs => {
      const { _worldBox, ...rest } = obs;
      return {
        ...rest,
        position: [obs.position.x, obs.position.y, obs.position.z],
        rotation: [obs.rotation.x, obs.rotation.y, obs.rotation.z],
        scale: [obs.scale.x, obs.scale.y, obs.scale.z]
      };
    });
  }

  checkCollision(position, droneSize = 0.1) {
    if (!this.collisionEnabled) return null;

    const half = droneSize / 2;

    for (const obstacle of this.obstacles) {
      const box = obstacle._worldBox;
      if (!box) continue;
      if (position.x + half < box.min.x || position.x - half > box.max.x) continue;
      if (position.y + half < box.min.y || position.y - half > box.max.y) continue;
      if (position.z + half < box.min.z || position.z - half > box.max.z) continue;

      return {
        obstacle: obstacle,
        distance: position.distanceTo(obstacle.position),
        normal: position.clone().sub(obstacle.position).normalize()
      };
    }

    return null;
  }

  getObstacleMeshes() {
    return Object.values(this.obstacleMeshes);
  }

  setCollisionEnabled(enabled) {
    this.collisionEnabled = enabled;
  }

  exportObstacles() {
    return this.getObstacles();
  }

  getBoundary() {
    return { ...this.boundary };
  }

  setBoundary(bounds) {
    if (bounds) this.boundary = { ...this.boundary, ...bounds };
    return this.boundary;
  }

  ensureWithinBoundary(defs) {
    const b = this.boundary;
    const accepted = [];
    const rejected = [];
    for (const def of defs || []) {
      let pos = def && def.position;
      let x, y, z;
      if (Array.isArray(pos)) {
        x = Number(pos[0]);
        y = Number(pos[1]);
        z = Number(pos[2]);
      } else if (pos && typeof pos === 'object') {
        x = Number(pos.x);
        y = Number(pos.y);
        z = Number(pos.z);
      } else {
        x = 0;
        y = 0;
        z = 0;
      }
      const inside = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
        && x >= b.minX && x <= b.maxX
        && z >= b.minZ && z <= b.maxZ
        && y >= 0 && y <= b.maxY;
      if (inside) accepted.push(def);
      else rejected.push(def);
    }
    return { accepted, rejected };
  }

  getRejectedCount() {
    return this.rejectedCount;
  }

  importObstacles(obstacles) {
    this.clearAll();
    const { accepted, rejected } = this.ensureWithinBoundary(obstacles || []);
    this.rejectedCount = rejected.length;
    for (const def of accepted) {
      this.addObstacle(def);
    }
    return this.obstacles;
  }
}
