<?php
declare(strict_types=1);
require_once __DIR__ . '/site.php';

$language = site_language($_SERVER['HTTP_HOST'] ?? '');
$page = __DIR__ . '/pages/' . $language . '.html';
header('Content-Type: text/html; charset=utf-8');
header('Content-Language: ' . $language);
header('Cache-Control: no-cache');
if (!is_file($page)) {
    http_response_code(503);
    header('Retry-After: 60');
    echo $language === 'cs' ? 'Stránku právě aktualizujeme. Zkuste to za chvíli.' : 'Stránku práve aktualizujeme. Skúste to o chvíľu.';
    exit;
}
readfile($page);
