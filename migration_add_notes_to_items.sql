-- Migration to add notes column to order_items
alter table public.order_items 
add column if not exists notes text;
