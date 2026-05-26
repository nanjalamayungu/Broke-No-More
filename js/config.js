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
  SUPABASE_URL:      "https://dsqcqsgckgbxkaijqvbl.supabase.co",       // e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcWNxc2dja2dieGthaWpxdmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTU0MzMsImV4cCI6MjA5NTMzMTQzM30.PEJq4YJXylAXtHU_kLKVUb6FAPz11wkeLz6-2NsVW_w",          // public anon key, safe in frontend

  // Google OAuth — Client ID only (secret stays in Supabase Edge Function)
  GOOGLE_CLIENT_ID:  "8390186809-g767ji4v31mp1l6ro256qcrra3hi37co.apps.googleusercontent.com",     // ends in .apps.googleusercontent.com

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
