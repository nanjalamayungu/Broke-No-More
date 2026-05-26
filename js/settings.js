// ============================================================
// settings.js — Settings tab renderer + actions
// Everything Ruth can customise from the UI
// ============================================================

function renderSettings() {
  const profile  = State.profile || {};
  const tax      = State.taxSettings || {};
  const jobs     = State.jobs || [];

  return `
    <div class="settings-view">

      <div class="greeting-card">
        <div class="greeting-text">Settings ⚙️</div>
        <div class="greeting-sub">Everything is yours to customise</div>
      </div>

      <!-- Profile -->
      <div class="settings-section">
        <div class="settings-section-title">👤 Your profile</div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Display name</div>
            <div class="setting-sub">What Broke No More calls you</div>
          </div>
          <input type="text" class="bnm-input sm" id="setName" value="${profile.display_name || ''}" placeholder="e.g. Ruth" style="width:120px" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Visa type</div>
            <div class="setting-sub">Affects tax calculations</div>
          </div>
          <select class="bnm-select" id="setVisa" style="width:100px;padding:7px 10px;font-size:12px">
            <option ${profile.visa_type === 'F-1' ? 'selected' : ''}>F-1</option>
            <option ${profile.visa_type === 'J-1' ? 'selected' : ''}>J-1</option>
            <option ${profile.visa_type === 'OPT' ? 'selected' : ''}>OPT</option>
            <option ${profile.visa_type === 'H-1B' ? 'selected' : ''}>H-1B</option>
            <option ${profile.visa_type === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Country of origin</div>
            <div class="setting-sub">Used for tax treaty lookup</div>
          </div>
          <input type="text" class="bnm-input sm" id="setCountry" value="${profile.country_of_origin || 'Kenya'}" style="width:110px" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">US State</div>
            <div class="setting-sub">State income tax rate</div>
          </div>
          <input type="text" class="bnm-input sm" id="setState" value="${profile.us_state || 'Colorado'}" style="width:100px" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Years in US</div>
            <div class="setting-sub">FICA exempt if under 5</div>
          </div>
          <input type="number" class="bnm-input sm" id="setYears" value="${profile.years_in_us || 1}" min="0" max="20" style="width:70px" />
        </div>

        <div style="margin-top:14px">
          <button class="btn-primary" onclick="saveProfile()" style="width:100%">Save profile</button>
        </div>
      </div>

      <!-- Jobs -->
      <div class="settings-section">
        <div class="settings-section-title">💼 Jobs & income sources</div>

        <div id="jobsList">
          ${jobs.length === 0
            ? '<div class="empty-state" style="padding:16px">No jobs yet. Add one below.</div>'
            : jobs.map(j => `
              <div class="job-list-item">
                <div class="job-color-dot" style="background:${j.color}"></div>
                <div class="job-list-name">${j.name}</div>
                <div class="job-list-rate">$${j.hourly_rate}/hr</div>
                <button class="btn-sm" onclick="openEditJob('${j.id}')">Edit</button>
                <button class="btn-sm danger" onclick="deleteJob('${j.id}')">✕</button>
              </div>`).join('')
          }
        </div>

        <button class="btn-add" style="margin-top:12px;width:100%;text-align:center" onclick="openAddJob()">
          + Add job or income source
        </button>
      </div>

      <!-- Tax settings -->
      <div class="settings-section">
        <div class="settings-section-title">🧾 Tax settings</div>

        <div class="setting-row">
          <div>
            <div class="setting-label">FICA exempt</div>
            <div class="setting-sub">F-1 under 5 years = exempt</div>
          </div>
          <select class="bnm-select" id="setFica" style="width:100px;padding:7px 10px;font-size:12px">
            <option value="true"  ${tax.fica_exempt !== false ? 'selected' : ''}>Yes</option>
            <option value="false" ${tax.fica_exempt === false ? 'selected' : ''}>No</option>
          </select>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Has tax treaty</div>
            <div class="setting-sub">Kenya = No treaty</div>
          </div>
          <select class="bnm-select" id="setTreaty" style="width:100px;padding:7px 10px;font-size:12px">
            <option value="false" ${!tax.has_tax_treaty ? 'selected' : ''}>No</option>
            <option value="true"  ${tax.has_tax_treaty  ? 'selected' : ''}>Yes</option>
          </select>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Treaty exempt amount</div>
            <div class="setting-sub">Annual $ exempt under treaty</div>
          </div>
          <input type="number" class="bnm-input sm" id="setTreatyAmount" value="${tax.treaty_amount || 0}" style="width:80px" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">State tax rate</div>
            <div class="setting-sub">Colorado = 0.044 (4.4%)</div>
          </div>
          <input type="number" class="bnm-input sm" id="setStateRate" value="${tax.state_tax_rate || 0.044}" step="0.001" style="width:80px" />
        </div>

        <div style="margin-top:14px">
          <button class="btn-primary" onclick="saveTaxSettings()" style="width:100%">Save tax settings</button>
        </div>
      </div>

      <!-- App preferences -->
      <div class="settings-section">
        <div class="settings-section-title">🎨 App preferences</div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Monthly income goal</div>
            <div class="setting-sub">Take-home target after taxes</div>
          </div>
          <input type="number" class="bnm-input sm" id="setGoalAmount" value="${profile.monthly_goal || 2400}" style="width:90px" />
        </div>

        <div style="margin-top:14px">
          <button class="btn-primary" onclick="saveAppPrefs()" style="width:100%">Save preferences</button>
        </div>
      </div>

      <!-- Calendar Sync -->
      <div class="settings-section">
        <div class="settings-section-title">📅 Google Calendar Sync</div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Sync shifts from calendar</div>
            <div class="setting-sub">Pulls events matching your job keywords</div>
          </div>
          <button class="btn-sm" onclick="syncCalendar()" id="syncCalBtn">Sync now</button>
        </div>
        <div id="syncCalStatus" style="font-size:11px;color:var(--muted);margin-top:8px;font-family:'DM Mono',monospace;display:none"></div>
        <div style="font-size:11px;color:var(--muted2);margin-top:8px;line-height:1.6">
          Make sure each job has a <strong>calendar keyword</strong> matching what HotSchedules puts in the event title. Currently checking for: <strong>${jobs.filter(j=>j.calendar_keyword).map(j=>j.calendar_keyword).join(', ') || 'none set'}</strong>
        </div>
      </div>

      <!-- Account -->
      <div class="settings-section">
        <div class="settings-section-title">🔐 Account</div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Signed in as</div>
            <div class="setting-sub">${State.user?.email || '—'}</div>
          </div>
          <button class="btn-sm danger" onclick="Auth.signOut()">Sign out</button>
        </div>
      </div>

    </div>`;
}

// ---- Settings actions ----

async function saveProfile() {
  const updates = {
    display_name:     document.getElementById('setName').value.trim(),
    visa_type:        document.getElementById('setVisa').value,
    country_of_origin:document.getElementById('setCountry').value.trim(),
    us_state:         document.getElementById('setState').value.trim(),
    years_in_us:      parseInt(document.getElementById('setYears').value) || 1,
  };
  const { error } = await UserDB.upsert(State.user.id, updates);
  if (error) { showToast('Error saving profile', 'error'); return; }
  State.profile = { ...State.profile, ...updates };
  showToast('Profile saved 🌸', 'success');
}

async function saveTaxSettings() {
  const updates = {
    fica_exempt:    document.getElementById('setFica').value === 'true',
    has_tax_treaty: document.getElementById('setTreaty').value === 'true',
    treaty_amount:  parseFloat(document.getElementById('setTreatyAmount').value) || 0,
    state_tax_rate: parseFloat(document.getElementById('setStateRate').value) || 0.044,
  };
  const { error } = await TaxDB.upsert(State.user.id, updates);
  if (error) { showToast('Error saving tax settings', 'error'); return; }
  State.taxSettings = { ...State.taxSettings, ...updates };
  showToast('Tax settings saved ✓', 'success');
}

async function saveAppPrefs() {
  const goal = parseFloat(document.getElementById('setGoalAmount').value) || 2400;
  const { error } = await UserDB.upsert(State.user.id, { monthly_goal: goal });
  if (error) { showToast('Error saving', 'error'); return; }
  State.profile = { ...State.profile, monthly_goal: goal };
  showToast('Preferences saved ✓', 'success');
}

function openAddJob() {
  const colors = ['#f7c4a0','#a8d4f5','#a8d5b5','#f4a7c3','#c8b4f0','#f0b429','#e87040'];
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Add job or income source</div>

      <div class="form-group">
        <label>Job name</label>
        <input type="text" id="jobName" class="bnm-input" placeholder="e.g. Sodexo, Babysitting, Tutoring" />
      </div>

      <div class="form-group">
        <label>Schedule type</label>
        <select id="jobType" class="bnm-select">
          <option value="fixed">Fixed — same shifts every week</option>
          <option value="rotating">Rotating — assigned each week (e.g. HotSchedules)</option>
          <option value="flexible">Flexible — varies, I log manually</option>
          <option value="gig">Gig — one-off jobs, flat rate</option>
        </select>
      </div>

      <div class="form-group">
        <label>Hourly rate ($) — leave 0 for flat-rate gigs</label>
        <input type="number" id="jobRate" class="bnm-input" placeholder="e.g. 21.50" step="0.50" />
      </div>

      <div class="form-group">
        <label>Calendar keyword (for Google Calendar sync)</label>
        <input type="text" id="jobKeyword" class="bnm-input" placeholder="e.g. korbel, sodexo" />
      </div>

      <div class="form-group">
        <label>Color</label>
        <div class="color-picker">
          ${colors.map((c,i) => `<div class="color-dot ${i===0?'selected':''}" style="background:${c}" data-color="${c}" onclick="selectColor('${c}')"></div>`).join('')}
        </div>
        <input type="hidden" id="jobColor" value="${colors[0]}" />
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveJob()">Add job</button>
      </div>
    </div>`);
}

async function saveJob() {
  const name    = document.getElementById('jobName').value.trim();
  const rate    = parseFloat(document.getElementById('jobRate').value) || 0;
  const type    = document.getElementById('jobType').value;
  const keyword = document.getElementById('jobKeyword').value.trim();
  const color   = document.getElementById('jobColor').value;

  if (!name) { showToast('Enter a job name', 'error'); return; }

  const { data, error } = await JobsDB.create(State.user.id, {
    name, hourly_rate: rate, schedule_type: type,
    calendar_keyword: keyword, color, is_active: true,
  });
  if (error) { showToast('Error adding job', 'error'); return; }

  State.jobs.push(data);
  closeModal();
  showToast(`${name} added! 💼`, 'success');
  renderActiveTab();
}

async function deleteJob(id) {
  if (!confirm('Remove this job? Past shifts are kept.')) return;
  const { error } = await JobsDB.remove(id);
  if (error) { showToast('Error removing job', 'error'); return; }
  State.jobs = State.jobs.filter(j => j.id !== id);
  showToast('Job removed', 'warn');
  renderActiveTab();
}

function openEditJob(id) {
  const job    = State.jobs.find(j => j.id === id);
  if (!job) return;
  const colors = ['#f7c4a0','#a8d4f5','#a8d5b5','#f4a7c3','#c8b4f0','#f0b429','#e87040'];
  openModal(`
    <div class="modal-card">
      <div class="modal-handle"></div>
      <div class="modal-title">Edit ${job.name}</div>

      <div class="form-group">
        <label>Job name</label>
        <input type="text" id="editJobName" class="bnm-input" value="${job.name}" />
      </div>
      <div class="form-group">
        <label>Hourly rate ($)</label>
        <input type="number" id="editJobRate" class="bnm-input" value="${job.hourly_rate}" step="0.50" />
      </div>
      <div class="form-group">
        <label>Calendar keyword</label>
        <input type="text" id="editJobKeyword" class="bnm-input" value="${job.calendar_keyword || ''}" />
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker">
          ${colors.map(c => `<div class="color-dot ${c===job.color?'selected':''}" style="background:${c}" data-color="${c}" onclick="selectColor('${c}')"></div>`).join('')}
        </div>
        <input type="hidden" id="jobColor" value="${job.color}" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="updateJob('${id}')">Save changes</button>
      </div>
    </div>`);
}

async function updateJob(id) {
  const updates = {
    name:             document.getElementById('editJobName').value.trim(),
    hourly_rate:      parseFloat(document.getElementById('editJobRate').value) || 0,
    calendar_keyword: document.getElementById('editJobKeyword').value.trim(),
    color:            document.getElementById('jobColor').value,
  };
  const { error } = await JobsDB.update(id, updates);
  if (error) { showToast('Error updating job', 'error'); return; }
  const idx = State.jobs.findIndex(j => j.id === id);
  if (idx >= 0) State.jobs[idx] = { ...State.jobs[idx], ...updates };
  closeModal();
  showToast('Job updated ✓', 'success');
  renderActiveTab();
}

// ---- Calendar sync ----
async function syncCalendar() {
  const btn    = document.getElementById('syncCalBtn');
  const status = document.getElementById('syncCalStatus');
  if (!btn || !status) return;

  btn.textContent = 'Syncing…';
  btn.disabled    = true;
  status.style.display = 'block';
  status.textContent   = 'Reading your Google Calendar…';

  try {
    // Get stored token from database
    const { data: userData } = await getSupabase()
      .from('users')
      .select('google_calendar_token')
      .eq('id', State.user.id)
      .single();

    const tokenData = userData?.google_calendar_token;
    if (!tokenData?.access_token) {
      status.textContent = '❌ No calendar access. Sign out and sign back in with Google — you\'ll see a permissions screen this time.';
      btn.textContent = 'Sync now'; btn.disabled = false; return;
    }

    const token = tokenData.access_token;

    // Date range — previous month through next month
    const now      = new Date();
    const timeMin  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const timeMax  = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    status.textContent = 'Fetching shifts from Google…';

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&orderBy=startTime&maxResults=250`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!calRes.ok) {
      const err = await calRes.json();
      if (err.error?.code === 401) {
        status.textContent = '❌ Calendar access expired. Sign out and sign back in with Google.';
      } else {
        status.textContent = '❌ Google error: ' + (err.error?.message || 'Unknown error');
      }
      btn.textContent = 'Sync now'; btn.disabled = false; return;
    }

    const calData = await calRes.json();
    const events  = calData.items || [];

    // Build keyword map from jobs
    const keywordMap = {};
    State.jobs.forEach(j => {
      if (j.calendar_keyword) keywordMap[j.calendar_keyword.toLowerCase()] = j;
    });

    let synced = 0, skipped = 0;

    for (const event of events) {
      const title = (event.summary || '').toLowerCase();
      const matchedJob = Object.entries(keywordMap).find(([kw]) => title.includes(kw))?.[1];
      if (!matchedJob || !event.start?.dateTime) continue;

      const startDt  = new Date(event.start.dateTime);
      const endDt    = new Date(event.end.dateTime);
      const hours    = Math.round(((endDt - startDt) / 3600000) * 10) / 10;
      if (hours < 0.5) continue;

      const shiftDate = startDt.toISOString().split('T')[0];
      const grossPay  = Math.round(hours * matchedJob.hourly_rate * 100) / 100;

      // Check if already imported
      const { data: existing } = await getSupabase()
        .from('income_events')
        .select('id')
        .eq('user_id', State.user.id)
        .eq('calendar_event_id', event.id)
        .single();

      if (existing) { skipped++; continue; }

      const { error: insertError } = await getSupabase()
        .from('income_events')
        .insert({
          user_id:           State.user.id,
          job_id:            matchedJob.id,
          source_type:       'calendar',
          title:             event.summary || matchedJob.name,
          shift_date:        shiftDate,
          start_time:        startDt.toTimeString().slice(0, 5),
          end_time:          endDt.toTimeString().slice(0, 5),
          hours,
          hourly_rate:       matchedJob.hourly_rate,
          gross_pay:         grossPay,
          status:            'scheduled',
          tax_treatment:     'taxable',
          calendar_event_id: event.id,
          notes:             'Synced from Google Calendar',
        });

      if (!insertError) synced++;
    }

    status.textContent = `✅ Done — ${synced} new shifts added, ${skipped} already existed.`;
    if (synced > 0) {
      showToast(`${synced} shifts pulled from calendar 🌸`, 'success');
      await loadMonthData();
    }

  } catch (err) {
    status.textContent = '❌ Error: ' + err.message;
  }

  btn.textContent = 'Sync now';
  btn.disabled    = false;
}
