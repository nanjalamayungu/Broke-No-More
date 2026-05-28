// ============================================================
// timezone.js — Mountain Time utility
// ============================================================
// Broke No More is a Colorado app. All dates and times are
// ALWAYS expressed in Mountain Time (America/Denver) regardless
// of where the device is located — Kenya, Colorado, anywhere.
//
// Mountain Standard Time: UTC-7 (Nov → Mar)
// Mountain Daylight Time: UTC-6 (Mar → Nov)
// DST is handled automatically by Intl.DateTimeFormat.
// No manual updates ever needed when clocks change.
// ============================================================

const MT = {

  TZ: 'America/Denver',

  // Convert any JS Date to Mountain Time components
  fromDate(date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: this.TZ,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
    });

    const parts = {};
    fmt.formatToParts(date).forEach(p => {
      if (p.type !== 'literal') parts[p.type] = p.value;
    });

    const year   = parseInt(parts.year);
    const month  = parseInt(parts.month);
    const day    = parseInt(parts.day);
    const hour   = parseInt(parts.hour === '24' ? '0' : parts.hour);
    const minute = parseInt(parts.minute);

    return {
      year, month, day, hour, minute,
      dateStr: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      timeStr: `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
    };
  },

  // Parse a Google Calendar ISO string to Mountain Time
  // Google always includes the UTC offset e.g. "2026-05-30T22:30:00-06:00"
  // JS Date() parses the offset correctly, then we convert to MT display
  fromCalendarString(isoString) {
    if (!isoString) return null;
    return this.fromDate(new Date(isoString));
  },

  // Current moment in Mountain Time
  now() {
    return this.fromDate(new Date());
  },

  // Today's date string in Mountain Time — "YYYY-MM-DD"
  todayStr() {
    return this.now().dateStr;
  },

  // Tomorrow's date string in Mountain Time — "YYYY-MM-DD"
  tomorrowStr() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.fromDate(tomorrow).dateStr;
  },

  // Today's date in YYYY-MM-DD for use as HTML date input default value
  todayInputVal() {
    return this.todayStr();
  },

  // Format "HH:MM" → "10:30am"
  formatTime12(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
    const period = h >= 12 ? 'pm' : 'am';
    const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${hour12}:${String(m).padStart(2, '0')}${period}`;
  },

  // Current offset label: "MDT" or "MST"
  offsetLabel() {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: this.TZ,
      timeZoneName: 'short',
    }).format(new Date());
    const match = formatted.match(/\b(M[DS]T)\b/);
    return match ? match[1] : 'MT';
  },

  // How many minutes until a given "HH:MM" time today in MT
  minutesUntil(timeStr) {
    if (!timeStr) return null;
    const mtNow = this.now();
    const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
    const diffMins = (h * 60 + m) - (mtNow.hour * 60 + mtNow.minute);
    return diffMins;
  },
};
