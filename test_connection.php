<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

try {
    require_once __DIR__ . '/config/database.php';
    $result = pg_query($conn, 'SELECT current_database()');
    if ($result === false) {
        error_log('PostgreSQL connectivity check failed: ' . pg_last_error($conn));
        throw new RuntimeException('Không thể kiểm tra kết nối PostgreSQL.');
    }
    fwrite(STDOUT, 'Kết nối PostgreSQL thành công tới database ' . pg_fetch_result($result, 0, 0) . ".\n");
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}