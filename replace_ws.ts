import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

const startStr = 'function connectWebSocket(symbol: string) {';
const startIndex = content.indexOf(startStr);

if (startIndex !== -1) {
    // find next function
    const nextSubIndex = content.indexOf('function startOptionsStream()', startIndex);
    
    if (nextSubIndex === -1) throw new Error("nextSubIndex not found");

    const replacement = `function connectWebSocket(symbol: string) {
  const upperSymbol = symbol.toUpperCase();

  // Unified Delta WS
  if (!activeDepthWs.has(upperSymbol)) {
    console.log(\`[WS] Connecting to Delta WS for \${upperSymbol}...\`);
    const ws = new WebSocket(DELTA_PUBLIC_WS_URL);
    
    ws.on("open", () => {
      ws.send(JSON.stringify({
         type: "subscribe",
         payload: {
           channels: [
              { name: "l2_orderbook", symbols: [upperSymbol] },
              { name: "v2/ticker", symbols: [upperSymbol] },
              { name: "trades", symbols: [upperSymbol] }
           ]
         }
      }));
    });

    ws.on("message", (data: any) => {
       const msg = JSON.parse(data.toString());
       
       if (msg.type === "l2_orderbook") {
          const bids = msg.buy?.map((x: any) => [x.price, x.size]);
          const asks = msg.sell?.map((x: any) => [x.price, x.size]);
          sendToQuantEngine("DEPTH", {
              symbol: upperSymbol,
              bids,
              asks
          });
       } else if (msg.type === "v2/ticker" || msg.type === "ticker") {
          sendToQuantEngine("TRADE", {
              symbol: upperSymbol,
              data: {
                  price: parseFloat(msg.spot_price || msg.mark_price || msg.close),
                  quantity: 0,
                  is_buyer_maker: false
              }
          });
       } else if (msg.type === "trades") {
          sendToQuantEngine("TRADE", {
              symbol: upperSymbol,
              data: {
                  price: parseFloat(msg.price || msg.p),
                  quantity: parseFloat(msg.size || msg.s),
                  is_buyer_maker: (msg.side || msg.S) !== "buy"
              }
          });
       }
    });

    ws.on("error", () => {});
    ws.on("close", () => {
       activeDepthWs.delete(upperSymbol);
       setTimeout(() => connectWebSocket(symbol), 5000);
    });
    
    activeDepthWs.set(upperSymbol, { ws, lastAccessed: Date.now() });
  }
}

`;

   content = content.substring(0, startIndex) + replacement + content.substring(nextSubIndex);
   fs.writeFileSync("server.ts", content, "utf-8");
   console.log("Replaced WS");
} else {
   console.log("NOT FOUND");
}
