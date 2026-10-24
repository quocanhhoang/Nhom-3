<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$mode = $argv[1] ?? '--preview';
if (!in_array($mode, ['--preview', '--execute'], true)) {
    fwrite(STDERR, "Cách dùng: php cleanup.php [--preview|--execute]\n");
    exit(2);
}

$findCandidates = static function (array &$state): array {
    $candidates = [];
    foreach ($state['files'] as $file) {
        if (!empty($file['deleted_at']) || !is_file(app_file_path($file))) {
            continue;
        }
        $hasLink = false;
        $hasActiveLink = false;
        foreach ($state['links'] as $link) {
            if ($link['file_id'] !== $file['id']) {
                continue;
            }
            $hasLink = true;
            if (app_link_status($link) === 'active') {
                $hasActiveLink = true;
                break;
            }
        }
        if ($hasLink && !$hasActiveLink) {
            $candidates[] = $file;
        }
    }
    return $candidates;
};

$preview = app_with_state(static function (array &$state) use ($findCandidates): array {
    return $findCandidates($state);
});
echo "Xem trước: " . count($preview) . " tệp không còn liên kết hiệu lực.\n";
foreach ($preview as $file) {
    echo sprintf("- %s (%s)\n", $file['original_name'], number_format((int)$file['size']) . ' bytes');
}

if ($mode === '--preview') {
    echo "Chế độ xem trước: không có tệp nào bị xóa. Chạy php cleanup.php --execute để xác nhận dọn dẹp.\n";
    exit(0);
}

if (!$preview) {
    echo "Không có gì cần dọn dẹp.\n";
    exit(0);
}

fwrite(STDOUT, "Nhập XOA để xóa danh sách trên: ");
$confirmation = trim((string)fgets(STDIN));
if ($confirmation !== 'XOA') {
    echo "Đã hủy. Không có tệp nào bị xóa.\n";
    exit(0);
}

$deleted = app_with_state(static function (array &$state) use ($findCandidates): int {
    $count = 0;
    foreach ($findCandidates($state) as $candidate) {
        $path = app_file_path($candidate);
        if (is_file($path) && !unlink($path)) {
            throw new RuntimeException('Không thể xóa tệp: ' . $candidate['original_name']);
        }
        foreach ($state['files'] as &$file) {
            if ($file['id'] === $candidate['id']) {
                $file['deleted_at'] = gmdate('c');
            }
        }
        unset($file);
        foreach ($state['links'] as &$link) {
            if ($link['file_id'] === $candidate['id'] && empty($link['revoked_at'])) {
                $link['revoked_at'] = gmdate('c');
            }
        }
        unset($link);
        app_audit($state, $candidate['user_id'], 'file_cleanup', $candidate['id'], ['name' => $candidate['original_name']]);
        $count++;
    }
    return $count;
});

echo "Đã dọn $deleted tệp.\n";
