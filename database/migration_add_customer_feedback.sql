-- ============================================================
-- Migration: add customer confirmation & feedback columns
-- ============================================================
-- Run this ONCE against your existing database (phpMyAdmin's
-- SQL tab, or `mysql -h 127.0.0.1 -P 3307 -u root -p inno_stationery < this_file.sql`).
-- Only needed if you installed the system BEFORE this update —
-- a fresh install via backend/install.php already includes these
-- columns automatically.
-- ============================================================

ALTER TABLE orders
    ADD COLUMN customer_confirmed ENUM('pending','received','issue_reported') NOT NULL DEFAULT 'pending' AFTER status,
    ADD COLUMN customer_comment TEXT DEFAULT NULL AFTER customer_confirmed,
    ADD COLUMN customer_rating TINYINT UNSIGNED DEFAULT NULL AFTER customer_comment,
    ADD COLUMN customer_confirmed_at DATETIME DEFAULT NULL AFTER customer_rating;

ALTER TABLE print_requests
    ADD COLUMN customer_confirmed ENUM('pending','received','issue_reported') NOT NULL DEFAULT 'pending' AFTER status,
    ADD COLUMN customer_comment TEXT DEFAULT NULL AFTER customer_confirmed,
    ADD COLUMN customer_rating TINYINT UNSIGNED DEFAULT NULL AFTER customer_comment,
    ADD COLUMN customer_confirmed_at DATETIME DEFAULT NULL AFTER customer_rating;

-- Print requests now collect payment AFTER the shop sets a cost (printing
-- cost isn't known upfront the way product prices are), so payment_status
-- needs a new "awaiting_payment" state.
ALTER TABLE print_requests
    MODIFY COLUMN payment_status ENUM('not_required','awaiting_payment','pending_verification','verified','rejected') NOT NULL DEFAULT 'not_required';
