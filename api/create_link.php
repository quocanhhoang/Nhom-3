<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');
$userId = require_authenticated_user();
require_csrf_token();
$body = json_request_body();
$fileId = filter_var($body['file_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($fileId === false) json_response(['error' => 'Tệp được chọn không hợp lệ.'], 400);

$expiry = trim((string) ($body['expiry'] ?? ''));
if ($expiry !== '') {
    $expiryDate = DateTimeImmutable::createFromFormat('!Y-m-d', $expiry);
    if (!$expiryDate || $expiryDate->format('Y-m-d') !== $expiry || $expiryDate < new DateTimeImmutable('today')) {
        json_response(['error' => 'Ngày hết hạn không hợp lệ hoặc đã qua.'], 400);
    }
} else {
    $expiry = null;
}

$limitInput = trim((string) ($body['download_limit'] ?? ''));
$downloadLimit = $limitInput === '' ? null : filter_var($limitInput, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($downloadLimit === false) json_response(['error' => 'Giới hạn lượt tải phải là số nguyên dương.'], 400);
$password = (string) ($body['password'] ?? '');
if (strlen($password) > 1024 || ($password !== '' && strlen($password) < 8)) {
    json_response(['error' => 'Mật khẩu liên kết phải có ít nhất 8 ký tự và tối đa 1024 byte.'], 400);
}
$passwordHash = $password === '' ? null : password_hash($password, PASSWORD_DEFAULT);
$clearPassword = !empty($body['clear_password']);
$shareCode = bin2hex(random_bytes(16));

$result = pg_query_params(
    $conn,
    'UPDATE files
     SET share_code = $3, is_link_active = TRUE, download_count = 0,
         download_limit = $4,
         expires_at = CASE WHEN $5::date IS NULL THEN NULL ELSE $5::date + INTERVAL \'1 day\' - INTERVAL \'1 second\' END,
         link_password_hash = CASE WHEN $7 THEN NULL ELSE COALESCE($6, link_password_hash) END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND owner_id = $2 AND access_type = \'public\'
     RETURNING id, share_code, expires_at, download_limit, download_count, (link_password_hash IS NOT NULL) AS has_link_password',
    [$fileId, $userId, $shareCode, $downloadLimit, $expiry, $passwordHash, $clearPassword ? 'true' : 'false']
);
if (!$result) {
    error_log('Failed to create file link: ' . pg_last_error($conn));
    json_response(['error' => 'Không thể tạo liên kết. Hãy áp dụng migration 002_link_password.sql nếu chưa chạy.'], 500);
}
$file = pg_fetch_assoc($result);
if (!$file) {
    $exists = pg_query_params($conn, 'SELECT 1 FROM files WHERE id = $1 AND owner_id = $2', [$fileId, $userId]);
    if ($exists && pg_num_rows($exists) > 0) json_response(['error' => 'Chỉ có thể tạo liên kết cho tệp đang đặt quyền Công khai.'], 409);
    json_response(['error' => 'Không tìm thấy tệp.'], 404);
}

$activity = pg_query_params($conn, 'INSERT INTO activity_logs (user_id, file_id, action) VALUES ($1, $2, $3)', [$userId, $fileId, 'link_created']);
if (!$activity) error_log('Failed to record file link creation: ' . pg_last_error($conn));

json_response(['file' => [
    'id' => (int) $file['id'],
    'share_code' => $file['share_code'],
    'expires_at' => $file['expires_at'],
    'download_limit' => $file['download_limit'] === null ? null : (int) $file['download_limit'],
    'download_count' => (int) $file['download_count'],
    'has_link_password' => $file['has_link_password'] === 't',
    'is_link_active' => true,
]]);
