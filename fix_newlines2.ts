import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(/\\n/g, '\\n'); // Actually I want to match literal backslash n, which is /\\\\n/g

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Done");
