export class AeroEngine {
  constructor(config = {}) {
    this.reset(config);
  }

  reset(config = {}) {
    this.mass = config.mass ?? 0.5;
    this.gravity = config.gravity ?? 9.81;
    this.max_thrust = config.max_thrust ?? this.mass * this.gravity * 2.5;
    this.drag_coefficient = config.drag_coefficient ?? 0.2;
    this.rotational_drag = config.rotational_drag ?? 8;
    this.max_velocity = config.max_velocity ?? 8;
    this.battery_capacity_wh = config.battery_capacity_wh ?? 15;
    this.energy_drain = config.energy_drain ?? 0.003;
    this.efficiency = config.efficiency ?? 0.85;
    this.altitude_kp = config.altitude_kp ?? 8;
    this.altitude_kd = config.altitude_kd ?? 3;

    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.yawRate = 0;
    this.thrust = 0;
    this.energyUsedWh = 0;
    this._targetZ = undefined;
    this._drag = 0;
    this._tel = undefined;
    this._vel = undefined;
  }

  step(throttle, control = {}, dt = 0.05) {
    const t = Math.min(Math.max(throttle, 0), 1);
    const pitchDeg = control.pitch ?? 0;
    const rollDeg = control.roll ?? 0;
    const yawCmd = control.yaw ?? 0;
    const targetZ = control.targetAltitude;

    this.pitch = pitchDeg;
    this.roll = rollDeg;

    this.yawRate += (yawCmd - this.yawRate) * Math.min(1, this.rotational_drag * dt);
    this.yaw += this.yawRate * dt;

    const pitchRad = pitchDeg * Math.PI / 180;
    const rollRad = rollDeg * Math.PI / 180;
    const yawRad = this.yaw * Math.PI / 180;
    const cosPitch = Math.cos(pitchRad);
    const cosRoll = Math.cos(rollRad);
    const tiltBase = cosPitch * cosRoll;

    let thrustTotal;
    if (targetZ !== undefined && Number.isFinite(targetZ)) {
      const targetVel = this._targetZ === undefined ? 0 : (targetZ - this._targetZ) / dt;
      this._targetZ = targetZ;
      const err = targetZ - this.position.z;
      const errDot = targetVel - this.velocity.z;
      const requiredUp = this.mass * this.gravity + this.altitude_kp * err + this.altitude_kd * errDot;
      const tilt = Math.max(tiltBase, 0.25);
      thrustTotal = Math.min(Math.max(requiredUp / tilt, 0), this.max_thrust);
    } else {
      thrustTotal = t * this.max_thrust;
    }

    const fwdX = Math.cos(yawRad);
    const fwdY = Math.sin(yawRad);
    const rightX = -fwdY;
    const rightY = fwdX;

    const fFwd = -thrustTotal * Math.sin(pitchRad);
    const fRight = thrustTotal * Math.sin(rollRad);
    const fUp = thrustTotal * cosPitch * cosRoll;

    const fx = fFwd * fwdX + fRight * rightX;
    const fy = fFwd * fwdY + fRight * rightY;
    const fz = fUp;

    const v = this.velocity;
    const dragX = -this.drag_coefficient * v.x * Math.abs(v.x);
    const dragY = -this.drag_coefficient * v.y * Math.abs(v.y);
    const dragZ = -this.drag_coefficient * v.z * Math.abs(v.z);

    const ax = (fx + dragX) / this.mass;
    const ay = (fy + dragY) / this.mass;
    const az = (fz - this.mass * this.gravity + dragZ) / this.mass;

    v.x += ax * dt;
    v.y += ay * dt;
    v.z += az * dt;

    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed > this.max_velocity) {
      const scale = this.max_velocity / speed;
      v.x *= scale;
      v.y *= scale;
      v.z *= scale;
    }
    this.position.x += v.x * dt;
    this.position.y += v.y * dt;
    this.position.z += v.z * dt;
    if (this.position.z < 0) {
      this.position.z = 0;
      if (v.z < 0) v.z = 0;
    }

    this.thrust = thrustTotal;
    this._drag = Math.hypot(dragX, dragY, dragZ);
    this.energyUsedWh += this.energy_drain * thrustTotal * dt / this.efficiency;
  }

  getTelemetry() {
    const v = this.velocity;
    const speed = Math.hypot(v.x, v.y, v.z);
    const horizSpeed = Math.hypot(v.x, v.y);
    const bankRad = this.roll * Math.PI / 180;
    let turnRadiusM = Infinity;
    if (horizSpeed > 1e-4) {
      const tanBank = Math.tan(bankRad);
      if (Math.abs(tanBank) > 1e-6) {
        turnRadiusM = (horizSpeed * horizSpeed) / (this.gravity * Math.abs(tanBank));
      }
    }
    const batteryPercent = Math.max(0, 100 * (1 - this.energyUsedWh / this.battery_capacity_wh));
    if (!this._tel) {
      this._tel = {};
      this._vel = {};
    }
    const tel = this._tel;
    this._vel.x = v.x;
    this._vel.y = v.y;
    this._vel.z = v.z;
    tel.pitch = this.pitch;
    tel.roll = this.roll;
    tel.yaw = this.yaw;
    tel.speed_mps = speed;
    tel.altitude_m = this.position.z;
    tel.velocityVector = this._vel;
    tel.thrust = this.thrust;
    tel.drag = this._drag;
    tel.energyUsedWh = this.energyUsedWh;
    tel.batteryPercent = batteryPercent;
    tel.turnRadiusM = turnRadiusM;
    return tel;
  }
}
