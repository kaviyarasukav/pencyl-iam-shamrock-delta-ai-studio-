import * as fs from "fs";

let text = fs.readFileSync("server.ts", "utf-8");

// Change URLs and variables globally if they are strictly string/env names
text = text.replace(/process\.env\.BINANCE_USE_TESTNET/g, 'process.env.DELTA_USE_TESTNET');
text = text.replace(/BINANCE_API_KEY/g, 'DELTA_API_KEY');
text = text.replace(/BINANCE_SECRET_KEY/g, 'DELTA_SECRET_KEY');

text = text.replace(/let binanceBaseUrl.*?;/s, `let deltaBaseUrl: string = useTestnet ? "https://cdn-ind.testnet.deltaex.org" : "https://api.india.delta.exchange";`);
text = text.replace(/binanceBaseUrl = useTestnet.*?;/s, `deltaBaseUrl = useTestnet ? "https://cdn-ind.testnet.deltaex.org" : "https://api.india.delta.exchange";`);

text = text.replace(/const BINANCE_WS_URL = ".*?";/, `const DELTA_WS_URL = useTestnet ? "wss://socket-ind.testnet.deltaex.org" : "wss://socket.india.delta.exchange";
const DELTA_PUBLIC_WS_URL = useTestnet ? "wss://socket-ind-pub.testnet.deltaex.org" : "wss://public-socket.india.delta.exchange";`);

text = text.replace(/binanceAxios/g, 'deltaAxios');
text = text.replace(/binanceBaseUrl/g, 'deltaBaseUrl');


fs.writeFileSync("server.ts", text, "utf-8");
console.log("Replaced global strings");
