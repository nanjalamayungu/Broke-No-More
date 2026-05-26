// ============================================================
// persona.js — "Broke No More" personality & gamified messages
// The app has a voice. It's a friend, not a spreadsheet.
// ============================================================

const Persona = {

  // Greeting based on time of day + financial situation
  greeting(name, situation) {
    const hour = new Date().getHours();
    const firstName = name ? name.split(' ')[0] : 'friend';

    const timeGreet = hour < 12 ? 'Good morning' :
                      hour < 17 ? 'Hey' : 'Evening';

    if (situation === 'crushing_it') {
      return [
        `${timeGreet}, ${firstName}! 🔥 You're absolutely COOKING right now.`,
        `${timeGreet}, ${firstName}! Look at you — seriously, look at you.`,
        `${timeGreet}, ${firstName}! The bag? You're securing it. 💰`,
      ];
    }
    if (situation === 'on_track') {
      return [
        `${timeGreet}, ${firstName}! Steady wins the race. You're on track.`,
        `${timeGreet}, ${firstName}! Not broke yet — let's keep it that way.`,
        `${timeGreet}, ${firstName}! Making moves. We see you. 👀`,
      ];
    }
    if (situation === 'behind') {
      return [
        `${timeGreet}, ${firstName}. Okay, real talk — we need to pick up some shifts.`,
        `${timeGreet}, ${firstName}. Don't panic. But also... let's look at this together.`,
        `${timeGreet}, ${firstName}! Gap in the budget detected. Your friend Broke No More is on it.`,
      ];
    }
    if (situation === 'no_shifts') {
      return [
        `${timeGreet}, ${firstName}! No shifts logged yet this month. Let's fix that.`,
        `${timeGreet}, ${firstName}. Calendar's looking empty. Add a shift and let's get moving.`,
      ];
    }
    return [
      `${timeGreet}, ${firstName}! Ready to make some moves?`,
    ];
  },

  // Pick one message randomly from an array
  pick(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
  },

  // Shift-specific messages
  shift: {
    cancelled(earnings) {
      return [
        `Ouch. That's $${earnings} you won't see. Can you pick up something else?`,
        `Cancelled shift detected. $${earnings} gone. Time to hustle elsewhere?`,
        `RIP that $${earnings}. Let's find a replacement shift.`,
      ];
    },
    added(earnings) {
      return [
        `Added! $${earnings} closer to your goal. That's what I'm talking about.`,
        `New shift locked in. $${earnings} incoming. 💪`,
        `Let's gooo! $${earnings} on the books.`,
      ];
    },
    completed(earnings) {
      return [
        `Shift done! $${earnings} in the bag. Treat yourself to... maybe just one nice thing.`,
        `You showed up. $${earnings} earned. Broke No More is proud.`,
      ];
    },
  },

  // Goal messages
  goal: {
    achieved(name) {
      return [
        `🎉 YOU DID IT! "${name}" — GOAL ACHIEVED! This is not a drill!`,
        `LEVEL UP! "${name}" complete! You actually did the thing!`,
        `${name}? SECURED. You absolute legend.`,
      ];
    },
    almost(name, pct) {
      return [
        `${pct}% there on "${name}". SO close. Don't stop now.`,
        `"${name}" is within reach — ${pct}% done. One more push!`,
      ];
    },
    justStarted(name) {
      return [
        `"${name}" goal created! Every big thing starts somewhere.`,
        `New goal: "${name}". Let's build toward it shift by shift.`,
      ];
    },
  },

  // Tax messages
  tax: {
    refundLikely(amount) {
      return [
        `Estimate: ~$${amount} refund coming in April. The IRS owes YOU.`,
        `Good news — looks like you'll get ~$${amount} back from the IRS. File that 1040-NR!`,
      ];
    },
    withholdingHigh() {
      return [
        `Your withholding looks high — that's normal for F-1 workers. Refund likely.`,
        `They took more than they should. Happens with NRA withholding. You'll get it back.`,
      ];
    },
    ficaReminder() {
      return [
        `Quick check — make sure Sodexo isn't taking Social Security or Medicare. You're exempt!`,
        `F-1 students don't pay FICA. If your paystub shows SS or Medicare deductions, flag it.`,
      ];
    },
  },

  // Budget messages
  budget: {
    overspent(category, amount) {
      return [
        `Heads up — "${category}" is over by $${amount}. Broke No More is watching. 👀`,
        `"${category}" went over budget by $${amount}. We'll adjust.`,
      ];
    },
    underBudget(category, remaining) {
      return [
        `"${category}" has $${remaining} left. Saving game strong.`,
        `$${remaining} still in "${category}". Discipline!`,
      ];
    },
  },

  // Gig income messages
  gig: {
    added(title, amount, treatment) {
      if (treatment === 'taxable') {
        return [`"${title}" added — $${amount} taxable income. Counted and tracked.`];
      }
      if (treatment === 'informal') {
        return [`"${title}" added as informal income — $${amount} tracked but flagged. Keep a record just in case.`];
      }
      return [`"${title}" excluded from taxes — $${amount} in your personal record.`];
    },
  },

  // Milestone badges
  BADGES: [
    { id: 'first_shift',    label: 'First Shift',        icon: '🌱', desc: 'You logged your first shift!' },
    { id: 'goal_1',         label: 'Goal Getter',         icon: '🎯', desc: 'First goal achieved!' },
    { id: 'week_streak',    label: '7-Day Streak',        icon: '🔥', desc: 'Logged income 7 days in a row' },
    { id: 'tax_smart',      label: 'Tax Smart',           icon: '🧠', desc: 'Visited the Tax Field Guide' },
    { id: 'budget_set',     label: 'Budget Boss',         icon: '💼', desc: 'Set up your first budget categories' },
    { id: 'gig_economy',    label: 'Gig Economy',         icon: '💡', desc: 'Logged a gig income event' },
    { id: 'five_shifts',    label: 'On a Roll',           icon: '🎲', desc: 'Logged 5 shifts this month' },
    { id: 'two_jobs',       label: 'Double Threat',       icon: '⚡', desc: 'Working two jobs at once' },
    { id: 'refund_filed',   label: 'Refund Season',       icon: '📬', desc: 'Marked your 1040-NR as filed' },
  ],

  // Situational assessment
  assess(projected, goal, daysLeft, daysTotal) {
    const pct = goal > 0 ? projected / goal : 0;
    const timeLeft = daysLeft / daysTotal;

    if (pct >= 1.1) return 'crushing_it';
    if (pct >= 0.9) return 'on_track';
    if (pct < 0.5 && timeLeft < 0.3) return 'behind';
    if (projected === 0) return 'no_shifts';
    return 'on_track';
  },
};
