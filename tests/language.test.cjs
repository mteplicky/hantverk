const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { render, assertCoverage } = require('../deployment/build-site.cjs');
const source = fs.readFileSync('index.html', 'utf8');

function projects(html) {
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  new vm.Script(script); // All inline UI code must still parse after translation.
  const end = script.indexOf('\n];') + 3;
  return vm.runInNewContext(script.slice(0, end) + '\nJSON.stringify(P)');
}

test('both languages have correct document language, canonical and reciprocal alternatives', () => {
  for (const [language, domain] of [['sk', 'hantverk.sk'], ['cs', 'hantverk.cz']]) {
    const html = render(source, language);
    assert.ok(html.includes(`<html lang="${language}">`));
    assert.ok(html.includes(`<link rel="canonical" href="https://${domain}/">`));
    assert.ok(html.includes('hreflang="sk" href="https://hantverk.sk/"'));
    assert.ok(html.includes('hreflang="cs" href="https://hantverk.cz/"'));
    const active = [...html.matchAll(/<a[^>]*data-language="([^"]+)"[^>]*aria-current="page"/g)];
    assert.equal(active.length, 1);
    assert.equal(active[0][1], language);
  }
});

test('Czech version translates page, accessibility labels, form and project descriptions', () => {
  const cs = render(source, 'cs');
  assert.ok(cs.includes('Promyšlené do&nbsp;posledního spoje.'));
  assert.ok(cs.includes('Hlavní navigace'));
  assert.ok(cs.includes('Půdorys nebo fotky'));
  assert.ok(cs.includes('Děkujeme, vaši zprávu jsme přijali.'));
  assert.ok(cs.includes('Prohlédnout projekt'));
  assert.ok(cs.includes('S architektem · Grau'));
  const skProjects = JSON.parse(projects(source));
  const csProjects = JSON.parse(projects(cs));
  assert.equal(csProjects.length, 13);
  csProjects.forEach((project, i) => {
    assert.equal(project.id, skProjects[i].id);
    assert.deepEqual(project.imgs, skProjects[i].imgs);
    assert.notEqual(project.desc, skProjects[i].desc);
  });
});

test('new untranslated copy stops the build instead of silently mixing languages', () => {
  assert.throws(() => assertCoverage(source.replace('</main>', '<p>Úplne nový text bez prekladu</p></main>')), /Add Czech translations/);
});

test('language picker preserves section and project links', () => {
  let handler;
  const link = { href: 'https://hantverk.cz/', addEventListener: (_, callback) => { handler = callback; } };
  vm.runInNewContext(fs.readFileSync('assets/language.js', 'utf8'), {
    document: { querySelectorAll: () => [link] }, URL, location: { hash: '#projekt-zahradnicka' },
  });
  handler();
  assert.equal(link.href, 'https://hantverk.cz/#projekt-zahradnicka');
});