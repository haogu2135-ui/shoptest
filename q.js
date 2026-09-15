const fs=require('fs');
const p='/home/guhao/shoptest/tmp-audit-order.js';
let l=fs.readFileSync(p,'utf8').split('\n');
const i=l.findIndex(s=>s.includes('chromium.launch('));
const opt=fs.readFileSync('opt.txt','utf8').trim();
l[i]=l[i].replace('{ headless: true }',opt);
fs.writeFileSync(p,l.join('~~'));
