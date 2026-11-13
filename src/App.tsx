import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Heart, LockKeyhole, MapPin, Minus, Plus, Search, ShieldCheck,
  ShoppingBag, Sparkles, Truck,
} from "lucide-react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ProductCard } from "./components/ProductCard";
import { getApiError } from "./lib/api";
import { adminLogin, adminLogout, getProducts, getStoreSettings, submitOrder, trackOrder } from "./lib/services";
import { useStore } from "./lib/store";
import type { Order, Product, StoreSettings } from "./types";

const MotionLink = motion.create(Link);
const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
const gpayNumber = import.meta.env.VITE_GPAY_NUMBER || "";
const whatsAppNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || "").replace(/\D/g, "");
const whatsAppLink = (message: string, phone = whatsAppNumber) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
const shippingCharge = (subtotal: number, settings?: StoreSettings | null) => {
  const threshold = settings?.freeDeliveryThreshold ?? 5000;
  const charge = settings?.deliveryCharge ?? 99;
  return subtotal >= threshold || subtotal === 0 ? 0 : charge;
};
type ConfirmationDetails = Pick<Order, "id" | "createdAt" | "total" | "items" | "paymentStatus" | "status"> & {
  customer: Pick<Order["customer"], "name">;
};

function PageIntro({ label, title, copy }: { label: string; title: string; copy?: string }) {
  return <div className="page-intro"><span className="eyebrow">{label}</span><h1>{title}</h1>{copy && <p>{copy}</p>}</div>;
}

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    getProducts().then(setProducts).catch((error: unknown) => setLoadError(getApiError(error))).finally(() => setLoading(false));
  }, []);

  const moodCollections = [
    { title: "Everyday elegance", copy: "Soft structure and easy confidence for the rhythm of real life.", category: "Kurtis", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85" },
    { title: "Occasion edit", copy: "Warm, luminous silhouettes for late evenings and special dates.", category: "Anarkali", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=85" },
    { title: "Modern classics", copy: "Thoughtful staples with quietly bold personality.", category: "Sarees", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85" },
  ];

  return (
    <main>
      <section className="hero">
        <div className="hero-image" role="img" aria-label="Woman wearing an elegant rose-coloured Indian outfit" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="hero-kicker"><span /> Studio edit / spring 2026</span>
          <h1>YOUR STYLE.<br /><em>YOUR STORY.</em></h1>
          <p>Discover pieces that make every moment unforgettable — elevated essentials and romantic silhouettes crafted for real life.</p>
          <div className="hero-actions">
            <Link to="/shop" className="button button-light">Shop collection <ArrowRight size={17} /></Link>
            <Link to="/shop?sort=new" className="button button-ghost">New arrivals</Link>
          </div>
          <div className="hero-note"><span>01</span><span className="hero-line" /><span>THE STUDIO EDIT</span></div>
        </div>
        <div className="hero-caption">A little poetry in every pleat.</div>
      </section>

      <div className="promise-strip">
        <span><Truck size={17} /> Complimentary delivery over ₹5,000</span>
        <i />
        <span><ShieldCheck size={17} /> Thoughtfully made in India</span>
        <i />
        <span><Heart size={16} /> Easy 7-day exchanges</span>
      </div>

      <section className="section category-section">
        <div className="section-heading"><div><span className="eyebrow">Fashion, curated</span><h2>Explore your mood</h2></div><Link to="/shop" className="text-link">Explore everything <ArrowUpRight size={16} /></Link></div>
        <div className="mood-grid">
          {moodCollections.map((collection, index) => (
            <MotionLink to={`/shop?category=${encodeURIComponent(collection.category)}`} className={`mood-card mood-card-${index + 1}`} key={collection.title}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.18 }}
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : index * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src={collection.image} alt={collection.title} loading="lazy" />
              <div className="mood-copy">
                <span className="eyebrow">Collection 0{index + 1}</span>
                <h3>{collection.title}</h3>
                <p>{collection.copy}</p>
                <span className="text-link">Explore collection <ArrowUpRight size={16} /></span>
              </div>
            </MotionLink>
          ))}
        </div>
      </section>

      <section className="section product-section">
        <div className="section-heading"><div><span className="eyebrow">The pieces everyone will ask about</span><h2>Well-loved lately</h2></div><Link to="/shop" className="text-link">Shop all pieces <ArrowUpRight size={16} /></Link></div>
        {loadError ? <p className="inline-error">{loadError}</p> : loading ? <div className="product-grid home-product-grid">{[1, 2, 3, 4].map((item) => <div className="product-skeleton" key={item}><div /><span /><i /></div>)}</div> : <div className="product-grid home-product-grid">{products.filter((item) => item.featured).slice(0, 4).map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>}
      </section>

      <section className="campaign-band">
        <div className="campaign-copy">
          <span className="eyebrow">THE FASHION EDIT</span>
          <h2>STYLE IS NOT A TREND.<br />IT'S YOUR SIGNATURE.</h2>
          <p>Build a wardrobe that feels like an extension of your confidence — expressive, effortless, and distinctly yours.</p>
          <Link to="/shop" className="button button-light">Shop the collection <ArrowRight size={16} /></Link>
        </div>
        <div className="campaign-visual" aria-label="Editorial campaign image" />
      </section>

      <section className="story-banner">
        <div className="story-image" />
        <div className="story-copy"><span className="eyebrow">A little more meaning</span><h2>Clothes with a<br /><em>softer footprint.</em></h2><p>We believe the best pieces are the ones you wear for years. So we choose comfortable fabrics, make in thoughtful batches, and keep the details close to home.</p><Link to="/about" className="button button-dark">Get to know us <ArrowRight size={16} /></Link></div>
      </section>

      <section className="section testimonial-section"><Sparkles size={20} className="testimonial-sparkle" /><span className="eyebrow">A note from you</span><blockquote>“The kind of outfit that makes you stand a little taller. I felt completely myself in it.”</blockquote><span className="testimonial-author">PRIYA S. <span>·</span> VERIFIED CUSTOMER</span><div className="testimonial-dots"><b /><i /><i /></div></section>

      <section className="newsletter-band"><div><span className="eyebrow">LETTERS FROM AAVYA</span><h2>A good thing in your inbox.</h2><p>First looks, thoughtful stories, and notes from the studio.</p></div><form onSubmit={(event) => { event.preventDefault(); window.alert("You’re on the list. Look out for a note from us soon."); }}><label className="sr-only" htmlFor="home-email">Email address</label><input id="home-email" type="email" placeholder="Your email address" required /><button className="button button-dark">Count me in <ArrowRight size={16} /></button></form></section>
    </main>
  );
}

function ShopPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(params.get("category") || "All pieces");
  const [sort, setSort] = useState(params.get("sort") === "new" ? "Newest" : "Featured");
  const [maxPrice, setMaxPrice] = useState(10000);
  const [selectedSize, setSelectedSize] = useState("Any size");
  const [selectedColor, setSelectedColor] = useState("Any colour");
  const [availability, setAvailability] = useState("All pieces");
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    getProducts().then(setProducts).catch((reason: unknown) => setError(getApiError(reason)));
  }, []);
  const categories = ["All pieces", ...new Set(products.map((product) => product.category))];
  const filtered = useMemo(() => {
    const list = products.filter((product) =>
      (category === "All pieces" || product.category === category) &&
      product.price <= maxPrice &&
      (selectedSize === "Any size" || product.sizes.includes(selectedSize)) &&
      (selectedColor === "Any colour" || product.colors.includes(selectedColor)) &&
      (availability === "All pieces" || (availability === "In stock" ? product.stock > 0 : product.stock === 0)) &&
      `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query.toLowerCase()),
    );
    if (sort === "Price: low to high") return list.sort((a, b) => a.price - b.price);
    if (sort === "Price: high to low") return list.sort((a, b) => b.price - a.price);
    if (sort === "Newest") return list.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
    if (sort === "Popularity") return list.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    return list;
  }, [products, category, maxPrice, query, sort, selectedSize, selectedColor, availability]);
  const sizes = [...new Set(products.flatMap((product) => product.sizes))].filter((size) => size !== "One size");
  const colors = [...new Set(products.flatMap((product) => product.colors))];

  return <main className="page-shell shop-page">
    <PageIntro label="The collection" title="Pieces to feel like you." copy="Considered shapes, beautiful fabrics, and little details you'll notice every time." />
    <div className="shop-tools"><label className="shop-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find your something" /><button onClick={() => setShowFilters(!showFilters)} className="filter-toggle">Filter & sort <ChevronDown size={16} /></button></label><span className="result-count">{filtered.length} pieces</span></div>
    <div className={`shop-layout ${showFilters ? "filters-visible" : ""}`}>
      <aside className="shop-filters">
          <div className="filter-title"><span>Filter by</span><button onClick={() => { setCategory("All pieces"); setMaxPrice(10000); setQuery(""); setSelectedSize("Any size"); setSelectedColor("Any colour"); setAvailability("All pieces"); }}>Clear all</button></div>
        <div className="filter-block"><h3>Collection</h3>{categories.map((item) => <button key={item} className={`filter-option ${category === item ? "selected" : ""}`} onClick={() => setCategory(item)}>{item}<span>{products.filter((product) => item === "All pieces" || product.category === item).length}</span></button>)}</div>
        <div className="filter-block"><label htmlFor="price-filter"><h3>Price range</h3><span>Up to {money(maxPrice)}</span></label><input id="price-filter" className="range-input" type="range" min="1000" max="10000" step="500" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /><div className="range-labels"><span>₹1,000</span><span>₹10,000+</span></div></div>
        <div className="filter-block"><h3>Size</h3><select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}><option>Any size</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="filter-block"><h3>Colour</h3><select value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)}><option>Any colour</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="filter-block"><h3>Availability</h3><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option>All pieces</option><option>In stock</option><option>Sold out</option></select></div>
        <div className="filter-block sort-mobile"><h3>Sort by</h3><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Featured</option><option>Popularity</option><option>Newest</option><option>Price: low to high</option><option>Price: high to low</option></select></div>
      </aside>
      <section className="shop-results"><div className="desktop-sort"><span>Showing {filtered.length} pieces</span><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option>Featured</option><option>Popularity</option><option>Newest</option><option>Price: low to high</option><option>Price: high to low</option></select></label></div>
        {error ? <div className="empty-state"><CircleHelp /><h2>We couldn't load the collection</h2><p>{error}</p></div> : filtered.length ? <div className="product-grid shop-product-grid">{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="empty-state"><Search /><h2>Nothing quite like that yet</h2><p>Try a different search or clear your filters.</p><button className="text-link" onClick={() => { setQuery(""); setCategory("All pieces"); setMaxPrice(10000); setSelectedSize("Any size"); setSelectedColor("Any colour"); setAvailability("All pieces"); }}>Clear filters <ArrowRight size={15} /></button></div>}
      </section>
    </div>
  </main>;
}

function ProductPage() {
  const { id = "" } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addToCart = useStore((state) => state.addToCart);
  const saved = useStore((state) => state.wishlist.includes(id));
  const toggleWishlist = useStore((state) => state.toggleWishlist);
  useEffect(() => {
    getProducts().then(setProducts).catch((reason: unknown) => setError(getApiError(reason)));
    getStoreSettings().then(setStoreSettings).catch(() => setStoreSettings(null));
  }, []);
  const product = products.find((item) => item.id === id);
  if (error) return <main className="page-shell"><div className="empty-state"><CircleHelp /><h2>Product unavailable</h2><p>{error}</p><Link to="/shop" className="button button-dark">Back to the collection</Link></div></main>;
  if (!product) return <main className="page-shell product-loading"><div className="loading-image" /><div className="loading-copy" /></main>;
  const outOfStock = product.stock === 0;
  const addProduct = () => {
    if ((!size && product.sizes.length > 1) || !color) return;
    for (let count = 0; count < quantity; count += 1) addToCart(product, size || product.sizes[0], color);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  };
  const waMessage = `Hello Aavya Studio, I'd love to know more about ${product.name}.`;
  const productWhatsApp = storeSettings?.whatsappNumber || whatsAppNumber;
  return <main className="page-shell">
    <div className="breadcrumbs"><Link to="/">Home</Link><ChevronRight size={13} /><Link to="/shop">Shop</Link><ChevronRight size={13} /><span>{product.name}</span></div>
    <div className="product-detail">
      <div className="product-gallery"><div className="gallery-main"><img src={product.images[imageIndex] || product.image} alt={product.name} /><span className="gallery-count">{String(imageIndex + 1).padStart(2, "0")} / {String(product.images.length).padStart(2, "0")}</span><button className="gallery-prev" onClick={() => setImageIndex((imageIndex + product.images.length - 1) % product.images.length)} aria-label="Previous image"><ChevronLeft /></button><button className="gallery-next" onClick={() => setImageIndex((imageIndex + 1) % product.images.length)} aria-label="Next image"><ChevronRight /></button></div><div className="gallery-thumbs">{product.images.map((image, index) => <button key={image} className={index === imageIndex ? "active" : ""} onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`}><img src={image} alt="" /></button>)}</div></div>
      <section className="product-detail-info"><span className="eyebrow">{product.category} · MADE WITH CARE</span><h1>{product.name}</h1><div className="detail-price">{money(product.price)} <del>{money(product.originalPrice)}</del><span>{Math.round((1 - product.price / product.originalPrice) * 100)}% off</span></div><p className="detail-description">{product.description}</p><div className="product-meta"><span><Check size={15} /> {product.fabric}</span><span><Check size={15} /> {outOfStock ? "Currently unavailable" : `${product.stock} pieces ready to ship`}</span></div>
        <div className="variant-group"><div className="variant-heading"><span>Colour</span><span>{color || "Choose a shade"}</span></div><div className="color-options">{product.colors.map((item, index) => <button key={item} onClick={() => setColor(item)} className={`color-choice ${color === item ? "active" : ""}`} title={item}><i style={{ backgroundColor: ["#bd747c", "#e7dfd1", "#394a62", "#7d8060", "#8d6775"][index % 5] }} />{item}</button>)}</div></div>
        <div className="variant-group"><div className="variant-heading"><span>Size</span><button className="text-link size-guide" onClick={() => window.alert("For size help, please message us on WhatsApp.")}>Size guide <ArrowUpRight size={13} /></button></div><div className="size-options">{product.sizes.map((item) => <button key={item} onClick={() => setSize(item)} className={size === item ? "active" : ""}>{item}</button>)}</div></div>
        <div className="detail-buy-row"><div className="quantity-stepper"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={14} /></button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} disabled={quantity >= product.stock}><Plus size={14} /></button></div><button className="button button-dark add-cart-button" onClick={addProduct} disabled={outOfStock || (!size && product.sizes.length > 1) || !color}><ShoppingBag size={17} />{added ? "Added to your bag" : outOfStock ? "Sold out" : "Add to bag — " + money(product.price * quantity)}</button><button onClick={() => toggleWishlist(product.id)} aria-label="Toggle wishlist" className={`save-product ${saved ? "is-saved" : ""}`}><Heart size={19} fill={saved ? "currentColor" : "none"} /></button></div>
        {(!size && product.sizes.length > 1 || !color) && !outOfStock && <p className="variant-hint">Choose a {(!size && product.sizes.length > 1 && !color) ? "size and colour" : !color ? "colour" : "size"} to continue.</p>}
        <a className="whatsapp-enquiry" href={productWhatsApp ? whatsAppLink(waMessage, productWhatsApp) : "/contact"} target={productWhatsApp ? "_blank" : undefined} rel="noreferrer">Have a question? Chat with us on WhatsApp <ArrowUpRight size={14} /></a>
        <div className="product-perks"><div><Truck size={18} /><span><b>Complimentary delivery</b><small>On orders over ₹5,000</small></span></div><div><Clock3 size={18} /><span><b>Easy exchanges</b><small>Within 7 days of delivery</small></span></div><div><MapPin size={18} /><span><b>Made with intention</b><small>Thoughtfully finished in India</small></span></div></div>
        <details className="product-accordion"><summary>Details & care <Plus size={15} /></summary><p>{product.description}<br />Fabric: {product.fabric}. We recommend a gentle hand wash or dry clean to keep your piece lovely for longer.</p></details>
      </section>
    </div>
    <section className="section related-section"><div className="section-heading"><div><span className="eyebrow">A few more favourites</span><h2>Made to go with</h2></div><Link to="/shop" className="text-link">View the collection <ArrowUpRight size={16} /></Link></div><div className="product-grid">{products.filter((item) => item.id !== product.id).slice(0, 4).map((item, index) => <ProductCard key={item.id} product={item} index={index} />)}</div></section>
  </main>;
}

function CartPage() {
  const cart = useStore((state) => state.cart);
  const setQuantity = useStore((state) => state.setQuantity);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  useEffect(() => { getStoreSettings().then(setSettings).catch(() => setSettings(null)); }, []);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const delivery = shippingCharge(subtotal, settings);
  if (!cart.length) return <main className="page-shell"><div className="empty-state cart-empty"><ShoppingBag /><span className="eyebrow">YOUR BAG, FOR NOW</span><h1>Nothing in here just yet.</h1><p>There are lovely things waiting to be found.</p><Link to="/shop" className="button button-dark">Find your something <ArrowRight size={16} /></Link></div></main>;
  return <main className="page-shell cart-page"><PageIntro label="Your bag" title="Good things, gathered." /><div className="cart-layout"><section className="cart-items"><div className="cart-table-label"><span>Your pieces ({cart.length})</span><span>Total</span></div>{cart.map(({ product, size, color, quantity }) => <article className="cart-item" key={`${product.id}-${size}-${color}`}><Link to={`/product/${product.id}`} className="cart-thumb"><img src={product.image} alt={product.name} /></Link><div className="cart-item-info"><span className="eyebrow">{product.category}</span><Link to={`/product/${product.id}`}><h2>{product.name}</h2></Link><p>Colour: {color} <span>·</span> Size: {size}</p><div className="cart-item-controls"><div className="quantity-stepper"><button aria-label="Decrease quantity" onClick={() => setQuantity(product.id, size, color, quantity - 1)}><Minus size={13} /></button><span>{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity(product.id, size, color, quantity + 1)}><Plus size={13} /></button></div><button className="remove-link" onClick={() => removeFromCart(product.id, size, color)}>Remove</button></div></div><strong className="cart-item-total">{money(product.price * quantity)}</strong></article>)}
      <Link to="/shop" className="continue-link"><ArrowLeft size={15} /> Continue looking</Link></section><aside className="order-summary"><h2>A little overview</h2><div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span>{delivery === 0 ? "Complimentary" : money(delivery)}</span></div><div className="delivery-progress">{subtotal >= (settings?.freeDeliveryThreshold ?? 5000) ? <><Check size={15} /> You’ve unlocked complimentary delivery.</> : <>Add {money((settings?.freeDeliveryThreshold ?? 5000) - subtotal)} for complimentary delivery.</>}</div><div className="summary-total"><span>Total</span><strong>{money(subtotal + delivery)}</strong></div><p className="tax-note">Inclusive of applicable taxes. Delivery calculated at checkout.</p><Link to="/checkout" className="button button-dark summary-checkout">Continue to checkout <ArrowRight size={16} /></Link><div className="secure-note"><LockKeyhole size={13} /> A safe and simple checkout</div></aside></div></main>;
}

const checkoutSchema = z.object({
  name: z.string().min(2, "Please enter your full name."),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  email: z.union([z.literal(""), z.string().email("Enter a valid email address.")]),
  address: z.string().min(8, "Please enter your complete delivery address."),
  city: z.string().min(2, "Please enter your city."),
  state: z.string().min(2, "Please enter your state."),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  notes: z.string().optional(),
});
type CheckoutFields = z.infer<typeof checkoutSchema>;

function CheckoutPage() {
  const navigate = useNavigate();
  const cart = useStore((state) => state.cart);
  const clearCart = useStore((state) => state.clearCart);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(!import.meta.env.DEV);
  const [settingsError, setSettingsError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    getStoreSettings()
      .then(setSettings)
      .catch((reason: unknown) => setSettingsError(getApiError(reason)))
      .finally(() => setSettingsLoading(false));
  }, []);
  const delivery = shippingCharge(subtotal, settings);
  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutFields>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", notes: "" },
  });
  if (!cart.length) return <Navigate to="/cart" replace />;
  const onSubmit = async (values: CheckoutFields) => {
    setSubmitting(true); setError("");
    try {
      const order = await submitOrder({ customer: values, items: cart, subtotal, delivery, total: subtotal + delivery });
      const confirmation: ConfirmationDetails = {
        id: order.id,
        createdAt: order.createdAt,
        total: order.total,
        items: order.items,
        paymentStatus: order.paymentStatus,
        status: order.status,
        customer: { name: order.customer.name },
      };
      sessionStorage.setItem("aavya-last-order", JSON.stringify(confirmation));
      clearCart();
      navigate("/order-confirmation");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setSubmitting(false); }
  };
  return <main className="page-shell checkout-page"><PageIntro label="A few details" title="Let's get it to you." /><form className="checkout-layout" onSubmit={handleSubmit(onSubmit)} noValidate><section className="checkout-form">
    <div className="form-section"><div className="form-section-title"><span>01</span><div><h2>Where should we send it?</h2><p>Just the essentials, so your pieces find their way home.</p></div></div><div className="form-grid"><label className="field full-field">Full name<input {...register("name")} placeholder="Your full name" autoComplete="name" />{errors.name && <small className="field-error">{errors.name.message}</small>}</label><label className="field">Mobile number<input {...register("phone")} placeholder="10-digit mobile number" inputMode="tel" autoComplete="tel" />{errors.phone && <small className="field-error">{errors.phone.message}</small>}</label><label className="field">Email <span className="optional">(optional)</span><input {...register("email")} placeholder="you@example.com" autoComplete="email" />{errors.email && <small className="field-error">{errors.email.message}</small>}</label><label className="field full-field">Delivery address<textarea {...register("address")} placeholder="House / flat, street, locality" rows={3} autoComplete="street-address" />{errors.address && <small className="field-error">{errors.address.message}</small>}</label><label className="field">City<input {...register("city")} placeholder="City" autoComplete="address-level2" />{errors.city && <small className="field-error">{errors.city.message}</small>}</label><label className="field">State<input {...register("state")} placeholder="State" autoComplete="address-level1" />{errors.state && <small className="field-error">{errors.state.message}</small>}</label><label className="field">Pincode<input {...register("pincode")} placeholder="6-digit pincode" inputMode="numeric" autoComplete="postal-code" />{errors.pincode && <small className="field-error">{errors.pincode.message}</small>}</label><label className="field full-field">Anything we should know? <span className="optional">(optional)</span><textarea {...register("notes")} placeholder="Delivery notes, if any" rows={2} /></label></div></div>
    <div className="payment-note"><ShieldCheck size={19} /><div><strong>Payment, the personal way.</strong><p>Once we receive your order, we’ll share the payment details and confirm everything with you. No payment is taken on this page.</p></div></div>
    {settingsError && <p className="inline-error">Store delivery settings could not be loaded: {settingsError}</p>}{error && <p className="inline-error">{error}</p>}<button type="submit" className="button button-dark checkout-submit" disabled={submitting || settingsLoading || Boolean(settingsError)}>{settingsLoading ? "Loading store settings…" : submitting ? "Placing your order…" : "Place order — " + money(subtotal + delivery)} <ArrowRight size={16} /></button><p className="consent-note">By placing your order, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>
  </section><aside className="checkout-summary"><h2>In your bag <span>{cart.length} {cart.length === 1 ? "piece" : "pieces"}</span></h2><div className="checkout-items">{cart.map((item) => <div className="checkout-item" key={`${item.product.id}-${item.size}-${item.color}`}><div className="checkout-thumb"><img src={item.product.image} alt="" /><span>{item.quantity}</span></div><div><strong>{item.product.name}</strong><small>{item.color} · {item.size}</small></div><span>{money(item.product.price * item.quantity)}</span></div>)}</div><div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span>{delivery ? money(delivery) : "Complimentary"}</span></div><div className="summary-total"><span>Total</span><strong>{money(subtotal + delivery)}</strong></div><p className="tax-note">Taxes included in the price.</p></aside></form></main>;
}

function ConfirmationPage() {
  const [order, setOrder] = useState<ConfirmationDetails | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  useEffect(() => {
    const stored = sessionStorage.getItem("aavya-last-order");
    if (stored) setOrder(JSON.parse(stored) as ConfirmationDetails);
    getStoreSettings().then(setSettings).catch(() => setSettings(null));
  }, []);
  if (!order) return <main className="page-shell"><div className="empty-state"><CircleHelp /><h2>No recent order to show</h2><Link to="/shop" className="button button-dark">Back to shopping</Link></div></main>;
  const message = `Hello Aavya Studio, I just placed order ${order.id} for ${order.customer.name}. Total: ${money(order.total)}. Please share payment details.`;
  const configuredWhatsApp = settings?.whatsappNumber || whatsAppNumber;
  const configuredGpay = settings?.gpayNumber || gpayNumber;
  return <main className="page-shell confirmation-page"><div className="confirmation-card"><span className="confirmation-icon"><Check size={26} /></span><span className="eyebrow">THANK YOU, {order.customer.name.split(" ")[0].toUpperCase()}</span><h1>Your order is with us.</h1><p>We’ll get in touch shortly to confirm your pieces and help with payment.</p><div className="confirmation-order"><span>ORDER REFERENCE</span><strong>{order.id}</strong></div><div className="payment-pending"><Clock3 size={18} /><div><strong>Payment pending</strong><p>Your order is reserved. Payment is not yet confirmed.</p></div></div>{configuredGpay && <div className="gpay-box"><span>PAY VIA UPI / GPAY</span><strong>{configuredGpay}</strong><small>Please share your payment confirmation with us on WhatsApp.</small></div>}<div className="confirmation-actions"><a className="button button-dark" href={configuredWhatsApp ? whatsAppLink(message, configuredWhatsApp) : "/contact"} target={configuredWhatsApp ? "_blank" : undefined} rel="noreferrer">Message us on WhatsApp <ArrowUpRight size={15} /></a><Link to={`/track?order=${order.id}`} className="button button-outline">Track your order <ArrowRight size={15} /></Link></div><Link to="/shop" className="continue-link centered-link">Continue exploring</Link></div></main>;
}

function TrackPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [orderId, setOrderId] = useState(params.get("order") || "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setOrder(null);
    try { setOrder(await trackOrder(orderId, phone)); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  };
  return <main className="page-shell track-page"><PageIntro label="A little peace of mind" title="Where is your order?" copy="Your order reference and phone number are all we need." />
    <form className="track-form" onSubmit={onSubmit}><label className="field">Order reference<input required value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="e.g. AAV-2025-AB12CD" /></label><label className="field">Phone number<input required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="The number you ordered with" /></label><button className="button button-dark" disabled={loading}>{loading ? "Looking for your order…" : "Find my order"} <ArrowRight size={16} /></button>{error && <p className="inline-error">{error}</p>}</form>
    {order && <section className="tracking-result"><div className="tracking-heading"><div><span className="eyebrow">ORDER {order.id}</span><h2>Your pieces are {order.status.toLowerCase()}.</h2></div><span className={`status-pill ${order.paymentStatus.toLowerCase()}`}>{order.paymentStatus} payment</span></div><p className="tracking-date">Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</p><div className="tracking-items">{order.items.map((item) => <div className="tracking-item" key={`${item.product.id}-${item.size}`}><img src={item.product.image} alt="" /><div><strong>{item.product.name}</strong><small>{item.color} · {item.size} · Qty {item.quantity}</small></div><span>{money((item.unitPrice ?? item.product.price ?? 0) * item.quantity)}</span></div>)}</div><div className="tracking-total"><span>Order total</span><strong>{money(order.total)}</strong></div><div className="tracking-stepper"><span className="tracking-step active"><i>1</i>Order placed</span><span className={order.status !== "Pending Confirmation" ? "tracking-step active" : "tracking-step"}><i>2</i>Confirmed</span><span className={["Processing", "Packed", "Shipped", "Out for Delivery", "Delivered"].includes(order.status) ? "tracking-step active" : "tracking-step"}><i>3</i>On its way</span><span className={order.status === "Delivered" ? "tracking-step active" : "tracking-step"}><i>4</i>Delivered</span></div></section>}
  </main>;
}

function WishlistPage() {
  const wishlist = useStore((state) => state.wishlist);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { getProducts().then(setAllProducts).catch((reason: unknown) => setError(getApiError(reason))); }, []);
  const products = allProducts.filter((product) => wishlist.includes(product.id));
  if (error) return <main className="page-shell"><PageIntro label="A few things you love" title="Your wishlist." /><div className="empty-state"><CircleHelp /><h2>We couldn't load your saved pieces</h2><p>{error}</p></div></main>;
  return <main className="page-shell"><PageIntro label="A few things you love" title="Your wishlist." />{products.length ? <div className="product-grid wishlist-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="empty-state"><Heart /><h2>Save a little something</h2><p>Tap the heart on a piece you love, and it’ll be here when you’re ready.</p><Link to="/shop" className="button button-dark">Explore the collection <ArrowRight size={16} /></Link></div>}</main>;
}

const infoPages: Record<string, { label: string; title: string; copy: string }> = {
  about: { label: "A little about us", title: "We make clothes for real life.", copy: "Aavya is a small Indian wear studio with a simple idea: getting dressed should feel like coming home to yourself." },
  contact: { label: "We're right here", title: "Let's talk.", copy: `For order help, sizing questions, or just to say hello, write to hello@aavyastudio.in${whatsAppNumber ? " or message us on WhatsApp" : ""}. We usually reply within one working day.` },
  shipping: { label: "Good to know", title: "Shipping & returns.", copy: "We carefully prepare every order. Complimentary delivery is available on orders over ₹5,000. For eligible pieces, request an exchange within 7 days of delivery in original, unworn condition. Contact us before sending anything back so we can help." },
  faq: { label: "A few answers", title: "Frequently asked.", copy: "Need help with a size, a delivery, or a detail? We’re happy to help. Write to hello@aavyastudio.in and we’ll get back to you soon." },
  privacy: { label: "The fine print", title: "Privacy policy.", copy: "We use the details you share only to fulfil your order and support your experience with Aavya Studio. We do not sell your personal information. To request access to or deletion of your data, contact hello@aavyastudio.in." },
  terms: { label: "The fine print", title: "Terms & conditions.", copy: "Orders are subject to product availability and confirmation by Aavya Studio. Prices are displayed in Indian rupees. Submitting an order request does not confirm payment; payment is pending until the store verifies it. For help, contact hello@aavyastudio.in." },
};

function InfoPage({ page }: { page: keyof typeof infoPages }) {
  const content = infoPages[page];
  return <main className="page-shell info-page"><PageIntro label={content.label} title={content.title} copy={content.copy} /><div className="info-decoration"><span>A</span><div><p>Made with intention.<br />Worn with joy.</p><Link to="/shop" className="text-link">Discover the collection <ArrowRight size={15} /></Link></div></div></main>;
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<{ email: string; password: string }>();
  const onSubmit = async (values: { email: string; password: string }) => {
    setLoading(true); setError("");
    try { const token = await adminLogin(values.email, values.password); localStorage.setItem("aavya-admin-token", token); navigate("/admin", { replace: true }); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  };
  return <main className="admin-login-page"><div className="admin-login-card"><Link to="/" className="wordmark"><span>AAVYA</span><small>STUDIO</small></Link><span className="eyebrow">THE STUDIO, BEHIND THE SCENES</span><h1>Welcome back.</h1><p>Sign in to look after your store.</p><form onSubmit={handleSubmit(onSubmit)}><label className="field">Work email<input type="email" required autoComplete="username" {...register("email")} placeholder="you@aavyastudio.in" /></label><label className="field">Password<input type="password" required autoComplete="current-password" {...register("password")} placeholder="Your password" /></label>{error && <p className="inline-error">{error}</p>}<button className="button button-dark" disabled={loading}>{loading ? "Signing in…" : "Sign in"} <ArrowRight size={16} /></button></form><Link to="/" className="admin-back"><ArrowLeft size={14} /> Back to the storefront</Link></div></main>;
}

async function fetchAdminData<T>(path: string, headers: HeadersInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}${path}`, { headers });
  const body = await response.json() as { success?: boolean; message?: string; data?: T };
  if (!response.ok || body.success !== true || body.data === undefined) {
    throw new Error(body.message || "The store API could not complete the request.");
  }
  return body.data;
}

type AdminOverview = {
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  verifiedSales: number;
};

function AdminPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState("Overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("aavya-admin-token");
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    Promise.all([
      fetchAdminData<{ items: Order[] }>("/admin/orders", headers).then((response) => response.items),
      fetchAdminData<Product[]>("/admin/products", headers),
      fetchAdminData<AdminOverview>("/admin/overview", headers),
    ]).then(([loadedOrders, loadedProducts, loadedOverview]) => {
      setOrders(loadedOrders);
      setProducts(loadedProducts);
      setOverview(loadedOverview);
    })
      .catch((reason: unknown) => setError(getApiError(reason)))
      .finally(() => setLoading(false));
  }, [token]);
  if (!token) return <Navigate to="/admin/login" replace />;
  const sections = ["Overview", "Orders", "Products", "Categories", "Store settings"];
  const logout = async () => {
    try { await adminLogout(); }
    catch (reason) { setError(`Your browser session was cleared, but the server could not revoke it: ${getApiError(reason)}`); }
    navigate("/admin/login", { replace: true });
  };
  return <main className="admin-shell"><aside className="admin-sidebar"><Link to="/" className="wordmark"><span>AAVYA</span><small>STUDIO</small></Link><span className="eyebrow">STORE ADMIN</span><nav>{sections.map((item, index) => <button onClick={() => setSection(item)} className={section === item ? "active" : ""} key={item}><span>0{index + 1}</span>{item}</button>)}</nav><button className="admin-logout" onClick={logout}>Sign out <ArrowUpRight size={14} /></button></aside><section className="admin-content"><div className="admin-topbar"><div><span className="eyebrow">AAVYA STUDIO / {section.toUpperCase()}</span><h1>{section === "Overview" ? "A good morning to you." : section}</h1></div><Link to="/" className="text-link">View your store <ArrowUpRight size={15} /></Link></div>
    {error && <div className="admin-notice"><CircleHelp size={16} /> {error} <span>Connect the Express API to manage live store data.</span></div>}
    {loading && <div className="admin-loading">Connecting to your store…</div>}
    {!loading && section === "Overview" && <><div className="admin-stat-grid">{[["Total orders", overview?.totalOrders ?? orders.length], ["Total products", overview?.totalProducts ?? products.length], ["Pending orders", overview?.pendingOrders ?? orders.filter((item) => item.status === "Pending Confirmation").length], ["Verified sales", money(overview?.verifiedSales ?? orders.filter((item) => item.paymentStatus === "Verified").reduce((sum, item) => sum + item.total, 0))]].map(([label, value]) => <div className="admin-stat" key={label}><span>{label}</span><strong>{value}</strong><small>Live store data</small></div>)}</div><div className="admin-table-card"><div className="admin-table-title"><h2>Recent orders</h2><button className="text-link" onClick={() => setSection("Orders")}>View all <ArrowRight size={14} /></button></div>{orders.length ? <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{orders.slice(0, 8).map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.customer.name}</td><td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td><td>{money(order.total)}</td><td><span className={`status-pill ${order.paymentStatus.toLowerCase()}`}>{order.paymentStatus}</span></td><td>{order.status}</td></tr>)}</tbody></table></div> : <div className="admin-empty">Your latest orders will appear here once connected.</div>}</div></>}
    {!loading && section === "Orders" && <div className="admin-table-card"><div className="admin-table-title"><h2>All orders</h2><span>{orders.length} total</span></div>{orders.length ? <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.customer.name}</td><td>{order.customer.phone}</td><td>{money(order.total)}</td><td>{order.paymentStatus}</td><td>{order.status}</td></tr>)}</tbody></table></div> : <div className="admin-empty">No orders yet. New customer orders will show here.</div>}</div>}
    {!loading && section === "Products" && <div className="admin-table-card"><div className="admin-table-title"><h2>Product collection</h2><span>{products.length} pieces</span></div>{products.length ? <div className="admin-table-wrap"><table><thead><tr><th>Piece</th><th>Category</th><th>Price</th><th>Stock</th><th>Availability</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td className="admin-product-name"><img src={product.image} alt="" />{product.name}</td><td>{product.category}</td><td>{money(product.price)}</td><td>{product.stock}</td><td>{product.stock ? "Available" : "Sold out"}</td></tr>)}</tbody></table></div> : <div className="admin-empty">Products from your API will appear here.</div>}</div>}
    {!loading && ["Categories", "Store settings"].includes(section) && <div className="admin-settings-card"><span className="eyebrow">STORE CONFIGURATION</span><h2>{section === "Categories" ? "Your collections, in one place." : "A few details make a store yours."}</h2><p>{section === "Categories" ? "Category creation and visibility are managed through the connected store API." : "Shop name, contact details, UPI number, delivery charges, and policy settings are managed through the connected store API."}</p><code>VITE_API_URL → Express admin API</code></div>}
  </section></main>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  return <><ScrollToTop />{!isAdmin && <Header />}<Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/shop" element={<ShopPage />} />
    <Route path="/product/:id" element={<ProductPage />} />
    <Route path="/cart" element={<CartPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/order-confirmation" element={<ConfirmationPage />} />
    <Route path="/track" element={<TrackPage />} />
    <Route path="/wishlist" element={<WishlistPage />} />
    <Route path="/about" element={<InfoPage page="about" />} />
    <Route path="/contact" element={<InfoPage page="contact" />} />
    <Route path="/shipping" element={<InfoPage page="shipping" />} />
    <Route path="/faq" element={<InfoPage page="faq" />} />
    <Route path="/privacy" element={<InfoPage page="privacy" />} />
    <Route path="/terms" element={<InfoPage page="terms" />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="*" element={<main className="page-shell"><div className="empty-state"><span className="eyebrow">A LITTLE DETOUR</span><h1>We can’t find that page.</h1><Link to="/" className="button button-dark">Back to Aavya <ArrowRight size={15} /></Link></div></main>} />
  </Routes>{!isAdmin && <Footer />}</>;
}
