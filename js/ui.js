/* =====================================================================
 * UI — screens, HUD, toasts, settings persistence.
 * All DOM lives in index.html; this module only toggles and fills it.
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['loading', 'menu', 'character', 'settings', 'pause', 'gameover'];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubeexpress.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cubeexpress.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  let toastTimer = 0, biomeTimer = 0;
  const bars = {};

  // paint the pixel-art lemon next to the game title
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('canvas.lemon-ico').forEach(cv => {
      const ctx = cv.getContext('2d'); ctx.drawImage(VR.Tex.canvasFor((c) => VR.Tex.paint('lemon_icon', c)), 0, 0);
    });
  });

  VR.UI = {
    store, fmt,
    show(name) {
      for (const s of SCREENS) $(s).hidden = s !== name;
    },
    overlay(name, on) { $(name).hidden = !on; },
    hud(on) { $('hud').hidden = !on; },

    setHUD(score, dist, coins, mult) {
      $('hudScore').textContent = fmt(score);
      $('hudDist').innerHTML = `<span class="num">${fmt(dist)}</span> ${VR.t('unit.m')}`;
      $('hudCoins').textContent = fmt(coins);
      const m = 'x' + mult;
      if ($('hudMult').textContent !== m) {
        $('hudMult').textContent = m;
        $('hudMult').animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 300 });
      }
    },

    setPowerups(state) {
      const holder = $('powerbars');
      const active = new Set(state.list());
      for (const k in bars) if (!active.has(k)) { bars[k].el.remove(); delete bars[k]; }
      for (const k of active) {
        if (!bars[k]) {
          const el = document.createElement('div');
          el.className = 'pbar panel';
          const cv = VR.Tex.canvasFor(VR.POWERUP_ICONS[k]);
          const track = document.createElement('div'); track.className = 'track';
          const fill = document.createElement('div'); fill.className = 'fill';
          fill.style.background = '#' + VR.POWERUP_COLORS[k].toString(16).padStart(6, '0');
          track.appendChild(fill);
          el.append(cv, track);
          holder.appendChild(el);
          bars[k] = { el, fill };
        }
        const frac = state.remaining(k) / VR.CONFIG.POWERUPS[k].duration;
        bars[k].fill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
      }
    },
    clearPowerups() { for (const k in bars) { bars[k].el.remove(); delete bars[k]; } },

    toast(text, ms = 900) {
      const t = $('toast');
      t.textContent = text; t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    },
    biome(name) {
      const b = $('biomeName');
      b.textContent = name; b.classList.add('show');
      clearTimeout(biomeTimer);
      biomeTimer = setTimeout(() => b.classList.remove('show'), 2200);
    },

    menuStats(best, bank) { $('menuBest').textContent = fmt(best); $('menuBank').textContent = fmt(bank); },
    character(def) { $('charName').textContent = VR.L(def.name); $('charTag').textContent = VR.L(def.tagline) || ''; },

    openCodeForm() {
      $('codeBtn').hidden = true;
      $('codeForm').hidden = false;
      $('codeMsg').textContent = ''; $('codeMsg').className = 'code-msg';
      $('codeInput').focus();
    },
    codeResult(result) {
      const msg = $('codeMsg');
      const text = VR.t('code.' + result);
      msg.textContent = text;
      msg.className = 'code-msg ' + (result === 'ok' ? 'good' : 'bad');
      if (result !== 'ok') {
        const f = $('codeForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
        VR.Audio.play('stumble');
        $('codeInput').select();
      } else $('codeInput').blur();
    },
    resetCodeForm() {
      $('codeBtn').hidden = false;
      $('codeForm').hidden = true;
      $('codeInput').value = '';
      $('codeMsg').textContent = ''; $('codeMsg').className = 'code-msg';
    },

    gameOver({ score, dist, coins, best, isBest }) {
      this.resetCodeForm();
      $('goScore').textContent = fmt(score);
      $('goDist').innerHTML = `<span class="num">${fmt(dist)}</span> ${VR.t('unit.m')}`;
      $('goCoins').textContent = fmt(coins);
      $('goBest').textContent = fmt(best);
      $('newBest').hidden = !isBest;
    },

    setToggle(id, on, onText = VR.t('on'), offText = VR.t('off')) {
      const b = $(id); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? onText : offText;
    },
    fps(on, value) { $('fps').hidden = !on; if (on && value !== undefined) $('fps').textContent = value + ' FPS'; },

    bind(id, fn) {
      $(id).addEventListener('click', (e) => { VR.Audio.unlock(); VR.Audio.play('click'); fn(e); });
    },
  };
})();
