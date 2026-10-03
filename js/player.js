/* =====================================================================
 * PLAYER CONTROLLER
 * Movement zones (lanes the terrain allows), smooth switching, jump,
 * slide, fast-fall, stumble and the procedural run / jump / slide
 * animation of the voxel rig. The player lives in path space; the track
 * puts the model into the winding world (VR.track.place).
 * Collision response is driven from game.js (see Game.resolveCollisions).
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;

  class Player {
    constructor(scene) {
      this.scene = scene;
      this.object = new THREE.Group();
      scene.add(this.object);

      // soft square "blob" shadow — cheaper than real shadows
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
      );
      sh.rotation.order = 'YXZ';
      this.shadow = sh; scene.add(sh);

      // shield bubble
      const sg = new THREE.BoxGeometry(1.5, 2.2, 1.5);
      this.shieldMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.22, depthWrite: false }));
      this.shieldEdges = new THREE.LineSegments(new THREE.EdgesGeometry(sg), new THREE.LineBasicMaterial({ color: 0xbff0ff }));
      this.shieldMesh.add(this.shieldEdges);
      this.shieldMesh.position.y = 1.0;
      this.shieldMesh.visible = false;
      this.object.add(this.shieldMesh);

      this.rig = null;
      this.reset();
    }

    setCharacter(def) {
      if (this.rig) this.object.remove(this.rig.root);
      this.rig = VR.buildCharacter(def);
      this.object.add(this.rig.root);
    }

    reset() {
      this.lane = 0; this.prevLane = 0; this.lastSide = 1;
      this.offset = 0;             // x relative to the current lane's centre (eases to 0)
      this.x = 0; this.y = 0; this.z = 0;
      this.vy = 0;
      this.grounded = true;
      this.slideTimer = 0;
      this.pendingSlide = false;
      this.runPhase = 0;
      this.lastStumble = -99;
      this.stumbleAnim = 0;
      this.landSquash = 0;
      this.dead = false;
      this.deathTimer = 0;
      this.onTopOf = null;
      this.stepAcc = 0;
      this.flash = 0;
      this.object.position.set(0, 0, 0);
      this.object.rotation.set(0, 0, 0);
      if (this.rig) { this.rig.inner.rotation.set(0, 0, 0); this.rig.inner.position.set(0, 0, 0); this.rig.root.visible = true; }
    }

    get sliding() { return this.slideTimer > 0; }
    get height() { return this.sliding ? C.PLAYER_SLIDE_HEIGHT : C.PLAYER_HEIGHT; }
    laneX(l) { return VR.track ? VR.track.laneX(this.z, l) : l * C.LANE_WIDTH; }
    /** change lane, keeping the body where it is (it then slides over) */
    setLane(nl) {
      if (nl === this.lane) return;
      this.prevLane = this.lane; this.lane = nl;
      this.offset = this.x - this.laneX(nl);
    }

    action(a, game) {
      if (this.dead) return;
      switch (a) {
        case 'left':
        case 'right': {
          const nl = this.lane + (a === 'left' ? -1 : 1);
          this.lastSide = a === 'left' ? -1 : 1;           // also picks the side of a fork
          // mountains and rock walls: the swipe is refused (no passing through terrain)
          if (nl < -1 || nl > 1 || !game.world.canSwitch(this, this.lane, nl)) { game.onWallBump(); return; }
          this.setLane(nl);
          VR.Audio.play('lane');
          break;
        }
        case 'jump':
          if (this.grounded) {
            this.vy = C.JUMP_VELOCITY; this.grounded = false; this.slideTimer = 0;
            VR.Audio.play('jump');
          }
          break;
        case 'slide':
          if (this.grounded) { this.slideTimer = C.SLIDE_TIME; VR.Audio.play('slide'); }
          else { this.vy = Math.min(this.vy, C.FAST_FALL_VELOCITY); this.pendingSlide = true; }
          break;
      }
    }

    // bounce back after a side hit
    bounceBack() {
      if (!VR.track || VR.track.isOpen(this.z, this.prevLane)) this.setLane(this.prevLane);
      this.stumbleAnim = 0.45;
    }

    update(dt, speed, world, game) {
      if (this.dead) { this.animateDeath(dt); return; }

      // forward
      this.z -= speed * dt;

      // the terrain narrows ahead -> funnel into a lane that stays open
      world.guide(this);
      // lateral: follow the lane (which itself moves where the terrain widens or
      // splits); a lane change is a constant-speed slide of the offset (crisp)
      const maxStep = (C.LANE_WIDTH / C.LANE_SWITCH_TIME) * dt;
      const o0 = this.offset;
      this.offset -= Math.abs(this.offset) < maxStep ? this.offset : Math.sign(this.offset) * maxStep;
      this.prevX = this.x;
      this.x = this.laneX(this.lane) + this.offset;
      this.lateralVel = (this.offset - o0) / Math.max(dt, 1e-4);

      // vertical
      this.vy -= C.GRAVITY * dt;
      const newY = this.y + this.vy * dt;
      const ground = world.surfaceAt(this.x, this.z, Math.max(this.y, newY), C.PLAYER_HALF_WIDTH);
      if (newY <= ground.h) {
        const wasAir = !this.grounded;
        this.y = ground.h;
        if (this.vy < -2 && wasAir) this.onLand(game);
        this.vy = 0; this.grounded = true;
        this.onTopOf = ground.obj;
      } else {
        this.y = newY;
        // walked off an edge?
        if (this.grounded && newY > ground.h + 0.05 && this.vy <= 0) this.grounded = false;
        if (this.vy > 0) this.grounded = false;
      }

      if (this.slideTimer > 0) this.slideTimer -= dt;

      // footstep sounds
      if (this.grounded && !this.sliding) {
        this.stepAcc += dt * speed;
        if (this.stepAcc > 3.2) { this.stepAcc = 0; VR.Audio.play('step'); }
      }

      this.animate(dt, speed);
    }

    onLand(game) {
      VR.Audio.play('land');
      this.landSquash = 1;
      game.cameraImpulse(-0.18);
      if (this.pendingSlide) { this.slideTimer = C.SLIDE_TIME; this.pendingSlide = false; VR.Audio.play('slide'); }
    }

    animate(dt, speed) {
      const r = this.rig; if (!r) return;
      const p = r.parts;
      this.place();

      this.runPhase += dt * (6 + speed * 0.42);
      const s = Math.sin(this.runPhase);
      const k = 1 - Math.exp(-dt * 18);  // smoothing factor

      let legL = 0, legR = 0, armL = 0, armR = 0, lean = 0, bob = 0, innerY = 0;
      if (this.sliding) {
        lean = 1.25; legL = -1.3; legR = -1.1; armL = -2.4; armR = -2.2; innerY = 0.1;
      } else if (!this.grounded) {
        const t = THREE.MathUtils.clamp(this.vy / C.JUMP_VELOCITY, -1, 1);
        legL = -0.9 + t * 0.3; legR = 0.6; armL = -2.6; armR = -2.4 - t * 0.2; lean = -0.12;
      } else {
        legL = s * 1.0; legR = -s * 1.0; armL = -s * 0.95; armR = s * 0.95;
        bob = Math.abs(Math.cos(this.runPhase)) * 0.09; lean = -0.14;
      }
      if (this.stumbleAnim > 0) { this.stumbleAnim -= dt; lean += Math.sin(this.stumbleAnim * 30) * 0.25; }

      p.legL.rotation.x += (legL - p.legL.rotation.x) * k;
      p.legR.rotation.x += (legR - p.legR.rotation.x) * k;
      p.armL.rotation.x += (armL - p.armL.rotation.x) * k;
      p.armR.rotation.x += (armR - p.armR.rotation.x) * k;
      p.armL.rotation.z = -0.12; p.armR.rotation.z = 0.12;
      r.inner.rotation.x += (lean - r.inner.rotation.x) * k;
      r.inner.position.y += (bob + innerY - r.inner.position.y) * k;
      // lean into lane changes
      const tilt = THREE.MathUtils.clamp(-this.lateralVel * 0.018, -0.35, 0.35);
      r.inner.rotation.z += (tilt - r.inner.rotation.z) * k;
      p.head.rotation.y = tilt * 0.8;

      // landing squash
      if (this.landSquash > 0) {
        this.landSquash = Math.max(0, this.landSquash - dt * 6);
        const q = Math.sin(this.landSquash * Math.PI) * 0.12;
        r.root.scale.set(1 + q, 1 - q, 1 + q);
      } else r.root.scale.set(1, 1, 1);

      // blink when invincible / just hit
      if (this.flash > 0) {
        this.flash -= dt;
        r.root.visible = Math.floor(this.flash * 16) % 2 === 0 || this.flash <= 0;
      } else r.root.visible = true;

      this.shieldMesh.rotation.y += dt * 1.5;
      this.shieldMesh.scale.setScalar(1 + Math.sin(this.runPhase * 0.5) * 0.03);
    }

    updateShadow(world) {
      const g = world.surfaceAt(this.x, this.z, this.y + 0.01, C.PLAYER_HALF_WIDTH).h;
      VR.track.toWorld(this.x, g + 0.04, this.z, this.shadow.position);
      this.shadow.rotation.set(-Math.PI / 2, -VR.track.heading(this.z), 0);
      const hgt = Math.max(0, this.y - g);
      const sc = Math.max(0.35, 1 - hgt * 0.2);
      this.shadow.scale.set(sc * 1.05, sc * 0.9, 1);
      this.shadow.material.opacity = 0.3 * sc;
    }

    // bring the player back after a secret-code continue
    revive(d) {
      this.dead = false; this.deathTimer = 0;
      this.x = d.x; this.y = d.y; this.z = d.z;
      this.lane = d.lane; this.prevLane = d.lane; this.prevX = d.x; this.offset = 0;
      if (VR.track && !VR.track.isOpen(this.z, this.lane)) this.lane = VR.track.zoneAt(this.z).open[0];
      this.offset = this.x - this.laneX(this.lane);
      this.vy = 0; this.grounded = false; this.slideTimer = 0; this.pendingSlide = false;
      this.lastStumble = -99; this.stumbleAnim = 0;
      this.flash = 1.5;
      const r = this.rig;
      r.inner.rotation.set(0, 0, 0); r.inner.position.set(0, 0, 0);
      for (const k in r.parts) r.parts[k].rotation.set(0, 0, 0);
      this.place();
    }

    /** put the model into the world at the path position, facing along the run */
    place() {
      if (VR.track) VR.track.place(this.object, this.x, this.y, this.z);
      else { this.object.position.set(this.x, this.y, this.z); this.object.rotation.set(0, 0, 0); }
    }

    die() {
      this.dead = true; this.deathTimer = 0;
      this.deathVy = 6;
    }
    animateDeath(dt) {
      this.deathTimer += dt;
      const r = this.rig;
      // knocked backwards, then flop
      this.deathVy -= 30 * dt;
      this.y = Math.max(this.groundAtDeath || 0, this.y + this.deathVy * dt);
      this.z += dt * Math.max(0, 5 - this.deathTimer * 8);
      this.place();
      r.inner.rotation.x += (1.45 - r.inner.rotation.x) * Math.min(1, dt * 8);
      r.parts.armL.rotation.x = -2.8; r.parts.armR.rotation.x = -2.6;
      r.parts.legL.rotation.x = -0.4; r.parts.legR.rotation.x = 0.3;
    }
  }

  VR.Player = Player;
})();
