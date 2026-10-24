<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');
$userId = require_authenticated_user();
require_csrf_token();
$body = json_request_body();
$fileId = filter_var($body['file_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($fileId === false) {
    json_response(['error' => 'Tệp được chọn không hợp lệ.'], 400);
}

$shareCode = bin2hex(random_bytes(16));
$result = pg_query_params(
    $conn,
    'UPDATE files
     SET share_code = $3, is_link_active = TRUE, download_count = 0,
         expires_at = CURRENT_TIMESTAMP + INTERVAL \'30 days\', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND owner_id = $2 AND access_type = \'public\'
     RETURNING id, share_code, expires_at, download_limit, download_count',
    [$fileId, $userId, $shareCode]
);
if (!$result) {
    error_log('Failed to create new file link: ' . pg_last_error($conn));
    json_response(['error' => 'Không thể tạo liên kết mới.'], 500);
}
$file = pg_fetch_assoc($result);
if (!$file) {
    $exists = pg_query_params($conn, 'SELECT 1 FROM files WHERE id = $1 AND owner_id = $2', [$fileId, $userId]);
    if ($exists && pg_num_rows($exists) > 0) {
        json_response(['error' => 'Chỉ có thể tạo liên kết công khai cho tệp đang đặt quyền Công khai.'], 409);
    }
    json_response(['error' => 'Không tìm thấy tệp.'], 404);
}

$activity = pg_query_params($conn, 'INSERT INTO activity_logs (user_id, file_id, action) VALUES ($1, $2, $3)', [$userId, $fileId, 'link_created']);
if (!$activity) {
    error_log('Failed to record file link creation: ' . pg_last_error($conn));
}

json_response(['file' => [
    'id' => (int) $file['id'],
    'share_code' => $file['share_code'],
    'expires_at' => $file['expires_at'],
    'download_limit' => $file['download_limit'] === null ? null : (int) $file['download_limit'],
    'download_count' => (int) $file['download_count'],
    'is_link_active' => true,
]]);
