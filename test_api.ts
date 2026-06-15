import axios from "axios";

async function test() {
  const start = Math.floor(Date.now() / 1000) - 86400;
  const end = Math.floor(Date.now() / 1000);
  try {
    const res = await axios.get("https://api.delta.exchange/v2/history/candles?resolution=1h&symbol=XRPUSD&start=" + start + "&end=" + end);
    console.log("XRP 1h", res.data.success);
  } catch (e: any) {
    console.error("XRP 1h error", e.response?.data);
  }
}
test();
