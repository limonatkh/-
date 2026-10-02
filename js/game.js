/* =====================================================================
 * GAME — state machine, main loop, camera, scoring, rules.
 * States: loading -> menu <-> character/settings -> playing <-> paused
 *         -> gameover -> (playing | menu)
 *
 * SCORE is computed in Game.updateScore() and Game.onCoin().
 * SPEED / DIFFICULTY are computed in Game.speedAt() / Game.difficultyAt()
 * from the numbers in config.js.
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const UI = VR.UI;

  class Game {
    constructor() {
      this.state = 'loading';
      this.settings = Object.assign({ sfx: true, music: true, quality: 'high', fps: false }, UI.store.get('settings', {}));
      this.best = UI.store.get('best', 0);
      this.bank = UI.store.get('bank', 0);
      this.charIndex = Math.max(0, VR.CHARACTERS.findIndex(c => c.id === UI.store.get('character', 'pip')));

      this.initRenderer();
      this.powerups = new VR.PowerUpState();
      this.collect = new VR.Collectibles(this.scene);
      this.world = new VR.World(this.scene, this.collect);
      this.player = new VR.Player(this.scene);
      this.player.setCharacter(VR.CHARACTERS[this.charIndex]);
      // mission mode (first-person) lives in its own scene, driven by this loop
      this.missions = new VR.MissionManager(this);
      // no mission gates in a challenge: both players must run the same track
      this.world.gateProvider = () => (this.challenge && this.challenge.inRace ? null : this.missions.nextForGate());
      this.challenge = new VR.Challenge(this);
      this.fade = { value: 0, target: 0, speed: 3 };
      this.fadeEl = document.getElementById('fade');
      this.countdownEl = document.getElementById('countdown');
      this.bindUI();
      this.applySettings();

      this.clock = new THREE.Clock();
      this.fpsAcc = 0; this.fpsFrames = 0;
      this.shake = 0; this.camBump = 0; this.camBumpV = 0;
      this.menuTime = 0;
    }

    // ------------------------------------------------------------ setup
    initRenderer() {
      const holder = document.getElementById('game');
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      holder.appendChild(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.skyColor = new THREE.Color(0x8fd3ff);
      this.fogColor = new THREE.Color(0xb8e4ff);
      this.scene.background = this.skyColor.clone();
      this.scene.fog = new THREE.Fog(this.fogColor.clone(), 70, 200);

      this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.9);
      this.sun = new THREE.DirectionalLight(0xfff2d6, 2.1);
      this.sun.position.set(-0.6, 1, 0.45);
      this.scene.add(this.hemi, this.sun);

      this.camera = new THREE.PerspectiveCamera(C.CAMERA_FOV, 1, 0.3, 260);
      this.camTarget = new THREE.Vector3();
      this.camLook = new THREE.Vector3();
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      const hq = this.settings.quality === 'high';
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hq ? 2 : 1));
      if (!hq && (window.devicePixelRatio || 1) > 1.5) this.renderer.setPixelRatio(0.85);
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      // portrait phones: widen the view so all three lanes stay visible
      this.portrait = w / h < 0.8;
      this.camera.fov = this.portrait ? 70 : C.CAMERA_FOV;
      this.camera.updateProjectionMatrix();
      if (this.missions) this.missions.resize(w, h);
    }

    applySettings() {
      const s = this.settings;
      VR.Audio.setEnabled('sfx', s.sfx);
      VR.Audio.setEnabled('music', s.music);
      C.CHUNKS_AHEAD = s.quality === 'high' ? 6 : 4;
      this.scene.fog.far = s.quality === 'high' ? 200 : 140;
      this.scene.fog.near = s.quality === 'high' ? 70 : 45;
      this.camera.far = this.scene.fog.far + 20; this.camera.updateProjectionMatrix();
      UI.setToggle('optSfx', s.sfx);
      UI.setToggle('optMusic', s.music);
      UI.setToggle('optQuality', s.quality === 'high', VR.t('high'), VR.t('low'));
      UI.setToggle('optFps', s.fps);
      const lb = document.getElementById('optLang');
      lb.textContent = VR.I18N.NAMES[VR.lang]; lb.lang = VR.lang;
      UI.fps(s.fps);
      this.resize();
      UI.store.set('settings', s);
    }

    bindUI() {
      UI.bind('playBtn', () => this.start());
      UI.bind('againBtn', () => this.start());
      UI.bind('charBtn', () => this.setState('character'));
      UI.bind('charPrev', () => this.cycleChar(-1));
      UI.bind('charNext', () => this.cycleChar(1));
      UI.bind('charDone', () => { UI.store.set('character', VR.CHARACTERS[this.charIndex].id); this.setState('menu'); });
      UI.bind('settingsBtn', () => { this.settingsReturn = 'menu'; this.setState('settings'); });
      UI.bind('pauseSettings', () => { this.settingsReturn = 'paused'; this.setState('settings'); });
      UI.bind('settingsDone', () => this.setState(this.settingsReturn || 'menu'));
      UI.bind('pauseBtn', () => this.pause());
      UI.bind('resumeBtn', () => this.resume());
      UI.bind('pauseMenu', () => this.toMenu());
      UI.bind('goMenu', () => this.toMenu());
      // Esc on the challenge screens goes back
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.state === 'challenge') this.challenge.leave(true); });
      // secret-code continue
      UI.bind('codeBtn', () => UI.openCodeForm());
      document.getElementById('codeInput').addEventListener('input', () => {
        const m = document.getElementById('codeMsg'); m.textContent = ''; m.className = 'code-msg';
      });
      document.getElementById('codeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        VR.Audio.unlock();
        const result = this.tryContinue(document.getElementById('codeInput').value);
        UI.codeResult(result);
      });
      UI.bind('optSfx', () => { this.settings.sfx = !this.settings.sfx; this.applySettings(); });
      UI.bind('optMusic', () => {
        this.settings.music = !this.settings.music; this.applySettings();
        if (this.settings.music) VR.Audio.startMusic(); else VR.Audio.stopMusic();
      });
      UI.bind('optQuality', () => { this.settings.quality = this.settings.quality === 'high' ? 'low' : 'high'; this.applySettings(); });
      UI.bind('optFps', () => { this.settings.fps = !this.settings.fps; this.applySettings(); });
      UI.bind('optLang', () => { VR.I18N.toggle(); });
      VR.I18N.onChange((lang, fontsReady) => {
        this.settings.lang = lang;
        this.applySettings();
        UI.menuStats(this.best, this.bank);
        UI.setHUD(this.score || 0, this.distance || 0, this.coins || 0, this.multiplier || 1);
        UI.character(VR.CHARACTERS[this.charIndex]);
        if (fontsReady) this.world.relabelGates();
      });
      VR.Input.onPause(() => {
        if (this.state === 'mission') this.missions.onPauseKey();
        else if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume();
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) return;
        if (this.state === 'playing') this.pause();
        else if (this.state === 'mission') this.missions.pause();
      });
    }

    cycleChar(d) {
      const n = VR.CHARACTERS.length;
      this.charIndex = (this.charIndex + d + n) % n;
      const def = VR.CHARACTERS[this.charIndex];
      this.player.setCharacter(def);
      UI.character(def);
    }

    // ------------------------------------------------------------ states
    setState(s) {
      this.state = s;
      const map = { menu: 'menu', character: 'character', settings: 'settings', paused: 'pause', gameover: 'gameover', playing: null, loading: 'loading', challenge: 'challenge', chresult: 'chresult' };
      UI.show(map[s]);
      UI.hud(s === 'playing' || s === 'paused' || s === 'dying' || s === 'gateEnter' || s === 'countdown');
      VR.Input.setEnabled(s === 'playing');
      if (s === 'menu') UI.menuStats(this.best, this.bank);
      if (s === 'character') {
        UI.character(VR.CHARACTERS[this.charIndex]);
        const multi = VR.CHARACTERS.length > 1;
        document.getElementById('charPrev').hidden = !multi;
        document.getElementById('charNext').hidden = !multi;
      }
    }

    boot() {
      // build every prefab once, behind the loading screen
      this.world.warmup();
      this.resetRun();
      this.world.update(0, this.player, C.SPEED_START, 0, this, true);
      this.renderer.compile(this.scene, this.camera);
      this.setState('menu');
      this.loop();
      this.challenge.boot();                       // opened from an invite link?
    }

    resetRun(seed = null) {
      this.usedCodes = new Set();                  // each secret code works once per run
      this.canContinue = false;
      this.deathState = null;
      this.player.reset();
      this.powerups.reset();
      this.world.reset(seed);
      this.distance = 0; this.score = 0; this.coins = 0;
      this.multiplier = 1;
      this.speed = C.SPEED_START;
      this.lastBiome = null;
      this.hitCooldown = 0;
      this.deadTimer = 0;
      this.tunnelDark = 0;
      this.camera.position.set(0, C.CAMERA_HEIGHT, C.CAMERA_DISTANCE);
      this.camLook.set(0, 1.4, -C.CAMERA_LOOK_AHEAD);
      UI.clearPowerups();
      UI.setHUD(0, 0, 0, 1);
    }

    start() {
      VR.Audio.unlock();
      this.resetRun();
      // start from the menu's camera position for a smooth swoop in
      this.camera.position.copy(this.menuCamPos || this.camera.position);
      this.setState('playing');
      if (this.settings.music) VR.Audio.startMusic();
      VR.Audio.setMusicVolume(1);
    }
    /** Challenge round: same seed as the other player, then 3-2-1 together. */
    startChallengeRun(seed) {
      VR.Audio.unlock();
      if (this.missions.active) this.missions.abort();
      this.fade.value = this.fade.target = 0; this.updateFade(0);
      this.resetRun(seed);
      this.world.update(0, this.player, C.SPEED_START, 0, this, true);
      this.camera.position.copy(this.menuCamPos || this.camera.position);
      this.countdown = 3; this.countdownStar = 0;
      this.countdownEl.hidden = false; this.countdownEl.textContent = '3';
      this.setState('countdown');
      VR.Audio.play('click');
      if (this.settings.music) VR.Audio.startMusic();
      VR.Audio.setMusicVolume(0.6);
    }
    pause() { if (this.state !== 'playing') return; this.setState('paused'); VR.Audio.setMusicVolume(0.3); }
    resume() { this.setState('playing'); this.clock.getDelta(); VR.Audio.setMusicVolume(1); }
    toMenu() {
      if (this.challenge.active) this.challenge.leave(false);
      if (this.missions.active) this.missions.abort();
      this.fade.value = this.fade.target = 0; this.updateFade(0);
      this.countdownEl.hidden = true;
      this.resetRun();
      this.world.update(0, this.player, C.SPEED_START, 0, this, true);
      this.setState('menu');
      VR.Audio.setMusicVolume(0.5);
    }

    gameOver() {
      this.setState('dying');
      VR.Input.setEnabled(false);
      // remember where the run ended so a secret code can continue it
      const p = this.player;
      this.deathState = { x: p.x, y: p.y, z: p.z, lane: p.lane, coinsBanked: this.coins };
      this.canContinue = true;                     // one continue per death
      this.player.groundAtDeath = this.world.surfaceAt(this.player.x, this.player.z, this.player.y + 0.01, 0.3).h;
      this.player.die();
      const racing = this.challenge.inRace;
      if (racing) { this.canContinue = false; this.challenge.onLocalDeath(); }   // no secret codes in a challenge
      VR.Audio.play('crash');
      VR.Audio.setMusicVolume(0.25);
      this.shake = 0.5;
      const isBest = this.score > this.best;
      if (isBest) { this.best = Math.floor(this.score); UI.store.set('best', this.best); }
      this.bank += this.coins; UI.store.set('bank', this.bank);
      setTimeout(() => {
        if (this.state !== 'dying') return;                // left in the meantime
        if (racing && this.challenge.inRace) { this.challenge.showResult(); return; }
        UI.gameOver({ score: this.score, dist: this.distance, coins: this.coins, best: this.best, isBest });
        this.setState('gameover');
      }, 1300);
    }

    /**
     * Secret-code continue. Only valid on the Game Over screen, once per
     * death, and each code only once per run.
     * Returns 'ok' | 'wrong' | 'used' | 'unavailable'.
     */
    tryContinue(text) {
      if (this.state !== 'gameover' || !this.canContinue || !this.deathState) return 'unavailable';
      const code = VR.SecretCodes.check(text);
      if (!code) return 'wrong';
      if (this.usedCodes.has(code)) return 'used';
      this.usedCodes.add(code);
      this.canContinue = false;
      this.revive();
      return 'ok';
    }

    revive() {
      const d = this.deathState;
      // coins were banked at death; they'll be banked again at the next death
      this.bank -= d.coinsBanked; UI.store.set('bank', this.bank);
      this.player.revive(d);
      // short star power so the obstacle that ended the run is cleared
      this.powerups.timers.invincible = Math.max(this.powerups.remaining('invincible'), 3);
      this.hitCooldown = 0.3;
      this.shake = 0;
      this.clock.getDelta();
      this.setState('playing');
      VR.Audio.play('powerup');
      VR.Audio.setMusicVolume(1);
      UI.toast(VR.t('toast.continue'), 1200);
    }

    /* ==============================================================
     * MODE SWITCHING — runner ⇄ first-person mission
     * gateEnter: runner frozen, camera moves into the character's eyes
     *            (TPP → FPV in 0.3 s, as the movement spec asks), fade
     * mission:   the mission manager runs; the runner is not updated
     * gateReturn: fade out of the mission world
     * countdown: runner state restored (+ rewards), 3-2-1, then play
     * ============================================================ */
    checkGates() {
      const p = this.player;
      for (const g of this.world.gates) {
        if (g.used) continue;
        if (!g.announced && p.z - g.z < 120) { g.announced = true; UI.toast(VR.t('toast.gateAhead'), 1600); }
        if (p.z <= g.z + 0.2) {
          g.used = true;
          if (Math.abs(p.x - g.x) < 1.15 && p.y < 3.6 && !p.dead) { this.enterGate(g); return true; }
        }
      }
      return false;
    }

    /** RunStatePersistence: everything needed to resume the run exactly. */
    snapshotRun() {
      const p = this.player;
      return {
        score: this.score, distance: this.distance, coins: this.coins, multiplier: this.multiplier, speed: this.speed,
        powerups: Object.assign({}, this.powerups.timers),
        player: { x: p.x, y: p.y, z: p.z, lane: p.lane, prevLane: p.prevLane, grounded: p.grounded, lastStumble: p.lastStumble },
        usedCodes: [...this.usedCodes], canContinue: this.canContinue, hitCooldown: this.hitCooldown, lastBiome: this.lastBiome,
        world: { chunkIndex: this.world.chunkIndex, nextZ: this.world.nextZ, chunks: this.world.chunks.length, obstacles: this.world.obstacles.length },
        camera: this.camera.position.toArray(), camLook: this.camLook.toArray(),
      };
    }
    restoreRun(snap, rewards) {
      const p = this.player;
      this.score = snap.score; this.distance = snap.distance; this.coins = snap.coins;
      this.multiplier = snap.multiplier; this.speed = snap.speed;
      this.powerups.timers = Object.assign({}, snap.powerups);
      Object.assign(p, { x: snap.player.x, y: snap.player.y, z: snap.player.z, lane: snap.player.lane, prevLane: snap.player.prevLane,
        vy: 0, grounded: true, slideTimer: 0, pendingSlide: false, lastStumble: snap.player.lastStumble, prevX: snap.player.x, lateralVel: 0 });
      p.object.position.set(p.x, p.y, p.z);
      this.usedCodes = new Set(snap.usedCodes); this.canContinue = snap.canContinue; this.hitCooldown = snap.hitCooldown;
      // the world was frozen, so it must be exactly as we left it
      const w = this.world;
      this.restoreCheck = w.chunkIndex === snap.world.chunkIndex && w.nextZ === snap.world.nextZ && w.chunks.length === snap.world.chunks && w.obstacles.length === snap.world.obstacles;
      if (!this.restoreCheck) console.warn('[run] world changed during the mission', snap.world);
      if (rewards) { this.score += rewards.score; this.coins += rewards.coins; }
      this.camera.position.fromArray(snap.camera); this.camLook.fromArray(snap.camLook);
      UI.setHUD(this.score, this.distance, this.coins, this.multiplier);
      UI.setPowerups(this.powerups);
    }

    enterGate(gate) {
      const def = this.missions.byId(gate.missionId) || this.missions.nextForGate();
      if (!def) return;
      this.runSnapshot = this.snapshotRun();
      this.gateDef = def; this.gateT = 0;
      this.gateFrom = this.camera.position.clone();
      this.gateLookFrom = this.camLook.clone();
      this.setState('gateEnter');
      VR.Audio.play('portal'); VR.Audio.setMusicVolume(0.35);
    }
    updateGateEnter(dt) {
      this.gateT += dt;
      const p = this.player;
      const k = Math.min(1, this.gateT / 0.3);              // TPP → FPV in 0.3 s
      const e = k * k * (3 - 2 * k);
      const head = new THREE.Vector3(p.x, p.y + 1.5, p.z - 0.2);
      this.camera.position.lerpVectors(this.gateFrom, head, e);
      const look = new THREE.Vector3(p.x, p.y + 1.45, p.z - 10);
      this.camLook.lerpVectors(this.gateLookFrom, look, e);
      this.camera.lookAt(this.camLook);
      this.camera.fov = (this.portrait ? 70 : C.CAMERA_FOV) + e * 30; this.camera.updateProjectionMatrix();
      if (this.gateT > 0.12) this.fade.target = 1;
      p.rig.root.visible = this.gateT < 0.22;
      this.world.animateGates(dt);
      if (this.gateT >= 0.5 && this.fade.value >= 0.99) {
        this.resize();                                      // restore runner fov
        p.rig.root.visible = true;
        this.missions.enter(this.gateDef);
        this.setState('mission');
        this.fade.target = 0;
      }
    }
    updateMissionMode(dt) {
      this.missions.update(dt);
      if (this.state === 'gateReturn' && this.fade.value >= 0.99) {
        this.missions.exit();
        this.restoreRun(this.runSnapshot, this.returnRewards);
        this.runSnapshot = null;
        this.countdown = C.MISSION_RETURN_COUNTDOWN; this.countdownStar = C.MISSION_RETURN_STAR;
        this.countdownEl.hidden = false; this.countdownEl.textContent = String(Math.ceil(this.countdown));
        this.setState('countdown');
        this.fade.target = 0;
        if (this.returnRewards && (this.returnRewards.score || this.returnRewards.coins)) {
          setTimeout(() => UI.toast(VR.t('toast.reward', { score: this.returnRewards.score.toLocaleString('en-US'), coins: this.returnRewards.coins }), 2200), 300);
        }
      }
    }
    /** Called by the mission manager when the player leaves a mission. */
    onMissionReturn({ success, rewards }) {
      this.returnRewards = success ? rewards : null;
      this.lastMissionResult = { success, rewards };
      this.setState('gateReturn');
      this.fade.target = 1;
      VR.Audio.play('portal');
    }
    updateCountdown(dt) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== before && now > 0) { this.countdownEl.textContent = String(now); VR.Audio.play('click'); }
      this.updateEnvironment(dt);
      this.updateCamera(dt);
      this.player.animate(0, this.speed * 0.15);
      this.player.updateShadow(this.world);
      this.world.animateGates(dt);
      if (this.countdown <= 0) {
        this.countdownEl.hidden = true;
        if (this.countdownStar) this.powerups.timers.invincible = Math.max(this.powerups.remaining('invincible'), this.countdownStar);
        this.challenge.onRaceStart();
        this.clock.getDelta();
        this.setState('playing');
        VR.Audio.setMusicVolume(1); VR.Audio.play('powerup');
        UI.toast(VR.t('toast.go'), 800);
      }
    }
    quitFromMission() { this.toMenu(); }
    updateFade(dt) {
      const f = this.fade;
      if (f.value !== f.target) {
        const step = dt * f.speed;
        f.value = f.target > f.value ? Math.min(f.target, f.value + step) : Math.max(f.target, f.value - step);
      }
      this.fadeEl.style.opacity = f.value;
      this.fadeEl.hidden = f.value <= 0.001;
    }

    // ------------------------------------------------------------ rules
    speedAt(d) { return C.SPEED_START + (C.SPEED_MAX - C.SPEED_START) * (1 - Math.exp(-d / C.SPEED_RAMP)); }
    difficultyAt(d) { return 1 - Math.exp(-d / C.DIFFICULTY_RAMP); }
    multiplierAt(d) { let m = 0; for (const s of C.MULTIPLIER_STEPS) if (d >= s) m++; return m; }

    updateScore(dm) {
      const m = this.multiplierAt(this.distance);
      if (m !== this.multiplier) { this.multiplier = m; if (m > 1) UI.toast(VR.t('toast.multiplier', { n: m })); }
      const boost = this.powerups.active('boost') ? 2 : 1;
      this.score += dm * C.POINTS_PER_METRE * this.multiplier * boost;
    }

    onCoin(n, x, y, z) {
      const dbl = this.powerups.active('double') ? 2 : 1;
      this.coins += n * dbl;
      this.score += C.COIN_POINTS * n * dbl * this.multiplier;
      VR.Audio.play('coin');
    }
    onGem(x, y, z) {
      this.coins += 5; this.score += C.GEM_POINTS * this.multiplier;
      this.collect.burst(x, y, z); VR.Audio.play('gem'); UI.toast(VR.t('toast.lemon'));
    }
    onPowerUp(type, x, y, z) {
      this.powerups.activate(type);
      this.score += C.POWERUP_POINTS * this.multiplier;
      this.collect.burst(x, y, z);
      VR.Audio.play('powerup');
      UI.toast(VR.t('pu.' + type) + '!');
    }
    onTrainApproach() { VR.Audio.play('trainHorn'); }
    onWallBump() { this.cameraImpulse(0.05); this.shake = Math.max(this.shake, 0.08); }
    cameraImpulse(v) { this.camBumpV += v * 6; }

    resolveCollisions() {
      if (this.hitCooldown > 0) return;
      const hit = this.world.collide(this.player);
      if (!hit) return;
      const pu = this.powerups;
      const o = hit.obstacle;
      if (pu.active('invincible') || pu.active('boost')) {
        this.collect.burst(o.x, 1.5, this.player.z - 1);
        this.world.smash(o); VR.Audio.play('shieldBreak'); this.shake = 0.12;
        return;
      }
      if (hit.side) {
        const now = this.elapsed;
        if (now - this.player.lastStumble < C.STUMBLE_WINDOW) {
          if (pu.active('shield')) { pu.consume('shield'); this.shieldHit(o); return; }
          this.gameOver(); return;
        }
        this.player.lastStumble = now;
        this.player.bounceBack();
        this.hitCooldown = 0.35;
        this.shake = 0.18;
        VR.Audio.play('stumble');
        UI.toast(VR.t('toast.stumble'));
        return;
      }
      if (pu.active('shield')) { pu.consume('shield'); this.shieldHit(o); return; }
      this.gameOver();
    }
    shieldHit(o) {
      this.world.smash(o);
      this.player.flash = 1.2; this.hitCooldown = 1.2;
      this.shake = 0.25; VR.Audio.play('shieldBreak'); UI.toast(VR.t('toast.shieldBroken'));
    }

    // ------------------------------------------------------------ loop
    loop() {
      requestAnimationFrame(() => this.loop());
      const dt = Math.min(this.clock.getDelta(), 1 / 20);
      this.elapsed = (this.elapsed || 0) + dt;
      const st = this.state;
      if (st === 'playing') this.updatePlaying(dt);
      else if (st === 'dying') { this.player.update(dt, 0, this.world, this); this.updateCamera(dt); }
      else if (st === 'menu' || st === 'character' || st === 'loading' || st === 'challenge') this.updateMenu(dt);
      else if (st === 'settings' && this.settingsReturn !== 'paused') this.updateMenu(dt);
      else if (st === 'gateEnter') this.updateGateEnter(dt);
      else if (st === 'mission' || st === 'gateReturn') this.updateMissionMode(dt);
      else if (st === 'countdown') this.updateCountdown(dt);
      this.challenge.update(dt);
      this.updateFade(dt);
      if (this.state === 'mission' || this.state === 'gateReturn') this.missions.render(this.renderer);
      else {
        this.collect.fx.mesh.visible = true;
        this.renderer.render(this.scene, this.camera);
      }

      if (this.settings.fps) {
        this.fpsAcc += dt; this.fpsFrames++;
        if (this.fpsAcc > 0.5) { UI.fps(true, Math.round(this.fpsFrames / this.fpsAcc)); this.fpsAcc = 0; this.fpsFrames = 0; }
      }
    }

    updatePlaying(dt) {
      const p = this.player;
      let a; while ((a = VR.Input.next())) p.action(a, this);

      this.powerups.update(dt);
      const boost = this.powerups.active('boost');
      const target = this.speedAt(this.distance) * (boost ? C.POWERUPS.boost.speedFactor : 1);
      this.speed += (target - this.speed) * Math.min(1, dt * 2.5);
      const diff = this.difficultyAt(this.distance);

      const z0 = p.z;
      p.update(dt, this.speed, this.world, this);
      const dm = z0 - p.z;
      this.distance += dm;
      this.updateScore(dm);

      this.world.update(dt, p, this.speed, diff, this);
      this.world.animateGates(dt);
      if (this.checkGates()) return;
      if (this.hitCooldown > 0) this.hitCooldown -= dt;
      this.resolveCollisions();
      if (this.state !== 'playing') return;
      this.collect.update(dt, p, this);

      p.shieldMesh.visible = this.powerups.active('shield');
      if (this.powerups.active('invincible') || boost) p.flash = Math.max(p.flash, 0.1);
      p.updateShadow(this.world);

      // keep coordinates small on very long runs
      if (p.z < -C.RECENTER_DISTANCE) {
        const dz = -p.z;
        p.z += dz; this.world.shift(dz); this.camera.position.z += dz; this.camLook.z += dz;
        p.object.position.z = p.z;
      }

      this.updateEnvironment(dt);
      this.updateCamera(dt);
      UI.setHUD(this.score, this.distance, this.coins, this.multiplier);
      UI.setPowerups(this.powerups);
    }

    updateEnvironment(dt) {
      const chunk = this.world.chunkAt(this.player.z);
      if (!chunk) return;
      const biome = VR.BIOMES[chunk.biome];
      if (chunk.biome !== this.lastBiome) {
        if (this.lastBiome) UI.biome(VR.t('biome.' + chunk.biome));
        this.lastBiome = chunk.biome;
      }
      const inTunnel = chunk.style.startsWith('tunnel');
      this.tunnelDark += ((inTunnel ? 1 : 0) - this.tunnelDark) * Math.min(1, dt * 3);
      const k = Math.min(1, dt * 1.2);
      this.skyColor.lerp(new THREE.Color(biome.sky), k);
      this.fogColor.lerp(new THREE.Color(biome.fog), k);
      const dark = this.tunnelDark;
      this.scene.background.copy(this.skyColor).lerp(TUNNEL_COLOR, dark * 0.85);
      this.scene.fog.color.copy(this.fogColor).lerp(TUNNEL_COLOR, dark * 0.9);
      this.hemi.intensity = 1.9 - dark * 1.1;
      this.sun.intensity = 2.1 - dark * 1.6;
    }

    updateCamera(dt) {
      const p = this.player;
      // spring for landing dip / bumps
      this.camBumpV += (-this.camBump * 60 - this.camBumpV * 10) * dt;
      this.camBump += this.camBumpV * dt;
      const dist = C.CAMERA_DISTANCE + (this.portrait ? 1.2 : 0);
      const tx = p.x * 0.75;
      const ty = C.CAMERA_HEIGHT + p.y * 0.62 + this.camBump + (this.portrait ? 2.6 : 0);
      const tz = p.z + dist;
      const k = 1 - Math.exp(-dt * 7);
      const cam = this.camera.position;
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * (1 - Math.exp(-dt * 5));
      cam.z += (tz - cam.z) * (1 - Math.exp(-dt * 12));
      this.camLook.x += (p.x * 0.85 - this.camLook.x) * k;
      this.camLook.y += ((this.portrait ? 0.6 : 1.2) + p.y * 0.55 - this.camLook.y) * k;
      this.camLook.z = p.z - C.CAMERA_LOOK_AHEAD;
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt);
        const s = this.shake * 0.5;
        cam.x += (Math.random() - 0.5) * s; cam.y += (Math.random() - 0.5) * s;
      }
      this.camera.lookAt(this.camLook);
    }

    // menu: character faces the camera, slow orbit, idle bob
    updateMenu(dt) {
      this.menuTime += dt;
      const p = this.player, r = p.rig;
      p.object.position.set(0, 0, 0);
      p.object.rotation.y = Math.PI + Math.sin(this.menuTime * 0.5) * 0.35;
      const breathe = Math.sin(this.menuTime * 2.2);
      r.inner.rotation.set(0, 0, 0);
      r.inner.position.y = breathe * 0.02;
      r.parts.armL.rotation.set(0, 0, -0.12 - breathe * 0.04);
      r.parts.armR.rotation.set(Math.sin(this.menuTime * 3) * 0.15 - 0.2, 0, 0.12 + breathe * 0.04);
      r.parts.legL.rotation.set(0, 0, 0); r.parts.legR.rotation.set(0, 0, 0);
      r.parts.head.rotation.set(Math.sin(this.menuTime * 0.9) * 0.06, Math.sin(this.menuTime * 0.7) * 0.2, 0);
      r.root.visible = true; r.root.scale.set(1, 1, 1);
      p.shieldMesh.visible = false;
      p.updateShadow(this.world);
      const charView = this.state === 'character';
      const a = this.menuTime * 0.15;
      const radius = charView ? 4.2 : 7;
      const cx = Math.sin(a) * 1.5, cy = charView ? 1.6 : 2.0, cz = -radius;
      this.camera.position.set(cx, cy, cz);
      this.menuCamPos = this.camera.position.clone();
      // look below the character so it sits between the title and the buttons
      this.camLook.set(0, charView ? 0.2 : -0.45, 0);
      this.camera.lookAt(this.camLook);
      // also let the sky follow the first biome
      this.updateEnvironment(dt);
      p.object.rotation.y = Math.sin(this.menuTime * 0.5) * 0.35; // faces -Z → camera sits at -Z
    }
  }
  const TUNNEL_COLOR = new THREE.Color(0x1a1714);

  VR.Game = Game;

  window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    VR.game = game;
    // let the loading screen paint before the heavy prefab build
    // wait (briefly) for web fonts so in-world signs render with them
    const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
    fontsReady.then(() => requestAnimationFrame(() => setTimeout(() => {
      try { game.boot(); }
      catch (e) { document.getElementById('loadMsg').textContent = 'Could not start: ' + e.message; throw e; }
    }, 30)));
  });
})();
