/* =====================================================================
 * TERRAIN — the run's voxel world, one 40 m SECTION at a time.
 * ---------------------------------------------------------------------
 * A section = movement zones + voxel terrain generated FROM those zones,
 * so what you see is exactly where you can go:
 *
 *   open      wide valley trail, three ways to run, hills/mountains around
 *   canyon    rock walls close in: a single corridor in the middle
 *   pass_l/r  a mountain flank takes one side: two ways to run
 *   ridge_l/r a rock ridge splits the trail: you can't cross it
 *   fork      the trail splits around a mountain: swipe picks the
 *             left or right pass (they rejoin at the end)
 *   tunnel_start / tunnel_end   through a mountain
 *   bridge    a block bridge over a gorge
 *
 * ZONE SPEC (all distances u = metres into the section, 0 … 40)
 *   close:  { lane: [a, b] }    that lane is closed for a ≤ u < b
 *   walls:  { L | R: [a, b] }   a wall between lanes -1|0 (L) or 0|1 (R)
 *   spread: { to, in: [a0,a1], out: [b0,b1] }  outer lanes move out to ±to
 *   sides:  { L, R }            'open' (scenery), 'hills' or 'cliff'
 *
 * TO ADD A SECTION: add an entry to SECTIONS with a zone spec and
 * weight; terrain, swipe rules, funnelling, obstacle placement and the
 * fairness check all follow from the spec. Special shapes (tunnel,
 * bridge) can supply their own build().
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const L = C.CHUNK_LENGTH;
  const LW = C.LANE_WIDTH;
  const HW = 1.8;                         // half width of trail around a lane
  const P = () => VR.Props;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const q = (v) => Math.round(v * 2) / 2;  // half-block grid
  function hash(a, b, c = 0) { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------------------------------------------------------------- zones
  function makeZone(spec) {
    const close = spec.close || {}, walls = spec.walls || {}, spread = spec.spread;
    const closed = (l, u) => { const r = close[l]; return !!r && u >= r[0] && u < r[1]; };
    const width = (u) => {
      if (!spread) return LW;
      const s = u < spread.out[0]
        ? smooth((u - spread.in[0]) / (spread.in[1] - spread.in[0]))
        : 1 - smooth((u - spread.out[0]) / (spread.out[1] - spread.out[0]));
      return LW + (spread.to - LW) * s;
    };
    const inWall = (side, u) => { const r = walls[side]; return !!r && u >= r[0] && u < r[1]; };
    const zone = (u) => {
      const w = width(u);
      const open = [-1, 0, 1].filter(l => !closed(l, u));
      return { open, x: { '-1': -w, 0: 0, 1: w }, wallL: inWall('L', u), wallR: inWall('R', u) };
    };
    // how open a lane looks (terrain funnels in over 4 m before it closes)
    const openness = (l, u) => {
      const r = close[l]; if (!r) return 1;
      if (u < r[0]) return Math.min(1, (r[0] - u) / 4);
      if (u >= r[1]) return Math.min(1, (u - r[1]) / 4);
      return 0;
    };
    /** cell masks for patterns.js (one cell = 1 m) */
    const mask = () => {
      const X = [[], [], []], N = [[], [], []], sep = [[], [], []], wl = [], wr = [];
      const reserved = [];
      for (const l in close) { const a = close[l][0]; for (let z = Math.max(0, a - 8); z < a; z++) reserved[z] = true; }
      if (spread) { for (let z = 0; z < spread.in[1] + 1; z++) reserved[z] = true; for (let z = Math.max(0, spread.out[0] - 1); z < L; z++) reserved[z] = true; }
      for (let z = 0; z < L; z++) {
        const zn0 = zone(z), zn1 = zone(z + 0.999);
        wl[z] = zn0.wallL || zn1.wallL; wr[z] = zn0.wallR || zn1.wallR;
        for (const l of [-1, 0, 1]) {
          const isX = !zn0.open.includes(l) || !zn1.open.includes(l);
          X[l + 1][z] = isX;
          N[l + 1][z] = !!reserved[z];
        }
        const wallBetween = (a) => (a === -1 ? wl[z] : wr[z]);     // wall between lane a and a+1
        for (const l of [-1, 0, 1]) {
          if (X[l + 1][z]) { sep[l + 1][z] = false; continue; }
          const leftBlocked = l === -1 || X[l][z] || wallBetween(l - 1);
          const rightBlocked = l === 1 || X[l + 2][z] || wallBetween(l);
          sep[l + 1][z] = leftBlocked && rightBlocked;      // no way to dodge sideways here
        }
      }
      return { X, N, sep, wallL: wl, wallR: wr };
    };
    return { zone, openness, mask, closed, width };
  }

  // ---------------------------------------------------------------- materials per biome
  function mats(biomeKey) {
    const b = VR.BIOMES[biomeKey];
    const ground = { top: b.ground.top, side: b.ground.side, bottom: 'dirt' };
    const trail = biomeKey === 'desert' ? { top: 'sandstone', side: 'sandstone' } : (biomeKey === 'snow' || biomeKey === 'mountains') ? { top: 'gravel', side: 'gravel' } : { top: 'dirt', side: 'dirt' };
    const rockSide = biomeKey === 'desert' ? 'sandstone' : 'stone';
    const capTop = biomeKey === 'desert' ? 'sand' : biomeKey === 'snow' ? 'snow' : 'grass_top';
    const rock = { top: capTop, side: rockSide, bottom: rockSide };
    const bare = { top: rockSide === 'stone' ? 'cobble' : 'sandstone', side: rockSide };
    return { ground, trail, rock, bare };
  }
  function topProp(vb, biomeKey, x, y, z, r) {
    const p = P();
    // props are built standing on y = 0: lift them onto the cliff top
    const lifted = {
      addBox: (bx, by, bz, ...rest) => vb.addBox(bx, by + y, bz, ...rest),
      addColorBox: (bx, by, bz, ...rest) => vb.addColorBox(bx, by + y, bz, ...rest),
    };
    if (biomeKey === 'desert') p.cactus(lifted, x, z, 2 + Math.floor(r * 2));
    else if (biomeKey === 'snow' || biomeKey === 'mountains') p.pine(lifted, x, z, 5 + Math.floor(r * 3), biomeKey === 'snow');
    else if (r < 0.5) p.oak(lifted, x, z, 4);
    else p.bush(lifted, x, z, 1.4);
  }

  /* ---------------------------------------------------------------
   * Generic builder: sample the section every metre; trails where lanes
   * are open, ridges/mountains between separated corridors, and the
   * section's sides (cliffs, hills or open ground).
   * ------------------------------------------------------------- */
  function buildFromZones(sec, biomeKey, variant) {
    const vb = new VR.VoxelBuilder();
    const m = mats(biomeKey);
    const Z = sec.z, sides = sec.sides || { L: 'open', R: 'open' };
    const ext = 60;
    const groundBox = (x0, x1, u) => { if (x1 - x0 > 0.01) vb.addBox((x0 + x1) / 2, -1, -u - 0.5, x1 - x0, 1, 1, m.ground); };
    const column = (x0, x1, u, h, mat) => { if (x1 - x0 > 0.01 && h > 0.05) vb.addBox((x0 + x1) / 2, -1, -u - 0.5, x1 - x0, h + 1, 1, mat); };
    for (let u = 0; u < L; u++) {
      const uc = u + 0.5;
      const zn = Z.zone(uc);
      // corridor intervals per lane
      const iv = [];
      for (const l of [-1, 0, 1]) {
        const o = Z.openness(l, uc);
        if (o <= 0.001) continue;
        const xl = zn.x[l];
        let c = xl, hw = HW;
        if (l !== 0) c = xl * o + (l === -1 ? 0 : 0) * (1 - o);   // outer lanes slide in toward the centre
        else hw = HW * o;
        iv.push({ l, a: c - hw, b: c + hw });
      }
      // merge neighbours unless a wall separates them
      const groups = [];
      for (const it of iv) {
        const last = groups[groups.length - 1];
        const wall = last && ((last.lastL === -1 && it.l === 0 && zn.wallL) || (last.lastL === 0 && it.l === 1 && zn.wallR));
        if (last && !wall && it.a <= last.b + 0.01) { last.b = Math.max(last.b, it.b); last.lastL = it.l; }
        else groups.push({ a: it.a, b: it.b, lastL: it.l, wallBefore: !!wall });
      }
      // a ridge wall sits halfway between two walled-off lanes; the trails stop at it
      const ridges = [];
      for (let i = 1; i < groups.length; i++) {
        const A = groups[i - 1], B = groups[i];
        if (B.wallBefore && B.a <= A.b + 0.6) {
          const mid = q((A.b + B.a) / 2);
          A.b = mid - 0.4; B.a = mid + 0.4; B.ridge = true;
          ridges.push({ mid, h: 3.4 + (hash(u, 3, variant) < 0.5 ? 0.6 : 0) });
        }
      }
      // trail edges: a little ragged outward (never into a corridor)
      groups[0].a = q(groups[0].a - 0.2 - (hash(u, 1, variant) < 0.35 ? 0.5 : 0));
      const lastG = groups[groups.length - 1];
      lastG.b = q(lastG.b + 0.2 + (hash(u, 2, variant) < 0.35 ? 0.5 : 0));
      for (const g of groups) { if (!g.ridge) g.a = q(g.a); g.b = q(g.b); }
      // trails
      for (const g of groups) vb.addBox((g.a + g.b) / 2, -1, -u - 0.5, g.b - g.a, 1, 1, m.trail);
      for (const r of ridges) vb.addBox(r.mid, -1, -u - 0.5, 0.8, r.h + 1, 1, m.bare);
      // between separated corridors: a mountain filling the gap
      for (let i = 1; i < groups.length; i++) {
        const A = groups[i - 1], B = groups[i];
        if (B.ridge) continue;
        const gap = B.a - A.b;
        if (gap <= 0) continue;
        for (let x = A.b; x < B.a - 0.01; x += 1) {
          const x1 = Math.min(B.a, x + 1), d = Math.min(x - A.b, B.a - x1) + 0.5;
          const h = Math.min(15, 1.5 + d * 2.4 + Math.floor(hash(u >> 1, Math.floor(x), variant) * 3));
          column(x, x1, u, h, d > 3 ? m.rock : m.bare);
        }
      }
      // the two sides
      for (const side of ['L', 'R']) {
        const s = side === 'L' ? -1 : 1;
        const edge = s < 0 ? groups[0].a : groups[groups.length - 1].b;
        const mode = sides[side];
        let x = edge;
        const far = s * ext;
        if (mode === 'cliff') {
          const W = 14;
          for (let i = 0; i < W; i += 2) {
            const x0 = edge + s * i, x1 = edge + s * (i + 2);
            const h = Math.min(16, 4 + i * 0.9 + Math.floor(hash(u >> 1, i, variant + 7) * 3));
            column(Math.min(x0, x1), Math.max(x0, x1), u, h, i < 3 ? m.bare : m.rock);
          }
          x = edge + s * W;
          if (u % 9 === 4 && hash(u, 9, variant) < 0.7) {
            const px = edge + s * (6 + hash(u, 10, variant) * 6);
            const top = Math.min(16, 4 + Math.abs(px - edge) * 0.9) + 1;
            topProp(vb, biomeKey, px, top, -u - 0.5, hash(u, 11, variant));
          }
        } else if (mode === 'hills') {
          const gap = 1.5;
          groundBox(Math.min(edge, edge + s * gap), Math.max(edge, edge + s * gap), u);
          for (let i = 0; i < 8; i += 2) {
            const x0 = edge + s * (gap + i), x1 = edge + s * (gap + i + 2);
            const h = 1 + Math.floor(i / 2) * 0.8 + Math.floor(hash(u >> 2, i, variant + 3) * 2);
            column(Math.min(x0, x1), Math.max(x0, x1), u, h, m.rock);
          }
          x = edge + s * (gap + 8);
        }
        groundBox(Math.min(x, far), Math.max(x, far), u);
      }
    }
    // big mountains in the distance (open valleys)
    if (sec.backdrop && biomeKey !== 'desert') {
      for (const s of [-1, 1]) {
        if (hash(variant, s + 5, biomeKey.length) < 0.35) continue;
        const x = s * (42 + hash(variant, s + 9) * 10);
        P().mountain(vb, x, -20, 26 + hash(variant, s) * 10, 22, biomeKey === 'snow' || biomeKey === 'mountains' ? 10 : 99);
      }
    }
    return vb;
  }

  // ---------------------------------------------------------------- special builders
  function buildTunnel(biomeKey, opts) {
    const vb = new VR.VoxelBuilder();
    const m = mats(biomeKey);
    const W = 4.6, H = 6;
    vb.addBox(0, -1, -L / 2, W * 2, 1, L, m.trail);
    for (const s of [-1, 1]) {
      vb.addBox(s * (W + 0.5), -1, -L / 2, 1, H + 1, L, m.bare);
      for (let z = -5; z > -L; z -= 10) vb.addBox(s * (W - 0.05), 3.2, z, 0.2, 0.6, 0.6, 'lamp');
      vb.addBox(s * (W + 16), -1, -L / 2, 30, H + 2, L, m.rock);
    }
    vb.addBox(0, H - 0.1, -L / 2, W * 2 + 2, 1, L, 'dark');
    for (let i = 0; i < 4; i++) { const w = 60 - i * 12; vb.addBox(0, H + 0.9 + i * 1.5, -L / 2, w, 1.5, L + 0.02, m.rock); }
    const portal = (z) => {
      vb.addBox(0, H - 0.1, z, W * 2 + 3, 1.6, 0.8, 'stone');
      for (const s of [-1, 1]) vb.addBox(s * (W + 0.6), -0.1, z, 1.6, H + 1.6, 0.8, 'stone');
      vb.addBox(0, H + 1.4, z, 3, 0.7, 0.9, 'hazard');
    };
    if (opts.start) portal(-0.4);
    if (opts.end) portal(-L + 0.4);
    return vb;
  }
  function buildBridge(biomeKey, variant) {
    const vb = new VR.VoxelBuilder();
    const m = mats(biomeKey);
    const W = 4.6, D = 9;
    // the two rims of the gorge
    for (const [z0, z1] of [[0, 3], [L - 3, L]]) {
      vb.addBox(0, -1, -(z0 + z1) / 2, W * 2, 1, z1 - z0, m.trail);
      for (const s of [-1, 1]) vb.addBox(s * (W + 28), -D, -(z0 + z1) / 2, 56, D, z1 - z0, m.ground);
      vb.addBox(0, -D, -(z0 + z1) / 2, W * 2, D - 1, z1 - z0, m.bare);
    }
    // gorge walls far to the sides and the river below
    for (const s of [-1, 1]) vb.addBox(s * 45, -D, -L / 2, 30, D + 2 + hash(variant, s) * 4, L - 6, m.rock);
    vb.addBox(0, -D + 1.5, -L / 2, 60, 0.5, L - 6, 'water');
    // deck + railings + piers
    vb.addBox(0, -0.6, -L / 2, W * 2 + 0.4, 0.6, L - 5.8, { top: 'planks', side: 'log' });
    for (const s of [-1, 1]) {
      for (let z = -3.5; z > -L + 3; z -= 3) vb.addBox(s * (W + 0.1), 0, z, 0.3, 1.1, 0.3, 'log');
      vb.addBox(s * (W + 0.1), 0.85, -L / 2, 0.2, 0.2, L - 6, 'log');
    }
    for (const z of [-13, -27]) for (const s of [-1, 1]) vb.addBox(s * (W - 1), -D + 1.5, z, 1.4, D - 2.1, 1.4, m.bare);
    return vb;
  }

  // ---------------------------------------------------------------- sections
  const S = {};
  function section(key, def) {
    def.key = key;
    def.z = makeZone(def);
    def.zone = def.z.zone;
    def.build = def.build || ((biomeKey, variant) => buildFromZones(def, biomeKey, variant));
    S[key] = def;
  }
  section('open', { sides: { L: 'open', R: 'open' }, scenery: true, backdrop: true, gateable: true, weight: () => 5, turn: true, hill: true });
  section('canyon', { close: { '-1': [8, 32], 1: [8, 32] }, sides: { L: 'cliff', R: 'cliff' }, restricted: true, weight: (d, b) => (b === 'mountains' || b === 'desert' ? 1.8 : 1.1) * (0.6 + d), turn: true, hill: true });
  section('pass_l', { close: { '-1': [8, 32] }, sides: { L: 'cliff', R: 'hills' }, restricted: true, weight: (d) => 0.8 + d, turn: true, hill: true });
  section('pass_r', { close: { 1: [8, 32] }, sides: { L: 'hills', R: 'cliff' }, restricted: true, weight: (d) => 0.8 + d, turn: true, hill: true });
  section('ridge_l', { walls: { L: [6, 34] }, sides: { L: 'hills', R: 'hills' }, restricted: true, weight: (d) => 0.6 + d * 0.8, turn: true, hill: false });
  section('ridge_r', { walls: { R: [6, 34] }, sides: { L: 'hills', R: 'hills' }, restricted: true, weight: (d) => 0.6 + d * 0.8, turn: true, hill: false });
  section('fork', { close: { 0: [6, 34] }, spread: { to: 6.5, in: [1, 11], out: [29, 39] }, sides: { L: 'cliff', R: 'cliff' }, restricted: true, weight: (d) => 0.9 + d, turn: false, hill: false });
  section('tunnel_start', { build: (b) => buildTunnel(b, { start: true }), weight: () => 0, turn: true, hill: false });
  section('tunnel_end', { build: (b) => buildTunnel(b, { end: true }), weight: () => 0, turn: true, hill: false });
  section('bridge', { build: (b, v) => buildBridge(b, v), weight: () => 0, turn: false, hill: false });

  VR.SECTIONS = S;
  VR.Terrain = {
    VARIANTS: 2,
    mats,
    /** Pool key + builder for a section's terrain prefab. */
    terrainKey: (sec, biome, variant) => `terr_${sec}_${biome}_${variant}`,
  };
})();
