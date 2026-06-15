import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// We need to replace the signature function.
const sigReplacement = `
function signRequest(payloadObj: any = {}, secretKey?: string): string {
    // Delta uses custom headers, so signRequest will return the query string un-signed, or we can rework authentication.
    // Instead of signRequest returning a query string, let's create a getAuthHeaders for Delta
    return '';
}

function getDeltaAuthHeaders(method: string, path: string, queryParams: string = '', payloadString: string = '', customKey?: string, customSecret?: string) {
    const key = customKey || activeApiKey;
    const secret = customSecret || activeSecretKey;
    if (!key || !secret) {
        throw new Error("Missing API Keys");
    }
    const timestamp = Date.now().toString();
    const signatureData = method + timestamp + path + queryParams + payloadString;
    const signature = require("crypto").createHmac('sha256', secret).update(signatureData).digest('hex');
    
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': key,
        'timestamp': timestamp,
        'signature': signature
    };
}
`;

// Replace `export function signRequest...` block
content = content.replace(/export function signRequest.*?return queryString;\n}/s, sigReplacement);


// Ticker
const tickerBinance = /const response = await deltaAxios\.get\([\s\S]*?\n\s+`\$\{deltaBaseUrl\}\/api\/v3\/ticker\/24hr`,\n\s+\)[\s\S]*?res\.json\(filteredData\);/;
const tickerDelta = `
      const response = await deltaAxios.get(\`\${deltaBaseUrl}/v2/tickers\`);
      const popularPairs = [
        "BTCUSD",
        "ETHUSD",
        "SOLUSD",
        "BNBUSD",
        "XRPUSD",
        "DOGEUSD",
      ];
      if (!response.data.success) throw new Error("API error");
      const filteredData = response.data.result
        .filter((item: any) => popularPairs.includes(item.symbol))
        .map((item: any) => ({
            symbol: item.symbol,
            priceChangePercent: ((parseFloat(item.ltp_change_24h) || 0) * 100).toString(),
            lastPrice: item.spot_price || item.close,
            volume: item.volume,
            highPrice: item.high,
            lowPrice: item.low
        }));
      setCachedData(cacheKey, filteredData);
      res.json(filteredData);
`;
content = content.replace(tickerBinance, tickerDelta);


// Klines
const klinesBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/klines`[\s\S]*?res\.json\(filteredData\);/;

const klinesDelta = `
      // Delta needs resolution like 1m, 5m, 1h, 1d
      const now = Math.floor(Date.now() / 1000);
      const start = now - (24 * 60 * 60 * 30); // 30 days
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/history/candles?resolution=\${interval}&symbol=\${symbol}&start=\${start}\`
      );
      if (!response.data.success) throw new Error("API error");
      const filteredData = response.data.result.map((candle: any) => [
          candle.time * 1000,
          candle.open.toString(),
          candle.high.toString(),
          candle.low.toString(),
          candle.close.toString(),
          candle.volume.toString()
      ]);
      setCachedData(cacheKey, filteredData);
      res.json(filteredData);
`;
content = content.replace(klinesBinance, klinesDelta);

// Orderbook
const depthBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/depth`[\s\S]*?res\.json\(filteredData\);/;
const depthDelta = `
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/l2orderbook/\${symbol}\`
      );
      if (!response.data.success) throw new Error("API error");
      const result = response.data.result;
      const filteredData = {
          lastUpdateId: result.last_updated_at,
          bids: result.buy.map((b: any) => [b.price, b.size.toString()]),
          asks: result.sell.map((a: any) => [a.price, a.size.toString()])
      };
      setCachedData(cacheKey, filteredData);
      res.json(filteredData);
`;
content = content.replace(depthBinance, depthDelta);

// Trades
const tradesBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/trades`[\s\S]*?res\.json\(filteredData\);/;
const tradesDelta = `
      const response = await deltaAxios.get(\`\${deltaBaseUrl}/v2/trades/\${symbol}\`);
      if (!response.data.success) throw new Error("API error");
      const filteredData = response.data.result.trades.map((t: any) => ({
          price: t.price,
          qty: t.size.toString(),
          time: t.timestamp / 1000,
          isBuyerMaker: t.side === "sell"
      }));
      setCachedData(cacheKey, filteredData);
      res.json(filteredData);
`;
content = content.replace(tradesBinance, tradesDelta);

// ExchangeInfo (Product Details)
const exchangeInfoBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/exchangeInfo`,\s+\);[\s\S]*?res\.json\(response\.data\);/;
const exchangeInfoDelta = `
      const response = await deltaAxios.get(\`\${deltaBaseUrl}/v2/products\`);
      if (!response.data.success) throw new Error("API error");
      const filteredData = {
          symbols: response.data.result.map((p: any) => ({
              symbol: p.symbol,
              baseAsset: p.underlying_asset?.symbol,
              quoteAsset: p.quoting_asset?.symbol,
              status: p.state === "live" ? "TRADING" : "BREAK",
              filters: [
                  { filterType: "PRICE_FILTER", tickSize: p.tick_size },
                  { filterType: "LOT_SIZE", stepSize: "1", minQty: "1", maxQty: p.position_size_limit?.toString() }
              ],
              productId: p.id
          }))
      };
      setCachedData(cacheKey, filteredData);
      res.json(filteredData);
`;
content = content.replace(exchangeInfoBinance, exchangeInfoDelta);


// Wallet summary
const walletBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/account\?\$\{signedQuery\}`,\s+\{\s+headers: \{ "X-MBX-APIKEY": activeApiKey \},\s+\},\s+\);\s+res\.json\(response\.data\);/;
const walletDelta = `
      const headers = getDeltaAuthHeaders('GET', '/v2/wallet/balances');
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/wallet/balances\`,
        { headers }
      );
      if(!response.data.success) throw new Error("API Error");
      const accountData = {
          balances: response.data.result.map((b: any) => ({
              asset: b.asset_symbol,
              free: b.available_balance,
              locked: b.blocked_margin
          }))
      };
      res.json(accountData);
`;
content = content.replace(walletBinance, walletDelta);


// Open Orders
const openOrdersBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/openOrders\?\$\{signedQuery\}`,\s+\{\s+headers: \{ "X-MBX-APIKEY": activeApiKey \},\s+\},\s+\);\s+res\.json\(response\.data\);/;
const openOrdersDelta = `
      const queryParams = \`?state=open,pending\`;
      const headers = getDeltaAuthHeaders('GET', '/v2/orders', queryParams);
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/orders\${queryParams}\`,
        { headers }
      );
      if(!response.data.success) throw new Error("API Error");
      const mappedOrders = response.data.result.filter((o:any)=> o.product_symbol===symbol).map((o: any) => ({
          orderId: o.id,
          symbol: o.product_symbol,
          time: Math.floor(parseInt(o.created_at) / 1000),
          side: o.side.toUpperCase(),
          price: o.limit_price || o.stop_price || "0",
          origQty: o.size,
          status: "NEW"
      }));
      res.json(mappedOrders);
`;
content = content.replace(openOrdersBinance, openOrdersDelta);

// Cancel Order
const cancelOrderBinance = /const response = await deltaAxios\.delete\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/order\?\$\{signedQuery\}`,\s+\{\s+headers: \{ "X-MBX-APIKEY": activeApiKey \},\s+\},\s+\);\s+res\.json\(\{ success: true, data: response\.data \}\);/;
const cancelOrderDelta = `
      const payloadString = JSON.stringify({ id: Number(orderId), product_symbol: symbol });
      const headers = getDeltaAuthHeaders('DELETE', '/v2/orders', '', payloadString);
      const response = await deltaAxios.delete(
        \`\${deltaBaseUrl}/v2/orders\`,
        { headers, data: { id: Number(orderId), product_symbol: symbol } }
      );
      res.json({ success: true, data: response.data });
`;
content = content.replace(cancelOrderBinance, cancelOrderDelta);

// My Trades
const myTradesBinance = /const response = await deltaAxios\.get\([\s\S]*?`\$\{deltaBaseUrl\}\/api\/v3\/myTrades\?\$\{signedQuery\}`,\s+\{\s+headers: \{ "X-MBX-APIKEY": activeApiKey \},\s+\},\s+\);\s+res\.json\(response\.data\);/;
const myTradesDelta = `
      // Delta fills
      const headers = getDeltaAuthHeaders('GET', '/v2/fills');
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/fills\`,
        { headers }
      );
      if(!response.data.success) throw new Error("API error");
      const myTrades = response.data.result.filter((t: any)=>t.product_symbol===symbol).map((t: any) => ({
          id: t.id,
          orderId: t.order_id,
          price: t.price,
          qty: t.size,
          time: t.created_at ? Math.floor(parseInt(t.created_at)/1000) : Date.now(),
          isBuyer: t.side === "buy"
      }));
      res.json(myTrades);
`;
content = content.replace(myTradesBinance, myTradesDelta);


fs.writeFileSync("server.ts", content, "utf-8");
console.log("Rewritten route handlers for Delta API REST.");
