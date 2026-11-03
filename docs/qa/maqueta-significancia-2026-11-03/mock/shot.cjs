const { chromium } = require("/Users/gonzaloalmendariz/repos/Pulso/prosecnur-app/frontend/node_modules/playwright");
(async () => { const [h, o, w, ht] = process.argv.slice(2); const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +ht } }); await p.goto("file://" + require("path").resolve(h)); await p.screenshot({ path: require("path").resolve(o) }); await b.close(); })()
  .catch((e) => { console.error("shot falló:", e.message); process.exit(1); });
