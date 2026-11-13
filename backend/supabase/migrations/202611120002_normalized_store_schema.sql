begin;

create extension if not exists pg_trgm with schema extensions;

alter table public.profiles
  add column if not exists full_name text not null default '',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_email_idx on public.customers (lower(email)) where email is not null;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  full_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (customer_id) where is_default;
create index if not exists customer_addresses_customer_idx on public.customer_addresses (customer_id);

alter table public.categories
  add column if not exists description text not null default '',
  add column if not exists image_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists display_order integer not null default 0;

update public.categories
set image_url = image,
    is_active = visible,
    display_order = sort_order;

alter table public.products
  add column if not exists main_image text not null default '',
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_active boolean not null default true;

update public.products
set main_image = coalesce(images[1], ''),
    is_featured = featured,
    is_active = active;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  colour text not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sku text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, colour)
);

create index if not exists product_variants_lookup_idx
  on public.product_variants (product_id, size, colour) where is_active;
create index if not exists product_variants_stock_idx on public.product_variants (product_id, stock_quantity);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id, display_order);

insert into public.product_images (product_id, image_url, storage_path, display_order)
select p.id, image_url,
  case when image_url ~ '^https?://[^/]+/storage/v1/object/public/[^/]+/.+'
    then regexp_replace(image_url, '^https?://[^/]+/storage/v1/object/public/[^/]+/', '')
    else null end,
  ordinality - 1
from public.products p
cross join lateral unnest(p.images) with ordinality as image(image_url, ordinality)
where image_url <> ''
  and not exists (
    select 1 from public.product_images pi
    where pi.product_id = p.id and pi.image_url = image_url
  );

with variants as (
  select p.id, p.stock, p.sku, options.size, options.colour,
    row_number() over (partition by p.id order by options.size, options.colour) as variant_no,
    count(*) over (partition by p.id) as variant_count
  from public.products p
  cross join lateral (
    select distinct sizes.size, colours.colour
    from unnest(p.sizes) as sizes(size)
    cross join unnest(p.colors) as colours(colour)
  ) as options
  where cardinality(p.sizes) > 0 and cardinality(p.colors) > 0
)
insert into public.product_variants (product_id, size, colour, stock_quantity, sku)
select id, size, colour,
  floor(stock::numeric / variant_count)::integer
    + case when variant_no <= stock % variant_count then 1 else 0 end,
  left(sku, 60) || '-' || substr(md5(id::text || ':' || size || ':' || colour), 1, 12)
from variants
on conflict (product_id, size, colour) do nothing;

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists customer_notes text,
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column if not exists total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  add column if not exists order_status text not null default 'pending_confirmation'
    check (order_status in ('pending_confirmation', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  add column if not exists payment_status_code text not null default 'pending'
    check (payment_status_code in ('pending', 'payment_reported', 'verified', 'failed', 'refunded'));

alter table public.orders
  alter column phone drop not null,
  alter column address drop not null,
  alter column city drop not null,
  alter column state drop not null,
  alter column pincode drop not null;

alter table public.order_items
  alter column product_id drop not null,
  add column if not exists product_name_snapshot text not null default '',
  add column if not exists product_image_snapshot text not null default '',
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists colour text not null default '',
  add column if not exists discount_price numeric(12,2),
  add column if not exists total_price numeric(12,2) not null default 0 check (total_price >= 0);

alter table public.order_items drop constraint if exists order_items_product_id_fkey;
alter table public.order_items add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;
alter table public.order_items drop constraint if exists order_items_order_id_fkey;
alter table public.order_items add constraint order_items_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;
alter table public.order_history drop constraint if exists order_history_order_id_fkey;
alter table public.order_history add constraint order_history_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;

update public.orders
set customer_email = email,
    customer_phone = phone,
    customer_notes = notes,
    shipping_address = jsonb_build_object(
      'name', customer_name, 'phone', phone, 'email', email, 'addressLine1', address,
      'city', city, 'state', state, 'pincode', pincode
    ),
    total_amount = total,
    order_status = case status
      when 'Pending Confirmation' then 'pending_confirmation'
      when 'Confirmed' then 'confirmed'
      when 'Processing' then 'processing'
      when 'Packed' then 'packed'
      when 'Shipped' then 'shipped'
      when 'Out for Delivery' then 'out_for_delivery'
      when 'Delivered' then 'delivered'
      when 'Cancelled' then 'cancelled'
    end,
    payment_status_code = case payment_status
      when 'Payment Reported' then 'payment_reported'
      else lower(payment_status::text)
    end;

update public.profiles p
set full_name = coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), ''),
    email = u.email,
    phone = u.phone
from auth.users u
where u.id = p.id;

update public.order_items oi
set product_name_snapshot = oi.product_name,
    product_image_snapshot = oi.image_url,
    colour = oi.color,
    discount_price = null,
    total_price = oi.unit_price * oi.quantity;

create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_customer_phone_idx on public.orders (customer_phone, created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status, created_at desc);
create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists products_active_featured_idx on public.products (is_active, is_featured desc, created_at desc);
create index if not exists products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_description_trgm_idx on public.products using gin (description extensions.gin_trgm_ops);
create index if not exists products_search_idx on public.products using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(material, ''))
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_method public.payment_method not null,
  transaction_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'payment_reported', 'verified', 'failed', 'refunded')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists payment_records_order_idx on public.payment_records (order_id, created_at desc);
create index if not exists payment_records_status_idx on public.payment_records (payment_status, created_at desc);

create or replace function public.validate_payment_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status = 'verified' then
    if new.verified_by is null or not exists (
      select 1 from public.profiles p where p.id = new.verified_by and p.role = 'admin'
    ) then
      raise exception using errcode = 'P0001', message = 'A trusted administrator is required to verify payment.';
    end if;
    new.verified_at := coalesce(new.verified_at, now());
  end if;
  return new;
end;
$$;

create trigger payment_records_validate_verification before insert or update on public.payment_records
  for each row execute function public.validate_payment_record();

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index if not exists wishlists_customer_idx on public.wishlists (customer_id, created_at desc);
create index if not exists wishlists_product_idx on public.wishlists (product_id);

alter table public.store_settings
  add column if not exists settings_id uuid not null default gen_random_uuid(),
  add column if not exists store_address text not null default '',
  add column if not exists currency text not null default 'INR' check (currency = 'INR');

alter table public.store_settings alter column id set default 'main';
create unique index if not exists store_settings_uuid_idx on public.store_settings (settings_id);
alter table public.store_settings drop constraint if exists store_settings_pkey;
alter table public.store_settings add constraint store_settings_pkey primary key (settings_id);
create unique index if not exists store_settings_legacy_key_idx on public.store_settings (id);
update public.store_settings set store_address = address;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.order_status_history drop constraint if exists order_status_history_order_id_fkey;
alter table public.order_status_history add constraint order_status_history_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;

create index if not exists order_status_history_order_idx
  on public.order_status_history (order_id, created_at desc);

insert into public.order_status_history (order_id, previous_status, new_status, created_at)
select history.order_id,
  case history.previous_value
    when 'Pending Confirmation' then 'pending_confirmation'
    when 'Confirmed' then 'confirmed'
    when 'Processing' then 'processing'
    when 'Packed' then 'packed'
    when 'Shipped' then 'shipped'
    when 'Out for Delivery' then 'out_for_delivery'
    when 'Delivered' then 'delivered'
    when 'Cancelled' then 'cancelled'
  end,
  case history.new_value
    when 'Pending Confirmation' then 'pending_confirmation'
    when 'Confirmed' then 'confirmed'
    when 'Processing' then 'processing'
    when 'Packed' then 'packed'
    when 'Shipped' then 'shipped'
    when 'Out for Delivery' then 'out_for_delivery'
    when 'Delivered' then 'delivered'
    when 'Cancelled' then 'cancelled'
  end,
  history.created_at
from public.order_history history
where history.event_type = 'status' and history.new_value is not null;

insert into public.order_status_history (order_id, new_status, created_at)
select o.id, o.order_status, o.created_at
from public.orders o
where not exists (
  select 1 from public.order_status_history history where history.order_id = o.id
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_category_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.image := coalesce(new.image, new.image_url);
    new.image_url := coalesce(new.image_url, new.image);
    if new.visible is distinct from true then new.is_active := new.visible;
    elsif new.is_active is distinct from true then new.visible := new.is_active; end if;
    if new.sort_order is distinct from 0 then new.display_order := new.sort_order;
    elsif new.display_order is distinct from 0 then new.sort_order := new.display_order; end if;
  else
    if new.image is distinct from old.image then new.image_url := new.image;
    elsif new.image_url is distinct from old.image_url then new.image := new.image_url; end if;
    if new.visible is distinct from old.visible then new.is_active := new.visible;
    elsif new.is_active is distinct from old.is_active then new.visible := new.is_active; end if;
    if new.sort_order is distinct from old.sort_order then new.display_order := new.sort_order;
    elsif new.display_order is distinct from old.display_order then new.sort_order := new.display_order; end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_product_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.stock is distinct from old.stock
    and current_setting('app.variant_order_sync', true) is distinct from 'on'
    and exists (select 1 from public.product_variants where product_id = old.id) then
    raise exception using errcode = 'P0001', message = 'Manage inventory on product variants when variants are configured.';
  end if;
  if tg_op = 'INSERT' then
    if new.main_image = '' and cardinality(new.images) > 0 then new.main_image := new.images[1]; end if;
    if new.main_image <> '' and cardinality(new.images) = 0 then new.images := array[new.main_image]; end if;
    if new.featured is distinct from false then new.is_featured := new.featured;
    elsif new.is_featured is distinct from false then new.featured := new.is_featured; end if;
    if new.active is distinct from true then new.is_active := new.active;
    elsif new.is_active is distinct from true then new.active := new.is_active; end if;
  else
    if new.main_image is distinct from old.main_image then
      if cardinality(new.images) = 0 then new.images := array[new.main_image];
      else new.images[1] := new.main_image; end if;
    elsif new.images is distinct from old.images then
      new.main_image := coalesce(new.images[1], '');
    end if;
    if new.featured is distinct from old.featured then new.is_featured := new.featured;
    elsif new.is_featured is distinct from old.is_featured then new.featured := new.is_featured; end if;
    if new.active is distinct from old.active then new.is_active := new.active;
    elsif new.is_active is distinct from old.is_active then new.active := new.is_active; end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_product_variant_catalog()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if exists (
    select 1 from public.product_variants
    where product_id = new.id and is_active and stock_quantity > 0
      and (
        cardinality(new.sizes) = 0 or cardinality(new.colors) = 0
        or not (size = any(new.sizes)) or not (colour = any(new.colors))
      )
  ) then
    raise exception using errcode = 'P0001', message = 'Move or sell existing variant stock before removing its size or colour.';
  end if;
  select count(*) into v_count from public.product_variants where product_id = new.id;
  if cardinality(new.sizes) > 0 and cardinality(new.colors) > 0 then
    with options as (
      select distinct sizes.size, colours.colour
      from unnest(new.sizes) as sizes(size)
      cross join unnest(new.colors) as colours(colour)
    ), ranked as (
      select size, colour, row_number() over (order by size, colour) as variant_no,
        count(*) over () as variant_count
      from options
    )
    insert into public.product_variants (product_id, size, colour, stock_quantity, sku)
    select new.id, ranked.size, ranked.colour,
      case when v_count = 0 then
        floor(new.stock::numeric / ranked.variant_count)::integer
        + case when ranked.variant_no <= new.stock % ranked.variant_count then 1 else 0 end
      else 0 end,
      left(new.sku, 60) || '-' || substr(md5(new.id::text || ':' || ranked.size || ':' || ranked.colour), 1, 12)
    from ranked
    on conflict (product_id, size, colour) do update set is_active = true;
  end if;
  update public.product_variants
    set is_active = false
    where product_id = new.id and (
      cardinality(new.sizes) = 0 or cardinality(new.colors) = 0
      or not (size = any(new.sizes)) or not (colour = any(new.colors))
    );
  return new;
end;
$$;

create or replace function public.sync_product_variant_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_previous text := current_setting('app.variant_order_sync', true);
begin
  perform set_config('app.variant_order_sync', 'on', true);
  update public.products
    set stock = coalesce((select sum(stock_quantity)::integer from public.product_variants
      where product_id = v_product_id and is_active), 0)
    where id = v_product_id;
  perform set_config('app.variant_order_sync', coalesce(v_previous, 'off'), true);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.sync_product_image_records()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.product_images (product_id, image_url, storage_path, display_order)
  select new.id, image_url,
    case when image_url ~ '^https?://[^/]+/storage/v1/object/public/[^/]+/.+'
      then regexp_replace(image_url, '^https?://[^/]+/storage/v1/object/public/[^/]+/', '')
      else null end,
    ordinality - 1
  from unnest(new.images) with ordinality as image(image_url, ordinality)
  where image_url <> ''
  on conflict (product_id, image_url) do update
    set storage_path = excluded.storage_path, display_order = excluded.display_order;
  delete from public.product_images pi
    where pi.product_id = new.id and not (pi.image_url = any(new.images));
  return new;
end;
$$;

create unique index if not exists product_images_product_url_idx
  on public.product_images (product_id, image_url);

create or replace function public.sync_order_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.phone := coalesce(new.phone, new.customer_phone, new.shipping_address->>'phone');
    new.customer_phone := coalesce(new.customer_phone, new.phone);
    new.email := coalesce(new.email, new.customer_email, nullif(new.shipping_address->>'email', ''));
    new.customer_email := coalesce(new.customer_email, new.email);
    new.customer_notes := coalesce(new.customer_notes, new.notes);
    new.notes := coalesce(new.notes, new.customer_notes);
    new.customer_name := coalesce(new.customer_name, new.shipping_address->>'name');
    new.address := coalesce(new.address, new.shipping_address->>'addressLine1');
    new.city := coalesce(new.city, new.shipping_address->>'city');
    new.state := coalesce(new.state, new.shipping_address->>'state');
    new.pincode := coalesce(new.pincode, new.shipping_address->>'pincode');
    if new.shipping_address = '{}'::jsonb then
      new.shipping_address := jsonb_build_object(
        'name', new.customer_name, 'phone', new.phone, 'email', new.email,
        'addressLine1', new.address, 'city', new.city, 'state', new.state, 'pincode', new.pincode
      );
    end if;
    if new.total_amount <> 0 and new.total = 0 then new.total := new.total_amount;
    else new.total_amount := new.total; end if;
    if new.order_status <> 'pending_confirmation' then
      new.status := case new.order_status
        when 'pending_confirmation' then 'Pending Confirmation'
        when 'confirmed' then 'Confirmed'
        when 'processing' then 'Processing'
        when 'packed' then 'Packed'
        when 'shipped' then 'Shipped'
        when 'out_for_delivery' then 'Out for Delivery'
        when 'delivered' then 'Delivered'
        when 'cancelled' then 'Cancelled'
      end::public.order_status;
    else
      new.order_status := case new.status
        when 'Pending Confirmation' then 'pending_confirmation'
        when 'Confirmed' then 'confirmed'
        when 'Processing' then 'processing'
        when 'Packed' then 'packed'
        when 'Shipped' then 'shipped'
        when 'Out for Delivery' then 'out_for_delivery'
        when 'Delivered' then 'delivered'
        when 'Cancelled' then 'cancelled'
      end;
    end if;
    if new.payment_status_code <> 'pending' then
      new.payment_status := case new.payment_status_code
        when 'pending' then 'Pending'
        when 'payment_reported' then 'Payment Reported'
        when 'verified' then 'Verified'
        when 'failed' then 'Failed'
        when 'refunded' then 'Refunded'
      end::public.payment_status;
    else
      new.payment_status_code := case new.payment_status
        when 'Payment Reported' then 'payment_reported'
        else lower(new.payment_status::text)
      end;
    end if;
  else
    if new.phone is distinct from old.phone then new.customer_phone := new.phone;
    elsif new.customer_phone is distinct from old.customer_phone then new.phone := new.customer_phone; end if;
    if new.email is distinct from old.email then new.customer_email := new.email;
    elsif new.customer_email is distinct from old.customer_email then new.email := new.customer_email; end if;
    if new.notes is distinct from old.notes then new.customer_notes := new.notes;
    elsif new.customer_notes is distinct from old.customer_notes then new.notes := new.customer_notes; end if;
    if new.status is distinct from old.status then
      new.order_status := case new.status
        when 'Pending Confirmation' then 'pending_confirmation'
        when 'Confirmed' then 'confirmed'
        when 'Processing' then 'processing'
        when 'Packed' then 'packed'
        when 'Shipped' then 'shipped'
        when 'Out for Delivery' then 'out_for_delivery'
        when 'Delivered' then 'delivered'
        when 'Cancelled' then 'cancelled'
      end;
    elsif new.order_status is distinct from old.order_status then
      new.status := case new.order_status
        when 'pending_confirmation' then 'Pending Confirmation'
        when 'confirmed' then 'Confirmed'
        when 'processing' then 'Processing'
        when 'packed' then 'Packed'
        when 'shipped' then 'Shipped'
        when 'out_for_delivery' then 'Out for Delivery'
        when 'delivered' then 'Delivered'
        when 'cancelled' then 'Cancelled'
      end::public.order_status;
    end if;
    if new.payment_status is distinct from old.payment_status then
      new.payment_status_code := case new.payment_status
        when 'Payment Reported' then 'payment_reported'
        else lower(new.payment_status::text)
      end;
    elsif new.payment_status_code is distinct from old.payment_status_code then
      new.payment_status := case new.payment_status_code
        when 'pending' then 'Pending'
        when 'payment_reported' then 'Payment Reported'
        when 'verified' then 'Verified'
        when 'failed' then 'Failed'
        when 'refunded' then 'Refunded'
      end::public.payment_status;
    end if;
    if new.total is distinct from old.total then new.total_amount := new.total;
    elsif new.total_amount is distinct from old.total_amount then new.total := new.total_amount; end if;
    if new.shipping_address is distinct from old.shipping_address then
      new.customer_name := coalesce(new.shipping_address->>'name', new.customer_name);
      new.phone := coalesce(new.shipping_address->>'phone', new.phone);
      new.email := nullif(new.shipping_address->>'email', '');
      new.address := coalesce(new.shipping_address->>'addressLine1', new.address);
      new.city := coalesce(new.shipping_address->>'city', new.city);
      new.state := coalesce(new.shipping_address->>'state', new.state);
      new.pincode := coalesce(new.shipping_address->>'pincode', new.pincode);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_order_item_snapshots()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.product_name_snapshot := coalesce(nullif(new.product_name_snapshot, ''), new.product_name);
    new.product_name := coalesce(nullif(new.product_name, ''), new.product_name_snapshot);
    new.product_image_snapshot := coalesce(nullif(new.product_image_snapshot, ''), new.image_url);
    new.image_url := coalesce(nullif(new.image_url, ''), new.product_image_snapshot);
    new.colour := coalesce(nullif(new.colour, ''), new.color);
    new.color := coalesce(nullif(new.color, ''), new.colour);
    new.discount_price := coalesce(new.discount_price, new.unit_price);
    new.total_price := new.unit_price * new.quantity;
  else
    if new.product_name is distinct from old.product_name then new.product_name_snapshot := new.product_name;
    elsif new.product_name_snapshot is distinct from old.product_name_snapshot then new.product_name := new.product_name_snapshot; end if;
    if new.image_url is distinct from old.image_url then new.product_image_snapshot := new.image_url;
    elsif new.product_image_snapshot is distinct from old.product_image_snapshot then new.image_url := new.product_image_snapshot; end if;
    if new.color is distinct from old.color then new.colour := new.color;
    elsif new.colour is distinct from old.colour then new.color := new.colour; end if;
    new.total_price := new.unit_price * new.quantity;
  end if;
  return new;
end;
$$;

create or replace function public.sync_store_settings_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.store_address = '' then new.store_address := new.address; end if;
    if new.address = '' then new.address := new.store_address; end if;
  elsif new.address is distinct from old.address then new.store_address := new.address;
  elsif new.store_address is distinct from old.store_address then new.address := new.store_address;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_sync_compatibility on public.categories;
create trigger categories_sync_compatibility before insert or update on public.categories
  for each row execute function public.sync_category_compatibility();
drop trigger if exists products_sync_compatibility on public.products;
create trigger products_sync_compatibility before insert or update on public.products
  for each row execute function public.sync_product_compatibility();
drop trigger if exists products_sync_variant_catalog_insert on public.products;
create trigger products_sync_variant_catalog_insert after insert on public.products
  for each row execute function public.sync_product_variant_catalog();
drop trigger if exists products_sync_variant_catalog_update on public.products;
create trigger products_sync_variant_catalog_update after update of sizes, colors, sku on public.products
  for each row execute function public.sync_product_variant_catalog();
drop trigger if exists product_variants_sync_product_stock on public.product_variants;
create trigger product_variants_sync_product_stock_insert after insert on public.product_variants
  for each row execute function public.sync_product_variant_stock();
drop trigger if exists product_variants_sync_product_stock_update on public.product_variants;
create trigger product_variants_sync_product_stock_update after update of stock_quantity, is_active on public.product_variants
  for each row execute function public.sync_product_variant_stock();
drop trigger if exists product_variants_sync_product_stock_delete on public.product_variants;
create trigger product_variants_sync_product_stock_delete after delete on public.product_variants
  for each row execute function public.sync_product_variant_stock();
drop trigger if exists products_sync_image_records_insert on public.products;
create trigger products_sync_image_records_insert after insert on public.products
  for each row execute function public.sync_product_image_records();
drop trigger if exists products_sync_image_records_update on public.products;
create trigger products_sync_image_records_update after update of images on public.products
  for each row execute function public.sync_product_image_records();
drop trigger if exists orders_sync_compatibility on public.orders;
create trigger orders_sync_compatibility before insert or update on public.orders
  for each row execute function public.sync_order_compatibility();
drop trigger if exists order_items_sync_snapshots on public.order_items;
create trigger order_items_sync_snapshots before insert or update on public.order_items
  for each row execute function public.sync_order_item_snapshots();
drop trigger if exists store_settings_sync_compatibility on public.store_settings;
create trigger store_settings_sync_compatibility before insert or update on public.store_settings
  for each row execute function public.sync_store_settings_compatibility();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at before update on public.customers
  for each row execute function public.touch_updated_at();
drop trigger if exists product_variants_touch_updated_at on public.product_variants;
create trigger product_variants_touch_updated_at before update on public.product_variants
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), '');
begin
  insert into public.profiles (id, role, full_name, email, phone)
    values (new.id, 'customer', v_name, new.email, new.phone)
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, phone = excluded.phone;
  insert into public.customers (auth_user_id, full_name, email, phone)
    values (new.id, v_name, coalesce(new.email, ''), coalesce(new.phone, ''))
  on conflict (auth_user_id) do update set
    full_name = excluded.full_name, email = excluded.email, phone = excluded.phone;
  return new;
end;
$$;

insert into public.customers (auth_user_id, full_name, email, phone)
select u.id,
  coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), ''),
  coalesce(u.email, ''), coalesce(u.phone, '')
from auth.users u
left join public.profiles p on p.id = u.id
on conflict (auth_user_id) do nothing;

update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null and o.customer_user_id = c.auth_user_id;

insert into public.customers (full_name, email, phone)
select distinct on (o.phone, coalesce(o.email, ''))
  o.customer_name, coalesce(o.email, ''), o.phone
from public.orders o
where o.customer_user_id is null and o.customer_id is null
order by o.phone, coalesce(o.email, ''), o.created_at;

update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null and o.customer_user_id is null
  and c.auth_user_id is null and c.phone = o.phone
  and coalesce(c.email, '') = coalesce(o.email, '')
  and c.full_name = o.customer_name;

create or replace function public.record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_status_history (order_id, previous_status, new_status, changed_by)
    values (new.id, old.order_status, new.order_status,
      coalesce(nullif(current_setting('app.current_admin_id', true), '')::uuid, auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_record_status_history on public.orders;
create trigger orders_record_status_history after update on public.orders
  for each row execute function public.record_order_status_history();

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

create or replace function public.create_store_order(p_customer jsonb, p_items jsonb, p_payment_method text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_customer_id uuid;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_item jsonb;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_list_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_delivery numeric(12,2);
  v_threshold numeric(12,2);
  v_cod_enabled boolean;
  v_variant_id uuid;
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

  insert into public.customers (full_name, email, phone)
  values (p_customer->>'name', coalesce(p_customer->>'email', ''), p_customer->>'phone')
  returning id into v_customer_id;

  insert into public.orders (
    customer_id, customer_name, phone, email, address, city, state, pincode, notes,
    shipping_address, subtotal, delivery_charge, discount_amount, total, payment_method, payment_status, status
  ) values (
    v_customer_id, p_customer->>'name', p_customer->>'phone', nullif(p_customer->>'email', ''),
    p_customer->>'address', p_customer->>'city', p_customer->>'state', p_customer->>'pincode',
    nullif(p_customer->>'notes', ''),
    jsonb_build_object('name', p_customer->>'name', 'phone', p_customer->>'phone',
      'email', nullif(p_customer->>'email', ''), 'addressLine1', p_customer->>'address',
      'city', p_customer->>'city', 'state', p_customer->>'state', 'pincode', p_customer->>'pincode'),
    0, 0, 0, 0, p_payment_method::public.payment_method, 'Pending', 'Pending Confirmation'
  ) returning * into v_order;
  v_order_id := v_order.id;

  insert into public.order_history (order_id, event_type, new_value)
    values (v_order_id, 'created', v_order.status::text);
  insert into public.order_status_history (order_id, new_status)
    values (v_order_id, 'pending_confirmation');

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

    v_variant_id := null;
    select id into v_variant_id from public.product_variants
      where product_id = v_product.id and size = v_item->>'size'
        and colour = v_item->>'color' and is_active
      limit 1;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id = v_variant_id for update;
      if v_variant.stock_quantity < v_qty then
        raise exception using errcode = 'P0001', message = 'There is not enough stock for ' || v_product.name || '.';
      end if;
      update public.product_variants set stock_quantity = stock_quantity - v_qty where id = v_variant.id;
    elsif exists (select 1 from public.product_variants where product_id = v_product.id and is_active) then
      raise exception using errcode = 'P0001', message = 'The selected size and colour are not available for ' || v_product.name || '.';
    else
      if v_product.stock < v_qty then
        raise exception using errcode = 'P0001', message = 'There is not enough stock for ' || v_product.name || '.';
      end if;
      if cardinality(v_product.sizes) > 0 and not ((v_item->>'size') = any(v_product.sizes)) then
        raise exception using errcode = 'P0001', message = 'The selected size is not available for ' || v_product.name || '.';
      end if;
      if cardinality(v_product.colors) > 0 and not ((v_item->>'color') = any(v_product.colors)) then
        raise exception using errcode = 'P0001', message = 'The selected colour is not available for ' || v_product.name || '.';
      end if;
    end if;

    v_list_price := v_product.price;
    v_unit_price := coalesce(v_product.discount_price, v_product.price);
    v_discount := v_discount + ((v_list_price - v_unit_price) * v_qty);
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    if v_variant_id is null then
      update public.products set stock = stock - v_qty, popularity = popularity + v_qty
        where id = v_product.id;
    else
      update public.products set popularity = popularity + v_qty where id = v_product.id;
    end if;
    insert into public.order_items (
      order_id, product_id, product_name, image_url, unit_price, quantity, size, color,
      variant_id, product_name_snapshot, product_image_snapshot, colour, discount_price, total_price
    ) values (
      v_order_id, v_product.id, v_product.name, coalesce(v_product.images[1], ''),
      v_unit_price, v_qty, v_item->>'size', v_item->>'color', v_variant_id,
      v_product.name, coalesce(v_product.images[1], ''), v_item->>'color',
      case when v_unit_price < v_list_price then v_unit_price else null end, v_unit_price * v_qty
    );
  end loop;

  v_delivery := case when v_subtotal >= v_threshold then 0 else v_delivery end;
  update public.orders
    set subtotal = v_subtotal, delivery_charge = v_delivery, discount_amount = v_discount,
        total = v_subtotal + v_delivery
    where id = v_order_id;
  insert into public.payment_records (order_id, payment_method, amount, payment_status)
    values (v_order_id, p_payment_method::public.payment_method, v_subtotal + v_delivery, 'pending');
  return v_order_id;
end;
$$;

drop function if exists public.set_order_status(text, text);
create or replace function public.set_order_status(p_order_ref text, p_status text, p_changed_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  perform set_config('app.current_admin_id', coalesce(p_changed_by::text, ''), true);
  if p_status not in (
    'Pending Confirmation', 'Confirmed', 'Processing', 'Packed',
    'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'
  ) then
    raise exception using errcode = 'P0001', message = 'Order status is invalid.';
  end if;
  select * into v_order from public.orders
    where order_number = p_order_ref or id::text = p_order_ref for update;
  if not found then raise exception using errcode = 'P0001', message = 'Order not found.'; end if;
  if v_order.status = 'Delivered' and p_status = 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'A delivered order cannot be cancelled.';
  end if;
  if v_order.status = 'Cancelled' and p_status <> 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'A cancelled order cannot be reopened.';
  end if;
  if p_status = 'Cancelled' and v_order.status <> 'Cancelled' then
    for v_item in select product_id, variant_id, quantity from public.order_items where order_id = v_order.id
    loop
      if v_item.variant_id is not null then
        update public.product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_item.variant_id;
        update public.products set popularity = greatest(0, popularity - v_item.quantity)
          where id = v_item.product_id;
      elsif v_item.product_id is not null then
        update public.products set stock = stock + v_item.quantity,
          popularity = greatest(0, popularity - v_item.quantity) where id = v_item.product_id;
      end if;
    end loop;
  end if;
  update public.orders set status = p_status::public.order_status where id = v_order.id;
  return v_order.id;
end;
$$;

drop function if exists public.set_order_payment_status(text, text);
create or replace function public.set_order_payment_status(
  p_order_ref text, p_payment_status text, p_verified_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_code text;
begin
  perform set_config('app.current_admin_id', coalesce(p_verified_by::text, ''), true);
  if p_payment_status not in ('Pending', 'Payment Reported', 'Verified', 'Failed', 'Refunded') then
    raise exception using errcode = 'P0001', message = 'Payment status is invalid.';
  end if;
  select * into v_order from public.orders
    where order_number = p_order_ref or id::text = p_order_ref for update;
  if not found then raise exception using errcode = 'P0001', message = 'Order not found.'; end if;
  if v_order.status = 'Cancelled' and p_payment_status = 'Verified' then
    raise exception using errcode = 'P0001', message = 'A cancelled order cannot be marked as paid.';
  end if;
  v_code := case p_payment_status when 'Payment Reported' then 'payment_reported' else lower(p_payment_status) end;
  if v_code = 'verified' and (
    p_verified_by is null or not exists (
      select 1 from public.profiles p where p.id = p_verified_by and p.role = 'admin'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'A trusted administrator is required to verify payment.';
  end if;
  update public.orders set payment_status = p_payment_status::public.payment_status where id = v_order.id;
  insert into public.payment_records (
    order_id, payment_method, amount, payment_status, verified_by, verified_at
  ) values (
    v_order.id, v_order.payment_method, v_order.total, v_code, p_verified_by,
    case when v_code = 'verified' then now() else null end
  );
  return v_order.id;
end;
$$;

create or replace function public.record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_status_history (order_id, previous_status, new_status, changed_by)
    values (new.id, old.order_status, new.order_status, auth.uid());
  end if;
  return new;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_records enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.store_settings enable row level security;
alter table public.order_status_history enable row level security;

drop policy if exists "Public can read visible categories" on public.categories;
create policy "Public can read active categories" on public.categories
  for select to anon, authenticated using (is_active);
create policy "Admins manage categories" on public.categories
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy "Admins view all profiles" on public.profiles
  for select to authenticated using (public.is_store_admin());

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
  for select to anon, authenticated using (is_active);
create policy "Admins manage products" on public.products
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

create policy "Public can read active variants" on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "Admins manage variants" on public.product_variants
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy "Public can read active product images" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "Admins manage product images" on public.product_images
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

create policy "Customers view own customer record" on public.customers
  for select to authenticated using (auth_user_id = (select auth.uid()) or public.is_store_admin());
create policy "Admins manage customers" on public.customers
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy "Customers manage own addresses" on public.customer_addresses
  for all to authenticated using (
    exists (select 1 from public.customers c where c.id = customer_id and c.auth_user_id = (select auth.uid()))
    or public.is_store_admin()
  ) with check (
    exists (select 1 from public.customers c where c.id = customer_id and c.auth_user_id = (select auth.uid()))
    or public.is_store_admin()
  );

create policy "Customers view own orders" on public.orders
  for select to authenticated using (
    exists (select 1 from public.customers c where c.id = customer_id and c.auth_user_id = (select auth.uid()))
    or public.is_store_admin()
  );
create policy "Admins manage orders" on public.orders
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy "Customers view own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o join public.customers c on c.id = o.customer_id
      where o.id = order_id and c.auth_user_id = (select auth.uid())
    ) or public.is_store_admin()
  );
create policy "Admins manage order items" on public.order_items
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy "Admins manage payment records" on public.payment_records
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy "Customers view own order status history" on public.order_status_history
  for select to authenticated using (
    exists (
      select 1 from public.orders o join public.customers c on c.id = o.customer_id
      where o.id = order_id and c.auth_user_id = (select auth.uid())
    ) or public.is_store_admin()
  );
create policy "Admins manage order status history" on public.order_status_history
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

create policy "Customers manage own normalized wishlist" on public.wishlists
  for all to authenticated using (
    exists (select 1 from public.customers c where c.id = customer_id and c.auth_user_id = (select auth.uid()))
    or public.is_store_admin()
  ) with check (
    exists (select 1 from public.customers c where c.id = customer_id and c.auth_user_id = (select auth.uid()))
    or public.is_store_admin()
  );
create policy "Admins manage normalized wishlists" on public.wishlists
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

create policy "Admins manage store settings" on public.store_settings
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings" on public.store_settings
  for select to anon, authenticated using (id = 'main');

create policy "Admins manage legacy wishlists" on public.wishlist_items
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

revoke all on function public.create_store_order(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_store_order(jsonb, jsonb, text) to service_role;
revoke all on function public.set_order_status(text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status(text, text, uuid) to service_role;
revoke all on function public.set_order_payment_status(text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_payment_status(text, text, uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('category-images', 'category-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('store-assets', 'store-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('promotional-banners', 'promotional-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read store image assets" on storage.objects;
create policy "Public can read public store image buckets" on storage.objects
  for select to anon, authenticated using (
    bucket_id in ('product-images', 'category-images', 'store-assets', 'promotional-banners')
  );
create policy "Admins upload store images" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('product-images', 'category-images', 'store-assets', 'promotional-banners')
    and public.is_store_admin()
  );
create policy "Admins update store images" on storage.objects
  for update to authenticated using (
    bucket_id in ('product-images', 'category-images', 'store-assets', 'promotional-banners')
    and public.is_store_admin()
  ) with check (
    bucket_id in ('product-images', 'category-images', 'store-assets', 'promotional-banners')
    and public.is_store_admin()
  );
create policy "Admins delete store images" on storage.objects
  for delete to authenticated using (
    bucket_id in ('product-images', 'category-images', 'store-assets', 'promotional-banners')
    and public.is_store_admin()
  );

commit;
