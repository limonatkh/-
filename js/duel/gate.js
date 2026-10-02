/* =====================================================================
 * 1v1 GATE — a small arena portal on a platform BESIDE the track.
 * It never blocks a lane: the runner passes it, and only pressing the
 * prompt (E / tap) starts a challenge. Purple curtain = PvP, so it can't
 * be confused with the lemon-yellow mission gates.
 * ===================================================================== */
(function () {
  let curtainMat = null;
  function curtain() {
    if (curtainMat) return curtainMat;
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 64;
    const c = cv.getContext('2d');
    for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
      const v = 0.55 + 0.45 * Math.sin(x * 0.45 + Math.sin(y * 0.25) * 2.2) * Math.cos(y * 0.18);
      c.fillStyle = `rgba(${(140 + v * 60) | 0},${(80 + v * 50) | 0},255,${0.55 + v * 0.4})`;
      c.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    curtainMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    curtainMat.toneMapped = false;
    return curtainMat;
  }

  VR.buildDuelGate = function () {
    const g = new THREE.Group();
    const vb = new VR.VoxelBuilder();
    const purple = VR.Mat.tinted('sandstone', 0xb58cff);
    vb.addBox(0, 0, 0, 4.2, 0.55, 4.6, 'cobble');                    // platform
    vb.addBox(0, 0.55, 0, 3.6, 0.08, 4.0, VR.Mat.tinted('concrete', 0x9b6bff));
    for (const s of [-1, 1]) {
      vb.addBox(s * 1.35, 0.6, 0, 0.5, 3.6, 0.7, purple);
      for (const y of [1.4, 2.8]) vb.addBox(s * 1.35, y, 0, 0.56, 0.3, 0.76, 'lemon');
    }
    vb.addBox(0, 4.2, 0, 3.4, 0.55, 0.8, purple);
    vb.addBox(0, 4.2, 0.41, 3.0, 0.08, 0.02, 'hazard');
    // steps toward the track side
    vb.addBox(0, 0, 2.6, 2.0, 0.28, 0.6, 'cobble');
    g.add(vb.build());
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.55), curtain());
    cur.position.set(0, 2.38, 0); g.add(cur);
    const sign = VR.WorldText.make({ text: VR.t('du.gateSign'), style: 'sign', width: 2.2, size: 0.34 });
    sign.position.set(0, 5.45, 0.42); g.add(sign);
    // two crossed rifles spinning slowly on top
    const spinner = new THREE.Group();
    for (const s of [-1, 1]) {
      const r = VR.DuelWeapons.sniper(s > 0 ? 0xb26bff : 0xffd23a);
      r.scale.setScalar(2.2); r.rotation.set(0, Math.PI / 2, s * 0.6); spinner.add(r);
    }
    spinner.position.set(0, 6.4, 0); g.add(spinner);
    g.userData.spinner = spinner;
    return g;
  };
  VR.duelGateCurtain = () => curtain();
})();
