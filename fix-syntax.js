const fs = require('fs');

// Read file line by line
const lines = fs.readFileSync('src/admin-dashboard.js', 'utf8').split('\n');

// Fix line 9 (index 8) - the escaped quotes issue
if (lines[8] && lines[8].includes('require(\\\"dotenv\\\")')) {
    console.log('Found broken line:', lines[8]);
    lines[8] = lines[8].replace(/require\(\\\"dotenv\\\"\)/, 'require("dotenv")');
    console.log('Fixed to:', lines[8]);
}

// Write back
fs.writeFileSync('src/admin-dashboard.js', lines.join('\n'), 'utf8');

console.log('✅ Fixed syntax error in admin-dashboard.js');
