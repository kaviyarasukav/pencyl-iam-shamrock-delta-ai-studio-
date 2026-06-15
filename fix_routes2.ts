import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

function replaceFunction(endpointStr: string, replacement: string) {
    const idx = content.indexOf(endpointStr);
    if (idx !== -1) {
       const catchIdx = content.indexOf('    } catch', idx);
       if (catchIdx !== -1) {
           content = content.substring(0, idx) + replacement + content.substring(catchIdx);
       }
    }
}

replaceFunction('  app.get("/api/portfolio", async (req, res) => {',
'  app.get("/api/portfolio", async (req, res) => {\\n' +
'    try {\\n' +
'      if (!activeApiKey || !activeSecretKey) return res.status(401).json({ error: "API keys not configured" });\\n' +
'      const headers = getDeltaAuthHeaders("GET", "/v2/wallet/balances");\\n' +
'      const response = await deltaAxios.get(`${deltaBaseUrl}/v2/wallet/balances`, { headers });\\n' +
'      if(!response.data.success) throw new Error("API Error");\\n' +
'      const accountData = {\\n' +
'          balances: response.data.result.map((b: any) => ({\\n' +
'              asset: b.asset_symbol,\\n' +
'              free: b.available_balance,\\n' +
'              locked: b.blocked_margin\\n' +
'          }))\\n' +
'      };\\n' +
'      res.json(accountData);'
);

replaceFunction('  app.get("/api/openOrders/:symbol", async (req, res) => {',
'  app.get("/api/openOrders/:symbol", async (req, res) => {\\n' +
'    const { symbol } = req.params;\\n' +
'    if (!activeApiKey || !activeSecretKey) return res.status(401).json({ error: "API keys not configured" });\\n' +
'    try {\\n' +
'      const queryParams = `?product_id=${symbol}&state=open,pending`;\\n' +
'      const headers = getDeltaAuthHeaders("GET", "/v2/orders", queryParams);\\n' +
'      const response = await deltaAxios.get(`${deltaBaseUrl}/v2/orders${queryParams}`, { headers });\\n' +
'      if(!response.data.success) throw new Error("API Error");\\n' +
'      const mappedOrders = response.data.result.map((o: any) => ({\\n' +
'          orderId: o.id,\\n' +
'          clientOrderId: o.client_order_id,\\n' +
'          symbol: o.product_symbol,\\n' +
'          time: parseInt(o.created_at || "0") / 1000,\\n' +
'          side: o.side.toUpperCase(),\\n' +
'          price: o.limit_price || o.stop_price || "0",\\n' +
'          origQty: o.size,\\n' +
'          status: "NEW"\\n' +
'      }));\\n' +
'      res.json(mappedOrders);'
);

replaceFunction('  app.get("/api/myTrades/:symbol", async (req, res) => {',
'  app.get("/api/myTrades/:symbol", async (req, res) => {\\n' +
'    const { symbol } = req.params;\\n' +
'    if (!activeApiKey || !activeSecretKey) return res.status(401).json({ error: "API keys not configured" });\\n' +
'    try {\\n' +
'      const headers = getDeltaAuthHeaders("GET", "/v2/fills");\\n' +
'      const response = await deltaAxios.get(`${deltaBaseUrl}/v2/fills`, { headers });\\n' +
'      if(!response.data.success) throw new Error("API Error");\\n' +
'      const mapped = response.data.result\\n' +
'          .filter((t:(any)) => t.product_symbol === symbol)\\n' +
'          .map((t: any) => ({\\n' +
'              id: t.id,\\n' +
'              orderId: t.order_id,\\n' +
'              price: t.price,\\n' +
'              qty: t.size,\\n' +
'              time: Math.floor(parseInt(t.created_at || "0")/1000),\\n' +
'              isBuyer: t.side === "buy"\\n' +
'          }));\\n' +
'      res.json(mapped);'
);

replaceFunction('  app.delete("/api/order", async (req, res) => {',
'  app.delete("/api/order", async (req, res) => {\\n' +
'    const { symbol, orderId } = req.body;\\n' +
'    if (!activeApiKey || !activeSecretKey) return res.status(401).json({ error: "API keys not configured" });\\n' +
'    try {\\n' +
'      const payloadString = JSON.stringify({ id: Number(orderId), product_symbol: symbol });\\n' +
'      const headers = getDeltaAuthHeaders("DELETE", "/v2/orders", "", payloadString);\\n' +
'      const response = await deltaAxios.delete(`${deltaBaseUrl}/v2/orders`, { headers, data: { id: Number(orderId), product_symbol: symbol } });\\n' +
'      res.json({ success: response.data.success, data: response.data.result });'
);

replaceFunction('  app.get("/api/deposits", async (req, res) => {',
'  app.get("/api/deposits", async (req, res) => {\\n' +
'    try {\\n' +
'      res.json([]);'
);

replaceFunction('  app.get("/api/withdrawals", async (req, res) => {',
'  app.get("/api/withdrawals", async (req, res) => {\\n' +
'    try {\\n' +
'      res.json([]);'
);

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Replaced stuff");
