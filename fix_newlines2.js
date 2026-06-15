const fs = require('fs');
let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(/\\\\n/g, '\\n'); // this works in js replace with regex since we want to replace two backslashes.

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Done");
