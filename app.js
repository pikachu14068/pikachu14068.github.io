const API = window.REVISPACE_CONFIG.API_BASE;
const $ = s => document.querySelector(s);
let token = sessionStorage.getItem('rv_token') || '';
let currentUser = null;
let currentChapter = null;
let quizItems = [];
let quizAnswers = {};
let flashItems = [];
let flashIndex = 0;
let flashBack = false;
let subjectsCache = [];

function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
async function api(path,options={}){
  const headers={'Content-Type':'application/json',...(options.headers||{})};
  if(token) headers.Authorization='Bearer '+token;
  const response=await fetch(API+path,{...options,headers});
  const data=await response.json().catch(()=>({error:'Réponse invalide du serveur.'}));
  if(response.status===401 && path!='/api/auth/login'){logout(false);throw new Error('Session expirée. Reconnecte-toi.')}
  if(!response.ok) throw new Error(data.error||'Une erreur est survenue.');
  return data;
}
function showApp(){
  $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');
  $('#sideUsername').textContent=currentUser.username;$('#topUsername').textContent=currentUser.username;
  $('#avatar').textContent=currentUser.username.slice(0,1).toUpperCase();
  $('#sideRole').textContent=currentUser.role==='admin'?'Administrateur':'Élève';
  $('#adminNav').classList.toggle('hidden',currentUser.role!=='admin');
  navigate(currentUser.role==='admin'?'admin':'home');
}
function showLogin(){ $('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden'); }
async function logout(callApi=true){
  if(callApi && token){try{await api('/api/auth/logout',{method:'POST',body:'{}'})}catch{}}
  token='';currentUser=null;sessionStorage.removeItem('rv_token');showLogin();
}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('#loginError').textContent='';
  try{
    const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:$('#username').value,password:$('#password').value})});
    token=data.token;sessionStorage.setItem('rv_token',token);currentUser=data.user;$('#password').value='';showApp();
  }catch(err){$('#loginError').textContent=err.message}
});

$('#showRegister').addEventListener('click',()=>{
  $('#loginForm').classList.add('hidden');
  $('#registerForm').classList.remove('hidden');
  $('#registerError').textContent='';
});

$('#showLogin').addEventListener('click',()=>{
  $('#registerForm').classList.add('hidden');
  $('#loginForm').classList.remove('hidden');
  $('#loginError').textContent='';
});

$('#registerForm').addEventListener('submit',async e=>{
  e.preventDefault();
  $('#registerError').textContent='';
  const username=$('#registerUsername').value.trim();
  const password=$('#registerPassword').value;
  const confirmation=$('#registerConfirmation').value;

  try{
    const data=await api('/api/auth/register',{
      method:'POST',
      body:JSON.stringify({username,password,confirmation})
    });
    token=data.token;
    sessionStorage.setItem('rv_token',token);
    currentUser=data.user;
    $('#registerPassword').value='';
    $('#registerConfirmation').value='';
    showApp();
  }catch(err){
    $('#registerError').textContent=err.message;
  }
});
$('#logoutBtn').addEventListener('click',()=>logout());

function navigate(page){
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const titles={home:'Vue d’ensemble',subjects:'Mes matières',points:'Mes points',admin:'Tableau administrateur',manage:'Gestion des contenus',users:'Utilisateurs',ai:'Assistant Groq',logs:'Journal administrateur'};
  $('#pageTitle').textContent=titles[page]||'RéviSpace';
  if(page==='home') renderHome();
  else if(page==='subjects') renderSubjects();
  else if(page==='points') renderPoints();
  else if(page==='admin') renderAdmin();
  else if(page==='manage') renderManage();
  else if(page==='users') renderUsers();
  else if(page==='ai') renderAI();
  else if(page==='logs') renderLogs();
}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
$('#dateLabel').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();

async function renderHome(){
  const c=$('#pageContent');c.innerHTML='<div class="empty">Chargement…</div>';
  try{
    const d=await api('/api/dashboard');
    c.innerHTML=`<div class="welcome"><span class="eyebrow">BIENVENUE SUR RÉVISPACE</span><h2>Salut ${escapeHtml(d.user.username)} ! 👋</h2><p>Prêt à apprendre quelque chose de nouveau aujourd’hui ?</p></div>
    <div class="stats"><div class="stat"><small>Mes points</small><strong>✧ ${d.user.points}</strong></div><div class="stat"><small>Matières disponibles</small><strong>${d.subjects}</strong></div><div class="stat"><small>Quiz effectués</small><strong>${d.quizAttempts}</strong></div><div class="stat"><small>Flashcards disponibles</small><strong>${d.flashcards}</strong></div></div>
    <div class="section-head"><h3>Continue tes révisions</h3><button class="btn secondary" onclick="navigate('subjects')">Voir les matières →</button></div>
    <div class="card"><b>Un petit pas chaque jour ✦</b><p class="muted">Choisis une matière, révise un cours, puis teste tes connaissances avec un quiz de 10 questions.</p></div>`;
  }catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function renderSubjects(){
  const c=$('#pageContent');c.innerHTML='<div class="empty">Chargement des matières…</div>';
  try{
    const d=await api('/api/subjects');subjectsCache=d.subjects;
    c.innerHTML=`<div class="section-head"><h3>Toutes tes matières</h3><span class="tag">${d.subjects.length} matière(s)</span></div>`+
      (d.subjects.length?`<div class="grid">${d.subjects.map(s=>`<div class="subject-card" onclick="openSubject(${s.id},'${escapeAttr(s.name)}')"><div class="subject-icon">✦</div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description||'Découvre les chapitres de cette matière.')}</p><small>${s.chapters_count} chapitre(s) →</small></div>`).join('')}</div>`:'<div class="empty">Aucune matière pour le moment. L’administration pourra bientôt en ajouter.</div>');
  }catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function openSubject(id,name){
  const c=$('#pageContent');c.innerHTML=`<button class="btn secondary" onclick="navigate('subjects')">← Retour</button><h3>${escapeHtml(name)}</h3><div class="empty">Chargement…</div>`;
  try{const d=await api(`/api/subjects/${id}/chapters`);
    c.innerHTML=`<button class="btn secondary" onclick="navigate('subjects')">← Retour aux matières</button><div class="section-head"><h3>${escapeHtml(name)}</h3></div>`+
    (d.chapters.length?d.chapters.map(ch=>`<div class="chapter-row"><div><b>${escapeHtml(ch.title)}</b><small>${escapeHtml(ch.description||'Chapitre de révision')}</small></div><div class="row"><button class="btn secondary" onclick="openCourse(${ch.id})">Cours</button><button class="btn secondary" onclick="startQuiz(${ch.id})">Quiz</button><button class="btn secondary" onclick="startFlashcards(${ch.id})">Cartes</button></div></div>`).join(''):'<div class="empty">Aucun chapitre dans cette matière.</div>');
  }catch(e){toast(e.message)}
}
async function openCourse(id){
  const c=$('#pageContent');c.innerHTML='<div class="empty">Chargement du cours…</div>';
  try{const d=await api(`/api/chapters/${id}/course`);
    c.innerHTML=`<button class="btn secondary" onclick="navigate('subjects')">← Matières</button><div class="section-head"><h3>Le cours</h3></div>`+
    (d.courses.length?d.courses.map(x=>`<article class="card"><h3>${escapeHtml(x.title)}</h3><div class="course-text">${escapeHtml(x.content).replace(/\n/g,'<br>')}</div></article>`).join(''):'<div class="empty">Aucun cours publié pour ce chapitre.</div>');
  }catch(e){toast(e.message)}
}
async function startQuiz(id){
  currentChapter=id;quizAnswers={};const c=$('#pageContent');c.innerHTML='<div class="empty">Préparation du quiz…</div>';
  try{const d=await api(`/api/chapters/${id}/quiz`);quizItems=d.questions;
    if(!quizItems.length){c.innerHTML='<div class="empty">Pas encore assez de questions publiées pour ce chapitre.</div>';return}
    renderQuiz();
  }catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
function renderQuiz(){
  const c=$('#pageContent');
  c.innerHTML=`<div class="section-head"><div><span class="eyebrow">ENTRAÎNEMENT</span><h3>Quiz · ${quizItems.length} question(s)</h3></div><span class="tag">2 points par bonne réponse</span></div>`+
  quizItems.map((q,i)=>`<div class="question" style="margin-bottom:13px"><small class="eyebrow">QUESTION ${i+1}/${quizItems.length}</small><h3>${escapeHtml(q.question)}</h3>${q.options.map(o=>`<button class="option ${quizAnswers[q.id]===o?'selected':''}" onclick="chooseAnswer(${q.id},'${escapeAttr(o)}')">${escapeHtml(o)}</button>`).join('')}</div>`).join('')+
  `<button class="btn primary" onclick="submitQuiz()">Terminer le quiz →</button>`;
}
function chooseAnswer(id,value){quizAnswers[id]=value;renderQuiz()}
async function submitQuiz(){
  if(Object.keys(quizAnswers).length!==quizItems.length){toast('Réponds à toutes les questions avant de terminer.');return}
  try{const d=await api('/api/quiz/submit',{method:'POST',body:JSON.stringify({answers:quizItems.map(q=>({questionId:q.id,answer:quizAnswers[q.id]}))})});
    $('#pageContent').innerHTML=`<div class="card center"><span class="eyebrow">QUIZ TERMINÉ</span><h2 style="font:800 38px Manrope">${d.score}/${d.total}</h2><h3>${d.score===d.total?'Excellent travail ! ✨':'Bien joué, continue !'}</h3><p class="muted">Tu gagnes ${d.points} points.</p><button class="btn primary" onclick="navigate('subjects')">Retour aux matières</button></div>`;
  }catch(e){toast(e.message)}
}
async function startFlashcards(id){
  const c=$('#pageContent');c.innerHTML='<div class="empty">Chargement des flashcards…</div>';
  try{const d=await api(`/api/chapters/${id}/flashcards`);flashItems=d.flashcards;flashIndex=0;flashBack=false;
    if(!flashItems.length){c.innerHTML='<div class="empty">Aucune flashcard publiée pour ce chapitre.</div>';return}renderFlashcard();
  }catch(e){toast(e.message)}
}
function renderFlashcard(){
  const f=flashItems[flashIndex];
  $('#pageContent').innerHTML=`<div class="section-head"><div><span class="eyebrow">MÉMORISATION</span><h3>Flashcards</h3></div><span class="tag">${flashIndex+1} / ${flashItems.length}</span></div>
  <div class="flashcard" onclick="flipCard()"><div><small class="eyebrow">${flashBack?'RÉPONSE':'QUESTION · CLIQUE POUR RETOURNER'}</small><p><strong>${escapeHtml(flashBack?f.back:f.front)}</strong></p></div></div>
  <div class="row" style="justify-content:center;margin-top:16px"><button class="btn secondary" onclick="prevCard()">← Précédente</button><button class="btn primary" onclick="flipCard()">Retourner</button><button class="btn secondary" onclick="nextCard()">Suivante →</button></div>`;
}
function flipCard(){flashBack=!flashBack;renderFlashcard()}function nextCard(){flashIndex=(flashIndex+1)%flashItems.length;flashBack=false;renderFlashcard()}function prevCard(){flashIndex=(flashIndex-1+flashItems.length)%flashItems.length;flashBack=false;renderFlashcard()}
async function renderPoints(){
  const c=$('#pageContent');try{const d=await api('/api/points/history');c.innerHTML=`<div class="welcome"><span class="eyebrow">TA PROGRESSION</span><h2>✧ ${currentUser.points} points</h2><p>Chaque bonne réponse te fait progresser.</p></div><div class="section-head"><h3>Historique des points</h3></div>`+
  (d.history.length?`<div class="table-wrap"><table><thead><tr><th>Motif</th><th>Points</th><th>Date</th></tr></thead><tbody>${d.history.map(x=>`<tr><td>${escapeHtml(x.reason)}</td><td>${x.amount>0?'+':''}${x.amount}</td><td>${new Date(x.created_at).toLocaleString('fr-FR')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Pas encore d’historique.</div>')}catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function renderAdmin(){
  const c=$('#pageContent');try{const d=await api('/api/admin/overview');c.innerHTML=`<div class="welcome"><span class="eyebrow">ESPACE ADMINISTRATEUR</span><h2>Centre de contrôle</h2><p>Gère les contenus et accompagne les élèves depuis un seul endroit.</p></div><div class="stats"><div class="stat"><small>Utilisateurs</small><strong>${d.users}</strong></div><div class="stat"><small>Matières</small><strong>${d.subjects}</strong></div><div class="stat"><small>Questions</small><strong>${d.questions}</strong></div><div class="stat"><small>En ligne récemment</small><strong>${d.online}</strong></div></div><div class="grid"><div class="card"><h3>📚 Contenus</h3><p class="muted">Ajoute matières, chapitres, cours et exercices.</p><button class="btn secondary" onclick="navigate('manage')">Gérer les contenus</button></div><div class="card"><h3>♙ Utilisateurs</h3><p class="muted">Crée des comptes et ajuste les points.</p><button class="btn secondary" onclick="navigate('users')">Gérer les comptes</button></div><div class="card"><h3>✦ Assistant Groq</h3><p class="muted">Génère des brouillons de quiz et flashcards.</p><button class="btn secondary" onclick="navigate('ai')">Ouvrir l’assistant</button></div></div>`}catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function renderManage(){
  const c=$('#pageContent');try{const d=await api('/api/subjects');subjectsCache=d.subjects;
    c.innerHTML=`<div class="grid"><div class="card"><h3>Ajouter une matière</h3><form id="subjectForm" class="stack"><input class="field" name="name" placeholder="Ex. Mathématiques" required><textarea class="field" name="description" placeholder="Description"></textarea><button class="btn primary">Créer la matière</button></form></div>
    <div class="card"><h3>Ajouter un chapitre</h3><form id="chapterForm" class="stack"><select class="field" name="subject_id" required>${d.subjects.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select><input class="field" name="title" placeholder="Titre du chapitre" required><input class="field" name="description" placeholder="Description"><button class="btn primary">Créer le chapitre</button></form></div>
    <div class="card"><h3>Ajouter un cours (brouillon)</h3><form id="courseForm" class="stack"><select class="field" name="chapter_id" id="courseChapter" required></select><input class="field" name="title" placeholder="Titre du cours" required><textarea class="field" name="content" placeholder="Contenu du cours…" required></textarea><button class="btn primary">Enregistrer le brouillon</button></form></div></div>
    <div class="section-head"><h3>Banque d’exercices</h3></div><div class="grid"><div class="card"><h3>Nouvelle question</h3><form id="questionForm" class="stack"><select class="field chapter-options" name="chapter_id" required></select><textarea class="field" name="question" placeholder="Énoncé" required></textarea><textarea class="field" name="options" placeholder="Une réponse par ligne (la bonne doit être identique)" required></textarea><input class="field" name="correct_answer" placeholder="Réponse correcte exacte" required><input class="field" name="explanation" placeholder="Explication"><button class="btn primary">Créer le brouillon</button></form></div><div class="card"><h3>Nouvelle flashcard</h3><form id="flashForm" class="stack"><select class="field chapter-options" name="chapter_id" required></select><input class="field" name="front" placeholder="Recto / question" required><textarea class="field" name="back" placeholder="Verso / réponse" required></textarea><button class="btn primary">Créer le brouillon</button></form></div></div>
    <p class="muted tiny">Les contenus sont enregistrés en brouillon. La publication doit être activée depuis les outils d’administration après vérification.</p>`;
    const allChapters=[];for(const s of d.subjects){const ch=await api(`/api/subjects/${s.id}/chapters`);allChapters.push(...ch.chapters)}
    const opts=allChapters.map(x=>`<option value="${x.id}">${escapeHtml(x.title)}</option>`).join('');
    $('#courseChapter').innerHTML=opts;document.querySelectorAll('.chapter-options').forEach(el=>el.innerHTML=opts);
    $('#subjectForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api('/api/admin/subjects',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});toast('Matière créée');renderManage()};
    $('#chapterForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api('/api/admin/chapters',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});toast('Chapitre créé');renderManage()};
    $('#courseForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api('/api/admin/courses',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});toast('Cours enregistré en brouillon');e.target.reset()};
    $('#questionForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),o=Object.fromEntries(f);o.options=o.options.split('\n').map(x=>x.trim()).filter(Boolean);await api('/api/admin/questions',{method:'POST',body:JSON.stringify(o)});toast('Question enregistrée en brouillon');e.target.reset()};
    $('#flashForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await api('/api/admin/flashcards',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});toast('Flashcard enregistrée en brouillon');e.target.reset()};
  }catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function renderUsers(){
  const c=$('#pageContent');try{const d=await api('/api/admin/users');
    c.innerHTML=`<div class="card"><h3>Créer un compte</h3><form id="newUser" class="row"><input class="field small" name="username" placeholder="Pseudo" required><input class="field small" name="password" type="password" minlength="12" placeholder="Mot de passe (12+)" required><select class="field small" name="role"><option value="student">Élève</option><option value="admin">Administrateur</option></select><button class="btn primary">Créer</button></form></div><div class="section-head"><h3>Comptes existants</h3><span class="tag">${d.users.length} compte(s)</span></div><div class="table-wrap"><table><thead><tr><th>Pseudo</th><th>Rôle</th><th>Points</th><th>Statut</th><th>Dernière activité</th><th>Actions</th></tr></thead><tbody>${d.users.map(u=>`<tr><td>${escapeHtml(u.username)}</td><td>${u.role}</td><td>${u.points}</td><td>${u.is_active?'Actif':'Désactivé'}</td><td>${u.last_seen?new Date(u.last_seen).toLocaleString('fr-FR'):'—'}</td><td><button class="btn secondary" onclick="changePoints(${u.id})">Points ±</button> <button class="btn secondary" onclick="toggleUser(${u.id},${!u.is_active})">${u.is_active?'Désactiver':'Activer'}</button></td></tr>`).join('')}</tbody></table></div>`;
    $('#newUser').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/api/admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});toast('Compte créé');renderUsers()}catch(err){toast(err.message)}};
  }catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function changePoints(id){const amount=prompt('Nombre de points à ajouter ou retirer (ex. 10 ou -5)');if(amount===null)return;const reason=prompt('Motif de la modification :');if(!reason)return;try{await api(`/api/admin/users/${id}/points`,{method:'PATCH',body:JSON.stringify({amount:Number(amount),reason})});toast('Points modifiés');renderUsers()}catch(e){toast(e.message)}}
async function toggleUser(id,is_active){if(!confirm(is_active?'Réactiver ce compte ?':'Désactiver ce compte ?'))return;try{await api(`/api/admin/users/${id}/status`,{method:'PATCH',body:JSON.stringify({is_active})});toast('Statut modifié');renderUsers()}catch(e){toast(e.message)}}
async function renderAI(){
  const c=$('#pageContent');
  c.innerHTML=`<div class="card"><span class="eyebrow">GROQ · IMPORT ET GÉNÉRATION</span><h3>Importer un cours et générer les révisions</h3><p class="muted">Les contenus générés sont privés et restent en brouillon jusqu'à leur validation par un administrateur.</p>
  <form id="genForm" class="stack">
    <label>Matière<select class="field" id="genSubject" required></select></label>
    <label>Chapitre existant<select class="field" id="genChapter"></select></label>
    <details><summary>Créer un nouveau chapitre</summary><div class="stack"><input class="field" id="newChapterTitle" placeholder="Titre du chapitre"><input class="field" id="newChapterDescription" placeholder="Description (facultative)"><button class="btn secondary" type="button" id="createChapter">Créer le chapitre</button></div></details>
    <label>Importer un document (PDF texte, DOCX, TXT, MD)</label><input class="field" id="genFile" type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp">
    <label>Ou coller directement le contenu du cours</label><textarea class="field" id="genText" rows="10" placeholder="Colle ici le cours source (200 caractères minimum)"></textarea>
    <button class="btn primary" type="submit">Envoyer à Groq et créer les brouillons</button>
  </form><div id="genResult" aria-live="polite"></div></div>
  <div class="card"><h3>Assistant de propositions rapides</h3><form id="aiForm" class="stack"><select class="field" name="type"><option value="questions">Questions de quiz</option><option value="flashcards">Flashcards</option></select><input class="field" name="topic" placeholder="Sujet" required><input class="field" name="count" type="number" min="1" max="20" value="10"><button class="btn secondary">Générer avec Groq</button></form><div id="aiResult"></div></div>`;
  const subjects=await api('/api/subjects'); const subjectSel=$('#genSubject');
  subjectSel.innerHTML=subjects.subjects.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
  async function loadChapters(){const id=subjectSel.value;if(!id)return;const d=await api(`/api/subjects/${id}/chapters`);$('#genChapter').innerHTML=d.chapters.map(x=>`<option value="${x.id}">${escapeHtml(x.title)}</option>`).join('');}
  subjectSel.onchange=loadChapters;await loadChapters();
  $('#createChapter').onclick=async()=>{try{const d=await api('/api/admin/chapters',{method:'POST',body:JSON.stringify({subject_id:Number(subjectSel.value),title:$('#newChapterTitle').value,description:$('#newChapterDescription').value})});await loadChapters();$('#genChapter').value=d.chapter?.id||$('#genChapter').value;toast('Chapitre créé');}catch(e){$('#genResult').innerHTML=`<p class="error">${escapeHtml(e.message)}</p>`}};
  async function showDraftReview(chapterId){
    const d=await api(`/api/admin/chapters/${chapterId}/content`);
    const box=document.createElement('div');box.className='card';box.id='draftReview';
    const esc=escapeHtml;
    box.innerHTML=`<h3>Révision des brouillons privés</h3><p class="muted">Ces éléments ne sont pas visibles par les élèves. Modifie ou supprime les éléments avant publication.</p>
    <h4>Cours (${d.courses.length})</h4>${d.courses.map(x=>`<div class="card"><input class="field" data-field="title" value="${esc(x.title)}"><textarea class="field" rows="8" data-field="content">${esc(x.content)}</textarea><button class="btn secondary" data-save="courses" data-id="${x.id}">Enregistrer le cours</button> <button class="btn danger" data-delete="courses" data-id="${x.id}">Supprimer</button></div>`).join('')}
    <h4>Questions QCM (${d.questions.length})</h4>${d.questions.map(x=>`<div class="card"><textarea class="field" data-field="question">${esc(x.question)}</textarea><textarea class="field" data-field="choices">${esc((x.choices||[]).join('\n'))}</textarea><input class="field" data-field="correct_answer" value="${esc(x.correct_answer)}"><input class="field" data-field="explanation" value="${esc(x.explanation||'')}"><button class="btn secondary" data-save="questions" data-id="${x.id}">Enregistrer la question</button> <button class="btn danger" data-delete="questions" data-id="${x.id}">Supprimer</button></div>`).join('')}
    <h4>Flashcards (${d.flashcards.length})</h4>${d.flashcards.map(x=>`<div class="card"><input class="field" data-field="front" value="${esc(x.front)}"><textarea class="field" data-field="back">${esc(x.back)}</textarea><button class="btn secondary" data-save="flashcards" data-id="${x.id}">Enregistrer la carte</button> <button class="btn danger" data-delete="flashcards" data-id="${x.id}">Supprimer</button></div>`).join('')}
    <button class="btn primary" id="publishChapter">Valider et publier</button><p class="muted tiny">La publication est volontaire et s'effectue en une transaction pour le chapitre.</p>`;
    $('#genResult').appendChild(box);
    box.onclick=async ev=>{const b=ev.target.closest('button');if(!b)return;try{
      if(b.id==='publishChapter'){if(!confirm('Publier tous les contenus non archivés de ce chapitre pour les élèves ?'))return;await api(`/api/admin/chapters/${chapterId}/publish`,{method:'POST',body:JSON.stringify({published:true})});toast('Chapitre publié');b.disabled=true;return;}
      const card=b.closest('.card');const id=Number(b.dataset.id);
      if(b.dataset.save){let payload={};card.querySelectorAll('[data-field]').forEach(el=>payload[el.dataset.field]=el.value);if(b.dataset.save==='questions')payload.choices=payload.choices.split('\n').map(x=>x.trim()).filter(Boolean);await api(`/api/admin/${b.dataset.save}/${id}`,{method:'PATCH',body:JSON.stringify(payload)});toast('Brouillon enregistré');}
      if(b.dataset.delete){if(!confirm('Supprimer définitivement cet élément ?'))return;await api(`/api/admin/${b.dataset.delete}/${id}`,{method:'DELETE'});card.remove();toast('Élément supprimé');}
    }catch(err){alert(err.message)}};
  }
  $('#genForm').onsubmit=async e=>{e.preventDefault();const result=$('#genResult');try{
    let source=$('#genText').value.trim();const file=$('#genFile').files[0];
    if(file){const headers={'Content-Type':'application/octet-stream'};if(token)headers.Authorization='Bearer '+token;const r=await fetch(API+'/api/admin/extract?mime_type='+encodeURIComponent(file.type||({'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.txt':'text/plain','.md':'text/markdown','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[file.name.slice(file.name.lastIndexOf('.')).toLowerCase()]||'application/octet-stream')),{method:'POST',headers,body:file});const d=await r.json();if(!r.ok)throw new Error(d.error||'Import impossible');source=d.text;}
    if(!source)throw new Error('Ajoute un fichier ou colle le texte du cours.');
    const started=await api('/api/admin/generate',{method:'POST',body:JSON.stringify({chapter_id:Number($('#genChapter').value),text:source})});
    result.innerHTML='<p class="muted">Génération ajoutée à la file d’attente…</p>';
    const poll=async()=>{try{const d=await api(`/api/admin/generate/${started.jobId}`);const j=d.job;result.innerHTML=`<p><b>${escapeHtml(j.step||j.status)}</b> · ${j.chunks_done}/${j.chunks_total||'…'} parties analysées</p><progress max="${Math.max(1,j.chunks_total||1)}" value="${j.chunks_done||0}" style="width:100%"></progress><p class="muted">Statut : ${escapeHtml(j.status)} · Contenus sauvegardés en brouillons privés.</p>${(j.errors||[]).length?`<ul class="error">${j.errors.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:''}${['done','partial','failed'].includes(j.status)?'<p>La génération est terminée. Les brouillons sont privés.</p>':''}`;if(!['done','partial','failed'].includes(j.status))setTimeout(poll,2500);else if(j.status!=='failed'&&!$('#draftReview'))await showDraftReview(Number($('#genChapter').value));}catch(err){result.innerHTML=`<p class="error">${escapeHtml(err.message)}</p>`}};
    poll();
  }catch(err){result.innerHTML=`<p class="error">Échec de la génération : ${escapeHtml(err.message)}</p>`}};
  $('#aiForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);$('#aiResult').innerHTML='<p class="muted">Génération en cours…</p>';try{const d=await api('/api/admin/ai/generate',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});$('#aiResult').innerHTML=`<div class="section-head"><h3>${d.items.length} proposition(s)</h3><span class="tag">Non publié</span></div><pre class="card" style="white-space:pre-wrap;overflow:auto">${escapeHtml(JSON.stringify(d.items,null,2))}</pre><p class="muted tiny">${escapeHtml(d.note)}</p>`}catch(err){$('#aiResult').innerHTML=`<p class="error">${escapeHtml(err.message)}</p>`}};
}
async function renderLogs(){const c=$('#pageContent');try{const d=await api('/api/admin/logs');c.innerHTML=`<div class="section-head"><h3>Dernières actions administrateur</h3></div><div class="table-wrap"><table><thead><tr><th>Admin</th><th>Action</th><th>Détails</th><th>Date</th></tr></thead><tbody>${d.logs.map(x=>`<tr><td>${escapeHtml(x.username||'Compte supprimé')}</td><td>${escapeHtml(x.action)}</td><td>${escapeHtml(JSON.stringify(x.details))}</td><td>${new Date(x.created_at).toLocaleString('fr-FR')}</td></tr>`).join('')}</tbody></table></div>`}catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/`/g,'&#96;')}
(async()=>{if(token){try{const d=await api('/api/auth/me');currentUser=d.user;showApp()}catch{logout(false)}}})();
