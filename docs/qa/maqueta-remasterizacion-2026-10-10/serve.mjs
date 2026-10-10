// Servidor estático mínimo y estable para la maqueta (sin dependencias).
import http from "node:http"; import { createReadStream, statSync, existsSync } from "node:fs"; import path from "node:path";
const root = path.resolve("docs/qa/maqueta-remasterizacion-2026-10-10/maqueta"); const port = Number(process.argv[2] || 8933);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p); if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(f).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`maqueta en http://127.0.0.1:${port}`));
