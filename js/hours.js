// ============================================================
// hours.js — Weekly & monthly hours tracker
// Plugs into the Shifts tab via renderHoursSection()
// ============================================================

const Hours = {

  // Get current week's Monday and Sunday
  getWeekBounds() {
    const now  = new Date();
    const day  = now.getDay(); // 0=Sun
    const mon  = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0,0,0,0);
    const sun  = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23,59,59,999);
    return { mon, sun };
  },

  // Calculate hours from income_events for a given date range
  calculate(events, jobs, weekStart, weekEnd) {
    const active = events.filter(e => e.status !== 'cancelled');

    // Weekly — events whose shift_date falls within this week
    const weekEvents = active.filter(e => {
      const d = new Date(e.shift_date + 'T12:00:00');
      return d >= weekStart && d <= weekEnd;
    });

    // Monthly — all active events this month
    const monthEvents = active;

    // Build per-job breakdown
    const jobMap = {};
    jobs.forEach(j => {
      jobMap[j.id] = { name: j.name, color: j.color, weekHours: 0, monthHours: 0 };
    });

    weekEvents.forEach(e => {
      if (e.job_id && jobMap[e.job_id] && e.hours) {
        jobMap[e.job_id].weekHours += e.hours;
      }
    });

    monthEvents.forEach(e => {
      if (e.job_id && jobMap[e.job_id] && e.hours) {
        jobMap[e.job_id].monthHours += e.hours;
      }
    });

    const totalWeek  = weekEvents.reduce((s, e) => s + (e.hours || 0), 0);
    const totalMonth = monthEvents.reduce((s, e) => s + (e.hours || 0), 0);
    const gigHours   = monthEvents.filter(e => e.source_type === 'gig').reduce((s, e) => s + (e.hours || 0), 0);

    return {
      totalWeek:  Math.round(totalWeek * 10) / 10,
      totalMonth: Math.round(totalMonth * 10) / 10,
      gigHours:   Math.round(gigHours * 10) / 10,
      byJob: Object.values(jobMap).filter(j => j.weekHours > 0 || j.monthHours > 0),
    };
  },

  // Render the week hours card HTML
  renderCard(events, jobs) {
    const { mon, sun }  = this.getWeekBounds();
    const data          = this.calculate(events, jobs, mon, sun);
    const weekLabel     = `${mon.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${sun.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;

    // OPT warning — F-1 students on OPT can't exceed 40hrs/wk
    const optWarn = data.totalWeek > 35;

    return `
      <div class="week-hours-card">
        <div class="week-hours-title">Hours tracker · week of ${weekLabel}</div>
        <div class="week-hours-grid">
          <div class="week-hours-item">
            <div class="week-hours-num">${data.totalWeek}</div>
            <div class="week-hours-label">this week</div>
          </div>
          <div class="week-hours-divider"></div>
          <div class="week-hours-item">
            <div class="week-hours-num">${data.totalMonth}</div>
            <div class="week-hours-label">this month</div>
          </div>
          ${data.byJob.map(j => `
            <div class="week-hours-divider"></div>
            <div class="week-hours-item">
              <div style="display:flex;align-items:center;justify-content:center;gap:4px">
                <div style="width:6px;height:6px;border-radius:50%;background:${j.color};flex-shrink:0"></div>
                <div class="week-hours-num" style="font-size:16px">${j.weekHours}</div>
              </div>
              <div class="week-hours-label">${j.name} wk</div>
            </div>
          `).join('')}
        </div>
        ${optWarn ? `
          <div style="margin-top:10px;padding:8px 10px;background:rgba(240,192,96,0.15);border:1px solid #f0c060;border-radius:8px;font-size:11px;color:#8a6010;font-weight:600;">
            ⚠️ ${data.totalWeek} hrs this week — stay mindful of your visa work hour limits.
          </div>
        ` : ''}
      </div>`;
  },
};
