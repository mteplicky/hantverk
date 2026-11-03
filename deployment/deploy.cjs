const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Relative to the deploy.hantverk.sk account, which is restricted to /hantverk.sk.
const REMOTE_DIR = '/new-site';

function deploymentFiles(root) {
  const files = [];
  function visit(relative) {
    if (/[\r\n]/.test(relative)) throw new Error('Invalid deployment filename');
    const entry = fs.lstatSync(path.join(root, relative));
    if (entry.isSymbolicLink()) throw new Error('Deployment must not contain symlinks');
    if (entry.isDirectory()) {
      for (const child of fs.readdirSync(path.join(root, relative)).sort()) {
        visit(`${relative}/${child}`);
      }
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error('Unsupported deployment file');
    }
  }
  // Explicit allowlist: secrets, Git files, archives and tooling never enter the upload.
  for (const item of ['.htaccess', 'assets', 'vendor', 'contact.php', 'index.html']) visit(item);
  if (!files.includes('vendor/autoload.php')) throw new Error('Run composer install before deploying');
  return files;
}

async function deploy(client, root, credentials) {
  for (const key of ['host', 'user', 'password']) {
    if (!credentials[key]) throw new Error(`Missing FTP ${key}`);
  }
  const files = deploymentFiles(root);
  const run = randomUUID();
  let stage = 'connecting and authenticating over FTPS';
  try {
    await client.access({ ...credentials, port: 21, secure: true });
    // Fail rather than create a directory if the account's root is misconfigured.
    stage = 'opening /new-site';
    await client.cd(REMOTE_DIR);
    stage = 'checking existing website files';
    await client.size('index.html');
    await client.size('contact.php');
    const knownDirs = new Set(['.']);
    for (const relative of files) {
      const dir = path.posix.dirname(relative);
      if (!knownDirs.has(dir)) {
        stage = `creating directory ${dir}`;
        await client.ensureDir(`${REMOTE_DIR}/${dir}`);
        await client.cd(REMOTE_DIR);
        knownDirs.add(dir);
      }
      // Publish complete files by rename; index.html is published last.
      const temporary = path.posix.join(dir, `.deploy-${run}.tmp`);
      stage = `uploading ${relative}`;
      await client.uploadFrom(path.join(root, relative), temporary);
      stage = `publishing ${relative}`;
      await client.rename(temporary, relative);
    }
    console.log(`Deployed ${files.length} files to new-site.`);
  } catch (error) {
    error.deployStage = stage;
    throw error;
  } finally {
    client.close();
  }
}

function safeError(error, credentials) {
  let message = `Deployment failed while ${error.deployStage || 'preparing files'} (${error.code || error.name}): ${error.message || 'Unknown error'}`;
  for (const value of Object.values(credentials).filter(value => typeof value === 'string' && value.length).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/PASS\s+[^\r\n]*/gi, 'PASS [redacted]').replace(/[\r\n\x00-\x1f\x7f]+/g, ' ').slice(0, 1800);
}

if (require.main === module) {
  const { Client } = require('basic-ftp');
  const credentials = {
    host: process.env.WEBSUPPORT_FTP_HOST,
    user: 'deploy.hantverk.sk',
    password: process.env.WEBSUPPORT_FTP_PASSWORD,
  };
  deploy(new Client(60000), path.resolve(__dirname, '..'), credentials).catch(error => {
    // Do not emit the FTP connection object, which contains credentials.
    console.error(safeError(error, credentials));
    process.exitCode = 1;
  });
}

module.exports = { deploymentFiles, deploy, safeError };
