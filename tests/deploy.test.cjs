const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { deploymentFiles, deploy, safeError } = require('../deployment/deploy.cjs');

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

function fakeClient(fail = false) {
  const calls = [];
  const client = { calls, close() { calls.push(['close']); } };
  for (const name of ['access', 'cd', 'size', 'ensureDir', 'uploadFrom', 'rename']) {
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
  assert.equal(client.calls[0][1].secure, true);
  assert.deepEqual(client.calls[1], ['cd', '/new-site']);
  const renames = client.calls.filter(call => call[0] === 'rename');
  assert.equal(renames.at(-1)[2], 'index.html');
  assert.equal(client.calls.some(call => call[0] === 'remove'), false);
  assert.equal(client.calls.at(-1)[0], 'close');
});

test('failed upload never publishes the entry point and closes connection', async t => {
  const client = fakeClient(true);
  await assert.rejects(deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'test' }));
  assert.equal(client.calls.some(call => call[0] === 'rename'), false);
  assert.equal(client.calls.at(-1)[0], 'close');
});

test('connection errors identify the failing stage', async t => {
  const client = fakeClient();
  client.access = async () => { throw new Error('Login rejected'); };
  await assert.rejects(deploy(client, fixture(t), { host: 'ftp.example.com', user: 'deploy', password: 'secret' }), error => {
    assert.equal(error.deployStage, 'connecting and authenticating over FTPS');
    return true;
  });
  assert.equal(client.calls.at(-1)[0], 'close');
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
