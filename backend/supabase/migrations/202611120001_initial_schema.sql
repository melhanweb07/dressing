create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'customer');
create type public.order_status as enum (
  'Pending Confirmation', 'Confirmed', 'Processing', 'Packed',
  'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'
);
create type public.payment_status as enum (
  'Pending', 'Payment Reported', 'Verified', 'Failed', 'Refunded'
);
create type public.payment_method as enum ('gpay', 'cod');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now()
);

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  image text,
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  category_id uuid not null references public.categories(id) on delete restrict,
  price numeric(12,2) not null check (price > 0),
  discount_price numeric(12,2) check (discount_price is null or (discount_price > 0 and discount_price < price)),
  effective_price numeric(12,2) generated always as (coalesce(discount_price, price)) stored,
  sku text not null unique,
  images text[] not null default '{}',
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  material text not null default '',
  stock integer not null default 0 check (stock >= 0),
  popularity integer not null default 0 check (popularity >= 0),
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_public_listing_idx on public.products (active, featured desc, created_at desc);
create index products_effective_price_idx on public.products (effective_price);
create index products_popularity_idx on public.products (popularity desc);
create index products_category_idx on public.products (category_id);
create index products_sizes_gin_idx on public.products using gin (sizes);
create index products_colors_gin_idx on public.products using gin (colors);

create table public.store_settings (
  id text primary key check (id = 'main'),
  shop_name text not null default 'Aavya Studio',
  logo_url text,
  contact_number text not null default '',
  whatsapp_number text not null default '',
  gpay_number text not null default '',
  address text not null default '',
  delivery_charge numeric(12,2) not null default 99 check (delivery_charge >= 0),
  free_delivery_threshold numeric(12,2) not null default 5000 check (free_delivery_threshold >= 0),
  instagram_url text,
  facebook_url text,
  shipping_info text not null default '',
  return_policy text not null default '',
  cod_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values ('main') on conflict (id) do nothing;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'AAV-' || to_char(now(), 'YYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  address text not null,
  city text not null,
  state text not null,
  pincode text not null,
  notes text,
  admin_notes text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_charge numeric(12,2) not null default 0 check (delivery_charge >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  payment_status public.payment_status not null default 'Pending',
  payment_method public.payment_method not null default 'gpay',
  status public.order_status not null default 'Pending Confirmation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_order_idx on public.orders (phone, order_number);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  image_url text not null default '',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  size text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status', 'payment', 'admin_notes')),
  previous_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index order_history_order_idx on public.order_history (order_id, created_at desc);

create table public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at before update on public.products
  for each row execute function public.touch_updated_at();
create trigger categories_touch_updated_at before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger store_settings_touch_updated_at before update on public.store_settings
  for each row execute function public.touch_updated_at();
create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();

create function public.record_order_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_history (order_id, event_type, previous_value, new_value)
      values (new.id, 'status', old.status::text, new.status::text);
  end if;
  if old.payment_status is distinct from new.payment_status then
    insert into public.order_history (order_id, event_type, previous_value, new_value)
      values (new.id, 'payment', old.payment_status::text, new.payment_status::text);
  end if;
  if old.admin_notes is distinct from new.admin_notes then
    insert into public.order_history (order_id, event_type, previous_value, new_value)
      values (new.id, 'admin_notes', null, 'Updated');
  end if;
  return new;
end;
$$;

create trigger orders_record_history after update on public.orders
  for each row execute function public.record_order_history();

create function public.create_store_order(p_customer jsonb, p_items jsonb, p_payment_method text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_delivery numeric(12,2);
  v_threshold numeric(12,2);
  v_cod_enabled boolean;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception using errcode = 'P0001', message = 'Order must include between 1 and 50 items.';
  end if;
  if p_payment_method not in ('gpay', 'cod') then
    raise exception using errcode = 'P0001', message = 'Unsupported payment method.';
  end if;

  select delivery_charge, free_delivery_threshold, cod_enabled
    into v_delivery, v_threshold, v_cod_enabled
    from public.store_settings where id = 'main' for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'Store settings have not been configured.';
  end if;
  if p_payment_method = 'cod' and not v_cod_enabled then
    raise exception using errcode = 'P0001', message = 'Cash on delivery is not available.';
  end if;

  insert into public.orders (
    customer_name, phone, email, address, city, state, pincode, notes,
    subtotal, delivery_charge, total, payment_method, payment_status, status
  ) values (
    p_customer->>'name',
    p_customer->>'phone',
    nullif(p_customer->>'email', ''),
    p_customer->>'address',
    p_customer->>'city',
    p_customer->>'state',
    p_customer->>'pincode',
    nullif(p_customer->>'notes', ''),
    0, 0, 0, p_payment_method::public.payment_method, 'Pending', 'Pending Confirmation'
  ) returning * into v_order;
  v_order_id := v_order.id;
  insert into public.order_history (order_id, event_type, new_value)
    values (v_order_id, 'created', v_order.status::text);

  for v_item in select value from jsonb_array_elements(p_items) as items(value)
  loop
    if coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = 'P0001', message = 'Order quantity is invalid.';
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty > 50 then
      raise exception using errcode = 'P0001', message = 'Order quantity exceeds the maximum allowed.';
    end if;

    select * into v_product
      from public.products
      where id = (v_item->>'productId')::uuid and active = true
      for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'A product in your order is no longer available.';
    end if;
    if v_product.stock < v_qty then
      raise exception using errcode = 'P0001', message = 'There is not enough stock for ' || v_product.name || '.';
    end if;
    if cardinality(v_product.sizes) > 0 and not ((v_item->>'size') = any(v_product.sizes)) then
      raise exception using errcode = 'P0001', message = 'The selected size is not available for ' || v_product.name || '.';
    end if;
    if cardinality(v_product.colors) > 0 and not ((v_item->>'color') = any(v_product.colors)) then
      raise exception using errcode = 'P0001', message = 'The selected colour is not available for ' || v_product.name || '.';
    end if;

    v_unit_price := coalesce(v_product.discount_price, v_product.price);
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    update public.products set stock = stock - v_qty, popularity = popularity + v_qty where id = v_product.id;
    insert into public.order_items (
      order_id, product_id, product_name, image_url, unit_price, quantity, size, color
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      coalesce(v_product.images[1], ''),
      v_unit_price,
      v_qty,
      v_item->>'size',
      v_item->>'color'
    );
  end loop;

  v_delivery := case when v_subtotal >= v_threshold then 0 else v_delivery end;
  update public.orders
    set subtotal = v_subtotal,
        delivery_charge = v_delivery,
        total = v_subtotal + v_delivery
    where id = v_order_id;

  return v_order_id;
end;
$$;

create function public.set_order_status(p_order_ref text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if p_status not in (
    'Pending Confirmation', 'Confirmed', 'Processing', 'Packed',
    'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'
  ) then
    raise exception using errcode = 'P0001', message = 'Order status is invalid.';
  end if;
  select * into v_order
    from public.orders
    where order_number = p_order_ref or id::text = p_order_ref
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Order not found.';
  end if;
  if v_order.status = 'Delivered' and p_status = 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'A delivered order cannot be cancelled.';
  end if;
  if v_order.status = 'Cancelled' and p_status <> 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'A cancelled order cannot be reopened.';
  end if;
  if p_status = 'Cancelled' and v_order.status <> 'Cancelled' then
    for v_item in
      select product_id, quantity from public.order_items where order_id = v_order.id
    loop
      update public.products
        set stock = stock + v_item.quantity,
            popularity = greatest(0, popularity - v_item.quantity)
        where id = v_item.product_id;
    end loop;
  end if;
  update public.orders set status = p_status::public.order_status where id = v_order.id;
  return v_order.id;
end;
$$;

create function public.set_order_payment_status(p_order_ref text, p_payment_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_payment_status not in ('Pending', 'Payment Reported', 'Verified', 'Failed', 'Refunded') then
    raise exception using errcode = 'P0001', message = 'Payment status is invalid.';
  end if;
  select * into v_order
    from public.orders
    where order_number = p_order_ref or id::text = p_order_ref
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Order not found.';
  end if;
  if v_order.status = 'Cancelled' and p_payment_status = 'Verified' then
    raise exception using errcode = 'P0001', message = 'A cancelled order cannot be marked as paid.';
  end if;
  update public.orders set payment_status = p_payment_status::public.payment_status where id = v_order.id;
  return v_order.id;
end;
$$;

create function public.admin_store_overview()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'totalOrders', (select count(*) from public.orders),
    'totalProducts', (select count(*) from public.products),
    'pendingOrders', (select count(*) from public.orders where status = 'Pending Confirmation'),
    'confirmedOrders', (select count(*) from public.orders where status = 'Confirmed'),
    'deliveredOrders', (select count(*) from public.orders where status = 'Delivered'),
    'verifiedSales', coalesce((select sum(total) from public.orders where payment_status = 'Verified'), 0),
    'recentOrders', coalesce((
      select jsonb_agg(to_jsonb(recent)) from (
        select id, order_number, customer_name, phone, total, status, payment_status, created_at
        from public.orders order by created_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_history enable row level security;
alter table public.wishlist_items enable row level security;

create policy "Profiles can view their own role" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Public can read visible categories" on public.categories
  for select to anon, authenticated using (visible = true);
create policy "Public can read active products" on public.products
  for select to anon, authenticated using (active = true);
create policy "Public can read store settings" on public.store_settings
  for select to anon, authenticated using (id = 'main');
create policy "Users can view their own wishlist" on public.wishlist_items
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can add to their own wishlist" on public.wishlist_items
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove from their own wishlist" on public.wishlist_items
  for delete to authenticated using (auth.uid() = user_id);

revoke all on function public.create_store_order(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_store_order(jsonb, jsonb, text) to service_role;
revoke all on function public.set_order_status(text, text) from public, anon, authenticated;
grant execute on function public.set_order_status(text, text) to service_role;
revoke all on function public.set_order_payment_status(text, text) from public, anon, authenticated;
grant execute on function public.set_order_payment_status(text, text) to service_role;
revoke all on function public.admin_store_overview() from public, anon, authenticated;
grant execute on function public.admin_store_overview() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-assets', 'store-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read store image assets" on storage.objects
  for select to anon, authenticated using (bucket_id = 'store-assets');
create policy "Service role manages store image assets" on storage.objects
  for all to service_role using (bucket_id = 'store-assets') with check (bucket_id = 'store-assets');
