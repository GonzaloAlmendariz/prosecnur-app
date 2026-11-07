// Detector de solapes en las maquetas: mide las cajas reales de cada <text> del SVG en Chromium y reporta
//  (1) textos que se pisan entre sí, (2) textos que se salen del lienzo y (3) textos que cortan una cápsula sin caber en ella.
// Uso: node solapes.cjs <html>...   (sale con código 1 si hay hallazgos)
const { chromium } = require("/Users/gonzaloalmendariz/repos/Pulso/prosecnur-app/frontend/node_modules/playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  let total = 0;
  for (const f of process.argv.slice(2)) {
    await page.goto("file://" + f);
    const r = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("svg").forEach((svg) => {
        const vb = svg.getBoundingClientRect();
        const T = [...svg.querySelectorAll("text")].map((t) => ({ s: t.textContent, b: t.getBoundingClientRect() }))
          .filter((t) => t.s.trim() && t.b.width > 0);
        const marcas = [...svg.querySelectorAll("polygon, circle")].map((m) => m.getBoundingClientRect()).filter((b) => b.width > 0);
        const caps = [...svg.querySelectorAll("rect")].filter((r) => +r.getAttribute("rx") > 4 && r.getBoundingClientRect().height < 40)
          .map((r) => r.getBoundingClientRect());
        const tarjetas = [...svg.querySelectorAll("rect[stroke]")].filter((r) => r.getBoundingClientRect().height >= 40).map((r) => r.getBoundingClientRect());
        const inter = (a, b, m = 1.5) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > m && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > m;
        const dentro = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 2 && a.bottom <= b.bottom + 2;
        // el alto de la caja de texto incluye interlineado: se recorta al 70 % central para no inventar choques verticales
        const nuc = (b) => { const h = b.height * 0.08; return { left: b.left, right: b.right, top: b.top + h, bottom: b.bottom - h }; };
        for (let i = 0; i < T.length; i++) {
          const a = nuc(T[i].b);
          if (T[i].b.right > vb.right + 1 || T[i].b.left < vb.left - 1 || T[i].b.bottom > vb.bottom + 1) out.push(`fuera: «${T[i].s}»`);
          for (let j = i + 1; j < T.length; j++) if (inter(a, nuc(T[j].b))) out.push(`texto sobre texto: «${T[i].s}» × «${T[j].s}»`);
          for (const m of marcas) if (inter(T[i].b, m, 1) && !dentro(T[i].b, m) && !dentro(m, T[i].b)) out.push(`texto sobre marca: «${T[i].s}»`);
          for (const t of tarjetas) if (inter(T[i].b, t, 0) && !(T[i].b.left >= t.left + 8 && T[i].b.right <= t.right - 8 && T[i].b.top >= t.top && T[i].b.bottom <= t.bottom)) out.push(`texto pegado o fuera de su tarjeta: «${T[i].s}»`);
          for (const c of caps) if (inter(T[i].b, c, -1.5) && !dentro(T[i].b, c)) out.push(`texto corta cápsula: «${T[i].s}»`);
        }
      });
      return out;
    });
    const nombre = f.split("/").pop();
    total += r.length;
    console.log(`${r.length ? "✗" : "✓"} ${nombre}${r.length ? "\n   " + [...new Set(r)].slice(0, 12).join("\n   ") : ""}`);
  }
  await browser.close();
  process.exit(total ? 1 : 0);
})();
