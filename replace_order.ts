import * as fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

const startStr = '  broker.subscribe(TOPICS.EXECUTE_ORDER, async (order) => {';
const startIndex = content.indexOf(startStr);

if (startIndex !== -1) {
    const nextSubIndex = content.indexOf('  broker.subscribe(TOPICS.MARKET_DATA_REQUEST', startIndex);
    
    if (nextSubIndex === -1) throw new Error("nextSubIndex not found");

    const replacement = `  broker.subscribe(TOPICS.EXECUTE_ORDER, async (order) => {
      if (!activeApiKey || !activeSecretKey) return;
      try {
        console.log(\`[Execution Engine] Executing order:\`, order);

        // DELTA CANCEL
        if (order.type === "CANCEL") {
            const payloadString = JSON.stringify({ id: Number(order.clientOrderId), product_symbol: order.symbol });
            const headers = getDeltaAuthHeaders('DELETE', '/v2/orders', '', payloadString);
            await deltaAxios.delete(\`\${deltaBaseUrl}/v2/orders\`, { headers, data: { id: Number(order.clientOrderId), product_symbol: order.symbol } });
            console.log(\`[Execution Engine] Successfully canceled order \${order.clientOrderId}\`);
            return;
        }

        // DELTA PLACE ORDER
        const isMarket = order.type === "MARKET";
        const payload: any = {
            product_symbol: order.symbol,
            size: Number(order.quantity),
            side: order.side.toLowerCase(),
            order_type: isMarket ? "market_order" : "limit_order",
        };
        if (!isMarket && order.price) payload.limit_price = order.price.toString();
        if (order.stopPrice) {
            payload.stop_order_type = "stop_loss_order";
            payload.stop_price = order.stopPrice.toString();
        }
        if (order.timeInForce && !isMarket) payload.time_in_force = order.timeInForce.toLowerCase();
        
        const sl = order.metadata?.stop_loss || order.metadata?.stopLoss;
        const tp = order.metadata?.take_profit || order.metadata?.takeProfit;
        if (sl) {
            payload.bracket_stop_loss_price = sl.toString();
            payload.bracket_stop_loss_limit_price = sl.toString();
        }
        if (tp) {
            payload.bracket_take_profit_price = tp.toString();
            payload.bracket_take_profit_limit_price = tp.toString();
        }

        const payloadString = JSON.stringify(payload);
        const headers = getDeltaAuthHeaders('POST', '/v2/orders', '', payloadString);
        
        const response = await deltaAxios.post(
          \`\${deltaBaseUrl}/v2/orders\`,
          payloadString,
          { headers }
        );

        if(!response.data.success) {
            throw new Error(JSON.stringify(response.data.error || response.data));
        }

        let direction = "NONE";
        if (order.side === "BUY") direction = "LONG";
        if (order.side === "SELL") direction = "SHORT"; 
        sendToQuantEngine("POSITION_STATE", {
          symbol: order.symbol,
          state: {
            status: direction !== "NONE" ? "ACTIVE" : "CLOSED",
            side: direction,
            entry_price: response.data.result.average_fill_price || response.data.result.limit_price || order.price || 0,
            quantity: response.data.result.size,
          }
        });
      } catch (err: any) {
         console.error(\`order error\`, err.message);
      }
    });

`;

   content = content.substring(0, startIndex) + replacement + content.substring(nextSubIndex);
   fs.writeFileSync("server.ts", content, "utf-8");
   console.log("Replaced order submit");
} else {
   console.log("NOT FOUND");
}
