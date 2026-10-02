/* =====================================================================
 * MISSION SYMBOLS — 16x16 pixel icons used by puzzles (dials, buttons,
 * painted clues, UI). Add a symbol by adding a row-art entry below;
 * it is then usable from mission data by its name.
 * ===================================================================== */
(function () {
  const PAL = {
    o: '#1d1d26', y: '#ffd83a', l: '#fff29a', d: '#d9a90f', g: '#5fae3a', G: '#2f6b1e',
    w: '#f4f4f0', s: '#b8c4d6', b: '#5ec8ff', B: '#2a7fc0', r: '#e5433a', R: '#a32a22',
    m: '#e8e2b8', M: '#9c9677', p: '#c49cff',
  };
  const ART = {
    lemon: [
      '................', '.........gG.....', '........gGG.....', '......oogo......',
      '....ooyyyyoo....', '...oyllyyyyyo...', '..oyllyyyyyydo..', '.oyyyyyyyyyyydo.',
      '.oyyyyyyyyyyyddo', '.oyyyyyyyyyyydo.', '..oyyyyyyyyyddo.', '...oyyyyyyyddo..',
      '....oddyyyddoo..', '.....oooddoo....', '........oo......', '................'],
    moon: [
      '................', '.....oooo.......', '...oommmoo......', '..ommmmoo.......',
      '..ommmo.........', '.ommmo..........', '.ommmo..........', '.ommmo..........',
      '.ommmo..........', '.ommmMo.........', '..ommmMoo.......', '..oommmmMoooo...',
      '...oommmmmmmo...', '.....oooooo.....', '................', '................'],
    leaf: [
      '................', '...........ooo..', '.........oogGo..', '.......oogggGo..',
      '......ogggggGo..', '.....oggggGgGo..', '....oggggGggGo..', '....ogggGgggo...',
      '...ogggGggggo...', '...oggGgggoo....', '...ogGgggoo.....', '..oGoooooo......',
      '.oGo............', '.oo.............', '................', '................'],
    star: [
      '................', '.......oo.......', '......oyyo......', '......oyyo......',
      '.....oyyyyo.....', 'ooooooyyyyoooooo', 'oyyyyyyyyyyyyyyo', '.oyyyyyyyyyyyyo.',
      '..oyyyyyyyyyyo..', '...oyyyyyyyyo...', '...oyyyyyyyyo...', '..oyyyyoooyyyo..',
      '..oyyyo...oyyo..', '.oyyoo.....oyyo.', '.ooo.........oo.', '................'],
    sun: [
      '................', '.......oo.......', '..o....oo....o..', '...o.oooooo.o...',
      '....oyyyyyyo....', '...oyyllyyyyo...', '...oylyyyyyyo...', 'oooyyyyyyyyyyooo',
      'oooyyyyyyyyydooo', '...oyyyyyyyddo..', '...oyyyyyyddo...', '....oyyyddddo...',
      '...o.oooooo.o...', '..o....oo....o..', '.......oo.......', '................'],
    drop: [
      '................', '.......oo.......', '......obbo......', '......obbo......',
      '.....obbbbo.....', '.....obbbbo.....', '....obbbbbbo....', '...obwbbbbbbo...',
      '...obwbbbbbbo...', '..obwbbbbbbBBo..', '..obbbbbbbbBBo..', '..obbbbbbbBBBo..',
      '...obbbbbBBBo...', '....ooBBBBoo....', '......oooo......', '................'],
  };
  const cache = {};
  function canvas(name, scale = 1, bg = null) {
    const key = name + '@' + scale + (bg || '');
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16 * scale;
    const c = cv.getContext('2d');
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); }
    const rows = ART[name] || ART.star;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (PAL[ch]) { c.fillStyle = PAL[ch]; c.fillRect(x * scale, y * scale, scale, scale); }
    }));
    cache[key] = cv;
    return cv;
  }
  VR.Symbols = {
    names: Object.keys(ART),
    canvas,
    draw(ctx, name, x, y, size) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas(name, 4), x, y, size, size);
    },
    dataURL(name) { return canvas(name, 4).toDataURL(); },
    label: {
      lemon: { en: 'Lemon', ar: 'الليمونة' }, moon: { en: 'Moon', ar: 'الهلال' }, leaf: { en: 'Leaf', ar: 'الورقة' },
      star: { en: 'Star', ar: 'النجمة' }, sun: { en: 'Sun', ar: 'الشمس' }, drop: { en: 'Drop', ar: 'القطرة' },
    },
    name(s) { return VR.L(this.label[s]) || s; },
    add(name, rows) { ART[name] = rows; this.names = Object.keys(ART); },
  };
})();
