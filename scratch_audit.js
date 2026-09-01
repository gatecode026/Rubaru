const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\Shubh\\Desktop\\Rubaru';
const srcScreensDir = path.join(rootDir, 'src', 'screens');
const appDir = path.join(rootDir, 'app');
const srcComponentsDir = path.join(rootDir, 'src', 'components');

let out = [];

function walk(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath, path.join(base, file)));
    } else if (file.endsWith('.js')) {
      results.push({ fullPath, relPath: path.join(base, file).replace(/\\/g, '/') });
    }
  });
  return results;
}

out.push('=== SCREENS IN SRC/SCREENS ===');
const screens = fs.readdirSync(srcScreensDir).filter(f => f.endsWith('.js'));
screens.forEach(file => {
  const full = path.join(srcScreensDir, file);
  const content = fs.readFileSync(full, 'utf-8');
  const lines = content.split('\n').length;
  const apiCalls = (content.match(/api\.(get|post|put|delete|patch)\([^\)]+\)/g) || []).join('; ');
  const states = (content.match(/useState\(([^\)]*)\)/g) || []).length;
  const hasSocket = content.includes('socket') || content.includes('useSocket');
  out.push(`FILE: ${file} | LINES: ${lines} | STATES: ${states} | API: [${apiCalls}] | SOCKET: ${hasSocket}`);
});

out.push('\n=== ROUTES IN APP/ ===');
const routes = walk(appDir);
routes.forEach(r => {
  const content = fs.readFileSync(r.fullPath, 'utf-8');
  out.push(`ROUTE: /${r.relPath} | SIZE: ${content.length} chars`);
});

out.push('\n=== COMPONENTS IN SRC/COMPONENTS ===');
const comps = walk(srcComponentsDir);
comps.forEach(c => {
  const content = fs.readFileSync(c.fullPath, 'utf-8');
  const lines = content.split('\n').length;
  out.push(`COMPONENT: ${c.relPath} | LINES: ${lines}`);
});

fs.writeFileSync('C:\\Users\\Shubh\\.gemini\\antigravity-ide\\brain\\ffa8502b-71b0-4aee-b24a-12f1e72481b3\\scratch\\audit_results.txt', out.join('\n'));
console.log('Audit results saved.');
