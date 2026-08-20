<?php
/**
 * INNO's STATIONERY - Site configuration
 * Adjust these constants to match your server / hosting setup.
 */

// ---- Error display (turn off in production) ----
error_reporting(E_ALL);
ini_set('display_errors', '0'); // never leak PHP errors to the browser
ini_set('log_errors', '1');

// ---- Session ----
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ---- CORS (same-origin by default; adjust ALLOWED_ORIGIN if frontend is hosted elsewhere) ----
define('ALLOWED_ORIGIN', '*'); // change to your domain in production, e.g. https://innoastationery.com

// ---- Paths ----
define('BACKEND_ROOT', dirname(__DIR__));
define('UPLOAD_DIR_PRODUCTS', BACKEND_ROOT . '/uploads/products/');
define('UPLOAD_DIR_PRINTDOCS', BACKEND_ROOT . '/uploads/print_docs/');

// Work out the public URL of the "backend" folder from the actual request,
// instead of assuming the site lives at the domain root. This makes uploaded
// image/file URLs work correctly whether the site is at https://example.com/
// or https://example.com/some-subfolder/ (e.g. a local /inno-stationery/ install).
if (!empty($_SERVER['SCRIPT_NAME'])) {
    // SCRIPT_NAME for a request to .../backend/api/products.php looks like
    // "/inno-stationery/backend/api/products.php" (or "/backend/api/products.php"
    // at the domain root) — going up two directories gives the "backend" folder.
    $backendUrlBase = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
} else {
    $backendUrlBase = '/backend';
}
define('UPLOAD_URL_PRODUCTS', $backendUrlBase . '/uploads/products/');
define('UPLOAD_URL_PRINTDOCS', $backendUrlBase . '/uploads/print_docs/');

// ---- Upload limits ----
define('MAX_UPLOAD_BYTES', 20 * 1024 * 1024); // 20MB
define('ALLOWED_PRINT_EXT', ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']);
define('ALLOWED_IMAGE_EXT', ['jpg', 'jpeg', 'png', 'webp']);

// ---- Brand ----
define('SITE_BRAND', "INNO's STATIONERY");
