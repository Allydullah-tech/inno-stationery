<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
$method = $_SERVER['REQUEST_METHOD'];
$pdo = get_db();

function print_row_out(array $row): array
{
    $row['file_url'] = UPLOAD_URL_PRINTDOCS . $row['file_path'];
    $row['estimated_cost'] = $row['estimated_cost'] !== null ? (float) $row['estimated_cost'] : null;
    $row['delivery_fee'] = (float) $row['delivery_fee'];
    $row['total_amount'] = $row['total_amount'] !== null ? (float) $row['total_amount'] : null;
    return $row;
}

switch ($method) {

    // ---------------------------------------------------------
    // Admin: list all print requests
    case 'GET':
        require_admin_auth();
        $where = [];
        $params = [];
        if (!empty($_GET['status'])) {
            $where[] = 'status = ?';
            $params[] = $_GET['status'];
        }
        $sql = 'SELECT * FROM print_requests';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = array_map('print_row_out', $stmt->fetchAll());
        json_response(['success' => true, 'print_requests' => $rows]);
        break;

    // ---------------------------------------------------------
    // Customer: submit a new print request (public, multipart/form-data)
    case 'POST':
        $customerName = trim($_POST['customer_name'] ?? '');
        $phone = trim($_POST['phone'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $copies = max(1, (int) ($_POST['copies'] ?? 1));
        $colorMode = ($_POST['color_mode'] ?? 'black_white') === 'color' ? 'color' : 'black_white';
        $paperSize = in_array($_POST['paper_size'] ?? 'A4', ['A4', 'A3', 'Letter', 'Legal'], true) ? $_POST['paper_size'] : 'A4';
        $doubleSided = !empty($_POST['double_sided']) ? 1 : 0;
        $binding = in_array($_POST['binding'] ?? 'none', ['none', 'stapled', 'spiral'], true) ? $_POST['binding'] : 'none';
        $instructions = trim($_POST['instructions'] ?? '');
        $fulfillment = ($_POST['fulfillment_type'] ?? 'pickup') === 'delivery' ? 'delivery' : 'pickup';
        $address = trim($_POST['address'] ?? '');

        if ($customerName === '' || !is_valid_phone($phone)) {
            json_response(['success' => false, 'message' => 'Please provide your name and a valid phone number.'], 400);
        }
        if (empty($_FILES['document']['name'])) {
            json_response(['success' => false, 'message' => 'Please attach the document you want printed.'], 400);
        }
        if ($fulfillment === 'delivery' && $address === '') {
            json_response(['success' => false, 'message' => 'Delivery requests require an address.'], 400);
        }

        [$storedName, $err] = handle_upload($_FILES['document'], UPLOAD_DIR_PRINTDOCS, ALLOWED_PRINT_EXT, MAX_UPLOAD_BYTES);
        if ($err) {
            json_response(['success' => false, 'message' => $err], 400);
        }

        // Printing cost isn't known upfront (unlike product prices), so no
        // payment is collected here — payment_status stays "not_required"
        // until an admin sets a cost, at which point it becomes
        // "awaiting_payment" for delivery requests (see the PUT handler below).
        $deliveryFee = $fulfillment === 'delivery' ? (float) get_setting('delivery_fee', '0') : 0.0;
        $requestCode = generate_tracking_code('PRT');

        $stmt = $pdo->prepare('INSERT INTO print_requests
            (request_code, customer_name, phone, email, file_path, original_file_name, file_size, copies, color_mode, paper_size, double_sided, binding, instructions, fulfillment_type, address, delivery_fee)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $requestCode, $customerName, $phone, $email ?: null,
            $storedName, $_FILES['document']['name'], $_FILES['document']['size'],
            $copies, $colorMode, $paperSize, $doubleSided, $binding, $instructions ?: null,
            $fulfillment, $address ?: null, $deliveryFee,
        ]);

        json_response([
            'success' => true,
            'message' => 'Print request submitted! We will review your document and confirm the cost shortly.',
            'request_code' => $requestCode,
        ], 201);
        break;

    // ---------------------------------------------------------
    // Admin: update status / set estimated cost / verify payment
    case 'PUT':
        require_admin_auth();
        $body = read_json_body();
        $id = (int) ($body['id'] ?? 0);
        if (!$id) {
            json_response(['success' => false, 'message' => 'Missing id.'], 400);
        }

        $fields = [];
        $params = [];
        $validStatus = ['received', 'printing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
        $validPayment = ['not_required', 'awaiting_payment', 'pending_verification', 'verified', 'rejected'];

        if (isset($body['status']) && in_array($body['status'], $validStatus, true)) {
            $fields[] = 'status = ?';
            $params[] = $body['status'];
        }
        if (isset($body['payment_status']) && in_array($body['payment_status'], $validPayment, true)) {
            $fields[] = 'payment_status = ?';
            $params[] = $body['payment_status'];
        }
        if (isset($body['admin_response'])) {
            $fields[] = 'admin_response = ?';
            $params[] = trim($body['admin_response']) ?: null;
        }
        if (isset($body['estimated_cost'])) {
            $cost = (float) $body['estimated_cost'];
            $fields[] = 'estimated_cost = ?';
            $params[] = $cost;
            // total = cost + delivery fee already on record
            $row = $pdo->prepare('SELECT delivery_fee, fulfillment_type, payment_status FROM print_requests WHERE id = ?');
            $row->execute([$id]);
            $current = $row->fetch();
            $deliveryFee = (float) ($current['delivery_fee'] ?? 0);
            $fields[] = 'total_amount = ?';
            $params[] = $cost + $deliveryFee;

            // Once a cost is set on a delivery request, the customer needs to pay —
            // move it to "awaiting_payment" automatically (unless payment already
            // started/finished, or the admin explicitly set payment_status above).
            if (
                $current
                && $current['fulfillment_type'] === 'delivery'
                && $current['payment_status'] === 'not_required'
                && !isset($body['payment_status'])
            ) {
                $fields[] = 'payment_status = ?';
                $params[] = 'awaiting_payment';
            }
        }

        if (!$fields) {
            json_response(['success' => false, 'message' => 'Nothing to update.'], 400);
        }

        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE print_requests SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);

        json_response(['success' => true, 'message' => 'Print request updated.']);
        break;

    default:
        json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}
