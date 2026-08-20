<?php
/**
 * Public order/print-request tracking.
 *
 * Supports two lookup modes so the customer only needs ONE piece of info:
 *   ?code=ORD-XXXXXX   -> looks up that single order/print request by code alone
 *   ?phone=07XXXXXXXX  -> looks up ALL orders + print requests for that phone number
 * If both are given, code takes priority (still works as before).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
$pdo = get_db();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}

function order_out(PDO $pdo, array $order): array
{
    $items = $pdo->prepare('SELECT product_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ?');
    $items->execute([$order['id']]);
    $order['items'] = $items->fetchAll();
    $order['subtotal'] = (float) $order['subtotal'];
    $order['delivery_fee'] = (float) $order['delivery_fee'];
    $order['total_amount'] = (float) $order['total_amount'];
    $order['record_type'] = 'order';
    return $order;
}

function print_out(array $req): array
{
    $req['estimated_cost'] = $req['estimated_cost'] !== null ? (float) $req['estimated_cost'] : null;
    $req['total_amount'] = $req['total_amount'] !== null ? (float) $req['total_amount'] : null;
    $req['delivery_fee'] = (float) $req['delivery_fee'];
    $req['record_type'] = 'print_request';
    return $req;
}

$code = strtoupper(trim($_GET['code'] ?? ''));
$phone = trim($_GET['phone'] ?? '');

if ($code === '' && $phone === '') {
    json_response(['success' => false, 'message' => 'Please provide your tracking code or phone number.'], 400);
}

// ---------------------------------------------------------
// Mode 1: lookup by tracking code alone (code is unique + hard to guess)
// ---------------------------------------------------------
if ($code !== '') {
    if (str_starts_with($code, 'ORD-')) {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_code = ? LIMIT 1');
        $stmt->execute([$code]);
        $order = $stmt->fetch();
        if (!$order) {
            json_response(['success' => false, 'message' => 'No order found with that tracking code.'], 404);
        }
        json_response(['success' => true, 'type' => 'order', 'record' => order_out($pdo, $order)]);
    } elseif (str_starts_with($code, 'PRT-')) {
        $stmt = $pdo->prepare('SELECT * FROM print_requests WHERE request_code = ? LIMIT 1');
        $stmt->execute([$code]);
        $req = $stmt->fetch();
        if (!$req) {
            json_response(['success' => false, 'message' => 'No print request found with that tracking code.'], 404);
        }
        json_response(['success' => true, 'type' => 'print_request', 'record' => print_out($req)]);
    } else {
        json_response(['success' => false, 'message' => 'Invalid tracking code format. It should start with ORD- or PRT-.'], 400);
    }
}

// ---------------------------------------------------------
// Mode 2: lookup by phone alone -> return every matching order + print request
// ---------------------------------------------------------
if (!is_valid_phone($phone)) {
    json_response(['success' => false, 'message' => 'Please enter a valid phone number.'], 400);
}

$orderStmt = $pdo->prepare('SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC');
$orderStmt->execute([$phone]);
$orders = array_map(fn($o) => order_out($pdo, $o), $orderStmt->fetchAll());

$printStmt = $pdo->prepare('SELECT * FROM print_requests WHERE phone = ? ORDER BY created_at DESC');
$printStmt->execute([$phone]);
$prints = array_map('print_out', $printStmt->fetchAll());

$all = array_merge($orders, $prints);
usort($all, fn($a, $b) => strtotime($b['created_at']) <=> strtotime($a['created_at']));

if (!$all) {
    json_response(['success' => false, 'message' => 'No orders or print requests found for that phone number.'], 404);
}

json_response(['success' => true, 'type' => 'list', 'records' => $all]);
