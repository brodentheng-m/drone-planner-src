import * as THREE from 'three';
import { AeroEngine } from './AeroEngine.js';

const TAKEOFF_HEIGHT = 0.8;
const FLIP_TRAVEL = 0.35;
const FLIP_CLIMB = 0.2;
const FLIP_POINTS = 6;
const FLIP_SETTLE = 2;
const DEFAULT_SPEED = 0.5;
const DT = 0.05;
const MAX_PITCH = 25;
const MAX_ROLL = 25;
const MAX_YAW_RATE = 180;

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function pos(x, y, z, heading, pitch = 0, roll = 0, led) {
  const p = { x, y, z, heading, pitch, roll };
  if (led !== undefined) p.led = led;
  return p;
}

function replaceVars(expr, vars) {
  let result = expr;
  const varNames = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const name of varNames) {
    result = result.replace(new RegExp('\\b' + name + '\\b', 'g'), JSON.stringify(vars[name]));
  }
  return result;
}

const _exprCache = new Map();
function evalExpr(expr, vars) {
  try {
    const replaced = replaceVars(expr, vars);
    let fn = _exprCache.get(replaced);
    if (!fn) {
      fn = Function('"use strict"; return (' + replaced + ')');
      _exprCache.set(replaced, fn);
    }
    return fn();
  } catch { return 0; }
}

const _ctrl = {};
const _v3 = new THREE.Vector3();
function computeControl(engine, tx, ty, tz, th, dt, out) {
  const g = engine.gravity;
  const v = engine.velocity;
  const pos = engine.position;

  const horizPosGain = 2.5;
  const horizVelGain = 4;

  const errX = tx - pos.x;
  const errY = ty - pos.y;

  let desVX = horizPosGain * errX;
  let desVY = horizPosGain * errY;
  const desSpeed = Math.hypot(desVX, desVY);
  if (desSpeed > engine.max_velocity) {
    const scale = engine.max_velocity / desSpeed;
    desVX *= scale;
    desVY *= scale;
  }

  const ax = (desVX - v.x) * horizVelGain;
  const ay = (desVY - v.y) * horizVelGain;

  const yawRad = th * Math.PI / 180;
  const fwdX = Math.cos(yawRad);
  const fwdY = Math.sin(yawRad);
  const rightX = -Math.sin(yawRad);
  const rightY = Math.cos(yawRad);

  const aFwd = ax * fwdX + ay * fwdY;
  const aRight = ax * rightX + ay * rightY;

  const pitchDeg = clamp(-Math.atan2(aFwd, g) * 180 / Math.PI, -MAX_PITCH, MAX_PITCH);
  const rollDeg = clamp(Math.atan2(aRight, g) * 180 / Math.PI, -MAX_ROLL, MAX_ROLL);

  const yawRate = clamp((th - engine.yaw) / dt, -MAX_YAW_RATE, MAX_YAW_RATE);

  out.throttle = 0;
  out.pitch = pitchDeg;
  out.roll = rollDeg;
  out.yaw = yawRate;
  out.targetAltitude = tz;
  return out;
}

function driveStep(state, engine, tx, ty, tz, th, dt) {
  const control = computeControl(engine, tx, ty, tz, th, dt, _ctrl);
  engine.step(control.throttle, control, dt);
  state.x = engine.position.x;
  state.y = engine.position.y;
  state.z = engine.position.z;
  state.heading = th;
}

function pushPoint(state, engine, heading, pitch, roll, led) {
  const p = pos(engine.position.x, engine.position.y, engine.position.z, heading, pitch, roll, led);
  const tel = engine.getTelemetry();
  p.speed = tel.speed_mps;
  p.energyUsed = tel.energyUsedWh;
  p.batteryPercent = tel.batteryPercent;
  p.turnRadiusM = tel.turnRadiusM;
  state.positions.push(p);
}

function processCommands(commands, vars, state, maxIter = 10000, obstacleManager = null, onCommandStart = null) {
  let iter = 0;
  for (const cmd of commands) {
    if (iter++ > maxIter) break;
    if (onCommandStart) onCommandStart(cmd, iter - 1, state);
    const p = cmd.params || {};
    let dur = 0;
    const engine = state.engine;

    switch (cmd.type) {
      case 'takeoff': {
        const steps = Math.max(Math.ceil(TAKEOFF_HEIGHT / (DEFAULT_SPEED * DT)), 10);
        for (let i = 0; i < steps; i++) {
          const t = (i + 1) / steps;
          const tz = TAKEOFF_HEIGHT * t;
          driveStep(state, engine, state.x, state.y, tz, state.heading, DT);
          const pitch = t < 0.5 ? -MAX_PITCH * (1 - t * 2) : 0;
          pushPoint(state, engine, state.heading, pitch, 0);
        }
        state.flying = true;
        dur = steps * DT;
        break;
      }
      case 'land': {
        const startZ = state.z;
        const steps = Math.max(Math.ceil(startZ / (DEFAULT_SPEED * DT)), 10);
        for (let i = 0; i < steps; i++) {
          const t = (i + 1) / steps;
          const tz = startZ * (1 - t);
          driveStep(state, engine, state.x, state.y, tz, state.heading, DT);
          const pitch = t > 0.5 ? MAX_PITCH * ((t - 0.5) * 2) : 0;
          pushPoint(state, engine, state.heading, pitch, 0);
        }
        state.flying = false;
        state.z = 0;
        engine.position.z = 0;
        dur = steps * DT;
        break;
      }
      case 'hover': {
        dur = parseFloat(p.dur) || 1;
        const steps = Math.ceil(dur / DT);
        const hx = state.x, hy = state.y, hz = state.z;
        for (let i = 0; i < steps; i++) {
          driveStep(state, engine, hx, hy, hz, state.heading, DT);
          pushPoint(state, engine, state.heading, 0, 0);
        }
        break;
      }
      case 'flip': {
        const dir = p.dir || 'back';
        const numPoints = FLIP_POINTS;
        const hr = state.heading * Math.PI / 180;
        const hx = state.x, hy = state.y, hz = state.z;
        const cosH = Math.cos(hr);
        const sinH = Math.sin(hr);
        let dirX = 0, dirY = 0;
        if (dir === 'forward') { dirX = cosH; dirY = sinH; }
        else if (dir === 'back') { dirX = -cosH; dirY = -sinH; }
        else if (dir === 'left') { dirX = sinH; dirY = -cosH; }
        else { dirX = -sinH; dirY = cosH; }
        const tPop = 1 / 6;
        const tWhip = 1 / 3;
        const tSnap = 5 / 6;
        for (let i = 1; i <= numPoints; i++) {
          const t = i / numPoints;
          const horiz = FLIP_TRAVEL * Math.sin(Math.PI * t);
          const tx = hx + dirX * horiz;
          const ty = hy + dirY * horiz;
          const tz = Math.max(hz + FLIP_CLIMB * 4 * t * (1 - t), 0);
          let theta;
          if (t <= tPop) theta = 0;
          else if (t <= tWhip) theta = 90 * (t - tPop) / (tWhip - tPop);
          else if (t <= tSnap) theta = 90 + 180 * (t - tWhip) / (tSnap - tWhip);
          else theta = 270 + 90 * Math.sqrt((t - tSnap) / (1 - tSnap));
          let pitch = 0, roll = 0;
          if (dir === 'back') pitch = theta;
          else if (dir === 'forward') pitch = -theta;
          else if (dir === 'left') roll = theta;
          else roll = -theta;
          driveStep(state, engine, tx, ty, tz, state.heading, DT);
          pushPoint(state, engine, state.heading, pitch, roll);
        }
        state.x = hx;
        state.y = hy;
        state.z = hz;
        const settleFrames = FLIP_SETTLE;
        for (let i = 0; i < settleFrames; i++) {
          driveStep(state, engine, hx, hy, hz, state.heading, DT);
          pushPoint(state, engine, state.heading, 0, 0);
        }
        dur = (numPoints + settleFrames) * DT;
        break;
      }
       case 'go': {
        const dir = p.dir || 'forward';
        const power = parseFloat(p.power) || 50;
        dur = parseFloat(p.dur) || 1;
        const speed = (power / 100) * DEFAULT_SPEED * 2;
        const steps = Math.max(Math.ceil(dur / DT), 5);
        const hr = state.heading * Math.PI / 180;
        let dx = 0, dy = 0, dz = 0, pitch = 0, roll = 0;
        const pf = power / 100;
        if (dir === 'forward') { dx = Math.cos(hr); dy = Math.sin(hr); pitch = -MAX_PITCH * pf; }
        else if (dir === 'backward') { dx = -Math.cos(hr); dy = -Math.sin(hr); pitch = MAX_PITCH * pf; }
        else if (dir === 'left') { dx = Math.sin(hr); dy = -Math.cos(hr); roll = -MAX_ROLL * pf; }
        else if (dir === 'right') { dx = -Math.sin(hr); dy = Math.cos(hr); roll = MAX_ROLL * pf; }
        else if (dir === 'up') { dz = speed * dur; }
        else if (dir === 'down') { dz = -speed * dur; }

        const startX = state.x, startY = state.y, startZ = state.z;
        let collisionOccurred = false;
        for (let i = 0; i < steps; i++) {
          const t = (i + 1) / steps;
          let ease = 1;
          if (t < 0.2) ease = t / 0.2;
          else if (t > 0.8) ease = (1 - t) / 0.2;

          const newX = startX + dx * speed * dur * t;
          const newY = startY + dy * speed * dur * t;
          const newZ = startZ + dz * t;

          if (obstacleManager && !collisionOccurred) {
            const collision = obstacleManager.checkCollision(_v3.set(newX, newZ, newY), 0.1);
            if (collision) {
              state.collisions.push({ position: { x: newX, y: newY, z: newZ }, obstacle: collision.obstacle });
              collisionOccurred = true;
            }
          }

          driveStep(state, engine, newX, newY, newZ, state.heading, DT);
          pushPoint(state, engine, state.heading, pitch * ease, roll * ease);
        }

        if (!collisionOccurred) {
          state.x = startX + dx * speed * dur;
          state.y = startY + dy * speed * dur;
          state.z = startZ + dz;
          engine.position.x = state.x;
          engine.position.y = state.y;
          engine.position.z = state.z;
        }
        pushPoint(state, engine, state.heading, 0, 0);
        break;
      }
       case 'move_forward':
       case 'move_backward': {
         const dist = (parseFloat(p.dist) || 50) / 100;
         const speed = (parseFloat(p.speed) || 50) / 100;
         const sign = cmd.type === 'move_forward' ? 1 : -1;
         const steps = Math.max(Math.ceil(dist / (speed * DEFAULT_SPEED * 2 * DT)), 5);
         const hr = state.heading * Math.PI / 180;
         const pitch = sign * MAX_PITCH * speed;
         const sx = state.x, sy = state.y, sz = state.z;
         for (let i = 0; i < steps; i++) {
           const t = (i + 1) / steps;
           let ease = 1;
           if (t < 0.2) ease = t / 0.2;
           else if (t > 0.8) ease = (1 - t) / 0.2;
           const tx = sx + sign * Math.cos(hr) * dist * t;
           const ty = sy + sign * Math.sin(hr) * dist * t;
           driveStep(state, engine, tx, ty, sz, state.heading, DT);
           pushPoint(state, engine, state.heading, pitch * ease, 0);
         }
         state.x = sx + sign * Math.cos(hr) * dist;
         state.y = sy + sign * Math.sin(hr) * dist;
         state.z = sz;
         dur = steps * DT;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'move_left':
       case 'move_right': {
         const dist = (parseFloat(p.dist) || 50) / 100;
         const speed = (parseFloat(p.speed) || 50) / 100;
         const steps = Math.max(Math.ceil(dist / (speed * DEFAULT_SPEED * 2 * DT)), 5);
         const hr = state.heading * Math.PI / 180;
         const roll = cmd.type === 'move_left' ? -MAX_ROLL * speed : MAX_ROLL * speed;
         const sx = state.x, sy = state.y, sz = state.z;
         for (let i = 0; i < steps; i++) {
           const t = (i + 1) / steps;
           const ease = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
           let tx, ty;
           if (cmd.type === 'move_left') { tx = sx + Math.sin(hr) * dist * t; ty = sy - Math.cos(hr) * dist * t; }
           else { tx = sx - Math.sin(hr) * dist * t; ty = sy + Math.cos(hr) * dist * t; }
           driveStep(state, engine, tx, ty, sz, state.heading, DT);
           pushPoint(state, engine, state.heading, 0, roll * ease);
         }
         if (cmd.type === 'move_left') { state.x = sx + Math.sin(hr) * dist; state.y = sy - Math.cos(hr) * dist; }
         else { state.x = sx - Math.sin(hr) * dist; state.y = sy + Math.cos(hr) * dist; }
         state.z = sz;
         dur = steps * DT;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'turn_left':
       case 'turn_right': {
         const deg = parseFloat(p.deg) || 90;
         const steps = Math.max(Math.ceil(deg / 180 * 10), 5);
         const degFactor = Math.min(deg / 360, 1);
         const rollDir = cmd.type === 'turn_left' ? -MAX_ROLL * degFactor : MAX_ROLL * degFactor;
         const startHeading = state.heading;
         for (let i = 0; i < steps; i++) {
           const t = (i + 1) / steps;
           const ease = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
           state.heading = startHeading + (cmd.type === 'turn_left' ? -deg : deg) * t;
           driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
           pushPoint(state, engine, state.heading, 0, rollDir * ease);
         }
         dur = deg / 180;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'turn_degree': {
         const deg = parseFloat(p.deg) || 90;
         const timeout = parseFloat(p.timeout) || 3;
         const steps = Math.max(Math.ceil(timeout * 10), 5);
         const degFactor = Math.min(Math.abs(deg) / 360, 1);
         const rollDir = deg > 0 ? MAX_ROLL * degFactor : -MAX_ROLL * degFactor;
         const startHeading = state.heading;
         for (let i = 0; i < steps; i++) {
           const t = (i + 1) / steps;
           const ease = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
           state.heading = startHeading + deg * t;
           driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
           pushPoint(state, engine, state.heading, 0, rollDir * ease);
         }
         dur = timeout;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'circle':
       case 'circle_turn': {
         const speed = (parseFloat(p.speed) || 75) / 100;
         const direction = p.dir === 'counter-clockwise' ? -1 : 1;
         const radius = 0.5;
         const steps = 60;
         const cx = state.x, cy = state.y, cz = state.z;
         for (let i = 0; i < steps; i++) {
           const angle = 2 * Math.PI * i / steps * direction;
           const tx = cx + radius * Math.cos(angle);
           const ty = cy + radius * Math.sin(angle);
           driveStep(state, engine, tx, ty, cz, state.heading, DT);
           pushPoint(state, engine, state.heading, 0, -MAX_ROLL * speed * Math.sin(angle * direction));
         }
         state.x = cx + radius * direction;
         state.y = cy;
         state.z = cz;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         dur = 3 * speed;
         break;
       }
       case 'square':
       case 'triangle':
       case 'square_turn':
       case 'triangle_turn': {
         const speed = (parseFloat(p.speed) || 60) / 100;
         const secs = parseFloat(p.secs) || 1;
         const direction = p.dir === 'counter-clockwise' ? -1 : 1;
         const isTriangle = cmd.type.includes('triangle');
         const numSides = isTriangle ? 3 : 4;
         const side = 0.5;
         const stepsPerSide = 15;
         const hr = state.heading * Math.PI / 180;
         const sx = state.x, sy = state.y, sz = state.z;
         const sideAngles = [];
         for (let i = 0; i < numSides; i++) {
           sideAngles.push(hr + (i * 2 * Math.PI / numSides) * direction);
         }
         let accX = 0, accY = 0;
         for (let si = 0; si < numSides; si++) {
           const angle = sideAngles[si];
           const ddx = Math.cos(angle), ddy = Math.sin(angle);
           for (let i = 0; i < stepsPerSide; i++) {
             const t = (i + 1) / stepsPerSide;
             const ease = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
             const tx = sx + accX + ddx * side * t;
             const ty = sy + accY + ddy * side * t;
             driveStep(state, engine, tx, ty, sz, state.heading, DT);
             pushPoint(state, engine, state.heading, -MAX_PITCH * speed * ease, 0);
           }
           accX += ddx * side; accY += ddy * side;
         }
         state.x = sx + accX; state.y = sy + accY; state.z = sz;
         dur = numSides * secs * speed;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'spiral': {
         const speed = (parseFloat(p.speed) || 50) / 100;
         const direction = p.dir === 'counter-clockwise' ? -1 : 1;
         const steps = 120;
         const sx = state.x, sy = state.y, sz = state.z;
         for (let i = 0; i < steps; i++) {
           const t = i / steps;
           const angle = 4 * Math.PI * t * direction;
           const radius = t * 0.5;
           const tx = sx + radius * Math.cos(angle);
           const ty = sy + radius * Math.sin(angle);
           const tz = sz + t * 0.3;
           driveStep(state, engine, tx, ty, tz, state.heading, DT);
           pushPoint(state, engine, state.heading, 0, -MAX_ROLL * speed * Math.sin(angle));
         }
         state.x = sx + 0.5 * Math.cos(4 * Math.PI * direction);
         state.y = sy + 0.5 * Math.sin(4 * Math.PI * direction);
         state.z = sz + 0.3;
         dur = 5 * speed;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
        case 'sway': {
          const speed = (parseFloat(p.speed) || 50) / 100;
          const dir = p.dir || 'forward-back';
          const steps = 40;
          const sx = state.x, sy = state.y, sz = state.z;
          for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const angle = 2 * Math.PI * t;
            let pitch = 0, roll = 0;
            if (dir === 'forward-back') pitch = MAX_PITCH * speed * Math.sin(angle);
            else if (dir === 'left-right') roll = MAX_ROLL * speed * Math.sin(angle);
            else if (dir === 'pitch-forward') pitch = MAX_PITCH * speed;
            else if (dir === 'pitch-backward') pitch = -MAX_PITCH * speed;
            else if (dir === 'roll-left') roll = -MAX_ROLL * speed;
            else if (dir === 'roll-right') roll = MAX_ROLL * speed;
            driveStep(state, engine, sx, sy, sz, state.heading, DT);
            pushPoint(state, engine, state.heading, pitch, roll);
          }
         dur = 2 * speed;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'keep_distance':
       case 'avoid_wall': {
         const dist = (parseFloat(p.dist) || 50) / 100;
         const speed = (parseFloat(p.speed) || 50) / 100;
         const steps = Math.max(Math.ceil(dist / (speed * DEFAULT_SPEED * DT)), 5);
         const hr = state.heading * Math.PI / 180;
         const sx = state.x, sy = state.y, sz = state.z;
         for (let i = 0; i < steps; i++) {
           const t = (i + 1) / steps;
           const tx = sx - Math.cos(hr) * dist * t;
           const ty = sy - Math.sin(hr) * dist * t;
           driveStep(state, engine, tx, ty, sz, state.heading, DT);
           pushPoint(state, engine, state.heading, 0, 0);
         }
         state.x = sx - Math.cos(hr) * dist;
         state.y = sy - Math.sin(hr) * dist;
         state.z = sz;
         dur = steps * DT;
         driveStep(state, engine, state.x, state.y, state.z, state.heading, DT);
         pushPoint(state, engine, state.heading, 0, 0);
         break;
       }
       case 'detect_wall': {
         vars[p.var] = 0;
         dur = 0.1;
         break;
       }

       case 'led': {
         const r = Math.min(Math.max(parseInt(p.r) || 0, 0), 255);
         const g = Math.min(Math.max(parseInt(p.g) || 255, 0), 255);
         const b = Math.min(Math.max(parseInt(p.b) || 0, 0), 255);
         const brightness = Math.min(Math.max(parseInt(p.brightness) || 100, 0), 255);
         state.ledColor = { r, g, b, brightness };
         pushPoint(state, engine, state.heading, 0, 0, state.ledColor);
         dur = 0.1;
         break;
       }
       case 'led_off': {
         state.ledColor = { r: 0, g: 0, b: 0, brightness: 0 };
         pushPoint(state, engine, state.heading, 0, 0, state.ledColor);
         dur = 0.1;
         break;
       }
       case 'buzzer': {
         dur = (parseFloat(p.dur) || 500) / 1000;
         break;
       }

      case 'var_declare': { vars[p.name] = evalExpr(p.value, vars); dur = 0; break; }
      case 'set_var': {
        const val = evalExpr(p.value, vars);
        if (p.op === '=') vars[p.name] = val;
        else if (p.op === '+=') vars[p.name] = (vars[p.name] || 0) + val;
        else if (p.op === '-=') vars[p.name] = (vars[p.name] || 0) - val;
        else if (p.op === '*=') vars[p.name] = (vars[p.name] || 0) * val;
        else if (p.op === '/=') vars[p.name] = val !== 0 ? (vars[p.name] || 0) / val : 0;
        dur = 0;
        break;
      }
      case 'print_var': { dur = 0; break; }

      case 'if_block': {
        const cond = evalExpr(p.condition, vars);
        if (cond) processCommands(cmd.children || [], vars, state, maxIter);
        dur = 0;
        break;
      }
      case 'elif_block': {
        const cond = evalExpr(p.condition, vars);
        if (cond) processCommands(cmd.children || [], vars, state, maxIter);
        dur = 0;
        break;
      }
      case 'else_block': {
        processCommands(cmd.children || [], vars, state, maxIter);
        dur = 0;
        break;
      }
      case 'end_block': { dur = 0; break; }

      case 'while_block': {
        let loops = 0;
        while (evalExpr(p.condition, vars) && loops < 500) {
          processCommands(cmd.children || [], vars, state, maxIter);
          loops++;
        }
        dur = 0;
        break;
      }
      case 'for_block': {
        const varName = p.var || 'i';
        const start = parseInt(p.start) || 0;
        const endVal = parseInt(p.end_val) || 5;
        const step = parseInt(p.step) || 1;
        if (step === 0) break;
        for (let i = start; step > 0 ? i < endVal : i > endVal; i += step) {
          vars[varName] = i;
          processCommands(cmd.children || [], vars, state, maxIter);
        }
        dur = 0;
        break;
      }
       case 'break_cmd': { dur = 0; break; }
       case 'emergency_stop':
       case 'stop_motors': {
         const steps = 10;
         for (let i = 0; i < steps; i++) {
           pushPoint(state, engine, state.heading, 0, 0);
         }
         state.flying = false;
         dur = 0.5;
         break;
       }

       case 'get_battery': { vars[p.var] = 80; dur = 0; break; }
       case 'get_height': { vars[p.var] = state.z * 100; dur = 0; break; }
       case 'get_front_range': { vars[p.var] = 100; dur = 0; break; }
       case 'get_bottom_range': { vars[p.var] = state.z * 100; dur = 0; break; }
       case 'get_front_color': { vars[p.var] = 'green'; dur = 0; break; }
       case 'get_back_color': { vars[p.var] = 'blue'; dur = 0; break; }
       case 'get_temperature': { vars[p.var] = 22; dur = 0; break; }

      case 'func_def': {
        vars['__func_' + p.name] = cmd.children || [];
        dur = 0;
        break;
      }
      case 'func_call': {
        const body = vars['__func_' + p.name];
        if (body) processCommands(body, vars, state, maxIter);
        dur = 0;
        break;
      }
      case 'return_val': { dur = 0; break; }

      case 'list_declare': {
        vars[p.name] = (p.values || '').split(',').map(v => evalExpr(v.trim(), vars));
        dur = 0;
        break;
      }
      case 'list_append': {
        if (!Array.isArray(vars[p.name])) vars[p.name] = [];
        vars[p.name].push(evalExpr(p.value, vars));
        dur = 0;
        break;
      }
      case 'list_get': {
        const arr = vars[p.list_name];
        vars[p.var] = Array.isArray(arr) ? (arr[parseInt(p.index)] || 0) : 0;
        dur = 0;
        break;
      }

      case 'user_input': { vars[p.var] = 0; dur = 0; break; }
      case 'timer_start': { vars[p.name] = Date.now() / 1000; dur = 0; break; }
      case 'timer_elapsed': { vars[p.var] = (Date.now() / 1000) - (vars[p.name] || 0); dur = 0; break; }
      case 'time_sleep': { dur = parseFloat(p.dur) || 1; break; }
      case 'drone_sleep': { dur = parseFloat(p.dur) || 1; break; }
    }

    state.totalDuration += dur || 0;
  }
}

function simulateSingleDrone(drone, obstacleManager = null, onCommandStart = null) {
  const offset = drone.offset || [0, 0, 0];
  const startPoint = pos(offset[0], offset[2], offset[1], 0);
  startPoint.speed = 0;
  startPoint.energyUsed = 0;
  startPoint.batteryPercent = 100;
  startPoint.turnRadiusM = Infinity;
  const state = {
    id: drone.id,
    x: 0, y: 0, z: 0, heading: 0,
    positions: [startPoint],
    totalDuration: 0,
    flying: false,
    ledColor: 'off',
    collisions: [],
    engine: new AeroEngine()
  };
  const vars = {};
  processCommands(drone.commands, vars, state, undefined, obstacleManager, onCommandStart);

  let currentLed = 'off';
  for (const p of state.positions) {
    if (p.led !== undefined) currentLed = p.led;
    else p.led = currentLed;
    p.x += offset[0];
    p.y += offset[2];
    p.z += offset[1];
  }

  return { positions: state.positions, totalDuration: state.totalDuration, collisions: state.collisions };
}

export function simulateCommands(commands, onCommandStart = null) {
  return simulateSingleDrone({ commands, offset: [0, 0, 0] }, null, onCommandStart);
}

export function simulateSwarm(drones, obstacleManager = null, onCommandStart = null) {
  const results = {};
  let maxDuration = 0;

  for (const drone of drones) {
    const result = simulateSingleDrone(drone, obstacleManager, onCommandStart);
    results[drone.id] = result;
    if (result.totalDuration > maxDuration) maxDuration = result.totalDuration;
  }

  for (const id of Object.keys(results)) {
    results[id].totalDuration = maxDuration;
  }

  return results;
}
