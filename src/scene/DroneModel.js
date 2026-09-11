import * as THREE from 'three';

const LED_COLORS = {
  off: 0x000000,
  red: 0xff0000,
  green: 0x00ff00,
  blue: 0x0066ff,
  yellow: 0xffff00,
  cyan: 0x00ffff,
  magenta: 0xff00ff,
  white: 0xffffff,
  purple: 0xaa00ff,
  orange: 0xff8800,
  pink: 0xff44aa
};

export function createDroneMesh() {
  const group = new THREE.Group();
  group.userData.leds = [];
  const SCALE = 0.1 / 0.28;
  const perfMode = document.documentElement.classList.contains('perf-mode');
  const shadows = !perfMode;

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2d5aa0 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a3a6a });
  const blackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const grayMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const motorMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const sensorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const sensorRingMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const darkTrimMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const labelMat = new THREE.MeshLambertMaterial({ color: 0x3fb950 });
  const connMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const wireMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.45 });
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.45 });
  const guardMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const strutMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const footMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const lensMat = new THREE.MeshLambertMaterial({ color: 0x111133 });
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const camBodyMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const camLensMat = new THREE.MeshLambertMaterial({ color: 0x111122 });
  const antennaBaseMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const antennaMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const antennaTipMat = new THREE.MeshLambertMaterial({ color: 0xf85149 });
  const frontArrowMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const defaultLedMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const lowerGeo = new THREE.BoxGeometry(0.28, 0.035, 0.28);
  const upperGeo = new THREE.BoxGeometry(0.26, 0.04, 0.26);
  const topGeo = new THREE.BoxGeometry(0.22, 0.012, 0.22);
  const trimGeo = new THREE.BoxGeometry(0.285, 0.004, 0.285);
  const lineGeo = new THREE.BoxGeometry(0.2, 0.001, 0.002);
  const line2Geo = new THREE.BoxGeometry(0.002, 0.001, 0.2);
  const battGeo = new THREE.BoxGeometry(0.14, 0.025, 0.1);
  const labelGeo = new THREE.BoxGeometry(0.1, 0.003, 0.06);
  const connGeo = new THREE.BoxGeometry(0.03, 0.008, 0.015);
  const armGeo = new THREE.BoxGeometry(0.2, 0.022, 0.032);
  const braceGeo = new THREE.BoxGeometry(0.1, 0.012, 0.018);
  const wireGeo = new THREE.BoxGeometry(0.16, 0.004, 0.006);
  const mountGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.008, 16);
  const motorGeo = new THREE.CylinderGeometry(0.042, 0.048, 0.032, 16);
  const capGeo = new THREE.CylinderGeometry(0.032, 0.042, 0.008, 16);
  const hubGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 8);
  const bladeGeo = new THREE.BoxGeometry(0.22, 0.002, 0.018);
  const tipGeo = new THREE.BoxGeometry(0.04, 0.002, 0.012);
  const guardGeo = new THREE.TorusGeometry(0.14, 0.003, 6, 24);
  const strutGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.035, 6);
  const footGeo = new THREE.CylinderGeometry(0.01, 0.014, 0.018, 8);
  const skidGeo = new THREE.BoxGeometry(0.04, 0.004, 0.008);
  const ledGeo = new THREE.BoxGeometry(0.03, 0.008, 0.015);
  const sideLedGeo = new THREE.BoxGeometry(0.015, 0.008, 0.03);
  const bottomLedGeo = new THREE.BoxGeometry(0.02, 0.006, 0.02);
  const rangeBodyGeo = new THREE.BoxGeometry(0.06, 0.015, 0.04);
  const transGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.012, 12);
  const ringGeo = new THREE.TorusGeometry(0.01, 0.002, 8, 16);
  const frontSensorBodyGeo = new THREE.BoxGeometry(0.05, 0.03, 0.015);
  const lensGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12);
  const csBodyGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12);
  const windowGeo = new THREE.BoxGeometry(0.008, 0.003, 0.008);
  const camBodyGeo = new THREE.BoxGeometry(0.04, 0.03, 0.02);
  const camLensGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.012, 12);
  const lensRingGeo = new THREE.TorusGeometry(0.01, 0.002, 8, 16);
  const antennaBaseGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.015, 8);
  const antennaPoleGeo = new THREE.CylinderGeometry(0.003, 0.004, 0.05, 8);
  const antennaTipGeo = new THREE.SphereGeometry(0.005, 10, 10);
  const frontArrowGeo = new THREE.ConeGeometry(0.04, 0.08, 3);
  const ventGeo = new THREE.BoxGeometry(0.002, 0.018, 0.025);

  const lower = new THREE.Mesh(lowerGeo, bodyMat);
  lower.castShadow = shadows;
  lower.receiveShadow = shadows;
  group.add(lower);

  const upper = new THREE.Mesh(upperGeo, bodyMat);
  upper.position.y = 0.037;
  upper.castShadow = shadows;
  group.add(upper);

  const topPlate = new THREE.Mesh(topGeo, darkMat);
  topPlate.position.y = 0.063;
  topPlate.castShadow = shadows;
  group.add(topPlate);

  const trim = new THREE.Mesh(trimGeo, darkTrimMat);
  trim.position.y = 0.018;
  group.add(trim);

  for (let i = -1; i <= 1; i += 2) {
    const line = new THREE.Mesh(lineGeo, darkTrimMat);
    line.position.set(0, 0.064, i * 0.06);
    group.add(line);
    const line2 = new THREE.Mesh(line2Geo, darkTrimMat);
    line2.position.set(i * 0.06, 0.064, 0);
    group.add(line2);
  }

  const battery = new THREE.Mesh(battGeo, blackMat);
  battery.position.set(0, 0.072, 0.01);
  battery.castShadow = shadows;
  group.add(battery);

  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 0.086, 0.01);
  group.add(label);

  const conn = new THREE.Mesh(connGeo, connMat);
  conn.position.set(0, 0.078, -0.04);
  group.add(conn);

  const armConfigs = [
    { x: 1, z: 1 },
    { x: -1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: -1 }
  ];

  armConfigs.forEach(({ x, z }) => {
    const arm = new THREE.Mesh(armGeo, grayMat);
    arm.position.set(x * 0.18, 0, z * 0.18);
    arm.castShadow = shadows;
    group.add(arm);

    const brace = new THREE.Mesh(braceGeo, grayMat);
    brace.position.set(x * 0.13, -0.012, z * 0.13);
    brace.rotation.y = Math.atan2(z, x);
    group.add(brace);

    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(x * 0.17, 0.012, z * 0.17);
    wire.rotation.y = Math.atan2(z, x);
    group.add(wire);

    const mount = new THREE.Mesh(mountGeo, grayMat);
    mount.position.set(x * 0.28, 0.005, z * 0.28);
    group.add(mount);

    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(x * 0.28, 0.022, z * 0.28);
    motor.castShadow = shadows;
    group.add(motor);

    const cap = new THREE.Mesh(capGeo, motorMat);
    cap.position.set(x * 0.28, 0.042, z * 0.28);
    group.add(cap);

    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(x * 0.28, 0.056, z * 0.28);
    group.add(hub);

    for (let b = 0; b < 2; b++) {
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(x * 0.28, 0.058, z * 0.28);
      bladeGroup.userData.isPropeller = true;

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.y = b * Math.PI / 2;
      bladeGroup.add(blade);

      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(x * 0.1, 0, 0);
      tip.rotation.y = b * Math.PI / 2;
      tip.rotation.z = 0.1;
      bladeGroup.add(tip);

      group.add(bladeGroup);
    }

    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.rotation.x = Math.PI / 2;
    guard.position.set(x * 0.28, 0.05, z * 0.28);
    group.add(guard);

    const strut = new THREE.Mesh(strutGeo, strutMat);
    strut.position.set(x * 0.22, -0.03, z * 0.22);
    group.add(strut);

    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x * 0.22, -0.052, z * 0.22);
    group.add(foot);

    const skid = new THREE.Mesh(skidGeo, footMat);
    skid.position.set(x * 0.22, -0.062, z * 0.22);
    group.add(skid);
  });

  const frontLedPositions = [
    { x: -0.06, z: -0.145 },
    { x: 0.06, z: -0.145 }
  ];
  frontLedPositions.forEach(pos => {
    const mat = defaultLedMat.clone();
    const led = new THREE.Mesh(ledGeo, mat);
    led.position.set(pos.x, 0.01, pos.z);
    led.userData.isLed = true;
    led.userData.ledZone = 'front';
    group.add(led);
    group.userData.leds.push(led);
  });

  const backLedPositions = [
    { x: -0.06, z: 0.145 },
    { x: 0.06, z: 0.145 }
  ];
  backLedPositions.forEach(pos => {
    const mat = defaultLedMat.clone();
    const led = new THREE.Mesh(ledGeo, mat);
    led.position.set(pos.x, 0.01, pos.z);
    led.userData.isLed = true;
    led.userData.ledZone = 'back';
    group.add(led);
    group.userData.leds.push(led);
  });

  const sideLedPositions = [
    { x: -0.145, z: 0, zone: 'left' },
    { x: 0.145, z: 0, zone: 'right' }
  ];
  sideLedPositions.forEach(pos => {
    const mat = defaultLedMat.clone();
    const led = new THREE.Mesh(sideLedGeo, mat);
    led.position.set(pos.x, 0.01, pos.z);
    led.userData.isLed = true;
    led.userData.ledZone = pos.zone;
    group.add(led);
    group.userData.leds.push(led);
  });

  const bottomLedPositions = [
    { x: -0.08, z: -0.08 },
    { x: 0.08, z: -0.08 },
    { x: -0.08, z: 0.08 },
    { x: 0.08, z: 0.08 }
  ];
  bottomLedPositions.forEach(pos => {
    const mat = defaultLedMat.clone();
    const led = new THREE.Mesh(bottomLedGeo, mat);
    led.position.set(pos.x, -0.038, pos.z);
    led.userData.isLed = true;
    led.userData.ledZone = 'bottom';
    group.add(led);
    group.userData.leds.push(led);
  });

  const rangeSensorGroup = new THREE.Group();
  rangeSensorGroup.position.set(0, -0.038, -0.04);

  const rangeBody = new THREE.Mesh(rangeBodyGeo, sensorMat);
  rangeSensorGroup.add(rangeBody);

  for (let side = -1; side <= 1; side += 2) {
    const trans = new THREE.Mesh(transGeo, sensorRingMat);
    trans.position.set(side * 0.015, -0.01, 0);
    rangeSensorGroup.add(trans);

    const ring = new THREE.Mesh(ringGeo, sensorRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(side * 0.015, -0.017, 0);
    rangeSensorGroup.add(ring);
  }

  rangeSensorGroup.userData.isSensor = true;
  rangeSensorGroup.userData.sensorType = 'range_bottom';
  group.add(rangeSensorGroup);

  const frontSensorGroup = new THREE.Group();
  frontSensorGroup.position.set(0, -0.005, -0.145);

  const frontSensorBody = new THREE.Mesh(frontSensorBodyGeo, sensorMat);
  frontSensorGroup.add(frontSensorBody);

  for (let side = -1; side <= 1; side += 2) {
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(side * 0.012, 0, -0.01);
    frontSensorGroup.add(lens);
  }

  frontSensorGroup.userData.isSensor = true;
  frontSensorGroup.userData.sensorType = 'range_front';
  group.add(frontSensorGroup);

  const colorSensorGroup = new THREE.Group();
  colorSensorGroup.position.set(0, -0.038, 0.04);

  const csBody = new THREE.Mesh(csBodyGeo, sensorMat);
  colorSensorGroup.add(csBody);

  const windowPositions = [
    { x: -0.005, z: -0.005 },
    { x: 0.005, z: -0.005 },
    { x: -0.005, z: 0.005 },
    { x: 0.005, z: 0.005 }
  ];
  windowPositions.forEach(pos => {
    const w = new THREE.Mesh(windowGeo, windowMat);
    w.position.set(pos.x, -0.007, pos.z);
    colorSensorGroup.add(w);
  });

  colorSensorGroup.userData.isSensor = true;
  colorSensorGroup.userData.sensorType = 'color';
  group.add(colorSensorGroup);

  const camGroup = new THREE.Group();
  camGroup.position.set(0, 0.01, -0.145);

  const camBody = new THREE.Mesh(camBodyGeo, camBodyMat);
  camGroup.add(camBody);

  const camLens = new THREE.Mesh(camLensGeo, camLensMat);
  camLens.rotation.x = Math.PI / 2;
  camLens.position.z = -0.015;
  camGroup.add(camLens);

  const lensRing = new THREE.Mesh(lensRingGeo, sensorRingMat);
  lensRing.rotation.x = Math.PI / 2;
  lensRing.position.z = -0.015;
  camGroup.add(lensRing);

  camGroup.userData.isSensor = true;
  camGroup.userData.sensorType = 'camera';
  group.add(camGroup);

  const antennaBase = new THREE.Mesh(antennaBaseGeo, antennaBaseMat);
  antennaBase.position.set(0.08, 0.072, 0);
  group.add(antennaBase);

  const antennaPole = new THREE.Mesh(antennaPoleGeo, antennaMat);
  antennaPole.position.set(0.08, 0.1, 0);
  group.add(antennaPole);

  const antennaTip = new THREE.Mesh(antennaTipGeo, antennaTipMat);
  antennaTip.position.set(0.08, 0.135, 0);
  group.add(antennaTip);

  const frontArrow = new THREE.Mesh(frontArrowGeo, frontArrowMat);
  frontArrow.position.set(0, 0.015, -0.17);
  frontArrow.rotation.x = Math.PI / 2;
  frontArrow.userData.isFrontIndicator = true;
  group.add(frontArrow);

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(ventGeo, darkTrimMat);
      vent.position.set(side * 0.142, 0.005, -0.05 + i * 0.032);
      group.add(vent);
    }
  }

  group.scale.set(SCALE, SCALE, SCALE);

  return group;
}

export function setLedColor(group, colorName, zone = 'all') {
  const color = LED_COLORS[colorName] ?? LED_COLORS.off;
  if (!group.userData.leds) return;

  group.userData.leds.forEach(led => {
    if (zone === 'all' || led.userData.ledZone === zone) {
      led.material.color.setHex(color);
    }
  });
}

export function setAllLeds(group, colorName) {
  setLedColor(group, colorName, 'all');
}

export function disposeDroneMesh(group) {
  group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
      if (o.material.map) o.material.map.dispose();
    }
  });
}