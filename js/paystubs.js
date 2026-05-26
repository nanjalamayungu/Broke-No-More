// ============================================================
// paystubs.js — Paystub logger and tax year summary
// ============================================================

// State for paystubs (loaded separately from main month data)
const PaystubState = {
  paystubs: [],
  loaded: false,
};

async function loadPaystubs() {
  const { data } = await PaystubsDB.list(State.user.id, State.currentYear);
  PaystubState.paystubs = data || [];
  PaystubState.loaded   = true;
}

// ---- RENDER PAYSTUBS TAB ----

function renderPaystubs() {
  if (!PaystubState.loaded) {
    loadPaystubs().then(() => {
      const content = document.getElementById('tabContent');
      if (State.activeTab === 'paystubs') content.innerHTML = renderPaystubs();
    });
  }

  const stubs = PaystubState.paystubs;
  const year  = State.currentYear;
  const jobs  = State.jobs;

  // YTD totals
  const ytdGross    = stubs.reduce((s, p) => s + (p.gross_pay || 0), 0);
  const ytdFederal  = stubs.reduce((s, p) => s + (p.federal_withheld || 0), 0);
  const ytdState    = stubs.reduce((s, p) => s + (p.state_withheld || 0), 0);
  const ytdFica     = stubs.reduce((s, p) => s + (p.fica_withheld || 0), 0);
  const ytdNet      = stubs.reduce((s, p) => s + (p.net_pay || 0), 0);
  const ytdWithheld = ytdFederal + ytdState + ytdFica;

  // True tax owed on YTD gross
  const trueOwed    = Tax.calculate(ytdGross, State.taxSettings);
  const refundCalc  = Tax.estimateRefund(ytdGross, ytdWithheld, ytdGross, State.taxSettings);

  // FICA flag — any paystub with FICA > 0 when user is exempt
  const ficaFlag = State.taxSettings?.fica_exempt !== false &&
    stubs.some(p => (p.fica_withheld || 0) > 0);

  // Per-job breakdown
  const jobTotals = {};
  jobs.forEach(j => { jobTotals[j.id] = { name: j.name, color: j.color, gross: 0, withheld: 0, count: 0 }; });
  stubs.forEach(p => {
    if (p.job_id && jobTotals[p.job_id]) {
      jobTotals[p.job_id].gross    += p.gross_pay || 0;
      jobTotals[p.job_id].withheld += (p.federal_withheld || 0) + (p.state_withheld || 0);
      jobTotals[p.job_id].count++;
    }
  });

  return `
    <div class="paystubs-view">

      <div class="greeting-card">
        <div class="greeting-text">Paystubs & Tax Summary 🧾</div>
        <div class="greeting-sub">${year} year-to-date · ${stubs.length} paystub${stubs.length !== 1 ? 's' : ''} logged</div>
      </div>

      ${ficaFlag ? `
        <div class="fica-alert">
          <span class="fica-alert-icon">🚨</span>
          <div>
            <strong>FICA wrongly withheld!</strong> One or more paystubs show Social Security or Medicare deductions.
            As an F-1 student you are exempt. Contact payroll at the relevant employer immediately and request a refund.
            If unresolved, file <a href="https://www.irs.gov/forms-pubs/about-form-843" target="_blank" style="color:var(--danger)">IRS Form 843</a>.
          </div>
        </div>` : ''}

      <!-- YTD Summary -->
      <div class="paystub-summary-card">
        <div class="section-title" style="margin-bottom:12px">${year} Year-to-date</div>
        <div class="ps-row"><span>Total gross earnings</span><span>$${fmt(ytdGross)}</span></div>
        <div class="ps-row"><span>Federal tax withheld</span><span class="neg">−$${fmt(ytdFederal)}</span></div>
        <div class="ps-row"><span>State tax withheld</span><span class="neg">−$${fmt(ytdState)}</span></div>
        <div class="ps-row"><span>FICA withheld ${ficaFlag ? '⚠️' : '(should be $0)'}</span>
          <span class="${ficaFlag ? 'neg' : 'pos'}">
            ${ficaFlag ? '−$' + fmt(ytdFica) : '$0 ✓'}
          </span>
        </div>
        <div class="ps-divider"></div>
        <div class="ps-row"><span>Total withheld</span><span class="neg">−$${fmt(ytdWithheld)}</span></div>
        <div class="ps-row"><span>Net pay received</span><span>$${fmt(ytdNet)}</span></div>
      </div>

      <!-- Refund projection -->
      <div class="refund-projection-card ${refundCalc.isRefund ? 'refund' : 'owe'}">
        <div class="ref-proj-label">${refundCalc.isRefund ? 'Estimated April refund' : 'Estimated amount owed'}</div>
        <div class="ref-proj-amount">${refundCalc.isRefund ? '+' : '−'}$${fmt(Math.abs(refundCalc.refundOrOwed))}</div>
        <div class="ref-proj-detail">
          True tax owed on $${fmt(ytdGross)} gross: $${fmt(refundCalc.trueOwed)} ·
          Total withheld: $${fmt(ytdWithheld)} ·
          ${refundCalc.isRefund
            ? `You overpaid by $${fmt(refundCalc.refundOrOwed)} — file your 1040-NR by April 15 to claim it.`
            : `You underpaid by $${fmt(Math.abs(refundCalc.refundOrOwed))} — set this aside before April 15.`
          }
        </div>
      </div>

      <!-- Per-job breakdown -->
      ${Object.values(jobTotals).filter(j => j.count > 0).length > 0 ? `
        <div class="paystub-summary-card" style="margin-top:10px">
          <div class="section-title" style="margin-bottom:12px">By employer</div>
          ${Object.values(jobTotals).filter(j => j.count > 0).map(j => `
            <div class="ps-job-row">
              <div class="ps-job-dot" style="background:${j.color}"></div>
              <div class="ps-job-name">${j.name}</div>
              <div class="ps-job-stats">
                <span>$${fmt(j.gross)} gross</span>
                <span class="neg">−$${fmt(j.withheld)} withheld</span>
                <span style="color:var(--muted);font-size:10px">${j.count} stub${j.count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>` : ''}

      <!-- Paystub list -->
      <div class="section-header" style="margin-top:20px">
        <span class="section-title">Logged paystubs</span>
        <button class="btn-add" onclick="openAddPaystub()">+ Add paystub</button>
      </div>

      <div class="paystubs-list">
        ${stubs.length === 0
          ? `<div class="empty-state">No paystubs logged yet. Add your first one to get a real tax picture.</div>`
          : stubs.map(p => paystubCard(p)).join('')
        }
      </div>

    </div>`;
}

function paystubCard(p) {
  const job      = State.jobs.find(j => j.id === p.job_id);
  const jobName  = p.jobs?.name || job?.name || 'Unknown job';
  const jobColor = p.jobs?.color || job?.color || '#f4a7c3';
  const ficaWrong = State.taxSettings?.fica_exempt !== false && (p.fica_withheld || 0) > 0;

  // Compare estimated vs actual withholding
  const periodicGross = p.gross_pay || 0;
  const estimated     = Tax.estimateWithholding(periodicGross / 2); // assume biweekly
  const actualTotal   = (p.federal_withheld || 0) + (p.state_withheld || 0);
  const diff          = actualTotal - (estimated.federalHeld + estimated.stateHeld);
  const diffLabel     = Math.abs(diff) > 2
    ? `${diff > 0 ? 'Over' : 'Under'}-withheld by $${fmt(Math.abs(diff))}`
    : 'Withholding looks correct';

  const startDate = new Date(p.pay_period_start + 'T12:00:00');
  const endDate   = new Date(p.pay_period_end + 'T12:00:00');
  const periodLabel = `${startDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${endDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;

  return `
    <div class="paystub-card-item">
      <div class="ps-card-top">
        <div class="ps-job-dot" style="background:${jobColor}"></div>
        <div class="ps-card-info">
          <div class="ps-card-job">${jobName}</div>
          <div class="ps-card-period">${periodLabel}</div>
        </div>
        <div class="ps-card-net">$${fmt(p.net_pay)}<span class="ps-net-label"> net</span></div>
        <button class="icon-btn sm" onclick="deletePaystub('${p.id}')" title="Delete">✕</button>
      </div>
      <div class="ps-card-breakdown">
        <span>Gross: $${fmt(p.gross_pay)}</span>
        <span class="neg">Fed: −$${fmt(p.federal_withheld)}</span>
        <span class="neg">State: −$${fmt(p.state_withheld)}</span>
        ${ficaWrong ? `<span class="neg">FICA: −$${fmt(p.fica_withheld)} ⚠️</span>` : ''}
      </div>
      <div class="ps-card-estimate ${Math.abs(diff) > 2 ? (diff > 0 ? 'over' : 'under') : 'ok'}">
        ${diffLabel}
      </div>
    </div>`;
}

// ---- Add paystub modal ----

function openAddPaystub() {
  const jobs = State.jobs;
  const now  = new Date();
  // Default to last 2 weeks
  const periodEnd   = now.toISOString().split('T')[0];
  const periodStart = new Date(now.setDate(now.getDate() - 14)).toISOString().split('T')[0];

  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Add paystub 🧾</div>

      <div class="form-group">
        <label>Employer</label>
        <select id="psJob" class="bnm-select">
          ${jobs.map(j => `<option value="${j.id}">${j.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Pay period start</label>
          <input type="date" id="psStart" class="bnm-input" value="${periodStart}" />
        </div>
        <div class="form-group">
          <label>Pay period end</label>
          <input type="date" id="psEnd" class="bnm-input" value="${periodEnd}" />
        </div>
      </div>

      <div class="form-group">
        <label>Gross pay ($) — before any deductions</label>
        <input type="number" id="psGross" class="bnm-input" placeholder="e.g. 516.00" step="0.01" oninput="estimatePaystub()" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Federal tax withheld ($)</label>
          <input type="number" id="psFederal" class="bnm-input" placeholder="e.g. 48.00" step="0.01" />
        </div>
        <div class="form-group">
          <label>State tax withheld ($)</label>
          <input type="number" id="psState" class="bnm-input" placeholder="e.g. 22.70" step="0.01" />
        </div>
      </div>

      <div class="form-group">
        <label>FICA withheld ($) — should be $0 for F-1 students</label>
        <input type="number" id="psFica" class="bnm-input" placeholder="0.00" step="0.01" value="0" />
      </div>

      <div class="form-group">
        <label>Net pay ($) — what actually hit your account</label>
        <input type="number" id="psNet" class="bnm-input" placeholder="e.g. 445.30" step="0.01" />
      </div>

      <div id="psEstimate" style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:12px;line-height:1.6;display:none"></div>

      <div class="form-group">
        <label>Notes (optional)</label>
        <input type="text" id="psNotes" class="bnm-input" placeholder="e.g. Week of May 19" />
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="savePaystub()">Save paystub</button>
      </div>
    </div>`);
}

function estimatePaystub() {
  const gross = parseFloat(document.getElementById('psGross')?.value) || 0;
  const el    = document.getElementById('psEstimate');
  if (!el || gross <= 0) return;

  const est = Tax.estimateWithholding(gross / 2);
  el.style.display = 'block';
  el.innerHTML = `Estimate for this pay period: Fed ~$${fmt(est.federalHeld)} · State ~$${fmt(est.stateHeld)} · Take-home ~$${fmt(est.takeHome)}`;
}

async function savePaystub() {
  const jobId   = document.getElementById('psJob').value;
  const start   = document.getElementById('psStart').value;
  const end     = document.getElementById('psEnd').value;
  const gross   = parseFloat(document.getElementById('psGross').value) || 0;
  const federal = parseFloat(document.getElementById('psFederal').value) || 0;
  const state   = parseFloat(document.getElementById('psState').value) || 0;
  const fica    = parseFloat(document.getElementById('psFica').value) || 0;
  const net     = parseFloat(document.getElementById('psNet').value) || 0;
  const notes   = document.getElementById('psNotes').value;

  if (!start || !end || !gross) {
    showToast('Fill in pay period and gross pay', 'error'); return;
  }

  const { data, error } = await PaystubsDB.create(State.user.id, {
    job_id: jobId, pay_period_start: start, pay_period_end: end,
    gross_pay: gross, federal_withheld: federal, state_withheld: state,
    fica_withheld: fica, net_pay: net, notes,
  });

  if (error) { showToast('Error saving paystub', 'error'); return; }

  const job = State.jobs.find(j => j.id === jobId);
  PaystubState.paystubs.unshift({ ...data, jobs: job ? { name: job.name, color: job.color } : null });
  closeModal();

  // Check for FICA issue
  if (fica > 0 && State.taxSettings?.fica_exempt !== false) {
    showToast('⚠️ FICA detected! You are exempt — see paystubs tab.', 'error');
  } else {
    showToast('Paystub saved ✓', 'success');
  }

  renderActiveTab();
}

async function deletePaystub(id) {
  if (!confirm('Delete this paystub?')) return;
  const { error } = await PaystubsDB.remove(id);
  if (error) { showToast('Error deleting', 'error'); return; }
  PaystubState.paystubs = PaystubState.paystubs.filter(p => p.id !== id);
  showToast('Paystub removed', 'warn');
  renderActiveTab();
}
