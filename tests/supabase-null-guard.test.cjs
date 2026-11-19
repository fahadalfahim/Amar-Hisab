const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression: TS18047 was triggered because a nullable Supabase client
// was accessed inside a callback after a guard on the imported variable.
test('refresh captures and checks Supabase client before creating paged callbacks', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/context/AppContext.tsx'), 'utf8');
  const refresh = source.split('const refresh = useCallback(async () => {')[1]?.split('\n  useEffect(() => {')[0];
  assert.ok(refresh, 'refresh callback must exist');
  assert.match(refresh, /const client = supabase;\s*if \(!client \|\| !session\?\.user\) return;/);
  assert.ok(!refresh.includes('supabase.from('), 'do not use nullable global in nested query callbacks');
  assert.equal((refresh.match(/client\.from\(/g) || []).length, 6, 'all six queries use checked client');
});
