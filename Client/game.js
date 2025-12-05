// ====================== CONFIG ======================
const SERVER = "http://127.0.0.1:8000";

const WIDTH = 1450;
const HEIGHT = 750;
const LANE_Y = HEIGHT / 1.2;

const LEFT_EDGE = 40;
const RIGHT_EDGE = WIDTH - 40;
const ROAD_LENGTH_PX = RIGHT_EDGE - LEFT_EDGE;

const BACKGROUND_COUNT = 6;
const PER_LANE_CAP = 30;
const TIME_UNIT_MS = 1500;

let BASE_BG_SPEED = 2;  // base scroll speed (pixels per frame)

let phaserGame = null;
let animSceneRef = null;

let bgImages = [];          // <-- will store ALL 10 backgrounds in a line
let records = [];
let recIndex = 0;
let currentRecord = null;


// ====================== UI ======================
document.getElementById("startBtn").addEventListener("click", startSimulation);

function startSimulation() {
  const seg = parseInt(document.getElementById("segmentId").value);
  if (isNaN(seg)) return alert("Enter valid segment ID.");
  fetchSegment(seg);
}


// ====================== FETCH DB ======================
async function fetchSegment(segmentId) {
  try {
    const res = await fetch(`${SERVER}/segment/${segmentId}`);
    if (!res.ok) throw new Error("No data found");

    const json = await res.json();
    records = json.records;
    records.sort((a, b) => a.time_step - b.time_step);

    recIndex = 0;
    setupPhaser();
  } catch (err) {
    alert("Failed to fetch records: " + err.message);
  }
}


// ====================== PHASER BOOT ======================
function setupPhaser() {
  if (phaserGame) phaserGame.destroy(true);

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "gameContainer",
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: "#222",
    scene: {
      preload,
      create() {
        createScene.call(this);
        setTimeout(() => applyRecord(records[recIndex]), 100);
      },
      update
    }
  });
}

function preload() {
  for (let i = 1; i <= BACKGROUND_COUNT; i++) {
    this.load.image("back" + i, `images/bg${i}.png`);
  }
}


// ====================== CREATE SCENE ======================
function createScene() {
  animSceneRef = this;

  // --- Load ALL backgrounds as a sequence ---
  let xOffset = 0;
  for (let i = 1; i <= BACKGROUND_COUNT; i++) {
    const bg = this.add.image(xOffset, HEIGHT / 2, "back" + i)
      .setOrigin(0, 0.5)
      .setDisplaySize(WIDTH, HEIGHT);
    bgImages.push(bg);
    xOffset += WIDTH;
  }

  this.tsText = this.add.text(12, 10, "Timestep: -", { font: "18px Arial", fill: "#3c3b3bff" });
  this.spdText = this.add.text(260, 10, "Speed: - km/h", { font: "18px Arial", fill: "#3c3b3bff" });
  this.jamText = this.add.text(WIDTH - 350, 10, "", { font: "20px Arial", fill: "#ff4444" });

  // Pre-generate ALL cars
  this.carPool = [];
  for (let i = 0; i < PER_LANE_CAP; i++) {
    const car = makeCar(this, LEFT_EDGE, LANE_Y);
    car.group.visible = false;
    car.idx = i;
    this.carPool.push(car);
  }
}


// ====================== MAKE CAR (cleaner + 10 spokes) ======================
function makeCar(scene, x, y) {
  const group = scene.add.container(x, y);

  const bodyColor = Phaser.Display.Color.RandomRGB().color;
  const windowColor = 0xe6f7ff;

  const body = scene.add.graphics();
  body.fillStyle(bodyColor, 1);
  body.lineStyle(2, 0x000000, 0.8);
  body.fillRoundedRect(-30, -5, 60, 22, 6);
  body.strokeRoundedRect(-30, -5, 60, 22, 6);

  const roof = scene.add.arc(0, -8, 26, 180, 360, false, bodyColor).setOrigin(0.5);
  const win = scene.add.rectangle(0, -8, 28, 12, windowColor).setOrigin(0.5).setAlpha(0.85);

  function makeWheel(offsetX) {
    const wheel = scene.add.container(offsetX, 14);
    const tire = scene.add.circle(0, 0, 7, 0x222222);

    const spokes = [];
    const spokeCount = 10;
    const radius = 7;

    for (let i = 0; i < spokeCount; i++) {
      const spoke = scene.add.line(0, 0, 0, 0, radius, 0, 0xffffff)
        .setOrigin(0, 0.5).setLineWidth(2);
      spoke.rotation = (Math.PI * 2 / spokeCount) * i;
      wheel.add(spoke);
      spokes.push(spoke);
    }

    wheel.add(tire);
    return { wheel, spokes };
  }

  const wheelL = makeWheel(-18);
  const wheelR = makeWheel(18);

  group.add([body, roof, win, wheelL.wheel, wheelR.wheel]);

  return { group, wheelL, wheelR, baseColor: bodyColor, jamTint: 0xff4444 };
}


// ====================== APPLY RECORD ======================
function applyRecord(rec) {
  currentRecord = rec;

  animSceneRef.tsText.setText(`Timestep: ${rec.time_step}`);
  animSceneRef.spdText.setText(`Speed: ${rec.average_speed_kmph.toFixed(1)} km/h`);
  animSceneRef.jamText.setText(rec.phantom_jam_flag ? "🚨 PHANTOM JAM 🚨" : "");

  const totalCars = Math.min(rec.local_car_density, PER_LANE_CAP);
  const spacing = ROAD_LENGTH_PX / Math.max(totalCars, 1);

  // draw spacing
  animSceneRef.carPool.forEach((car, i) => {
    if (i < totalCars) {
      car.group.visible = true;
      car.group.x = LEFT_EDGE + (i * spacing);

      const tint = rec.phantom_jam_flag ? car.jamTint : car.baseColor;

      // redraw body
      const body = car.group.list[0];
      body.clear();
      body.fillStyle(tint, 1);
      body.lineStyle(2, 0x000000, 0.8);
      body.fillRoundedRect(-30, -5, 60, 22, 6);
      body.strokeRoundedRect(-30, -5, 60, 22, 6);
    } else {
      car.group.visible = false;
    }
  });

  // calculate scroll speed
  const brakingEffect = rec.brake_events * 0.6;
  const speedFactor = Phaser.Math.Clamp(rec.average_speed_kmph / 120, 0.1, 1);

  let scrollSpeed = (BASE_BG_SPEED * speedFactor) - brakingEffect;

// ✅ If there's a phantom jam → completely freeze movement
if (rec.phantom_jam_flag) {
  scrollSpeed = 0;
} else {
  scrollSpeed = Math.max(scrollSpeed, 0.3); // prevents negative speed normally
}

animSceneRef._scrollSpeed = scrollSpeed;

  animSceneRef._rotSpeed = rec.average_speed_kmph * 0.04;

  recIndex = (recIndex + 1) % records.length;

  clearTimeout(window._step);
  window._step = setTimeout(() => applyRecord(records[recIndex]), TIME_UNIT_MS);
}


// ====================== UPDATE LOOP ======================
function update(time, delta) {
  if (!animSceneRef || !currentRecord) return;

  const scroll = animSceneRef._scrollSpeed ?? BASE_BG_SPEED;

  // move every background image
  bgImages.forEach((bg, i) => {
    bg.x -= scroll;

    // if offscreen → move to right side after last image
    if (bg.x <= -WIDTH) {
      const rightMost = Math.max(...bgImages.map(img => img.x));
      bg.x = rightMost + WIDTH;
    }
  });

  // spin wheels
  const rot = (animSceneRef._rotSpeed || 0.1) * (delta / 1000);
  animSceneRef.carPool.forEach(car => {
    if (!car.group.visible) return;
    car.wheelL.spokes.forEach(s => (s.rotation += rot));
    car.wheelR.spokes.forEach(s => (s.rotation += rot));
  });
}
