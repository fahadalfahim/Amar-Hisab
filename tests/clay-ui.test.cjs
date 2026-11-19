const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('src/clay-theme.css');
const app = read('src/App.tsx');

test('clay theme loaded after original styles', () => {
  const entry = read('src/main.tsx');
  assert.ok(entry.indexOf("import './styles.css'") < entry.indexOf("import './clay-theme.css'"));
});
test('clay styles support both visual themes', () => {
  assert.match(css, /:root\s*\{/);
  assert.match(css, /:root\[data-theme='dark'\]/);
  for (const selector of ['.hero-balance-card', '.stat-card', '.panel', '.sidebar', '.primary-btn', '.modal-card', '.account-card', '.mobile-bottom-nav']) {
    assert.ok(css.includes(selector), `Missing clay surface for ${selector}`);
  }
});
test('theme has responsive dock and reduced motion rule', () => {
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(app, /className="mobile-quick-add"/);
  assert.match(app, /onClick=\{\(\)=>createTransaction\(\)\}/);
});
test('PWA manifest and install prompt preserved', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /VitePWA/);
  assert.match(vite, /display: 'standalone'/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /appinstalled/);
  assert.match(app, /Add to Home Screen/);
});
test('clay styles contain no remote assets or unsafe CSS imports', () => {
  assert.doesNotMatch(css, /@import\s/);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:\/\//);
});
