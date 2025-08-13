// --- App versioned storage ---
const APP_VERSION = '1.2';
try {
  const storedV = localStorage.getItem('appVersion');
  if (storedV !== APP_VERSION) {
    localStorage.removeItem('achievements');
    localStorage.removeItem('seenPanels');
    localStorage.setItem('appVersion', APP_VERSION);
  }
} catch {}

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
   setupPackGame();
   setupQuiz();
   setupWeather();
   setupPlan();
   renderStickers();
   setupMap();
 });

// Facts
function renderFacts(){
  const ul = document.getElementById('factsList');
  ul.innerHTML = DATA.facts.map(f => `<li>✅ ${f}</li>`).join('');
}

// Pack game (mobile-first: tap; desktop: drag or tap)
let score = 0;
const isTouch = window.matchMedia('(pointer: coarse)').matches;
function setupPackGame(){
  const items = [
    ...DATA.packing.yes.map(x => ({name:x, good:true})),
    ...DATA.packing.no.map(x => ({name:x, good:false}))
  ];
  // shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const ul = document.getElementById('packItems');
  ul.innerHTML = items.map((it,idx)=> `<li ${isTouch?'':'draggable="true"'} data-good="${it.good}" id="it-${idx}">${it.good?'🟢':'🔴'} ${it.name}</li>`).join('');
  const drop = document.getElementById('dropZone');

  // Desktop drag/drop
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('ok'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('ok'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const li = document.getElementById(id);
    if (!li) return;
    handlePack(li);
    drop.classList.remove('ok');
  });

  // Bind each item
  document.querySelectorAll('#packItems li').forEach(li => {
    li.addEventListener('dragstart', e => { try { e.dataTransfer.setData('text/plain', li.id); } catch{} });
    const packIt = () => handlePack(li);
    li.addEventListener('click', packIt, {passive:true});
    li.addEventListener('touchstart', packIt, {passive:true});
  });
}
function handlePack(li){
  const good = li.dataset.good === 'true';
  score += good ? 10 : -5;
  document.getElementById('score').textContent = score;
  li.remove();
  if (good && document.querySelectorAll('#packItems li[data-good="true"]').length === 0) {
    unlock('packer');
  }
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
    // More wind ~14–18
    const wind = Math.max(0, Math.min(1, (h - 12) / 6));
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
  }
}
function maybeUnlockExplorer(){
  const activeId = document.querySelector('.panel.show')?.id;
  const seen = new Set(JSON.parse(localStorage.getItem('seenPanels')||'[]'));
  const contentPanels = new Set(['home','map','pack','quiz','weather','plan']);
  if (activeId && contentPanels.has(activeId)) { seen.add(activeId); }
  localStorage.setItem('seenPanels', JSON.stringify([...seen]));
  if ([...seen].filter(id => contentPanels.has(id)).length >= 5) unlock('explorer');
}

// Reset achievements button
const resetBtn = document.getElementById('resetBtn');
resetBtn?.addEventListener('click', () => {
  localStorage.removeItem('achievements');
  localStorage.removeItem('seenPanels');
  renderStickers();
  alert('התקדמות אופסה במכשיר זה.');
});

// Interactive map
function setupMap(){
  const svg = document.getElementById('campSVG');
  const tip = document.getElementById('mapTip');
  if (!svg || !tip) return;
  function showTip(txt){
    tip.textContent = txt;
    tip.hidden = false;
  }
  svg.querySelectorAll('.hotspot').forEach(h => {
    const txt = h.dataset.info || '';
    const handler = () => showTip(txt);
    h.addEventListener('click', handler, {passive:true});
    h.addEventListener('touchstart', handler, {passive:true});
    h.setAttribute('tabindex','0');
    h.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTip(txt); }});
  });
}