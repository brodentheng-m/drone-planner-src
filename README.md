# Drone Planner

Flight path planner for the Robolink CoDrone EDU. Build a mission from a
command palette, watch the flight in a 3D simulation, and generate ready-to-run
Python for the real drone.

## Features

- 3D scene with realistic drone model, flight trail, and camera controls
  (Map view and Drone-follow)
- Command palette covering the full CoDrone EDU command set: flight, movement,
  turns, patterns, flips, LED, buzzer, sensors, variables, control flow,
  functions, timers
- Multi-drone plans with formations and swarm support
- Physics simulation: point-mass aero model with thrust, drag, battery drain,
  pitch/roll decomposition, and altitude hold
- Obstacle system: JSON, GeoJSON, CSV, and OBJ import; collision detection;
  boundary filtering
- Python code generation for single drone, swarm, and animation, with reverse
  parsing so imported scripts become editable plans
- Manual code editing with live re-simulation and a typing-mode camera lock

## Layout

```
src/main.js             app wiring, toolbar, command palette, playback
src/index.html          UI shell
src/style.css           styling
src/scene/            3D scene + simulation
  Scene3D.js            renderer, playback, camera modes, obstacles
  Simulator.js          command interpreter driving the physics engine
  AeroEngine.js         flight physics (point-mass aero model)
  DroneModel.js         drone mesh
  FlightTrail.js        path trail
  ObstacleManager.js    obstacle storage + collision
  ObstacleImporter.js   JSON/GeoJSON/CSV/OBJ parsers
src/commands/          command definitions and script parser
  Commands.js           command list, plan CRUD, Python emitters
  ScriptParser.js       reverse-parse generated Python into commands
src/codegen/           Python code generation
  CodeGenerator.js      single-drone, swarm, and animation scripts
electron/              Electron shell (main + preload)
examples/              sample obstacle courses
```

## Build and run

Requires Node.js and npm.

```
npm install
npm run dev        # Vite + Electron with hot reload
npm run build      # production build into dist/
npm run package    # package an AppImage
```

In dev mode the app opens in a browser at `http://localhost:5173` automatically
alongside the Electron window.

## Example scripts

The included Python scripts run on a real CoDrone EDU (`showcase.py` walks
through the full command set, `obama.py` traces a portrait flight path, and
`swarm_showcase.py` coordinates a 20-drone swarm).

## License

MIT