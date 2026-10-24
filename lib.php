<?php
declare(strict_types=1);

function app_storage_root(): string
{
    $configured = getenv('FILESHARE_DATA_DIR');
    $documentRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $root = $configured !== false && $configured !== ''
        ? $configured
        : dirname(__DIR__) . '/fileshare-private';
    if (($configured === false || $configured === '') && $documentRoot !== false
        && ($root === $documentRoot || str_starts_with($root, $documentRoot . DIRECTORY_SEPARATOR))) {
        $root = dirname($documentRoot) . '/fileshare-private-' . substr(hash('sha256', __DIR__), 0, 12);
    }
    if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
        throw new RuntimeException('Không thể tạo thư mục lưu trữ riêng.');
    }
    $resolvedRoot = realpath($root);
    if ($resolvedRoot === false || ($documentRoot !== false
        && ($resolvedRoot === $documentRoot || str_starts_with($resolvedRoot, $documentRoot . DIRECTORY_SEPARATOR)))) {
        throw new RuntimeException('Thư mục lưu trữ phải nằm ngoài document root của máy chủ web.');
    }
    if (!is_writable($root)) {
        throw new RuntimeException('Thư mục lưu trữ riêng không có quyền ghi.');
    }
    if (!chmod($root, 0700)) {
        throw new RuntimeException('Không thể giới hạn quyền truy cập thư mục lưu trữ riêng.');
    }
    return $root;
}

function app_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
    if (!isset($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

function app_db(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }
    $host = getenv('DB_HOST') ?: 'localhost';
    $port = getenv('DB_PORT') ?: '5432';
    $database = getenv('DB_NAME') ?: 'fileSharing';
    $username = getenv('DB_USER') ?: 'admin';
    $password = getenv('DB_PASSWORD');
    if (!preg_match('/\A[a-zA-Z0-9_.:-]+\z/', $host)
        || !preg_match('/\A[a-zA-Z0-9_-]+\z/', $database)
        || !preg_match('/\A[a-zA-Z0-9_.-]+\z/', $username)
        || filter_var($port, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) === false) {
        throw new RuntimeException('Cấu hình kết nối PostgreSQL không hợp lệ.');
    }
    try {
        $connection = new PDO(
            "pgsql:host=$host;port=$port;dbname=$database",
            $username,
            $password === false ? '' : $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        $connection->exec("SET search_path TO public");
    } catch (PDOException $error) {
        error_log('FileShare PostgreSQL connection failed: ' . $error->getMessage());
        throw new RuntimeException('Không thể kết nối PostgreSQL. Hãy kiểm tra DB_HOST, DB_PORT, DB_NAME, DB_USER và DB_PASSWORD.', 0, $error);
    }
    return $connection;
}

function app_character_length(string $value): int
{
    $length = preg_match_all('/./us', $value);
    if ($length === false) {
        throw new InvalidArgumentException('Văn bản chứa mã ký tự không hợp lệ.');
    }
    return $length;
}

function app_initial_state(): array
{
    return ['users' => [], 'folders' => [], 'files' => [], 'links' => [], 'audit' => [], 'login_attempts' => []];
}

function app_with_state(callable $callback): mixed
{
    $root = app_storage_root();
    $lock = fopen($root . '/state.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Không thể khóa kho dữ liệu.');
    }
    chmod($root . '/state.lock', 0600);
    try {
        $path = $root . '/state.json';
        $raw = is_file($path) ? file_get_contents($path) : false;
        if ($raw === false) {
            $state = app_initial_state();
        } else {
            $state = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($state)) {
                throw new RuntimeException('Kho dữ liệu không hợp lệ.');
            }
            $state += app_initial_state();
        }
        $result = $callback($state);
        $encoded = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $temp = tempnam($root, 'state-');
        if ($temp === false || file_put_contents($temp, $encoded, LOCK_EX) === false) {
            throw new RuntimeException('Không thể ghi kho dữ liệu.');
        }
        chmod($temp, 0600);
        if (!rename($temp, $path)) {
            unlink($temp);
            throw new RuntimeException('Không thể cập nhật kho dữ liệu.');
        }
        chmod($path, 0600);
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function app_user(): ?array
{
    app_session_start();
    $userId = $_SESSION['user_id'] ?? null;
    if (!is_string($userId)) {
        return null;
    }
    if (!ctype_digit($userId)) {
        unset($_SESSION['user_id']);
        return null;
    }
    $query = app_db()->prepare("SELECT id, username, full_name, email, storage_limit FROM public.users WHERE id = :id AND status = 'active'");
    $query->execute(['id' => $userId]);
    $user = $query->fetch();
    if ($user === false) {
        unset($_SESSION['user_id']);
        return null;
    }
    return [
        'id' => (string)$user['id'],
        'username' => $user['username'],
        'name' => $user['full_name'],
        'email' => $user['email'],
        'quota' => (int)$user['storage_limit'],
    ];
}

function app_require_user(): array
{
    $user = app_user();
    if ($user === null) {
        app_json(['error' => 'Vui lòng đăng nhập để tiếp tục.'], 401);
    }
    return $user;
}

function app_json(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function app_input(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($contentType, 'application/json')) {
        $decoded = json_decode(file_get_contents('php://input') ?: '', true);
        return is_array($decoded) ? $decoded : [];
    }
    return $_POST;
}

function app_require_csrf(): void
{
    app_session_start();
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? app_input()['csrf'] ?? '';
    if (!is_string($provided) || !hash_equals($_SESSION['csrf'], $provided)) {
        app_json(['error' => 'Phiên làm việc đã hết hạn. Vui lòng tải lại trang.'], 419);
    }
}

function app_require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        app_json(['error' => 'Phương thức yêu cầu không được hỗ trợ.'], 405);
    }
}

function app_audit(array &$state, string $userId, string $event, ?string $fileId = null, array $details = []): void
{
    $state['audit'][] = [
        'id' => bin2hex(random_bytes(12)),
        'user_id' => $userId,
        'event' => $event,
        'file_id' => $fileId,
        'details' => $details,
        'ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? 'CLI'), 0, 64),
        'created_at' => gmdate('c'),
    ];
}

function app_user_file(array &$state, string $fileId, string $userId): ?array
{
    foreach ($state['files'] as $file) {
        if ($file['id'] === $fileId && $file['user_id'] === $userId && empty($file['deleted_at'])) {
            return $file;
        }
    }
    return null;
}

function app_file_path(array $file): string
{
    return app_storage_root() . '/files/' . $file['user_id'] . '/' . $file['disk_name'];
}

function app_link_status(array $link): string
{
    if (!empty($link['revoked_at'])) {
        return 'revoked';
    }
    if (strtotime($link['expires_at']) <= time()) {
        return 'expired';
    }
    if ($link['max_downloads'] !== null && $link['downloads'] >= $link['max_downloads']) {
        return 'limit_reached';
    }
    return 'active';
}

function app_create_link(array &$state, array $user, array $file, array $input): array
{
    $days = filter_var($input['expiry_days'] ?? 7, FILTER_VALIDATE_INT);
    if ($days === false || $days < 1 || $days > 3650) {
        throw new InvalidArgumentException('Thời hạn liên kết phải từ 1 đến 3650 ngày.');
    }
    $limitValue = trim((string)($input['max_downloads'] ?? ''));
    $limit = null;
    if ($limitValue !== '') {
        $limit = filter_var($limitValue, FILTER_VALIDATE_INT);
        if ($limit === false || $limit < 1 || $limit > 1000000) {
            throw new InvalidArgumentException('Giới hạn tải phải từ 1 đến 1.000.000 lượt hoặc để trống.');
        }
    }
    $access = ($input['access'] ?? 'public') === 'private' ? 'private' : 'public';
    $password = (string)($input['password'] ?? '');
    if (strlen($password) > 200) {
        throw new InvalidArgumentException('Mật khẩu liên kết quá dài.');
    }
    $token = bin2hex(random_bytes(24));
    $link = [
        'id' => bin2hex(random_bytes(12)),
        'user_id' => $user['id'],
        'file_id' => $file['id'],
        'token' => $token,
        'token_hash' => hash('sha256', $token),
        'access' => $access,
        'password_hash' => $password === '' ? null : password_hash($password, PASSWORD_DEFAULT),
        'created_at' => gmdate('c'),
        'expires_at' => gmdate('c', time() + $days * 86400),
        'max_downloads' => $limit,
        'downloads' => 0,
        'revoked_at' => null,
    ];
    $state['links'][] = $link;
    app_audit($state, $user['id'], 'link_created', $file['id'], [
        'link_id' => $link['id'],
        'access' => $access,
        'expires_at' => $link['expires_at'],
        'max_downloads' => $limit,
        'password_protected' => $password !== '',
    ]);
    return ['link' => $link, 'token' => $token];
}

function app_public_link(array $link, string $token): array
{
    $passwordProtected = !empty($link['password_hash']);
    unset($link['token'], $link['token_hash'], $link['password_hash']);
    $link['url'] = rtrim(app_base_url(), '/') . '/api.php?action=download&token=' . rawurlencode($token);
    $link['status'] = app_link_status($link);
    $link['password_protected'] = $passwordProtected;
    return $link;
}

function app_base_url(): string
{
    $configured = getenv('FILESHARE_BASE_URL');
    if ($configured !== false && $configured !== '') {
        $parts = parse_url($configured);
        if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true) || empty($parts['host'])) {
            throw new RuntimeException('FILESHARE_BASE_URL phải là URL HTTP hoặc HTTPS hợp lệ.');
        }
        return rtrim($configured, '/');
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    if (!preg_match('/\A[a-zA-Z0-9.-]+(?::[0-9]{1,5})?\z/', $host)) {
        throw new RuntimeException('Tên máy chủ yêu cầu không hợp lệ.');
    }
    $path = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    return $scheme . '://' . $host . rtrim($path, '/');
}

function app_file_mime_map(): array
{
    return [
        'pdf' => ['application/pdf'],
        'txt' => ['text/plain'],
        'csv' => ['text/plain', 'text/csv', 'application/csv', 'application/vnd.ms-excel'],
        'png' => ['image/png'],
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
    ];
}
