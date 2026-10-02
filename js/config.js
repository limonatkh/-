/* =====================================================================
 * CONFIG — every gameplay tuning number lives here.
 * Change speeds, difficulty curve, scoring and power-up timings without
 * touching any system code.
 * ===================================================================== */
window.VR = window.VR || {};

VR.CONFIG = {
  // ---------- Lanes ----------
  LANE_WIDTH: 2.6,            // distance between lane centres (world units = metres)
  LANES: [-1, 0, 1],          // lane indices (left, centre, right)
  LANE_SWITCH_TIME: 0.14,     // seconds to slide from one lane to the next

  // ---------- Player physics ----------
  GRAVITY: 40,
  JUMP_VELOCITY: 13,          // apex ≈ v² / 2g ≈ 2.1 m
  FAST_FALL_VELOCITY: -24,    // swipe down while airborne
  SLIDE_TIME: 0.72,
  PLAYER_HALF_WIDTH: 0.38,
  PLAYER_HALF_DEPTH: 0.35,
  PLAYER_HEIGHT: 1.75,
  PLAYER_SLIDE_HEIGHT: 0.75,
  STUMBLE_WINDOW: 5,          // a second side-hit inside this many seconds = crash

  // ---------- Speed & difficulty ----------
  // speed = START + (MAX - START) * (1 - e^(-distance / RAMP))
  SPEED_START: 13,
  SPEED_MAX: 31,
  SPEED_RAMP: 3200,
  // difficulty 0..1 used by the chunk generator
  DIFFICULTY_RAMP: 4200,

  // ---------- World generation ----------
  CHUNK_LENGTH: 40,
  CHUNKS_AHEAD: 6,            // draw distance, in chunks
  CHUNKS_BEHIND: 1,
  SAFE_START_CHUNKS: 2,       // first chunks have coins only
  BIOME_MIN_CHUNKS: 7,
  BIOME_MAX_CHUNKS: 12,
  RECENTER_DISTANCE: 600,     // world is shifted back to origin to keep float precision

  // ---------- Scoring ----------
  POINTS_PER_METRE: 1,
  COIN_POINTS: 10,
  GEM_POINTS: 50,
  POWERUP_POINTS: 100,
  // score multiplier rises with distance: x1, x2 at 500 m, x3 at 1500 m ...
  MULTIPLIER_STEPS: [0, 500, 1500, 3000, 5000, 8000],

  // ---------- Power-ups (seconds) ----------
  POWERUPS: {
    magnet:      { duration: 10, label: 'Magnet' },
    shield:      { duration: 25, label: 'Shield' },
    boost:       { duration: 5,  label: 'Boost', speedFactor: 1.55 },
    double:      { duration: 12, label: '2x Coins' },
    invincible:  { duration: 7,  label: 'Star' },
  },
  MAGNET_RADIUS: 6,

  // ---------- Mission gates (entrances on the railway) ----------
  MISSION_GATE_FIRST_CHUNK: 7,       // first gate ≈ 250 m into a run
  MISSION_GATE_GAP_MIN: 16,          // then one every 16-24 chunks (≈ 640-960 m)
  MISSION_GATE_GAP_MAX: 24,
  MISSION_RETURN_COUNTDOWN: 3,       // seconds of "3-2-1" before the run resumes
  MISSION_RETURN_STAR: 2.5,          // seconds of star power after returning

  // ---------- First-person mission movement ----------
  // From the movement spec. Its speeds are in Roblox-style units where a
  // character is ~5 units tall, so 1 unit = PLAYER_HEIGHT / 5 = 0.35 m.
  FP: {
    UNIT: 1.75 / 5,
    SPEED_UNITS: 17,             // spec: 15-20 units/s  → ≈ 6 m/s
    ACCEL_TIME: 0.2,             // spec: most of top speed within 0.15-0.3 s
    STOP_TIME: 0.12,             // keeps a little momentum when keys are released
    AIR_CONTROL: 0.28,           // limited steering in the air
    JUMP_HEIGHT_PH: 1.2,         // spec: 1-1.5 player heights
    AIR_TIME: 0.65,              // spec: 0.5-0.8 s
    SLIDE_TIME: 0.6,             // spec: 0.4-0.8 s
    SLIDE_BOOST: 1.15,           // slide starts slightly faster than the run…
    SLIDE_END_KEEP: 0.6,         // …and keeps 60% of it at the end (no sudden stop)
    CROUCH_SPEED: 0.5,
    BURST_HEIGHT_X: 3.5,         // spec: 3-4× a normal jump
    BURST_ANGLE_STILL: 80,       // spec: 70-80° when used under the player
    BURST_ANGLE_MOVING: 70,      // pushes sideways when moving
    BURST_COOLDOWN: 3.2,         // spec: 2.5-4 s
    LADDER_SPEED: 4.2,
    HEIGHT: 1.75, CROUCH_HEIGHT: 0.95, RADIUS: 0.3,
    EYE: 1.55, CROUCH_EYE: 0.78,
    FOV: 95,                     // spec: 90-105°
    REACH: 2.7,                  // interaction distance (m)
    MOUSE_SENS: 0.0022,
  },

  // ---------- Camera ----------
  CAMERA_HEIGHT: 4.3,
  CAMERA_DISTANCE: 7.6,
  CAMERA_LOOK_AHEAD: 9,
  CAMERA_FOV: 62,
};
