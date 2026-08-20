-- ============================================================
-- Migration: add payment_payer_name column
-- ============================================================
-- Run this ONCE against your existing database (phpMyAdmin's
-- SQL tab, or `mysql -P 3307 -u root -p inno_stationery < this_file.sql`).
-- Only needed if you installed the system BEFORE this update —
-- a fresh install via backend/install.php already includes this
-- column automatically.
-- ============================================================

ALTER TABLE orders
    ADD COLUMN payment_payer_name VARCHAR(120) DEFAULT NULL AFTER payment_phone;

ALTER TABLE print_requests
    ADD COLUMN payment_payer_name VARCHAR(120) DEFAULT NULL AFTER payment_phone;
