/* RéviSpace - espace admin (contenus, génération Groq, vérification) + améliorations élèves (étape 6B) */
(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const notify = m => (String(m).length > 70 ? alert(m) : toast(m));
  const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { notify(e.message); } };
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  // ---------- Markdown minimal et sûr ----------
  function md(src) {
    const inline = t => escapeHtml(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    let html = '', inList = false;
    const close = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const raw of String(src || '').replace(/\r/g, '').split('\n')) {
      const l = raw.trimEnd(); let m;
      if (!l.trim()) { close(); continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { close(); const n = Math.min(4, m[1].length + 1); html += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
      if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(m[1])}</li>`; continue; }
      close(); html += `<p>${inline(l)}</p>`;
    }
    close(); return html;
  }

  // ====================== CÔTÉ ÉLÈVE ======================
  let lastSubjectId = null;

  window.renderSubjects = async function () {
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement des matières…</div>';
    try {
      const d = await api('/api/subjects'); subjectsCache = d.subjects;
      c.innerHTML = `<div class="section-head"><h3>Toutes tes matières</h3><span class="tag">${d.subjects.length} matière(s)</span></div>` +
        (d.subjects.length ? `<div class="grid">${d.subjects.map(s => `<div class="subject-card" data-id="${s.id}"><div class="subject-icon">✦</div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description || 'Découvre les chapitres de cette matière.')}</p><small>${s.chapters_count} chapitre(s) →</small></div>`).join('')}</div>` : '<div class="empty">Aucune matière pour le moment.</div>');
      c.querySelectorAll('.subject-card').forEach(el => { el.onclick = () => openSubject(Number(el.dataset.id)); });
    } catch (e) { c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
  };

  window.openSubject = async function (id) {
    lastSubjectId = id;
    const s = subjectsCache.find(x => x.id == id); const name = s ? s.name : 'Matière';
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement…</div>';
    try {
      const d = await api(`/api/subjects/${id}/chapters`);
      c.innerHTML = `<button class="btn secondary" onclick="navigate('subjects')">← Retour aux matières</button><div class="section-head"><h3>${escapeHtml(name)}</h3></div>` +
        (d.chapters.length ? d.chapters.map(ch => `<div class="chapter-row"><div><b>${escapeHtml(ch.title)}</b><small>${escapeHtml(ch.description || 'Chapitre de révision')}</small></div><div class="row">
          ${ch.courses_published ? `<button class="btn secondary" onclick="openCourse(${ch.id})">Cours & fiche</button>` : ''}
          ${ch.questions_published >= 10 ? `<button class="btn secondary" onclick="startQuiz(${ch.id})">Quiz</button>` : ''}
          ${ch.flashcards_published ? `<button class="btn secondary" onclick="startFlashcards(${ch.id})">Cartes</button>` : ''}</div></div>`).join('') : '<div class="empty">Aucun chapitre disponible dans cette matière.</div>');
    } catch (e) { toast(e.message); }
  };

  window.openCourse = async function (id) {
    currentChapter = id;
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement du cours…</div>';
    try {
      const d = await api(`/api/chapters/${id}/course`);
      const order = ['Fiche de révision', 'Cours', 'Notions importantes', 'Vocabulaire', 'Méthodes à mémoriser', "Exercices d'application"];
      const idx = t => { const i = order.indexOf(t); return i < 0 ? 99 : i; };
      const items = [...d.courses].sort((a, b) => idx(a.title) - idx(b.title));
      if (!items.length) { c.innerHTML = '<div class="empty">Aucun cours publié pour ce chapitre.</div>'; return; }
      c.innerHTML = `<button class="btn secondary" onclick="${lastSubjectId ? `openSubject(${lastSubjectId})` : "navigate('subjects')"}">← Chapitres</button>
        <div class="tabs" id="courseTabs">${items.map((x, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-i="${i}">${escapeHtml(x.title)}</button>`).join('')}</div>
        <article class="card md" id="courseBody"></article>
        <div class="row" style="margin-top:14px"><button class="btn secondary" onclick="startQuiz(${id})">Faire le quiz</button><button class="btn secondary" onclick="startFlashcards(${id})">Réviser les cartes</button></div>`;
      const show = i => { $('#courseBody').innerHTML = md(items[i].content); document.querySelectorAll('#courseTabs .tab').forEach(b => b.classList.toggle('active', Number(b.dataset.i) === i)); };
      document.querySelectorAll('#courseTabs .tab').forEach(b => { b.onclick = () => show(Number(b.dataset.i)); });
      show(0);
    } catch (e) { toast(e.message); }
  };

  let quizSessionId = null;
  window.startQuiz = async function (id) {
    currentChapter = id; quizAnswers = {};
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Préparation du quiz…</div>';
    try {
      const d = await api(`/api/chapters/${id}/quiz`);
      quizItems = d.questions; quizSessionId = d.sessionId; renderQuiz();
    } catch (e) { c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
  };
  window.renderQuiz = function () {
    const c = $('#pageContent'); const y = window.scrollY;
    c.innerHTML = `<div class="section-head"><div><span class="eyebrow">ENTRAÎNEMENT</span><h3>Quiz · ${quizItems.length} questions</h3></div><span class="tag">2 points par bonne réponse</span></div>` +
      quizItems.map((q, i) => `<div class="question" style="margin-bottom:13px"><small class="eyebrow">QUESTION ${i + 1}/${quizItems.length}</small><h3>${escapeHtml(q.question)}</h3>${q.options.map((o, j) => `<button class="option ${quizAnswers[q.id] === o ? 'selected' : ''}" onclick="chooseAnswerIdx(${i},${j})">${escapeHtml(o)}</button>`).join('')}</div>`).join('') +
      `<button class="btn primary" onclick="submitQuiz()">Terminer le quiz →</button>`;
    window.scrollTo(0, y);
  };
  window.chooseAnswerIdx = function (i, j) { const q = quizItems[i]; quizAnswers[q.id] = q.options[j]; renderQuiz(); };
  window.submitQuiz = async function () {
    if (Object.keys(quizAnswers).length !== quizItems.length) { toast('Réponds à toutes les questions avant de terminer.'); return; }
    try {
      const d = await api('/api/quiz/submit', { method: 'POST', body: JSON.stringify({ sessionId: quizSessionId, answers: quizItems.map(q => ({ questionId: q.id, answer: quizAnswers[q.id] })) }) });
      if (currentUser) currentUser.points += d.points;
      const byId = new Map(quizItems.map(q => [String(q.id), q]));
      $('#pageContent').innerHTML = `<div class="card center"><span class="eyebrow">QUIZ TERMINÉ</span><h2 style="font:800 38px Manrope">${d.score}/${d.total}</h2><h3>${d.score === d.total ? 'Excellent travail ! ✨' : 'Bien joué, continue !'}</h3><p class="muted">Tu gagnes ${d.points} points.</p>
        <div class="row" style="justify-content:center"><button class="btn primary" onclick="startQuiz(${currentChapter})">Refaire un quiz (10 nouvelles questions)</button><button class="btn secondary" onclick="navigate('subjects')">Retour aux matières</button></div></div>
        <div class="section-head"><h3>Correction</h3></div>` +
        d.details.map((x, i) => { const q = byId.get(String(x.questionId)); return `<div class="question ${x.correct ? 'right' : 'wrong'}" style="margin-bottom:12px"><small class="eyebrow">${x.correct ? '✓ BONNE RÉPONSE' : '✗ RÉPONSE INCORRECTE'}</small><h3>${escapeHtml(q ? q.question : 'Question')}</h3>${x.correct ? '' : `<p class="muted">Ta réponse : ${escapeHtml(x.your_answer || '—')}</p>`}<p><b>Bonne réponse :</b> ${escapeHtml(x.correct_answer)}</p>${x.explanation ? `<p class="muted">${escapeHtml(x.explanation)}</p>` : ''}</div>`; }).join('');
    } catch (e) { toast(e.message); }
  };

  window.startFlashcards = async function (id) {
    currentChapter = id;
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement des flashcards…</div>';
    try {
      const d = await api(`/api/chapters/${id}/flashcards`); flashItems = d.flashcards; flashIndex = 0; flashBack = false;
      if (!flashItems.length) { c.innerHTML = '<div class="empty">Aucune flashcard publiée pour ce chapitre.</div>'; return; }
      renderFlashcard();
    } catch (e) { toast(e.message); }
  };
  window.renderFlashcard = function () {
    const f = flashItems[flashIndex];
    $('#pageContent').innerHTML = `<div class="section-head"><div><span class="eyebrow">MÉMORISATION</span><h3>Flashcards</h3></div><span class="tag">${flashIndex + 1} / ${flashItems.length}</span></div>
      <div class="flashcard" onclick="flipCard()"><div><small class="eyebrow">${flashBack ? 'RÉPONSE' : 'QUESTION · CLIQUE POUR RETOURNER'}</small><p><strong>${escapeHtml(flashBack ? f.back : f.front)}</strong></p></div></div>
      <div class="row" style="justify-content:center;margin-top:16px"><button class="btn secondary" onclick="prevCard()">← Précédente</button><button class="btn primary" onclick="flipCard()">Retourner</button><button class="btn secondary" onclick="nextCard()">Suivante →</button></div>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn secondary" onclick="startFlashcards(${currentChapter})">↻ Recommencer (mélanger)</button></div>`;
  };

  // ====================== CÔTÉ ADMIN : CONTENUS ======================
  let adminData = { subjects: [], chapters: [] };
  const badge = (n, t) => `<span class="tag ${t > 0 && n === t ? 'ok' : 'warn'}">${n}/${t}</span>`;

  window.renderManage = async function () {
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement…</div>';
    try {
      const [s, ch] = await Promise.all([api('/api/admin/subjects'), api('/api/admin/chapters')]);
      adminData = { subjects: s.subjects, chapters: ch.chapters };
      const bySub = {}; ch.chapters.forEach(x => (bySub[x.subject_id] = bySub[x.subject_id] || []).push(x));
      c.innerHTML = `<div class="card"><h3>Nouvelle matière</h3><form id="subjectForm" class="row"><input class="field small" name="name" placeholder="Ex. Mathématiques" required><input class="field small" name="description" placeholder="Description (facultatif)"><button class="btn primary">Créer la matière</button></form></div>
        <div class="section-head"><h3>Matières et chapitres</h3><button class="btn primary" onclick="navigate('ai')">✦ Générer un chapitre avec Groq</button></div>` +
        (s.subjects.length ? s.subjects.map(sub => `<div class="card" style="margin-bottom:14px"><div class="section-head" style="margin-bottom:8px"><div><h3 style="margin:0">${escapeHtml(sub.name)}</h3><small class="muted">${escapeHtml(sub.description || '')}</small></div>
          <div class="row"><button class="btn secondary" onclick="addChapter(${sub.id})">＋ Chapitre</button><button class="btn secondary" onclick="renameSubject(${sub.id})">Renommer</button><button class="btn danger" onclick="deleteSubject(${sub.id})">Supprimer</button></div></div>` +
          ((bySub[sub.id] || []).length ? (bySub[sub.id]).map(x => `<div class="chapter-row"><div><b>${escapeHtml(x.title)}</b><small>Cours ${badge(x.courses_published, x.courses_total)} Quiz ${badge(x.questions_published, x.questions_total)} Cartes ${badge(x.flashcards_published, x.flashcards_total)}</small></div>
            <div class="row"><button class="btn secondary" onclick="editChapter(${x.id})">Ouvrir / vérifier</button><button class="btn secondary" onclick="goGenerate(${x.id})">✦ Générer</button><button class="btn secondary" onclick="renameChapter(${x.id})">Renommer</button><button class="btn danger" onclick="deleteChapter(${x.id})">Supprimer</button></div></div>`).join('') : '<p class="muted tiny">Aucun chapitre.</p>') + '</div>').join('') : '<div class="empty">Crée ta première matière ci-dessus.</div>');
      $('#subjectForm').onsubmit = safe(async e => { e.preventDefault(); await api('/api/admin/subjects', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); toast('Matière créée'); renderManage(); });
    } catch (e) { c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
  };
  window.addChapter = safe(async sid => { const title = prompt('Titre du nouveau chapitre :'); if (!title) return; await api('/api/admin/chapters', { method: 'POST', body: JSON.stringify({ subject_id: sid, title, description: '' }) }); toast('Chapitre créé'); renderManage(); });
  window.renameSubject = safe(async id => { const s = adminData.subjects.find(x => x.id == id); const name = prompt('Nouveau nom de la matière :', s.name); if (!name) return; const description = prompt('Description :', s.description || '') ?? s.description; await api(`/api/admin/subjects/${id}`, { method: 'PATCH', body: JSON.stringify({ name, description }) }); toast('Matière modifiée'); renderManage(); });
  window.deleteSubject = safe(async id => { const s = adminData.subjects.find(x => x.id == id); if (!confirm(`Supprimer la matière « ${s.name} » ?`)) return; await api(`/api/admin/subjects/${id}`, { method: 'DELETE' }); toast('Matière supprimée'); renderManage(); });
  window.renameChapter = safe(async id => { const x = adminData.chapters.find(v => v.id == id); const title = prompt('Nouveau titre du chapitre :', x.title); if (!title) return; await api(`/api/admin/chapters/${id}`, { method: 'PATCH', body: JSON.stringify({ title, description: x.description || '' }) }); toast('Chapitre modifié'); renderManage(); });
  window.deleteChapter = safe(async id => { const x = adminData.chapters.find(v => v.id == id); if (!confirm(`Supprimer le chapitre « ${x.title} » ET tout son contenu (cours, quiz, flashcards) ? Cette action est définitive.`)) return; await api(`/api/admin/chapters/${id}`, { method: 'DELETE' }); toast('Chapitre supprimé'); renderManage(); });
  window.goGenerate = function (chapterId) { window.__genChapter = chapterId; navigate('ai'); };

  // ====================== CÔTÉ ADMIN : GÉNÉRATION Groq ======================
  window.renderAI = async function () {
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement…</div>';
    try {
      const [s, ch] = await Promise.all([api('/api/admin/subjects'), api('/api/admin/chapters')]);
      $('#pageTitle').textContent = 'Générer avec Groq';
      if (!s.subjects.length) { c.innerHTML = '<div class="card"><h3>Aucune matière</h3><p class="muted">Crée d’abord une matière dans « Contenus ».</p><button class="btn primary" onclick="navigate(\'manage\')">Aller aux contenus</button></div>'; return; }
      const pre = window.__genChapter ? ch.chapters.find(x => x.id == window.__genChapter) : null; window.__genChapter = null;
      c.innerHTML = `<div class="card"><span class="eyebrow">Groq · GÉNÉRATION AUTOMATIQUE</span><h3>Générer mes révisions</h3>
        <p class="muted">Choisis la matière et le chapitre, colle ton cours ou importe un fichier. Groq prépare un <b>brouillon</b> (fiche, quiz, flashcards, exercices) que tu vérifies avant de publier.</p>
        <div class="stack"><label>Matière</label><select id="genSubject" class="field">${s.subjects.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')}</select>
        <label>Chapitre</label><select id="genChapter" class="field"></select>
        <input id="genNewTitle" class="field hidden" maxlength="150" placeholder="Titre du nouveau chapitre (ex. Les fractions)">
        <label>Cours</label><textarea id="genText" class="field big" placeholder="Colle ton cours complet ici, ou importe un fichier ci-dessous…"></textarea>
        <div class="row"><input type="file" id="genFile" accept=".pdf,.docx,.txt,.md"><span id="genInfo" class="muted tiny"></span></div>
        <button id="genBtn" class="btn primary">✦ Générer mes révisions avec Groq</button></div></div><div id="genProgress"></div>`;
      const fill = (selectId) => {
        const sid = $('#genSubject').value; const list = ch.chapters.filter(x => x.subject_id == sid);
        $('#genChapter').innerHTML = list.map(x => `<option value="${x.id}">${escapeHtml(x.title)}</option>`).join('') + '<option value="new">➕ Nouveau chapitre…</option>';
        if (selectId) $('#genChapter').value = selectId; else if (!list.length) $('#genChapter').value = 'new';
        $('#genNewTitle').classList.toggle('hidden', $('#genChapter').value !== 'new');
      };
      if (pre) $('#genSubject').value = pre.subject_id;
      fill(pre ? pre.id : null);
      $('#genSubject').onchange = () => fill(null);
      $('#genChapter').onchange = () => $('#genNewTitle').classList.toggle('hidden', $('#genChapter').value !== 'new');
      $('#genText').oninput = () => { $('#genInfo').textContent = `${$('#genText').value.length.toLocaleString('fr-FR')} caractères`; };

      $('#genFile').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const info = $('#genInfo');
        if (f.size > 15 * 1024 * 1024) { info.textContent = 'Fichier trop volumineux (15 Mo maximum).'; return; }
        info.textContent = 'Lecture du fichier…';
        try {
          let text;
          if (/\.(txt|md)$/i.test(f.name)) text = await f.text();
          else {
            const r = await fetch(API + '/api/admin/extract', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + token }, body: f });
            const d = await r.json().catch(() => ({ error: 'Fichier trop volumineux ou réponse invalide du serveur.' }));
            if (!r.ok) throw new Error(d.error || 'Lecture du fichier impossible.');
            text = d.text;
          }
          $('#genText').value = text;
          info.textContent = `Texte extrait : ${text.length.toLocaleString('fr-FR')} caractères. Vérifie-le dans la zone ci-dessus (tu peux le corriger) avant de générer.`;
        } catch (err) { info.textContent = ''; $('#genProgress').innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`; }
        e.target.value = '';
      };

      $('#genBtn').onclick = safe(async () => {
        const text = $('#genText').value.trim();
        if (text.length < 200) { notify('Le cours est trop court (200 caractères minimum).'); return; }
        let chapterId = $('#genChapter').value;
        if (chapterId === 'new') {
          const title = $('#genNewTitle').value.trim(); if (!title) { notify('Donne un titre au nouveau chapitre.'); return; }
          chapterId = null;
          var newTitle = title;
        } else {
          const x = ch.chapters.find(v => v.id == chapterId);
          if (x && (x.courses_total || x.questions_total || x.flashcards_total) &&
            !confirm('Ce chapitre contient déjà du contenu. Les textes générés (Cours, Fiche…) remplaceront ceux du même titre et repasseront en brouillon ; les nouvelles questions et cartes seront ajoutées sans doublon. Continuer ?')) return;
        }
        $('#genBtn').disabled = true;
        try {
          if (!chapterId) { const r = await api('/api/admin/chapters', { method: 'POST', body: JSON.stringify({ subject_id: Number($('#genSubject').value), title: newTitle, description: '' }) }); chapterId = r.chapter.id; }
          const g = await api('/api/admin/generate', { method: 'POST', body: JSON.stringify({ chapter_id: Number(chapterId), text }) });
          await pollJob(g.jobId, chapterId);
        } finally { const b = $('#genBtn'); if (b) b.disabled = false; }
      });
    } catch (e) { c.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
  };

  async function pollJob(jobId, chapterId) {
    const box = $('#genProgress'); let fails = 0;
    while (document.body.contains(box)) {
      let job;
      try { job = (await api(`/api/admin/generate/${jobId}`)).job; fails = 0; }
      catch (e) { if (++fails > 5) throw e; await sleep(3000); continue; }
      let pct = job.chunks_total ? Math.round((job.chunks_done / job.chunks_total) * 80) : 3;
      if (/Rédaction/.test(job.step)) pct = 85; if (/Enregistrement/.test(job.step)) pct = 95;
      const finished = ['done', 'partial', 'failed'].includes(job.status);
      if (job.status === 'done' || job.status === 'partial') pct = 100;
      const errs = (job.errors || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
      box.innerHTML = `<div class="card" style="margin-top:14px"><span class="eyebrow">PROGRESSION</span><h3>${escapeHtml(job.step || 'En attente…')}</h3>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div><p class="muted tiny">${pct}%${job.chunks_total ? ` · partie ${job.chunks_done}/${job.chunks_total}` : ''} — ne ferme pas cette page, la génération peut prendre plusieurs minutes.</p>
        ${errs ? `<ul class="error-list">${errs}</ul>` : ''}
        ${job.status === 'done' ? `<p class="ok-box">Terminé : ${job.counts.questions} questions, ${job.counts.flashcards} flashcards, ${job.counts.courses} sections de cours. Tout est en <b>brouillon</b> : vérifie puis publie.</p><button class="btn primary" onclick="editChapter(${chapterId})">Vérifier et publier →</button>` : ''}
        ${job.status === 'partial' ? `<p class="warn-box">Terminé avec des erreurs (ci-dessus) : ${job.counts.questions} questions, ${job.counts.flashcards} flashcards. Certaines parties manquent peut-être. Vérifie le résultat ou relance la génération.</p><button class="btn primary" onclick="editChapter(${chapterId})">Vérifier le brouillon →</button>` : ''}
        ${job.status === 'failed' ? '<p class="error">La génération a échoué. Ton texte est toujours dans la zone ci-dessus : tu peux relancer.</p>' : ''}</div>`;
      if (finished) return;
      await sleep(3000);
    }
  }

  // ====================== CÔTÉ ADMIN : VÉRIFICATION / ÉDITION D'UN CHAPITRE ======================
  const qFields = x => `<textarea class="field q-text" rows="2" placeholder="Énoncé de la question">${escapeHtml(x.question || '')}</textarea>
    <label class="tiny muted">Propositions (une par ligne)</label><textarea class="field q-choices" rows="4">${escapeHtml((x.choices || []).join('\n'))}</textarea>
    <label class="tiny muted">Bonne réponse</label><select class="field q-correct">${(x.choices || []).map(o => `<option value="${escapeAttr(o)}" ${o === x.correct_answer ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>
    <input class="field q-expl" placeholder="Explication" value="${escapeAttr(x.explanation || '')}">
    <select class="field q-diff">${['facile', 'moyen', 'difficile'].map(v => `<option value="${v}" ${v === (x.difficulty || 'moyen') ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  const readQ = el => ({ question: el.querySelector('.q-text').value.trim(), choices: el.querySelector('.q-choices').value.split('\n').map(x => x.trim()).filter(Boolean), correct_answer: el.querySelector('.q-correct').value, explanation: el.querySelector('.q-expl').value.trim(), difficulty: el.querySelector('.q-diff').value });
  const fFields = x => `<input class="field f-front" placeholder="Recto / question" value="${escapeAttr(x.front || '')}"><textarea class="field f-back" rows="3" placeholder="Verso / réponse">${escapeHtml(x.back || '')}</textarea>`;
  const pubTag = p => `<span class="tag ${p ? 'ok' : 'warn'}">${p ? 'Publié' : 'Brouillon'}</span>`;

  window.editChapter = safe(async function (id, tab) {
    tab = tab || 'courses';
    const c = $('#pageContent'); c.innerHTML = '<div class="empty">Chargement du chapitre…</div>';
    const d = await api(`/api/admin/chapters/${id}/content`);
    const nC = d.courses.length, nQ = d.questions.length, nF = d.flashcards.length;
    const published = d.courses.some(x => x.is_published) || d.questions.some(x => x.is_published) || d.flashcards.some(x => x.is_published);
    $('#pageTitle').textContent = 'Vérifier le chapitre';
    c.innerHTML = `<button class="btn secondary" onclick="navigate('manage')">← Contenus</button>
      <div class="section-head"><div><span class="eyebrow">CHAPITRE</span><h3>${escapeHtml(d.chapter.title)}</h3></div>
      <div class="row">${pubTag(published)}${published ? `<button class="btn secondary" onclick="publishChapter(${id},false)">Dépublier</button>` : ''}<button class="btn primary" onclick="publishChapter(${id},true)">${published ? 'Republier tout' : '✓ Valider et publier'}</button></div></div>
      ${nC >= 1 && nQ >= 10 && nF >= 1 ? '' : `<p class="warn-box">Pour publier il faut au moins 1 cours, 10 questions et 1 flashcard (actuellement ${nC} / ${nQ} / ${nF}).</p>`}
      <div class="tabs">${[['courses', `Cours & fiches (${nC})`], ['quiz', `Quiz (${nQ})`], ['cards', `Flashcards (${nF})`]].map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" onclick="editChapter(${id},'${k}')">${l}</button>`).join('')}</div><div id="edBody"></div>`;
    const body = $('#edBody');
    if (tab === 'courses') {
      body.innerHTML = `<details class="newitem" data-kind="c"><summary><b>＋ Ajouter une section manuellement</b></summary><input class="field c-title" placeholder="Titre (ex. Exercices supplémentaires)"><textarea class="field c-content" rows="8" placeholder="Contenu (Markdown simple : ## titre, - liste, **gras**)"></textarea><button class="btn primary" data-act="add">Ajouter</button></details>` +
        d.courses.map(x => `<details class="item" data-kind="c" data-id="${x.id}" ${x.title === 'Fiche de révision' ? 'open' : ''}><summary><b>${escapeHtml(x.title)}</b> ${pubTag(x.is_published)}</summary><input class="field c-title" value="${escapeAttr(x.title)}"><textarea class="field c-content" rows="14">${escapeHtml(x.content)}</textarea><div class="preview md card hidden"></div><div class="row"><button class="btn secondary" data-act="preview">Aperçu</button><button class="btn primary" data-act="save">Enregistrer</button><button class="btn danger" data-act="del">Supprimer</button></div></details>`).join('');
    } else if (tab === 'quiz') {
      body.innerHTML = `<p class="muted tiny">${nQ} question(s) — l'élève en reçoit 10 au hasard à chaque tentative (idéal : 50 à 100).</p><details class="newitem" data-kind="q"><summary><b>＋ Ajouter une question</b></summary>${qFields({})}<button class="btn primary" data-act="add">Ajouter</button></details>` +
        d.questions.map((x, i) => `<details class="item" data-kind="q" data-id="${x.id}"><summary>${i + 1}. ${escapeHtml(trunc(x.question, 90))} ${pubTag(x.is_published)}</summary>${qFields(x)}<div class="row"><button class="btn primary" data-act="save">Enregistrer</button><button class="btn secondary" data-act="regen">↻ Régénérer avec Groq</button><button class="btn danger" data-act="del">Supprimer</button></div></details>`).join('');
    } else {
      body.innerHTML = `<p class="muted tiny">${nF} flashcard(s).</p><details class="newitem" data-kind="f"><summary><b>＋ Ajouter une flashcard</b></summary>${fFields({})}<button class="btn primary" data-act="add">Ajouter</button></details>` +
        d.flashcards.map((x, i) => `<details class="item" data-kind="f" data-id="${x.id}"><summary>${i + 1}. ${escapeHtml(trunc(x.front, 90))} ${pubTag(x.is_published)}</summary>${fFields(x)}<div class="row"><button class="btn primary" data-act="save">Enregistrer</button><button class="btn secondary" data-act="regen">↻ Régénérer avec Groq</button><button class="btn danger" data-act="del">Supprimer</button></div></details>`).join('');
    }
    body.oninput = e => {   // garde la liste "bonne réponse" synchronisée avec les propositions
      if (!e.target.classList.contains('q-choices')) return;
      const el = e.target.closest('[data-kind]'), sel = el.querySelector('.q-correct'), prev = sel.value;
      const lines = e.target.value.split('\n').map(x => x.trim()).filter(Boolean);
      sel.innerHTML = lines.map(o => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join(''); if (lines.includes(prev)) sel.value = prev;
    };
    body.onclick = safe(async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const el = b.closest('[data-kind]'), kind = el.dataset.kind, act = b.dataset.act, iid = el.dataset.id;
      const base = { c: 'courses', q: 'questions', f: 'flashcards' }[kind];
      if (act === 'preview') { const p = el.querySelector('.preview'); p.innerHTML = md(el.querySelector('.c-content').value); p.classList.toggle('hidden'); return; }
      if (act === 'del') { if (!confirm('Supprimer cet élément ?')) return; await api(`/api/admin/${base}/${iid}`, { method: 'DELETE' }); toast('Supprimé'); editChapter(id, tab); return; }
      if (act === 'regen') {
        const old = b.textContent; b.disabled = true; b.textContent = 'Groq réfléchit…';
        try {
          const r = await api(`/api/admin/${base}/${iid}/regenerate`, { method: 'POST', body: '{}' }); const p = r.proposal;
          if (kind === 'q') {
            el.querySelector('.q-text').value = p.question; el.querySelector('.q-choices').value = p.choices.join('\n');
            el.querySelector('.q-correct').innerHTML = p.choices.map(o => `<option value="${escapeAttr(o)}" ${o === p.correct_answer ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
            el.querySelector('.q-expl').value = p.explanation || ''; el.querySelector('.q-diff').value = p.difficulty;
          } else { el.querySelector('.f-front').value = p.front; el.querySelector('.f-back').value = p.back; }
          toast('Proposition chargée : vérifie, puis clique sur Enregistrer.');
        } finally { b.disabled = false; b.textContent = old; }
        return;
      }
      let payload;
      if (kind === 'c') payload = { title: el.querySelector('.c-title').value.trim(), content: el.querySelector('.c-content').value.trim() };
      else if (kind === 'q') payload = readQ(el);
      else payload = { front: el.querySelector('.f-front').value.trim(), back: el.querySelector('.f-back').value.trim() };
      if (act === 'save') { await api(`/api/admin/${base}/${iid}`, { method: 'PATCH', body: JSON.stringify(payload) }); toast('Enregistré ✓'); return; }
      if (act === 'add') {
        if (kind === 'q') { payload.options = payload.choices; delete payload.choices; }
        payload.chapter_id = Number(id);
        await api(`/api/admin/${base}`, { method: 'POST', body: JSON.stringify(payload) }); toast('Ajouté (brouillon)'); editChapter(id, tab);
      }
    });
  });

  window.publishChapter = safe(async (id, pub) => {
    if (pub && !confirm('Publier ce chapitre ? Les élèves verront le cours, la fiche, le quiz et les flashcards.')) return;
    if (!pub && !confirm('Retirer ce chapitre du site ? Les élèves ne le verront plus.')) return;
    await api(`/api/admin/chapters/${id}/publish`, { method: 'POST', body: JSON.stringify({ published: pub }) });
    toast(pub ? 'Chapitre publié ✓' : 'Chapitre dépublié'); editChapter(id);
  });

  const aiNav = document.querySelector('.nav[data-page="ai"]'); if (aiNav) aiNav.innerHTML = '<span>✦</span> Générer avec Groq';
})();
