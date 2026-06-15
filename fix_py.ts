import * as fs from "fs";

let content = fs.readFileSync("quant_engine/main.py", "utf-8");

content = content.replace("async def binance_ws_loop():", "async def delta_ws_loop():")
content = content.replace('uri = "wss://stream.binance.com:9443/stream"', 'uri = "wss://public-socket.india.delta.exchange"')

// Need to replace the subscribe logic
const old_sub = `                streams = [f"{s.replace('/', '').lower()}@depth20@100ms" for s in new_symbols] + [f"{s.replace('/', '').lower()}@aggTrade" for s in new_symbols]
                subscribe_msg = {
                    "method": "SUBSCRIBE",
                    "params": streams,
                    "id": 1
                }`;

const new_sub = `                # Delta WS replace
                symbols_formatted = [s.replace('/', '') for s in new_symbols]
                subscribe_msg = {
                    "type": "subscribe",
                    "payload": {
                        "channels": [
                            {"name": "l2_orderbook", "symbols": symbols_formatted},
                            {"name": "trades", "symbols": symbols_formatted}
                        ]
                    }
                }`;

content = content.replace(old_sub, new_sub)

content = content.replace("asyncio.create_task(binance_ws_loop())", "asyncio.create_task(delta_ws_loop())")

fs.writeFileSync("quant_engine/main.py", content, "utf-8");
console.log("done");
