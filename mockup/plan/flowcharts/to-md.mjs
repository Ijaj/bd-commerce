// Generates ../11-flowcharts.md from flows.js.  Run: node flowcharts/to-md.mjs  (from plan/ or any cwd)
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const win = {};
runInNewContext(readFileSync(join(dir, 'flows.js'), 'utf8'), { window: win });
const FLOWS = win.FLOWS;

const TYPES = {
  start: ['Start', '#d1fae5', '#059669', '#064e3b'],
  end:   ['End', '#ccfbf1', '#0d9488', '#134e4a'],
  step:  ['Customer step', '#dbeafe', '#2563eb', '#1e3a8a'],
  staff: ['Staff action', '#ede9fe', '#7c3aed', '#4c1d95'],
  sys:   ['System (automatic)', '#e2e8f0', '#64748b', '#1e293b'],
  dec:   ['Decision', '#fef3c7', '#d97706', '#78350f'],
  ext:   ['External service', '#cffafe', '#0891b2', '#164e63'],
  bad:   ['Error / cancel', '#fee2e2', '#dc2626', '#7f1d1d'],
};

const q = s => '"' + String(s).replace(/"/g, "'") + '"';
const shape = (t, label) => {
  const l = q(label);
  return t === 'start' || t === 'end' ? `([${l}])` : t === 'dec' ? `{{${l}}}` : t === 'ext' ? `[/${l}/]` : `[${l}]`;
};
// mermaid keywords can't be bare node ids
const RESERVED = /^(end|graph|subgraph|class|classDef|style|click|default|flowchart|direction|linkStyle)$/i;
const mid = id => (RESERVED.test(id) ? id + '_' : id);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let out = `# 11 — Flowcharts

> Generated from \`flowcharts/flows.js\` by \`node flowcharts/to-md.mjs\` — do not hand-edit. The animated step-by-step version is \`flowcharts/index.html\`.

## Contents

`;
FLOWS.forEach((f, i) => { out += `${i + 1}. [${f.title}](#${i + 1}-${slug(f.title)})\n`; });
out += '\n';

FLOWS.forEach((f, i) => {
  out += `## ${i + 1}. ${f.title}\n\n${f.summary}\n\n\`\`\`mermaid\nflowchart TD\n`;
  const used = new Set();
  for (const n of f.nodes) { out += `  ${mid(n[0])}${shape(n[1], n[2])}\n`; used.add(n[1]); }
  for (const [a, b, l] of f.edges) out += l ? `  ${mid(a)} -->|${q(l)}| ${mid(b)}\n` : `  ${mid(a)} --> ${mid(b)}\n`;
  for (const t of used) { const [, bg, bd, tx] = TYPES[t]; out += `  classDef ${t} fill:${bg},stroke:${bd},color:${tx}${t === 'ext' ? ',stroke-dasharray:4 3' : ''}\n`; }
  for (const t of used) out += `  class ${f.nodes.filter(n => n[1] === t).map(n => mid(n[0])).join(',')} ${t}\n`;
  out += '```\n\n**Steps**\n\n';
  f.nodes.forEach((n, j) => {
    out += `${j + 1}. **${n[2]}** (${n[1]})${n[3] ? ' — ' + n[3] : ''}${n[4] ? ` ⚠ open: ${n[4]}` : ''}\n`;
  });
  out += '\n';
});

writeFileSync(join(dir, '..', '11-flowcharts.md'), out);
console.log(`wrote 11-flowcharts.md (${FLOWS.length} flows)`);
