(function () {
  const $ = (s) => document.querySelector(s);
  const api = window.api || (async function () { throw new Error('api not ready'); });

  function waitApi() {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (typeof window.api === 'function') {
          clearInterval(t);
          resolve(window.api);
        }
      }, 50);
    });
  }

  async function ensureApi() {
    if (typeof window.api === 'function') return window.api;
    return waitApi();
  }

  window.renderLeaderboard = async function () {
    const api = await ensureApi();
    const c = $('#pageContent');
    c.innerHTML = '<div class="card muted">Chargement du classement…</div>';
    try {
      const period = window.__lbPeriod || 'all';
      const d = await api('/api/leaderboard?period=' + period + '&limit=50');
      const top3 = d.items.slice(0, 3);
      const rest = d.items.slice(3);
      const podium = top3.length >= 1 ? `
        <div class="podium">
          ${top3[1] ? `<div class="place silver"><div class="avatar" style="margin:0 auto 8px">${escapeHtml((top3[1].username||'?')[0].toUpperCase())}</div><strong>#2 ${escapeHtml(top3[1].username)}</strong><div class="muted">Niv.${top3[1].level} · ${top3[1].score} XP</div></div>` : '<div></div>'}
          ${top3[0] ? `<div class="place gold"><div class="avatar" style="margin:0 auto 8px;width:48px;height:48px;font-size:1.2rem">${escapeHtml((top3[0].username||'?')[0].toUpperCase())}</div><strong>#1 ${escapeHtml(top3[0].username)}</strong><div class="muted">Niv.${top3[0].level} · ${top3[0].score} XP</div></div>` : ''}
          ${top3[2] ? `<div class="place bronze"><div class="avatar" style="margin:0 auto 8px">${escapeHtml((top3[2].username||'?')[0].toUpperCase())}</div><strong>#3 ${escapeHtml(top3[2].username)}</strong><div class="muted">Niv.${top3[2].level} · ${top3[2].score} XP</div></div>` : '<div></div>'}
        </div>` : '';
      c.innerHTML = `
        <div class="section-head"><h3>Classement</h3>
          <div class="tabs">
            <button class="tab ${period==='all'?'active':''}" onclick="window.__lbPeriod='all';renderLeaderboard()">Général</button>
            <button class="tab ${period==='week'?'active':''}" onclick="window.__lbPeriod='week';renderLeaderboard()">Hebdo</button>
            <button class="tab ${period==='month'?'active':''}" onclick="window.__lbPeriod='month';renderLeaderboard()">Mensuel</button>
          </div>
        </div>
        ${podium}
        ${rest.map(r => `
          <div class="rank-row ${d.me && r.id===d.me.userId?'me':''}">
            <strong>#${r.position}</strong>
            <span>${escapeHtml(r.username)} <span class="tag">Niv.${r.level}</span></span>
            <span class="muted">${r.quizzes_done} quiz</span>
            <strong>${r.score} XP</strong>
          </div>`).join('')}
        ${d.me && d.me.rank ? `<p class="muted center" style="margin-top:16px">Ta position : <strong>#${d.me.rank}</strong></p>` : ''}
      `;
    } catch (e) {
      c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  };

  window.renderMastery = async function () {
    const api = await ensureApi();
    const c = $('#pageContent');
    c.innerHTML = '<div class="card muted">Analyse en cours…</div>';
    try {
      const d = await api('/api/me/mastery');
      const o = d.overall || {};
      const gm = Math.round(Number(o.global_mastery) || 0);
      c.innerHTML = `
        <div class="section-head"><h3>Analyse des connaissances</h3></div>
        <div class="stats">
          <div class="stat"><small>Maîtrise globale</small><strong>${gm}%</strong><div class="bar"><div class="bar-fill" style="width:${gm}%"></div></div></div>
          <div class="stat"><small>Quiz réalisés</small><strong>${o.quizzes_done || 0}</strong></div>
          <div class="stat"><small>Taux de réussite</small><strong>${Math.round(Number(o.avg_success_pct)||0)}%</strong></div>
          <div class="stat"><small>Flashcards révisées</small><strong>${o.flashcards_reviewed || 0}</strong></div>
        </div>
        <div class="grid">
          <div class="card">
            <h3>À retravailler</h3>
            ${(d.recommendations?.review_chapters||[]).length
              ? d.recommendations.review_chapters.map(x => `<div class="item" style="margin:8px 0"><strong>${escapeHtml(x.title)}</strong><div class="muted">${escapeHtml(x.subject)} · ${Math.round(x.mastery)}%</div><div class="bar"><div class="bar-fill" style="width:${Math.round(x.mastery)}%"></div></div></div>`).join('')
              : '<p class="muted">Pas encore assez de données. Fais des quiz !</p>'}
          </div>
          <div class="card">
            <h3>Chapitres solides</h3>
            ${(d.recommendations?.solid_chapters||[]).length
              ? d.recommendations.solid_chapters.map(x => `<div class="item" style="margin:8px 0"><strong>${escapeHtml(x.title)}</strong><div class="muted">${escapeHtml(x.subject)} · ${Math.round(x.mastery)}%</div></div>`).join('')
              : '<p class="muted">Continue pour débloquer des points forts.</p>'}
          </div>
        </div>
        <div class="section-head"><h3>Par chapitre</h3></div>
        ${(d.chapters||[]).map(ch => `
          <div class="card" style="margin-bottom:10px">
            <div class="section-head" style="margin:0">
              <div><strong>${escapeHtml(ch.chapter_title)}</strong><div class="muted">${escapeHtml(ch.subject_name)}</div></div>
              <span class="tag">${Math.round(ch.mastery_pct)}%</span>
            </div>
            <div class="bar"><div class="bar-fill" style="width:${Math.round(ch.mastery_pct)}%"></div></div>
            <p class="tiny muted">${ch.quizzes_done} quiz · ${ch.flashcards_reviewed} flashcards</p>
          </div>`).join('') || '<p class="muted">Aucune donnée de maîtrise pour l’instant.</p>'}
      `;
    } catch (e) {
      c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  };

  window.renderCalendar = async function () {
    const api = await ensureApi();
    const c = $('#pageContent');
    c.innerHTML = '<div class="card muted">Chargement du calendrier…</div>';
    try {
      const d = await api('/api/exams');
      const subjects = await api('/api/subjects').catch(() => ({ subjects: [] }));
      const now = Date.now();
      c.innerHTML = `
        <div class="section-head">
          <h3>Calendrier des contrôles</h3>
          <button class="btn primary" id="btnNewExam">+ Ajouter</button>
        </div>
        <div id="examFormWrap" class="card hidden" style="margin-bottom:16px">
          <h3>Nouveau contrôle</h3>
          <form id="examForm" class="stack">
            <input class="field" name="title" placeholder="Titre" required>
            <select class="field" name="subject_id">
              <option value="">Matière (optionnel)</option>
              ${(subjects.subjects||[]).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
            <input class="field" type="datetime-local" name="exam_at" required>
            <input class="field" name="color" type="color" value="#7c5cff" style="height:44px">
            <textarea class="field" name="description" placeholder="Description"></textarea>
            <button class="btn primary">Enregistrer</button>
          </form>
        </div>
        <div class="section-head"><h3>Prochains contrôles</h3></div>
        ${(d.exams||[]).length ? d.exams.map(ex => {
          const t = new Date(ex.exam_at).getTime();
          const days = Math.ceil((t - now) / 86400000);
          const cd = days < 0 ? 'Passé' : days === 0 ? 'Aujourd’hui' : `Dans ${days} j`;
          return `<div class="card" style="border-left:4px solid ${escapeHtml(ex.color||'#7c5cff')};margin-bottom:10px">
            <div class="section-head" style="margin:0">
              <div>
                <strong>${escapeHtml(ex.title)}</strong>
                <div class="muted">${ex.subject_name ? escapeHtml(ex.subject_name)+' · ' : ''}${new Date(ex.exam_at).toLocaleString('fr-FR')}</div>
              </div>
              <span class="tag">${cd}</span>
            </div>
            ${ex.description ? `<p class="muted">${escapeHtml(ex.description)}</p>` : ''}
            <div class="row" style="display:flex;gap:8px;margin-top:10px">
              <button class="btn danger" data-del-exam="${ex.id}">Supprimer</button>
            </div>
          </div>`;
        }).join('') : '<p class="muted">Aucun contrôle planifié.</p>'}
      `;
      $('#btnNewExam').onclick = () => $('#examFormWrap').classList.toggle('hidden');
      $('#examForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const body = Object.fromEntries(f);
        if (body.subject_id === '') delete body.subject_id;
        else body.subject_id = Number(body.subject_id);
        body.exam_at = new Date(body.exam_at).toISOString();
        await api('/api/exams', { method: 'POST', body: JSON.stringify(body) });
        toast('Contrôle ajouté');
        renderCalendar();
      };
      c.querySelectorAll('[data-del-exam]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Supprimer ce contrôle ?')) return;
          await api('/api/exams/' + btn.dataset.delExam, { method: 'DELETE' });
          toast('Supprimé');
          renderCalendar();
        };
      });
    } catch (e) {
      c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  };

  window.renderSettings = async function () {
    const api = await ensureApi();
    const c = $('#pageContent');
    c.innerHTML = '<div class="card muted">Chargement…</div>';
    try {
      const d = await api('/api/me/preferences');
      const p = d.preferences || {};
      const theme = localStorage.getItem('rv_theme') || p.theme || 'revispace';
      c.innerHTML = `
        <div class="section-head"><h3>Paramètres</h3></div>
        <div class="card" style="margin-bottom:14px">
          <h3>Thème</h3>
          <div class="theme-switcher" style="margin-top:10px">
            ${['light','dark','revispace','auto'].map(t =>
              `<button type="button" class="theme-btn ${theme===t?'active':''}" data-theme="${t}" onclick="setReviTheme('${t}')">${t==='revispace'?'RéviSpace':t==='auto'?'Auto':t==='light'?'Clair':'Sombre'}</button>`
            ).join('')}
          </div>
        </div>
        <div class="card" style="margin-bottom:14px">
          <h3>Audio</h3>
          <label class="tiny"><input type="checkbox" id="audioEnabled" ${p.audio_enabled!==false?'checked':''}> Activer les effets sonores</label>
          <label class="tiny" style="display:block;margin-top:10px">Volume <input type="range" id="audioVolume" min="0" max="1" step="0.05" value="${p.audio_volume??0.5}"></label>
          <button class="btn secondary" style="margin-top:10px" id="testSound">Tester un son</button>
        </div>
        <div class="card" style="margin-bottom:14px">
          <h3>Sécurité</h3>
          <form id="pwdForm" class="stack">
            <input class="field" type="password" name="currentPassword" placeholder="Mot de passe actuel" required>
            <input class="field" type="password" name="newPassword" placeholder="Nouveau (12+ caractères)" required minlength="12">
            <input class="field" type="password" name="confirmation" placeholder="Confirmation" required>
            <button class="btn primary">Changer le mot de passe</button>
          </form>
          <hr style="border-color:var(--line);margin:16px 0">
          <form id="recoveryForm" class="stack">
            <p class="muted tiny">Générer un nouveau code de récupération (invalide l’ancien)</p>
            <input class="field" type="password" name="password" placeholder="Mot de passe actuel" required>
            <button class="btn secondary">Nouveau code de récupération</button>
          </form>
          <div id="newRecoveryBox"></div>
        </div>
        <div class="card">
          <h3>Sessions actives</h3>
          <div id="sessionsList" class="muted">Chargement…</div>
        </div>
      `;
      const saveAudio = async () => {
        await api('/api/me/preferences', {
          method: 'PATCH',
          body: JSON.stringify({
            audio_enabled: $('#audioEnabled').checked,
            audio_volume: Number($('#audioVolume').value)
          })
        });
        localStorage.setItem('rv_audio', JSON.stringify({
          enabled: $('#audioEnabled').checked,
          volume: Number($('#audioVolume').value)
        }));
      };
      $('#audioEnabled').onchange = saveAudio;
      $('#audioVolume').onchange = saveAudio;
      $('#testSound').onclick = () => window.playReviSound && playReviSound('click');
      $('#pwdForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        await api('/api/me/password', { method: 'POST', body: JSON.stringify(f) });
        toast('Mot de passe mis à jour');
        e.target.reset();
      };
      $('#recoveryForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const r = await api('/api/me/recovery-code', { method: 'POST', body: JSON.stringify(f) });
        $('#newRecoveryBox').innerHTML = `<div class="recovery-box"><strong>Nouveau code</strong><code>${escapeHtml(r.recoveryCode)}</code><p class="tiny muted">Sauvegarde-le maintenant.</p></div>`;
        if (window.showRecoveryCode) showRecoveryCode(r.recoveryCode);
      };
      const sessions = await api('/api/me/sessions');
      $('#sessionsList').innerHTML = (sessions.sessions||[]).map(s => `
        <div class="rank-row">
          <span>${s.is_current ? '🟢' : '⚪'}</span>
          <span class="tiny">${escapeHtml(s.user_agent||'Session')} · ${new Date(s.created_at).toLocaleString('fr-FR')}</span>
          <span></span>
          ${s.is_current ? '<span class="tag">Actuelle</span>' : `<button class="btn danger" data-sid="${s.id}">Révoquer</button>`}
        </div>`).join('') || '<p class="muted">Aucune session</p>';
      c.querySelectorAll('[data-sid]').forEach(b => {
        b.onclick = async () => {
          await api('/api/me/sessions/' + b.dataset.sid, { method: 'DELETE' });
          toast('Session révoquée');
          renderSettings();
        };
      });
    } catch (e) {
      c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  };

  window.renderAiAdmin = async function () {
    const api = await ensureApi();
    const c = $('#pageContent');
    c.innerHTML = '<div class="card muted">Chargement admin IA…</div>';
    try {
      const [prov, stats, settings] = await Promise.all([
        api('/api/admin/ai/providers'),
        api('/api/admin/ai/stats?days=30'),
        api('/api/admin/ai/settings')
      ]);
      c.innerHTML = `
        <div class="section-head"><h3>Administration IA</h3><span class="tag">${stats.totals?.generations||0} générations / 30j</span></div>
        <div class="stats">
          <div class="stat"><small>Succès</small><strong>${stats.totals?.successes||0}</strong></div>
          <div class="stat"><small>Erreurs</small><strong>${stats.totals?.errors||0}</strong></div>
          <div class="stat"><small>Fallbacks</small><strong>${stats.totals?.fallbacks||0}</strong></div>
          <div class="stat"><small>Durée moy.</small><strong>${stats.totals?.avg_duration_ms||0} ms</strong></div>
        </div>
        <div class="section-head"><h3>Fournisseurs</h3></div>
        ${(prov.providers||[]).map(p => `
          <div class="card" style="margin-bottom:12px">
            <div class="section-head" style="margin:0">
              <div>
                <strong>${escapeHtml(p.display_name)}</strong>
                <div class="muted">${escapeHtml(p.name)} · priorité ${p.priority}</div>
              </div>
              <span class="tag ${p.status==='operational'?'ok':''}">${escapeHtml(p.status||'unknown')}</span>
            </div>
            <p class="tiny muted">Modèle : ${escapeHtml(p.default_model||'—')} · Clé : ${p.has_key?'configurée':'manquante'}</p>
            <div class="form-grid" style="margin-top:10px">
              <label class="tiny">Activé <input type="checkbox" data-en="${p.id}" ${p.is_enabled?'checked':''}></label>
              <input class="field" data-model="${p.id}" value="${escapeHtml(p.default_model||'')}" placeholder="Modèle">
              <input class="field" data-prio="${p.id}" type="number" value="${p.priority}" placeholder="Priorité">
              <input class="field" data-key="${p.id}" type="password" placeholder="Nouvelle clé API (optionnel)">
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn primary" data-save="${p.id}">Enregistrer</button>
              <button class="btn secondary" data-test="${p.id}">Tester</button>
            </div>
            ${p.last_error ? `<p class="error tiny">${escapeHtml(p.last_error)}</p>` : ''}
          </div>`).join('')}
        <div class="card">
          <h3>Réglages globaux</h3>
          <label class="tiny">Désactivation d’urgence <input type="checkbox" id="aiEmergency" ${settings.settings?.emergency_disable===true||settings.settings?.emergency_disable==='true'?'checked':''}></label>
          <button class="btn secondary" style="margin-top:10px" id="saveAiSettings">Sauver réglages</button>
        </div>
        <div class="section-head"><h3>Par fournisseur (30j)</h3></div>
        ${(stats.by_provider||[]).map(x => `
          <div class="rank-row">
            <span></span>
            <strong>${escapeHtml(x.display_name||x.name)}</strong>
            <span class="muted">${x.requests} req · ${x.errors} err</span>
            <span>${x.avg_ms} ms</span>
          </div>`).join('')}
      `;
      c.querySelectorAll('[data-save]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.save;
          const body = {
            is_enabled: c.querySelector(`[data-en="${id}"]`).checked,
            default_model: c.querySelector(`[data-model="${id}"]`).value,
            priority: Number(c.querySelector(`[data-prio="${id}"]`).value)
          };
          const key = c.querySelector(`[data-key="${id}"]`).value;
          if (key) body.api_key = key;
          await api('/api/admin/ai/providers/' + id, { method: 'PATCH', body: JSON.stringify(body) });
          toast('Fournisseur mis à jour');
          renderAiAdmin();
        };
      });
      c.querySelectorAll('[data-test]').forEach(btn => {
        btn.onclick = async () => {
          try {
            const r = await api('/api/admin/ai/providers/' + btn.dataset.test + '/test', { method: 'POST', body: '{}' });
            toast('OK · ' + r.durationMs + ' ms · ' + r.provider);
            renderAiAdmin();
          } catch (e) { toast(e.message); }
        };
      });
      $('#saveAiSettings').onclick = async () => {
        await api('/api/admin/ai/settings', {
          method: 'PATCH',
          body: JSON.stringify({ emergency_disable: $('#aiEmergency').checked })
        });
        toast('Réglages enregistrés');
      };
    } catch (e) {
      c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  };

  // Hook navigate
  const origNavigate = window.navigate;
  window.navigate = function (page) {
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    const titles = {
      home: 'Vue d’ensemble', subjects: 'Mes matières', points: 'Mes points',
      leaderboard: 'Classement', mastery: 'Analyse', calendar: 'Calendrier', settings: 'Paramètres',
      admin: 'Tableau administrateur', manage: 'Gestion des contenus', users: 'Utilisateurs',
      ai: 'Assistant génération', aiadmin: 'Admin IA', logs: 'Journal admin'
    };
    const t = $('#pageTitle');
    if (t) t.textContent = titles[page] || page;
    if (page === 'leaderboard') return renderLeaderboard();
    if (page === 'mastery') return renderMastery();
    if (page === 'calendar') return renderCalendar();
    if (page === 'settings') return renderSettings();
    if (page === 'aiadmin') return renderAiAdmin();
    if (typeof origNavigate === 'function') return origNavigate(page);
  };

  // Forgot password UI on login
  document.addEventListener('DOMContentLoaded', () => {
    const loginPanel = document.querySelector('.login-panel');
    if (!loginPanel) return;
    if (!document.getElementById('forgotLink')) {
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        const p = document.createElement('p');
        p.className = 'tiny center';
        p.innerHTML = `<button type="button" class="register-link" id="forgotLink">Mot de passe oublié ?</button>`;
        loginForm.appendChild(p);
      }
    }
    const forgotLink = document.getElementById('forgotLink');
    if (forgotLink) {
      forgotLink.onclick = () => {
        let box = document.getElementById('forgotBox');
        if (!box) {
          box = document.createElement('form');
          box.id = 'forgotBox';
          box.className = 'login-card';
          box.innerHTML = `
            <span class="eyebrow">RÉCUPÉRATION</span>
            <h2>Mot de passe oublié</h2>
            <p class="muted">Pseudo + code de récupération</p>
            <label>Pseudo</label><input id="forgotUser" required maxlength="32">
            <label>Code de récupération</label><input id="forgotCode" required>
            <button class="btn primary full" type="submit">Vérifier</button>
            <p id="forgotErr" class="error"></p>
            <p class="tiny center"><button type="button" class="register-link" id="backLogin">Retour connexion</button></p>
          `;
          loginPanel.appendChild(box);
          box.onsubmit = async (e) => {
            e.preventDefault();
            $('#forgotErr').textContent = '';
            try {
              const base = (window.REVISPACE_CONFIG && window.REVISPACE_CONFIG.API_BASE) || '';
              const r = await fetch(base + '/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username: $('#forgotUser').value,
                  recoveryCode: $('#forgotCode').value
                })
              });
              const data = await r.json();
              if (!data.resetToken) {
                $('#forgotErr').textContent = data.message || 'Vérifie tes informations.';
                return;
              }
              box.innerHTML = `
                <h2>Nouveau mot de passe</h2>
                <input id="newPass" class="field" type="password" placeholder="Nouveau (12+)" minlength="12" required>
                <input id="newPass2" class="field" type="password" placeholder="Confirmation" required>
                <button class="btn primary full" type="button" id="doReset">Enregistrer</button>
                <p id="forgotErr" class="error"></p>
              `;
              $('#doReset').onclick = async () => {
                const password = $('#newPass').value;
                const confirmation = $('#newPass2').value;
                const r2 = await fetch(base + '/api/auth/reset-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ resetToken: data.resetToken, password, confirmation })
                });
                const d2 = await r2.json();
                if (!r2.ok) { $('#forgotErr').textContent = d2.error || 'Erreur'; return; }
                toast && toast('Mot de passe mis à jour');
                location.reload();
              };
            } catch (err) {
              $('#forgotErr').textContent = err.message || 'Erreur réseau';
            }
          };
          document.getElementById('backLogin').onclick = () => {
            box.remove();
            $('#loginForm')?.classList.remove('hidden');
          };
        }
        $('#loginForm')?.classList.add('hidden');
        $('#registerForm')?.classList.add('hidden');
        box.classList.remove('hidden');
      };
    }
  });
})();
