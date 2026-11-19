const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='dist')continue;const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else if(/\.(tsx?|jsx?)$/.test(e.name))files.push(full);}}
walk(path.join(root,'src'));
for(const n of ['vite.config.ts','vitest.config.ts'])files.push(path.join(root,n));
const code=()=>files.map(f=>[f,fs.readFileSync(f,'utf8')]);

test('all project TypeScript and TSX files have valid syntax',()=>{
  for(const [f,txt] of code()){
    const syntax=f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
    const source=ts.createSourceFile(f,txt,ts.ScriptTarget.ES2022,true,syntax);
    assert.equal(source.parseDiagnostics.length,0,`${path.basename(f)}: ${source.parseDiagnostics.map(x=>x.messageText).join(';')}`);
  }
});
test('all relative imports point to a real file',()=>{
  for(const [f,txt] of code()){
    for(const [,s] of txt.matchAll(/\b(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)){
      const target=path.resolve(path.dirname(f),s);
      assert.ok([target,...['.ts','.tsx','.js','.jsx','.css','.json'].map(ext=>target+ext),path.join(target,'index.ts'),path.join(target,'index.tsx')].some(fs.existsSync),`${f}: missing ${s}`);
    }
  }
});
test('PWA and Cloudflare public assets exist',()=>{
  for(const f of ['public/pwa-192.png','public/pwa-512.png','public/pwa-maskable-512.png','public/_headers','index.html','vite.config.ts'])assert.ok(fs.existsSync(path.join(root,f)),`Missing ${f}`);
});
test('no private credentials are included in the project archive',()=>{
  const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
  assert.doesNotMatch(env,/sb_secret_[a-zA-Z0-9]{12}/);
  assert.ok(!fs.existsSync(path.join(root,'.env.local')));
  assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/node_modules/);
});
test('SQL schema and security upgrade remain untouched',()=>{
  const db=fs.readFileSync(path.join(root,'supabase/migrations/202611180001_initial_schema.sql'),'utf8');
  const security=fs.readFileSync(path.join(root,'supabase/migrations/202611190002_account_security.sql'),'utf8');
  for(const signature of ['create_money_transaction','create_debt_record','record_debt_payment','create_internal_transfer','row level security'])assert.ok(db.includes(signature));
  assert.match(security,/grant update\(name, archived_at\)/);
});
