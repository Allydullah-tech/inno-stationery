<?php
/**
 * Customer confirmation & feedback, submitted from the tracking page.
 *
 * Two-stage flow:
 *   Stage 1 (once completed): confirmed = 'received' | 'issue_reported'
 *   Stage 2 (only after an issue was reported and the shop responded):
 *            confirmed = 'issue_resolved' — customer acknowledging the fix
 *
 * POST body: { code, phone, confirmed, comment?, rating? }
 *
 * Requires BOTH code and phone (unlike track.php's read-only lookup,
 * which allows either alone) since this is a write action and needs
 * a stronger check that the person submitting it actually placed the order.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
$pdo = get_db();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$body = read_json_body();
$code = strtoupper(trim($body['code'] ?? ''));
$phone = trim($body['phone'] ?? '');
$confirmed = $body['confirmed'] ?? '';
$comment = trim($body['comment'] ?? '');
$rating = isset($body['rating']) ? (int) $body['rating'] : null;

if ($code === '' || $phone === '') {
    json_response(['success' => false, 'message' => 'Missing tracking code or phone number.'], 400);
}
if (!in_array($confirmed, ['received', 'issue_reported', 'issue_resolved'], true)) {
    json_response(['success' => false, 'message' => 'Invalid confirmation type.'], 400);
}
if ($rating !== null && ($rating < 1 || $rating > 5)) {
    json_response(['success' => false, 'message' => 'Rating must be between 1 and 5.'], 400);
}
if (mb_strlen($comment) > 1000) {
    json_response(['success' => false, 'message' => 'Comment is too long (max 1000 characters).'], 400);
}

$table = null;
$codeColumn = null;
if (str_starts_with($code, 'ORD-')) {
    $table = 'orders';
    $codeColumn = 'order_code';
} elseif (str_starts_with($code, 'PRT-')) {
    $table = 'print_requests';
    $codeColumn = 'request_code';
} else {
    json_response(['success' => false, 'message' => 'Invalid tracking code format.'], 400);
}

$stmt = $pdo->prepare("SELECT id, status, customer_confirmed FROM $table WHERE $codeColumn = ? AND phone = ? LIMIT 1");
$stmt->execute([$code, $phone]);
$record = $stmt->fetch();

if (!$record) {
    json_response(['success' => false, 'message' => 'No matching order found. Check your code and phone number.'], 404);
}
if ($record['status'] !== 'completed') {
    json_response(['success' => false, 'message' => 'This can only be confirmed once the order is marked completed.'], 400);
}

if ($confirmed === 'issue_resolved') {
    // Stage 2: customer acknowledging the shop's fix. Only valid from issue_reported.
    if ($record['customer_confirmed'] !== 'issue_reported') {
        json_response(['success' => false, 'message' => 'This order has no open issue to resolve.'], 409);
    }
    $update = $pdo->prepare("UPDATE $table SET customer_confirmed = 'issue_resolved', customer_confirmed_at = NOW() WHERE id = ?");
    $update->execute([$record['id']]);
    json_response(['success' => true, 'message' => "Thank you for confirming! We're glad it's sorted out."]);
}

// Stage 1: initial confirmation, only valid from pending.
if ($record['customer_confirmed'] !== 'pending') {
    json_response(['success' => false, 'message' => 'You have already responded to this order. Thank you!'], 409);
}

$update = $pdo->prepare("UPDATE $table SET customer_confirmed = ?, customer_comment = ?, customer_rating = ?, customer_confirmed_at = NOW() WHERE id = ?");
$update->execute([$confirmed, $comment ?: null, $rating, $record['id']]);

json_response([
    'success' => true,
    'message' => $confirmed === 'received'
        ? 'Thank you for confirming! We appreciate your feedback.'
        : "We're sorry to hear that. Our team has been notified and will get back to you as soon as possible.",
]);
