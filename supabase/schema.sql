-- AI Caddie Starter Supabase schema
-- Run this in the Supabase SQL editor when you are ready to sync rounds.

create extension if not exists pgcrypto;

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Player',
  dominant_miss text not null default 'mixed',
  clubs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null default 'manual',
  latitude double precision,
  longitude double precision,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  number integer not null,
  par integer not null,
  meters integer not null,
  tee_latitude double precision,
  tee_longitude double precision,
  green_latitude double precision,
  green_longitude double precision,
  hazards jsonb not null default '[]'::jsonb,
  unique(course_id, number)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id),
  course_name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.shots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  hole_number integer not null,
  shot_number integer not null,
  club_name text not null,
  lie text not null,
  outcome text not null,
  planned_distance_meters integer,
  measured_distance_meters integer,
  latitude double precision,
  longitude double precision,
  note text,
  created_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.shots enable row level security;

create policy "profiles owner can read" on public.player_profiles for select using (auth.uid() = owner_id);
create policy "profiles owner can write" on public.player_profiles for insert with check (auth.uid() = owner_id);
create policy "profiles owner can update" on public.player_profiles for update using (auth.uid() = owner_id);

create policy "round owner can read" on public.rounds for select using (auth.uid() = owner_id);
create policy "round owner can write" on public.rounds for insert with check (auth.uid() = owner_id);
create policy "round owner can update" on public.rounds for update using (auth.uid() = owner_id);

create policy "shot owner can read" on public.shots for select using (auth.uid() = owner_id);
create policy "shot owner can write" on public.shots for insert with check (auth.uid() = owner_id);
create policy "shot owner can update" on public.shots for update using (auth.uid() = owner_id);

-- Courses and holes can be public read-only in early MVP.
alter table public.courses enable row level security;
alter table public.holes enable row level security;
create policy "courses public read" on public.courses for select using (true);
create policy "holes public read" on public.holes for select using (true);
