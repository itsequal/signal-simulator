

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_PATH || '/';
const dist = path.resolve('dist');
const assets = path.join(dist, 'assets');
const MAX_FILE_BYTES = 1_400_000;
const MAX_TOTAL_JS_BYTES = 2_000_000;
const failures = [];

const jsFiles = readdirSync(assets).filter((name) => name.endsWith('.js'));
let totalJs = 0;
for (const name of jsFiles) {
  const size = statSync(path.join(assets, name)).size;
  totalJs += size;
  if (size > MAX_FILE_BYTES) failures.push(`${name} ocupa ${size} bytes (máximo ${MAX_FILE_BYTES})`);
}
if (totalJs > MAX_TOTAL_JS_BYTES) {
  failures.push(`JavaScript total ${totalJs} bytes (máximo ${MAX_TOTAL_JS_BYTES}); ¿se importó el bundle completo de Plotly?`);
}

const worker = jsFiles.filter((name) => name.startsWith('dsp.worker'));
const worklet = jsFiles.filter((name) => name.startsWith('capture.worklet'));
if (worker.length !== 1) failures.push(`se esperaba un único dsp.worker-*.js y hay ${worker.length}`);
if (worklet.length !== 1) {
  failures.push(`se esperaba un único capture.worklet-*.js y hay ${worklet.length}`);
} else {
  const code = readFileSync(path.join(assets, worklet[0]), 'utf8');
  if (/(^|[;\s}])import\s*[\s{*'"(]/m.test(code) || /\bimport\s*\(/.test(code)) {
    failures.push(`${worklet[0]} contiene importaciones; el módulo AudioWorklet debe ser autocontenido`);
  }
}

const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const expectedPrefix = `${base}assets/`;
if (!html.includes(`src="${expectedPrefix}`)) {
  failures.push(`index.html no referencia los assets con el prefijo ${expectedPrefix}`);
}

console.log(`JS: ${jsFiles.length} archivos, ${totalJs} bytes; base ${base}`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}
console.log('✓ Bundle correcto');
