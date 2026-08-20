-- ============================================================
-- INNO's STATIONERY - Database Schema
-- ============================================================
-- This file is executed automatically by backend/install.php.
-- You normally do NOT need to run it by hand, but it is kept
-- here for reference / manual setup.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Admins (created manually via install.php, never self-signup)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    username VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin','admin') NOT NULL DEFAULT 'admin',
    security_question_1 VARCHAR(255) NOT NULL,
    security_answer_1 VARCHAR(255) NOT NULL,
    security_question_2 VARCHAR(255) NOT NULL,
    security_answer_2 VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    icon VARCHAR(50) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED DEFAULT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    image VARCHAR(255) DEFAULT NULL,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Orders (product purchases)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150) DEFAULT NULL,
    fulfillment_type ENUM('delivery','pickup') NOT NULL DEFAULT 'pickup',
    address TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('not_required','pending_verification','verified','rejected') NOT NULL DEFAULT 'not_required',
    payment_reference VARCHAR(120) DEFAULT NULL,
    payment_phone VARCHAR(30) DEFAULT NULL,
    payment_payer_name VARCHAR(120) DEFAULT NULL,
    status ENUM('pending','confirmed','processing','ready','out_for_delivery','completed','cancelled') NOT NULL DEFAULT 'pending',
    customer_confirmed ENUM('pending','received','issue_reported','issue_resolved') NOT NULL DEFAULT 'pending',
    customer_comment TEXT DEFAULT NULL,
    admin_response TEXT DEFAULT NULL,
    customer_rating TINYINT UNSIGNED DEFAULT NULL,
    customer_confirmed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED DEFAULT NULL,
    product_name VARCHAR(150) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    line_total DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Print requests (customers upload documents to be printed)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_code VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150) DEFAULT NULL,
    file_path VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    file_size INT DEFAULT NULL,
    copies INT NOT NULL DEFAULT 1,
    color_mode ENUM('black_white','color') NOT NULL DEFAULT 'black_white',
    paper_size ENUM('A4','A3','Letter','Legal') NOT NULL DEFAULT 'A4',
    double_sided TINYINT(1) NOT NULL DEFAULT 0,
    binding ENUM('none','stapled','spiral') NOT NULL DEFAULT 'none',
    instructions TEXT DEFAULT NULL,
    fulfillment_type ENUM('delivery','pickup') NOT NULL DEFAULT 'pickup',
    address TEXT DEFAULT NULL,
    estimated_cost DECIMAL(12,2) DEFAULT NULL,
    delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) DEFAULT NULL,
    payment_status ENUM('not_required','awaiting_payment','pending_verification','verified','rejected') NOT NULL DEFAULT 'not_required',
    payment_reference VARCHAR(120) DEFAULT NULL,
    payment_phone VARCHAR(30) DEFAULT NULL,
    payment_payer_name VARCHAR(120) DEFAULT NULL,
    status ENUM('received','printing','ready','out_for_delivery','completed','cancelled') NOT NULL DEFAULT 'received',
    customer_confirmed ENUM('pending','received','issue_reported','issue_resolved') NOT NULL DEFAULT 'pending',
    customer_comment TEXT DEFAULT NULL,
    admin_response TEXT DEFAULT NULL,
    customer_rating TINYINT UNSIGNED DEFAULT NULL,
    customer_confirmed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Site settings (editable key/value store, e.g. payment info)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
    setting_value TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Password reset attempts log (basic brute-force throttling)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    success TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Default settings (payment details as requested)
-- ------------------------------------------------------------
INSERT INTO settings (setting_key, setting_value) VALUES
    ('payment_phone', '0620839640'),
    ('payment_name', "Yahya Juma Is-haka"),
    ('payment_method_label', 'Mobile Money (M-Pesa / Tigo Pesa / Airtel Money)'),
    ('delivery_fee', '2000'),
    ('site_brand', "INNO's STATIONERY"),
    ('site_tagline', 'Everything you need to write, print & create.')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ------------------------------------------------------------
-- Starter categories
-- ------------------------------------------------------------
INSERT INTO categories (name, slug, icon) VALUES
    ('Books & Notebooks', 'books-notebooks', 'book'),
    ('Pens & Pencils', 'pens-pencils', 'pen'),
    ('Files & Folders', 'files-folders', 'folder'),
    ('Art & Craft', 'art-craft', 'palette'),
    ('Office Supplies', 'office-supplies', 'briefcase'),
    ('School Supplies', 'school-supplies', 'graduation-cap')
ON DUPLICATE KEY UPDATE slug = slug;
