const fs = require('fs');

let content = fs.readFileSync("server.ts", "utf-8");

content = content.replace('\\n    try {\\n      res.json([]);', '\n    try {\n      res.json([]);\n');
content = content.replace('\\n    try {\\n      res.json([]);', '\n    try {\n      res.json([]);\n');

content = content.replace('\\n    try {\\n      if (!activeApiKey', '\n    try {\n      if (!activeApiKey');
content = content.replace('\\n      const headers', '\n      const headers');
content = content.replace('\\n      const response', '\n      const response');
content = content.replace('\\n      if(!response.data.success)', '\n      if(!response.data.success)');
content = content.replace('\\n      const accountData', '\n      const accountData');
content = content.replace('\\n          balances: response.data.result.map', '\n          balances: response.data.result.map');
content = content.replace('\\n              asset: b.asset_symbol,\\n              free: b.available_balance,\\n              locked: b.blocked_margin\\n          }))\\n      };\\n      res.json(accountData);', '\n              asset: b.asset_symbol,\n              free: b.available_balance,\n              locked: b.blocked_margin\n          }))\n      };\n      res.json(accountData);\n');

fs.writeFileSync("server.ts", "import axios from 'axios';\n" + content, "utf-8"); // Oh wait, I am messing it up.
console.log("Done");
