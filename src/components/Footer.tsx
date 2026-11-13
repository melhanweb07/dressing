import { ArrowUpRight, Instagram, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="wordmark footer-wordmark"><span>AAVYA</span><small>STUDIO</small></Link>
          <p>Clothes for the little moments<br />and the ones you remember.</p>
          <a className="social-link" href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={16} /> Follow our story <ArrowUpRight size={14} /></a>
        </div>
        <div className="footer-col"><h3>Explore</h3><Link to="/shop">Shop all</Link><Link to="/shop?sort=new">New arrivals</Link><Link to="/about">Our story</Link><Link to="/contact">Get in touch</Link></div>
        <div className="footer-col"><h3>Here to help</h3><Link to="/track">Track your order</Link><Link to="/shipping">Shipping & returns</Link><Link to="/faq">Frequently asked</Link><Link to="/privacy">Privacy policy</Link></div>
        <div className="footer-newsletter"><h3>A note from us</h3><p>New collections and thoughtful stories, delivered gently.</p><form onSubmit={(event) => { event.preventDefault(); window.alert("Thank you for joining our list."); }}><label className="sr-only" htmlFor="newsletter-email">Your email address</label><input id="newsletter-email" type="email" placeholder="Your email address" required /><button aria-label="Subscribe"><Mail size={17} /></button></form></div>
      </div>
      <div className="footer-bottom"><span>© 2025 Aavya Studio. Made with care.</span><span>Thoughtful Indian wear, made for you.</span></div>
    </footer>
  );
}
