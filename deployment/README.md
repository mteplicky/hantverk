# Websupport contact form

Requires PHP 8.2+ with OpenSSL and Fileinfo, and Websupport web hosting
(not just domain registration). Static-only hosting cannot execute contact.php.

1. In the website folder run `composer install --no-dev --prefer-dist --optimize-autoloader`.
   Keep the generated composer.lock for reproducible future deployments. Upload vendor/
   too if running Composer on a different machine. Do not deploy without dependencies.
2. Copy hantverk-mail.example.php to **one directory above the public website folder**
   as `hantverk-mail.php`. For example, if the website is in `hantverk.sk/web`,
   place the config in `hantverk.sk/hantverk-mail.php`. Keep it outside every served
   directory and readable only by the hosting account (e.g. chmod 600).
3. Enter the mailbox password directly in that private file on the server.
   Never put real credentials in Git, HTML, JavaScript or chat.
4. In Websupport PHP settings set `upload_max_filesize` to `10M`,
   `post_max_size` to `12M`, and `max_file_uploads` to at least `5`.
   The application accepts up to five PDF/JPEG/PNG files, 10 MiB combined.
5. Deploy index.html, assets/, contact.php, vendor/ and .htaccess together.
   Confirm Apache honors .htaccess; vendor/ and .git/ must return 403 or 404.
6. On https://hantverk.sk, send a real test enquiry with an attachment, verify
   receipt at info@hantverk.sk and verify Reply goes to the visitor. Check invalid
   email, oversized/disallowed attachment and SMTP failure cases. SMTP acceptance
   does not guarantee inbox delivery; inspect spam if necessary.

SMTP is smtp.m1.websupport.sk, SSL port 465. The authenticated mailbox is the
sender; info@hantverk.sk and mteplicky@gmail.com are the fixed recipients.
Visitors are Reply-To only.
Reference: https://www.websupport.sk/podpora/kb/postove-protokoly/

The hidden honeypot and server-side limits reduce basic spam. Limits count attempts
even when SMTP fails: five per source IP in 15 minutes and 30 site-wide per hour.
They use a locked file in the server's temporary directory; verify the PHP worker
can write there. No automatic confirmation email is sent to visitors.

Before launch, replace the placeholder privacy policy link with the actual policy.
