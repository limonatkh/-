/* =====================================================================
 * PREFABS — every reusable voxel model: track segments, ground,
 * trains, barriers, ramps, collectibles.
 * ---------------------------------------------------------------------
 * HOW TO ADD A NEW OBSTACLE: add an entry to VR.OBSTACLE_TYPES with
 *   build()      -> VoxelBuilder model (front at z = 0, extends to -length)
 *   length       -> metres along the track
 *   colliders    -> boxes {x0,x1,y0,y1,z0,z1} relative to lane centre/front
 *   kind         -> 'jump' | 'slide' | 'block'  (used by the fairness check)
 * then reference it from a pattern in patterns.js.
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const L = C.CHUNK_LENGTH;
  const LW = C.LANE_WIDTH;
  const HALF_TRACK = LW * 1.5 + 0.35; // edge of the gravel bed

  // ---------------------------------------------------------------- track
  function addRails(vb, zFrom = 0, zTo = -L) {
    const len = Math.abs(zTo - zFrom), zc = (zFrom + zTo) / 2;
    for (const lane of [-1, 0, 1]) {
      const x = lane * LW;
      for (let z = zFrom - 0.6; z > zTo; z -= 1.25) vb.addBox(x, -0.1, z, 2.1, 0.13, 0.42, 'sleeper');
      vb.addBox(x - 0.72, 0.03, zc, 0.14, 0.12, len, 'iron');
      vb.addBox(x + 0.72, 0.03, zc, 0.14, 0.12, len, 'iron');
    }
  }
  function gravelBed(vb, y0 = -1) {
    vb.addBox(0, y0, -L / 2, HALF_TRACK * 2, -0.1 - y0, L, { top: 'gravel', side: 'gravel', bottom: 'gravel' });
  }
  function pole(vb, x, z) {
    vb.addBox(x, 0, z, 0.3, 5.2, 0.3, 'log');
    vb.addBox(x - Math.sign(x) * 0.5, 4.6, z, 1.4, 0.2, 0.2, 'log');
  }

  const TRACK = {
    normal() {
      const vb = new VR.VoxelBuilder();
      gravelBed(vb); addRails(vb);
      pole(vb, -HALF_TRACK - 0.6, -10); pole(vb, HALF_TRACK + 0.6, -30);
      return vb;
    },
    station() {
      const vb = new VR.VoxelBuilder();
      gravelBed(vb); addRails(vb);
      for (const s of [-1, 1]) {
        const x = s * (HALF_TRACK + 3);
        vb.addBox(x, 0, -L / 2, 5.6, 1.1, L - 2, { top: 'platform', side: 'concrete' });
        vb.addBox(s * (HALF_TRACK + 0.45), 1.1, -L / 2, 0.8, 0.02, L - 2, 'tile_edge');
        // roof on pillars
        for (let z = -4; z > -L; z -= 8) vb.addBox(s * (HALF_TRACK + 4.6), 1.1, z, 0.5, 4.4, 0.5, 'iron');
        vb.addBox(s * (HALF_TRACK + 3.2), 5.5, -L / 2, 6.2, 0.4, L - 2, 'roof');
        // benches + lamps + sign
        for (let z = -8; z > -L; z -= 12) {
          vb.addBox(s * (HALF_TRACK + 4.2), 1.1, z, 0.9, 0.5, 2.4, 'planks');
          vb.addBox(s * (HALF_TRACK + 1.4), 1.1, z - 5, 0.25, 3, 0.25, 'iron');
          vb.addBox(s * (HALF_TRACK + 1.4), 4.1, z - 5, 0.5, 0.4, 0.5, 'lamp');
        }
        // station sign: three lemon tiles on a board (each face is exactly 1 block -> one icon)
        vb.addBox(s * (HALF_TRACK + 1.86), 2.95, -20, 0.1, 1.5, 3.5, 'dark');
        for (const z of [-19, -20, -21]) vb.addBox(s * (HALF_TRACK + 1.8), 3.2, z, 0.12, 1, 1, 'lemon_sign');
        vb.addBox(s * (HALF_TRACK + 1.9), 1.1, -18.4, 0.2, 1.9, 0.2, 'iron');
        vb.addBox(s * (HALF_TRACK + 1.9), 1.1, -21.6, 0.2, 1.9, 0.2, 'iron');
        // lemon crates waiting on the platform
        VR.Props.lemonCrate(vb, s * (HALF_TRACK + 3.6), -14, 1.1);
        VR.Props.lemonCrate(vb, s * (HALF_TRACK + 3.4), -31, 1.1);
        VR.Props.lemonCrate(vb, s * (HALF_TRACK + 3.4), -32.1, 1.1);
      }
      return vb;
    },
    bridge() {
      const vb = new VR.VoxelBuilder();
      vb.addBox(0, -1.1, -L / 2, HALF_TRACK * 2 + 1.6, 1, L, { top: 'planks', side: 'planks' });
      vb.addBox(0, -0.1, -L / 2, HALF_TRACK * 2 - 0.2, 0.001, L, 'gravel');
      addRails(vb);
      for (const s of [-1, 1]) {
        const x = s * (HALF_TRACK + 0.55);
        for (let z = -1; z > -L; z -= 3) vb.addBox(x, -0.1, z, 0.3, 1.1, 0.3, 'log');
        vb.addBox(x, 0.8, -L / 2, 0.2, 0.2, L, 'log');
      }
      for (const z of [-2, -22]) {
        vb.addBox(0, -12, z - 1.5, HALF_TRACK * 2 + 1.6, 11, 3, 'cobble');
      }
      return vb;
    },
    tunnel(opts) {
      const vb = new VR.VoxelBuilder();
      gravelBed(vb); addRails(vb);
      const W = HALF_TRACK + 0.6, H = 6;
      for (const s of [-1, 1]) {
        vb.addBox(s * (W + 0.5), -0.1, -L / 2, 1, H, L, 'cobble');
        for (let z = -5; z > -L; z -= 10) vb.addBox(s * W, 3.2, z, 0.2, 0.6, 0.6, 'lamp');
      }
      vb.addBox(0, H - 0.1, -L / 2, W * 2 + 2, 1, L, 'dark');
      // hill on top of the tunnel
      for (let i = 0; i < 4; i++) {
        const w = 60 - i * 12;
        vb.addBox(0, H + 0.9 + i * 1.5, -L / 2, w, 1.5, L + 0.02, { top: 'grass_top', side: 'grass_side', bottom: 'dirt' });
      }
      // side masses so you can't see the ground break
      for (const s of [-1, 1]) vb.addBox(s * (W + 16), -0.1, -L / 2, 30, H + 1, L, { top: 'grass_top', side: 'stone' });
      // portals
      const portal = (z) => {
        vb.addBox(0, H - 0.1, z, W * 2 + 3, 1.6, 0.8, 'stone');
        for (const s of [-1, 1]) vb.addBox(s * (W + 0.6), -0.1, z, 1.6, H + 1.6, 0.8, 'stone');
        vb.addBox(0, H + 1.4, z, 3, 0.7, 0.9, 'hazard');
      };
      if (opts.start) portal(-0.4);
      if (opts.end) portal(-L + 0.4);
      return vb;
    },
  };

  /** One car-length of single rails (trains bring their own track in the adventure world). */
  VR.buildRails = function () {
    const vb = new VR.VoxelBuilder();
    const len = VR.CAR_LEN || 7.5;
    for (let z = -0.6; z > -len; z -= 1.25) vb.addBox(0, -0.05, z, 2.1, 0.12, 0.42, 'sleeper');
    vb.addBox(-0.72, 0.03, -len / 2, 0.14, 0.12, len, 'iron');
    vb.addBox(0.72, 0.03, -len / 2, 0.14, 0.12, len, 'iron');
    return vb;
  };

  VR.TRACK_STYLES = {
    normal: () => TRACK.normal(),
    station: () => TRACK.station(),
    bridge: () => TRACK.bridge(),
    tunnel_start: () => TRACK.tunnel({ start: true }),
    tunnel_end: () => TRACK.tunnel({ end: true }),
  };

  // ---------------------------------------------------------------- ground
  VR.buildGround = function (biome) {
    const vb = new VR.VoxelBuilder();
    const w = 70;
    for (const s of [-1, 1]) vb.addBox(s * (HALF_TRACK + w / 2), -1, -L / 2, w, 0.9, L, { top: biome.ground.top, side: biome.ground.side, bottom: 'dirt' });
    return vb;
  };
  VR.buildWater = function (biome) {
    const vb = new VR.VoxelBuilder();
    vb.addBox(0, -6.5, -L / 2, 150, 0.5, L, 'water');
    // river banks far away
    for (const s of [-1, 1]) vb.addBox(s * 60, -6.5, -L / 2, 40, 6, L, { top: biome.ground.top, side: biome.ground.side });
    return vb;
  };

  // ---------------------------------------------------------------- trains
  VR.TRAIN_COLORS = [0xd8392b, 0x2f7fd0, 0x3fa34d, 0xf2b630, 0x7a4fc2, 0xe8e8e8, 0xe3702a];
  const CAR_LEN = 9, CAR_W = 2.25, CAR_H = 3.0;
  VR.CAR_LEN = CAR_LEN; VR.TRAIN_HEIGHT = CAR_H;

  function darker(c, f = 0.7) {
    return (Math.floor(((c >> 16) & 255) * f) << 16) | (Math.floor(((c >> 8) & 255) * f) << 8) | Math.floor((c & 255) * f);
  }
  function wheels(vb, len) {
    for (const z of [-1.6, -len + 1.6]) {
      vb.addBox(0, 0, z, CAR_W - 0.3, 0.55, 2.2, 'dark');
      for (const s of [-1, 1]) vb.addBox(s * 0.72, 0.05, z, 0.25, 0.5, 0.9, 'iron');
    }
  }
  const CARS = {
    passenger(color) {
      const vb = new VR.VoxelBuilder();
      const body = VR.Mat.tinted('metal', color), stripe = VR.Mat.tinted('metal', darker(color, 0.62));
      wheels(vb, CAR_LEN);
      vb.addBox(0, 0.5, -CAR_LEN / 2, CAR_W, CAR_H - 0.6, CAR_LEN - 0.3, body);
      vb.addBox(0, 0.8, -CAR_LEN / 2, CAR_W + 0.04, 0.35, CAR_LEN - 0.3, stripe);
      vb.addBox(0, CAR_H - 0.1, -CAR_LEN / 2, CAR_W - 0.3, 0.1, CAR_LEN - 0.6, VR.Mat.tinted('metal', 0xb8bcc2));
      for (let z = -1.6; z > -CAR_LEN + 1; z -= 1.9) vb.addBox(0, 1.55, z, CAR_W + 0.05, 0.8, 1.2, 'window');
      vb.addBox(0, 0.5, -0.02, 1.1, 2.2, 0.06, stripe);                 // end door
      return vb;
    },
    freight(color) {
      const vb = new VR.VoxelBuilder();
      wheels(vb, CAR_LEN);
      const body = VR.Mat.tinted('planks', color);
      vb.addBox(0, 0.5, -CAR_LEN / 2, CAR_W, CAR_H - 0.5, CAR_LEN - 0.3, body);
      for (let z = -0.4; z > -CAR_LEN; z -= 2.8) vb.addBox(0, 0.5, z, CAR_W + 0.06, CAR_H - 0.5, 0.25, VR.Mat.tinted('metal', 0x5a5e66));
      vb.addBox(0, 1.1, -CAR_LEN / 2, CAR_W + 0.08, 1.6, 2.2, VR.Mat.tinted('planks', darker(color, 0.7)));
      return vb;
    },
    tanker(color) {
      const vb = new VR.VoxelBuilder();
      wheels(vb, CAR_LEN);
      const body = VR.Mat.tinted('metal', color);
      vb.addBox(0, 0.5, -CAR_LEN / 2, CAR_W, 0.4, CAR_LEN - 0.3, 'dark');
      vb.addBox(0, 0.9, -CAR_LEN / 2, CAR_W - 0.1, 1.9, CAR_LEN - 1, body);
      vb.addBox(0, 1.2, -CAR_LEN / 2, CAR_W + 0.1, 1.3, CAR_LEN - 1.2, body);
      vb.addBox(0, 2.8, -CAR_LEN / 2, CAR_W - 0.4, 0.2, CAR_LEN - 1.4, VR.Mat.tinted('metal', darker(color, 0.8)));
      vb.addBox(0, 2.8, -CAR_LEN / 2, 0.8, 0.2, 0.8, 'iron');
      return vb;
    },
    loco(color) {
      const vb = new VR.VoxelBuilder();
      const body = VR.Mat.tinted('metal', color), dk = VR.Mat.tinted('metal', darker(color, 0.6));
      wheels(vb, CAR_LEN);
      vb.addBox(0, 0.5, -CAR_LEN / 2, CAR_W, CAR_H - 0.6, CAR_LEN - 0.3, body);
      vb.addBox(0, 0.8, -CAR_LEN / 2, CAR_W + 0.04, 0.35, CAR_LEN - 0.3, dk);
      vb.addBox(0, CAR_H - 0.1, -CAR_LEN / 2, CAR_W - 0.3, 0.1, CAR_LEN - 0.6, VR.Mat.tinted('metal', 0xb8bcc2));
      // cab face (toward +z = toward the player)
      vb.addBox(0, 1.7, -0.16, CAR_W - 0.3, 0.9, 0.1, 'window');
      vb.addBox(0, 0.5, -0.05, CAR_W, 0.6, 0.3, 'hazard');
      for (const s of [-1, 1]) vb.addBox(s * 0.7, 1.15, -0.06, 0.4, 0.35, 0.1, 'lamp');
      vb.addBox(0, CAR_H - 0.3, -0.15, 0.5, 0.3, 0.1, 'lamp');
      for (let z = -2.6; z > -CAR_LEN + 1; z -= 2.2) vb.addBox(0, 1.55, z, CAR_W + 0.05, 0.8, 1.3, 'window');
      return vb;
    },
  };
  VR.CAR_BUILDERS = CARS;

  // ---------------------------------------------------------------- obstacles
  const hw = 1.12; // half width of a lane-blocking obstacle
  VR.OBSTACLE_TYPES = {
    barrier_low: {                                   // JUMP over
      kind: 'jump', length: 0.5, standable: true,
      colliders: [{ x0: -hw, x1: hw, y0: 0, y1: 1.0, z0: -0.5, z1: 0 }],
      build() {
        const vb = new VR.VoxelBuilder();
        for (const s of [-1, 1]) vb.addBox(s * 0.9, 0, -0.25, 0.3, 1.0, 0.4, 'iron');
        vb.addBox(0, 0.45, -0.25, 2.3, 0.55, 0.3, 'hazard');
        vb.addBox(0, 0, -0.25, 2.1, 0.12, 0.5, 'dark');
        return vb;
      },
    },
    barrier_high: {                                  // SLIDE under
      kind: 'slide', length: 0.5, standable: false,
      colliders: [{ x0: -hw, x1: hw, y0: 1.05, y1: 3.2, z0: -0.5, z1: 0 }],
      build() {
        const vb = new VR.VoxelBuilder();
        for (const s of [-1, 1]) vb.addBox(s * 1.1, 0, -0.25, 0.3, 3.1, 0.3, 'iron');
        vb.addBox(0, 1.15, -0.25, 2.5, 1.0, 0.28, 'redwhite');
        vb.addBox(0, 2.4, -0.25, 2.5, 0.35, 0.28, 'iron');
        vb.addBox(0, 2.75, -0.25, 0.6, 0.35, 0.3, 'lamp');
        return vb;
      },
    },
    minecart: {                                      // JUMP over (or land on it)
      kind: 'jump', length: 1.8, standable: true,
      colliders: [{ x0: -0.95, x1: 0.95, y0: 0, y1: 1.1, z0: -1.8, z1: 0 }],
      build() {
        const vb = new VR.VoxelBuilder();
        vb.addBox(0, 0.1, -0.9, 1.7, 0.3, 1.6, 'dark');
        vb.addBox(0, 0.4, -0.9, 1.9, 0.5, 1.8, 'iron');
        vb.addBox(0, 0.9, -0.9, 1.6, 0.2, 1.5, 'ore');
        vb.addBox(0.3, 0.9, -0.7, 0.6, 0.2, 0.6, 'ore');
        return vb;
      },
    },
    hay: {                                           // JUMP over
      kind: 'jump', length: 1.2, standable: true,
      colliders: [{ x0: -hw, x1: hw, y0: 0, y1: 1.05, z0: -1.2, z1: 0 }],
      build() {
        const vb = new VR.VoxelBuilder();
        vb.addBox(-0.55, 0, -0.6, 1.05, 1.05, 1.1, 'hay');
        vb.addBox(0.55, 0, -0.6, 1.05, 1.05, 1.1, 'hay');
        return vb;
      },
    },
    wall: {                                          // must change lane
      kind: 'block', length: 1.2, standable: true,
      colliders: [{ x0: -hw, x1: hw, y0: 0, y1: 3.0, z0: -1.2, z1: 0 }],
      build() {
        const vb = new VR.VoxelBuilder();
        vb.addBox(0, 0, -0.6, 2.3, 3.0, 1.2, 'cobble');
        vb.addBox(0, 1.9, -0.02, 2.3, 0.5, 0.06, 'hazard');
        vb.addBox(0, 3.0, -0.6, 0.6, 0.4, 0.6, 'lamp');
        return vb;
      },
    },
    ramp: {                                          // walk up onto trains
      kind: 'ramp', length: 7, standable: true, rampHeight: CAR_H,
      colliders: [],
      build() {
        const vb = new VR.VoxelBuilder();
        const steps = 12;
        for (let i = 0; i < steps; i++) {
          const h = CAR_H * (i + 1) / steps;
          vb.addBox(0, 0, -(i + 0.5) * (7 / steps), 2.1, h, 7 / steps + 0.01, i % 2 ? 'planks' : VR.Mat.tinted('planks', 0xd9c7a8));
        }
        for (const s of [-1, 1]) vb.addBox(s * 1.05, 0, -3.5, 0.15, CAR_H, 7, 'iron');
        return vb;
      },
    },
  };

  // ---------------------------------------------------------------- collectibles
  // Power-up icons (16x16 pixel art)
  const ICONS = {
    magnet(c) {
      c.fillStyle = '#23313f'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#e5433a'; c.fillRect(3, 3, 3, 9); c.fillRect(10, 3, 3, 9); c.fillRect(3, 10, 10, 3);
      c.fillStyle = '#dfe6ee'; c.fillRect(3, 2, 3, 2); c.fillRect(10, 2, 3, 2);
    },
    shield(c) {
      c.fillStyle = '#23313f'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#5ec8ff'; c.fillRect(3, 2, 10, 7); c.fillRect(4, 9, 8, 2); c.fillRect(5, 11, 6, 2); c.fillRect(7, 13, 2, 1);
      c.fillStyle = '#d9f4ff'; c.fillRect(5, 4, 2, 5);
    },
    boost(c) {
      c.fillStyle = '#23313f'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#ffc93c';
      for (let i = 0; i < 2; i++) { const o = i * 5; c.fillRect(3 + o, 3, 2, 2); c.fillRect(5 + o, 5, 2, 2); c.fillRect(7 + o, 7, 2, 2); c.fillRect(5 + o, 9, 2, 2); c.fillRect(3 + o, 11, 2, 2); }
    },
    double(c) {
      c.fillStyle = '#23313f'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#7ee06a';
      c.fillRect(2, 4, 5, 2); c.fillRect(5, 6, 2, 2); c.fillRect(2, 8, 5, 2); c.fillRect(2, 10, 2, 2); c.fillRect(2, 12, 5, 2);
      c.fillRect(9, 7, 2, 2); c.fillRect(13, 7, 2, 2); c.fillRect(11, 9, 2, 2); c.fillRect(9, 11, 2, 2); c.fillRect(13, 11, 2, 2);
    },
    invincible(c) {
      c.fillStyle = '#23313f'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#ffe066';
      c.fillRect(7, 2, 2, 3); c.fillRect(2, 6, 12, 2); c.fillRect(4, 8, 8, 2); c.fillRect(5, 10, 6, 2); c.fillRect(4, 12, 3, 2); c.fillRect(9, 12, 3, 2); c.fillRect(6, 5, 4, 1);
      c.fillStyle = '#fff6c4'; c.fillRect(7, 6, 2, 2);
    },
  };
  VR.POWERUP_ICONS = ICONS;
  VR.POWERUP_COLORS = { magnet: 0xe5433a, shield: 0x5ec8ff, boost: 0xffc93c, double: 0x7ee06a, invincible: 0xffe066 };
  for (const k in ICONS) VR.Tex.register('pu_' + k, ICONS[k]);

  // ---------------------------------------------------------------- mission gate
  // Sandstone arch with lemon blocks, a flowing lemon-light curtain, a
  // "MISSION n" sign and a spinning lemon on top.
  VR.buildMissionGate = function (def) {
    const g = new THREE.Group();
    const vb = new VR.VoxelBuilder();
    for (const s of [-1, 1]) {
      vb.addBox(s * 1.3, -0.1, 0, 0.6, 0.5, 0.9, 'cobble');
      vb.addBox(s * 1.3, 0.4, 0, 0.45, 3.7, 0.7, 'sandstone');
      for (const y of [1.2, 2.6]) vb.addBox(s * 1.3, y, 0, 0.5, 0.35, 0.75, 'lemon');
    }
    vb.addBox(0, 4.1, 0, 3.4, 0.6, 0.8, 'sandstone');
    vb.addBox(0, 4.7, 0, 1.0, 0.5, 0.8, 'lemon');
    vb.addBox(0, 4.1, 0.41, 3.0, 0.08, 0.02, 'hazard');
    g.add(vb.build());
    if (!VR.gateCurtainMat) {
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 64;
      const c = cv.getContext('2d');
      for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
        const v = 0.55 + 0.45 * Math.sin((x * 0.5) + Math.sin(y * 0.3) * 2) * Math.cos(y * 0.2);
        c.fillStyle = `rgba(${255},${(220 + v * 35) | 0},${(60 + v * 120) | 0},${0.55 + v * 0.45})`;
        c.fillRect(x, y, 1, 1);
      }
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
      VR.gateCurtainMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
    }
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 3.7), VR.gateCurtainMat);
    curtain.position.set(0, 2.25, 0); g.add(curtain);
    const sign = VR.WorldText.make({ text: VR.t('gate.sign', { n: def.order }), style: 'sign', width: 2.0, size: 0.32 });
    sign.position.set(0, 5.45, 0.42); g.add(sign);
    const spinner = new THREE.Group();
    const lv = new VR.VoxelBuilder(); VR.Props.lemon(lv, 0, 0, 0, 2.2, true);
    spinner.add(lv.build()); spinner.position.set(0, 6.0, 0); g.add(spinner);
    g.userData.spinner = spinner;
    return g;
  };
})();
