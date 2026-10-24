<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('GET');

$result = pg_query_params(
    $conn,
    'SELECT id, file_name, file_size, file_type, share_code, access_type,
            download_limit, download_count, expires_at, is_link_active, created_at
     FROM files
     WHERE owner_id = $1
     ORDER BY created_at DESC, id DESC',
    [FILESHARE_CURRENT_USER_ID]
);

if (!$result) {
    error_log('Failed to list files: ' . pg_last_error($conn));
    json_response(['error' => 'Không thể tải danh sách tệp.'], 500);
}

$files = [];
while ($file = pg_fetch_assoc($result)) {
    $files[] = [
        'id' => (int) $file['id'],
        'file_name' => $file['file_name'],
        'file_size' => (int) $file['file_size'],
        'file_type' => $file['file_type'],
        'share_code' => $file['share_code'],
        'access_type' => $file['access_type'],
        'download_limit' => $file['download_limit'] === null ? null : (int) $file['download_limit'],
        'download_count' => (int) $file['download_count'],
        'expires_at' => $file['expires_at'],
        'is_link_active' => $file['is_link_active'] === 't',
        'created_at' => $file['created_at'],
    ];
}

json_response(['files' => $files]);
