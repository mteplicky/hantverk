const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const translations = require('./translations.cs.json');

// Proper names, addresses and labels that are identical in both languages.
const unchanged = new Set([
  'Marek a&nbsp;Tomáš', 'Website', 'E-mail', 'info@hantverk.sk', 'Cukrová 14, Bratislava',
  'Hantverk', 'em, s.r.o.', 'Blumentálska 4, 811 07 Bratislava', 'IČO 54296692',
  'Instagram', '© 2026 em, s.r.o.', 'Menu', 'Jana Nováková', '+421 9xx xxx xxx', 'SK', 'CZ',
]);

function copyStrings(source) {
  const clean = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const strings = [...clean.matchAll(/>([^<>]+)</g)].map(match => match[1].trim()).filter(text => /\p{L}/u.test(text));
  for (const match of clean.matchAll(/(?:alt|aria-label|placeholder|content)="([^"]+)"/g)) {
    // Only description content is copy; viewport and charset are technical metadata.
    if (/^(?:width=|text\/|\d)/.test(match[1])) continue;
    strings.push(match[1]);
  }
  for (const match of source.matchAll(/(?:tag|line|desc): '([^']+)'/g)) strings.push(match[1]);
  return [...new Set(strings)];
}

function assertCoverage(source) {
  const missing = copyStrings(source).filter(text => !(text in translations) && !unchanged.has(text));
  if (missing.length) throw new Error('Add Czech translations for:\n' + missing.join('\n'));
}

function render(source, language) {
  assertCoverage(source);
  let html = source;
  if (language === 'cs') {
    const keys = Object.keys(translations).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    // A single pass prevents short labels from altering already translated sentences.
    html = html.replace(pattern, text => translations[text]);
    html = html.replace('<html lang="sk">', '<html lang="cs">')
      .replace('data-language="sk" aria-label="Slovenština" aria-current="page"', 'data-language="sk" aria-label="Slovenština"')
      .replace('data-language="cs" aria-label="Čeština"', 'data-language="cs" aria-label="Čeština" aria-current="page"');
  }
  const domain = language === 'cs' ? 'hantverk.cz' : 'hantverk.sk';
  const metadata = `\n<link rel="canonical" href="https://${domain}/">\n<link rel="alternate" hreflang="sk" href="https://hantverk.sk/">\n<link rel="alternate" hreflang="cs" href="https://hantverk.cz/">\n<link rel="alternate" hreflang="x-default" href="https://hantverk.sk/">\n`;
  return html.replace('</head>', metadata + '</head>');
}

function build(root = path.resolve(__dirname, '..')) {
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  for (const language of ['sk', 'cs']) {
    let html = render(source, language);
    for (const asset of ['assets/hantverk.css', 'assets/contact.js', 'assets/language.js']) {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(root, asset))).digest('hex').slice(0, 12);
      html = html.replaceAll(`"${asset}"`, `"${asset}?v=${hash}"`);
    }
    fs.writeFileSync(path.join(root, 'pages', `${language}.html`), html);
  }
  console.log('Built Slovak and Czech pages.');
}

if (require.main === module) build();
module.exports = { build, render, assertCoverage };