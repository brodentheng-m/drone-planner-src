from drone import *
import time
import math
import threading

drones = []
for i in range(20):
    drones.append(Drone())

for d in drones:
    d.pair()
    time.sleep(0.5)

time.sleep(2)

# Face positions (x, y) in cm, all at height 100cm
# Viewed from above: -y = top of head, +y = chin, -x = left, +x = right

# Head outline: 10 drones in circle, radius 100cm
face_outline = []
for i in range(10):
    angle = i * 2 * math.pi / 10
    x = 100 * math.cos(angle)
    y = 100 * math.sin(angle)
    face_outline.append((x, y))

# Left eye: 2 drones
left_eye = [(-30, -20), (-20, -20)]

# Right eye: 2 drones
right_eye = [(20, -20), (30, -20)]

# Nose: 2 drones
nose = [(0, 10), (0, 20)]

# Mouth: 4 drones in a smile
mouth = [(-40, 40), (-15, 50), (15, 50), (40, 40)]

all_positions = face_outline + left_eye + right_eye + nose + mouth

# Colors: green outline, blue eyes, red nose, yellow mouth
colors = (
    ["green"] * 10 +
    ["blue"] * 2 +
    ["blue"] * 2 +
    ["red"] * 2 +
    ["yellow"] * 4
)

def fly_drone(drone, x, y, color, height=100):
    drone.takeoff()
    time.sleep(1)

    # Move up to height using go command
    drone.go("up", 50, height / 50.0)
    time.sleep(0.5)

    if y > 0:
        drone.move_forward(abs(int(y)), 50)
        time.sleep(0.5)
    elif y < 0:
        drone.move_backward(abs(int(y)), 50)
        time.sleep(0.5)

    if x > 0:
        drone.move_right(abs(int(x)), 50)
        time.sleep(0.5)
    elif x < 0:
        drone.move_left(abs(int(x)), 50)
        time.sleep(0.5)

    drone.set_led(color)
    time.sleep(0.2)

threads = []
for i in range(20):
    x, y = all_positions[i]
    t = threading.Thread(target=fly_drone, args=(drones[i], x, y, colors[i]))
    threads.append(t)

for t in threads:
    t.start()
for t in threads:
    t.join()

time.sleep(2)

# Light show
for color in ["red", "green", "blue", "yellow", "cyan", "magenta", "white", "purple", "orange", "pink"]:
    for d in drones:
        d.set_led(color)
    time.sleep(0.5)

# Restore face colors
for i in range(20):
    drones[i].set_led(colors[i])

time.sleep(2)

# Land
for d in drones:
    d.land()

for d in drones:
    d.close()
