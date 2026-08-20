<?php
/**
 * Customer submits payment details for a print request, once the shop has
 * reviewed the document and set a cost (payment_status = 'awaiting_payment').
 *
 * POST body: { request_code, phone, payment_reference, payment_phone, payment_payer_name }
 * Requires BOTH code and phone, same reasoning as feedback.php — this is a
 * write action and needs a stronger identity check than read-only tracking.
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
$code = strtoupper(trim($body['request_code'] ?? ''));
$phone = trim($body['phone'] ?? '');
$paymentReference = trim($body['payment_reference'] ?? '');
$paymentPhone = trim($body['payment_phone'] ?? '');
$paymentPayerName = trim($body['payment_payer_name'] ?? '');

if ($code === '' || $phone === '') {
    json_response(['success' => false, 'message' => 'Missing tracking code or phone number.'], 400);
}
if ($paymentReference === '' || $paymentPhone === '' || $paymentPayerName === '') {
    json_response(['success' => false, 'message' => 'Please provide the payer name, payment phone, and transaction ID.'], 400);
}

$stmt = $pdo->prepare('SELECT id, payment_status FROM print_requests WHERE request_code = ? AND phone = ? LIMIT 1');
$stmt->execute([$code, $phone]);
$record = $stmt->fetch();

if (!$record) {
    json_response(['success' => false, 'message' => 'No matching print request found. Check your code and phone number.'], 404);
}
if ($record['payment_status'] !== 'awaiting_payment') {
    json_response(['success' => false, 'message' => 'This print request is not currently awaiting payment.'], 400);
}

$update = $pdo->prepare('UPDATE print_requests
    SET payment_status = "pending_verification", payment_reference = ?, payment_phone = ?, payment_payer_name = ?
    WHERE id = ?');
$update->execute([$paymentReference, $paymentPhone, $paymentPayerName, $record['id']]);

json_response(['success' => true, 'message' => 'Payment submitted! We will verify it and get your printing moving.']);
