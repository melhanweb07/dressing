export type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string;
  price: number | string;
  discount_price: number | string | null;
  sku: string;
  images: string[];
  sizes: string[];
  colors: string[];
  material: string;
  stock: number;
  popularity: number;
  featured: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
};

export function toPublicProduct(row: DbProduct) {
  const regularPrice = Number(row.price);
  const currentPrice = row.discount_price == null ? regularPrice : Number(row.discount_price);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    categoryId: row.category_id,
    category: row.categories?.name ?? "",
    price: currentPrice,
    originalPrice: regularPrice,
    discountPrice: row.discount_price == null ? null : Number(row.discount_price),
    image: row.images[0] ?? "",
    images: row.images,
    description: row.description,
    sizes: row.sizes,
    colors: row.colors,
    fabric: row.material,
    stock: row.stock,
    popularity: row.popularity,
    featured: row.featured,
    isNew: Date.now() - new Date(row.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
    active: row.active,
    sku: row.sku,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProductWrite(value: Record<string, unknown>) {
  const map: Record<string, string> = {
    categoryId: "category_id",
    discountPrice: "discount_price",
    sortOrder: "sort_order",
  };
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [map[key] ?? key, item]),
  );
}
