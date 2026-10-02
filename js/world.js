/* =====================================================================
 * WORLD — endless procedural railway.
 * ---------------------------------------------------------------------
 * The world is a queue of 40 m chunks. Each chunk = track segment
 * (style: normal / station / bridge / tunnel), ground, two scenery
 * strips (biome) and the obstacles + collectibles from patterns.js.
 * Chunks are spawned ahead of the player and recycled behind them.
 * Every model comes from an object pool, so nothing is rebuilt at
 * runtime after the first few seconds.
 *
 *   spawnChunk()      -> decides biome + style, asks Patterns for content
 *   surfaceAt()       -> what the player can stand on (trains, ramps...)
 *   collide()         -> front / side hits for the game rules
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const L = C.CHUNK_LENGTH;
  const LW = C.LANE_WIDTH;
  const TRAIN_ACTIVATE = 72;      // moving trains start rolling when this close
  const TRAIN_SPEED_RATIO = 0.45; // relative to the player's speed

  class World {
    constructor(scene, collectibles) {
      this.scene = scene;
      this.collect = collectibles;
      this.pool = new VR.Pool(scene);
      this.chunks = [];
      this.obstacles = [];
      this.prefabs = {};
      this.definePools();
    }

    prefab(key, buildFn) {
      if (!this.prefabs[key]) this.prefabs[key] = buildFn().build();
      return this.prefabs[key];
    }
    lazyPool(key, buildFn) {
      if (!this.pool.has(key)) this.pool.define(key, () => VR.clonePrefab(this.prefab(key, buildFn)));
    }

    definePools() {
      for (const s in VR.TRACK_STYLES) this.lazyPool('track_' + s, VR.TRACK_STYLES[s]);
      for (const b in VR.BIOMES) {
        const biome = VR.BIOMES[b];
        this.lazyPool('ground_' + b, () => VR.buildGround(biome));
        this.lazyPool('water_' + b, () => VR.buildWater(biome));
        for (let v = 0; v < VR.BIOME_VARIANTS; v++) {
          this.lazyPool(`scen_${b}_${v}`, () => {
            const vb = new VR.VoxelBuilder();
            let seed = (v + 1) * 7919 + b.length * 131;
            const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
            biome.scenery(vb, rnd, v);
            return vb;
          });
        }
      }
      for (const t in VR.OBSTACLE_TYPES) this.lazyPool('obs_' + t, () => VR.OBSTACLE_TYPES[t].build());
      VR.TRAIN_COLORS.forEach((col, ci) => {
        for (const kind in VR.CAR_BUILDERS) this.lazyPool(`car_${kind}_${ci}`, () => VR.CAR_BUILDERS[kind](col));
      });
    }

    // Build all prefabs up-front (called once behind the loading screen)
    warmup() {
      for (const key in this.pool.factories) { const o = this.pool.get(key); this.pool.release(o); }
    }

    /**
     * seed: null for a normal run; a number for a challenge, so both players
     * get exactly the same track, coins and power-ups.
     */
    reset(seed = null) {
      while (this.chunks.length) this.releaseChunk(this.chunks[0]);
      this.seeded = seed !== null && seed !== undefined;
      this.rnd = this.seeded ? VR.seededRandom(seed) : Math.random;
      this.collect.clear();
      this.nextZ = 60;                // one chunk behind the player (visible from the menu camera)
      this.chunkIndex = 0;
      this.biomeOrder = VR.BIOME_ORDER.slice();
      this.biomeIdx = (this.rnd() * this.biomeOrder.length) | 0;
      this.biomeLeft = C.BIOME_MIN_CHUNKS;
      this.styleQueue = [];
      this.sinceSpecial = 0;
      this.gates = [];
      this.nextGateChunk = C.MISSION_GATE_FIRST_CHUNK;
      this.duelGates = [];
      this.nextDuelChunk = 3;
    }

    currentBiomeKey() { return this.biomeOrder[this.biomeIdx % this.biomeOrder.length]; }

    nextStyle(biome, difficulty) {
      if (this.styleQueue.length) return this.styleQueue.shift();
      if (this.chunkIndex < 3 || this.sinceSpecial < 2) { this.sinceSpecial++; return 'normal'; }
      const w = Object.assign({}, biome.styleWeights);
      // "environmental complexity" rises with difficulty
      w.tunnel *= 0.6 + difficulty; w.bridge *= 0.6 + difficulty; w.station *= 0.8 + difficulty * 0.5;
      let r = this.rnd() * (w.normal + w.tunnel + w.bridge + w.station);
      let s = 'normal';
      for (const k of ['normal', 'tunnel', 'bridge', 'station']) { r -= w[k]; if (r <= 0) { s = k; break; } }
      if (s === 'normal') { this.sinceSpecial++; return s; }
      this.sinceSpecial = 0;
      if (s === 'tunnel') { this.styleQueue.push('tunnel_end'); return 'tunnel_start'; }
      if (s === 'bridge' && this.rnd() < 0.5) this.styleQueue.push('bridge');
      return s;
    }

    spawnChunk(difficulty, speed) {
      const idx = this.chunkIndex++;
      if (this.seeded) {
        // challenge: difficulty comes from the chunk's place on the track, not from
        // when it was streamed in (that depends on draw distance and boosts)
        const d = Math.max(0, (idx - 5) * L);
        difficulty = 1 - Math.exp(-d / C.DIFFICULTY_RAMP);
        speed = C.SPEED_START + (C.SPEED_MAX - C.SPEED_START) * (1 - Math.exp(-d / C.SPEED_RAMP));
      }
      // biome rotation (never switch mid-tunnel / mid-bridge)
      if (this.biomeLeft <= 0 && !this.styleQueue.length) {
        this.biomeIdx++;
        this.biomeLeft = C.BIOME_MIN_CHUNKS + ((this.rnd() * (C.BIOME_MAX_CHUNKS - C.BIOME_MIN_CHUNKS)) | 0);
      }
      this.biomeLeft--;
      const biomeKey = this.currentBiomeKey();
      const biome = VR.BIOMES[biomeKey];
      const style = this.nextStyle(biome, difficulty);
      const z0 = this.nextZ;
      this.nextZ -= L;

      const chunk = { id: idx, z0, style, biome: biomeKey, parts: [], obstacles: [] };
      const put = (key, x = 0, flip = false) => {
        const o = this.pool.get(key);
        o.position.set(x, 0, z0);
        if (flip) o.scale.x = -1;
        chunk.parts.push(o);
        return o;
      };

      put('track_' + style);
      const isTunnel = style.startsWith('tunnel');
      if (style === 'bridge') put('water_' + biomeKey);
      else if (!isTunnel) {
        put('ground_' + biomeKey);
        const off = style === 'station' ? -6 : 0;
        const v1 = (this.rnd() * VR.BIOME_VARIANTS) | 0;
        let v2 = (this.rnd() * VR.BIOME_VARIANTS) | 0; if (v2 === v1) v2 = (v2 + 1) % VR.BIOME_VARIANTS;
        put(`scen_${biomeKey}_${v1}`, off);
        put(`scen_${biomeKey}_${v2}`, -off, true);
      }

      // ---- content
      const safe = idx < C.SAFE_START_CHUNKS + 2;
      const plan = VR.Patterns.generate({
        rnd: this.rnd, difficulty, speed, safe, style,
        powerupChance: 0.16 + difficulty * 0.08,
      });
      chunk.pattern = plan.patternName;

      for (const o of plan.obstacles) {
        const def = VR.OBSTACLE_TYPES[o.type];
        const obj = this.pool.get('obs_' + o.type);
        const x = o.lane * LW, z = z0 - o.z;
        obj.position.set(x, 0, z);
        this.addObstacle(chunk, { type: o.type, kind: def.kind, lane: o.lane, x, z, len: def.length, colliders: def.colliders, standable: def.standable, ramp: def.kind === 'ramp', parts: [obj] });
      }
      for (const t of plan.trains) this.spawnTrain(chunk, t, z0);

      for (const c of plan.coins) this.collect.spawnCoin(c.x * LW, c.y, z0 - c.z, idx);
      for (const c of plan.gems) this.collect.spawnGem(c.x * LW, c.y, z0 - c.z, idx);
      for (const p of plan.powerups) this.collect.spawnPowerUp(p.type, p.x * LW, p.y, z0 - p.z, idx);
      this.maybeSpawnGate(chunk, plan, style, z0);
      this.maybeSpawnDuelGate(chunk, style, z0);

      this.chunks.push(chunk);
      return chunk;
    }

    spawnTrain(chunk, t, z0) {
      const x = t.lane * LW;
      const front = z0 - t.z;
      const parts = [];
      t.cars.forEach((car, i) => {
        const o = this.pool.get(`car_${car.kind}_${car.color}`);
        o.position.set(x, 0, front - i * VR.CAR_LEN);
        parts.push(o);
      });
      const len = t.cars.length * VR.CAR_LEN;
      this.addObstacle(chunk, {
        type: 'train', kind: 'block', lane: t.lane, x, z: front, len,
        colliders: [{ x0: -1.12, x1: 1.12, y0: 0, y1: VR.TRAIN_HEIGHT, z0: -len + 0.15, z1: 0 }],
        standable: !t.moving, parts,
        moving: t.moving ? { active: false, v: 0 } : null,
      });
      if (t.ramp) {
        const ro = this.pool.get('obs_ramp');
        const rz = z0 - t.rampZ;
        ro.position.set(x, 0, rz);
        this.addObstacle(chunk, { type: 'ramp', kind: 'ramp', lane: t.lane, x, z: rz, len: 7, colliders: [], standable: true, ramp: true, parts: [ro] });
      }
    }

    /* ---------------------------------------------------------------
     * Mission gates: an arch with a glowing lemon curtain, standing in
     * one lane. Only placed in a lane whose track is clear for 24 m,
     * so running through it is always safe; the run resumes from here.
     * ------------------------------------------------------------- */
    maybeSpawnGate(chunk, plan, style, z0) {
      chunk.gates = [];
      if (!this.gateProvider || chunk.id < this.nextGateChunk) return;
      if (style !== 'normal' && style !== 'station') return;
      const lanes = [-1, 0, 1].filter(l => { for (let z = 8; z <= 32; z++) if (plan.grid[l + 1][z] !== 'F') return false; return true; });
      if (!lanes.length) { this.nextGateChunk = chunk.id + 1; return; }
      const def = this.gateProvider();
      if (!def) { this.nextGateChunk = chunk.id + 4; return; }
      const lane = lanes.includes(0) && Math.random() < 0.5 ? 0 : lanes[(Math.random() * lanes.length) | 0];
      const obj = this.gateObject(def);
      const x = lane * LW, z = z0 - 22;
      obj.position.set(x, 0, z);
      const gate = { lane, x, z, missionId: def.id, parts: [obj], used: false, announced: false, chunk: chunk.id };
      chunk.gates.push(gate); this.gates.push(gate);
      // a short coin line leads into the gate
      for (let zl = 10; zl <= 20; zl += 2) {
        if (!plan.coins.some(c => c.x === lane && Math.abs(c.z - zl) < 1.2)) this.collect.spawnCoin(x, 0.9, z0 - zl, chunk.id);
      }
      this.nextGateChunk = chunk.id + C.MISSION_GATE_GAP_MIN + ((Math.random() * (C.MISSION_GATE_GAP_MAX - C.MISSION_GATE_GAP_MIN + 1)) | 0);
    }
    /* 1v1 gate: on a platform beside the track (never in a lane), so it
     * never changes the run itself; only its prompt starts a challenge.
     * Uses Math.random so a seeded challenge track stays identical. */
    maybeSpawnDuelGate(chunk, style, z0) {
      chunk.duelGates = [];
      if (!this.duelGateProvider || chunk.id < this.nextDuelChunk || style !== 'normal') return;
      if (!this.duelGateProvider()) { this.nextDuelChunk = chunk.id + 2; return; }
      const side = Math.random() < 0.5 ? -1 : 1;
      const key = 'duelgate_' + VR.lang;
      if (!this.pool.has(key)) this.pool.define(key, () => VR.buildDuelGate());
      const obj = this.pool.get(key);
      const x = side * 6.9, z = z0 - 20;
      obj.position.set(x, 0, z);
      const gate = { x, z, side, parts: [obj], chunk: chunk.id };
      chunk.duelGates.push(gate); this.duelGates.push(gate);
      this.nextDuelChunk = chunk.id + 7 + ((Math.random() * 5) | 0);
    }
    gateObject(def) {
      const key = 'gate_' + def.id + '_' + VR.lang;            // the sign is drawn in the current language
      if (!this.pool.has(key)) this.pool.define(key, () => VR.buildMissionGate(def));
      return this.pool.get(key);
    }
    /** Language changed: swap every gate on the track for one with the new sign. */
    relabelGates() {
      for (const g of this.duelGates || []) {
        const old = g.parts[0]; const pos = old.position.clone();
        this.pool.release(old);
        const key = 'duelgate_' + VR.lang;
        if (!this.pool.has(key)) this.pool.define(key, () => VR.buildDuelGate());
        const obj = this.pool.get(key); obj.position.copy(pos); g.parts[0] = obj;
      }
      for (const g of this.gates) {
        const def = VR.MISSIONS.find(d => d.id === g.missionId); if (!def) continue;
        const old = g.parts[0]; const pos = old.position.clone();
        this.pool.release(old);
        const obj = this.gateObject(def); obj.position.copy(pos);
        g.parts[0] = obj;
      }
    }
    animateGates(dt) {
      if (VR.gateCurtainMat) {
        const m = VR.gateCurtainMat; m.map.offset.y -= dt * 0.35; m.opacity = 0.78 + Math.sin(performance.now() * 0.004) * 0.08;
      }
      for (const g of this.gates) { const sp = g.parts[0].userData.spinner; if (sp) sp.rotation.y += dt * 1.6; }
      if (this.duelGates && this.duelGates.length) {
        const m = VR.duelGateCurtain(); m.map.offset.y += dt * 0.5;
        for (const g of this.duelGates) { const sp = g.parts[0].userData.spinner; if (sp) sp.rotation.y += dt * 1.2; }
      }
    }

    addObstacle(chunk, o) { o.chunk = chunk.id; chunk.obstacles.push(o); this.obstacles.push(o); }

    releaseChunk(chunk) {
      for (const p of chunk.parts) this.pool.release(p);
      for (const o of chunk.obstacles) for (const p of o.parts) this.pool.release(p);
      const set = new Set(chunk.obstacles);
      this.obstacles = this.obstacles.filter(o => !set.has(o));
      this.collect.releaseChunk(chunk.id);
      for (const g of chunk.gates || []) { for (const p of g.parts) this.pool.release(p); }
      if (chunk.gates && chunk.gates.length) this.gates = this.gates.filter(g => !chunk.gates.includes(g));
      for (const g of chunk.duelGates || []) { for (const p of g.parts) this.pool.release(p); }
      if (chunk.duelGates && chunk.duelGates.length) this.duelGates = this.duelGates.filter(g => !chunk.duelGates.includes(g));
      this.chunks.splice(this.chunks.indexOf(chunk), 1);
    }

    update(dt, player, speed, difficulty, game, keepBehind = false) {
      // stream chunks
      while (this.nextZ > player.z - C.CHUNKS_AHEAD * L) this.spawnChunk(difficulty, speed);
      while (!keepBehind && this.chunks.length && this.chunks[0].z0 - L > player.z + 14) this.releaseChunk(this.chunks[0]);

      // moving trains
      for (const o of this.obstacles) {
        if (!o.moving) continue;
        if (!o.moving.active && o.z - player.z > -TRAIN_ACTIVATE && o.z < player.z + 4) {
          o.moving.active = true; o.moving.v = Math.max(speed * TRAIN_SPEED_RATIO, 7);
          game.onTrainApproach(o);
        }
        if (o.moving.active) {
          const dz = o.moving.v * dt;
          o.z += dz;
          for (const p of o.parts) p.position.z += dz;
        }
      }
    }

    // shift everything back toward the origin (float precision on long runs)
    shift(dz) {
      this.nextZ += dz;
      for (const c of this.chunks) { c.z0 += dz; for (const p of c.parts) p.position.z += dz; }
      for (const o of this.obstacles) { o.z += dz; for (const p of o.parts) p.position.z += dz; }
      for (const g of this.gates) { g.z += dz; for (const p of g.parts) p.position.z += dz; }
      for (const g of this.duelGates) { g.z += dz; for (const p of g.parts) p.position.z += dz; }
      this.collect.shift(dz);
    }

    chunkAt(z) { for (const c of this.chunks) if (z <= c.z0 && z > c.z0 - L) return c; return null; }

    /**
     * Highest walkable surface under the player.
     * Only surfaces at/below the feet (with a small tolerance) count, so
     * running into the side of a train is a collision, not a teleport up.
     */
    surfaceAt(x, z, y, hw) {
      let best = 0, obj = null;
      for (const o of this.obstacles) {
        if (z > o.z + 1 || z < o.z - o.len - 1) continue;
        if (o.ramp) {
          if (Math.abs(x - o.x) < 1.05 && z <= o.z && z >= o.z - o.len) {
            const h = VR.TRAIN_HEIGHT * (o.z - z) / o.len;
            if (h <= y + 0.9 && h > best) { best = h; obj = o; }
          }
          continue;
        }
        if (!o.standable) continue;
        for (const c of o.colliders) {
          if (x + hw <= o.x + c.x0 || x - hw >= o.x + c.x1) continue;
          if (z < o.z + c.z0 - 0.25 || z > o.z + c.z1 + 0.25) continue;
          if (c.y1 <= y + 0.3 && c.y1 > best) { best = c.y1; obj = o; }
        }
      }
      return { h: best, obj };
    }

    /**
     * Returns null, or {side: bool, obstacle} for the first hit.
     * side = the overlap was caused by a lane change (-> stumble + bounce).
     */
    collide(p) {
      const hw = C.PLAYER_HALF_WIDTH, hd = C.PLAYER_HALF_DEPTH;
      const px0 = p.x - hw, px1 = p.x + hw, py0 = p.y + 0.05, py1 = p.y + p.height, pz0 = p.z - hd, pz1 = p.z + hd;
      const prevX = p.prevX === undefined ? p.x : p.prevX;
      for (const o of this.obstacles) {
        if (p.z > o.z + 2 || p.z < o.z - o.len - 2) continue;
        if (o.ramp) {
          if (px1 > o.x - 1.05 && px0 < o.x + 1.05 && pz0 < o.z && pz1 > o.z - o.len) {
            const h = VR.TRAIN_HEIGHT * Math.min(1, Math.max(0, (o.z - p.z) / o.len));
            if (p.y < h - 0.9) return { side: true, obstacle: o };
          }
          continue;
        }
        for (const c of o.colliders) {
          const bx0 = o.x + c.x0, bx1 = o.x + c.x1, bz0 = o.z + c.z0, bz1 = o.z + c.z1;
          if (px1 <= bx0 || px0 >= bx1 || pz1 <= bz0 || pz0 >= bz1 || py1 <= c.y0 || py0 >= c.y1) continue;
          if (o.standable && c.y1 - p.y <= 0.3) continue;       // standing on it
          const wasOverlappingX = prevX + hw > bx0 && prevX - hw < bx1;
          const side = !wasOverlappingX || (Math.abs(p.lateralVel || 0) > 1 && p.z < bz1 - 0.6);
          return { side, obstacle: o };
        }
      }
      return null;
    }

    // obstacle destroyed by shield/star: remove it from play
    smash(o) {
      for (const p of o.parts) this.pool.release(p);
      o.parts.length = 0;
      o.colliders = []; o.standable = false; o.ramp = false; o.moving = null;
      const chunk = this.chunks.find(c => c.id === o.chunk);
      this.obstacles = this.obstacles.filter(x => x !== o);
      if (chunk) chunk.obstacles = chunk.obstacles.filter(x => x !== o);
    }
  }

  /** Small deterministic PRNG (mulberry32). */
  VR.seededRandom = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  VR.World = World;
})();
