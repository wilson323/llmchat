const fs = require('fs');
const p = require('path').join(__dirname, '../coverage/coverage-summary.json');
if (!fs.existsSync(p)) process.exit(1);
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log('Coverage:', s.total.lines.pct + '%');