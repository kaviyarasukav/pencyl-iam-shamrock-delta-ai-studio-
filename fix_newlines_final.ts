import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// We want to replace the literal characters \ and n with a real newline.
content = content.replace(/\\\\n/g, '\\n');

fs.writeFileSync("server.ts", content, "utf-8");
