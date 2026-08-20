-- ============================================================
-- Migration: add issue resolution flow (admin response +
-- customer acknowledgement)
-- ============================================================
-- Run this ONCE against your live database (phpMyAdmin's SQL
-- tab, or via your hosting's database tool). Only needed if you
-- installed the system BEFORE this update — a fresh install via
-- backend/install.php already includes this automatically.
-- ============================================================

ALTER TABLE orders
    MODIFY COLUMN customer_confirmed ENUM('pending','received','issue_reported','issue_resolved') NOT NULL DEFAULT 'pending',
    ADD COLUMN admin_response TEXT DEFAULT NULL AFTER customer_comment;

ALTER TABLE print_requests
    MODIFY COLUMN customer_confirmed ENUM('pending','received','issue_reported','issue_resolved') NOT NULL DEFAULT 'pending',
    ADD COLUMN admin_response TEXT DEFAULT NULL AFTER customer_comment;
