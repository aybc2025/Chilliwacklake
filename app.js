// PWA install prompt
let deferredPrompt;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

// Simple router for tabs
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(b => b.classList.remove('active'));
  panels.forEach(p => p.classList.remove('show'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab).classList.add('show');
  maybeUnlockExplorer();
}));

// Load data
let DATA;
fetch('./data/park.json')
 .then(r => r.json())
 .then(d => {
   DATA = d;
   renderFacts();
   renderLoops();
   setupPackGame();
   setupQuiz();
   setupWeather();
   setupPlan();
   renderStickers();
 });

// Facts
function renderFacts(){
  const ul = document.getElementById('factsList');
  ul.innerHTML = DATA.facts.map(f => `<li>✅ ${f}</li>`).join('');
}

// Loops grid
function renderLoops(){
  const grid = document.getElementById('loopsGrid');
  grid.innerHTML = DATA.loops.map(l => `
    <article class="loop">
      <h4>${l.emoji} ${l.name}</h4>
      <p>${l.blurb}</p>
    </article>
  `).join('');
}

// Pack game
let score = 0;
function setupPackGame(){
  const items = [...DATA.packing.yes.map(x => ({name:x, good:true})), ...DATA.packing.no.map(x => ({name:x, good:false}))];
  // shuffle
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  const ul = document.getElementById('packItems');
  ul.innerHTML = items.map((it,idx)=> `<li draggable="true" data-good="${it.good}" id="it-${idx}">${it.good?'🟢':'🔴'} ${it.name}</li>`).join('');
  const drop = document.getElementById('dropZone');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('ok'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('ok'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const li = document.getElementById(id);
    if (!li) return;
    const good = li.dataset.good === 'true';
    score += good ? 10 : -5;
    document.getElementById('score').textContent = score;
    li.remove();
    drop.classList.remove('ok');
    if (good && document.querySelectorAll('#packItems li[data-good="true"]').length === 0) {
      unlock('packer');
    }
  });
  document.querySelectorAll('#packItems li').forEach(li => {
    li.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', li.id));
  });
}

// Quiz
let qIndex = 0;
function setupQuiz(){
  qIndex = 0;
  renderQ();
  document.getElementById('nextQ').addEventListener('click', nextQ);
}
function renderQ(){
  const qb = document.getElementById('quizBox');
  const q = DATA.quiz[qIndex];
  qb.innerHTML = `<h3>${q.q}</h3>` + q.answers.map((a,i)=>`<button data-i="${i}" class="opt">${a}</button>`).join('');
  qb.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', checkA));
}
function checkA(e){
  const btn = e.currentTarget;
  const i = Number(btn.dataset.i);
  const q = DATA.quiz[qIndex];
  const qb = document.getElementById('quizBox');
  qb.querySelectorAll('button').forEach(b => b.disabled = true);
  if (i === q.correct) {
    btn.style.background = '#22c55e'; btn.style.color = '#063';
    qb.insertAdjacentHTML('beforeend', `<p>נכון! ${q.explain}</p>`);
    if (qIndex === DATA.quiz.length - 1) unlock('safety');
  } else {
    btn.style.background = '#ef4444';
    qb.insertAdjacentHTML('beforeend', `<p>לא מדויק. ${q.explain}</p>`);
  }
}
function nextQ(){
  if (qIndex < DATA.quiz.length - 1) {
    qIndex++; renderQ();
  } else {
    qIndex = 0; renderQ();
  }
}

// Weather slider
function setupWeather(){
  const slider = document.getElementById('timeSlider');
  const timeVal = document.getElementById('timeVal');
  const waves = document.querySelector('.waves');
  const boat = document.querySelector('.boat');
  function upd(){
    const h = Number(slider.value);
    timeVal.textContent = `${h.toString().padStart(2,'0')}:00`;
    // More wind 14-18
    const wind = Math.max(0, Math.min(1, (h - 12) / 6)); // 0 at 12:00, ~1 by 18:00
    waves.style.height = `${40 + wind*40}px`;
    waves.style.opacity = `${0.6 + wind*0.4}`;
    boat.style.top = `${20 + wind*10}px`;
  }
  slider.addEventListener('input', upd);
  upd();
}

// Day planner
function setupPlan(){
  document.getElementById('makePlan').addEventListener('click', ()=>{
    const m = document.getElementById('morning').value;
    const n = document.getElementById('noon').value;
    const e = document.getElementById('eve').value;
    const txt = `🕗 בוקר: ${m}\n🕛 צהריים: ${n}\n🕖 ערב: ${e}\nטיפ: זכרו שעות שקט 22:00–07:00 ושמרו אוכל ברכב.`;
    document.getElementById('planOut').textContent = txt;
  });
}

// Stickers (achievements)
function renderStickers(){
  const ul = document.getElementById('stickerList');
  const have = getAch();
  ul.innerHTML = DATA.achievements.map(a=>{
    const got = have.includes(a.id);
    return `<li><span>${got?'🏆':'🔒'}</span><div><strong>${a.name}</strong><div>${a.desc}</div></div></li>`;
  }).join('');
}
function getAch(){
  try { return JSON.parse(localStorage.getItem('achievements')||'[]'); } catch { return []; }
}
function unlock(id){
  const have = getAch();
  if (!have.includes(id)) {
    have.push(id);
    localStorage.setItem('achievements', JSON.stringify(have));
    renderStickers();
    maybeUnlockExplorer();
  }
}
function maybeUnlockExplorer(){
  // Explorer unlock when user visited at least 5 panels (simple heuristic)
  const activeId = document.querySelector('.panel.show')?.id;
  const seen = new Set(JSON.parse(localStorage.getItem('seenPanels')||'[]'));
  if (activeId) { seen.add(activeId); }
  localStorage.setItem('seenPanels', JSON.stringify([...seen]));
  if (seen.size >= 5) unlock('explorer');
}
