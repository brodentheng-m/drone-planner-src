import * as THREE from 'three';

export class FlightTrail {
  constructor(scene) {
    this.scene = scene;
    this.maxPoints = 2000;
    this.count = 0;

    this.positionAttr = new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3), 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);

    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', this.positionAttr);
    this.lineGeo.setDrawRange(0, 0);

    this.lineMat = new THREE.LineBasicMaterial({
      color: 0x22c55e,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });
    this.line = new THREE.Line(this.lineGeo, this.lineMat);
    this.line.renderOrder = 10;
    this.line.frustumCulled = false;
    scene.add(this.line);

    this.glowGeo = new THREE.SphereGeometry(0.04, 8, 8);
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.4 });
    this.glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    this.glow.visible = false;
    scene.add(this.glow);

    this.startMarker = this._createMarker(0x3fb950);
    this.startMarker.visible = false;
    scene.add(this.startMarker);
  }

  _createMarker(color) {
    const geo = new THREE.SphereGeometry(0.06, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  addPoint(pos) {
    if (this.count >= this.maxPoints) {
      this.positionAttr.array.copyWithin(0, 3);
      this.count = this.maxPoints - 1;
    }
    const i = this.count * 3;
    this.positionAttr.array[i] = pos.x;
    this.positionAttr.array[i + 1] = pos.y;
    this.positionAttr.array[i + 2] = pos.z;
    this.count++;
    this.positionAttr.needsUpdate = true;
    this.lineGeo.setDrawRange(0, this.count);

    this.glow.position.copy(pos);
    this.glow.visible = true;

    if (this.count === 1) {
      this.startMarker.position.copy(pos);
      this.startMarker.visible = true;
    }
  }

  clear() {
    this.count = 0;
    this.lineGeo.setDrawRange(0, 0);
    this.glow.visible = false;
    this.startMarker.visible = false;
  }
}
