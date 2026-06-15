import * as fs from "fs";
import * as path from "path";

function walkDir(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
       walkDir(dirPath, callback);
    } else {
       callback(path.join(dir, f));
    }
  });
}

walkDir("src", (filePath) => {
   if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
      let text = fs.readFileSync(filePath, "utf-8");
      
      text = text.replace(/binanceService/g, 'deltaService');
      text = text.replace(/services\/binance/g, 'services/delta');
      text = text.replace(/useBinanceData/g, 'useDeltaData');
      text = text.replace(/hooks\/useBinanceData/g, 'hooks/useDeltaData');
      text = text.replace(/Binance/g, 'Delta Exchange');
      text = text.replace(/binance/g, 'delta');
      text = text.replace(/BINANCE/g, 'DELTA');
      
      fs.writeFileSync(filePath, text, "utf-8");
   }
});
fs.renameSync("src/services/binance.ts", "src/services/delta.ts");
fs.renameSync("src/hooks/useBinanceData.ts", "src/hooks/useDeltaData.ts");

console.log("Renamed Binance to Delta Exchange in frontend");
