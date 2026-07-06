/**
 * Fitness Buddy AI — app.js
 * Frontend logic: navigation, API calls, calculators, storage
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  profile:       loadFromStorage('fb_profile', {}),
  chatHistory:   [],
  progressLog:   loadFromStorage('fb_progress', []),
  workoutHistory:loadFromStorage('fb_workout_history', []),
  streak:        loadFromStorage('fb_streak', { count: 0, lastDate: null }),
  goalProgress:  loadFromStorage('fb_goals', { weightLoss: 0, strength: 0, cardio: 0, flexibility: 0 }),
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function loadFromStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function showToast(msg, type = 'success') {
  const el  = document.getElementById('toastEl');
  const msgEl = document.getElementById('toastMsg');
  el.className = `toast align-items-center border-0 text-bg-${type}`;
  msgEl.textContent = msg;
  new bootstrap.Toast(el, { delay: 3000 }).show();
}

function showLoading(text = 'Generating your plan...') {
  document.getElementById('loaderText').textContent = text;
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

function simpleMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/^---+$/gm,       '<hr>')
    .replace(/^\* (.+)$/gm,    '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|l|u|o|p|h])(.+)$/gm, '$1');
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const target = document.getElementById(`page-${pageId}`);
  if (target) { target.classList.add('active'); target.classList.remove('fade-in'); void target.offsetWidth; target.classList.add('fade-in'); }

  const link = document.querySelector(`[data-page="${pageId}"]`);
  if (link) link.classList.add('active');

  // close mobile nav
  const navCollapse = document.getElementById('navMenu');
  if (navCollapse.classList.contains('show')) {
    bootstrap.Collapse.getInstance(navCollapse)?.hide();
  }
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('fb_theme') || 'light';
  applyTheme(saved);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.querySelector('#themeToggle i');
  if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  localStorage.setItem('fb_theme', theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

// ── Greeting ──────────────────────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const name = state.profile.name ? `, ${state.profile.name}` : '';
  let greeting = h < 12 ? `Good Morning${name}! ☀️` : h < 17 ? `Good Afternoon${name}! 💪` : `Good Evening${name}! 🌙`;
  const sub = [
    "Ready to crush your fitness goals today?",
    "Every rep brings you closer to your best self.",
    "Consistency beats perfection — let's go!",
    "Your body is capable of more than you think.",
    "Small steps every day lead to big results.",
  ];
  document.getElementById('heroGreeting').textContent = greeting;
  document.getElementById('heroSub').textContent = sub[Math.floor(Math.random() * sub.length)];
}

// ── Dashboard stats ────────────────────────────────────────────────────────────
function updateDashboard() {
  // Streak
  document.getElementById('dashStreak').textContent = state.streak.count;

  // BMI from profile
  if (state.profile.weight && state.profile.height) {
    const bmi = (state.profile.weight / ((state.profile.height / 100) ** 2)).toFixed(1);
    document.getElementById('dashBmi').textContent = bmi;
    const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    document.getElementById('dashBmiCat').textContent = cat;
  }

  // Quick calorie estimate
  const p = state.profile;
  if (p.weight && p.height && p.age && p.gender) {
    const bmr = p.gender === 'female'
      ? 10 * p.weight + 6.25 * p.height - 5 * p.age - 161
      : 10 * p.weight + 6.25 * p.height - 5 * p.age + 5;
    const mult = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }[p.activity_level] || 1.55;
    document.getElementById('dashCals').textContent = Math.round(bmr * mult).toLocaleString();
  }

  // Quick water estimate
  if (p.weight) {
    const water = (p.weight * 35 / 1000).toFixed(1);
    document.getElementById('dashWater').textContent = water;
  }

  // Goals
  const g = state.goalProgress;
  setGoalBar('goalWeightLoss', 'pctWeightLoss', g.weightLoss);
  setGoalBar('goalStrength',   'pctStrength',   g.strength);
  setGoalBar('goalCardio',     'pctCardio',     g.cardio);
  setGoalBar('goalFlex',       'pctFlex',       g.flexibility);
}

function setGoalBar(barId, pctId, value) {
  const v = Math.min(100, Math.max(0, value || 0));
  document.getElementById(barId).style.width = v + '%';
  document.getElementById(pctId).textContent = v + '%';
}

// ── Fetch daily motivation ─────────────────────────────────────────────────────
async function fetchMotivation() {
  try {
    const res  = await fetch('/api/motivation');
    const data = await res.json();
    document.getElementById('quoteText').textContent = data.quote || 'Every workout counts!';
  } catch {
    document.getElementById('quoteText').textContent = 'Every workout counts!';
  }
}

// ── AI Status check ────────────────────────────────────────────────────────────
async function checkAiStatus() {
  try {
    const res  = await fetch('/api/health');
    const data = await res.json();
    const el   = document.getElementById('aiStatus');
    if (el) {
      el.textContent = data.ai_ready ? 'IBM Granite Ready' : 'Demo Mode';
      el.style.color  = data.ai_ready ? 'var(--accent-green)' : 'var(--accent-orange)';
    }
    if (!data.ai_ready) {
      // Show sticky top banner
      const banner = document.getElementById('demoBanner');
      if (banner) banner.style.display = 'block';
      // Show in-chat setup hint
      const setupCard = document.getElementById('demoSetupCard');
      if (setupCard) setupCard.style.display = 'block';
    }
  } catch {}
}

// ── Chat ───────────────────────────────────────────────────────────────────────
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function appendMessage(role, content) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role === 'user' ? 'user' : 'bot'}-message fade-in`;

  const avatarIcon = role === 'user' ? 'bi-person-fill' : 'bi-robot';
  const bubbleClass = role === 'assistant' ? 'ai-response' : '';

  // Convert markdown-ish text for bot messages
  const displayContent = role === 'assistant' ? formatAIResponse(content) : escapeHtml(content);

  div.innerHTML = `
    <div class="msg-avatar"><i class="bi ${avatarIcon}"></i></div>
    <div class="msg-bubble ${bubbleClass}">${displayContent}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function formatAIResponse(text) {
  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  // Headers
  text = text.replace(/^### (.+)$/gm, '<h3 style="font-size:0.95rem;font-weight:700;margin:0.6rem 0 0.2rem">$1</h3>');
  text = text.replace(/^## (.+)$/gm,  '<h3 style="font-size:1rem;font-weight:700;margin:0.7rem 0 0.3rem">$1</h3>');
  text = text.replace(/^# (.+)$/gm,   '<h3 style="font-size:1.1rem;font-weight:800;margin:0.8rem 0 0.3rem">$1</h3>');
  // Lists
  text = text.replace(/^[-•] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  // Wrap consecutive <li> in <ul>
  text = text.replace(/(<li>[\s\S]*?<\/li>)(\s*(?!<li>))/g, '<ul style="padding-left:1.2rem;margin:0.3rem 0">$1</ul>');
  // Code
  text = text.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.07);padding:1px 5px;border-radius:4px;font-size:12.5px">$1</code>');
  // Horizontal rule
  text = text.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:0.75rem 0">');
  // Paragraphs
  text = text.split('\n\n').map(p => p.trim() ? `<p style="margin-bottom:0.45rem">${p}</p>` : '').join('');
  return `<div>${text}</div>`;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message bot-message fade-in';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar"><i class="bi bi-robot"></i></div>
    <div class="msg-bubble typing-bubble">
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg) return;

  // hide quick prompts after first message
  document.getElementById('quickPrompts').style.display = 'none';

  input.value = '';
  input.style.height = 'auto';

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  appendMessage('user', msg);
  showTypingIndicator();

  // Add to history
  state.chatHistory.push({ role: 'user', content: msg });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        history: state.chatHistory.slice(-10),
        profile: state.profile,
      }),
    });
    const data = await res.json();
    removeTypingIndicator();
    const reply = data.response || 'Sorry, I could not generate a response.';
    appendMessage('assistant', reply);
    state.chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    removeTypingIndicator();
    appendMessage('assistant', '⚠️ Network error. Please check your connection and try again.');
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function sendQuickPrompt(text) {
  document.getElementById('chatInput').value = text;
  sendMessage();
}

function clearChat() {
  state.chatHistory = [];
  const container = document.getElementById('chatMessages');
  container.innerHTML = `
    <div class="message bot-message fade-in">
      <div class="msg-avatar"><i class="bi bi-robot"></i></div>
      <div class="msg-bubble">
        <p>Chat cleared! I'm ready to help with your fitness journey. What can I do for you? 💪</p>
      </div>
    </div>
  `;
  document.getElementById('quickPrompts').style.display = 'flex';
}

// ── Workout Plan Generator ─────────────────────────────────────────────────────
async function generateWorkoutPlan() {
  const profile = {
    ...state.profile,
    goal:           document.getElementById('workoutGoal')?.value || state.profile.goal || 'general_fitness',
    activity_level: document.getElementById('workoutLevel')?.value || state.profile.activity_level || 'intermediate',
    workout_time:   document.getElementById('workoutTime')?.value || state.profile.workout_time || 45,
    equipment:      document.getElementById('workoutEquipment')?.value || state.profile.equipment || 'none',
  };

  showLoading('Creating your personalized workout plan...');
  const btn = document.getElementById('genWorkoutBtn');
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch('/api/workout-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
    const data = await res.json();
    displayWorkoutPlan(data.plan || 'Could not generate plan. Please try again.');

    // update today's workout on dashboard too
    updateTodayWorkout(data.plan);
    document.getElementById('logBtn').style.display = 'inline-flex';
  } catch {
    showToast('Failed to generate workout plan. Please try again.', 'danger');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

function displayWorkoutPlan(planText) {
  const container = document.getElementById('workoutPlanOutput');
  if (!container) return;

  // Try to parse day sections
  const dayRegex = /(?:day\s*\d+[:\-–—]?[^\n]*)/gi;
  const parts    = planText.split(dayRegex);
  const headers  = planText.match(dayRegex) || [];

  if (headers.length > 1) {
    let html = '';
    headers.forEach((header, i) => {
      const body = (parts[i + 1] || '').trim();
      html += `
        <div class="workout-day">
          <div class="workout-day-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            <i class="bi bi-chevron-down me-2"></i>${header.trim()}
          </div>
          <div class="workout-day-body ai-response">${formatAIResponse(body)}</div>
        </div>
      `;
    });
    container.innerHTML = html;
  } else {
    container.innerHTML = `<div class="ai-response" style="font-size:14px;line-height:1.7">${formatAIResponse(planText)}</div>`;
  }
}

function updateTodayWorkout(planText) {
  const container = document.getElementById('todayWorkout');
  if (!container) return;
  const snippet = planText.substring(0, 400) + (planText.length > 400 ? '...' : '');
  container.innerHTML = `<div class="ai-response" style="font-size:13px;line-height:1.7">${formatAIResponse(snippet)}</div>`;
}

// ── Meal Plan Generator ────────────────────────────────────────────────────────
async function generateMealPlan() {
  const calories = parseInt(document.getElementById('mealCalories').value) || 2000;
  const diet     = document.getElementById('dietPref').value;
  const profile  = { ...state.profile, goal: diet };

  showLoading('Crafting your personalized meal plan...');
  document.getElementById('genMealBtn').disabled = true;

  try {
    const res  = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, target_calories: calories }),
    });
    const data = await res.json();
    const container = document.getElementById('mealPlanOutput');
    container.innerHTML = `<div class="ai-response" style="font-size:14px;line-height:1.75">${formatAIResponse(data.plan || 'Could not generate meal plan.')}</div>`;
  } catch {
    showToast('Failed to generate meal plan. Please try again.', 'danger');
  } finally {
    hideLoading();
    document.getElementById('genMealBtn').disabled = false;
  }
}

// ── BMI Calculator ─────────────────────────────────────────────────────────────
async function calcBMI() {
  const weight = parseFloat(document.getElementById('bmiWeight').value);
  const height = parseFloat(document.getElementById('bmiHeight').value);
  if (!weight || !height) { showToast('Please enter weight and height', 'warning'); return; }

  try {
    const res  = await fetch('/api/calculate-bmi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, height }),
    });
    const d = await res.json();
    const el = document.getElementById('bmiResult');
    el.style.display = 'block';
    el.innerHTML = `
      <div class="result-big" style="color:${d.color}">${d.bmi}</div>
      <div style="font-weight:700;color:${d.color};margin-bottom:0.5rem">${d.category}</div>
      <p style="font-size:12.5px;color:var(--text-muted);margin:0">${d.advice}</p>
    `;
    // Update dashboard
    document.getElementById('dashBmi').textContent = d.bmi;
    document.getElementById('dashBmiCat').textContent = d.category;
  } catch { showToast('Calculation failed', 'danger'); }
}

// ── Calorie Calculator ─────────────────────────────────────────────────────────
async function calcCalories() {
  const payload = {
    age:            parseInt(document.getElementById('calAge').value),
    gender:         document.getElementById('calGender').value,
    weight:         parseFloat(document.getElementById('calWeight').value),
    height:         parseFloat(document.getElementById('calHeight').value),
    activity_level: document.getElementById('calActivity').value,
    goal:           document.getElementById('calGoal').value,
  };
  if (!payload.age || !payload.weight || !payload.height) { showToast('Please fill all fields', 'warning'); return; }

  try {
    const res = await fetch('/api/calculate-calories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    const el = document.getElementById('calResult');
    el.style.display = 'block';

    const protPct = d.macros.protein_pct;
    const carbPct = d.macros.carbs_pct;
    const fatPct  = d.macros.fat_pct;

    el.innerHTML = `
      <div class="result-big" style="color:var(--accent-orange)">${d.target.toLocaleString()} <small style="font-size:1rem;font-weight:400">kcal</small></div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:0.75rem">BMR: ${d.bmr} · TDEE: ${d.tdee} · Adjustment: ${d.adjustment > 0 ? '+' : ''}${d.adjustment}</div>
      <div style="font-weight:700;font-size:12px;margin-bottom:0.3rem">Macros</div>
      <div class="macro-bar">
        <div class="macro-protein" style="width:${protPct}%" title="Protein ${protPct}%"></div>
        <div class="macro-carbs"   style="width:${carbPct}%" title="Carbs ${carbPct}%"></div>
        <div class="macro-fat"     style="width:${fatPct}%"  title="Fat ${fatPct}%"></div>
      </div>
      <div style="font-size:11px;display:flex;gap:0.75rem;margin-top:0.25rem">
        <span style="color:var(--primary)">● Protein ${d.macros.protein_g}g (${protPct}%)</span>
        <span style="color:var(--accent-orange)">● Carbs ${d.macros.carbs_g}g (${carbPct}%)</span>
        <span style="color:var(--accent-green)">● Fat ${d.macros.fat_g}g (${fatPct}%)</span>
      </div>
    `;
    // Update dashboard
    document.getElementById('dashCals').textContent = d.target.toLocaleString();
    // Pre-fill meal plan calories
    const mealCalInput = document.getElementById('mealCalories');
    if (mealCalInput && !mealCalInput.value) mealCalInput.value = d.target;
  } catch { showToast('Calculation failed', 'danger'); }
}

// ── Water Calculator ───────────────────────────────────────────────────────────
async function calcWater() {
  const weight   = parseFloat(document.getElementById('waterWeight').value);
  const activity = document.getElementById('waterActivity').value;
  const climate  = document.getElementById('waterClimate').value;
  if (!weight) { showToast('Please enter your weight', 'warning'); return; }

  try {
    const res = await fetch('/api/calculate-water', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, activity_level: activity, climate }),
    });
    const d  = await res.json();
    const el = document.getElementById('waterResult');
    el.style.display = 'block';
    el.innerHTML = `
      <div class="result-big" style="color:var(--accent-blue)">${d.total_liters} <small style="font-size:1rem;font-weight:400">L/day</small></div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:0.5rem">≈ ${d.glasses_8oz} glasses (8 oz each)</div>
      <div style="font-size:11.5px;color:var(--text-muted)">
        Base: ${d.breakdown.base_ml} ml + Activity: +${d.breakdown.activity_bonus} ml + Climate: ${d.breakdown.climate_bonus >= 0 ? '+' : ''}${d.breakdown.climate_bonus} ml
      </div>
    `;
    document.getElementById('dashWater').textContent = d.total_liters;
  } catch { showToast('Calculation failed', 'danger'); }
}

// ── Profile ────────────────────────────────────────────────────────────────────
function saveProfile() {
  state.profile = {
    name:             document.getElementById('profileName').value.trim(),
    age:              parseInt(document.getElementById('profileAge').value) || null,
    gender:           document.getElementById('profileGender').value,
    height:           parseFloat(document.getElementById('profileHeight').value) || null,
    weight:           parseFloat(document.getElementById('profileWeight').value) || null,
    activity_level:   document.getElementById('profileActivity').value,
    goal:             document.getElementById('profileGoal').value,
    workout_time:     parseInt(document.getElementById('profileWorkoutTime').value) || 45,
    equipment:        document.getElementById('profileEquipment').value.trim(),
    health_conditions:document.getElementById('profileHealth').value.trim(),
  };
  saveToStorage('fb_profile', state.profile);
  showToast('✅ Profile saved successfully!');
  updateProfileDisplay();
  updateDashboard();
}

function loadProfile() {
  const p = state.profile;
  if (p.name)             document.getElementById('profileName').value         = p.name;
  if (p.age)              document.getElementById('profileAge').value          = p.age;
  if (p.gender)           document.getElementById('profileGender').value       = p.gender;
  if (p.height)           document.getElementById('profileHeight').value       = p.height;
  if (p.weight)           document.getElementById('profileWeight').value       = p.weight;
  if (p.activity_level)   document.getElementById('profileActivity').value     = p.activity_level;
  if (p.goal)             document.getElementById('profileGoal').value         = p.goal;
  if (p.workout_time)     document.getElementById('profileWorkoutTime').value  = p.workout_time;
  if (p.equipment)        document.getElementById('profileEquipment').value    = p.equipment;
  if (p.health_conditions)document.getElementById('profileHealth').value       = p.health_conditions;
  updateProfileDisplay();
}

function updateProfileDisplay() {
  const p = state.profile;
  document.getElementById('profileNameDisplay').textContent = p.name || 'Fitness Buddy User';
  const goalLabels = {
    weight_loss:'Weight Loss', muscle_gain:'Muscle Gain',
    general_fitness:'General Fitness', endurance:'Endurance',
    flexibility:'Flexibility', stress_relief:'Stress Relief',
  };
  document.getElementById('profileGoalDisplay').textContent = goalLabels[p.goal] || 'No goal set';
}

function clearProfile() {
  state.profile = {};
  saveToStorage('fb_profile', {});
  ['profileName','profileAge','profileHeight','profileWeight','profileWorkoutTime','profileEquipment','profileHealth'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('profileGender').value   = '';
  document.getElementById('profileActivity').value = 'moderate';
  document.getElementById('profileGoal').value     = '';
  updateProfileDisplay();
  showToast('Profile cleared', 'secondary');
}

// ── Progress Log ───────────────────────────────────────────────────────────────
function saveProgressLog() {
  const entry = {
    id:          Date.now(),
    date:        document.getElementById('logDate').value || new Date().toISOString().split('T')[0],
    weight:      parseFloat(document.getElementById('logWeight').value) || null,
    workout_done:document.getElementById('logWorkoutDone').value,
    workout_type:document.getElementById('logWorkoutType').value.trim(),
    duration:    parseInt(document.getElementById('logDuration').value) || null,
    notes:       document.getElementById('logNotes').value.trim(),
  };

  state.progressLog.unshift(entry);
  saveToStorage('fb_progress', state.progressLog);
  renderProgressLog();
  updateStreak(entry.workout_done === 'yes');
  checkAchievements();
  showToast('✅ Progress logged!');

  // clear fields
  ['logWeight','logWorkoutType','logDuration','logNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
}

function renderProgressLog() {
  const container = document.getElementById('progressLog');
  if (!state.progressLog.length) {
    container.innerHTML = '<div class="empty-state"><i class="bi bi-journal-x"></i><p>No entries yet.</p></div>';
    return;
  }
  container.innerHTML = state.progressLog.slice(0, 20).map(e => `
    <div class="log-entry">
      <div>
        <div class="log-date">${e.date}</div>
        <div style="font-size:13px">${e.workout_type || (e.workout_done === 'yes' ? 'Workout done ✅' : 'Rest day')}</div>
        ${e.weight ? `<small class="text-muted">Weight: ${e.weight} kg</small>` : ''}
        ${e.duration ? `<small class="text-muted"> · ${e.duration} min</small>` : ''}
        ${e.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${e.notes}</div>` : ''}
      </div>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteLogEntry(${e.id})" style="font-size:11px;padding:2px 8px">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');
}

function deleteLogEntry(id) {
  state.progressLog = state.progressLog.filter(e => e.id !== id);
  saveToStorage('fb_progress', state.progressLog);
  renderProgressLog();
}

function clearProgressLog() {
  if (!confirm('Clear all progress entries?')) return;
  state.progressLog = [];
  saveToStorage('fb_progress', []);
  renderProgressLog();
  showToast('Progress log cleared', 'secondary');
}

// ── Streak tracking ────────────────────────────────────────────────────────────
function updateStreak(didWorkout) {
  if (!didWorkout) return;
  const today    = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0];

  if (state.streak.lastDate === today) return;
  if (state.streak.lastDate === yesterday) {
    state.streak.count++;
  } else if (state.streak.lastDate !== today) {
    state.streak.count = 1;
  }
  state.streak.lastDate = today;
  saveToStorage('fb_streak', state.streak);
  document.getElementById('dashStreak').textContent = state.streak.count;
}

// ── Achievements ───────────────────────────────────────────────────────────────
function checkAchievements() {
  const workouts = state.progressLog.filter(e => e.workout_done === 'yes').length;
  const updateAchievement = (index, unlocked) => {
    const items = document.querySelectorAll('#achievementsList .achievement');
    if (items[index]) {
      items[index].className = `achievement ${unlocked ? 'unlocked' : 'locked'}`;
      if (unlocked) items[index].innerHTML = items[index].innerHTML.replace('bi-lock-fill','bi-trophy-fill');
    }
  };
  updateAchievement(0, workouts >= 1);
  updateAchievement(1, state.streak.count >= 3);
  updateAchievement(2, state.streak.count >= 7);
  updateAchievement(3, workouts >= 10);
}

// ── Workout Logger (from dashboard) ───────────────────────────────────────────
function logWorkout() {
  navigateTo('progress');
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('logWorkoutDone').value = 'yes';
}

// ── Workout history ────────────────────────────────────────────────────────────
function renderWorkoutHistory() {
  const container = document.getElementById('workoutHistory');
  if (!state.workoutHistory.length) {
    container.innerHTML = '<div class="empty-state small"><i class="bi bi-journal-x"></i><p>No workouts logged yet</p></div>';
    return;
  }
  container.innerHTML = state.workoutHistory.slice(0, 8).map(w => `
    <div class="history-entry">
      <div>
        <div style="font-weight:600;font-size:12.5px">${w.type}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">${w.date} · ${w.duration} min</div>
      </div>
      <span style="font-size:11px;color:var(--accent-green)">✓</span>
    </div>
  `).join('');
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
function initKeyboardShortcuts() {
  document.getElementById('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('chatInput')?.addEventListener('input', function() { autoResizeTextarea(this); });
}

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  initTheme();
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Navigation
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
  });

  // Set today's date in log
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];

  // Load saved data
  loadProfile();
  renderProgressLog();
  renderWorkoutHistory();
  checkAchievements();

  // Dashboard
  setGreeting();
  updateDashboard();
  fetchMotivation();
  checkAiStatus();

  // Keyboard
  initKeyboardShortcuts();
});
