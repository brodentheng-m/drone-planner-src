import { getCommandCode } from '../commands/Commands.js';

export function generateDroneScript(commands) {
  const lines = [
    'from codrone_edu.drone import *',
    'import time',
    '',
    'drone = Drone()',
    'drone.pair()',
    ''
  ];

  generateBlockCode(commands, lines, 0);

  lines.push('');
  lines.push('drone.close()');
  return lines.join('\n');
}

export function generateSwarmScript(drones) {
  if (drones.length === 1) {
    return generateDroneScript(drones[0].commands);
  }

  const lines = [
    'from codrone_edu.drone import *',
    'import time',
    'import threading',
    ''
  ];

  drones.forEach((drone, i) => {
    lines.push(`drone${i + 1} = Drone()`);
  });
  lines.push('');

  drones.forEach((drone, i) => {
    lines.push(`drone${i + 1}.pair()`);
  });
  lines.push('');
  lines.push('time.sleep(2)');
  lines.push('');

  drones.forEach((drone, i) => {
    lines.push(`def fly_drone${i + 1}():`);
    lines.push(`    d = drone${i + 1}`);
    generateBlockCode(drone.commands, lines, 1, 'd');
    lines.push('');
  });

  lines.push('threads = []');
  drones.forEach((drone, i) => {
    lines.push(`t${i + 1} = threading.Thread(target=fly_drone${i + 1})`);
    lines.push(`threads.append(t${i + 1})`);
  });
  lines.push('');

  lines.push('for t in threads:');
  lines.push('    t.start()');
  lines.push('for t in threads:');
  lines.push('    t.join()');
  lines.push('');

  drones.forEach((drone, i) => {
    lines.push(`drone${i + 1}.close()`);
  });

  return lines.join('\n');
}

function emitBlockStructure(cmd, lines, indent, sub, bodyFn) {
  const pad = '    '.repeat(indent);
  const p = cmd.params || {};
  switch (cmd.type) {
    case 'if_block':
      lines.push(`${pad}if ${sub(p.condition)}:`);
      break;
    case 'elif_block':
      lines.push(`${pad}elif ${sub(p.condition)}:`);
      break;
    case 'else_block':
      lines.push(`${pad}else:`);
      break;
    case 'while_block':
      lines.push(`${pad}while ${sub(p.condition)}:`);
      break;
    case 'for_block':
      lines.push(`${pad}for ${sub(p.var) ?? 'i'} in range(${p.start ?? 0}, ${p.end_val ?? 5}, ${p.step ?? 1}):`);
      break;
    case 'func_def':
      lines.push(`${pad}def ${sub(p.name)}():`);
      break;
    default:
      return false;
  }
  if (cmd.children && cmd.children.length > 0) bodyFn(cmd.children, lines, indent + 1);
  else lines.push(`${pad}    pass`);
  return true;
}

function generateBlockCode(commands, lines, indent, droneVar = 'drone') {
  const pad = '    '.repeat(indent);
  const sub = droneVar !== 'drone' ? (s) => (s ?? '').replace(/drone\./g, droneVar + '.') : (s) => s;
  for (const cmd of commands) {
    if (emitBlockStructure(cmd, lines, indent, sub, (children, l, ind) => generateBlockCode(children, l, ind, droneVar))) {
      continue;
    }
    switch (cmd.type) {
      case 'end_block':
        break;
      default: {
        let code = getCommandCode(cmd);
        if (code !== undefined && code !== '') {
          lines.push(`${pad}${sub(code)}`);
        }
        break;
      }
    }
  }
}

export function generateAnimationScript(commands) {
  const lines = [
    'import matplotlib.pyplot as plt',
    'import matplotlib.animation as animation',
    'from mpl_toolkits.mplot3d import Axes3D',
    'import numpy as np',
    'import math',
    '',
    'TAKEOFF_HEIGHT = 0.8',
    'DEFAULT_SPEED = 0.5',
    'DT = 0.05',
    'FLIP_RADIUS = 0.3',
    '',
    ''
  ];

  lines.push('def simulate_commands():');
  lines.push('    x, y, z = 0.0, 0.0, 0.0');
  lines.push('    heading = 0.0');
  lines.push('    positions = [(x, y, z)]');
  lines.push('');
  lines.push('    is_flying = False');
  lines.push('');

  generateSimBlock(commands, lines, 1);

  lines.push('');
  lines.push('    return positions');
  lines.push('');
  lines.push('');
  lines.push('def animate():');
  lines.push('    positions = simulate_commands()');
  lines.push('    fig = plt.figure(figsize=(12, 8))');
  lines.push('    ax = fig.add_subplot(111, projection="3d")');
  lines.push('    xs = [p[0] for p in positions]');
  lines.push('    ys = [p[1] for p in positions]');
  lines.push('    zs = [p[2] for p in positions]');
  lines.push('');
  lines.push('    ax.set_xlabel("X (m)")');
  lines.push('    ax.set_ylabel("Y (m)")');
  lines.push('    ax.set_zlabel("Z (m)")');
  lines.push('    ax.set_title("Drone Flight Simulation")');
  lines.push('');
  lines.push('    trail, = ax.plot([], [], [], "b-", linewidth=1.5, alpha=0.6)');
  lines.push('    drone_dot = ax.scatter([], [], [], c="red", s=100, marker="^")');
  lines.push('');
  lines.push('    total = len(positions)');
  lines.push('    skip = max(1, total // 100)');
  lines.push('    indices = list(range(0, total, skip))');
  lines.push('    if indices[-1] != total - 1:');
  lines.push('        indices.append(total - 1)');
  lines.push('');
  lines.push('    def update(frame):');
  lines.push('        idx = indices[frame]');
  lines.push('        trail.set_data(xs[:idx+1], ys[:idx+1])');
  lines.push('        trail.set_3d_properties(zs[:idx+1])');
  lines.push('        drone_dot._offsets3d = ([xs[idx]], [ys[idx]], [zs[idx]])');
  lines.push('        return trail, drone_dot');
  lines.push('');
  lines.push('    ani = animation.FuncAnimation(fig, update, frames=len(indices), interval=30, blit=False, repeat=False)');
  lines.push('    ax.legend(["Path", "Drone"])');
  lines.push('    plt.tight_layout()');
  lines.push('    plt.show()');
  lines.push('');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    animate()');

  return lines.join('\n');
}

function generateSimBlock(commands, lines, indent) {
  const pad = '    '.repeat(indent);
  for (const cmd of commands) {
    const p = cmd.params || {};
    if (emitBlockStructure(cmd, lines, indent, (s) => s, (children, l, ind) => generateSimBlock(children, l, ind))) {
      continue;
    }

    switch (cmd.type) {
      case 'takeoff':
        lines.push(`${pad}# Takeoff`);
        lines.push(`${pad}steps = max(int(TAKEOFF_HEIGHT / (DEFAULT_SPEED * DT)), 10)`);
        lines.push(`${pad}for i in range(steps):`);
        lines.push(`${pad}    t = (i + 1) / steps`);
        lines.push(`${pad}    z = TAKEOFF_HEIGHT * t`);
        lines.push(`${pad}    positions.append((x, y, z))`);
        lines.push(`${pad}is_flying = True`);
        break;
      case 'land':
        lines.push(`${pad}# Land`);
        lines.push(`${pad}start_z = z`);
        lines.push(`${pad}steps = max(int(start_z / (DEFAULT_SPEED * DT)), 10)`);
        lines.push(`${pad}for i in range(steps):`);
        lines.push(`${pad}    t = (i + 1) / steps`);
        lines.push(`${pad}    z = start_z * (1 - t)`);
        lines.push(`${pad}    positions.append((x, y, z))`);
        lines.push(`${pad}is_flying = False`);
        lines.push(`${pad}z = 0.0`);
        break;
      case 'hover':
        lines.push(`${pad}# Hover ${p.dur}s`);
        lines.push(`${pad}steps = int(${p.dur} / DT)`);
        lines.push(`${pad}for i in range(steps):`);
        lines.push(`${pad}    positions.append((x, y, z))`);
        break;
      case 'flip': {
        const d = p.dir || 'back';
        lines.push(`${pad}# Flip ${d}`);
        lines.push(`${pad}for i in range(40):`);
        lines.push(`${pad}    t = i / 40`);
        lines.push(`${pad}    angle = 2 * math.pi * t`);
        if (d === 'back') {
          lines.push(`${pad}    fx = x - FLIP_RADIUS * math.sin(angle) * math.cos(math.radians(heading))`);
          lines.push(`${pad}    fy = y - FLIP_RADIUS * math.sin(angle) * math.sin(math.radians(heading))`);
        } else if (d === 'forward') {
          lines.push(`${pad}    fx = x + FLIP_RADIUS * math.sin(angle) * math.cos(math.radians(heading))`);
          lines.push(`${pad}    fy = y + FLIP_RADIUS * math.sin(angle) * math.sin(math.radians(heading))`);
        } else if (d === 'left') {
          lines.push(`${pad}    fx = x - FLIP_RADIUS * math.sin(angle) * math.sin(math.radians(heading))`);
          lines.push(`${pad}    fy = y + FLIP_RADIUS * math.sin(angle) * math.cos(math.radians(heading))`);
        } else {
          lines.push(`${pad}    fx = x + FLIP_RADIUS * math.sin(angle) * math.sin(math.radians(heading))`);
          lines.push(`${pad}    fy = y - FLIP_RADIUS * math.sin(angle) * math.cos(math.radians(heading))`);
        }
        lines.push(`${pad}    fz = z + FLIP_RADIUS * (1 - math.cos(angle))`);
        lines.push(`${pad}    positions.append((fx, fy, fz))`);
        if (d === 'back') {
          lines.push(`${pad}x -= FLIP_RADIUS * 2 * math.cos(math.radians(heading))`);
          lines.push(`${pad}y -= FLIP_RADIUS * 2 * math.sin(math.radians(heading))`);
        } else if (d === 'forward') {
          lines.push(`${pad}x += FLIP_RADIUS * 2 * math.cos(math.radians(heading))`);
          lines.push(`${pad}y += FLIP_RADIUS * 2 * math.sin(math.radians(heading))`);
        } else if (d === 'left') {
          lines.push(`${pad}x -= FLIP_RADIUS * 2 * math.sin(math.radians(heading))`);
          lines.push(`${pad}y += FLIP_RADIUS * 2 * math.cos(math.radians(heading))`);
        } else {
          lines.push(`${pad}x += FLIP_RADIUS * 2 * math.sin(math.radians(heading))`);
          lines.push(`${pad}y -= FLIP_RADIUS * 2 * math.cos(math.radians(heading))`);
        }
        lines.push(`${pad}positions.append((x, y, z))`);
        break;
      }
      case 'go': {
        const dir = p.dir || 'forward';
        const power = p.power ?? 50;
        const dur = p.dur ?? 1;
        lines.push(`${pad}# Go ${dir} power=${power} dur=${dur}s`);
        lines.push(`${pad}speed = (${power} / 100.0) * DEFAULT_SPEED * 2`);
        lines.push(`${pad}steps = max(int(${dur} / DT), 5)`);
        lines.push(`${pad}rad = math.radians(heading)`);
        if (dir === 'forward') lines.push(`${pad}dx, dy = math.cos(rad), math.sin(rad)`);
        else if (dir === 'backward') lines.push(`${pad}dx, dy = -math.cos(rad), -math.sin(rad)`);
        else if (dir === 'left') lines.push(`${pad}dx, dy = -math.sin(rad), math.cos(rad)`);
        else lines.push(`${pad}dx, dy = math.sin(rad), -math.cos(rad)`);
        lines.push(`${pad}for i in range(steps):`);
        lines.push(`${pad}    t = (i + 1) / steps`);
        lines.push(`${pad}    px = x + dx * speed * ${dur} * t`);
        lines.push(`${pad}    py = y + dy * speed * ${dur} * t`);
        lines.push(`${pad}    positions.append((px, py, z))`);
        lines.push(`${pad}x += dx * speed * ${dur}`);
        lines.push(`${pad}y += dy * speed * ${dur}`);
        break;
      }
       case 'move_forward':
       case 'move_backward': {
         const sign = cmd.type === 'move_forward' ? '' : '-';
         const dist = p.dist ?? 50;
         const speed = p.speed ?? 50;
         lines.push(`${pad}# ${cmd.type === 'move_forward' ? 'Forward' : 'Backward'} ${dist}cm speed=${speed}`);
         lines.push(`${pad}dist_m = ${dist} / 100.0`);
         lines.push(`${pad}rad = math.radians(heading)`);
         lines.push(`${pad}steps = max(int(dist_m / (DEFAULT_SPEED * DT)), 5)`);
         lines.push(`${pad}for i in range(steps):`);
         lines.push(`${pad}    t = (i + 1) / steps`);
         lines.push(`${pad}    px = x ${sign} math.cos(rad) * dist_m * t`);
         lines.push(`${pad}    py = y ${sign} math.sin(rad) * dist_m * t`);
         lines.push(`${pad}    positions.append((px, py, z))`);
         lines.push(`${pad}x ${sign}= math.cos(rad) * dist_m`);
         lines.push(`${pad}y ${sign}= math.sin(rad) * dist_m`);
         break;
       }
       case 'move_left':
       case 'move_right': {
         const sign = cmd.type === 'move_left' ? '-' : '+';
         const dist = p.dist ?? 50;
         const speed = p.speed ?? 50;
         lines.push(`${pad}# ${cmd.type === 'move_left' ? 'Left' : 'Right'} ${dist}cm speed=${speed}`);
         lines.push(`${pad}dist_m = ${dist} / 100.0`);
         lines.push(`${pad}rad = math.radians(heading)`);
         lines.push(`${pad}steps = max(int(dist_m / (DEFAULT_SPEED * DT)), 5)`);
         lines.push(`${pad}for i in range(steps):`);
         lines.push(`${pad}    t = (i + 1) / steps`);
         if (cmd.type === 'move_left') {
           lines.push(`${pad}    px = x - math.sin(rad) * dist_m * t`);
           lines.push(`${pad}    py = y + math.cos(rad) * dist_m * t`);
         } else {
           lines.push(`${pad}    px = x + math.sin(rad) * dist_m * t`);
           lines.push(`${pad}    py = y - math.cos(rad) * dist_m * t`);
         }
         lines.push(`${pad}    positions.append((px, py, z))`);
         if (cmd.type === 'move_left') {
           lines.push(`${pad}x -= math.sin(rad) * dist_m`);
           lines.push(`${pad}y += math.cos(rad) * dist_m`);
         } else {
           lines.push(`${pad}x += math.sin(rad) * dist_m`);
           lines.push(`${pad}y -= math.cos(rad) * dist_m`);
         }
         break;
       }
       case 'turn_left':
       case 'turn_right': {
         const sign = cmd.type === 'turn_left' ? '+' : '-';
         const deg = p.deg ?? 90;
         lines.push(`${pad}# Turn ${cmd.type === 'turn_left' ? 'Left' : 'Right'} ${deg}deg`);
         lines.push(`${pad}heading ${sign}= ${deg}`);
         lines.push(`${pad}positions.append((x, y, z))`);
         break;
       }
       case 'turn_degree': {
         const deg = p.deg ?? 90;
         const timeout = p.timeout ?? 3;
         lines.push(`${pad}# Turn ${deg}deg timeout=${timeout}`);
         lines.push(`${pad}heading += ${deg}`);
         lines.push(`${pad}positions.append((x, y, z))`);
         break;
       }
       case 'circle':
       case 'circle_turn': {
         const speed = p.speed ?? 75;
         const direction = p.dir === 'counter-clockwise' ? -1 : 1;
         lines.push(`${pad}# Circle speed=${speed} direction=${direction}`);
         lines.push(`${pad}for i in range(60):`);
         lines.push(`${pad}    angle = 2 * math.pi * i / 60 * ${direction}`);
         lines.push(`${pad}    fx = x + 0.5 * math.cos(angle)`);
         lines.push(`${pad}    fy = y + 0.5 * math.sin(angle)`);
         lines.push(`${pad}    positions.append((fx, fy, z))`);
         lines.push(`${pad}x += 0.5 * ${direction}`);
         lines.push(`${pad}positions.append((x, y, z))`);
         break;
       }
       case 'square':
       case 'square_turn':
       case 'triangle':
       case 'triangle_turn': {
         const speed = p.speed ?? 60;
         const secs = p.secs ?? 1;
         const direction = p.dir === 'counter-clockwise' ? -1 : 1;
         const isTriangle = cmd.type.includes('triangle');
         const numSides = isTriangle ? 3 : 4;
         lines.push(`${pad}# ${isTriangle ? 'Triangle' : 'Square'} speed=${speed} secs=${secs} direction=${direction}`);
         lines.push(`${pad}rad = math.radians(heading)`);
         lines.push(`${pad}for i in range(${numSides}):`);
         lines.push(`${pad}    angle = rad + i * (2 * math.pi / ${numSides}) * ${direction}`);
         lines.push(`${pad}    for j in range(15):`);
         lines.push(`${pad}        t = (j + 1) / 15`);
         lines.push(`${pad}        px = x + math.cos(angle) * 0.5 * t`);
         lines.push(`${pad}        py = y + math.sin(angle) * 0.5 * t`);
         lines.push(`${pad}        positions.append((px, py, z))`);
         lines.push(`${pad}    x += math.cos(angle) * 0.5`);
         lines.push(`${pad}    y += math.sin(angle) * 0.5`);
         lines.push(`${pad}positions.append((x, y, z))`);
         break;
       }
       case 'spiral': {
         const speed = p.speed ?? 50;
         const direction = p.dir === 'counter-clockwise' ? -1 : 1;
         lines.push(`${pad}# Spiral speed=${speed} direction=${direction}`);
         lines.push(`${pad}for i in range(120):`);
         lines.push(`${pad}    t = i / 120`);
         lines.push(`${pad}    angle = 4 * math.pi * t * ${direction}`);
         lines.push(`${pad}    radius = t * 0.5`);
         lines.push(`${pad}    fx = x + radius * math.cos(angle)`);
         lines.push(`${pad}    fy = y + radius * math.sin(angle)`);
         lines.push(`${pad}    fz = z + t * 0.3`);
         lines.push(`${pad}    positions.append((fx, fy, fz))`);
         lines.push(`${pad}x += 0.5 * math.cos(4 * math.pi * ${direction})`);
         lines.push(`${pad}y += 0.5 * math.sin(4 * math.pi * ${direction})`);
         lines.push(`${pad}z += 0.3`);
         lines.push(`${pad}positions.append((x, y, z))`);
         break;
       }
       case 'sway': {
         const speed = p.speed ?? 50;
         const dir = p.dir || 'forward-back';
         lines.push(`${pad}# Sway speed=${speed} dir=${dir}`);
         lines.push(`${pad}for i in range(40):`);
         lines.push(`${pad}    t = i / 40`);
         lines.push(`${pad}    angle = 2 * math.pi * t`);
         lines.push(`${pad}    positions.append((x, y, z))`);
         break;
       }
       case 'keep_distance':
       case 'avoid_wall': {
         const dist = p.dist ?? 50;
         const speed = p.speed ?? 50;
         lines.push(`${pad}# ${cmd.type === 'keep_distance' ? 'Keep Distance' : 'Avoid Wall'} ${dist}cm speed=${speed}`);
         lines.push(`${pad}rad = math.radians(heading)`);
         lines.push(`${pad}dist_m = ${dist} / 100.0`);
         lines.push(`${pad}steps = max(int(dist_m / (DEFAULT_SPEED * DT)), 5)`);
         lines.push(`${pad}for i in range(steps):`);
         lines.push(`${pad}    t = (i + 1) / steps`);
         lines.push(`${pad}    px = x - math.cos(rad) * dist_m * t`);
         lines.push(`${pad}    py = y - math.sin(rad) * dist_m * t`);
         lines.push(`${pad}    positions.append((px, py, z))`);
         lines.push(`${pad}x -= math.cos(rad) * dist_m`);
         lines.push(`${pad}y -= math.sin(rad) * dist_m`);
         break;
       }
       case 'detect_wall': {
         lines.push(`${pad}# Detect Wall`);
         lines.push(`${pad}${p.var} = 0`);
         break;
       }

        case 'led': lines.push(`${pad}# LED color=${p.color}`); break;
        case 'led_off': lines.push(`${pad}# LED Off`); break;
        case 'random_led': lines.push(`${pad}# Random LED`); break;
        case 'buzzer': lines.push(`${pad}# Buzzer freq=${p.freq}Hz dur=${p.dur}s`); break;

      case 'var_declare': lines.push(`${pad}${p.name} = ${p.value}`); break;
      case 'set_var': lines.push(`${pad}${p.name} ${p.op} ${p.value}`); break;
      case 'print_var': lines.push(`${pad}print(${p.value})`); break;

      case 'end_block': break;
      case 'break_cmd': lines.push(`${pad}break`); break;

       case 'get_battery': lines.push(`${pad}${p.var} = 80`); break;
       case 'get_height': lines.push(`${pad}${p.var} = z * 100`); break;
       case 'get_front_range': lines.push(`${pad}${p.var} = 100`); break;
       case 'get_bottom_range': lines.push(`${pad}${p.var} = z * 100`); break;
       case 'get_front_color': lines.push(`${pad}${p.var} = "green"`); break;
       case 'get_back_color': lines.push(`${pad}${p.var} = "blue"`); break;
        case 'get_temperature': lines.push(`${pad}${p.var} = 22.0`); break;
        case 'get_distance': lines.push(`${pad}${p.var} = 100`); break;

      case 'func_call': lines.push(`${pad}${p.name}()`); break;
      case 'return_val': lines.push(`${pad}return ${p.value}`); break;

      case 'list_declare': lines.push(`${pad}${p.name} = [${p.values}]`); break;
      case 'list_append': lines.push(`${pad}${p.name}.append(${p.value})`); break;
      case 'list_get': lines.push(`${pad}${p.var} = ${p.list_name}[${p.index}]`); break;

      case 'user_input': lines.push(`${pad}${p.var} = 0`); break;

      case 'timer_start': lines.push(`${pad}${p.name} = time.time()`); break;
      case 'timer_elapsed': lines.push(`${pad}${p.var} = time.time() - ${p.name}`); break;

      case 'time_sleep': lines.push(`${pad}# Sleep ${p.dur}s`); break;
    }
  }
}
