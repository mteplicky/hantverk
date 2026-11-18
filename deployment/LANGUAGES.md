# Slovak and Czech website

## Editing and deploying

`index.html` is the Slovak source. Czech copy is in
`deployment/translations.cs.json`. When adding copy to the source, add its Czech
translation too: the build rejects missing translations.

Run `node deployment/build-site.cjs` and `node --test tests/*.test.cjs`.
With PHP installed, also run `php tests/language.test.php`.
The generated `pages/` folder is ignored by Git. GitHub Actions builds it on every
push to `main`, validates the code, and uploads only changed files over FTPS.

The deployed entry point is `index.php`. It serves Czech for `hantverk.cz` and
`www.hantverk.cz`, and Slovak for `.sk` and its preview hostname. Browser language
and previous selections do not override the domain. The header picker links to
the other domain and keeps the current section or project hash.

Both versions include canonical and reciprocal hreflang metadata. Shared assets
have content hashes in their URLs to refresh after changes. Prices, currency,
contact information and service area retain the existing business details.

## Connect hantverk.cz in Websupport

The intended result is two hostnames serving the same folder:
`/hantverk.sk/new-site`. Keep the existing `.sk` root unchanged.

1. Deploy the language changes through GitHub Actions first.
2. In WebAdmin open **Služby > hantverk.sk > Pokročilá konfigurácia > Web > Aliasy**.
   If `hantverk.cz` has no hosting assignment, create a hosting alias named
   `hantverk.cz` pointing to this existing web. Add `www.hantverk.cz` too if needed.
   An alias keeps the Czech domain in the browser, allowing PHP to select Czech.
3. If `.cz` already has hosting assigned, Websupport blocks creation of an alias
   for that hostname. Inspect its current setup first. If it uses the same hosting
   service, configure its web service's custom root and source directory to
   `/hantverk.sk/new-site`, as on `.sk`, if offered by WebAdmin. If that shared path
   is unavailable, ask Websupport to configure the alias to the existing `.sk`
   web; do not remove an existing hosting assignment without checking its web
   and mail data.
4. Set the web DNS A record for `.cz` to the **website hosting IP** shown by
   Websupport for `.sk`. Set `www` to the same web host. Do not substitute the FTP
   server IP, and preserve the domain's mail/MX/TXT records. Check any existing
   AAAA record also points to the intended web hosting.
5. Enable a valid HTTPS certificate covering `hantverk.cz` and
   `www.hantverk.cz`, then enable **Presmerovať na HTTPS**. Where a separate PHP
   setting exists, use the same PHP 8.5 version as the working `.sk` site.
6. Clear Websupport HTTP cache for both domains, if enabled, after changing their
   web configuration. Open each domain in a private browser window. `.sk` should
   show Slovak with SK active; `.cz` should show Czech with CZ active. Test both
   picker links on desktop and mobile, including an open project.
7. Submit a Czech enquiry and verify delivery. Both forms send through the
   existing `info@hantverk.sk` mailbox to `info@hantverk.sk` and
   `mteplicky@gmail.com`; no new mailbox or deployment account is needed. Czech
   enquiries have a Czech subject and identify `hantverk.cz` in the message.

The `.cz` domain must stay in the browser; a normal redirect to `.sk` will select
Slovak. No second workflow or copy of the website is needed.

References:
- https://www.websupport.sk/podpora/kb/hostingove-aliasy/
- https://www.websupport.sk/podpora/kb/korenovy-adresar/

## Local PHP preview

After building, run `php -S 127.0.0.1:8080` in the repository. PHP's development
server does not apply `.htaccess`. Visit `/` for Slovak. To check Czech server
routing without changing DNS:

```sh
curl -H "Host: hantverk.cz" http://127.0.0.1:8080/
```

The rendered HTML should have `<html lang="cs">`. Use the configured `.cz` domain for a full browser check of Czech routing and
assets. Generated pages are blocked from direct public access by Apache in
production; both languages are served at `/`.
