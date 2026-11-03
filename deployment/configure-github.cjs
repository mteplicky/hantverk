const { spawnSync } = require('node:child_process');

function gh(args, options = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    // Never print a failed child process object: it can contain secret stdin.
    throw new Error('GitHub command failed. Run gh auth login and confirm you can administer mteplicky/hantverk.');
  }
}

try {
  const host = process.argv[2];
  if (!host || !/^[a-zA-Z0-9.-]+$/.test(host)) {
    throw new Error('Usage: node deployment/configure-github.cjs YOUR_FTP_HOST (hostname or IP only)');
  }
  process.loadEnvFile('.env');
  const password = process.env.FTP_PASS_WEBSUPPORT;
  if (!password) throw new Error('FTP_PASS_WEBSUPPORT is missing from the local .env file.');
  gh(['auth', 'status']);
  for (const [name, value] of [['WEBSUPPORT_FTP_HOST', host], ['WEBSUPPORT_FTP_PASSWORD', password]]) {
    gh(['secret', 'set', name, '--repo', 'mteplicky/hantverk'], { input: value });
    console.log(`Saved repository secret ${name}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
