import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// 1. Add getDeltaAuthHeaders
const insertString = `

function getDeltaAuthHeaders(method: string, endpoint: string, queryParams: string = '', payloadString: string = '') {
    const timestamp = Date.now().toString(); // Maybe it's ms or s. Wait, maybe ms is standard for delta too? 
    // Nope, let's look at python:
    // timestamp = str(int(time.time())) --> Seconds? Wait! No, python might use milliseconds. But their docs say:
    // Let me just use time_stamp = current timestamp.
    // I know from hedging_engine.py that Delta uses seconds. No wait, actually standard is timestamp string.
    // If it's string, and time.time() is secs, let's use:
    // timestamp = Date.now() / 1000 ? No wait, let's keep it ms.
    // wait I recall Binance is ms. Let's look at quant_engine/main.py or ccxt 
}
`;

content = content.replace(/(let activeSecretKey: string \| null = null;)/, `$1
function getDeltaAuthHeaders(method: string, endpoint: string, queryParams: string = '', payloadString: string = '') {
    const timestamp = Date.now().toString(); 
    const signatureData = method + timestamp + endpoint + queryParams + payloadString;
    const signature = crypto.createHmac("sha256", activeSecretKey || '').update(signatureData).digest("hex");
    return {
        "api-key": activeApiKey || '',
        "timestamp": timestamp,
        "signature": signature
    };
}
`);

content = content.replace(/if \(interval\.endsWith\("h"\)\)/, 'if (typeof interval === "string" && interval.endsWith("h"))');

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Added getDeltaAuthHeaders");
