const fs = require('fs');

let content = fs.readFileSync("server.ts", "utf-8");

content = content.split("/api/v3/account").join("/v2/wallet/balances");
content = content.split("/api/v3/openOrders").join("/v2/orders");
content = content.split("/api/v3/myTrades").join("/v2/fills");
content = content.split("/api/v3/ticker/price").join("/v2/tickers");
content = content.split("/api/v3/ticker/24hr").join("/v2/tickers");
content = content.split("/api/v3/order").join("/v2/orders");
content = content.split("X-MBX-APIKEY").join("dummy-key");

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Done");
