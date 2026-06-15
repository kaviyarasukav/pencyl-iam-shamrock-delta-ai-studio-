import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(/\\n    try \\{\\n      res\\.json\\(\\[\\]\\);/g, '\\n    try {\\n      res.json([]);\\n');

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Fixed newlines");
