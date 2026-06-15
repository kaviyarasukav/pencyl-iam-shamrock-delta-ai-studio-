import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace(/BINANCE_USE_TESTNET/g, "DELTA_USE_TESTNET");
// Replace Binance strings
content = content.replace(/Binance Options/g, "Delta Options");
content = content.replace(/Binance API keys/g, "Delta API keys");
content = content.replace(/Binance Exchange Info/g, "Delta Exchange Info");
content = content.replace(/Binance Error/g, "Delta Error");
content = content.replace(/Binance rate limits/g, "Delta rate limits");
content = content.replace(/Binance deprecated/g, "Delta has deprecated");
content = content.replace(/Binance/g, "Delta");
content = content.replace(/binance/g, "delta");

fs.writeFileSync("server.ts", content, "utf-8");
console.log("fixed server.ts binance references");
