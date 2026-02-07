-- Migration to add prep_started_at column
alter table public.orders 
add column if not exists prep_started_at bigint;
