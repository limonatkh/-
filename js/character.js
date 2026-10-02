/* =====================================================================
 * PLAYER CHARACTER
 * ---------------------------------------------------------------------
 * THIS IS THE FILE TO EDIT TO CHANGE THE CHARACTER.
 *
 * A character is: a MODEL (voxel boxes grouped into 6 animated parts)
 * plus a PALETTE (named colours).
 *
 * Units are "pixels": 1 px = PX metres. The body is ~21 px tall.
 * Box format:  [x, y, z, width, height, depth, 'paletteColourName']
 *   x/y/z is the box's minimum corner relative to the part's pivot.
 *   -Z is the FRONT of the character (the face / running direction),
 *   +X is the character's right-hand side.
 * Pivots are joints: legs rotate at the hip, arms at the shoulder.
 *
 * outline: thickness (px) of the black cartoon ink line drawn around
 * every box whose colour is not listed in `noOutline`.
 * ===================================================================== */
(function () {
  const PX = 0.084;

  // ------------------------------------------------------------------
  // The player's own character, converted from the 2D drawing:
  // round white head, black beanie with a white spiky tuft, big round
  // eyes looking to the side, tiny dash mouth, stick neck, white V-neck
  // shirt, shorts, stick legs, rounded shoes and floating mitten hands.
  // Proportions measured from the drawing (1 px here = 25 image px).
  // ------------------------------------------------------------------
  function buildHead() {
    const b = [];
    const CAP = 4.8;                                   // beanie starts here
    // rounded head = three stacked boxes; the part above CAP is the beanie
    const layers = [[7.2, 6.2, 1.3, 5.7], [6.2, 5.4, 0.4, 6.6], [4.4, 4.0, 0.1, 7.0]];
    for (const [w, d, y0, y1] of layers) {
      b.push([-w / 2, y0, -d / 2, w, CAP - y0, d, 'skin']);
      b.push([-w / 2 - 0.12, CAP, -d / 2 - 0.12, w + 0.24, y1 - CAP + 0.1, d + 0.24, 'cap']);
    }
    // knot on top of the beanie (slightly to the character's right)
    b.push([-0.4, 7.0, -0.7, 1.6, 0.9, 1.4, 'cap']);
    // spiky white tuft, sweeping up and out to the character's right (+X)
    b.push([-0.2, 7.7, -0.6, 1.7, 1.5, 1.2, 'hair']);
    b.push([0.9, 8.6, -0.55, 1.6, 1.3, 1.1, 'hair']);
    b.push([2.0, 9.3, -0.5, 1.5, 1.0, 1.0, 'hair']);
    b.push([3.1, 9.8, -0.4, 1.0, 0.8, 0.8, 'hair']);           // top tip
    b.push([0.3, 9.1, -0.45, 1.0, 1.1, 0.9, 'hair']);
    b.push([1.3, 7.8, -0.5, 1.5, 0.8, 1.0, 'hairShade']);
    b.push([2.5, 7.3, -0.4, 1.2, 0.6, 0.8, 'hairShade']);
    b.push([3.4, 6.9, -0.3, 0.7, 0.5, 0.6, 'hairShade']);       // low tip
    b.push([-1.1, 8.6, -0.35, 0.8, 0.9, 0.8, 'hair']);          // small spike on the left
    // face (front = -Z). Big round eyes, both glancing to the same side.
    // (each eye is two crossed boxes so its corners read as round)
    for (const cx of [1.6, -1.8]) {
      b.push([cx - 1.3, 2.9, -3.35, 2.6, 1.9, 0.3, 'ink']);     // eye ring
      b.push([cx - 0.95, 2.55, -3.35, 1.9, 2.6, 0.3, 'ink']);
      b.push([cx - 1.0, 3.15, -3.5, 2.0, 1.3, 0.3, 'eyeWhite']);
      b.push([cx - 0.65, 2.8, -3.5, 1.3, 2.0, 0.3, 'eyeWhite']);
      b.push([cx - 0.35 - 0.4, 3.35, -3.62, 0.8, 0.8, 0.2, 'pupil']);
    }
    b.push([-0.8, 2.3, -3.2, 0.9, 0.25, 0.15, 'ink']);          // dash mouth
    b.push([2.3, 1.3, -3.16, 1.3, 1.6, 0.1, 'shade']);          // cheek shading
    b.push([-3.62, 1.3, -2.6, 0.1, 3.0, 4.6, 'shade']);         // side shading
    return b;
  }

  function leg(s) {                                              // s = +1 right, -1 left
    const c = s * 0.3;                                           // shoes flare outward
    return [
      [-0.95, -2.6, -1.3, 1.9, 2.9, 2.6, 'shorts'],               // shorts leg
      [-0.95 + (s > 0 ? 1.8 : 0), -2.6, -1.35, 0.1, 2.9, 2.7, 'shade'],
      [-0.25, -5.4, -0.25, 0.5, 2.9, 0.5, 'skin'],               // stick leg
      [c - 1.0, -6.6, -2.1, 2.0, 0.45, 3.2, 'shoeShade'],       // sole
      [c - 1.0, -6.15, -2.1, 2.0, 1.0, 3.2, 'shoe'],            // shoe
      [c - 0.7, -5.15, -0.9, 1.4, 0.3, 1.7, 'shoe'],            // ankle cuff
    ];
  }

  function hand(s) {                                             // floating mitten
    const c = s * 0.4;
    return [
      [c - 0.85, -3.4, -0.8, 1.7, 0.7, 1.6, 'skin'],             // mitten cuff
      [c - 0.9, -3.47, -0.85, 1.8, 0.1, 1.7, 'ink'],             // cuff line
      [c - 1.0, -5.4, -0.9, 2.0, 2.0, 1.8, 'skin'],              // mitten
      [c - s * 1.05 - 0.35, -5.0, -0.55, 0.7, 1.0, 1.1, 'skin'],  // thumb (toward body)
      [c + s * 0.9 - 0.05, -5.3, -0.85, 0.1, 1.7, 1.7, 'shade'],
    ];
  }

  const HERO_MODEL = {
    legL: { pivot: [-0.95, 6.6, 0], boxes: leg(-1) },
    legR: {
      pivot: [0.95, 6.6, 0], boxes: leg(1).concat([
        [-1.0, -1.9, -1.36, 0.1, 2.0, 0.1, 'ink'],               // shorts centre seam
      ]),
    },
    body: {
      pivot: [0, 6.6, 0], boxes: [
        [-1.9, 0.0, -1.3, 3.8, 0.6, 2.6, 'shorts'],              // waistband
        [-2.0, 0.4, -1.4, 4.0, 3.0, 2.8, 'shirt'],               // lower shirt
        [-2.4, 3.4, -1.4, 4.8, 3.5, 2.8, 'shirt'],               // chest / shoulders
        [-2.05, 0.35, -1.45, 4.1, 0.14, 2.9, 'ink'],             // shirt hem line
        [2.36, 0.5, -1.45, 0.1, 6.3, 2.9, 'shade'],              // side shading
        // V-neck collar
        [-1.2, 6.35, -1.52, 0.8, 0.5, 0.15, 'shade'],
        [0.4, 6.35, -1.52, 0.8, 0.5, 0.15, 'shade'],
        [-0.8, 5.85, -1.52, 0.7, 0.5, 0.15, 'shade'],
        [0.1, 5.85, -1.52, 0.7, 0.5, 0.15, 'shade'],
        [-0.35, 5.4, -1.52, 0.7, 0.5, 0.15, 'shade'],
        [-0.2, 6.8, -0.2, 0.4, 1.2, 0.4, 'skin'],                // stick neck
      ],
    },
    head: { pivot: [0, 14.3, 0], boxes: buildHead() },
    armL: { pivot: [-3.7, 12.6, 0], boxes: hand(-1) },
    armR: { pivot: [3.7, 12.6, 0], boxes: hand(1) },
  };

  const HERO_PALETTE = {
    skin: 0xf4f3ef, shirt: 0xf4f3ef, shorts: 0xf0efeb, shoe: 0xf4f3ef,
    hair: 0xf7f7f5, hairShade: 0xb4b9c5, shade: 0xb4b9c5, shoeShade: 0xb4b9c5,
    cap: 0x161616, ink: 0x161616, pupil: 0x161616, eyeWhite: 0xffffff,
  };

  // ------------------------------------------------------------------
  // MR. FRIDGE — from the user's drawing: a tall white fridge. The top
  // (freezer) door is the head with the face: arched brows, sleepy dash
  // eyes, a small round "o" mouth. The bottom door is the body with a
  // shirt collar and a long grey tie. White shirt sleeves with mitten
  // hands, two black shoes, grey shading down the right side.
  // ------------------------------------------------------------------
  function fridgeHead() {
    const b = [
      [-4.0, 0, -2.6, 8.0, 8.4, 5.2, 'skin'],                   // freezer door
      [-3.7, 8.4, -2.35, 7.4, 0.45, 4.7, 'skin'],               // rounded top
      [3.95, 0.1, -2.5, 0.15, 8.2, 5.0, 'shade'],               // right side shading
      [3.75, 8.4, -2.3, 0.1, 0.4, 4.6, 'shade'],
    ];
    for (const s of [-1, 1]) {
      const cx = s * 1.9;
      // arched eyebrow: a flat top and two short drops
      b.push([cx - 0.75, 5.75, -2.75, 1.5, 0.22, 0.15, 'ink']);
      b.push([cx - 1.05, 5.35, -2.75, 0.35, 0.45, 0.15, 'ink']);
      b.push([cx + 0.7, 5.45, -2.75, 0.3, 0.35, 0.15, 'ink']);
      // sleepy eye
      b.push([cx - 0.65, 4.35, -2.75, 1.3, 0.28, 0.15, 'ink']);
    }
    // small round mouth
    b.push([-0.5, 2.3, -2.75, 1.0, 1.1, 0.15, 'ink']);
    b.push([-0.25, 2.55, -2.82, 0.5, 0.6, 0.1, 'eyeWhite']);
    return b;
  }
  function fridgeLeg(s) {
    return [
      [-0.45, -1.2, -0.4, 0.9, 1.3, 0.8, 'ink'],               // short stub under the fridge
      [s * 0.4 - 1.6, -2.0, -2.4, 3.2, 0.9, 3.8, 'shoe'],      // big black shoe
      [s * 0.4 - 1.3, -1.25, -2.1, 2.6, 0.35, 3.0, 'shoe'],
    ];
  }
  function fridgeArm(s) {
    return [
      [-0.85, -5.6, -0.85, 1.7, 5.9, 1.7, 'shirt'],            // sleeve
      [-0.9, -5.75, -0.9, 1.8, 0.2, 1.8, 'shade'],             // cuff
      [-0.8, -7.3, -0.8, 1.6, 1.6, 1.6, 'skin'],               // mitten
      [s * 0.75 - 0.25, -7.8, -0.6, 0.5, 0.7, 0.5, 'skin'],    // fingers
      [-0.15, -7.9, -0.6, 0.45, 0.8, 0.5, 'skin'],
      [s > 0 ? 0.75 : -0.85, -5.5, -0.8, 0.1, 5.6, 1.6, 'shade'],
    ];
  }
  // first-person view: just the shirt cuff and the mitten (the full sleeve would fill the screen)
  function fridgeFpArm(s) {
    return [
      [-0.85, -3.7, -0.85, 1.7, 1.3, 1.7, 'shirt'],
      [-0.9, -3.85, -0.9, 1.8, 0.2, 1.8, 'shade'],
      [-0.8, -5.0, -0.8, 1.6, 1.3, 1.6, 'skin'],
      [s * 0.75 - 0.25, -5.4, -0.6, 0.5, 0.6, 0.5, 'skin'],
      [-0.15, -5.4, -0.6, 0.45, 0.6, 0.5, 'skin'],
    ];
  }
  const FRIDGE_MODEL = {
    legL: { pivot: [-1.7, 2.0, 0], boxes: fridgeLeg(-1) },
    legR: { pivot: [1.7, 2.0, 0], boxes: fridgeLeg(1) },
    body: {
      pivot: [0, 2.0, 0], boxes: [
        [-4.0, 0, -2.6, 8.0, 9.5, 5.2, 'skin'],                 // fridge door
        [3.95, 0.1, -2.5, 0.15, 9.3, 5.0, 'shade'],             // right side shading
        // collar: a white V under the seam
        [-1.4, 8.6, -2.72, 1.0, 0.3, 0.12, 'ink'],
        [0.4, 8.6, -2.72, 1.0, 0.3, 0.12, 'ink'],
        // tie: knot, then a long blade narrowing to a point
        [-0.55, 8.4, -2.8, 1.1, 0.95, 0.2, 'tie'],
        [-0.75, 7.0, -2.8, 1.5, 1.4, 0.2, 'tie'],
        [-0.85, 5.6, -2.8, 1.7, 1.4, 0.2, 'tie'],
        [-0.6, 4.6, -2.8, 1.2, 1.0, 0.2, 'tie'],
        [-0.3, 3.9, -2.8, 0.6, 0.7, 0.2, 'tie'],
        [0.05, 4.2, -2.86, 0.6, 5.1, 0.1, 'tieShade'],          // grey half of the tie
      ],
    },
    head: { pivot: [0, 11.5, 0], boxes: fridgeHead() },
    armL: { pivot: [-4.9, 10.6, 0], boxes: fridgeArm(-1) },
    armR: { pivot: [4.9, 10.6, 0], boxes: fridgeArm(1) },
  };
  const FRIDGE_PALETTE = {
    skin: 0xf6f6f3, shirt: 0xf2f2ee, shade: 0xc7c9cf, shoe: 0x161616, ink: 0x161616,
    tie: 0xf2f2ee, tieShade: 0x9a9da6, eyeWhite: 0xffffff,
  };

  // ------------------------------------------------------------------
  // Character registry — shown in the Character menu.
  // ------------------------------------------------------------------
  VR.CHARACTERS = [
    {
      id: 'hero', name: { en: 'Hero', ar: 'البطل' }, tagline: { en: 'Your original character', ar: 'شخصيتك الأصلية' },
      model: HERO_MODEL, palette: HERO_PALETTE,
      outline: 0.32,
      noOutline: ['ink', 'shade', 'pupil', 'eyeWhite', 'hairShade', 'shoeShade'],
    },
    {
      id: 'fridge', name: { en: 'Mr. Fridge', ar: 'السيد ثلّاجة' }, tagline: { en: 'Cool-headed businessman', ar: 'رجل أعمال بارد الأعصاب' },
      model: FRIDGE_MODEL, palette: FRIDGE_PALETTE,
      fpArms: { armL: fridgeFpArm(-1), armR: fridgeFpArm(1) },
      outline: 0.3,
      noOutline: ['ink', 'shade', 'eyeWhite', 'tieShade'],
    },
  ];

  const inkMaterial = new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide });
  // Flat cartoon shading like the original drawing: unlit colours, with
  // the per-face shading baked into the voxels (top > sides > bottom).
  const heroMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  heroMaterial.color.setRGB(1.1, 1.1, 1.1);
  heroMaterial.userData.hero = true;

  /* Character TONES for two-player challenges: the host keeps the default
   * white, the guest gets "سكني" (ash grey), so the two can't be mixed up.
   * Only the light body colours change; black ink lines stay black. */
  const TONES = { white: heroMaterial };
  const greyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  greyMat.color.setRGB(0.62, 0.64, 0.69); greyMat.userData.hero = true;
  TONES.grey = greyMat;
  VR.CHARACTER_TONES = { white: 1.1, grey: [0.62, 0.64, 0.69] };
  /** Recolour a built rig: tone = 'white' | 'grey'. */
  VR.toneCharacter = function (rig, tone) {
    const m = TONES[tone] || heroMaterial;
    rig.root.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.hero && !o.material.userData.ghost) o.material = m; });
    rig.tone = tone;
  };
  /** Same colour as a multiplier, for materials that are clones (ghost, hands). */
  VR.toneColor = function (color, tone) {
    const t = VR.CHARACTER_TONES[tone] || VR.CHARACTER_TONES.white;
    if (Array.isArray(t)) color.setRGB(t[0], t[1], t[2]); else color.setRGB(t, t, t);
  };

  /**
   * Build a rigged voxel character.
   * Returns { root, inner, parts: {legL, legR, body, head, armL, armR}, def }
   * root: feet at y = 0, facing -Z.
   */
  VR.buildCharacter = function (charDef) {
    const root = new THREE.Group();
    const inner = new THREE.Group();   // animated as a whole (lean, bob)
    root.add(inner);
    const parts = {};
    const t = charDef.outline || 0;
    const skip = new Set(charDef.noOutline || []);
    for (const name in charDef.model) {
      const part = charDef.model[name];
      const vb = new VR.VoxelBuilder();
      const ob = new VR.VoxelBuilder();
      for (const [x, y, z, w, h, d, col] of part.boxes) {
        const c = charDef.palette[col];
        vb.addColorBox((x + w / 2) * PX, y * PX, (z + d / 2) * PX, w * PX, h * PX, d * PX, c === undefined ? 0xff00ff : c);
        if (t && !skip.has(col)) {
          ob.addColorBox((x + w / 2) * PX, (y - t) * PX, (z + d / 2) * PX, (w + 2 * t) * PX, (h + 2 * t) * PX, (d + 2 * t) * PX, 0);
        }
      }
      const pivot = new THREE.Group();
      pivot.position.set(part.pivot[0] * PX, part.pivot[1] * PX, part.pivot[2] * PX);
      const model = vb.build();
      for (const m of model.children) m.material = heroMaterial;   // brighter than world blocks
      pivot.add(model);
      if (!ob.isEmpty()) {
        // cartoon ink line: inflated back-faces drawn in black
        for (const { geometry } of ob.buildGeometries()) pivot.add(new THREE.Mesh(geometry, inkMaterial));
      }
      parts[name] = pivot;
    }
    // hierarchy: head + arms ride on the body so leaning moves them together
    inner.add(parts.legL, parts.legR, parts.body);
    for (const n of ['head', 'armL', 'armR']) {
      const p = parts[n];
      p.position.sub(parts.body.position);
      parts.body.add(p);
    }
    return { root, inner, parts, def: charDef };
  };

  VR.CHARACTER_PX = PX;
})();
