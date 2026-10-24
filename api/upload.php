<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');
require_csrf_token();

$upload = $_FILES['file'] ?? null;
if (!is_array($upload) || !isset($upload['error'], $upload['tmp_name'], $upload['size'])) {
    json_response(['error' => 'Vui lòng chọn tệp cần tải lên.'], 400);
}

if ($upload['error'] !== UPLOAD_ERR_OK) {
    $message = match ($upload['error']) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Tệp vượt quá giới hạn tải lên của máy chủ.',
        UPLOAD_ERR_PARTIAL => 'Tệp chỉ được tải lên một phần. Vui lòng thử lại.',
        UPLOAD_ERR_NO_FILE => 'Vui lòng chọn tệp cần tải lên.',
        default => 'Không thể nhận tệp tải lên.',
    };
    json_response(['error' => $message], 400);
}

$fileSize = (int) $upload['size'];
if ($fileSize < 1 || $fileSize > FILESHARE_MAX_UPLOAD_BYTES) {
    json_response(['error' => 'Kích thước tệp phải từ 1 byte đến 100 MB.'], 400);
}

$fileName = trim((string) ($_POST['fileName'] ?? ''));
if (
    $fileName === ''
    || strlen($fileName) > 255
    || str_contains($fileName, '/')
    || str_contains($fileName, '\\')
    || preg_match('/[\x00-\x1F\x7F]/', $fileName)
) {
    json_response(['error' => 'Tên tệp không hợp lệ (tối đa 255 byte).'], 400);
}

$accessType = $_POST['access'] ?? '';
if (!in_array($accessType, ['public', 'private'], true)) {
    json_response(['error' => 'Quyền truy cập không hợp lệ.'], 400);
}

$downloadLimit = filter_var($_POST['limit'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]);
if ($downloadLimit === false) {
    json_response(['error' => 'Giới hạn lượt tải phải là số nguyên dương.'], 400);
}

$expiry = trim((string) ($_POST['expiry'] ?? ''));
if ($expiry !== '') {
    $expiryDate = DateTimeImmutable::createFromFormat('!Y-m-d', $expiry);
    if (!$expiryDate || $expiryDate->format('Y-m-d') !== $expiry) {
        json_response(['error' => 'Ngày hết hạn không hợp lệ.'], 400);
    }
    if ($expiryDate < new DateTimeImmutable('today')) {
        json_response(['error' => 'Ngày hết hạn không được ở trong quá khứ.'], 400);
    }
} else {
    $expiry = null;
}

if (!is_uploaded_file($upload['tmp_name'])) {
    json_response(['error' => 'Tệp tải lên không hợp lệ.'], 400);
}

if (!is_dir(FILESHARE_STORAGE_DIR) && !mkdir(FILESHARE_STORAGE_DIR, 0750, true) && !is_dir(FILESHARE_STORAGE_DIR)) {
    error_log('Unable to create file storage directory.');
    json_response(['error' => 'Không thể chuẩn bị nơi lưu trữ tệp.'], 500);
}

$storedName = bin2hex(random_bytes(24));
$absolutePath = FILESHARE_STORAGE_DIR . '/' . $storedName;
$relativePath = $storedName;
$fileInfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $fileInfo->file($upload['tmp_name']) ?: 'application/octet-stream';

if (!move_uploaded_file($upload['tmp_name'], $absolutePath)) {
    error_log('Unable to move uploaded file into private storage.');
    json_response(['error' => 'Không thể lưu tệp tải lên.'], 500);
}

$shareCode = bin2hex(random_bytes(16));
$transactionStarted = pg_query($conn, 'BEGIN');
if (!$transactionStarted) {
    unlink($absolutePath);
    error_log('Unable to begin upload transaction: ' . pg_last_error($conn));
    json_response(['error' => 'Không thể lưu thông tin tệp vào cơ sở dữ liệu.'], 500);
}

try {
    $insertedFile = pg_query_params(
        $conn,
        'INSERT INTO files
            (owner_id, file_name, file_path, file_size, file_type, share_code,
             access_type, download_limit, download_count, expires_at, is_link_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0,
                 ($9::date + INTERVAL \'1 day\' - INTERVAL \'1 second\'), TRUE)
         RETURNING id, created_at',
        [
            FILESHARE_CURRENT_USER_ID,
            $fileName,
            $relativePath,
            $fileSize,
            $mimeType,
            $shareCode,
            $accessType,
            $downloadLimit,
            $expiry,
        ]
    );
    if (!$insertedFile) {
        throw new RuntimeException(pg_last_error($conn));
    }

    $savedFile = pg_fetch_assoc($insertedFile);
    $activity = pg_query_params(
        $conn,
        'INSERT INTO activity_logs (user_id, file_id, action) VALUES ($1, $2, $3)',
        [FILESHARE_CURRENT_USER_ID, $savedFile['id'], 'upload']
    );
    if (!$activity) {
        throw new RuntimeException(pg_last_error($conn));
    }

    if (!pg_query($conn, 'COMMIT')) {
        throw new RuntimeException(pg_last_error($conn));
    }
} catch (Throwable $error) {
    pg_query($conn, 'ROLLBACK');
    if (is_file($absolutePath)) {
        unlink($absolutePath);
    }
    error_log('Unable to save uploaded file: ' . $error->getMessage());
    json_response(['error' => 'Không thể lưu thông tin tệp vào cơ sở dữ liệu.'], 500);
}

json_response([
    'file' => [
        'id' => (int) $savedFile['id'],
        'file_name' => $fileName,
        'file_size' => $fileSize,
        'file_type' => $mimeType,
        'share_code' => $shareCode,
        'access_type' => $accessType,
        'download_limit' => $downloadLimit,
        'download_count' => 0,
        'expires_at' => $expiry,
        'is_link_active' => true,
        'created_at' => $savedFile['created_at'],
    ],
], 201);
