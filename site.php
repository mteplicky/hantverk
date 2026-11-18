<?php
declare(strict_types=1);

function site_language(string $host): string
{
    $hostname = strtolower(explode(':', $host, 2)[0]);
    return in_array($hostname, ['hantverk.cz', 'www.hantverk.cz'], true) ? 'cs' : 'sk';
}

function site_contact_origin_allowed(string $origin): bool
{
    return $origin === '' || in_array($origin, [
        'https://hantverk.sk', 'https://www.hantverk.sk',
        'https://hantverk.cz', 'https://www.hantverk.cz',
    ], true);
}

function site_message(string $message, string $language): string
{
    if ($language !== 'cs') return $message;
    return [
        'Skontrolujte vyplnené údaje.' => 'Zkontrolujte vyplněné údaje.',
        'Vyplňte meno a platný e-mail.' => 'Vyplňte jméno a platný e-mail.',
        'Použite kontaktný formulár.' => 'Použijte kontaktní formulář.',
        'Prílohy môžu mať spolu najviac 10 MB.' => 'Přílohy mohou mít dohromady nejvýše 10 MB.',
        'Formulár odošlite zo stránky hantverk.sk.' => 'Formulář odešlete ze stránky hantverk.cz.',
        'Formulár sa nepodarilo odoslať.' => 'Formulář se nepodařilo odeslat.',
        'Priložte najviac 5 súborov.' => 'Přiložte nejvýše 5 souborů.',
        'Prílohu sa nepodarilo nahrať. Skontrolujte veľkosť súboru.' => 'Přílohu se nepodařilo nahrát. Zkontrolujte velikost souboru.',
        'Neplatná príloha.' => 'Neplatná příloha.',
        'Prílohy musia byť PDF, JPG alebo PNG.' => 'Přílohy musí být PDF, JPG nebo PNG.',
        'Príliš veľa pokusov. Skúste to neskôr alebo nám zavolajte.' => 'Příliš mnoho pokusů. Zkuste to později nebo nám zavolejte.',
        'Ďakujeme, vašu správu sme prijali.' => 'Děkujeme, vaši zprávu jsme přijali.',
        'Správu sa nepodarilo odoslať. Skúste to znova alebo napíšte na info@hantverk.sk.' => 'Zprávu se nepodařilo odeslat. Zkuste to znovu nebo napište na info@hantverk.sk.',
    ][$message] ?? $message;
}
