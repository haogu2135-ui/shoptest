const fs=require('fs');
const p='/home/guhao/shoptest/tmp-audit-order.js';
const l=fs.readFileSync(p,'utf8').split('\n');
const i=l.findIndex(s=>s.includes('chromium.launch('));
console.log(i, l[i]);
l[i]=l[i].replace('{ headless: true }','X');
A
