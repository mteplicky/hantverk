# Automatic deployment to Websupport

Every push to main runs .github/workflows/deploy.yml. You can also select
Actions > Deploy to Websupport > Run workflow on main.

## Activate once

Use the FTP host listed in Websupport for deploy.hantverk.sk. Prefer the server
hostname that matches its TLS certificate. The account must log in directly to
/hantverk.sk, with the existing new-site folder visible as /new-site.

From a local terminal with GitHub CLI authentication and repository admin access:

```text
node deployment/configure-github.cjs YOUR_FTP_HOST
```

This reads FTP_PASS_WEBSUPPORT from the ignored local .env and stores it in the
WEBSUPPORT_FTP_PASSWORD repository secret. It also sets WEBSUPPORT_FTP_HOST.
The password must belong to deploy.hantverk.sk (not the email mailbox).
Alternatively set those two repository secrets in GitHub Settings > Secrets and
variables > Actions. No mailbox password belongs in GitHub.

Commit and push the workflow, scripts, tests and current site changes to main.
Watch the first Actions run and check the website after it completes.

If Websupport FTP GeoIP protection blocks GitHub runners, allow the connection in
the deploy account's protection settings. GitHub-hosted runner IPs vary; a fixed IP
restriction requires a runner with a fixed outgoing address. Do not change the
main FTP account. TLS certificate checks are enabled and must not be bypassed.

## Deployment behavior

Uploads only .htaccess, assets/, vendor/, contact.php and index.html. Dependencies
are installed by Composer in CI, so no console session is required for updates.
Use the composer.lock generated on the server in Git for reproducible dependencies;
until it is committed, Composer resolves allowed versions on each run and CI runs
composer audit before uploading.

After the first deployment with change detection, SHA-256 hashes in the private
.deploy-manifest.json file let later deployments skip unchanged files, including
images. The manifest is saved only after all uploads succeed. The first run with
this version uploads everything once to establish that baseline. Upload logs show
each changed filename and an uploaded/skipped count. To repair files changed or
deleted manually on the server, remove new-site/.deploy-manifest.json via FTP and
rerun the workflow to force a full upload. The manifest assumes deployments are
the only source of changes in new-site.

The private ../hantverk-mail.php file is outside the target and is never uploaded
or deleted. Existing WordPress directories are outside the target too.

Uploads use temporary names and rename complete files into place; index.html goes
last. This avoids serving a partially transferred file, but is not an atomic
whole-site release. If a deployment fails, fix the failure and rerun it. To restore
previous content, revert the relevant Git commit and push to main.

Remote files absent from Git are retained. Removed images or pages therefore need
manual removal from new-site if they must no longer be accessible. The workflow
never recursively deletes server files. Overlapping production uploads are queued.

The final HTTP check verifies the page loads and references the contact script;
it does not send test emails or prove delivery to either mailbox.
