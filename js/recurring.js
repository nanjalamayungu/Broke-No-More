// ============================================================
// recurring.js — Recurring shift generation and management
// ============================================================

const Recurring = {

  // Day name mapping
  DAYS: ['SUN','MON','TUE','WED','THU','FRI','SAT'],
  DAY_NAMES: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],

  // Generate all shift dates for a recurring rule
  // rule format: "weekly:MON,WED,FRI:2026-08-01" or "biweekly:TUE,THU:2026-08-01"
  generateDates(startDate, rule) {
    const parts     = rule.split(':');
    const frequency = parts[0]; // weekly | biweekly
    const days      = parts[1].split(','); // ['MON','WED','FRI']
    const endDate   = new Date(parts[2] + 'T12:00:00');
    const dates     = [];

    const current = new Date(startDate + 'T12:00:00');
    const dayNums = days.map(d => this.DAYS.indexOf(d)).filter(n => n >= 0);

    // Move to the start of the week containing startDate
    let cursor = new Date(current);

    while (cursor <= endDate) {
      const dayNum = cursor.getDay();
      if (dayNums.includes(dayNum)) {
        const dateStr = cursor.toISOString().split('T')[0];
        // Don't include the original start date (it's already created as parent)
        if (dateStr > startDate) {
          dates.push(dateStr);
        }
      }
      // Advance by 1 day normally, but for biweekly skip the off week
      cursor.setDate(cursor.getDate() + 1);

      // For biweekly: when we complete one week, skip 7 days
      if (frequency === 'biweekly' && cursor.getDay() === 0 && dates.length > 0) {
        // Check if we just completed a work week
        const lastDate = new Date(dates[dates.length - 1] + 'T12:00:00');
        const daysSinceLast = (cursor - lastDate) / 86400000;
        if (daysSinceLast <= 7) {
          cursor.setDate(cursor.getDate() + 7);
        }
      }
    }

    return dates;
  },

  // Open the recurring setup modal (called from within openAddShift)
  renderRecurringFields() {
    return `
      <div id="recurringSection" style="display:none">
        <div style="height:1px;background:var(--border);margin:12px 0"></div>
        <div class="form-group">
          <label>Repeat frequency</label>
          <select id="recurrenceFreq" class="bnm-select">
            <option value="weekly">Weekly — same days every week</option>
            <option value="biweekly">Biweekly — every other week</option>
          </select>
        </div>
        <div class="form-group">
          <label>Repeat on these days</label>
          <div class="day-picker" id="dayPicker">
            ${['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => `
              <div class="day-chip" data-day="${d}" onclick="toggleDay('${d}')">${d}</div>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>Repeat until</label>
          <input type="date" id="recurrenceEnd" class="bnm-input"
            value="${new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]}" />
        </div>
        <div id="recurringPreview" style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:4px"></div>
      </div>`;
  },

  // Build the recurrence rule string from modal inputs
  buildRule() {
    const freq    = document.getElementById('recurrenceFreq')?.value || 'weekly';
    const endDate = document.getElementById('recurrenceEnd')?.value;
    const days    = [...document.querySelectorAll('.day-chip.selected')].map(d => d.dataset.day);
    if (!days.length || !endDate) return null;
    return `${freq}:${days.join(',')}:${endDate}`;
  },

  // Update the preview text showing how many shifts will be created
  updatePreview(startDate) {
    const rule = this.buildRule();
    const preview = document.getElementById('recurringPreview');
    if (!rule || !preview || !startDate) return;
    const dates = this.generateDates(startDate, rule);
    const parts = rule.split(':');
    preview.textContent = `Will create ${dates.length} additional shifts until ${parts[2]}`;
  },

  // Create all recurring instances in the database
  async createInstances(userId, parentEvent, parentId, rule) {
    const dates = this.generateDates(parentEvent.shift_date, rule);
    if (!dates.length) return { count: 0 };

    const instances = dates.map(date => ({
      job_id:               parentEvent.job_id,
      source_type:          'manual',
      title:                parentEvent.title,
      shift_date:           date,
      start_time:           parentEvent.start_time,
      end_time:             parentEvent.end_time,
      hours:                parentEvent.hours,
      hourly_rate:          parentEvent.hourly_rate,
      flat_amount:          parentEvent.flat_amount,
      gross_pay:            parentEvent.gross_pay,
      status:               'scheduled',
      tax_treatment:        parentEvent.tax_treatment,
      notes:                parentEvent.notes,
      is_recurring:         true,
      recurrence_rule:      rule,
      recurrence_parent_id: parentId,
    }));

    const { data, error } = await IncomeDB.createMany(userId, instances);
    return { count: data?.length || 0, error };
  },
};

// ---- Global helpers called from inline HTML ----

function toggleRecurring() {
  const section = document.getElementById('recurringSection');
  const toggle  = document.getElementById('recurringToggle');
  if (!section) return;
  const show = section.style.display === 'none';
  section.style.display = show ? 'block' : 'none';
  if (toggle) toggle.textContent = show ? 'Remove repeat' : 'Repeat this shift';
}

function toggleDay(day) {
  const chip = document.querySelector(`.day-chip[data-day="${day}"]`);
  if (!chip) return;
  chip.classList.toggle('selected');
  const startDate = document.getElementById('shiftDate')?.value;
  Recurring.updatePreview(startDate);
}
