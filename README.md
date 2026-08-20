# INNO'a STATIONERY — Full Web Application

A complete stationery e-commerce + document printing system with customer
storefront, order/print tracking, and an admin panel — built with
plain HTML/CSS/JS, PHP (PDO), and MySQL.

## Folder structure

```
inno-stationery/
├── frontend/        HTML, CSS, JS (customer site + admin panel)
│   ├── index.html, products.html, checkout.html, print.html, track.html, about.html
│   ├── css/style.css, css/admin.css
│   ├── js/*.js       (customer site logic)
│   ├── admin/         admin panel pages + JS
│   └── assets/
├── backend/          PHP API
│   ├── config/        config.php, database.php
│   ├── includes/      functions.php (shared helpers)
│   ├── api/           one file per resource (products, orders, print_requests, ...)
│   ├── uploads/        product images & print documents
│   └── install.php    ONE-TIME installer (creates DB tables + first admin)
└── database/
    └── schema.sql     full MySQL schema (also used automatically by install.php)
```

## 1. Requirements

- PHP 8.0+ with the `pdo_mysql` extension
- MySQL 5.7+ / MariaDB 10.3+
- Any web server (Apache/Nginx) with PHP support, e.g. XAMPP/WAMP/MAMP locally

## 2. Setup

1. Create an empty MySQL database, e.g. `inno_stationery`.
2. Open `backend/config/database.php` and set your `DB_HOST`, `DB_NAME`,
   `DB_USER`, `DB_PASS` (or set them as environment variables).
3. Point your web server's document root at the `inno-stationery/` folder
   (so `frontend/` and `backend/` are siblings — this matters because the
   frontend calls the API at `/backend/api/...`).
4. Visit **`https://yourdomain.com/backend/install.php`** in your browser.
   This is the ONLY way to create an admin account — there is no public
   sign-up page. Fill in your name, username, email, password, and two
   security questions (used later to reset your password), then submit.
5. Once installed, the installer locks itself (`backend/install.lock`).
   For extra safety, delete or rename `backend/install.php` afterwards.
6. Go to **`frontend/admin/login.html`** and log in with the account you
   just created.

## 3. Using the system

- **Customers** browse `frontend/index.html` / `products.html`, add items
  to their cart, and check out. Choosing **delivery** opens a payment modal
  showing the shop's payment number/name (editable by an admin under
  *Settings*) and asks for a payment reference before the order is placed.
  Choosing **pickup** skips payment entirely.
- **Print requests** work the same way via `frontend/print.html` — customers
  upload a document, choose print options, and pay only if they want delivery.
- Every order/print request gets a short tracking code (e.g. `ORD-7F3K2Q`,
  `PRT-4M2QK9`). Customers can check status any time on `frontend/track.html`
  using that code + their phone number.
- **Admins** manage everything from `frontend/admin/dashboard.html`:
  products & categories, orders (status + payment verification), print
  requests (status, cost, payment verification), other admin accounts, and
  site settings (payment info, delivery fee).
- Any logged-in admin can add another admin from the *Admins* page. Only a
  **super admin** (the first account created by the installer) can
  deactivate other admins.
- Forgot a password? Use `frontend/admin/forgot-password.html` — it asks
  the two security questions set up for that account and lets you set a
  new password, no email server required.

## 4. Security notes

- `backend/install.php` locks itself after first use; delete it once you're
  done for extra safety.
- `backend/config/` and `backend/uploads/` both ship with `.htaccess` files
  that block direct script execution / config access on Apache. If you're
  on Nginx, add equivalent rules.
- All admin API endpoints check for an authenticated session
  (`require_admin_auth()` / `require_super_admin()` in
  `backend/includes/functions.php`).
- Passwords and security-question answers are hashed with `password_hash()`
  — never stored in plain text.

## 5. Customizing

- Payment number/name/delivery fee: **Admin → Settings** (defaults to
  `0620 839 640`, Yahya Juma Is-haka).
- Brand colours/fonts: `frontend/css/style.css` (CSS variables at the top).
- Categories: seeded in `database/schema.sql`, editable from
  **Admin → Products → Categories**.
