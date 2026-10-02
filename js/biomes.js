/* =====================================================================
 * BIOMES
 * ---------------------------------------------------------------------
 * HOW TO ADD A NEW ENVIRONMENT:
 *   1. Add an entry to VR.BIOMES below with:
 *        sky / fog colours, ground materials (texture keys from voxel.js),
 *        styleWeights (how often tunnels / bridges / stations appear),
 *        and a scenery(vb, rnd, variant) function that places voxel
 *        props on the LEFT side of a 40 m strip (x < -5, z 0..-40).
 *        The right side is automatically the mirror of another variant.
 *   2. (optional) add new block textures with VR.Tex.register(...)
 *   3. That's it — world.js picks it up and rotates it into the run.
 * ===================================================================== */
(function () {
  const L = 40; // chunk length

  // ---------- prop helpers (all take a VoxelBuilder) ------------------
  const P = {
    oak(vb, x, z, h = 4, leaf = 'leaves') {
      vb.addBox(x, 0, z, 1, h, 1, 'log');
      vb.addBox(x, h - 1.5, z, 5, 2, 5, leaf);
      vb.addBox(x, h + 0.5, z, 3, 1.5, 3, leaf);
    },
    birch(vb, x, z, h = 5) {
      vb.addBox(x, 0, z, 0.9, h, 0.9, 'wall');
      vb.addBox(x, h - 2, z, 3.4, 2.4, 3.4, 'leaves');
      vb.addBox(x, h + 0.4, z, 2, 1.2, 2, 'leaves');
    },
    pine(vb, x, z, h = 7, snowy = false) {
      vb.addBox(x, 0, z, 1, h, 1, 'log');
      let w = 5, y = 2;
      while (w >= 1) {
        vb.addBox(x, y, z, w, 1.2, w, 'pine');
        if (snowy) vb.addBox(x, y + 1.2, z, w * 0.8, 0.25, w * 0.8, 'snow');
        y += 1.3; w -= 1.3;
      }
    },
    bush(vb, x, z, s = 1.4) { vb.addBox(x, 0, z, s, s * 0.8, s, 'leaves'); },
    rock(vb, x, z, s = 1.5) { vb.addBox(x, 0, z, s, s * 0.7, s * 0.9, 'cobble'); vb.addBox(x + s * 0.2, s * 0.7, z, s * 0.5, s * 0.4, s * 0.5, 'stone'); },
    flower(vb, x, z, c) { vb.addColorBox(x, 0, z, 0.12, 0.45, 0.12, 0x3c8a2a); vb.addColorBox(x, 0.45, z, 0.32, 0.25, 0.32, c); },
    tuft(vb, x, z) { vb.addColorBox(x, 0, z, 0.5, 0.35, 0.12, 0x4f9e32); vb.addColorBox(x, 0, z, 0.12, 0.45, 0.5, 0x5fae3a); },
    hill(vb, x, z, w, d, h, top, side) {
      for (let i = 0; i < h; i++) {
        const k = 1 - i / (h + 1);
        vb.addBox(x, i, z, w * k, 1, d * k, { top, side, bottom: 'dirt' });
      }
    },
    mountain(vb, x, z, w, h, snowLine) {
      let y = 0, cw = w;
      const step = 2.5;
      while (cw > 2 && y < h) {
        const snow = y >= snowLine;
        vb.addBox(x, y, z, cw, step, cw * 0.9, snow ? { top: 'snow', side: 'snow_side' } : { top: 'stone', side: 'stone' });
        y += step; cw *= 0.8;
      }
    },
    cactus(vb, x, z, h = 3) {
      vb.addBox(x, 0, z, 0.8, h, 0.8, 'cactus');
      if (h > 2.5) { vb.addBox(x + 0.8, 1.2, z, 0.8, 0.6, 0.6, 'cactus'); vb.addBox(x + 1.0, 1.2, z, 0.6, 1.4, 0.6, 'cactus'); }
    },
    deadBush(vb, x, z) { vb.addColorBox(x, 0, z, 0.1, 0.6, 0.1, 0x8a6a3a); vb.addColorBox(x + 0.2, 0.3, z, 0.5, 0.08, 0.08, 0x8a6a3a); },
    dune(vb, x, z, w, d, h) { for (let i = 0; i < h; i++) { const k = 1 - i / (h + 0.5); vb.addBox(x, i * 0.8, z, w * k, 0.8, d * k, 'sand'); } },
    pyramid(vb, x, z, w) { let y = 0; while (w > 1) { vb.addBox(x, y, z, w, 1.5, w, 'sandstone'); y += 1.5; w -= 3; } },
    house(vb, x, z, w = 5, d = 5, h = 3.5, wallMat = 'planks') {
      vb.addBox(x, 0, z, w + 0.4, 0.4, d + 0.4, 'cobble');
      vb.addBox(x, 0.4, z, w, h, d, wallMat);
      for (const cx of [-w / 2, w / 2]) for (const cz of [-d / 2, d / 2]) vb.addBox(x + cx, 0.4, z + cz, 0.6, h, 0.6, 'log');
      // roof (stepped)
      let rw = w + 1.2, ry = h + 0.4;
      while (rw > 0.8) { vb.addBox(x, ry, z, rw, 0.7, d + 1.2, 'roof'); ry += 0.7; rw -= 1.6; }
      // windows / door facing the tracks (+x side for left strip)
      vb.addBox(x + w / 2 + 0.02, 1.6, z - d * 0.25, 0.1, 1, 1, 'glass');
      vb.addBox(x + w / 2 + 0.02, 1.6, z + d * 0.25, 0.1, 1, 1, 'glass');
      vb.addBox(x + w / 2 + 0.02, 0.4, z, 0.1, 2, 1.1, 'log');
    },
    well(vb, x, z) {
      vb.addBox(x, 0, z, 2.4, 1, 2.4, 'cobble'); vb.addBox(x, 1, z, 1.6, 0.05, 1.6, 'water');
      vb.addBox(x - 1, 1, z - 1, 0.3, 2, 0.3, 'log'); vb.addBox(x + 1, 1, z + 1, 0.3, 2, 0.3, 'log');
      vb.addBox(x - 1, 1, z + 1, 0.3, 2, 0.3, 'log'); vb.addBox(x + 1, 1, z - 1, 0.3, 2, 0.3, 'log');
      vb.addBox(x, 3, z, 2.8, 0.5, 2.8, 'roof');
    },
    farm(vb, x, z, w, d) {
      vb.addBox(x, 0, z, w, 0.15, d, 'dirt');
      for (let i = -w / 2 + 0.5; i < w / 2; i += 1) vb.addColorBox(x + i, 0.15, z, 0.35, 0.6, d - 0.4, 0x7fbf3a);
      vb.addBox(x, 0.1, z, 0.9, 0.12, d, 'water');
    },
    fence(vb, x, z0, z1) {
      for (let z = z0; z > z1; z -= 2) vb.addBox(x, 0, z, 0.25, 1.1, 0.25, 'planks');
      vb.addBox(x, 0.7, (z0 + z1) / 2, 0.12, 0.15, Math.abs(z1 - z0), 'planks');
      vb.addBox(x, 0.35, (z0 + z1) / 2, 0.12, 0.15, Math.abs(z1 - z0), 'planks');
    },
    lampPost(vb, x, z) {
      vb.addBox(x, 0, z, 0.3, 3.6, 0.3, 'log');
      vb.addBox(x, 3.6, z, 0.6, 0.6, 0.6, 'lamp');
    },
    iceSpike(vb, x, z, h) { vb.addBox(x, 0, z, 1.2, h, 1.2, 'ice'); vb.addBox(x, h, z, 0.6, h * 0.4, 0.6, 'ice'); },
    mushroom(vb, x, z) { vb.addColorBox(x, 0, z, 0.3, 0.8, 0.3, 0xeee1c8); vb.addColorBox(x, 0.8, z, 1.1, 0.4, 1.1, 0xc9352a); },

    // ---- lemons ------------------------------------------------------
    // a single voxel lemon: body + pointed ends + a tiny leaf
    lemon(vb, x, y, z, s = 1, alongX = false) {
      const L = 0.5 * s, W = 0.38 * s, t = 0.14 * s;
      if (alongX) {
        vb.addBox(x, y, z, L, W, W, 'lemon');
        vb.addBox(x - L / 2 - t / 2, y + W * 0.3, z, t, W * 0.42, W * 0.42, 'lemon');
        vb.addBox(x + L / 2 + t / 2, y + W * 0.3, z, t, W * 0.42, W * 0.42, 'lemon');
      } else {
        vb.addBox(x, y, z, W, W, L, 'lemon');
        vb.addBox(x, y + W * 0.3, z - L / 2 - t / 2, W * 0.42, W * 0.42, t, 'lemon');
        vb.addBox(x, y + W * 0.3, z + L / 2 + t / 2, W * 0.42, W * 0.42, t, 'lemon');
      }
      vb.addColorBox(x, y + W, z, 0.08 * s, 0.12 * s, 0.08 * s, 0x5a3a1e);
      vb.addColorBox(x + 0.1 * s, y + W + 0.06 * s, z, 0.22 * s, 0.05 * s, 0.14 * s, 0x4f9e32);
    },
    // lemon tree: short trunk, round canopy, fruit hanging below the leaves
    lemonTree(vb, x, z, rnd, h = 3.2) {
      vb.addBox(x, 0, z, 0.8, h, 0.8, 'log');
      vb.addBox(x, h - 1, z, 4.2, 1.8, 4.2, 'lemon_leaves');
      vb.addBox(x, h + 0.8, z, 3, 1, 3, 'lemon_leaves');
      vb.addBox(x, h - 1.5, z, 3, 0.5, 3, 'lemon_leaves');
      // big fruit hanging on the outside of the canopy so it reads from the track
      const sides = [[2.25, -0.9, true], [2.25, 1.0, true], [-2.25, 0.2, true], [0.6, 2.25, false], [-1.0, -2.25, false], [1.2, -2.25, false]];
      for (const [dx, dz, ax] of sides) {
        if (rnd() < 0.2) continue;
        P.lemon(vb, x + dx, h - 1.6 + rnd() * 0.9, z + dz, 1.25, !ax);
      }
      if (rnd() < 0.8) P.lemon(vb, x + 1.4 + rnd(), 0, z - 1 + rnd() * 2, 1.1, true);   // fallen lemon
    },
    // wooden crate of lemons (stations, villages, farms)
    lemonCrate(vb, x, z, y = 0, rnd = Math.random) {
      vb.addBox(x, y, z, 1.2, 0.7, 0.9, 'planks');
      vb.addBox(x, y + 0.7, z, 1.1, 0.05, 0.8, 'dark');
      const pos = [[-0.3, -0.2], [0.25, -0.18], [-0.05, 0.2], [0.35, 0.22], [-0.35, 0.18]];
      for (const [dx, dz] of pos) P.lemon(vb, x + dx, y + 0.7, z + dz, 0.75, rnd() < 0.5);
    },
  };

  // scatter n props with minimum spacing in the strip
  function scatter(rnd, n, xMin, xMax, fn, zPad = 1) {
    for (let i = 0; i < n; i++) {
      const x = -(xMin + rnd() * (xMax - xMin));
      const z = -(zPad + rnd() * (L - zPad * 2));
      fn(x, z, i);
    }
  }
  const FLOWERS = [0xf2e14a, 0xe8453c, 0xf4f4f4, 0x6c8ef0, 0xf28bd1];

  VR.BIOMES = {
    grassland: {
      name: 'Grasslands', sky: 0x8fd3ff, fog: 0xb8e4ff,
      ground: { top: 'grass_top', side: 'grass_side' },
      styleWeights: { normal: 10, bridge: 2, tunnel: 1, station: 1.5 },
      scenery(vb, rnd) {
        P.fence(vb, -5.6, -1, -39);
        scatter(rnd, 3, 12, 30, (x, z) => P.oak(vb, x, z, 4 + Math.floor(rnd() * 2)));
        scatter(rnd, 1 + (rnd() < 0.5 ? 1 : 0), 8, 18, (x, z) => P.lemonTree(vb, x, z, rnd, 3 + rnd()), 4);
        scatter(rnd, 3, 7, 28, (x, z) => P.bush(vb, x, z, 1 + rnd()));
        if (rnd() < 0.45) P.lemon(vb, -6.3 - rnd() * 1.5, 0, -4 - rnd() * 32, 1, rnd() < 0.5);
        scatter(rnd, 20, 6.5, 22, (x, z) => (rnd() < 0.5 ? P.flower(vb, x, z, FLOWERS[(rnd() * 5) | 0]) : P.tuft(vb, x, z)));
        if (rnd() < 0.6) P.hill(vb, -30 - rnd() * 8, -20, 12, 16, 3 + Math.floor(rnd() * 3), 'grass_top', 'grass_side');
      },
    },
    forest: {
      name: 'Forest', sky: 0x9fd6c4, fog: 0xb5e0cf,
      ground: { top: 'grass_top', side: 'grass_side' },
      styleWeights: { normal: 10, bridge: 2, tunnel: 1.5, station: 0.5 },
      scenery(vb, rnd) {
        scatter(rnd, 9, 7, 34, (x, z) => (rnd() < 0.35 ? P.birch(vb, x, z, 5 + Math.floor(rnd() * 2)) : P.oak(vb, x, z, 5 + Math.floor(rnd() * 3))));
        scatter(rnd, 3, 14, 36, (x, z) => P.pine(vb, x, z, 9 + Math.floor(rnd() * 4)));
        scatter(rnd, 5, 6.5, 20, (x, z) => P.bush(vb, x, z, 1 + rnd() * 0.8));
        scatter(rnd, 4, 6.5, 18, (x, z) => P.mushroom(vb, x, z));
        if (rnd() < 0.6) P.lemonTree(vb, -8 - rnd() * 6, -6 - rnd() * 28, rnd, 3.4);
        scatter(rnd, 12, 6.5, 20, (x, z) => P.tuft(vb, x, z));
      },
    },
    desert: {
      name: 'Desert', sky: 0xffd9a0, fog: 0xffe6c0,
      ground: { top: 'sand', side: 'sand' },
      styleWeights: { normal: 10, bridge: 0.3, tunnel: 0.8, station: 1 },
      scenery(vb, rnd) {
        scatter(rnd, 5, 7, 26, (x, z) => P.cactus(vb, x, z, 2 + Math.floor(rnd() * 3)));
        scatter(rnd, 6, 6.5, 22, (x, z) => P.deadBush(vb, x, z));
        scatter(rnd, 2, 16, 30, (x, z) => P.dune(vb, x, z, 10, 12, 3 + Math.floor(rnd() * 3)), 6);
        if (rnd() < 0.35) P.pyramid(vb, -36, -20, 16);
        else scatter(rnd, 2, 8, 20, (x, z) => P.rock(vb, x, z, 1.2 + rnd()));
        if (rnd() < 0.4) P.lemonCrate(vb, -7.2, -6 - rnd() * 28, 0, rnd);   // lemon traders pass through
      },
    },
    snow: {
      name: 'Snowfields', sky: 0xcfe4f4, fog: 0xe4eff8,
      ground: { top: 'snow', side: 'snow_side' },
      styleWeights: { normal: 10, bridge: 1.2, tunnel: 2.5, station: 0.7 },
      scenery(vb, rnd) {
        scatter(rnd, 7, 7, 32, (x, z) => P.pine(vb, x, z, 6 + Math.floor(rnd() * 4), true));
        scatter(rnd, 3, 8, 22, (x, z) => P.iceSpike(vb, x, z, 2 + rnd() * 3));
        if (rnd() < 0.7) P.hill(vb, -30, -20, 14, 18, 4, 'snow', 'snow_side');
      },
    },
    village: {
      name: 'Village', sky: 0xa8dcff, fog: 0xc4e7ff,
      ground: { top: 'grass_top', side: 'grass_side' },
      styleWeights: { normal: 10, bridge: 1, tunnel: 0.3, station: 3 },
      scenery(vb, rnd, variant) {
        P.fence(vb, -5.6, -1, -39);
        const zs = [-9, -30];
        P.house(vb, -11 - rnd() * 3, zs[0], 5 + Math.floor(rnd() * 2), 5, 3.2, rnd() < 0.5 ? 'planks' : 'wall');
        if (variant % 2) P.well(vb, -9, zs[1]); else P.house(vb, -12, zs[1], 5, 6, 3.6, 'brick');
        P.farm(vb, -22, -20, 8, 14);
        P.lampPost(vb, -6.5, -20);
        P.lemonCrate(vb, -7.4, zs[0] + 2.2, 0, rnd);
        if (variant % 2 === 0) P.lemonCrate(vb, -7.2, zs[0] - 1.2, 0, rnd);
        // small lemon orchard behind the farm
        P.lemonTree(vb, -30, -12, rnd, 3.2);
        P.lemonTree(vb, -30, -26, rnd, 3.4);
        scatter(rnd, 1, 34, 38, (x, z) => P.oak(vb, x, z, 5));
        scatter(rnd, 10, 6.5, 9, (x, z) => P.flower(vb, x, z, FLOWERS[(rnd() * 5) | 0]));
      },
    },
    mountains: {
      name: 'Mountains', sky: 0xa9c4e8, fog: 0xc6d7ee,
      ground: { top: 'grass_top', side: 'grass_side' },
      styleWeights: { normal: 8, bridge: 2.5, tunnel: 3, station: 0.5 },
      scenery(vb, rnd) {
        P.mountain(vb, -30 - rnd() * 6, -20, 22 + rnd() * 8, 22, 12);
        scatter(rnd, 4, 7, 14, (x, z) => P.pine(vb, x, z, 7 + Math.floor(rnd() * 3)));
        scatter(rnd, 4, 7, 16, (x, z) => P.rock(vb, x, z, 1 + rnd() * 1.5));
        P.hill(vb, -14, -8 - rnd() * 20, 6, 10, 3, 'stone', 'stone');
      },
    },
  };

  // Order biomes rotate in (random start, never the same twice in a row)
  VR.BIOME_ORDER = ['grassland', 'forest', 'village', 'desert', 'mountains', 'snow'];
  VR.BIOME_VARIANTS = 5;   // pre-built scenery strips per biome
  VR.Props = P;
})();
