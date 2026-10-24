<?php
declare(strict_types=1);

$ownerId = filter_var(getenv('FILESHARE_OWNER_ID') ?: '2', FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]);

if ($ownerId === false) {
    throw new RuntimeException('FILESHARE_OWNER_ID must be a positive integer.');
}

define('FILESHARE_OWNER_ID', $ownerId);
define('FILESHARE_MAX_UPLOAD_BYTES', 100 * 1024 * 1024);
define(
    'FILESHARE_STORAGE_DIR',
    getenv('FILESHARE_STORAGE_DIR')
        ?: dirname(__DIR__, 2) . '/' . basename(dirname(__DIR__)) . '-storage/uploads'
);
