-- ============================================================
-- Broke No More — Supabase Schema
-- Paste this entire file into: Supabase → SQL Editor → Run
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ---- USERS (extends Supabase auth.users) ----
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text,
  visa_type             text default 'F-1',
  country_of_origin     text default 'Kenya',
  us_state              text default 'Colorado',
  years_in_us           integer default 1,
  monthly_goal          numeric default 2400,
  google_calendar_token jsonb,           -- encrypted OAuth token
  calendar_connected    boolean default false,
  created_at            timestamptz default now()
);
alter table public.users enable row level security;
create policy "Users can only access their own row"
  on public.users for all using (auth.uid() = id);

-- ---- JOBS ----
create table public.jobs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references public.users(id) on delete cascade,
  name             text not null,
  hourly_rate      numeric not null default 0,
  schedule_type    text default 'manual',  -- fixed | rotating | flexible | gig
  calendar_keyword text,
  color            text default '#f0b429',
  is_active        boolean default true,
  created_at       timestamptz default now()
);
alter table public.jobs enable row level security;
create policy "Users own their jobs"
  on public.jobs for all using (auth.uid() = user_id);

-- ---- INCOME EVENTS ----
create table public.income_events (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.users(id) on delete cascade,
  job_id              uuid references public.jobs(id) on delete set null,
  source_type         text not null default 'manual',  -- calendar | fixed_template | manual | gig
  title               text,
  shift_date          date not null,
  start_time          time,
  end_time            time,
  hours               numeric,
  hourly_rate         numeric,
  flat_amount         numeric,           -- for gig/flat-rate income
  gross_pay           numeric not null default 0,
  status              text default 'scheduled',  -- scheduled | completed | cancelled | no_show
  tax_treatment       text default 'taxable',    -- taxable | informal | excluded
  notes               text,
  calendar_event_id   text,             -- Google Calendar event ID (prevents duplicate sync)
  created_at          timestamptz default now()
);
alter table public.income_events enable row level security;
create policy "Users own their income events"
  on public.income_events for all using (auth.uid() = user_id);

-- Index for fast monthly queries
create index idx_income_events_user_date on public.income_events(user_id, shift_date);

-- ---- BUDGET CATEGORIES ----
create table public.budget_categories (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references public.users(id) on delete cascade,
  name             text not null,
  allocated_amount numeric default 0,
  color            text default '#5c9e6e',
  icon             text default 'ti-wallet',
  sort_order       integer default 0,
  created_at       timestamptz default now()
);
alter table public.budget_categories enable row level security;
create policy "Users own their budget categories"
  on public.budget_categories for all using (auth.uid() = user_id);

-- ---- EXPENSES ----
create table public.expenses (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.users(id) on delete cascade,
  category_id     uuid references public.budget_categories(id) on delete set null,
  amount          numeric not null,
  description     text,
  expense_date    date not null,
  receipt_url     text,
  created_at      timestamptz default now()
);
alter table public.expenses enable row level security;
create policy "Users own their expenses"
  on public.expenses for all using (auth.uid() = user_id);

create index idx_expenses_user_date on public.expenses(user_id, expense_date);

-- ---- GOALS ----
create table public.goals (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references public.users(id) on delete cascade,
  name             text not null,
  target_amount    numeric not null,
  current_amount   numeric default 0,
  deadline         date,
  status           text default 'active',  -- active | achieved | paused | archived
  created_at       timestamptz default now()
);
alter table public.goals enable row level security;
create policy "Users own their goals"
  on public.goals for all using (auth.uid() = user_id);

-- ---- TAX SETTINGS ----
create table public.tax_settings (
  user_id               uuid primary key references public.users(id) on delete cascade,
  federal_filing_status text default 'single',
  fica_exempt           boolean default true,
  has_tax_treaty        boolean default false,
  treaty_amount         numeric default 0,
  state_tax_rate        numeric default 0.044,  -- Colorado 4.4%
  nra_phantom_add       numeric default 15000,  -- IRS Pub 15-T NRA rule
  ytd_gross             numeric default 0,      -- updated from paystub
  ytd_withheld          numeric default 0,      -- updated from paystub
  updated_at            timestamptz default now()
);
alter table public.tax_settings enable row level security;
create policy "Users own their tax settings"
  on public.tax_settings for all using (auth.uid() = user_id);

-- ---- AUTO-CREATE USER PROFILE ON SIGNUP ----
-- This function runs when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name)
    values (new.id, split_part(new.email, '@', 1));

  insert into public.tax_settings (user_id)
    values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---- SEED RUTH'S JOBS (run manually after she signs up) ----
-- After Ruth creates her account, find her user ID in auth.users
-- then run this with her real UUID:
--
-- insert into public.jobs (user_id, name, hourly_rate, schedule_type, color)
-- values
--   ('RUTH_USER_ID', 'Sodexo',  21.50, 'fixed',    '#f0b429'),
--   ('RUTH_USER_ID', 'Korbel',  19.00, 'rotating', '#5c9ee0');
