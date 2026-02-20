-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This creates the user_data table and sets up Row Level Security (RLS)

-- 1. Create the user_data table
create table if not exists user_data (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table user_data enable row level security;

-- 3. Create RLS policies so users can only access their own data
create policy "Users can read their own data"
  on user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on user_data for update
  using (auth.uid() = user_id);
