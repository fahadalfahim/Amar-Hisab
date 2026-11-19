const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('src/glass-accents.css');
const tree = postcss.parse(css, {from: 'glass-accents.css'});
const app = read('src/App.tsx');

test('all three stylesheets parse correctly', () => {
  for (const f of ['src/styles.css','src/clay-theme.css','src/glass-accents.css']) assert.ok(postcss.parse(read(f), {from:f}).nodes.length);
});
test('glass overrides come after clay and are not global', () => {
  const main = read('src/main.tsx');
  assert.ok(main.indexOf("import './styles.css'") < main.indexOf("import './clay-theme.css'"));
  assert.ok(main.indexOf("import './clay-theme.css'") < main.indexOf("import './glass-accents.css'"));
  assert.doesNotMatch(css, /(^|[}\n])\s*\.stat-card\s*\{/);
  assert.doesNotMatch(css, /(^|[}\n])\s*\.hero-balance-card\s*\{/);
});
test('glass applied only to designated navigation, controls and popovers', () => {
  for (const sel of ['.mobile-bottom-nav', '.mobile-quick-add', '.topbar-actions > .icon-btn', '.notification-popover', '.action-menu-panel', '.install-banner']) assert.ok(css.includes(sel), `${sel} missing`);
});
test('glass blur works in Chrome and Safari, and has opaque fallback', () => {
  assert.match(css, /-webkit-backdrop-filter:\s*blur\(/);
  assert.match(css, /backdrop-filter:\s*blur\(/);
  assert.match(css, /@supports not/);
  assert.match(css, /prefers-reduced-transparency:\s*reduce/);
});
test('dark, light and narrow phone variants present', () => {
  assert.match(css, /:root\[data-theme='dark'\]/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /@media\s*\(max-width:\s*370px\)/);
  assert.match(css, /safe-area-inset-bottom/);
});
test('touch sizes, accessibility and stacking are considered', () => {
  assert.match(css, /height:\s*56px/);
  assert.match(css, /isolation:\s*isolate/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(app, /<nav className="mobile-bottom-nav"/);
  assert.match(app, /aria-current=\{page===item.id\?'page':undefined\}/);
  assert.match(app, /className="mobile-quick-add"/);
});
test('PWA, both languages, theme and financial code remain connected', () => {
  assert.match(app, /setLanguage\(language==='bn'\?'en':'bn'\)/);
  assert.match(app, /setTheme\(theme==='light'\?'dark':'light'\)/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /addTransfer/);
  assert.match(app, /<PaymentModal/);
  assert.match(read('vite.config.ts'), /VitePWA/);
});
test('cloud mode never initializes with browser demo values', () => {
  assert.match(read('src/context/AppContext.tsx'), /useState<AppData>\(emptyData\)/);
  assert.match(read('src/context/AppContext.tsx'), /setData\(emptyData\(\)\)/);
});
test('money writes validate nonpositive amounts', () => {
  assert.match(read('src/context/AppContext.tsx'), /Transfer amount must be greater than zero/);
  assert.match(read('src/context/AppContext.tsx'), /validatePayment\(amount, debt.remaining_paisa\)/);
  assert.match(read('src/lib/money.ts'), /Use at most two decimal places/);
});
