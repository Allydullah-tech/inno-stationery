<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
require_admin_auth();
$pdo = get_db();

$stats = [];
$stats['total_products'] = (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
$stats['active_products'] = (int) $pdo->query('SELECT COUNT(*) FROM products WHERE status = "active"')->fetchColumn();
$stats['low_stock'] = (int) $pdo->query('SELECT COUNT(*) FROM products WHERE stock <= 5 AND status = "active"')->fetchColumn();

$stats['total_orders'] = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
$stats['pending_orders'] = (int) $pdo->query('SELECT COUNT(*) FROM orders WHERE status = "pending"')->fetchColumn();
$stats['orders_awaiting_payment_verification'] = (int) $pdo->query('SELECT COUNT(*) FROM orders WHERE payment_status = "pending_verification"')->fetchColumn();
$stats['revenue_completed'] = (float) $pdo->query('SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status = "completed"')->fetchColumn();

$stats['total_print_requests'] = (int) $pdo->query('SELECT COUNT(*) FROM print_requests')->fetchColumn();
$stats['pending_print_requests'] = (int) $pdo->query('SELECT COUNT(*) FROM print_requests WHERE status = "received"')->fetchColumn();
$stats['print_awaiting_payment_verification'] = (int) $pdo->query('SELECT COUNT(*) FROM print_requests WHERE payment_status = "pending_verification"')->fetchColumn();

$stats['recent_orders'] = $pdo->query('SELECT order_code, customer_name, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5')->fetchAll();
$stats['recent_print_requests'] = $pdo->query('SELECT request_code, customer_name, status, created_at FROM print_requests ORDER BY created_at DESC LIMIT 5')->fetchAll();

json_response(['success' => true, 'stats' => $stats]);
