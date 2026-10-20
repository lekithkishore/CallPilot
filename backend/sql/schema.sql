-- CallPilot Supabase schema
-- Run in the Supabase SQL Editor for a new project.
create extension if not exists pgcrypto;

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  prospect_name text not null,
  company_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  current_stage integer not null default 1 check (current_stage between 1 and 8),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  outcome text,
  next_step text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.call_stage_results (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  stage_number integer not null check (stage_number between 1 and 8),
  result_code text,
  prospect_words text,
  notes jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (call_id, stage_number)
);

create index if not exists calls_started_at_idx on public.calls (started_at desc);
create index if not exists call_stage_results_call_id_idx on public.call_stage_results (call_id);
