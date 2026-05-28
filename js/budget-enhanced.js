// ============================================================
// budget-enhanced.js — Sinking funds and scheduled expenses
// ============================================================

// Scheduled expenses state
const ScheduledState = {
  items: [],
  loaded: false,
};

async function loadScheduled() {
  const { data } = await ScheduledDB.list(State.user.id);
  ScheduledState.items  = data || [];
  ScheduledState.loaded = true;
}

// ---- ENHANCED BUDGET RENDER ----
// Called instead of plain renderBudget() — replaces it

function renderBudgetEnhanced() {
  const cats     = State.categories;
  const expenses = State.expenses;
  const monthName = new Date(State.currentYear, State.currentMonth - 1)
    .toLocaleString('default', { month: 'long' });
  const totalAllocated = cats.reduce((s, c) => s + monthlyEquivalent(c), 0);
  const totalSpent     = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  if (!ScheduledState.loaded) {
    loadScheduled().then(() => {
      const content = document.getElementById('tabContent');
      if (State.activeTab === 'budget') content.innerHTML = renderBudgetEnhanced();
    });
  }

  // Upcoming scheduled expenses (next 60 days)
  const mtNow     = MT.now();
  const todayDate = new Date(mtNow.dateStr + 'T12:00:00');
  const in60Days  = new Date(todayDate.getTime() + 60 * 86400000);
  const upcoming  = ScheduledState.items.filter(e => {
    const due = new Date(e.due_date + 'T12:00:00');
    return due >= todayDate && due <= in60Days && !e.is_paid;
  });

  // Total upcoming amount
  const upcomingTotal = upcoming.reduce((s, e) => s + (e.amount || 0), 0);

  return `
    <div class="budget-view">
      <div class="greeting-card">
        <div class="greeting-text">Budget 📊</div>
        <div class="greeting-sub">${monthName} ${State.currentYear}</div>
      </div>

      <!-- Monthly overview -->
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
          <div class="bud-total-val ${totalAllocated - totalSpent >= 0 ? 'pos' : 'neg'}">
            $${fmt(totalAllocated - totalSpent)}
          </div>
        </div>
      </div>

      ${upcoming.length > 0 ? `
        <div class="upcoming-alert">
          <span class="upcoming-icon">📅</span>
          <div>
            <strong>${upcoming.length} bill${upcoming.length > 1 ? 's' : ''} due in the next 60 days</strong>
            totalling $${fmt(upcomingTotal)}.
            ${upcoming.slice(0,2).map(e => `<br>• ${e.name} — $${fmt(e.amount)} due ${formatDate(e.due_date)}`).join('')}
            ${upcoming.length > 2 ? `<br>• +${upcoming.length - 2} more` : ''}
          </div>
        </div>` : ''}

      <!-- Budget categories -->
      <div class="section-header">
        <span class="section-title">Monthly categories</span>
        <button class="btn-add" onclick="openAddCategoryEnhanced()">+ Category</button>
      </div>

      ${cats.length === 0
        ? `<div class="empty-state">No categories yet 🌷 Create one — name it whatever you want.</div>`
        : cats.map(cat => budgetCategoryCardEnhanced(cat, expenses)).join('')}

      <!-- Sinking funds section -->
      <div class="section-header" style="margin-top:20px">
        <span class="section-title">Sinking funds & irregular bills</span>
        <button class="btn-add" onclick="openAddScheduled()">+ Bill</button>
      </div>
      <div class="sinking-explainer">
        Set aside a little each month for irregular expenses — phone bills, textbooks, flights home.
        When the bill arrives, the money is already there.
      </div>

      <div class="scheduled-list">
        ${ScheduledState.items.length === 0
          ? `<div class="empty-state">No scheduled bills yet. Add Ruth's phone bill here.</div>`
          : ScheduledState.items.map(e => scheduledCard(e)).join('')}
      </div>

      <!-- Recent expenses -->
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

// Monthly equivalent of a category (handles irregular frequency)
function monthlyEquivalent(cat) {
  if (!cat.frequency || cat.frequency === 'monthly') {
    return cat.allocated_amount || 0;
  }
  if (cat.frequency === 'weekly') {
    return (cat.allocated_amount || 0) * 4.33;
  }
  if (cat.frequency === 'irregular' && cat.period_amount && cat.period_months) {
    return cat.period_amount / cat.period_months;
  }
  return cat.allocated_amount || 0;
}

function budgetCategoryCardEnhanced(cat, expenses) {
  const spent     = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0);
  const monthly   = monthlyEquivalent(cat);
  const pct       = monthly > 0 ? Math.min(100, Math.round((spent / monthly) * 100)) : 0;
  const over      = spent > monthly;
  const isIrregular = cat.frequency === 'irregular';

  // Sinking fund label
  let freqLabel = '';
  if (isIrregular && cat.period_amount && cat.period_months) {
    freqLabel = `$${fmt(cat.period_amount)} every ${cat.period_months} month${cat.period_months > 1 ? 's' : ''} · set aside $${fmt(monthly)}/mo`;
  } else if (cat.frequency === 'weekly') {
    freqLabel = `$${fmt(cat.allocated_amount)}/week · ~$${fmt(monthly)}/mo`;
  }

  return `
    <div class="budget-cat-card">
      <div class="cat-top">
        <div class="cat-dot" style="background:${cat.color || '#f4a7c3'}"></div>
        <div style="flex:1;min-width:0">
          <span class="cat-name">${cat.name}</span>
          ${freqLabel ? `<div class="cat-freq-label">${freqLabel}</div>` : ''}
        </div>
        <span class="cat-amounts">$${fmt(spent)} <span style="color:var(--muted2)">of $${fmt(monthly)}/mo</span></span>
        <button class="icon-btn sm" onclick="deleteCategory('${cat.id}')">✕</button>
      </div>
      <div class="cat-bar-wrap">
        <div class="cat-bar-fill" style="width:${pct}%;background:${over ? 'var(--danger)' : (cat.color || 'var(--pink)')}"></div>
      </div>
      ${over ? `<div class="cat-over-msg">Over by $${fmt(spent - monthly)}</div>` : ''}
    </div>`;
}

function scheduledCard(e) {
  const dueDate   = new Date(e.due_date + 'T12:00:00');
  const today     = new Date(MT.todayStr() + 'T12:00:00');
  const daysUntil = Math.ceil((dueDate - today) / 86400000);
  const isPast    = daysUntil < 0;
  const isUrgent  = daysUntil >= 0 && daysUntil <= 7;
  const catColor  = e.budget_categories?.color || '#f4a7c3';

  // Monthly set-aside suggestion
  let setAside = '';
  if (e.frequency === 'quarterly') setAside = `Set aside $${fmt(e.amount / 3)}/month`;
  else if (e.frequency === 'annual') setAside = `Set aside $${fmt(e.amount / 12)}/month`;
  else if (e.frequency === 'monthly') setAside = `Monthly bill`;

  return `
    <div class="scheduled-card ${e.is_paid ? 'paid' : ''} ${isUrgent ? 'urgent' : ''} ${isPast && !e.is_paid ? 'overdue' : ''}">
      <div class="sched-left">
        <div class="sched-dot" style="background:${catColor}"></div>
        <div class="sched-info">
          <div class="sched-name">${e.name}</div>
          <div class="sched-meta">
            ${isPast && !e.is_paid ? `<span class="sched-overdue">Overdue</span>` :
              isUrgent ? `<span class="sched-urgent">Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>` :
              `<span>Due ${formatDate(e.due_date)}</span>`}
            ${setAside ? `<span>${setAside}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="sched-right">
        <div class="sched-amount">$${fmt(e.amount)}</div>
        <div style="display:flex;gap:4px;margin-top:4px">
          ${!e.is_paid
            ? `<button class="btn-sm" onclick="markScheduledPaid('${e.id}')">✓ Paid</button>`
            : `<span style="font-size:10px;color:var(--sage-deep);font-family:'DM Mono',monospace">Paid ✓</span>`}
          <button class="icon-btn sm" onclick="deleteScheduled('${e.id}')">✕</button>
        </div>
      </div>
    </div>`;
}

// ---- Add category (enhanced) ----
function openAddCategoryEnhanced() {
  const colors = ['#f4a7c3','#a8d4f5','#a8d5b5','#f7c4a0','#c8b4f0','#f0b429','#e87040'];
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">New budget category</div>

      <div class="form-group">
        <label>Name — call it anything</label>
        <input type="text" id="catName" class="bnm-input" placeholder="e.g. Rent, Groceries, Fun money" />
      </div>

      <div class="form-group">
        <label>Frequency</label>
        <select id="catFreq" class="bnm-select" onchange="toggleCatFreqFields()">
          <option value="monthly">Monthly — I spend this every month</option>
          <option value="weekly">Weekly — I spend this every week</option>
          <option value="irregular">Irregular — bills that come every few months</option>
        </select>
      </div>

      <div id="catMonthlyFields">
        <div class="form-group">
          <label>Monthly budget ($)</label>
          <input type="number" id="catAmount" class="bnm-input" placeholder="e.g. 500" step="0.01" />
        </div>
      </div>

      <div id="catIrregularFields" style="display:none">
        <div class="form-row">
          <div class="form-group">
            <label>Total bill amount ($)</label>
            <input type="number" id="catPeriodAmount" class="bnm-input" placeholder="e.g. 131" step="0.01" oninput="updateSinkingPreview()" />
          </div>
          <div class="form-group">
            <label>Every how many months?</label>
            <input type="number" id="catPeriodMonths" class="bnm-input" placeholder="e.g. 3" min="1" max="24" oninput="updateSinkingPreview()" />
          </div>
        </div>
        <div id="sinkingPreview" style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:-8px;margin-bottom:12px"></div>
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
        <button class="btn-primary" onclick="saveCatEnhanced()">Create 🌸</button>
      </div>
    </div>`);
}

function toggleCatFreqFields() {
  const freq = document.getElementById('catFreq').value;
  document.getElementById('catMonthlyFields').style.display   = freq === 'irregular' ? 'none' : 'block';
  document.getElementById('catIrregularFields').style.display = freq === 'irregular' ? 'block' : 'none';
}

function updateSinkingPreview() {
  const amount = parseFloat(document.getElementById('catPeriodAmount')?.value) || 0;
  const months = parseInt(document.getElementById('catPeriodMonths')?.value) || 0;
  const preview = document.getElementById('sinkingPreview');
  if (!preview) return;
  if (amount > 0 && months > 0) {
    const monthly = amount / months;
    preview.textContent = `→ Set aside $${fmt(monthly)}/month to be ready when this bill arrives`;
  } else {
    preview.textContent = '';
  }
}

async function saveCatEnhanced() {
  const name    = document.getElementById('catName').value.trim();
  const freq    = document.getElementById('catFreq').value;
  const color   = document.getElementById('catColor').value;
  if (!name) { showToast('Enter a category name', 'error'); return; }

  let allocated = 0, periodAmount = null, periodMonths = null;

  if (freq === 'irregular') {
    periodAmount = parseFloat(document.getElementById('catPeriodAmount').value) || 0;
    periodMonths = parseInt(document.getElementById('catPeriodMonths').value) || 1;
    allocated    = periodAmount / periodMonths; // monthly equivalent
    if (!periodAmount) { showToast('Enter the bill amount', 'error'); return; }
  } else {
    allocated = parseFloat(document.getElementById('catAmount').value) || 0;
  }

  const { data, error } = await BudgetDB.createCategory(State.user.id, {
    name,
    allocated_amount: allocated,
    frequency: freq,
    period_amount: periodAmount,
    period_months: periodMonths,
    color,
    sort_order: State.categories.length,
  });

  if (error) { showToast('Error creating category', 'error'); return; }
  State.categories.push(data);
  closeModal();
  showToast(`"${name}" created! 🌷`, 'success');
  renderActiveTab();
}

// ---- Add scheduled expense ----
function openAddScheduled() {
  const cats = State.categories;
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Add scheduled bill 📅</div>

      <div class="form-group">
        <label>Bill name</label>
        <input type="text" id="schedName" class="bnm-input" placeholder="e.g. Phone bill, Textbooks, Dental" />
      </div>

      <div class="form-group">
        <label>Amount ($)</label>
        <input type="number" id="schedAmount" class="bnm-input" placeholder="e.g. 131.00" step="0.01" />
      </div>

      <div class="form-group">
        <label>Due date</label>
        <input type="date" id="schedDue" class="bnm-input" value="${MT.todayInputVal()}" />
      </div>

      <div class="form-group">
        <label>Frequency</label>
        <select id="schedFreq" class="bnm-select">
          <option value="once">One-time only</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Every 3 months</option>
          <option value="annual">Yearly</option>
        </select>
      </div>

      <div class="form-group">
        <label>Budget category (optional)</label>
        <select id="schedCat" class="bnm-select">
          <option value="">— None —</option>
          ${cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="schedNotes" class="bnm-input" placeholder="e.g. T-Mobile plan, 3 months" />
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveScheduled()">Add bill</button>
      </div>
    </div>`);
}

async function saveScheduled() {
  const name   = document.getElementById('schedName').value.trim();
  const amount = parseFloat(document.getElementById('schedAmount').value) || 0;
  const due    = document.getElementById('schedDue').value;
  const freq   = document.getElementById('schedFreq').value;
  const catId  = document.getElementById('schedCat').value || null;
  const notes  = document.getElementById('schedNotes').value;

  if (!name || !amount || !due) { showToast('Fill in name, amount and due date', 'error'); return; }

  const { data, error } = await ScheduledDB.create(State.user.id, {
    name, amount, due_date: due, frequency: freq,
    category_id: catId, notes, is_paid: false,
  });

  if (error) { showToast('Error adding bill', 'error'); return; }
  const cat = State.categories.find(c => c.id === catId);
  ScheduledState.items.push({ ...data, budget_categories: cat || null });
  closeModal();
  showToast(`"${name}" scheduled ✓`, 'success');
  renderActiveTab();
}

async function markScheduledPaid(id) {
  const { error } = await ScheduledDB.update(id, { is_paid: true });
  if (error) { showToast('Error', 'error'); return; }
  const item = ScheduledState.items.find(e => e.id === id);
  if (item) item.is_paid = true;
  showToast('Marked as paid ✓', 'success');
  renderActiveTab();
}

async function deleteScheduled(id) {
  if (!confirm('Remove this scheduled bill?')) return;
  const { error } = await ScheduledDB.remove(id);
  if (error) { showToast('Error', 'error'); return; }
  ScheduledState.items = ScheduledState.items.filter(e => e.id !== id);
  renderActiveTab();
}
