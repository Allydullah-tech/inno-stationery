<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
$method = $_SERVER['REQUEST_METHOD'];
$pdo = get_db();

// Only these keys are exposed publicly; anything else requires admin auth.
$publicKeys = ['payment_phone', 'payment_name', 'payment_method_label', 'delivery_fee', 'site_brand', 'site_tagline'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT setting_key, setting_value FROM settings');
        $all = $stmt->fetchAll();
        $isAdmin = !empty($_SESSION['admin_id']);
        $out = [];
        foreach ($all as $row) {
            if ($isAdmin || in_array($row['setting_key'], $publicKeys, true)) {
                $out[$row['setting_key']] = $row['setting_value'];
            }
        }
        json_response(['success' => true, 'settings' => $out]);
        break;

    case 'PUT':
        require_admin_auth();
        $body = read_json_body();
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
        foreach ($body as $key => $value) {
            $stmt->execute([clean_str($key), (string) $value]);
        }
        $pdo->commit();
        json_response(['success' => true, 'message' => 'Settings updated.']);
        break;

    default:
        json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}
