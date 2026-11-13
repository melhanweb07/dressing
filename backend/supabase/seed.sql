insert into public.categories (name, slug, description, image_url, is_active, display_order)
values
  ('Kurtis', 'kurtis', 'Everyday silhouettes in soft, breathable fabrics.', 'https://placehold.co/800x1000?text=Kurtis', true, 1),
  ('Anarkali', 'anarkali', 'Occasion-ready Anarkali styles.', 'https://placehold.co/800x1000?text=Anarkali', true, 2),
  ('Sarees', 'sarees', 'A considered edit of timeless drapes.', 'https://placehold.co/800x1000?text=Sarees', true, 3)
on conflict (slug) do nothing;

insert into public.products (
  name, slug, description, category_id, price, discount_price, sku, images, main_image,
  sizes, colors, material, stock, featured, active
)
select
  sample.name, sample.slug, sample.description, category.id, sample.price, sample.discount_price,
  sample.sku, array[sample.image], sample.image, array['S', 'M', 'L', 'XL'], array['Rose', 'Ivory'],
  sample.material, sample.stock, sample.featured, true
from (values
  ('Petal Everyday Kurti', 'petal-everyday-kurti', 'A relaxed cotton kurti for everyday plans.',
   'kurtis', 1899::numeric, 1599::numeric, 'DEMO-KURTI-001', 'https://placehold.co/800x1000?text=Petal+Kurti',
   'Cotton', 24, true),
  ('Soft Light Anarkali', 'soft-light-anarkali', 'An easy, flowing silhouette for celebrations.',
   'anarkali', 4299::numeric, null::numeric, 'DEMO-ANARKALI-001', 'https://placehold.co/800x1000?text=Anarkali',
   'Cotton blend', 16, true),
  ('Evening Bloom Saree', 'evening-bloom-saree', 'A lightweight drape with a subtle floral finish.',
   'sarees', 5299::numeric, 4799::numeric, 'DEMO-SAREE-001', 'https://placehold.co/800x1000?text=Saree',
   'Chiffon', 12, false)
) as sample(name, slug, description, category_slug, price, discount_price, sku, image, material, stock, featured)
join public.categories category on category.slug = sample.category_slug
where not exists (select 1 from public.products p where p.slug = sample.slug);

update public.store_settings
set shop_name = 'Aavya Studio',
    contact_number = '0000000000',
    whatsapp_number = '0000000000',
    gpay_number = 'demo@upi',
    store_address = 'Development address',
    address = 'Development address',
    delivery_charge = 99,
    free_delivery_threshold = 5000,
    currency = 'INR',
    cod_enabled = false
where id = 'main';
