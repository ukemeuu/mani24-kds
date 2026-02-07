-- Migration for Glovo Integration

-- 1. Add notes column to order_items for customizations
alter table public.order_items 
add column if not exists notes text;

-- 2. Ensure prep_started_at exists (from previous work)
alter table public.orders 
add column if not exists prep_started_at bigint;

-- 3. Ensure metadata column exists (it should, but just in case)
alter table public.orders 
add column if not exists metadata jsonb default '{}'::jsonb;
