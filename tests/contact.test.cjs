const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(fetch, selectedFiles = []) {
  const button = { innerHTML: 'Odoslať', disabled: false };
  const error = { hidden: true };
  const success = { focus() {} };
  const files = { files: selectedFiles, addEventListener() {} };
  const classes = new Set();
  let submit;
  const form = {
    action: 'https://hantverk.sk/contact.php',
    querySelector: selector => selector === '.form-ok' ? success : button,
    reportValidity: () => true,
    addEventListener: (_, handler) => { submit = handler; },
    setAttribute() {}, removeAttribute() {},
    classList: { add: value => classes.add(value) },
  };
  const elements = { form, 'f-file': files, 'form-error': error };
  vm.runInNewContext(fs.readFileSync('assets/contact.js', 'utf8'), {
    document: { getElementById: id => elements[id] },
    fetch, FormData: class {}, SyntaxError, TypeError,
  });
  return { submit: () => submit({ preventDefault() {} }), classes, button, error };
}

test('success appears only after server acceptance', async () => {
  let complete;
  const app = setup(() => new Promise(resolve => { complete = resolve; }));
  const pending = app.submit();
  assert.equal(app.classes.has('sent'), false);
  assert.equal(app.button.disabled, true);
  complete({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.equal(app.classes.has('sent'), true);
  assert.equal(app.button.disabled, false);
});

test('SMTP rejection preserves form and displays server error', async () => {
  const app = setup(async () => ({ ok: false, json: async () => ({ ok: false, message: 'Skúste znova.' }) }));
  await app.submit();
  assert.equal(app.classes.has('sent'), false);
  assert.equal(app.error.textContent, 'Skúste znova.');
  assert.equal(app.error.hidden, false);
  assert.equal(app.button.disabled, false);
});

test('network failure permits retry without false success', async () => {
  const app = setup(async () => { throw new TypeError('Failed to fetch'); });
  await app.submit();
  assert.equal(app.classes.has('sent'), false);
  assert.match(app.error.textContent, /info@hantverk.sk/);
  assert.equal(app.button.disabled, false);
});

test('oversized attachments are rejected before sending', async () => {
  const app = setup(() => assert.fail('must not send'), [{ size: 11 * 1024 * 1024 }]);
  await app.submit();
  assert.equal(app.error.hidden, false);
  assert.equal(app.classes.has('sent'), false);
});

test('duplicate submit does not send twice', async () => {
  let calls = 0;
  let complete;
  const app = setup(() => { calls++; return new Promise(resolve => { complete = resolve; }); });
  const first = app.submit();
  await app.submit();
  assert.equal(calls, 1);
  complete({ ok: true, json: async () => ({ ok: true }) });
  await first;
});
