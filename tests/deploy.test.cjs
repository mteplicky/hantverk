const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { finished } = require('node:stream/promises');
const { deploymentFiles, deploy, safeError, protocolTrace, fileHashes } = require('../deployment/deploy.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hantverk-deploy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['.htaccess', 'contact.php', 'index.html', 'assets/style.css', 'vendor/autoload.php', '.env', 'hantverk-mail.php', 'deployment/archive.zip']) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), 'test');
  }
  return root;
}

test('only website files are selected; entry point is last', t => {
  const files = deploymentFiles(fixture(t));
  assert.deepEqual(files, ['.htaccess', 'assets/style.css', 'vendor/autoload.php', 'contact.php', 'index.html']);
});

test('missing mail dependency prevents deployment', t => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, 'vendor/autoload.php'));
  assert.throws(() => deploymentFiles(root), /composer install/);
});

function fakeClient(fail = false, manifest = null) {
  const calls = [];
  const client = { calls, close() { calls.push(['close']); } };
  client.downloadTo = async (target, filename) => {
    calls.push(['downloadTo', filename]);
    if (manifest === null) throw Object.assign(new Error('Not found'), { code: 550 });
    target.end(JSON.stringify(manifest));
    await finished(target);
  };
  for (const name of ['connect', 'useTLS', 'login', 'useDefaultSettings', 'cd', 'size', 'ensureDir', 'uploadFrom', 'rename']) {
    client[name] = async (...args) => {
      calls.push([name, ...args]);
      if (fail && name === 'uploadFrom') throw new Error('Transfer failed');
    };
  }
  return client;
}

test('uses FTPS and publishes complete files with index last', async t => {
  const client = fakeClient();
  await deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'test' });
  assert.deepEqual(client.calls.slice(0, 5), [
    ['connect', 'ftp.example.com', 21],
    ['useTLS', { host: 'ftp.example.com', servername: 'ftp.example.com' }],
    ['login', 'deploy', 'test'],
    ['useDefaultSettings'],
    ['cd', '/new-site'],
  ]);
  const renames = client.calls.filter(call => call[0] === 'rename');
  assert.equal(renames.at(-2)[2], 'index.html');
  assert.equal(renames.at(-1)[2], '.deploy-manifest.json');
  assert.equal(client.calls.some(call => call[0] === 'remove'), false);
  assert.equal(client.calls.at(-1)[0], 'close');
});

test('unchanged website files are skipped', async t => {
  const root = fixture(t);
  const manifest = { version: 1, files: fileHashes(root, deploymentFiles(root)) };
  const client = fakeClient(false, manifest);
  await deploy(client, root, { host: 'ftp.example.com', user: 'deploy', password: 'test' });
  const uploads = client.calls.filter(call => call[0] === 'uploadFrom');
  assert.equal(uploads.length, 1); // Only the small manifest, no website files.
  assert.equal(typeof uploads[0][1], 'object');
});

test('same-size content changes are uploaded while unchanged assets are skipped', async t => {
  const root = fixture(t);
  const manifest = { version: 1, files: fileHashes(root, deploymentFiles(root)) };
  fs.writeFileSync(path.join(root, 'index.html'), 'edit');
  const client = fakeClient(false, manifest);
  await deploy(client, root, { host: 'ftp.example.com', user: 'deploy', password: 'test' });
  const uploads = client.calls.filter(call => call[0] === 'uploadFrom' && typeof call[1] === 'string');
  assert.deepEqual(uploads.map(call => path.relative(root, call[1])), ['index.html']);
});

test('a failed partial deployment never saves a new manifest', async t => {
  const client = fakeClient(true);
  await assert.rejects(deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'test' }));
  assert.equal(client.calls.some(call => call[0] === 'rename' && call[2] === '.deploy-manifest.json'), false);
});

test('unexpected manifest download errors fail before uploads', async t => {
  const client = fakeClient();
  client.downloadTo = async () => { throw new Error('Connection lost'); };
  await assert.rejects(deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'test' }));
  assert.equal(client.calls.some(call => call[0] === 'uploadFrom'), false);
});

test('failed upload never publishes the entry point and closes connection', async t => {
  const client = fakeClient(true);
  await assert.rejects(deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'test' }));
  assert.equal(client.calls.some(call => call[0] === 'rename'), false);
  assert.equal(client.calls.at(-1)[0], 'close');
});

test('connection errors identify the failing stage', async t => {
  const client = fakeClient();
  client.login = async () => { throw new Error('Login rejected'); };
  await assert.rejects(deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'secret' }), error => {
    assert.equal(error.deployStage, 'authenticating the deployment account');
    return true;
  });
  assert.equal(client.calls.at(-1)[0], 'close');
});

test('protocol trace logs only command verbs and reply codes', () => {
  assert.equal(protocolTrace('> PASS extremely-private-password'), 'FTP command: PASS');
  assert.equal(protocolTrace('> USER private-user'), 'FTP command: USER');
  assert.equal(protocolTrace('< 530 Login rejected for private-user\r\n'), 'FTP reply: 530');
  assert.equal(protocolTrace('arbitrary sensitive text'), '');
});

test('error details redact credentials and raw PASS commands', () => {
  const error = new Error('ftp.example.com rejected deploy-user using private-password\nPASS unexpected-secret');
  error.deployStage = 'connecting';
  const message = safeError(error, { host: 'ftp.example.com', user: 'deploy-user', password: 'private-password' });
  assert.match(message, /while connecting/);
  for (const secret of ['ftp.example.com', 'deploy-user', 'private-password', 'unexpected-secret']) {
    assert.equal(message.includes(secret), false);
  }
  assert.equal(message.includes('\n'), false);
});
