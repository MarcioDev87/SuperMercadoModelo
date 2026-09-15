const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
let scriptCount = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const inlineScripts = html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [index, match] of [...inlineScripts].entries()) {
    new vm.Script(match[1], { filename: `${file}:inline-${index + 1}` });
    scriptCount += 1;
  }
}

console.log(`Scripts inline válidos: ${scriptCount} em ${htmlFiles.length} arquivos HTML.`);
