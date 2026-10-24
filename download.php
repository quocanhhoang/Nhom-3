<?php
declare(strict_types=1);

function fail_download(string $message, int $status): never
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    exit($message);
}

try {
    require_once __DIR__ . '/config/app.php';
    require_once __DIR__ . '/config/database.php';
} catch (Throwable $error) {
    error_log('Download initialization failed: ' . $error->getMessage());
    fail_download('Dịch vụ hiện không khả dụng.', 500);
}

$shareCode = $_GET['code'] ?? '';
if (!is_string($shareCode) || !preg_match('/^[a-f0-9]{32}$/', $shareCode)) {
    fail_download('Liên kết chia sẻ không hợp lệ.', 400);
}

$result = pg_query_params(
    $conn,
    'SELECT id, owner_id, file_name, file_path, file_type, download_limit, download_count,
            expires_at, access_type, is_link_active
     FROM files WHERE share_code = $1',
    [$shareCode]
);
if (!$result) {
    error_log('Failed to look up shared file: ' . pg_last_error($conn));
    fail_download('Không thể tải tệp lúc này.', 500);
}
$file = pg_fetch_assoc($result);
if (!$file || $file['is_link_active'] !== 't') {
    fail_download('Liên kết này không còn hoạt động.', 404);
}
if ($file['access_type'] !== 'public') {
    fail_download('Tệp này không được chia sẻ công khai.', 403);
}
if ($file['expires_at'] !== null && strtotime($file['expires_at']) < time()) {
    fail_download('Liên kết chia sẻ đã hết hạn.', 410);
}
if ($file['download_limit'] !== null && (int) $file['download_count'] >= (int) $file['download_limit']) {
    fail_download('Tệp đã đạt giới hạn lượt tải.', 410);
}

$storageRoot = realpath(FILESHARE_STORAGE_DIR);
$filePath = realpath(FILESHARE_STORAGE_DIR . '/' . $file['file_path']);
if (
    $storageRoot === false
    || $filePath === false
    || !str_starts_with($filePath, $storageRoot . DIRECTORY_SEPARATOR)
    || !is_file($filePath)
) {
    error_log('Shared file is missing from private storage.');
    fail_download('Tệp này đang thiếu trên ổ đĩa lưu trữ. Vui lòng liên hệ chủ sở hữu để tải lên lại.', 404);
}

$updated = pg_query_params(
    $conn,
    'UPDATE files
     SET download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND is_link_active = TRUE
       AND (download_limit IS NULL OR download_count < download_limit)
       AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
     RETURNING id',
    [$file['id']]
);
if (!$updated) {
    error_log('Failed to update download count: ' . pg_last_error($conn));
    fail_download('Không thể tải tệp lúc này.', 500);
}
if (pg_num_rows($updated) === 0) {
    fail_download('Liên kết đã hết hạn hoặc đạt giới hạn lượt tải.', 410);
}

$activity = pg_query_params(
    $conn,
    'INSERT INTO activity_logs (user_id, file_id, action) VALUES ($1, $2, $3)',
    [$file['owner_id'], $file['id'], 'download']
);
if (!$activity) {
    error_log('Failed to record file download: ' . pg_last_error($conn));
}

header('Content-Type: ' . ($file['file_type'] ?: 'application/octet-stream'));
header('Content-Length: ' . filesize($filePath));
header('Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode($file['file_name']));
header('X-Content-Type-Options: nosniff');
readfile($filePath);
