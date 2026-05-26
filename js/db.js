// ============================================================
// db.js — Supabase client + all database operations
// ============================================================

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = supabase.createClient(
      APP_CONFIG.SUPABASE_URL,
      APP_CONFIG.SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

// ---- AUTH ----

const Auth = {
async signIn(email) {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { 
      emailRedirectTo: 'https://nanjalamayungu.github.io/Broke-No-More/'
    }
  });
  return { error };
},

  async getUser() {
    const { data: { user } } = await getSupabase().auth.getUser();
    return user;
  },

  async signOut() {
    await getSupabase().auth.signOut();
    window.location.reload();
  },

onAuthChange(callback) {
  return getSupabase().auth.onAuthStateChange(async (event, session) => {
    // Capture Google provider token immediately after OAuth sign-in
    if (event === 'SIGNED_IN' && session?.provider_token) {
      const { error } = await getSupabase()
        .from('users')
        .upsert({
          id: session.user.id,
          google_calendar_token: {
            access_token:  session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            captured_at:   new Date().toISOString(),
          }
        });
      if (error) console.warn('Failed to store Google token:', error.message);
    }
    callback(event, session);
  });
},

// ---- USER PROFILE ----

const UserDB = {
  async get(userId) {
    const { data, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async upsert(userId, updates) {
    const { data, error } = await getSupabase()
      .from('users')
      .upsert({ id: userId, ...updates })
      .select()
      .single();
    return { data, error };
  },
};

// ---- JOBS ----

const JobsDB = {
  async list(userId) {
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at');
    return { data: data || [], error };
  },

  async create(userId, job) {
    const { data, error } = await getSupabase()
      .from('jobs')
      .insert({ user_id: userId, ...job })
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await getSupabase()
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async remove(id) {
    const { error } = await getSupabase()
      .from('jobs')
      .update({ is_active: false })
      .eq('id', id);
    return { error };
  },
};

// ---- INCOME EVENTS ----

const IncomeDB = {
  async listMonth(userId, year, month) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const { data, error } = await getSupabase()
      .from('income_events')
      .select('*, jobs(name, color, hourly_rate)')
      .eq('user_id', userId)
      .gte('shift_date', start)
      .lte('shift_date', end)
      .order('shift_date');
    return { data: data || [], error };
  },

  async listYear(userId, year) {
    const { data, error } = await getSupabase()
      .from('income_events')
      .select('gross_pay, tax_treatment, status, shift_date')
      .eq('user_id', userId)
      .gte('shift_date', `${year}-01-01`)
      .lte('shift_date', `${year}-12-31`)
      .neq('status', 'cancelled');
    return { data: data || [], error };
  },

  async create(userId, event) {
    const { data, error } = await getSupabase()
      .from('income_events')
      .insert({ user_id: userId, ...event })
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await getSupabase()
      .from('income_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async remove(id) {
    const { error } = await getSupabase()
      .from('income_events')
      .update({ status: 'cancelled' })
      .eq('id', id);
    return { error };
  },
};

// ---- BUDGET ----

const BudgetDB = {
  async listCategories(userId) {
    const { data, error } = await getSupabase()
      .from('budget_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');
    return { data: data || [], error };
  },

  async createCategory(userId, cat) {
    const { data, error } = await getSupabase()
      .from('budget_categories')
      .insert({ user_id: userId, ...cat })
      .select()
      .single();
    return { data, error };
  },

  async updateCategory(id, updates) {
    const { data, error } = await getSupabase()
      .from('budget_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async deleteCategory(id) {
    const { error } = await getSupabase()
      .from('budget_categories')
      .delete()
      .eq('id', id);
    return { error };
  },

  async listExpenses(userId, year, month) {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const { data, error } = await getSupabase()
      .from('expenses')
      .select('*, budget_categories(name, color, icon)')
      .eq('user_id', userId)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date', { ascending: false });
    return { data: data || [], error };
  },

  async createExpense(userId, expense) {
    const { data, error } = await getSupabase()
      .from('expenses')
      .insert({ user_id: userId, ...expense })
      .select()
      .single();
    return { data, error };
  },

  async deleteExpense(id) {
    const { error } = await getSupabase()
      .from('expenses')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// ---- GOALS ----

const GoalsDB = {
  async list(userId) {
    const { data, error } = await getSupabase()
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('deadline');
    return { data: data || [], error };
  },

  async create(userId, goal) {
    const { data, error } = await getSupabase()
      .from('goals')
      .insert({ user_id: userId, ...goal })
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await getSupabase()
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async remove(id) {
    const { error } = await getSupabase()
      .from('goals')
      .update({ status: 'archived' })
      .eq('id', id);
    return { error };
  },
};

// ---- TAX SETTINGS ----

const TaxDB = {
  async get(userId) {
    const { data, error } = await getSupabase()
      .from('tax_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  async upsert(userId, settings) {
    const { data, error } = await getSupabase()
      .from('tax_settings')
      .upsert({ user_id: userId, ...settings })
      .select()
      .single();
    return { data, error };
  },
};
