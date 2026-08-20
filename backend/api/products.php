<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

send_api_headers();
$method = $_SERVER['REQUEST_METHOD'];
$pdo = get_db();

function product_row_out(array $row): array
{
    $row['image_url'] = $row['image'] ? UPLOAD_URL_PRODUCTS . $row['image'] : null;
    $row['price'] = (float) $row['price'];
    $row['stock'] = (int) $row['stock'];
    return $row;
}

switch (true) {

    // ---------------------------------------------------------
    case $method === 'GET':
        if (!empty($_GET['id'])) {
            $stmt = $pdo->prepare('SELECT p.*, c.name AS category_name FROM products p
                                    LEFT JOIN categories c ON c.id = p.category_id
                                    WHERE p.id = ? LIMIT 1');
            $stmt->execute([(int) $_GET['id']]);
            $row = $stmt->fetch();
            if (!$row) {
                json_response(['success' => false, 'message' => 'Product not found.'], 404);
            }
            json_response(['success' => true, 'product' => product_row_out($row)]);
        }

        // Listing with optional filters: category, search, admin (include inactive)
        $isAdmin = !empty($_SESSION['admin_id']);
        $where = [];
        $params = [];

        if (!$isAdmin) {
            $where[] = 'p.status = "active"';
        } elseif (!empty($_GET['status'])) {
            $where[] = 'p.status = ?';
            $params[] = $_GET['status'];
        }

        if (!empty($_GET['category'])) {
            $where[] = 'c.slug = ?';
            $params[] = $_GET['category'];
        }
        if (!empty($_GET['search'])) {
            $where[] = '(p.name LIKE ? OR p.description LIKE ?)';
            $like = '%' . $_GET['search'] . '%';
            $params[] = $like;
            $params[] = $like;
        }
        if (!empty($_GET['featured'])) {
            $where[] = 'p.is_featured = 1';
        }

        $sql = 'SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
                LEFT JOIN categories c ON c.id = p.category_id';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY p.created_at DESC';

        $limit = (int) ($_GET['limit'] ?? 0);
        if ($limit > 0) {
            $sql .= ' LIMIT ' . $limit;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = array_map('product_row_out', $stmt->fetchAll());

        json_response(['success' => true, 'products' => $rows, 'count' => count($rows)]);
        break;

    // ---------------------------------------------------------
    // NOTE: PHP does not populate $_POST/$_FILES for multipart PUT requests,
    // so updates-with-file use POST + a "_method=PUT" override field instead
    // of a real HTTP PUT. Pure JSON updates (no new image) may still use PUT.
    case $method === 'POST' && ($_POST['_method'] ?? '') === 'PUT':
        require_admin_auth();
        $id = (int) ($_POST['id'] ?? 0);
        if (!$id) {
            json_response(['success' => false, 'message' => 'Missing product id.'], 400);
        }

        $fields = [];
        $params = [];
        foreach (['name' => 's', 'description' => 's', 'price' => 'd', 'stock' => 'd', 'category_id' => 'd', 'status' => 's'] as $field => $type) {
            if (isset($_POST[$field]) && $_POST[$field] !== '') {
                $fields[] = "$field = ?";
                $params[] = $_POST[$field];
            }
        }
        $fields[] = 'is_featured = ?';
        $params[] = !empty($_POST['is_featured']) ? 1 : 0;

        if (!empty($_FILES['image']['name'])) {
            [$imageName, $err] = handle_upload($_FILES['image'], UPLOAD_DIR_PRODUCTS, ALLOWED_IMAGE_EXT, MAX_UPLOAD_BYTES);
            if ($err) {
                json_response(['success' => false, 'message' => $err], 400);
            }
            $fields[] = 'image = ?';
            $params[] = $imageName;
        }

        if (!$fields) {
            json_response(['success' => false, 'message' => 'Nothing to update.'], 400);
        }

        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);

        json_response(['success' => true, 'message' => 'Product updated.']);
        break;

    // ---------------------------------------------------------
    case $method === 'POST':
        require_admin_auth();

        // Uses multipart/form-data because of optional image upload
        $name = trim($_POST['name'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $price = (float) ($_POST['price'] ?? 0);
        $stock = (int) ($_POST['stock'] ?? 0);
        $categoryId = !empty($_POST['category_id']) ? (int) $_POST['category_id'] : null;
        $isFeatured = !empty($_POST['is_featured']) ? 1 : 0;
        $status = ($_POST['status'] ?? 'active') === 'inactive' ? 'inactive' : 'active';

        if ($name === '' || $price < 0) {
            json_response(['success' => false, 'message' => 'Product name and a valid price are required.'], 400);
        }

        $imageName = null;
        if (!empty($_FILES['image']['name'])) {
            [$imageName, $err] = handle_upload($_FILES['image'], UPLOAD_DIR_PRODUCTS, ALLOWED_IMAGE_EXT, MAX_UPLOAD_BYTES);
            if ($err) {
                json_response(['success' => false, 'message' => $err], 400);
            }
        }

        $stmt = $pdo->prepare('INSERT INTO products (category_id, name, description, price, stock, image, is_featured, status)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$categoryId, $name, $description, $price, $stock, $imageName, $isFeatured, $status]);

        json_response(['success' => true, 'message' => 'Product added.', 'id' => $pdo->lastInsertId()], 201);
        break;

    // ---------------------------------------------------------
    // Pure JSON update (no new image) - true HTTP PUT is fine here since
    // there's no multipart body to worry about.
    case $method === 'PUT':
        require_admin_auth();
        $data = read_json_body();

        $id = (int) ($data['id'] ?? 0);
        if (!$id) {
            json_response(['success' => false, 'message' => 'Missing product id.'], 400);
        }

        $fields = [];
        $params = [];
        foreach (['name' => 's', 'description' => 's', 'price' => 'd', 'stock' => 'd', 'category_id' => 'd', 'status' => 's'] as $field => $type) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        if (isset($data['is_featured'])) {
            $fields[] = 'is_featured = ?';
            $params[] = (int) (bool) $data['is_featured'];
        }

        if (!$fields) {
            json_response(['success' => false, 'message' => 'Nothing to update.'], 400);
        }

        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);

        json_response(['success' => true, 'message' => 'Product updated.']);
        break;

    // ---------------------------------------------------------
    case $method === 'DELETE':
        require_admin_auth();
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            json_response(['success' => false, 'message' => 'Missing id.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$id]);
        json_response(['success' => true, 'message' => 'Product deleted.']);
        break;

    default:
        json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}
