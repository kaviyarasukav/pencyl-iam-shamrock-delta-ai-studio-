import * as fs from "fs";

let playback = fs.readFileSync("quant_engine/playback_engine.py", "utf-8");
playback = playback.replace(/Binance/g, "Delta");
fs.writeFileSync("quant_engine/playback_engine.py", playback, "utf-8");

let arb = fs.readFileSync("quant_engine/arbitrage_engine.py", "utf-8");
arb = arb.replace(/Binance/g, "Delta");
fs.writeFileSync("quant_engine/arbitrage_engine.py", arb, "utf-8");

let macro = fs.readFileSync("quant_engine/macro_worker.py", "utf-8");
macro = macro.replace(/Binance/g, "Delta");
macro = macro.replace(/https:\/\/fapi.binance.com\/fapi\/v1\/premiumIndex\?symbol=BTCUSDT/g, "https://api.delta.exchange/v2/products/BTCUSD"); // Just mock url
fs.writeFileSync("quant_engine/macro_worker.py", macro, "utf-8");

console.log("fixed python binance references");
