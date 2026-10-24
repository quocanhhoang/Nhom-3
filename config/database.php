<?php
declare(strict_types=1);

$host = trim((string)(getenv('DB_HOST') ?: 'localhost'));
$port = filter_var(getenv('DB_PORT') ?: '5432', FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 65535],
]);
$dbname = trim((string)(getenv('DB_NAME') ?: 'fileSharing'));
$user = trim((string)getenv('DB_USER'));
$password = getenv('DB_PASSWORD');

if ($host === '' || $dbname === '' || $user === '' || $password === false || $password === '' || $port === false) {
    throw new RuntimeException('Cần cấu hình DB_HOST, DB_PORT, DB_NAME, DB_USER và DB_PASSWORD trong môi trường PHP.');
}

$quoteConnectionValue = static function (string $value): string {
    return "'" . str_replace(['\\', "'"], ['\\\\', "\\'"], $value) . "'";
};
$connectionString = implode(' ', [
    'host=' . $quoteConnectionValue($host),
    'port=' . $port,
    'dbname=' . $quoteConnectionValue($dbname),
    'user=' . $quoteConnectionValue($user),
    'password=' . $quoteConnectionValue($password),
]);

$conn = @pg_connect($connectionString);
if ($conn === false) {
    error_log('PostgreSQL connection failed. Verify DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and database access rules.');
    throw new RuntimeException('Không thể kết nối PostgreSQL. Hãy kiểm tra cấu hình kết nối trong môi trường PHP.');
}
