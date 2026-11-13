import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useStore } from "../lib/store";

const links = [
  ["Home", "/"],
  ["Shop", "/shop"],
  ["Collections", "/shop"],
  ["New arrivals", "/shop?sort=new"],
  ["Our story", "/about"],
];

export function Header() {
  const cartCount = useStore((state) => state.cart.reduce((sum, item) => sum + item.quantity, 0));
  const wishlistCount = useStore((state) => state.wishlist.length);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="announcement">Complimentary delivery on orders over ₹5,000 <strong>·</strong> Thoughtfully made in India</div>
      <header className="site-header">
        <div className="header-inner">
          <button className="icon-button mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Link to="/" className="wordmark" aria-label="Aavya Studio home">
            <span>AAVYA</span><small>STUDIO</small>
          </Link>
          <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
            {links.map(([label, path]) => (
              <NavLink key={label} to={path} onClick={() => setMenuOpen(false)}>{label}</NavLink>
            ))}
            <Link to="/track" className="mobile-only-link" onClick={() => setMenuOpen(false)}>Track order</Link>
          </nav>
          <div className="header-actions">
            <Link to="/shop" className="icon-button" aria-label="Search products"><Search size={19} /></Link>
            <Link to="/account" className="icon-button" aria-label="Account"><UserRound size={18} /></Link>
            <Link to="/wishlist" className="icon-button icon-with-count" aria-label={`Wishlist, ${wishlistCount} items`}>
              <Heart size={19} />{wishlistCount > 0 && <span className="count-badge">{wishlistCount}</span>}
            </Link>
            <Link to="/cart" className="icon-button icon-with-count" aria-label={`Shopping bag, ${cartCount} items`}>
              <ShoppingBag size={19} />{cartCount > 0 && <span className="count-badge">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link to="/" className="bottom-nav-item">Home</Link>
        <Link to="/shop" className="bottom-nav-item">Discover</Link>
        <Link to="/wishlist" className="bottom-nav-item">Wishlist</Link>
        <Link to="/cart" className="bottom-nav-item">Bag</Link>
      </nav>
    </>
  );
}
