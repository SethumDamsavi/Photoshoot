# e-Globe Showcase — Connected to WordPress & WooCommerce Backend

A modern, high-performance catalog interface dynamically connected to a **WordPress & WooCommerce** backend running in LocalWP at `http://localhost:10004`.

**Zero hardcoded products on the frontend** — whenever you add, update, or remove products in your WordPress Admin, they immediately reflect on this page!

---

## 🔌 Backend Architecture

- **WordPress Site (LocalWP):** `http://localhost:10004`
- **WooCommerce Store API Endpoint:** `http://localhost:10004/wp-json/wc/store/products`
- **Categories Endpoint:** `http://localhost:10004/wp-json/wc/store/products/categories`
- **WordPress Admin:** [http://localhost:10004/wp-admin/](http://localhost:10004/wp-admin/)
- **Vite Proxy:** Configured in `vite.config.js` to eliminate CORS constraints and proxy `/wp-json` & `/wp-content`.

---

## ✨ Features

- **Live Dynamic Products**:
  - Automatically fetches all products from WooCommerce.
  - Displays real prices (in Sri Lankan Rupees `රු`), sale discounts, stock status, and product images from `wp-content/uploads`.
  - Full specifications and attributes (Brand, Warranty, Capacity, Speed, Form Factor) loaded dynamically.

- **Dynamic Category Tabs**:
  - Category tabs are built directly from WooCommerce product categories (`Laptops`, `Desktops`, `Monitors`, `Deals`, `Graphic Card`, `Storage`, etc.).
  - Real-time item count badges per category.

- **Real-Time Backend Status**:
  - Live status indicator pill in the header showing connection state to `localhost:10004`.
  - **Sync Backend** button to refresh live products on demand with one click.
  - Direct links to **WP Admin** and **View Cart**.

- **Editorial Pink & White Theme**:
  - Soft porcelain rosewater canvas (`#fff8fa`), brilliant white cards, and French Peony pink accents (`#de4b75`).
  - High-contrast typography with Cormorant Garamond & Plus Jakarta Sans.

- **Interactive Product Modal**:
  - Full-screen product showcase modal with technical specifications grid, high-res images, and direct "View & Order on Store" link to the WordPress product page.

---

## 🚀 How to Add & Edit Products in the Backend

1. Open your **LocalWP** application and make sure the site **Eglobe** is running.
2. Click **WP Admin** in the header or go to:
   [http://localhost:10004/wp-admin/](http://localhost:10004/wp-admin/)
3. Go to **Products > Add New**:
   - Enter Product Name, Price, and Sale Price.
   - Assign Category (e.g. *Laptops*, *Desktops*, *Monitors*).
   - Set Product Image.
   - Add Specifications under **Attributes**.
4. Click **Publish**.
5. Switch to this page ([http://localhost:5173/](http://localhost:5173/)) and click **Sync Backend** — your new product will appear automatically!
