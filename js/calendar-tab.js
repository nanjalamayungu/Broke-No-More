// ============================================================
// calendar-tab.js — Visual calendar tab
// Reads from State.incomeEvents — no extra DB calls
// ============================================================

function renderCalendarTab() {
  const year       = State.currentYear;
  const month      = State.currentMonth;
  const monthName  = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const mtNow      = MT.now();  // Always Mountain Time
  const todayDay   = (mtNow.year === year && mtNow.month === month) ? mtNow.day : null;

  // Build a map of date → events
  const eventMap = {};
  State.incomeEvents.forEach(e => {
    const d = e.shift_date; // 'YYYY-MM-DD'
    if (!eventMap[d]) eventMap[d] = [];
    eventMap[d].push(e);
  });

  // Always Mountain Time — correct from any device location
  const todayStr    = MT.todayStr();
  const tomorrowStr = MT.tomorrowStr();
  const todayShifts    = (eventMap[todayStr]    || []).filter(e => e.status !== 'cancelled');
  const tomorrowShifts = (eventMap[tomorrowStr] || []).filter(e => e.status !== 'cancelled');

  // Build calendar grid
  const firstDay    = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  let gridCells = '';

  // Day headers
  const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  gridCells += dayHeaders.map(d =>
    `<div class="cal-header-cell">${d}</div>`
  ).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    gridCells += `<div class="cal-cell empty"></div>`;
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayEvts  = (eventMap[dateStr] || []).filter(e => e.status !== 'cancelled');
    const isToday  = day === todayDay;
    const isPast   = todayDay && day < todayDay;

    // Get dots for each event (color coded by job)
    const dots = dayEvts.slice(0, 3).map(e => {
      const job   = State.jobs.find(j => j.id === e.job_id);
      const color = e.jobs?.color || job?.color || '#f4a7c3';
      return `<div class="cal-dot" style="background:${color}"></div>`;
    }).join('');

    const totalEarnings = dayEvts.reduce((s, e) => s + (e.gross_pay || 0), 0);
    const earningsLabel = totalEarnings > 0 ? `<div class="cal-earn">$${Math.round(totalEarnings)}</div>` : '';

    gridCells += `
      <div class="cal-cell ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${dayEvts.length ? 'has-events' : ''}"
           onclick="openDayDetail('${dateStr}')">
        <div class="cal-day-num">${day}</div>
        <div class="cal-dots">${dots}</div>
        ${earningsLabel}
      </div>`;
  }

  // Fill remaining cells to complete the grid
  const totalCells = firstDay + daysInMonth;
  const remainder  = totalCells % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      gridCells += `<div class="cal-cell empty"></div>`;
    }
  }

  return `
    <div class="calendar-view">

      ${buildReminderCard(todayShifts, tomorrowShifts, todayStr, tomorrowStr)}

      <div class="cal-grid">
        ${gridCells}
      </div>

      <div class="cal-legend">
        ${State.jobs.map(j => `
          <div class="cal-legend-item">
            <div class="cal-dot" style="background:${j.color}"></div>
            <span>${j.name}</span>
          </div>
        `).join('')}
      </div>

      <div id="dayDetailSheet" class="day-detail-sheet" style="display:none"></div>
    </div>`;
}

function buildReminderCard(todayShifts, tomorrowShifts, todayStr, tomorrowStr) {
  const mtNow = MT.now();
  const hour  = mtNow.hour;  // Mountain Time hour

  if (todayShifts.length > 0) {
    const shift    = todayShifts[0];
    const job      = State.jobs.find(j => j.id === shift.job_id);
    const jobName  = shift.jobs?.name || job?.name || 'shift';
    const taxCalc  = Tax.calculate(shift.gross_pay || 0, State.taxSettings);
    const timeStr  = shift.start_time ? shift.start_time.slice(0,5) : '';
    const timeLeft = shift.start_time ? getTimeUntil(shift.start_time) : '';

    // Check if shift already started
    const shiftHour = parseInt(shift.start_time?.slice(0,2) || '0');
    const started   = hour >= shiftHour;

    const msg = started
      ? `You're on your ${jobName} shift right now 💪 That's $${Math.round(taxCalc.takeHome)} after taxes today.`
      : `You have a ${jobName} shift at ${formatTime12(shift.start_time)} today${timeLeft ? ` — ${timeLeft} away` : ''}. That's $${Math.round(taxCalc.takeHome)} after taxes.`;

    return `
      <div class="reminder-card today-card">
        <div class="reminder-icon">⏰</div>
        <div class="reminder-body">
          <div class="reminder-label">TODAY</div>
          <div class="reminder-msg">${msg}</div>
          ${todayShifts.length > 1 ? `<div class="reminder-more">+${todayShifts.length - 1} more shift${todayShifts.length > 2 ? 's' : ''} today</div>` : ''}
        </div>
      </div>`;
  }

  if (tomorrowShifts.length > 0) {
    const shift   = tomorrowShifts[0];
    const job     = State.jobs.find(j => j.id === shift.job_id);
    const jobName = shift.jobs?.name || job?.name || 'shift';
    const taxCalc = Tax.calculate(shift.gross_pay || 0, State.taxSettings);
    const timeStr = shift.start_time ? formatTime12(shift.start_time) : '';

    return `
      <div class="reminder-card tomorrow-card">
        <div class="reminder-icon">🌅</div>
        <div class="reminder-body">
          <div class="reminder-label">TOMORROW</div>
          <div class="reminder-msg">${jobName} at ${timeStr}${shift.end_time ? ' – ' + formatTime12(shift.end_time) : ''}. $${Math.round(taxCalc.takeHome)} after taxes. Rest up tonight 🌸</div>
        </div>
      </div>`;
  }

  // Nothing today or tomorrow
  return `
    <div class="reminder-card free-card">
      <div class="reminder-icon">✨</div>
      <div class="reminder-body">
        <div class="reminder-label">NO SHIFTS</div>
        <div class="reminder-msg">Nothing today or tomorrow. Enjoy the break — or pick up an extra shift if you need it.</div>
      </div>
    </div>`;
}

function openDayDetail(dateStr) {
  const sheet  = document.getElementById('dayDetailSheet');
  if (!sheet) return;

  const events = State.incomeEvents.filter(e => e.shift_date === dateStr);
  const d      = new Date(dateStr + 'T12:00:00');
  const label  = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (events.length === 0) {
    // Offer to add a shift on this day
    sheet.innerHTML = `
      <div class="day-sheet-inner">
        <div class="day-sheet-header">
          <span class="day-sheet-date">${label}</span>
          <button class="day-sheet-close" onclick="closeDayDetail()">✕</button>
        </div>
        <div class="day-sheet-empty">No shifts on this day.</div>
        <button class="btn-add" style="width:100%;margin-top:12px;text-align:center"
          onclick="closeDayDetail(); openAddShiftOnDate('${dateStr}')">+ Add shift on this day</button>
      </div>`;
  } else {
    const total    = events.filter(e => e.status !== 'cancelled').reduce((s, e) => s + (e.gross_pay || 0), 0);
    const taxCalc  = Tax.calculate(total, State.taxSettings);
    sheet.innerHTML = `
      <div class="day-sheet-inner">
        <div class="day-sheet-header">
          <span class="day-sheet-date">${label}</span>
          <button class="day-sheet-close" onclick="closeDayDetail()">✕</button>
        </div>
        <div class="day-sheet-summary">
          $${fmt(total)} gross · $${fmt(taxCalc.takeHome)} take-home
        </div>
        ${events.map(e => {
          const job   = State.jobs.find(j => j.id === e.job_id);
          const color = e.jobs?.color || job?.color || '#f4a7c3';
          const isCancelled = e.status === 'cancelled';
          return `
            <div class="day-shift-row ${isCancelled ? 'cancelled' : ''}">
              <div class="day-shift-dot" style="background:${color}"></div>
              <div class="day-shift-info">
                <div class="day-shift-name">${e.jobs?.name || e.title || 'Shift'}</div>
                <div class="day-shift-time">
                  ${e.start_time ? formatTime12(e.start_time) + (e.end_time ? ' – ' + formatTime12(e.end_time) : '') : ''}
                  ${e.hours ? ` · ${e.hours}h` : ''}
                </div>
              </div>
              <div class="day-shift-earn ${isCancelled ? 'strike' : ''}">$${fmt(e.gross_pay)}</div>
              <div style="display:flex;gap:4px">
                <button class="icon-btn sm" onclick="openEditShift('${e.id}')" title="Edit">✎</button>
                ${!isCancelled
                  ? `<button class="icon-btn sm" onclick="cancelShift('${e.id}');closeDayDetail()" title="Cancel">✕</button>`
                  : `<button class="icon-btn sm restore" onclick="restoreShift('${e.id}');closeDayDetail()" title="Restore">↩</button>`
                }
              </div>
            </div>`;
        }).join('')}
        <button class="btn-add" style="width:100%;margin-top:12px;text-align:center"
          onclick="closeDayDetail(); openAddShiftOnDate('${dateStr}')">+ Add shift on this day</button>
      </div>`;
  }

  sheet.style.display = 'block';
  setTimeout(() => sheet.classList.add('open'), 10);
}

function closeDayDetail() {
  const sheet = document.getElementById('dayDetailSheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  setTimeout(() => sheet.style.display = 'none', 250);
}

function openAddShiftOnDate(dateStr) {
  openAddShift();
  setTimeout(() => {
    const dateInput = document.getElementById('shiftDate');
    if (dateInput) dateInput.value = dateStr;
  }, 50);
}

// ---- Helpers ----

function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.slice(0,5).split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${hour12}:${String(m).padStart(2,'0')}${period}`;
}
// MT.formatTime12 is the canonical version — this local one is kept for compatibility

function getTimeUntil(timeStr) {
  if (!timeStr) return '';
  const mins = MT.minutesUntil(timeStr);
  if (mins === null || mins <= 0) return '';
  const hrs  = Math.floor(mins / 60);
  const rem  = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem} min`;
}
function _getTimeUntilOLD(timeStr) {
  if (!timeStr) return '';
  const now  = new Date();
  const [h, m] = timeStr.slice(0,5).split(':').map(Number);
  const shiftMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m) - now;
  if (shiftMs <= 0) return '';
  const hrs  = Math.floor(shiftMs / 3600000);
  const mins = Math.floor((shiftMs % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
}
