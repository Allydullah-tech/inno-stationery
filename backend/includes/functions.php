<?php
/**
 * INNO'a STATIONERY - Shared helper functions
 */

/** Send a JSON response and stop execution. */
function json_response(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/** Send standard CORS + JSON headers. Call at the top of every api file. */
function send_api_headers(): void
{
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Read JSON body of a request into an associative array. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Basic string sanitizer for output/storage. */
function clean_str($value): string
{
    return trim(htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'));
}

/** Generate a short, human-friendly unique tracking code, e.g. ORD-7F3K2Q */
function generate_tracking_code(string $prefix = 'ORD'): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0/O, 1/I)
    $code = '';
    for ($i = 0; $i < 6; $i++) {
        $code .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $prefix . '-' . $code;
}

/** Validate a Tanzanian-style phone number loosely (07xxxxxxxx or +2557xxxxxxxx). */
function is_valid_phone(string $phone): bool
{
    $digits = preg_replace('/\D/', '', $phone);
    return strlen($digits) >= 9 && strlen($digits) <= 13;
}

/** Require the current session to belong to a logged-in admin. Halts with 401 otherwise. */
function require_admin_auth(): array
{
    if (empty($_SESSION['admin_id'])) {
        json_response(['success' => false, 'message' => 'Not authenticated. Please log in.'], 401);
    }
    return [
        'id' => $_SESSION['admin_id'],
        'username' => $_SESSION['admin_username'] ?? '',
        'role' => $_SESSION['admin_role'] ?? 'admin',
    ];
}

/** Require the logged-in admin to be a super_admin. */
function require_super_admin(): array
{
    $admin = require_admin_auth();
    if ($admin['role'] !== 'super_admin') {
        json_response(['success' => false, 'message' => 'Only a super admin can perform this action.'], 403);
    }
    return $admin;
}

/** Fetch a setting value by key, with optional default. */
function get_setting(string $key, string $default = ''): string
{
    $pdo = get_db();
    $stmt = $pdo->prepare('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['setting_value'] : $default;
}

/** Handle a single uploaded file: validate + move it. Returns [storedName, error]. */
function handle_upload(array $file, string $destDir, array $allowedExt, int $maxBytes): array
{
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        return [null, 'Upload failed. Please try again.'];
    }
    if ($file['size'] > $maxBytes) {
        return [null, 'File is too large. Maximum size is ' . round($maxBytes / 1024 / 1024) . 'MB.'];
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        return [null, 'File type not allowed. Allowed types: ' . implode(', ', $allowedExt)];
    }
    if (!is_dir($destDir)) {
        mkdir($destDir, 0755, true);
    }
    $storedName = uniqid('f_', true) . '.' . $ext;
    $destPath = $destDir . $storedName;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        return [null, 'Could not save uploaded file.'];
    }
    return [$storedName, null];
}
