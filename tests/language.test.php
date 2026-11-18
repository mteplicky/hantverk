<?php
require_once __DIR__ . '/../site.php';
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
foreach ([
    'hantverk.sk' => 'sk', 'www.hantverk.sk' => 'sk',
    'hantverk.cz' => 'cs', 'www.hantverk.cz' => 'cs',
    'HANTVERK.CZ:443' => 'cs', 'preview.hantverk.sk' => 'sk',
    'hantverk.cz.attacker.example' => 'sk', 'localhost' => 'sk',
] as $host => $expected) {
    check(site_language($host) === $expected, 'Wrong language for ' . $host);
    $_SERVER['HTTP_HOST'] = $host;
    $_SERVER['HTTP_ACCEPT_LANGUAGE'] = $expected === 'sk' ? 'cs' : 'sk';
    $_COOKIE['language'] = $expected === 'sk' ? 'cs' : 'sk';
    ob_start();
    include __DIR__ . '/../index.php';
    $html = ob_get_clean();
    check(str_contains($html, '<html lang="' . $expected . '">'), 'Wrong rendered language for ' . $host);
}
foreach (['https://hantverk.sk', 'https://www.hantverk.sk', 'https://hantverk.cz', 'https://www.hantverk.cz', ''] as $origin) {
    check(site_contact_origin_allowed($origin), 'Valid contact origin rejected');
}
foreach (['http://hantverk.cz', 'https://hantverk.cz.attacker.example', 'null'] as $origin) {
    check(!site_contact_origin_allowed($origin), 'Untrusted origin accepted');
}
check(site_message('Vyplňte meno a platný e-mail.', 'cs') === 'Vyplňte jméno a platný e-mail.', 'Czech validation missing');
check(site_message('Vyplňte meno a platný e-mail.', 'sk') === 'Vyplňte meno a platný e-mail.', 'Slovak validation changed');
echo "PHP domain routing and contact origin checks passed.\n";