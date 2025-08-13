// --- App versioned storage ---
const APP_VERSION = '1.4';
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
  if (t.dataset.tab === 'agreement') setupAgreementEmbed();
}));

// Load data
let DATA;
fetch('./data/park.json')
 .then(r => r.json())
 .then(d => {
   DATA = d;
   renderFacts();
   setupPackGame();
   setupSafetySort();
   setupBingo();
   setupComic();
   setupMiniMet();
   setupTrailFinder();
   setupQuiz();
   setupWeather();
   setupPlan();
   renderStickers();
   setupMap();
   setupPdfEmbed();
 });

// Facts
function renderFacts(){
  const ul = document.getElementById('factsList');
  ul.innerHTML = DATA.facts.map(f => `<li>✅ ${f}</li>`).join('');
}

// ---------- Utilities: achievements ----------
function getAch(){ try { return JSON.parse(localStorage.getItem('achievements')||'[]'); } catch { return []; } }
function unlock(id){
  const have = getAch();
  if (!have.includes(id)) {
    have.push(id);
    localStorage.setItem('achievements', JSON.stringify(have));
    renderStickers();
  }
}
function renderStickers(){
  const ul = document.getElementById('stickerList');
  const have = getAch();
  ul.innerHTML = (DATA.achievements||[]).map(a=>{
    const got = have.includes(a.id);
    return `<li><span>${got?'🏆':'🔒'}</span><div><strong>${a.name}</strong><div>${a.desc}</div></div></li>`;
  }).join('');
}
function maybeUnlockExplorer(){
  const activeId = document.querySelector('.panel.show')?.id;
  const seen = new Set(JSON.parse(localStorage.getItem('seenPanels')||'[]'));
  const contentPanels = new Set(['home','map','pdfmap','agreement','pack','safetysort','bingo','comic','met','trail','quiz','weather','plan']);
  if (activeId && contentPanels.has(activeId)) { seen.add(activeId); }
  localStorage.setItem('seenPanels', JSON.stringify([...seen]));
  if ([...seen].filter(id => contentPanels.has(id)).length >= 5) unlock('explorer');
}

// Reset achievements
document.getElementById('resetBtn')?.addEventListener('click', () => {
  localStorage.removeItem('achievements');
  localStorage.removeItem('seenPanels');
  renderStickers();
  alert('התקדמות אופסה במכשיר זה.');
});

// ---------- PACK GAME (mobile-first) ----------
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
  if (!ul) return;
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

  // Tap/Click
  document.querySelectorAll('#packItems li').forEach(li => {
    li.addEventListener('dragstart', e => { try { e.dataTransfer.setData('text/plain', li.id); } catch{} });
    const packIt = () => handlePack(li);
    li.addEventListener('click', packIt, {passive:true});
    li.addEventListener('touchstart', packIt, {passive:true});
    li.addEventListener('pointerdown', e => { if (isTouch) packIt(); }, {passive:true});
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

// ---------- SAFETY SORT ----------
function setupSafetySort(){
  const list = document.getElementById('safetyItems');
  if (!list) return;
  const EXPL = {
    "להשאיר אוכל בחוץ": "לא בטוח – מושך דובים וחיות בר. תמיד שומרים ברכב.",
    "לשים אוכל ברכב": "בטוח – כך מגינים על חיות הבר ועלינו.",
    "להאכיל סנאים": "לא בטוח – פוגע בחיות ומסכן אנשים.",
    "ללבוש אפוד ציפה": "בטוח – לכל מי שבמים/בסירה.",
    "לשחות רחוק מהחוף": "לא בטוח – האגם קר ויש רוחות/זרמים.",
    "להישאר קרוב לחוף": "בטוח – במיוחד כשיש רוח.",
    "לרוץ על המזח": "לא בטוח – מחליק ועלול לגרום לנפילה.",
    "לנעול את השער בלילה": "בטוח – שומרים על הסדר והכללים."
  };
  const CARDS = Object.keys(EXPL).map(name => ({
    name,
    good: ["לשים אוכל ברכב","ללבוש אפוד ציפה","להישאר קרוב לחוף","לנעול את השער בלילה"].includes(name)
  }));
  // shuffle
  for (let i = CARDS.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [CARDS[i],CARDS[j]]=[CARDS[j],CARDS[i]]; }
  list.innerHTML = CARDS.map((c,i)=>`<li ${isTouch?'':'draggable="true"'} data-good="${c.good}" id="sf-${i}">🧩 ${c.name}</li>`).join('');
  const safe = document.getElementById('safeDrop');
  const unsafe = document.getElementById('unsafeDrop');
  const explain = document.getElementById('safetyExplain');
  let sScore = 0;

  function handleSort(li, targetSafe){
    const good = li.dataset.good === 'true';
    const text = li.textContent.replace('🧩 ','');
    const correct = (good && targetSafe) || (!good && !targetSafe);
    sScore += correct ? 10 : -5;
    document.getElementById('safetyScore').textContent = sScore;
    explain.textContent = EXPL[text] || '';
    li.remove();
    if (document.querySelectorAll('#safetyItems li').length === 0) unlock('safety_sort');
  }

  function setupDrop(zone, isSafe){
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('ok'); });
    zone.addEventListener('dragleave', ()=> zone.classList.remove('ok'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const li = document.getElementById(id); if (!li) return;
      handleSort(li, isSafe); zone.classList.remove('ok');
    });
    // Tap to move: tap item then tap zone
    let selected = null;
    list.addEventListener('click', (e)=>{
      const li = e.target.closest('li'); if (!li) return;
      selected = li; list.querySelectorAll('li').forEach(x=>x.classList.toggle('selected', x===li));
    });
    zone.addEventListener('click', ()=>{
      if (selected){ handleSort(selected, isSafe); selected=null; list.querySelectorAll('li').forEach(x=>x.classList.remove('selected')); }
    });
  }
  setupDrop(safe, true);
  setupDrop(unsafe, false);

  // Draggable start
  document.querySelectorAll('#safetyItems li').forEach(li=>{
    li.addEventListener('dragstart', e=>{ try{ e.dataTransfer.setData('text/plain', li.id);}catch{} });
    li.addEventListener('touchstart', ()=>{ li.classList.toggle('selected'); });
  });
}

// ---------- BINGO ----------
function setupBingo(){
  const grid = document.getElementById('bingoGrid');
  if (!grid) return;
  const cells = [
    "מצאתי אצטרובל","שמעתי ציפור","ראיתי סירה",
    "שמתי קרם הגנה","ראיתי שלט זהירות","בקבוק מים מלא",
    "עננים בשמיים","מסרתי שלום לשכן","שמתי כובע"
  ];
  grid.innerHTML = cells.map((t,i)=>`<button class="bingo-cell" data-i="${i}" aria-pressed="false">${t}</button>`).join('');
  const btns = [...grid.querySelectorAll('.bingo-cell')];
  const msg = document.getElementById('bingoMsg');
  function idx(r,c){ return r*3+c; }
  function isOn(i){ return btns[i].classList.contains('on'); }
  function checkLine(a,b,c){ return isOn(a) && isOn(b) && isOn(c); }
  function checkBingo(){
    const win = checkLine(0,1,2)||checkLine(3,4,5)||checkLine(6,7,8)||
                checkLine(0,3,6)||checkLine(1,4,7)||checkLine(2,5,8)||
                checkLine(0,4,8)||checkLine(2,4,6);
    if (win){ msg.hidden=false; unlock('bingo'); }
  }
  btns.forEach(b=>{
    const toggle = ()=>{ b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); checkBingo(); };
    b.addEventListener('click', toggle, {passive:true});
    b.addEventListener('touchstart', toggle, {passive:true});
  });
  document.getElementById('bingoReset')?.addEventListener('click', ()=>{
    btns.forEach(b=>{ b.classList.remove('on'); b.setAttribute('aria-pressed','false'); });
    msg.hidden = true;
  });
}

// ---------- COMIC ----------
function setupComic(){
  const tray = document.getElementById('comicTray');
  if (!tray) return;
  const icons = ['🏕️','🛶','🏖️','🌲','🦉','⭐','🔥','🌙','🐻','🚰','🚻','🧭'];
  tray.innerHTML = icons.map((ic,i)=>`<button class="sticker" ${isTouch?'':'draggable="true"'} data-ic="${ic}" aria-label="אייקון">${ic}</button>`).join('');
  const slots = [...document.querySelectorAll('.panel-slot')];
  function place(slot, ic){
    slot.textContent = ic;
    slot.classList.add('filled');
  }
  // drag
  tray.querySelectorAll('.sticker').forEach(st=>{
    st.addEventListener('dragstart', e=>{ try{ e.dataTransfer.setData('text/plain', st.dataset.ic);}catch{} });
    const tap = ()=>{ // tap to place into first empty slot
      const empty = slots.find(s=>!s.classList.contains('filled'));
      if (empty){ place(empty, st.dataset.ic); }
    };
    st.addEventListener('click', tap, {passive:true});
    st.addEventListener('touchstart', tap, {passive:true});
  });
  slots.forEach(s=>{
    s.addEventListener('dragover', e=>{ e.preventDefault(); s.classList.add('ok'); });
    s.addEventListener('dragleave', ()=> s.classList.remove('ok'));
    s.addEventListener('drop', e=>{
      e.preventDefault();
      const ic = e.dataTransfer.getData('text/plain');
      place(s, ic); s.classList.remove('ok');
    });
  });
  document.getElementById('comicMake').addEventListener('click', ()=>{
    const seq = slots.map(s=>s.textContent).filter(Boolean);
    if (seq.length < 3){ document.getElementById('comicOut').textContent = 'הוסיפו לפחות 3 אייקונים לסיפור 🙂'; return; }
    const text = `פעם אחת בקמפינג: ${seq.join(' → ')}. איזה יום נהדר ב-Sx̱ótsaqel!`;
    document.getElementById('comicOut').textContent = text;
    unlock('storyteller');
  });
  document.getElementById('comicClear').addEventListener('click', ()=>{
    slots.forEach((s,i)=>{ s.textContent = (i+1); s.classList.remove('filled'); });
    document.getElementById('comicOut').textContent = '';
  });
}

// ---------- MINI-MET ----------
function setupMiniMet(){
  const w = document.getElementById('metWind');
  if (!w) return;
  const t = document.getElementById('metTemp');
  const h = document.getElementById('metHour');
  const wv = document.getElementById('metWindVal');
  const tv = document.getElementById('metTempVal');
  const hv = document.getElementById('metHourVal');
  const suggest = document.getElementById('metSuggest');
  const waves = document.querySelector('#met .waves');
  const boat = document.querySelector('#met .boat');

  function rec(){
    wv.textContent = w.value;
    tv.textContent = `${t.value}°C`;
    hv.textContent = `${String(h.value).padStart(2,'0')}:00`;
    const wind = Number(w.value)/5;
    if (waves){ waves.style.height = `${30 + wind*50}px`; waves.style.opacity = `${0.5 + wind*0.5}`; }
    if (boat){ boat.style.top = `${20 + wind*12}px`; }

    // Simple safe suggestion logic
    let s = '';
    const hour = Number(h.value), temp = Number(t.value);
    if (wind <= 0.4 && temp >= 18 && temp <= 28 && (hour < 12 || hour >= 18)){
      s = 'מצוין לשיט קרוב לחוף או משחקי חוף רגועים.';
      unlock('weather_wiz');
    } else if (wind <= 0.6){
      s = 'משחקים בחול, הליכה קצרה, אופניים בלולאה.';
    } else {
      s = 'רוח חזקה – נשארים על החוף, משחקים במגרש או עושים פיקניק מוצל.';
    }
    suggest.textContent = s;
  }
  [w,t,h].forEach(inp=> inp.addEventListener('input', rec));
  rec();
}

// ---------- TRAIL FINDER ----------
function setupTrailFinder(){
  const box = document.getElementById('trailBox');
  if (!box) return;
  const BTN_NEXT = document.getElementById('trailNext');
  const Q = [
    {q:"איזה מסלול קצר עם מים טורקיז?", options:["גרינדרופ","לינדמן","ראדיום"], ans:1, exp:"לינדמן קצר יותר ומפורסם במים הטורקיז."},
    {q:"איזה מסלול ארוך עם שדות בולדרים?", options:["לינדמן","גרינדרופ","פלורה"], ans:1, exp:"בגרינדרופ יש קטעי בולדרים והוא ארוך יותר."},
    {q:"איפה נדרשת זהירות במים כי יש זרמים?", options:["באזור המוצא מהאגם","במגרש המשחקים","בדרך לחניון"], ans:0, exp:"באזור המוצא יש זרמים – לא להתקרב בשיט."},
    {q:"מה עושים עם אוכל בלילה?", options:["משאירים על השולחן","שמים ברכב","מחביאים באוהל"], ans:1, exp:"שומרים הכול ברכב – Bare Campsite."},
    {q:"באיזה שעות שקט?", options:["22:00–07:00","18:00–20:00","12:00–13:00"], ans:0, exp:"שעות שקט 22:00–07:00."}
  ];
  let i = 0, correct = 0;
  function render(){
    const q = Q[i];
    box.innerHTML = `<h3>${q.q}</h3>` + q.options.map((o,idx)=>`<button class="opt" data-i="${idx}">${o}</button>`).join('');
    box.querySelectorAll('.opt').forEach(b=> b.addEventListener('click', ()=>{
      const right = Number(b.dataset.i) === q.ans;
      if (right){ b.style.background='#22c55e'; b.style.color='#063'; correct++; }
      else{ b.style.background='#ef4444'; }
      box.insertAdjacentHTML('beforeend', `<p>${q.exp}</p>`);
      box.querySelectorAll('.opt').forEach(x=> x.disabled = true);
    }));
  }
  render();
  BTN_NEXT.addEventListener('click', ()=>{
    if (i < Q.length-1){ i++; render(); }
    else {
      box.innerHTML = `<h3>סיום!</h3><p>עניתם נכון על ${correct} מתוך ${Q.length}.</p>`;
      if (correct === Q.length) unlock('trail_scout');
    }
  });
}

// ---------- QUIZ (original) ----------
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
  if (qIndex < DATA.quiz.length - 1) { qIndex++; renderQ(); }
  else { qIndex = 0; renderQ(); }
}

// ---------- WEATHER (visual) ----------
function setupWeather(){
  const slider = document.getElementById('timeSlider');
  const timeVal = document.getElementById('timeVal');
  const waves = document.querySelector('#weather .waves');
  const boat = document.querySelector('#weather .boat');
  function upd(){
    const h = Number(slider.value);
    timeVal.textContent = `${h.toString().padStart(2,'0')}:00`;
    const wind = Math.max(0, Math.min(1, (h - 12) / 6));
    waves.style.height = `${40 + wind*40}px`;
    waves.style.opacity = `${0.6 + wind*0.4}`;
    boat.style.top = `${20 + wind*10}px`;
  }
  slider.addEventListener('input', upd);
  upd();
}

// ---------- Planner ----------
function setupPlan(){
  document.getElementById('makePlan').addEventListener('click', ()=>{
    const m = document.getElementById('morning').value;
    const n = document.getElementById('noon').value;
    const e = document.getElementById('eve').value;
    const txt = `🕗 בוקר: ${m}\n🕛 צהריים: ${n}\n🕖 ערב: ${e}\nטיפ: זכרו שעות שקט 22:00–07:00 ושמרו אוכל ברכב.`;
    document.getElementById('planOut').textContent = txt;
  });
}

// ---------- Interactive map / PDF / Agreement ----------
function setupMap(){
  const svg = document.getElementById('campSVG');
  const tip = document.getElementById('mapTip');
  if (!svg || !tip) return;
  function showTip(txt){ tip.textContent = txt; tip.hidden = false; }
  svg.querySelectorAll('.hotspot').forEach(h => {
    const txt = h.dataset.info || '';
    const handler = () => showTip(txt);
    h.addEventListener('click', handler, {passive:true});
    h.addEventListener('touchstart', handler, {passive:true});
    h.setAttribute('tabindex','0');
    h.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTip(txt); }});
  });
}
function setupPdfEmbed(){ /* no-op for now */ }
function setupAgreementEmbed(){
  const btn = document.getElementById('loadAgreement');
  const frame = document.getElementById('agreementFrame');
  const fallback = document.getElementById('agreementFallback');
  if (!btn || !frame) return;
  const src = frame.getAttribute('data-src');
  const tryLoad = () => {
    frame.src = src;
    setTimeout(()=>{ fallback.hidden = false; }, 1200);
    btn.disabled = true;
  };
  btn.addEventListener('click', tryLoad, {once:true});
}