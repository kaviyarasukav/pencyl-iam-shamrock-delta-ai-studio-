import * as fs from "fs";

let serverCode = fs.readFileSync("server.ts", "utf-8");

// Replacements

serverCode = serverCode.replace(/process\.env\.BINANCE_USE_TESTNET/g, 'process.env.DELTA_USE_TESTNET');
serverCode = serverCode.replace(/BINANCE_API_KEY/g, 'DELTA_API_KEY');
serverCode = serverCode.replace(/BINANCE_SECRET_KEY/g, 'DELTA_SECRET_KEY');

serverCode = serverCode.replace(/let binanceBaseUrl.*?;/s, `let deltaBaseUrl: string = useTestnet ? "https://cdn-ind.testnet.deltaex.org" : "https://api.india.delta.exchange";`);
serverCode = serverCode.replace(/binanceBaseUrl = useTestnet.*?;/s, `deltaBaseUrl = useTestnet ? "https://cdn-ind.testnet.deltaex.org" : "https://api.india.delta.exchange";`);

serverCode = serverCode.replace(/const BINANCE_WS_URL = ".*?";/, `const DELTA_WS_URL = useTestnet ? "wss://socket-ind.testnet.deltaex.org" : "wss://socket.india.delta.exchange";
const DELTA_PUBLIC_WS_URL = useTestnet ? "wss://socket-ind-pub.testnet.deltaex.org" : "wss://public-socket.india.delta.exchange";`);

serverCode = serverCode.replace(/binanceAxios/g, 'deltaAxios');
serverCode = serverCode.replace(/binanceBaseUrl/g, 'deltaBaseUrl');
serverCode = serverCode.replace(/binance/ig, 'delta');

// Write back
fs.writeFileSync("server.ts", serverCode, "utf-8");
console.log("Migration script executed.");
