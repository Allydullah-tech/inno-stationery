<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
$method = $_SERVER['REQUEST_METHOD'];
$pdo = get_db();

function order_row_out(PDO $pdo, array $order): array
{
    $stmt = $pdo->prepare('SELECT product_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ?');
    $stmt->execute([$order['id']]);
    $order['items'] = $stmt->fetchAll();
    $order['subtotal'] = (float) $order['subtotal'];
    $order['delivery_fee'] = (float) $order['delivery_fee'];
    $order['total_amount'] = (float) $order['total_amount'];
    return $order;
}

switch ($method) {

    // ---------------------------------------------------------
    // Admin: list all orders (optionally filter by status)
    case 'GET':
        require_admin_auth();
        $where = [];
        $params = [];
        if (!empty($_GET['status'])) {
            $where[] = 'status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['payment_status'])) {
            $where[] = 'payment_status = ?';
            $params[] = $_GET['payment_status'];
        }
        $sql = 'SELECT * FROM orders';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = array_map(fn($o) => order_row_out($pdo, $o), $stmt->fetchAll());
        json_response(['success' => true, 'orders' => $orders]);
        break;

    // ---------------------------------------------------------
    // Customer: place a new order (public)
    case 'POST':
        $body = read_json_body();

        $customerName = trim($body['customer_name'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $email = trim($body['email'] ?? '');
        $fulfillment = ($body['fulfillment_type'] ?? 'pickup') === 'delivery' ? 'delivery' : 'pickup';
        $address = trim($body['address'] ?? '');
        $notes = trim($body['notes'] ?? '');
        $items = $body['items'] ?? [];
        $paymentReference = trim($body['payment_reference'] ?? '');
        $paymentPhone = trim($body['payment_phone'] ?? '');
        $paymentPayerName = trim($body['payment_payer_name'] ?? '');

        if ($customerName === '' || !is_valid_phone($phone)) {
            json_response(['success' => false, 'message' => 'Please provide your name and a valid phone number.'], 400);
        }
        if (!is_array($items) || count($items) === 0) {
            json_response(['success' => false, 'message' => 'Your cart is empty.'], 400);
        }
        if ($fulfillment === 'delivery' && ($address === '' || $paymentReference === '' || $paymentPayerName === '' || $paymentPhone === '')) {
            json_response(['success' => false, 'message' => 'Delivery orders require an address and full payment details (payer name, payment phone, and transaction ID).'], 400);
        }

        // Validate products & compute totals server-side (never trust client prices)
        $subtotal = 0.0;
        $validatedItems = [];
        foreach ($items as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $qty = max(1, (int) ($item['quantity'] ?? 1));
            $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ? AND status = "active" LIMIT 1');
            $stmt->execute([$pid]);
            $product = $stmt->fetch();
            if (!$product) {
                json_response(['success' => false, 'message' => 'One of the items in your cart is no longer available.'], 400);
            }
            $lineTotal = $product['price'] * $qty;
            $subtotal += $lineTotal;
            $validatedItems[] = [
                'product_id' => $product['id'],
                'product_name' => $product['name'],
                'unit_price' => $product['price'],
                'quantity' => $qty,
                'line_total' => $lineTotal,
            ];
        }

        $deliveryFee = $fulfillment === 'delivery' ? (float) get_setting('delivery_fee', '0') : 0.0;
        $total = $subtotal + $deliveryFee;
        $paymentStatus = $fulfillment === 'delivery' ? 'pending_verification' : 'not_required';
        $orderCode = generate_tracking_code('ORD');

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO orders
                (order_code, customer_name, phone, email, fulfillment_type, address, notes, subtotal, delivery_fee, total_amount, payment_status, payment_reference, payment_phone, payment_payer_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $orderCode, $customerName, $phone, $email ?: null, $fulfillment, $address ?: null, $notes ?: null,
                $subtotal, $deliveryFee, $total, $paymentStatus, $paymentReference ?: null, $paymentPhone ?: null, $paymentPayerName ?: null,
            ]);
            $orderId = $pdo->lastInsertId();

            $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)');
            foreach ($validatedItems as $vi) {
                $itemStmt->execute([$orderId, $vi['product_id'], $vi['product_name'], $vi['unit_price'], $vi['quantity'], $vi['line_total']]);
                // decrement stock, not below zero
                $pdo->prepare('UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?')->execute([$vi['quantity'], $vi['product_id']]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_response(['success' => false, 'message' => 'Could not place order. Please try again.'], 500);
        }

        json_response([
            'success' => true,
            'message' => 'Order placed successfully!',
            'order_code' => $orderCode,
            'total_amount' => $total,
        ], 201);
        break;

    // ---------------------------------------------------------
    // Admin: update order status / payment verification
    case 'PUT':
        require_admin_auth();
        $body = read_json_body();
        $id = (int) ($body['id'] ?? 0);
        if (!$id) {
            json_response(['success' => false, 'message' => 'Missing order id.'], 400);
        }

        $fields = [];
        $params = [];
        $validStatus = ['pending', 'confirmed', 'processing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
        $validPayment = ['not_required', 'pending_verification', 'verified', 'rejected'];

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
        if (!$fields) {
            json_response(['success' => false, 'message' => 'Nothing to update.'], 400);
        }

        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE orders SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);

        json_response(['success' => true, 'message' => 'Order updated.']);
        break;

    default:
        json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}
