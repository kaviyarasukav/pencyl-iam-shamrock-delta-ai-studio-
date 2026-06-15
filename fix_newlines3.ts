import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

let modified = false;
if (content.includes("\\n")) {
    content = content.split("\\n").join("\\n");
    modified = true;
}

if (modified) {
    fs.writeFileSync("server.ts", content, "utf-8");
    console.log("Done. Replaced string newlines.");
} else {
    console.log("No string newlines found.");
}
