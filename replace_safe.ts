import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

function replaceExact(oldStr: string, newStr: string) {
    if (!content.includes(oldStr)) {
        console.error("COULD NOT FIND:", oldStr.substring(0, 100));
    } else {
        content = content.replace(oldStr, newStr);
    }
}

// 5. Exchange Info
replaceExact(
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/exchangeInfo\`,
      );
      setCachedData(cacheKey, response.data);
      cached = response.data;`,
`      const response = await deltaAxios.get(\`\${deltaBaseUrl}/v2/products\`);
      if (!response.data.success) throw new Error("API error");
      const mappedData = {
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
      setCachedData(cacheKey, mappedData);
      cached = mappedData;`
);

// Wallet summary
replaceExact(
`      const signedQuery = signRequest({ timestamp: Date.now() });
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/account?\${signedQuery}\`,
        {
          headers: { "X-MBX-APIKEY": activeApiKey },
        },
      );
      res.json(response.data);`,
`      const headers = getDeltaAuthHeaders('GET', '/v2/wallet/balances');
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
      res.json(accountData);`
);

// Open Orders
replaceExact(
`      const signedQuery = signRequest({ symbol, timestamp: Date.now() });
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/openOrders?\${signedQuery}\`,
        {
          headers: { "X-MBX-APIKEY": activeApiKey },
        },
      );
      res.json(response.data);`,
`      const queryParams = \`?product_id=\${symbol}&state=open,pending\`;
      const headers = getDeltaAuthHeaders('GET', '/v2/orders', queryParams);
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/orders\${queryParams}\`,
        { headers }
      );
      if(!response.data.success) throw new Error("API Error");
      const mappedOrders = response.data.result.map((o: any) => ({
          orderId: o.id,
          clientOrderId: o.client_order_id,
          symbol: o.product_symbol,
          time: parseInt(o.created_at) / 1000,
          side: o.side.toUpperCase(),
          price: o.limit_price || o.stop_price || "0",
          origQty: o.size,
          status: "NEW"
      }));
      res.json(mappedOrders);`
);

// My Trades
replaceExact(
`      const signedQuery = signRequest({ symbol, timestamp: Date.now() });
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/myTrades?\${signedQuery}\`,
        {
          headers: { "X-MBX-APIKEY": activeApiKey },
        },
      );
      res.json(response.data);`,
`      const headers = getDeltaAuthHeaders('GET', '/v2/fills');
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/fills\`,
        { headers }
      );
      if(!response.data.success) throw new Error("API Error: "+JSON.stringify(response.data));
      const mapped = response.data.result
          .filter((t:(any)) => t.product_symbol === symbol)
          .map((t: any) => ({
              id: t.id,
              orderId: t.order_id,
              price: t.price,
              qty: t.size,
              time: Math.floor(parseInt(t.created_at)/1000),
              isBuyer: t.side === "buy"
          }));
      res.json(mapped);`
);

// Cancel Order
replaceExact(
`      const signedQuery = signRequest({
        symbol,
        orderId,
        timestamp: Date.now(),
      });
      const response = await deltaAxios.delete(
        \`\${deltaBaseUrl}/api/v3/order?\${signedQuery}\`,
        {
          headers: { "X-MBX-APIKEY": activeApiKey },
        },
      );
      res.json({ success: true, data: response.data });`,
`      const payloadString = JSON.stringify({ id: Number(orderId), product_symbol: symbol });
      const headers = getDeltaAuthHeaders('DELETE', '/v2/orders', '', payloadString);
      const response = await deltaAxios.delete(\`\${deltaBaseUrl}/v2/orders\`, {
          headers,
          data: { id: Number(orderId), product_symbol: symbol }
      });
      res.json({ success: response.data.success, data: response.data.result });`
);
replaceExact(
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/klines\`,
        {
          params: { symbol, interval, limit },
        },
      );`,
`      const now = Math.floor(Date.now() / 1000);
      const start = now - (24 * 60 * 60 * 30);
      let resInterval = interval;
      if (interval.endsWith("h")) resInterval = interval;
      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/history/candles?resolution=\${resInterval}&symbol=\${symbol}&start=\${start}\`
      );
      if (!response.data.success) throw new Error("API error");
      response.data = response.data.result.map((candle: any) => [
          candle.time * 1000,
          candle.open.toString(),
          candle.high.toString(),
          candle.low.toString(),
          candle.close.toString(),
          candle.volume.toString()
      ]);`
);

// 3. Orderbook
replaceExact(
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/depth\`,
        {
          params: { symbol, limit: 10 },
        },
      );`,
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/l2orderbook/\${symbol}\`
      );
      if (!response.data.success) throw new Error("API error");
      const result = response.data.result;
      response.data = {
          lastUpdateId: result.last_updated_at,
          bids: result.buy.map((b: any) => [b.price, b.size.toString()]),
          asks: result.sell.map((a: any) => [a.price, a.size.toString()])
      };`
);

// 4. Trades
replaceExact(
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/trades\`,
        {
          params: { symbol, limit: 10 },
        },
      );`,
`      const response = await deltaAxios.get(\`\${deltaBaseUrl}/v2/trades/\${symbol}\`);
      if (!response.data.success) throw new Error("API error");
      response.data = response.data.result.trades.map((t: any) => ({
          price: t.price,
          qty: t.size.toString(),
          time: t.timestamp / 1000,
          isBuyerMaker: t.side === "sell"
      }));`
);
replaceExact(
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/api/v3/ticker/24hr\`,
      );
      const popularPairs = [
        "BTCUSDT",
        "ETHUSDT",
        "BNBUSDT",
        "SOLUSDT",
        "ADAUSDT",
        "XRPUSDT",
        "DOTUSDT",
        "DOGEUSDT",
        "MATICUSDT",
        "AVAXUSDT",
      ];
      const filteredData = response.data.filter((item: any) =>
        popularPairs.includes(item.symbol),
      );`,
`      const response = await deltaAxios.get(
        \`\${deltaBaseUrl}/v2/tickers\`,
      );
      const popularPairs = [
        "BTCUSD",
        "ETHUSD",
        "BNBUSD",
        "SOLUSD",
        "ADAUSD",
        "XRPUSD",
        "DOTUSD",
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
         }));`
);

fs.writeFileSync("server.ts", content, "utf-8");
console.log("Safely replaced.");
