/* RéviSpace v2 — themes, recovery UI, version check, sidebar mobile, leaderboard helpers */
(function () {
  const THEME_KEY = 'rv_theme';
  function applyTheme(theme) {
    const t = theme || localStorage.getItem(THEME_KEY) || 'revispace';
    if (t === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    localStorage.setItem(THEME_KEY, t);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
  }
  window.setReviTheme = function (t) {
    applyTheme(t);
    if (window.token && window.api) {
      api('/api/me/preferences', { method: 'PATCH', body: JSON.stringify({ theme: t }) }).catch(() => {});
    }
  };
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem(THEME_KEY) === 'auto') applyTheme('auto');
  });

  // Sidebar mobile
  window.toggleSidebar = function () {
    const sb = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if (!sb) return;
    sb.classList.toggle('open');
    if (ov) ov.classList.toggle('open', sb.classList.contains('open'));
  };
  window.collapseSidebar = function () {
    document.body.classList.toggle('sidebar-collapsed');
    const sb = document.querySelector('.sidebar');
    if (sb) sb.classList.toggle('collapsed');
    localStorage.setItem('rv_sidebar_collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
  };
  if (localStorage.getItem('rv_sidebar_collapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
    document.querySelector('.sidebar')?.classList.add('collapsed');
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav') && window.innerWidth <= 980) {
      document.querySelector('.sidebar')?.classList.remove('open');
      document.querySelector('.sidebar-overlay')?.classList.remove('open');
    }
  });

  // Version check
  let dismissedBuild = sessionStorage.getItem('rv_dismissed_build');
  async function checkVersion() {
    try {
      const base = (window.REVISPACE_CONFIG && window.REVISPACE_CONFIG.API_BASE) || '';
      const r = await fetch(base + '/api/version');
      if (!r.ok) return;
      const data = await r.json();
      const build = data.build_id || data.frontend_version;
      const current = window.REVISPACE_BUILD || '2.0.0';
      if (build && build !== current && build !== dismissedBuild) {
        const el = document.getElementById('updateBanner');
        if (el) {
          el.classList.add('show');
          el.querySelector('[data-action="refresh"]')?.addEventListener('click', () => location.reload());
          el.querySelector('[data-action="later"]')?.addEventListener('click', () => {
            sessionStorage.setItem('rv_dismissed_build', build);
            el.classList.remove('show');
          });
        }
      }
    } catch {}
  }
  setTimeout(checkVersion, 4000);
  setInterval(checkVersion, 5 * 60 * 1000);

  // Enhance register success with recovery code
  const origRegister = null;
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', async function handler(e) {
      // let existing handler run; we intercept response via monkey-patch of api if needed
    }, true);
  });

  // Expose recovery display helper
  window.showRecoveryCode = function (code) {
    const panel = document.querySelector('#registerForm') || document.querySelector('.login-panel');
    if (!panel || !code) return;
    let box = document.getElementById('recoveryBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'recoveryBox';
      box.className = 'recovery-box';
      panel.appendChild(box);
    }
    box.innerHTML = `
      <strong>🔐 Code de récupération</strong>
      <p class="tiny muted">Sauvegarde-le maintenant. Il ne sera plus jamais affiché.</p>
      <code id="recoveryCodeValue">${code}</code>
      <div class="recovery-actions">
        <button type="button" class="btn secondary" onclick="navigator.clipboard.writeText('${code}');toast&&toast('Copié !')">Copier</button>
        <a class="btn secondary" download="revispace-recovery-code.txt" href="data:text/plain,${encodeURIComponent('RéviSpace recovery code\\n'+code)}">Télécharger</a>
      </div>
      <label class="tiny" style="display:block;margin-top:12px"><input type="checkbox" id="recoveryConfirm"> J'ai sauvegardé mon code</label>
      <button type="button" class="btn primary full" id="recoveryContinue" disabled style="margin-top:10px">Continuer</button>
    `;
    const cb = box.querySelector('#recoveryConfirm');
    const btn = box.querySelector('#recoveryContinue');
    cb.addEventListener('change', () => { btn.disabled = !cb.checked; });
    btn.addEventListener('click', () => { box.remove(); if (window.showApp) showApp(); });
  };
})();

/* Audio effects */
(function () {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx;
  function getCtx() {
    if (!ctx) ctx = new AudioCtx();
    return ctx;
  }
  function beep(freq, dur, type, vol) {
    try {
      const c = getCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(c.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.stop(c.currentTime + dur);
    } catch (e) {}
  }
  window.playReviSound = function (name) {
    const conf = JSON.parse(localStorage.getItem('rv_audio') || '{"enabled":true,"volume":0.4}');
    if (conf.enabled === false) return;
    const v = Math.max(0.01, Math.min(1, Number(conf.volume) || 0.4)) * 0.15;
    if (name === 'click') beep(520, 0.06, 'sine', v);
    else if (name === 'success') { beep(660, 0.08, 'sine', v); setTimeout(() => beep(880, 0.1, 'sine', v), 80); }
    else if (name === 'error') beep(180, 0.15, 'sawtooth', v * 0.7);
    else if (name === 'xp') { beep(740, 0.07, 'triangle', v); setTimeout(() => beep(990, 0.12, 'triangle', v), 70); }
    else if (name === 'level') { beep(520, 0.08, 'sine', v); setTimeout(() => beep(660, 0.08, 'sine', v), 90); setTimeout(() => beep(880, 0.14, 'sine', v), 180); }
    else beep(440, 0.05, 'sine', v);
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .nav, .tab')) playReviSound('click');
  }, true);
})();
