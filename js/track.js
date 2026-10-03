/* =====================================================================
 * TRACK — the run's path through the world.
 * ---------------------------------------------------------------------
 * Gameplay keeps working in simple "path space", exactly as before:
 *   z  distance along the run (decreasing forward), x sideways, y up.
 * Physics, collisions, coins, patterns, distance and score all stay in
 * path space. The TRACK turns path space into the 3D world:
 *
 *   one SEGMENT per 40 m section:  heading, curvature k (1/radius, + = right),
 *                                  slope (metres up per metre), start frame
 *   toWorld(x, y, z)   path → world position (follows turns and hills)
 *   heading(z)         facing direction at z (radians, 0 = world -Z)
 *   place(obj, x,y,z)  put an object on the path, facing along it
 *
 * Each section also has MOVEMENT ZONES (see terrain.js): which internal
 * lanes are open at each point, where they are (x), and where a rock wall
 * separates them. Swipes, funnelling and pattern generation ask the
 * track; the visible terrain is generated from the same zones.
 *
 * bendGroup() deforms a straight section's geometry along its curve and
 * slope, so the voxel world really turns and climbs.
 * ===================================================================== */
(function () {
  const T = THREE;
  const C = VR.CONFIG;
  const LW = C.LANE_WIDTH;
  const DEFAULT_ZONE = Object.freeze({ open: [-1, 0, 1], x: { '-1': -LW, 0: 0, 1: LW }, wallL: false, wallR: false, sep: false });

  class Track {
    constructor() { this.reset(); }
    reset() {
      this.segs = [];
      // path z = 60 is the start of the first section; with heading 0 the mapping is
      // the identity (world = path) for straight starts, like the old straight railway
      this.end = { pos: new T.Vector3(0, 0, 60), th: 0 };
    }
    /** Append a section that starts at path z0 and runs `len` metres. */
    add(z0, len, k, slope, section) {
      const seg = { z0, len, k, slope, section, th0: this.end.th, P0: this.end.pos.clone() };
      this.segs.push(seg);
      this.end = { pos: this.centre(seg, len, new T.Vector3()), th: seg.th0 + k * len };
      return seg;
    }
    remove(seg) { const i = this.segs.indexOf(seg); if (i >= 0) this.segs.splice(i, 1); }
    shift(dz) { for (const s of this.segs) s.z0 += dz; }

    /** centre line point u metres into a segment */
    centre(seg, u, out) {
      const th0 = seg.th0, k = seg.k;
      if (Math.abs(k) < 1e-7) out.set(seg.P0.x + Math.sin(th0) * u, seg.P0.y + seg.slope * u, seg.P0.z - Math.cos(th0) * u);
      else {
        const th = th0 + k * u;
        out.set(seg.P0.x + (Math.cos(th0) - Math.cos(th)) / k, seg.P0.y + seg.slope * u, seg.P0.z - (Math.sin(th) - Math.sin(th0)) / k);
      }
      return out;
    }
    segAt(z) {
      const s = this.segs;
      for (let i = 0; i < s.length; i++) if (z <= s[i].z0 && z > s[i].z0 - s[i].len) return s[i];
      if (!s.length) return null;
      return z > s[0].z0 ? s[0] : s[s.length - 1];
    }
    toWorld(x, y, z, out = new T.Vector3()) {
      const s = this.segAt(z);
      if (!s) return out.set(x, y, z);
      const u = s.z0 - z, uc = Math.max(0, Math.min(s.len, u)), du = u - uc;
      this.centre(s, uc, out);
      const th = s.th0 + s.k * uc;
      const sn = Math.sin(th), cs = Math.cos(th);
      out.x += sn * du + cs * x;                // straight extension beyond the known track + sideways
      out.z += -cs * du + sn * x;
      out.y += y;
      return out;
    }
    heading(z) {
      const s = this.segAt(z); if (!s) return 0;
      return s.th0 + s.k * Math.max(0, Math.min(s.len, s.z0 - z));
    }
    /** Put an object on the path at (x, y, z), facing along the run (+yaw). */
    place(obj, x, y, z, yaw = 0) {
      this.toWorld(x, y, z, obj.position);
      obj.rotation.set(0, -this.heading(z) + yaw, 0);
      return obj;
    }

    // ---------------------------------------------------------------- zones
    zoneAt(z) {
      const s = this.segAt(z);
      if (!s || !s.section || !s.section.zone) return DEFAULT_ZONE;
      return s.section.zone(Math.max(0, Math.min(s.len - 0.001, s.z0 - z)));
    }
    laneX(z, lane) { const zn = this.zoneAt(z); const v = zn.x[lane]; return v === undefined ? lane * LW : v; }
    /** fractional lane (coin trails between two lanes) */
    laneXf(z, f) {
      const a = Math.floor(f), b = Math.ceil(f);
      if (a === b) return this.laneX(z, a);
      const t = f - a; return this.laneX(z, a) * (1 - t) + this.laneX(z, b) * t;
    }
    isOpen(z, lane) { return this.zoneAt(z).open.includes(lane); }
    wallBetween(z, a, b) {
      const zn = this.zoneAt(z), lo = Math.min(a, b);
      return lo === -1 ? zn.wallL : zn.wallR;
    }
    /** Can the runner switch from lane a to lane b now (and over the next few metres)? */
    canSwitch(z, a, b, look = 4) {
      if (b < -1 || b > 1) return false;
      for (let d = 0; d <= look; d += 1) {
        const zz = z - d;
        if (!this.isOpen(zz, b) || this.wallBetween(zz, a, b)) return false;
      }
      return true;
    }
  }

  /* -------------------------------------------------------------------
   * Bend a straight section (built along local -Z, 0 … -len) onto a curve
   * with curvature k and slope. parts: [{ obj, x, flip }] where obj is a
   * prefab group (meshes share geometry; the copies made here are owned
   * by the returned group and freed by disposeBent()).
   * ------------------------------------------------------------------- */
  const tmpM = new T.Matrix4(), tmpS = new T.Matrix4();
  function bendGroup(parts, k, slope) {
    const out = new T.Group();
    for (const { obj, x = 0, flip = false } of parts) {
      obj.updateMatrixWorld(true);
      tmpS.makeScale(flip ? -1 : 1, 1, 1).setPosition(x, 0, 0);
      obj.traverse((m) => {
        if (!m.isMesh) return;
        const g = m.geometry.clone();
        tmpM.multiplyMatrices(tmpS, m.matrixWorld);
        g.applyMatrix4(tmpM);
        if (tmpM.determinant() < 0 && g.index) {            // mirrored part: keep faces facing out
          const ix = g.index.array;
          for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
        }
        const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null;
        for (let i = 0; i < p.length; i += 3) {
          const lx = p[i], ly = p[i + 1], u = -p[i + 2];
          const th = k * u, cs = Math.cos(th), sn = Math.sin(th);
          let cx, cz;
          if (Math.abs(k) < 1e-7) { cx = 0; cz = -u; } else { cx = (1 - cs) / k; cz = -sn / k; }
          p[i] = cx + lx * cs; p[i + 1] = ly + slope * u; p[i + 2] = cz + lx * sn;
          if (n) { const nx = n[i], nz = n[i + 2]; n[i] = nx * cs - nz * sn; n[i + 2] = nx * sn + nz * cs; }
        }
        g.attributes.position.needsUpdate = true;
        if (n) g.attributes.normal.needsUpdate = true;
        g.computeBoundingSphere();
        g.userData.bent = true;
        const mesh = new T.Mesh(g, m.material);
        mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        out.add(mesh);
      });
    }
    return out;
  }
  function disposeBent(group) { group.traverse(m => { if (m.isMesh && m.geometry.userData.bent) m.geometry.dispose(); }); }

  VR.Track = Track;
  VR.bendGroup = bendGroup;
  VR.disposeBent = disposeBent;
  VR.DEFAULT_ZONE = DEFAULT_ZONE;
})();
