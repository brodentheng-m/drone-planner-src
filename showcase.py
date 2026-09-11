from drone import *
import time

drone = Drone()
drone.pair()
time.sleep(2)

# === VARIABLES ===
speed = 50
distance = 100
turn_angle = 90
safe_distance = 30
battery_threshold = 20
loop_count = 0
total_distance = 0
x = 0
y = 0
z = 0
i = 0
temp = 0.0
elapsed = 0.0
dist = 0
height = 0
color = "none"
battery = 100
user_choice = 0

# === SET VARIABLES (all operators) ===
speed = speed + 10
distance = distance * 2
turn_angle = turn_angle / 2
total_distance = total_distance + distance
x = x + 1
y = y - 1
z = z * 2

# === PRINT VARIABLES ===
print(speed)
print(distance)
print(turn_angle)
print(total_distance)
print(x)
print(y)
print(z)

# === LISTS ===
flight_log = [10, 20, 30, 40, 50]
colors_list = ["red", "green", "blue", "yellow", "cyan"]
distances_read = []

# === LIST APPEND ===
flight_log.append(60)
flight_log.append(70)
colors_list.append("magenta")
colors_list.append("white")

# === LIST GET INDEX ===
val = flight_log[0]
print(val)
val = flight_log[3]
print(val)
val = colors_list[1]
print(val)
val = colors_list[4]
print(val)

# === TIMER ===
t = time.time()
mission_start = time.time()

# === FUNCTIONS ===
def scan_area(d):
    d.turn_left(90)
    time.sleep(0.5)
    dist = d.get_front_range()
    print(dist)
    d.turn_right(90)
    time.sleep(0.5)

def pattern_square(d):
    for i in range(4):
        d.move_forward(40, 50)
        time.sleep(0.3)
        d.turn_right(90)
        time.sleep(0.3)

def pattern_triangle(d):
    for i in range(3):
        d.move_forward(50, 50)
        time.sleep(0.3)
        d.turn_right(120)
        time.sleep(0.3)

def pattern_circle(d):
    d.circle(speed=75, direction=1)
    time.sleep(0.5)

def emergency_stop(d):
    d.set_led("red")
    d.set_buzzer(1000, 0.5)
    d.hover(0.5)
    d.land()

def led_chase(d):
    d.set_led("red")
    time.sleep(0.2)
    d.set_led("green")
    time.sleep(0.2)
    d.set_led("blue")
    time.sleep(0.2)
    d.set_led("yellow")
    time.sleep(0.2)

def take_reading(d):
    d2 = d.get_front_range()
    h = d.get_height()
    c = d.get_color()
    b = d.get_battery()
    t = d.get_temperature()
    print(d2)
    print(h)
    print(c)
    print(b)
    print(t)

def get_altitude(d):
    h = d.get_height()
    return h

def check_battery(d):
    b = d.get_battery()
    return b

def is_safe(d):
    dist = d.get_front_range()
    if dist > 30:
        return True
    else:
        return False

def calculate_speed(power):
    s = power * 2
    return s

# === USER INPUT ===
alt = get_altitude(drone)
print(alt)

pwr = check_battery(drone)
print(pwr)

safe = is_safe(drone)
print(safe)

spd = calculate_speed(50)
print(spd)

user_choice = 1
print(user_choice)

# === FUNCTION CALLS ===
scan_area(drone)
time.sleep(0.5)

# === TAKEOFF ===
drone.takeoff()
time.sleep(2)

# === LED - all 10 colors + off ===
drone.set_led("green")
drone.set_buzzer(440, 0.3)
time.sleep(1)

drone.move_forward(50, 60)
time.sleep(0.5)
drone.move_backward(50, 60)
time.sleep(0.5)
drone.move_left(30, 50)
time.sleep(0.5)
drone.move_right(30, 50)
time.sleep(0.5)

# === TURN - different angles ===
drone.turn_left(90)
time.sleep(0.5)
drone.turn_right(90)
time.sleep(0.5)
drone.turn_left(45)
time.sleep(0.3)
drone.turn_right(180)
time.sleep(0.5)
drone.turn_left(270)
time.sleep(0.5)

# === GO - all 6 directions ===
drone.go("forward", 40, 1.0)
time.sleep(0.3)
drone.go("backward", 40, 1.0)
time.sleep(0.3)
drone.go("left", 40, 1.0)
time.sleep(0.3)
drone.go("right", 40, 1.0)
time.sleep(0.3)

# === LED - all 10 colors + off ===
drone.set_led("red")
time.sleep(0.3)
drone.set_led("green")
time.sleep(0.3)
drone.set_led("blue")
time.sleep(0.3)
drone.set_led("yellow")
time.sleep(0.3)
drone.set_led("cyan")
time.sleep(0.3)
drone.set_led("magenta")
time.sleep(0.3)
drone.set_led("white")
time.sleep(0.3)
drone.set_led("purple")
time.sleep(0.3)
drone.set_led("orange")
time.sleep(0.3)
drone.set_led("pink")
time.sleep(0.3)
drone.set_led("off")
time.sleep(0.2)

# === RANDOM LED ===
drone.random_color()
time.sleep(0.5)
drone.random_color()
time.sleep(0.5)
drone.random_color()
time.sleep(0.5)

# === BUZZER - different frequencies ===
drone.set_buzzer(262, 0.3)
time.sleep(0.4)
drone.set_buzzer(330, 0.3)
time.sleep(0.4)
drone.set_buzzer(392, 0.3)
time.sleep(0.4)
drone.set_buzzer(523, 0.5)
time.sleep(0.6)
drone.set_buzzer(660, 0.2)
time.sleep(0.3)
drone.set_buzzer(880, 0.1)
time.sleep(0.2)

# === SENSORS - all 5 ===
dist = drone.get_front_range()
print(dist)
distances_read.append(dist)

height = drone.get_height()
print(height)

color = drone.get_color()
print(color)

battery = drone.get_battery()
print(battery)

temp = drone.get_temperature()
print(temp)

# === FOR LOOP - forward 5 times ===
for i in range(5):
    drone.move_forward(20, 30)
    time.sleep(0.3)

# === FOR LOOP - turn with step ===
for i in range(0, 10, 2):
    drone.turn_left(15)
    time.sleep(0.2)

# === FOR LOOP - decreasing distance ===
for i in range(10, 0, -1):
    drone.move_forward(i * 5, 40)
    time.sleep(0.2)

# === WHILE LOOP ===
loop_count = 0
while loop_count < 10:
    drone.hover(0.5)
    loop_count = loop_count + 1

# === WHILE with sensor reading ===
dist = drone.get_front_range()
while dist > safe_distance:
    drone.move_forward(20, 40)
    time.sleep(0.3)
    dist = drone.get_front_range()
    print(dist)

# === IF/ELIF/ELSE with battery ===
battery = drone.get_battery()
if battery > 50:
    drone.set_led("green")
    drone.move_forward(100, 60)
    time.sleep(1)
elif battery > 30:
    drone.set_led("yellow")
    drone.move_forward(50, 40)
    time.sleep(0.5)
else:
    drone.set_led("red")
    drone.land()
    time.sleep(2)

# === IF/ELIF/ELSE with color sensor ===
color = drone.get_color()
if color == "red":
    drone.set_led("red")
    drone.set_buzzer(800, 0.3)
    drone.hover(1)
elif color == "green":
    drone.set_led("green")
    drone.set_buzzer(400, 0.3)
    drone.move_forward(50, 50)
elif color == "blue":
    drone.set_led("blue")
    drone.set_buzzer(600, 0.3)
    drone.turn_left(90)
else:
    drone.set_led("white")
    drone.hover(0.5)

# === FLIP - all 4 directions ===
drone.set_led("cyan")
drone.flip("back")
time.sleep(1.5)
drone.set_led("magenta")
drone.flip("forward")
time.sleep(1.5)
drone.set_led("yellow")
drone.flip("left")
time.sleep(1.5)
drone.set_led("orange")
drone.flip("right")
time.sleep(1.5)

# === SQUARE pattern ===
drone.set_led("green")
drone.set_buzzer(440, 0.2)
pattern_square(drone)

# === TRIANGLE pattern ===
drone.set_led("blue")
drone.set_buzzer(550, 0.2)
pattern_triangle(drone)

# === CIRCLE pattern ===
drone.set_led("purple")
drone.set_buzzer(660, 0.2)
drone.circle(speed=75, direction=1)
time.sleep(3)

# === SQUARE with size ===
drone.set_led("cyan")
drone.square(speed=60, seconds=1, direction=1)
time.sleep(3)

# === TRIANGLE with size ===
drone.set_led("pink")
drone.triangle(speed=60, seconds=1, direction=1)
time.sleep(3)

# === TIMER - get elapsed ===
elapsed = time.time() - mission_start
print(elapsed)

# === SLEEP (time.sleep) ===
drone.set_led("red")
drone.set_buzzer(200, 0.5)
time.sleep(1)

# === TURN around with different angles ===
drone.set_led("green")
for i in range(4):
    drone.move_forward(50, 60)
    time.sleep(0.5)
    drone.turn_right(90)
    time.sleep(0.3)

# === LED chase sequence ===
drone.set_led("blue")
time.sleep(0.2)
drone.set_led("cyan")
time.sleep(0.2)
drone.set_led("white")
time.sleep(0.2)

# === BUZZER melody ===
drone.set_buzzer(523, 0.3)
time.sleep(0.3)
drone.set_buzzer(659, 0.3)
time.sleep(0.3)
drone.set_buzzer(784, 0.3)
time.sleep(0.3)
drone.set_buzzer(1047, 0.5)
time.sleep(0.5)

# === FINAL ===
drone.set_led("green")
drone.set_buzzer(880, 0.3)
drone.set_led("off")
drone.land()

drone.close()
