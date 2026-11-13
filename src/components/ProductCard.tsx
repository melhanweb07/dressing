import { Heart, ShoppingBag } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Product } from "../types";
import { useStore } from "../lib/store";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const saved = useStore((state) => state.wishlist.includes(product.id));
  const toggleWishlist = useStore((state) => state.toggleWishlist);
  const addToCart = useStore((state) => state.addToCart);
  const reduceMotion = useReducedMotion();
  const outOfStock = product.stock < 1;

  return (
    <motion.article
      className="product-card"
      initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45, delay: reduceMotion ? 0 : (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="product-image-wrap">
        <Link to={`/product/${product.id}`} className="product-image-link" aria-label={`View ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>
        {product.isNew && <span className="product-tag">Just arrived</span>}
        {outOfStock && <span className="product-tag sold-out-tag">Sold out</span>}
        <button className={`wishlist-button ${saved ? "is-saved" : ""}`} onClick={() => toggleWishlist(product.id)} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <button className="quick-add" disabled={outOfStock} onClick={() => addToCart(product, product.sizes[0], product.colors[0])}>
          <ShoppingBag size={15} /> {outOfStock ? "Sold out" : "Quick add"}
        </button>
      </div>
      <div className="product-info">
        <span className="eyebrow">{product.category}</span>
        <Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>
        <div className="product-price"><span>₹{product.price.toLocaleString("en-IN")}</span><del>₹{product.originalPrice.toLocaleString("en-IN")}</del></div>
      </div>
    </motion.article>
  );
}
