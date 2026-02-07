-- migration_multi_tenancy.sql

-- 1. Create table for Restaurants (Tenants)
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  settings jsonb default '{}'::jsonb
);

-- 2. Create Staff table
create table if not exists public.staff (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  role text not null,
  pin text not null,
  avatar_url text,
  created_at timestamptz default now(),
  unique(tenant_id, pin)
);

-- 3. Create Menu Items table
create table if not exists public.menu_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  category text not null,
  estimated_prep_time int default 15,
  price decimal(10,2),
  created_at timestamptz default now()
);

-- 4. Update Orders to include Tenant ID
alter table public.orders 
add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

create index if not exists idx_orders_tenant on public.orders(tenant_id);

-- 5. Data Migration: Create Default Tenant and Migrate Data
do $$
declare
  v_tenant_id uuid;
begin
  -- Check if 'pot-of-jollof' tenant exists, if not create it
  select id into v_tenant_id from public.tenants where slug = 'pot-of-jollof';
  
  if v_tenant_id is null then
    insert into public.tenants (name, slug, settings)
    values ('Pot of Jollof', 'pot-of-jollof', '{"shift_start": 8, "shift_end": 22}')
    returning id into v_tenant_id;
  end if;

  -- Update existing orders to belong to this tenant
  update public.orders set tenant_id = v_tenant_id where tenant_id is null;

  -- Insert Staff (if not exists)
  insert into public.staff (tenant_id, name, role, pin)
  values 
    (v_tenant_id, 'Enock', 'FRONT_DESK', '1001'),
    (v_tenant_id, 'David', 'FRONT_DESK', '1002'),
    (v_tenant_id, 'Judith', 'FRONT_DESK', '1003'),
    (v_tenant_id, 'Yvonne', 'FRONT_DESK', '1004'),
    (v_tenant_id, 'Paul', 'CHEF', '2001'),
    (v_tenant_id, 'Ken M', 'CHEF', '2002'),
    (v_tenant_id, 'Ken N', 'CHEF', '2003'),
    (v_tenant_id, 'Samuel', 'PACKER', '3001'),
    (v_tenant_id, 'Nicholus', 'PACKER', '3002'),
    (v_tenant_id, 'Benard', 'PACKER', '3003'),
    (v_tenant_id, 'Manager Kemi', 'ADMIN', '9001')
  on conflict (tenant_id, pin) do nothing;

  -- Insert Menu Items (if not exists)
  if not exists (select 1 from public.menu_items where tenant_id = v_tenant_id) then
    insert into public.menu_items (tenant_id, name, category, estimated_prep_time)
    values
      (v_tenant_id, 'Party Jollof Rice', 'Main', 12),
      (v_tenant_id, 'Beef Suya', 'Main', 15),
      (v_tenant_id, 'Chicken Suya', 'Main', 15),
      (v_tenant_id, 'Fried Plantain (Dodo)', 'Side', 5),
      (v_tenant_id, 'Moin Moin', 'Side', 8),
      (v_tenant_id, 'Zobo Drink', 'Drink', 2);
  end if;

end $$;
