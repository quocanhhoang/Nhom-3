<?php
declare(strict_types=1);

define('FILESHARE_MAX_UPLOAD_BYTES', 100 * 1024 * 1024);
define('FILESHARE_DEFAULT_QUOTA_BYTES', 10 * 1024 * 1024 * 1024);
$allowedExtensionSetting = getenv('FILESHARE_ALLOWED_EXTENSIONS')
    ?: 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,md,jpg,jpeg,png,gif,webp,zip';
define('FILESHARE_ALLOWED_EXTENSIONS', array_values(array_filter(array_map(
    static fn (string $extension): string => strtolower(trim($extension)),
    explode(',', $allowedExtensionSetting)
))));
define(
    'FILESHARE_STORAGE_DIR',
    getenv('FILESHARE_STORAGE_DIR')
        ?: dirname(__DIR__, 2) . '/' . basename(dirname(__DIR__)) . '-storage/uploads'
);
