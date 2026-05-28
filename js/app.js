// ============================================================
// app.js — Main application logic
// ============================================================

const State = {
  user: null, profile: null, taxSettings: null, jobs: [],
  currentMonth: new Date().getMonth() + 1,
  currentYear:  new Date().getFullYear(),
  incomeEvents: [], categories: [], expenses: [], goals: [],
  activeTab: 'shifts', loading: true, toast: null,
};

// ---- Boot ----
async function boot() {
  Auth.onAuthChange(async (event, session) => {
    if (session?.user) {
      State.user = session.user;
      await loadUserData();
      showApp();
    } else {
      State.user = null;
      showAuth();
    }
  });
}

async function loadUserData() {
  const uid = State.user.id;
  const [profile, tax, jobs] = await Promise.all([
    UserDB.get(uid), TaxDB.get(uid), JobsDB.list(uid),
  ]);
  State.profile     = profile.data;
  State.taxSettings = tax.data || APP_CONFIG.DEFAULTS;
  State.jobs        = jobs.data;
  await loadMonthData();
}

async function loadMonthData() {
  const uid = State.user.id;
  const [income, cats, expenses, goals] = await Promise.all([
    IncomeDB.listMonth(uid, State.currentYear, State.currentMonth),
    BudgetDB.listCategories(uid),
    BudgetDB.listExpenses(uid, State.currentYear, State.currentMonth),
    GoalsDB.list(uid),
  ]);
  State.incomeEvents = income.data;
  State.categories   = cats.data;
  State.expenses     = expenses.data;
  State.goals        = goals.data;
  State.loading      = false;
  renderActiveTab();
  updateMoodRing();
}

// ---- Mood ring ----
function updateMoodRing() {
  const ring = document.getElementById('moodRing');
  if (!ring) return;
  const active    = State.incomeEvents.filter(e => e.status !== 'cancelled');
  const projected = active.reduce((s, e) => s + (Tax.calculate(e.gross_pay || 0, State.taxSettings).takeHome), 0);
  const goal      = State.profile?.monthly_goal || 2400;
  const pct       = Math.min(100, Math.round((projected / goal) * 100));
  const color     = pct >= 100 ? '#6cbd82' : pct >= 70 ? '#f7c4a0' : '#f4a7c3';
  ring.style.width      = pct + '%';
  ring.style.background = color;
}

// ---- Tab Navigation ----
function switchTab(tab) {
  State.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  renderActiveTab();
}

function renderActiveTab() {
  const content = document.getElementById('tabContent');
  switch (State.activeTab) {
    case 'shifts':     content.innerHTML = renderShifts();       break;
    case 'calendar':   content.innerHTML = renderCalendarTab();  break;
    case 'budget':     content.innerHTML = renderBudgetEnhanced(); break;
    case 'taxes':      content.innerHTML = renderTaxes();        break;
    case 'fieldguide': content.innerHTML = renderFieldGuide();   break;
    case 'goals':      content.innerHTML = renderGoals();        break;
    case 'paystubs':   content.innerHTML = renderPaystubs();     break;
    case 'settings':   content.innerHTML = renderSettings();     break;
  }
  // Animate goal bar directly after render
  setTimeout(() => {
    const bar = document.getElementById('mainGoalBar');
    if (bar && bar.style.width === '0%') {
      const pctText = bar.closest('.goal-bar-wrap')?.querySelector('.goal-bar-pct')?.textContent;
      const pct = pctText?.match(/\d+/)?.[0];
      if (pct) bar.style.width = Math.min(100, parseInt(pct)) + '%';
    }
  }, 100);
}

// ---- SHIFTS TAB ----
function renderShifts() {
  const events  = State.incomeEvents;
  const jobs    = State.jobs;
  const mtNow   = MT.now();  // Always Mountain Time
  const daysInMonth = new Date(State.currentYear, State.currentMonth, 0).getDate();
  const dayOfMonth  = (State.currentYear === mtNow.year && State.currentMonth === mtNow.month)
    ? mtNow.day : daysInMonth;

  const active    = events.filter(e => e.status !== 'cancelled');
  const projected = active.reduce((s, e) => s + (e.gross_pay || 0), 0);
  const taxCalc   = Tax.calculate(projected, State.taxSettings);
  const monthGoal = State.profile?.monthly_goal || 2400;
  const gap       = taxCalc.takeHome - monthGoal;
  const pct       = Math.min(100, Math.round((taxCalc.takeHome / monthGoal) * 100));
  const situation = Persona.assess(projected, monthGoal, daysInMonth - dayOfMonth, daysInMonth);
  const greeting  = Persona.pick(Persona.greeting(State.profile?.display_name, situation));
  const monthName = new Date(State.currentYear, State.currentMonth - 1).toLocaleString('default', { month: 'long' });

  // Today/tomorrow always in Mountain Time — works from any device location
  const todayStr    = MT.todayStr();
  const todayShifts = active.filter(e => e.shift_date === todayStr);
  const tomorrowStr = MT.tomorrowStr();
  const tmrShifts   = active.filter(e => e.shift_date === tomorrowStr);

  // Earned badges
  const earnedBadges = [];
  if (active.length >= 1) earnedBadges.push({ icon:'🌱', label:'First Shift' });
  if (jobs.length >= 2)   earnedBadges.push({ icon:'⚡', label:'Double Threat' });
  if (active.length >= 5) earnedBadges.push({ icon:'🎲', label:'On a Roll' });
  const allBadges = Persona.BADGES.filter(b => !earnedBadges.find(e => e.label === b.label));

  // Build inline reminder
  let reminderHtml = '';
  if (todayShifts.length > 0 && State.currentMonth === mtNow.month && State.currentYear === mtNow.year) {
    const s = todayShifts[0];
    const job = State.jobs.find(j => j.id === s.job_id);
    const jobName = s.jobs?.name || job?.name || 'shift';
    const tc = Tax.calculate(s.gross_pay || 0, State.taxSettings);
    const timeStr = s.start_time ? MT.formatTime12(s.start_time) : '';
    reminderHtml = `
      <div class="inline-reminder today">
        <span class="reminder-emoji">⏰</span>
        <div><strong>Today:</strong> ${jobName}${timeStr ? ' at ' + timeStr : ''} · $${Math.round(tc.takeHome)} after taxes</div>
      </div>`;
  } else if (tmrShifts.length > 0 && State.currentMonth === mtNow.month && State.currentYear === mtNow.year) {
    const s = tmrShifts[0];
    const job = State.jobs.find(j => j.id === s.job_id);
    const jobName = s.jobs?.name || job?.name || 'shift';
    const timeStr = s.start_time ? MT.formatTime12(s.start_time) : '';
    reminderHtml = `
      <div class="inline-reminder tomorrow">
        <span class="reminder-emoji">🌅</span>
        <div><strong>Tomorrow:</strong> ${jobName}${timeStr ? ' at ' + timeStr : ''}. Rest up tonight 🌸</div>
      </div>`;
  }

  return `
    <div class="shifts-view">
      <div class="greeting-card">
        <div class="greeting-text">${greeting}</div>
        <div class="greeting-sub">${monthName} ${State.currentYear}</div>
      </div>

      ${reminderHtml}

      <div class="summary-strip">
        <div class="summary-item">
          <div class="summary-label">Gross</div>
          <div class="summary-value">$${fmt(projected)}</div>
        </div>
        <div class="summary-item highlight">
          <div class="summary-label">Take-home est.</div>
          <div class="summary-value">$${fmt(taxCalc.takeHome)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Tax (${taxCalc.effectiveRate}%)</div>
          <div class="summary-value danger">−$${fmt(taxCalc.totalTax)}</div>
        </div>
      </div>

      ${Hours.renderCard(events, jobs)}

      <div class="goal-bar-wrap">
        <div class="goal-bar-labels">
          <span>Goal: $${fmt(monthGoal)}</span>
          <span class="${gap >= 0 ? 'pos' : 'neg'}">${gap >= 0 ? '+' : ''}$${fmt(gap)} ${gap >= 0 ? '🌸' : ''}</span>
        </div>
        <div class="goal-bar">
          <div class="goal-bar-fill" id="mainGoalBar" style="width:0%"></div>
        </div>
        <div class="goal-bar-pct">${pct}% of goal (after taxes)</div>
      </div>

      ${gap < 0 ? `<div class="nudge-card">
        <span class="nudge-icon">💡</span>
        <div class="nudge-text">
          You need <strong>$${fmt(Math.abs(gap))}</strong> more take-home.
          ${jobs.length > 0 ? `That's ~<strong>${Tax.shiftsNeeded(Math.abs(gap), jobs[0].hourly_rate).shifts8hr} × 8-hour ${jobs[0].name} shifts</strong>.` : ''}
        </div>
      </div>` : ''}

      <div class="badges-strip">
        ${earnedBadges.map(b => `<div class="badge-pill earned"><span class="badge-icon">${b.icon}</span>${b.label}</div>`).join('')}
        ${allBadges.slice(0, 4).map(b => `<div class="badge-pill"><span class="badge-icon">${b.icon}</span>${b.label}</div>`).join('')}
      </div>

      <div class="section-header">
        <span class="section-title">This month's shifts</span>
        <button class="btn-add" onclick="openAddShift()">+ Add shift</button>
      </div>

      <div class="shifts-list">
        ${events.length === 0
          ? `<div class="empty-state">No shifts yet 🌸 Add one above or connect your calendar.</div>`
          : events.map(e => shiftCard(e)).join('')}
      </div>
    </div>`;
}

// BUG FIX 1: color lookup chain — checks join data first, then State.jobs, then default
function getJobColor(e) {
  if (e.jobs?.color) return e.jobs.color;
  const job = State.jobs.find(j => j.id === e.job_id);
  return job?.color || '#f4a7c3';
}

function getJobName(e) {
  if (e.jobs?.name) return e.jobs.name;
  const job = State.jobs.find(j => j.id === e.job_id);
  return job?.name || e.title || 'Shift';
}

function shiftCard(e) {
  const color       = getJobColor(e);
  const taxInfo     = Tax.TAX_TREATMENTS[e.tax_treatment] || Tax.TAX_TREATMENTS.taxable;
  const isCancelled = e.status === 'cancelled';
  const isGig       = e.source_type === 'gig';
  // BUG FIX 6: safe time display
  const startStr = e.start_time ? MT.formatTime12(e.start_time) : '';
  const endStr   = e.end_time   ? MT.formatTime12(e.end_time)   : '';
  const timeStr  = startStr ? `${startStr}${endStr ? ' – ' + endStr : ''}` : '';
  const payLabel = isGig && e.flat_amount ? `$${fmt(e.flat_amount)} flat` : `${e.hours || '?'}h × $${e.hourly_rate || '?'}/hr`;
  // BUG FIX 4: hide "Synced from Google Calendar" notes
  const showNotes = e.notes && e.notes !== 'Synced from Google Calendar';
  const isRecurring = e.is_recurring || e.recurrence_rule;

  return `
    <div class="shift-card ${isCancelled ? 'cancelled' : ''}">
      <div class="shift-color-bar" style="background:${color}"></div>
      <div class="shift-main">
        <div class="shift-top">
          <span class="shift-job">${getJobName(e)}${isRecurring ? ' <span class="recurring-badge">↻</span>' : ''}</span>
          <span class="shift-earn ${isCancelled ? 'strike' : ''}">$${fmt(e.gross_pay)}</span>
        </div>
        <div class="shift-meta">
          <span>${formatDate(e.shift_date)}</span>
          ${timeStr ? `<span>${timeStr}</span>` : ''}
          <span>${payLabel}</span>
          ${isGig ? `<span class="gig-badge" style="color:${taxInfo.color}">${taxInfo.label}</span>` : ''}
        </div>
        ${showNotes ? `<div class="shift-notes">${e.notes}</div>` : ''}
      </div>
      <div class="shift-actions">
        <button class="icon-btn" onclick="openEditShift('${e.id}')" title="Edit">✎</button>
        ${!isCancelled
          ? `<button class="icon-btn" onclick="cancelShift('${e.id}')" title="Cancel">✕</button>`
          : `<button class="icon-btn restore" onclick="restoreShift('${e.id}')" title="Restore">↩</button>`}
      </div>
    </div>`;
}

// ---- EDIT SHIFT (Bug Fix 2) ----
function openEditShift(id) {
  const e    = State.incomeEvents.find(ev => ev.id === id);
  if (!e) return;
  const jobs = State.jobs;
  const isGig = e.source_type === 'gig';

  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Edit shift</div>

      <div class="form-group">
        <label>Job</label>
        <select id="editShiftJob" class="bnm-select">
          <option value="">— No job / one-off —</option>
          ${jobs.map(j => `<option value="${j.id}" ${j.id === e.job_id ? 'selected' : ''}>${j.name} ($${j.hourly_rate}/hr)</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Date</label>
        <input type="date" id="editShiftDate" class="bnm-input" value="${e.shift_date}" />
      </div>

      ${!isGig ? `
        <div class="form-row">
          <div class="form-group">
            <label>Start time</label>
            <input type="time" id="editShiftStart" class="bnm-input" value="${e.start_time?.slice(0,5) || ''}" />
          </div>
          <div class="form-group">
            <label>End time</label>
            <input type="time" id="editShiftEnd" class="bnm-input" value="${e.end_time?.slice(0,5) || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label>Hourly rate ($)</label>
          <input type="number" id="editShiftRate" class="bnm-input" value="${e.hourly_rate || ''}" step="0.50" />
        </div>
      ` : `
        <div class="form-group">
          <label>Flat amount ($)</label>
          <input type="number" id="editFlatAmount" class="bnm-input" value="${e.flat_amount || ''}" step="0.01" />
        </div>
        <div class="form-group">
          <label>Tax treatment</label>
          <select id="editTaxTreatment" class="bnm-select">
            <option value="taxable" ${e.tax_treatment === 'taxable' ? 'selected' : ''}>Taxable</option>
            <option value="informal" ${e.tax_treatment === 'informal' ? 'selected' : ''}>Probably informal</option>
            <option value="excluded" ${e.tax_treatment === 'excluded' ? 'selected' : ''}>Excluded</option>
          </select>
        </div>
      `}

      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="editShiftNotes" class="bnm-input"
          value="${(e.notes && e.notes !== 'Synced from Google Calendar') ? e.notes : ''}"
          placeholder="Optional notes" />
      </div>

      ${e.is_recurring ? `
        <div style="font-size:11px;color:var(--muted);padding:8px 0;font-family:'DM Mono',monospace">
          ↻ This is a recurring shift
        </div>` : ''}

      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveEditShift('${id}', ${isGig})">Save changes</button>
      </div>
    </div>`);
}

async function saveEditShift(id, isGig) {
  const e      = State.incomeEvents.find(ev => ev.id === id);
  if (!e) return;

  const jobId  = document.getElementById('editShiftJob').value || null;
  const date   = document.getElementById('editShiftDate').value;
  const notes  = document.getElementById('editShiftNotes').value;
  const job    = State.jobs.find(j => j.id === jobId);

  let updates = { job_id: jobId, shift_date: date, notes: notes || null };

  if (isGig) {
    const flat = parseFloat(document.getElementById('editFlatAmount')?.value) || 0;
    updates.flat_amount   = flat;
    updates.gross_pay     = flat;
    updates.tax_treatment = document.getElementById('editTaxTreatment')?.value || 'taxable';
  } else {
    const start = document.getElementById('editShiftStart').value;
    const end   = document.getElementById('editShiftEnd').value;
    const rate  = parseFloat(document.getElementById('editShiftRate').value) || e.hourly_rate || 0;
    let hours = e.hours;
    if (start && end) {
      const [sh,sm] = start.split(':').map(Number);
      const [eh,em] = end.split(':').map(Number);
      hours = ((eh*60+em) - (sh*60+sm)) / 60;
    }
    updates.start_time  = start || e.start_time;
    updates.end_time    = end   || e.end_time;
    updates.hours       = hours;
    updates.hourly_rate = rate;
    updates.gross_pay   = Math.round(hours * rate * 100) / 100;
  }

  const { error } = await IncomeDB.update(id, updates);
  if (error) { showToast('Error updating shift', 'error'); return; }

  // Update State
  const idx = State.incomeEvents.findIndex(ev => ev.id === id);
  if (idx >= 0) {
    State.incomeEvents[idx] = {
      ...State.incomeEvents[idx],
      ...updates,
      jobs: job ? { name: job.name, color: job.color } : State.incomeEvents[idx].jobs,
    };
  }

  closeModal();
  showToast('Shift updated ✓', 'success');
  updateMoodRing();
  renderActiveTab();
}

// ---- BUDGET TAB ----
function renderBudget() {
  const cats     = State.categories;
  const expenses = State.expenses;
  const monthName = new Date(State.currentYear, State.currentMonth - 1).toLocaleString('default', { month: 'long' });
  const totalAllocated = cats.reduce((s, c) => s + (c.allocated_amount || 0), 0);
  const totalSpent     = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return `
    <div class="budget-view">
      <div class="greeting-card">
        <div class="greeting-text">Budget 📊</div>
        <div class="greeting-sub">${monthName} ${State.currentYear}</div>
      </div>

      <div class="budget-totals">
        <div class="bud-total">
          <div class="bud-total-label">Allocated</div>
          <div class="bud-total-val">$${fmt(totalAllocated)}</div>
        </div>
        <div class="bud-total">
          <div class="bud-total-label">Spent</div>
          <div class="bud-total-val spent">$${fmt(totalSpent)}</div>
        </div>
        <div class="bud-total">
          <div class="bud-total-label">Left</div>
          <div class="bud-total-val ${totalAllocated - totalSpent >= 0 ? 'pos' : 'neg'}">$${fmt(totalAllocated - totalSpent)}</div>
        </div>
      </div>

      <div class="section-header">
        <span class="section-title">Categories</span>
        <button class="btn-add" onclick="openAddCategoryEnhanced()">+ Category</button>
      </div>

      ${cats.length === 0
        ? `<div class="empty-state">No categories yet 🌷 Create one — name it whatever you want.</div>`
        : cats.map(cat => budgetCategoryCard(cat, expenses)).join('')}

      <div class="section-header" style="margin-top:20px">
        <span class="section-title">Recent expenses</span>
        <button class="btn-add" onclick="openAddExpense()">+ Expense</button>
      </div>

      <div class="expenses-list">
        ${expenses.length === 0
          ? `<div class="empty-state">No expenses logged this month.</div>`
          : expenses.slice(0, 20).map(exp => expenseRow(exp)).join('')}
      </div>
    </div>`;
}

function budgetCategoryCard(cat, expenses) {
  const spent     = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0);
  const allocated = cat.allocated_amount || 0;
  const pct       = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
  const over      = spent > allocated;
  return `
    <div class="budget-cat-card">
      <div class="cat-top">
        <div class="cat-dot" style="background:${cat.color || '#f4a7c3'}"></div>
        <span class="cat-name">${cat.name}</span>
        <span class="cat-amounts">$${fmt(spent)} <span style="color:var(--muted2)">of $${fmt(allocated)}</span></span>
        <button class="icon-btn sm" onclick="deleteCategory('${cat.id}')">✕</button>
      </div>
      <div class="cat-bar-wrap">
        <div class="cat-bar-fill" style="width:${pct}%;background:${over ? 'var(--danger)' : (cat.color || 'var(--pink)')}"></div>
      </div>
      ${over ? `<div class="cat-over-msg">Over by $${fmt(spent - allocated)}</div>` : ''}
    </div>`;
}

function expenseRow(exp) {
  return `
    <div class="expense-row">
      <div class="exp-cat-dot" style="background:${exp.budget_categories?.color || '#f4a7c3'}"></div>
      <div class="exp-info">
        <span class="exp-desc">${exp.description || exp.budget_categories?.name || 'Expense'}</span>
        <span class="exp-date">${formatDate(exp.expense_date)}</span>
      </div>
      <span class="exp-amount">$${fmt(exp.amount)}</span>
      <button class="icon-btn sm" onclick="deleteExpense('${exp.id}')">✕</button>
    </div>`;
}

// ---- TAXES TAB ----
function renderTaxes() {
  const events  = State.incomeEvents.filter(e => e.status !== 'cancelled' && e.tax_treatment === 'taxable');
  const gross   = events.reduce((s, e) => s + (e.gross_pay || 0), 0);
  const taxCalc = Tax.calculate(gross, State.taxSettings);

  return `
    <div class="taxes-view">
      <div class="greeting-card">
        <div class="greeting-text">Your tax picture 🧾</div>
        <div class="greeting-sub">Based on this month's taxable income</div>
      </div>

      <div class="tax-status-cards">
        <div class="tax-status-card ${State.taxSettings?.fica_exempt !== false ? 'good' : 'warn'}">
          <div class="tsc-icon">🛡️</div>
          <div class="tsc-label">FICA</div>
          <div class="tsc-value">${State.taxSettings?.fica_exempt !== false ? 'EXEMPT' : 'NOT EXEMPT'}</div>
          <div class="tsc-sub">F-1 under 5 yrs</div>
        </div>
        <div class="tax-status-card ${State.taxSettings?.has_tax_treaty ? 'good' : ''}">
          <div class="tsc-icon">📋</div>
          <div class="tsc-label">Treaty</div>
          <div class="tsc-value">${State.taxSettings?.has_tax_treaty ? 'YES' : 'NONE'}</div>
          <div class="tsc-sub">No Kenya–US treaty</div>
        </div>
        <div class="tax-status-card">
          <div class="tsc-icon">🏔️</div>
          <div class="tsc-label">Colorado</div>
          <div class="tsc-value">4.4%</div>
          <div class="tsc-sub">Flat rate</div>
        </div>
      </div>

      <div class="tax-breakdown-card">
        <div class="tax-card-title">This month's estimate</div>
        <div class="tax-row"><span>Taxable gross</span><span>$${fmt(gross)}</span></div>
        <div class="tax-row"><span>Federal income tax</span><span class="neg">−$${fmt(taxCalc.federalTax)}</span></div>
        <div class="tax-row"><span>Colorado state (4.4%)</span><span class="neg">−$${fmt(taxCalc.stateTax)}</span></div>
        <div class="tax-row"><span>FICA (SS + Medicare)</span><span class="pos">$0 — exempt</span></div>
        <div class="tax-row total"><span>Estimated take-home</span><span>$${fmt(taxCalc.takeHome)}</span></div>
        <div class="tax-row"><span>Effective rate</span><span>${taxCalc.effectiveRate}%</span></div>
      </div>

      <div class="tax-breakdown-card">
        <div class="tax-card-title">Why your paycheck looks smaller</div>
        <p style="font-size:12px;line-height:1.8;color:var(--muted);font-weight:500">
          Employers add <strong style="color:var(--text)">$15,000</strong> to your annualized wages before calculating withholding (IRS NRA rule, Pub 15-T). This makes each paycheck look like ~22% is taken, but your <em style="color:var(--pink-deep)">true annual liability is lower</em>. You'll likely get a refund in April when you file your <strong style="color:var(--text)">1040-NR</strong>.
        </p>
      </div>

      <div class="paystub-card">
        <div class="tax-card-title">Paystub check ✓</div>
        <div class="check-row"><span class="check-icon">✅</span><span>Federal income tax — should be withheld</span></div>
        <div class="check-row"><span class="check-icon">✅</span><span>Colorado state tax — should be withheld</span></div>
        <div class="check-row"><span class="check-icon">🚫</span><span>Social Security — should <strong>NOT</strong> be withheld</span></div>
        <div class="check-row"><span class="check-icon">🚫</span><span>Medicare — should <strong>NOT</strong> be withheld</span></div>
      </div>

      <div class="ytd-input-card">
        <div class="tax-card-title">Update year-to-date withholding</div>
        <div class="ytd-sub">Enter from your most recent paystub for a refund estimate — or use the Paystubs tab for full tracking</div>
        <div class="ytd-row">
          <input type="number" id="ytdGross" placeholder="YTD Gross $" class="bnm-input" value="${State.taxSettings?.ytd_gross || ''}" />
          <input type="number" id="ytdWithheld" placeholder="YTD Withheld $" class="bnm-input" value="${State.taxSettings?.ytd_withheld || ''}" />
          <button class="btn-primary" onclick="updateYTD()">Update</button>
        </div>
        ${State.taxSettings?.ytd_gross ? renderRefundEstimate() : ''}
      </div>
    </div>`;
}

function renderRefundEstimate() {
  const ytdGross    = State.taxSettings.ytd_gross || 0;
  const ytdWithheld = State.taxSettings.ytd_withheld || 0;
  const refund      = Tax.estimateRefund(ytdGross, ytdWithheld, ytdGross, State.taxSettings);
  return `
    <div class="refund-box" style="margin-top:14px">
      <div class="ref-label">${refund.isRefund ? 'Estimated April refund' : 'Estimated amount owed'}</div>
      <div class="ref-amount" style="${!refund.isRefund ? 'color:var(--danger)' : ''}">${refund.isRefund ? '+' : '−'}$${fmt(Math.abs(refund.refundOrOwed))}</div>
      <div class="ref-msg">${refund.isRefund ? `The IRS owes YOU ~$${fmt(refund.refundOrOwed)} 🌸` : `You may owe ~$${fmt(Math.abs(refund.refundOrOwed))} — start setting a little aside.`}</div>
    </div>`;
}

// ---- FIELD GUIDE TAB ----
function renderFieldGuide() {
  const guides = [
    { icon:'💸', title:'Why your paycheck is smaller than expected', short:'The IRS NRA phantom wage rule — employers add $15,000 to your annualized wages before withholding.', detail:'As a nonresident alien (NRA) on an F-1 visa, your employer is required by the IRS to add approximately $15,000 to your annualized wages before running the withholding calculation. This doesn\'t mean you owe more tax — it means they withhold more per paycheck than you\'ll ultimately owe. The result: you likely over-pay during the year and get a refund in April.', sources:[{label:'IRS Publication 15-T (2025) — Nonresident Alien withholding',url:'https://www.irs.gov/pub/irs-pdf/p15t.pdf'},{label:'IRS Notice 1392 — Supplemental W-4 for NRAs',url:'https://www.irs.gov/pub/irs-pdf/n1392.pdf'}]},
    { icon:'🛡️', title:'FICA exemption — no Social Security or Medicare', short:'F-1 students are exempt from FICA taxes for their first 5 calendar years in the US.', detail:'Social Security (6.2%) and Medicare (1.45%) are NOT withheld from F-1 students during their first five calendar years. If your paystub shows these deductions, that is an error. Contact your employer\'s payroll department and request a refund. If they cannot fix it, file IRS Form 843.', sources:[{label:'IRS — Foreign student FICA exemption',url:'https://www.irs.gov/individuals/international-taxpayers/foreign-student-liability-for-fica-and-futa-taxes'},{label:'IRS Form 843 — Claim for Refund',url:'https://www.irs.gov/forms-pubs/about-form-843'}]},
    { icon:'📋', title:'No Kenya–US tax treaty', short:'Kenya has no income tax treaty with the US. Full NRA withholding rules apply.', detail:'The US has income tax treaties with 65+ countries allowing reduced or zero tax on certain income. Kenya is not one of them. Students from China get a $5,000 wage exemption; Indian students get certain deduction benefits. You don\'t — but you still have the FICA exemption.', sources:[{label:'IRS Publication 901 — U.S. Tax Treaties (full list)',url:'https://www.irs.gov/pub/irs-pdf/p901.pdf'},{label:'IRS — Tax treaty information by country',url:'https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z'}]},
    { icon:'📬', title:'Filing your taxes — Form 1040-NR', short:'Not the regular 1040. Deadline April 15. Sprintax is free for many university students.', detail:'You file Form 1040-NR — not the regular 1040 US citizens use. You cannot claim the standard deduction ($14,600 for residents) but can claim certain itemized deductions. Many universities provide free access to Sprintax, designed specifically for international students.', sources:[{label:'IRS Form 1040-NR instructions',url:'https://www.irs.gov/forms-pubs/about-form-1040-nr'},{label:'IRS Publication 519 — US Tax Guide for Aliens',url:'https://www.irs.gov/pub/irs-pdf/p519.pdf'},{label:'Sprintax — 1040-NR filing for international students',url:'https://www.sprintax.com'}]},
    { icon:'🏔️', title:'Colorado state income tax', short:'Colorado taxes everyone at a flat 4.4% — no brackets, no exceptions for nonresidents.', detail:'Colorado has a flat 4.4% income tax rate for 2025, applied to all taxable income regardless of filing status or residency. You are required to file a Colorado state return (Form DR 0104) in addition to your federal 1040-NR.', sources:[{label:'Colorado Department of Revenue — Individual Income Tax',url:'https://tax.colorado.gov/individual-income-tax-information'},{label:'Colorado Form DR 0104',url:'https://tax.colorado.gov/sites/tax/files/documents/DR0104_2024.pdf'}]},
    { icon:'🤔', title:'Informal income — what\'s actually taxable?', short:'All income is technically taxable. Under $600 from one person — no 1099, practical grey zone.', detail:'The IRS says all income is taxable unless specifically exempt. The reporting threshold is $600 — if you earn less than that from any single person in a year, no 1099 is issued and nothing is reported to the IRS. Casual babysitting, one-off gigs under that threshold exist in a practical grey zone. Keep your own records either way.', sources:[{label:'IRS — Gig economy tax center',url:'https://www.irs.gov/businesses/gig-economy-tax-center'},{label:'IRS — Self-employment tax overview',url:'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes'}]},
  ];

  return `
    <div class="fieldguide-view">
      <div class="greeting-card">
        <div class="greeting-text">Tax Field Guide 📖</div>
        <div class="greeting-sub">Plain English. Real IRS sources. No blogs.</div>
      </div>
      <div class="guide-cards">
        ${guides.map((g, i) => `
          <div class="guide-card" onclick="toggleGuide(${i})">
            <div class="guide-card-top">
              <span class="guide-icon">${g.icon}</span>
              <div class="guide-title-wrap">
                <div class="guide-title">${g.title}</div>
                <div class="guide-short">${g.short}</div>
              </div>
              <span class="guide-chevron" id="chevron-${i}">▸</span>
            </div>
            <div class="guide-detail" id="guide-detail-${i}">
              <p>${g.detail}</p>
              <div class="guide-sources">
                <div class="sources-label">Official sources</div>
                ${g.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener" class="source-link"><span class="source-link-icon">↗</span>${s.label}</a>`).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ---- GOALS TAB ----
function renderGoals() {
  const goals     = State.goals;
  const projected = State.incomeEvents.filter(e => e.status !== 'cancelled' && e.tax_treatment === 'taxable').reduce((s, e) => s + (e.gross_pay || 0), 0);
  const taxCalc   = Tax.calculate(projected, State.taxSettings);

  return `
    <div class="goals-view">
      <div class="greeting-card">
        <div class="greeting-text">Your Goals 🎯</div>
        <div class="greeting-sub">Monthly take-home: ~$${fmt(taxCalc.takeHome)}</div>
      </div>

      <div class="section-header">
        <span class="section-title">Active goals</span>
        <button class="btn-add" onclick="openAddGoal()">+ Goal</button>
      </div>

      <div class="goals-list">
        ${goals.length === 0
          ? `<div class="empty-state">No goals yet 🌷 What are you working toward?</div>`
          : goals.map(g => goalCard(g)).join('')}
      </div>

      <div class="monthly-goal-card">
        <div class="section-title">Monthly income goal</div>
        <div class="monthly-goal-sub">Drives the progress bar and mood ring on your Shifts tab</div>
        <div class="monthly-goal-row">
          <input type="number" id="monthlyGoalInput" class="bnm-input" placeholder="$2,400" value="${State.profile?.monthly_goal || ''}" />
          <button class="btn-primary" onclick="saveMonthlyGoal()">Save</button>
        </div>
      </div>
    </div>`;
}

function goalCard(g) {
  const pct       = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
  const remaining = Math.max(0, g.target_amount - g.current_amount);
  const deadline  = g.deadline ? new Date(g.deadline + 'T12:00:00') : null;
  const daysLeft  = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;
  const monthsLeft = daysLeft ? Math.max(1, Math.round(daysLeft / 30)) : null;
  const perMonth  = monthsLeft ? Math.ceil(remaining / monthsLeft) : null;
  let statusMsg   = '';
  if (pct >= 100) statusMsg = Persona.pick(Persona.goal.achieved(g.name));
  else if (pct >= 80) statusMsg = Persona.pick(Persona.goal.almost(g.name, pct));

  return `
    <div class="goal-card ${g.status === 'achieved' ? 'achieved' : ''}">
      <div class="goal-card-top">
        <div class="goal-name">${g.name}</div>
        <div class="goal-amounts">$${fmt(g.current_amount)} <span class="goal-of">/ $${fmt(g.target_amount)}</span></div>
      </div>
      <div class="goal-prog-bar">
        <div class="goal-prog-fill" style="width:${pct}%"></div>
      </div>
      <div class="goal-meta">
        <span>${pct}% complete</span>
        ${deadline ? `<span>${daysLeft} days left</span>` : ''}
        ${perMonth ? `<span>~$${fmt(perMonth)}/month needed</span>` : ''}
      </div>
      ${statusMsg ? `<div class="goal-status-msg">${statusMsg}</div>` : ''}
      <div class="goal-actions">
        <input type="number" class="bnm-input sm" placeholder="Add $" id="goalAdd-${g.id}" style="flex:1" />
        <button class="btn-sm" onclick="addToGoal('${g.id}')">Add</button>
        <button class="btn-sm danger" onclick="removeGoal('${g.id}')">Remove</button>
      </div>
    </div>`;
}

// ---- MODALS ----
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modalOverlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function openAddShift() {
  const jobs = State.jobs;
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Add income event</div>

      <div class="form-group">
        <label>Type</label>
        <select id="shiftSourceType" class="bnm-select" onchange="toggleGigFields()">
          <option value="manual">Regular shift</option>
          <option value="gig">One-off gig (babysitting, tutoring…)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Job</label>
        <select id="shiftJob" class="bnm-select" onchange="prefillRate()">
          <option value="">— No job / one-off —</option>
          ${jobs.map(j => `<option value="${j.id}" data-rate="${j.hourly_rate}">${j.name} ($${j.hourly_rate}/hr)</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Date</label>
        <input type="date" id="shiftDate" class="bnm-input" value="${MT.todayInputVal()}"
          onchange="Recurring.updatePreview(this.value)" />
      </div>

      <div id="hourlyFields">
        <div class="form-row">
          <div class="form-group">
            <label>Start time</label>
            <input type="time" id="shiftStart" class="bnm-input" />
          </div>
          <div class="form-group">
            <label>End time</label>
            <input type="time" id="shiftEnd" class="bnm-input" />
          </div>
        </div>
        <div class="form-group">
          <label>Hourly rate ($)</label>
          <input type="number" id="shiftRate" class="bnm-input" placeholder="e.g. 21.50" step="0.50" />
        </div>
      </div>

      <div id="gigFields" style="display:none">
        <div class="form-group">
          <label>Flat amount paid ($)</label>
          <input type="number" id="flatAmount" class="bnm-input" placeholder="e.g. 60" />
        </div>
        <div class="form-group">
          <label>Tax treatment</label>
          <select id="taxTreatment" class="bnm-select" onchange="updateTaxNote()">
            <option value="taxable">Taxable — counts toward my gross income</option>
            <option value="informal">Probably informal — under $600 from this person this year</option>
            <option value="excluded">Excluded — I'm choosing not to count this</option>
          </select>
          <div class="tax-treatment-note" id="taxTreatmentNote">Counts toward your gross income and tax calculations.</div>
        </div>
      </div>

      <div class="form-group">
        <label>Title / notes</label>
        <input type="text" id="shiftTitle" class="bnm-input" placeholder="e.g. Babysitting — Smith family" />
      </div>

      <!-- Recurring toggle -->
      <button type="button" id="recurringToggle" class="btn-sm" style="width:100%;margin-bottom:8px"
        onclick="toggleRecurring()">Repeat this shift</button>
      ${Recurring.renderRecurringFields()}

      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveShift()">Add 🌸</button>
      </div>
    </div>`);
}

function prefillRate() {
  const sel  = document.getElementById('shiftJob');
  const rate = sel.options[sel.selectedIndex]?.dataset.rate;
  if (rate) document.getElementById('shiftRate').value = rate;
}

function toggleGigFields() {
  const isGig = document.getElementById('shiftSourceType').value === 'gig';
  document.getElementById('hourlyFields').style.display = isGig ? 'none' : 'block';
  document.getElementById('gigFields').style.display    = isGig ? 'block' : 'none';
}

function updateTaxNote() {
  const notes = {
    taxable:  'Counts toward your gross income and tax calculations.',
    informal: 'Tracked for your records. Under $600/year from one person — no 1099 typically issued.',
    excluded: 'Excluded from tax calcs. Keep a personal record just in case.',
  };
  const el = document.getElementById('taxTreatmentNote');
  if (el) el.textContent = notes[document.getElementById('taxTreatment').value] || '';
}

async function saveShift() {
  const sourceType = document.getElementById('shiftSourceType').value;
  const jobId      = document.getElementById('shiftJob').value || null;
  const date       = document.getElementById('shiftDate').value;
  const title      = document.getElementById('shiftTitle').value;
  const isGig      = sourceType === 'gig';
  let hours = 0, rate = 0, flatAmount = null, grossPay = 0, taxTreatment = 'taxable';

  if (isGig) {
    flatAmount   = parseFloat(document.getElementById('flatAmount').value) || 0;
    taxTreatment = document.getElementById('taxTreatment').value;
    grossPay     = flatAmount;
  } else {
    const start = document.getElementById('shiftStart').value;
    const end   = document.getElementById('shiftEnd').value;
    rate         = parseFloat(document.getElementById('shiftRate').value) || 0;
    if (start && end) {
      const [sh,sm] = start.split(':').map(Number);
      const [eh,em] = end.split(':').map(Number);
      hours = ((eh*60+em) - (sh*60+sm)) / 60;
    }
    grossPay = hours * rate;
  }

  if (!date || (isGig ? !flatAmount : (!hours || !rate))) {
    showToast('Please fill in all required fields', 'error'); return;
  }

  // Check if recurring
  const recurringSection = document.getElementById('recurringSection');
  const isRecurring = recurringSection?.style.display !== 'none';
  const recurrenceRule = isRecurring ? Recurring.buildRule() : null;

  const job = State.jobs.find(j => j.id === jobId);
  const event = {
    job_id: jobId, source_type: sourceType,
    title: title || job?.name || 'Shift',
    shift_date: date, hours: hours || null,
    hourly_rate: rate || null, flat_amount: flatAmount,
    gross_pay: grossPay, status: 'scheduled',
    tax_treatment: taxTreatment, notes: title || null,
    start_time: document.getElementById('shiftStart')?.value || null,
    end_time:   document.getElementById('shiftEnd')?.value   || null,
    is_recurring: !!recurrenceRule,
    recurrence_rule: recurrenceRule,
  };

  const { data, error } = await IncomeDB.create(State.user.id, event);
  if (error) { showToast('Error saving shift', 'error'); return; }

  const newEvent = { ...data, jobs: job ? { name: job.name, color: job.color } : null };
  State.incomeEvents.push(newEvent);

  // Create recurring instances
  if (recurrenceRule && data) {
    const result = await Recurring.createInstances(State.user.id, event, data.id, recurrenceRule);
    if (result.count > 0) {
      showToast(`Shift + ${result.count} recurring instances created 🌸`, 'success');
      await loadMonthData(); // reload to get all instances
      closeModal();
      return;
    }
  }

  closeModal();
  showToast(Persona.pick(Persona.shift.added(fmt(grossPay))), 'success');
  updateMoodRing();
  renderActiveTab();
}

async function cancelShift(id) {
  const { error } = await IncomeDB.remove(id);
  if (error) { showToast('Error', 'error'); return; }
  const ev = State.incomeEvents.find(e => e.id === id);
  if (ev) { ev.status = 'cancelled'; showToast(Persona.pick(Persona.shift.cancelled(fmt(ev.gross_pay))), 'warn'); }
  updateMoodRing();
  renderActiveTab();
}

async function restoreShift(id) {
  const { error } = await IncomeDB.update(id, { status: 'scheduled' });
  if (error) { showToast('Error', 'error'); return; }
  const ev = State.incomeEvents.find(e => e.id === id);
  if (ev) ev.status = 'scheduled';
  showToast('Shift restored 🌸', 'success');
  updateMoodRing();
  renderActiveTab();
}

function openAddCategory() {
  const colors = ['#f4a7c3','#a8d4f5','#a8d5b5','#f7c4a0','#c8b4f0','#f0b429','#e87040'];
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">New budget category</div>
      <div class="form-group">
        <label>Name — call it anything</label>
        <input type="text" id="catName" class="bnm-input" placeholder="e.g. Rent, Tuition, Fun money, Snacks" />
      </div>
      <div class="form-group">
        <label>Monthly budget ($)</label>
        <input type="number" id="catAmount" class="bnm-input" placeholder="e.g. 500" />
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker">
          ${colors.map((c,i) => `<div class="color-dot ${i===0?'selected':''}" style="background:${c}" data-color="${c}" onclick="selectColor('${c}')"></div>`).join('')}
        </div>
        <input type="hidden" id="catColor" value="${colors[0]}" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveCat()">Create 🌸</button>
      </div>
    </div>`);
}

// BUG FIX 3: null-safe selectColor
function selectColor(c) {
  const catEl = document.getElementById('catColor');
  const jobEl = document.getElementById('jobColor');
  if (catEl) catEl.value = c;
  if (jobEl) jobEl.value = c;
  document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d.dataset.color === c));
}

async function saveCat() {
  const name   = document.getElementById('catName').value.trim();
  const amount = parseFloat(document.getElementById('catAmount').value) || 0;
  const color  = document.getElementById('catColor').value;
  if (!name) { showToast('Enter a category name', 'error'); return; }
  const { data, error } = await BudgetDB.createCategory(State.user.id, { name, allocated_amount: amount, color, sort_order: State.categories.length });
  if (error) { showToast('Error', 'error'); return; }
  State.categories.push(data);
  closeModal();
  showToast(`"${name}" created! 🌷`, 'success');
  renderActiveTab();
}

function openAddExpense() {
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Log expense</div>
      <div class="form-group">
        <label>Category</label>
        <select id="expCat" class="bnm-select">
          ${State.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Amount ($)</label>
        <input type="number" id="expAmount" class="bnm-input" placeholder="e.g. 45.50" step="0.01" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="expDesc" class="bnm-input" placeholder="e.g. Walmart grocery run" />
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="expDate" class="bnm-input" value="${MT.todayInputVal()}" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveExpense()">Log it</button>
      </div>
    </div>`);
}

async function saveExpense() {
  const catId  = document.getElementById('expCat').value;
  const amount = parseFloat(document.getElementById('expAmount').value);
  const desc   = document.getElementById('expDesc').value;
  const date   = document.getElementById('expDate').value;
  if (!amount || !date) { showToast('Fill in amount and date', 'error'); return; }
  const { data, error } = await BudgetDB.createExpense(State.user.id, { category_id: catId, amount, description: desc, expense_date: date });
  if (error) { showToast('Error', 'error'); return; }
  const cat = State.categories.find(c => c.id === catId);
  State.expenses.unshift({ ...data, budget_categories: cat });
  closeModal();
  showToast('Expense logged ✓', 'success');
  renderActiveTab();
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  await BudgetDB.deleteCategory(id);
  State.categories = State.categories.filter(c => c.id !== id);
  renderActiveTab();
}

async function deleteExpense(id) {
  await BudgetDB.deleteExpense(id);
  State.expenses = State.expenses.filter(e => e.id !== id);
  renderActiveTab();
}

function openAddGoal() {
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">New goal 🎯</div>
      <div class="form-group">
        <label>What are you saving for?</label>
        <input type="text" id="goalName" class="bnm-input" placeholder="e.g. Spring tuition, Flight home" />
      </div>
      <div class="form-group">
        <label>Target amount ($)</label>
        <input type="number" id="goalTarget" class="bnm-input" placeholder="e.g. 3000" />
      </div>
      <div class="form-group">
        <label>Starting amount ($)</label>
        <input type="number" id="goalCurrent" class="bnm-input" placeholder="0" value="0" />
      </div>
      <div class="form-group">
        <label>Deadline (optional)</label>
        <input type="date" id="goalDeadline" class="bnm-input" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveGoal()">Create goal</button>
      </div>
    </div>`);
}

async function saveGoal() {
  const name     = document.getElementById('goalName').value.trim();
  const target   = parseFloat(document.getElementById('goalTarget').value) || 0;
  const current  = parseFloat(document.getElementById('goalCurrent').value) || 0;
  const deadline = document.getElementById('goalDeadline').value || null;
  if (!name || !target) { showToast('Enter a name and amount', 'error'); return; }
  const { data, error } = await GoalsDB.create(State.user.id, { name, target_amount: target, current_amount: current, deadline, status: 'active' });
  if (error) { showToast('Error', 'error'); return; }
  State.goals.push(data);
  closeModal();
  showToast(Persona.pick(Persona.goal.justStarted(name)), 'success');
  renderActiveTab();
}

async function addToGoal(id) {
  const input   = document.getElementById(`goalAdd-${id}`);
  const amount  = parseFloat(input.value) || 0;
  if (!amount) return;
  const goal    = State.goals.find(g => g.id === id);
  if (!goal) return;
  const newAmt  = goal.current_amount + amount;
  const status  = newAmt >= goal.target_amount ? 'achieved' : 'active';
  const { error } = await GoalsDB.update(id, { current_amount: newAmt, status });
  if (error) { showToast('Error', 'error'); return; }
  goal.current_amount = newAmt;
  goal.status = status;
  if (status === 'achieved') {
    Confetti.fire();
    showToast(Persona.pick(Persona.goal.achieved(goal.name)), 'success');
  } else {
    showToast(`+$${fmt(amount)} added to "${goal.name}" 🌸`, 'success');
  }
  renderActiveTab();
}

async function removeGoal(id) {
  if (!confirm('Remove this goal?')) return;
  await GoalsDB.remove(id);
  State.goals = State.goals.filter(g => g.id !== id);
  renderActiveTab();
}

async function updateYTD() {
  const gross    = parseFloat(document.getElementById('ytdGross').value) || 0;
  const withheld = parseFloat(document.getElementById('ytdWithheld').value) || 0;
  const { error } = await TaxDB.upsert(State.user.id, { ...State.taxSettings, ytd_gross: gross, ytd_withheld: withheld });
  if (error) { showToast('Error saving', 'error'); return; }
  State.taxSettings = { ...State.taxSettings, ytd_gross: gross, ytd_withheld: withheld };
  showToast('YTD updated ✓', 'success');
  renderActiveTab();
}

async function saveMonthlyGoal() {
  const val = parseFloat(document.getElementById('monthlyGoalInput').value) || 0;
  if (!val) { showToast('Enter an amount', 'error'); return; }
  const { error } = await UserDB.upsert(State.user.id, { monthly_goal: val });
  if (error) { showToast('Error saving', 'error'); return; }
  State.profile = { ...State.profile, monthly_goal: val };
  showToast(`Goal set to $${fmt(val)} 🌸`, 'success');
  updateMoodRing();
  renderActiveTab();
}

function toggleGuide(i) {
  const detail  = document.getElementById(`guide-detail-${i}`);
  const chevron = document.getElementById(`chevron-${i}`);
  if (!detail) return;
  const open = detail.style.display !== 'block';
  detail.style.display = open ? 'block' : 'none';
  chevron.textContent  = open ? '▾' : '▸';
}

// ---- AUTH ----
function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display  = 'none';
}
function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display  = 'block';
  renderActiveTab();
}

async function signInWithGoogle() {
  document.getElementById('authMsg').textContent = '';
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://nanjalamayungu.github.io/Broke-No-More/',
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
  if (error) document.getElementById('authMsg').textContent = 'Error: ' + error.message;
}

async function sendMagicLink() {
  const email = document.getElementById('authEmail').value.trim();
  if (!email) { showToast('Enter your email', 'error'); return; }
  const { error } = await Auth.signIn(email);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  document.getElementById('authMsg').textContent = '🌸 Check your email for the login link!';
}

// ---- TOAST ----
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  clearTimeout(State.toast);
  State.toast = setTimeout(() => t.className = 'toast', 3200);
}

// ---- HELPERS ----
function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.slice(0,5).split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${hour12}:${String(m).padStart(2,'0')}${period}`;
}

document.addEventListener('DOMContentLoaded', boot);
