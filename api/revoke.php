<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');
require_csrf_token();

$body = json_request_body();
$fileId = filter_var($body['file_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]);
if ($fileId === false) {
    json_response(['error' => 'Tệp được chọn không hợp lệ.'], 400);
}

$result = pg_query_params(
    $conn,
    'UPDATE files
     SET is_link_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND owner_id = $2
     RETURNING id',
    [$fileId, FILESHARE_OWNER_ID]
);
if (!$result) {
    error_log('Failed to revoke file link: ' . pg_last_error($conn));
    json_response(['error' => 'Không thể thu hồi liên kết.'], 500);
}
if (pg_num_rows($result) === 0) {
    json_response(['error' => 'Không tìm thấy tệp.'], 404);
}

json_response(['success' => true]);
