// ============================================================
// config.js — Broke No More
// ============================================================
// THIS IS THE ONLY FILE YOU NEED TO EDIT WHEN YOU HAVE KEYS
// Replace placeholder values with real ones from:
//   - Supabase: Project Settings → API
//   - Google: Cloud Console → Credentials
// ============================================================

const APP_CONFIG = {
  // Supabase
  SUPABASE_URL:      "YOUR_SUPABASE_PROJECT_URL",       // e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",          // public anon key, safe in frontend

  // Google OAuth — Client ID only (secret stays in Supabase Edge Function)
  GOOGLE_CLIENT_ID:  "YOUR_GOOGLE_OAUTH_CLIENT_ID",     // ends in .apps.googleusercontent.com

  // App
  APP_NAME:          "Broke No More",
  TAX_YEAR:          2025,

  // Tax defaults (Colorado, F-1 Kenyan national)
  DEFAULTS: {
    STATE_TAX_RATE:       0.044,   // Colorado 4.4%
    FICA_EXEMPT:          true,    // F-1 under 5 years
    HAS_TAX_TREATY:       false,   // No Kenya-US treaty
    TREATY_AMOUNT:        0,
    NRA_PHANTOM_ANNUAL:   15000,   // IRS NRA withholding add (Pub 15-T 2025)
    FEDERAL_BRACKETS: [            // NRA brackets — no standard deduction
      { upTo: 11925,  rate: 0.10 },
      { upTo: 48475,  rate: 0.12 },
      { upTo: 103350, rate: 0.22 },
    ],
  },
};
