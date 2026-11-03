<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => $status === 200, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function field(string $key, int $limit, bool $required = false): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value) || strlen($value) > $limit || str_contains($value, "\0")) {
        respond(422, 'Skontrolujte vyplnené údaje.');
    }
    $value = trim($value);
    if ($required && $value === '') {
        respond(422, 'Vyplňte meno a platný e-mail.');
    }
    return $value;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, 'Použite kontaktný formulár.');
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 11 * 1024 * 1024) {
    respond(413, 'Prílohy môžu mať spolu najviac 10 MB.');
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, ['https://hantverk.sk', 'https://www.hantverk.sk'], true)) {
    respond(403, 'Formulár odošlite zo stránky hantverk.sk.');
}
if (field('website', 1000) !== '') {
    respond(422, 'Formulár sa nepodarilo odoslať.');
}
$name = field('name', 200, true);
$email = field('email', 254, true);
$phone = field('phone', 80);
$situation = field('situation', 200);
$message = field('message', 10000);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $name . $email . $phone)) {
    respond(422, 'Vyplňte meno a platný e-mail.');
}

$attachments = [];
$files = $_FILES['attachments'] ?? null;
if ($files !== null) {
    if (!is_array($files) || !isset($files['error']) || !is_array($files['error']) || count($files['error']) > 5) {
        respond(422, 'Priložte najviac 5 súborov.');
    }
    $total = 0;
    $types = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    foreach ($files['error'] as $i => $error) {
        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($error !== UPLOAD_ERR_OK) {
            respond(422, 'Prílohu sa nepodarilo nahrať. Skontrolujte veľkosť súboru.');
        }
        $tmp = $files['tmp_name'][$i] ?? null;
        $original = $files['name'][$i] ?? null;
        if (!is_string($tmp) || !is_uploaded_file($tmp) || !is_string($original)) {
            respond(422, 'Neplatná príloha.');
        }
        $extension = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        $mime = $finfo->file($tmp);
        if (!isset($types[$extension]) || $types[$extension] !== $mime) {
            respond(422, 'Prílohy musia byť PDF, JPG alebo PNG.');
        }
        $total += filesize($tmp);
        if ($total > 10 * 1024 * 1024) {
            respond(413, 'Prílohy môžu mať spolu najviac 10 MB.');
        }
        // Use generated filenames so user-supplied names never enter mail headers.
        $attachments[] = [$tmp, 'priloha-' . (count($attachments) + 1) . '.' . $extension, $mime];
    }
}

try {
    // This file must live OUTSIDE the directory served by the web server.
    $configFile = dirname(__DIR__) . '/hantverk-mail.php';
    $config = is_file($configFile) ? require $configFile : [];
    if (!is_array($config) || empty($config['password']) || empty($config['username'])) {
        throw new RuntimeException('Mail configuration missing');
    }
    require __DIR__ . '/vendor/autoload.php';

    // Locked, shared limits: five attempts per IP / 15 minutes and 30 total / hour.
    // Use REMOTE_ADDR only; visitor-controlled forwarded headers are not trusted.
    $ratePath = sys_get_temp_dir() . '/hantverk-contact-' . hash('sha256', __DIR__) . '.json';
    $handle = fopen($ratePath, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        throw new RuntimeException('Rate limiter unavailable');
    }
    try {
        $now = time();
        $ip = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', $config['password']);
        $stored = stream_get_contents($handle);
        $attempts = $stored === '' ? [] : json_decode($stored, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($attempts)) {
            throw new RuntimeException('Invalid rate limit state');
        }
        $attempts = array_values(array_filter($attempts, fn ($entry) => $entry['time'] > $now - 3600));
        $recent = array_filter($attempts, fn ($entry) => $entry['ip'] === $ip && $entry['time'] > $now - 900);
        if (count($recent) >= 5 || count($attempts) >= 30) {
            header('Retry-After: 900');
            respond(429, 'Príliš veľa pokusov. Skúste to neskôr alebo nám zavolajte.');
        }
        $attempts[] = ['ip' => $ip, 'time' => $now];
        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, json_encode($attempts, JSON_THROW_ON_ERROR)) === false || !fflush($handle)) {
            throw new RuntimeException('Cannot save rate limit state');
        }
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = 'smtp.m1.websupport.sk';
    $mail->Port = 465;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->SMTPAuth = true;
    $mail->Username = $config['username'];
    $mail->Password = $config['password'];
    $mail->Timeout = 20;
    $mail->CharSet = 'UTF-8';
    $mail->setFrom($config['username'], 'Hantverk – web');
    $mail->addAddress('info@hantverk.sk');
    $mail->addReplyTo($email, $name);
    $mail->Subject = 'Nový dopyt z hantverk.sk';
    $mail->Body = "Meno: $name\nE-mail: $email\nTelefón: $phone\nSituácia: $situation\n\n$message";
    foreach ($attachments as [$tmp, $filename, $mime]) {
        $mail->addAttachment($tmp, $filename, 'base64', $mime);
    }
    $mail->send();
    respond(200, 'Ďakujeme, vašu správu sme prijali.');
} catch (Throwable $error) {
    // Avoid logging credentials, message contents or visitor contact information.
    error_log('Hantverk contact delivery failed (' . get_class($error) . ').');
    respond(503, 'Správu sa nepodarilo odoslať. Skúste to znova alebo napíšte na info@hantverk.sk.');
}
