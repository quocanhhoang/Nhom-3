<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
$userId = require_authenticated_user();
$result = pg_query_params(
    $conn,
    'SELECT u.full_name, u.email, u.storage_limit AS storage_quota_bytes,
            COALESCE(SUM(f.file_size), 0)::bigint AS storage_used_bytes
     FROM users u LEFT JOIN files f ON f.owner_id = u.id
     WHERE u.id = $1 GROUP BY u.id',
    [$userId]
);
if (!$result || !($account = pg_fetch_assoc($result))) {
    error_log('Failed to load account quota: ' . pg_last_error($conn));
    json_response(['error' => 'Không thể tải thông tin dung lượng.'], 500);
}
json_response(['account' => [
    'full_name' => $account['full_name'],
    'email' => $account['email'],
    'storage_used_bytes' => (int) $account['storage_used_bytes'],
    'storage_quota_bytes' => (int) $account['storage_quota_bytes'],
]]);
