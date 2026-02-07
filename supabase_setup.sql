-- Enable Realtime
drop publication if exists supabase_realtime;
create publication supabase_realtime for all tables;

-- Create Orders Table
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  order_number text not null,
  customer_name text not null,
  type text not null, -- 'Dine-in', 'Takeout', 'Delivery'
  status text not null, -- 'NEW', 'PREPARING', 'READY', 'SERVED'
  created_at bigint not null,
  dispatched_at bigint,
  prep_started_at bigint,
  metadata jsonb
);

-- Create Order Items Table
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  name text not null,
  quantity int not null,
  category text, -- 'Main', 'Side', 'Drink'
  estimated_prep_time int
);

-- Create Staff Logs (Optional)
create table if not exists public.staff_logs (
  id uuid default gen_random_uuid() primary key,
  staff_name text not null,
  role text not null,
  action text not null, -- 'LOGIN', 'LOGOUT'
  timestamp timestamptz default now()
);

-- Enable Row Level Security (RLS) - Optional for now (Public Access)
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Policies (Allow all for this simple KDS)
create policy "Enable all access for all users" on public.orders for all using (true) with check (true);
create policy "Enable all access for all users" on public.order_items for all using (true) with check (true);
