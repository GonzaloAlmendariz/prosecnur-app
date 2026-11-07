// Detector de la UI maquetada: textos que desbordan su caja, capas flotantes recortadas o fuera de la ventana,
// y capas flotantes que tapan la cifra que explican.
const { chromium } = require("/Users/gonzaloalmendariz/repos/Pulso/prosecnur-app/frontend/node_modules/playwright");
(async () => {
  const b = await chromium.launch(); let total = 0;
  for (const f of process.argv.slice(2)) {
    const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("file://" + f);
    const r = await page.evaluate(() => {
      const out = [], W = innerWidth, H = innerHeight;
      document.querySelectorAll(".chip,.btn,td,th,.sel-box,.seg span,.help,b,.pill,dd,dt").forEach((e) => {
        if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible") out.push(`desborda: «${e.textContent.trim().slice(0, 40)}»`);
        const rc = e.getBoundingClientRect(); if (rc.width && (rc.right > W + 1 || rc.bottom > H + 1)) out.push(`fuera de ventana: «${e.textContent.trim().slice(0, 40)}»`);
      });
      document.querySelectorAll(".pop").forEach((p) => {
        const rp = p.getBoundingClientRect();
        let a = p.parentElement;
        while (a) { const cs = getComputedStyle(a); if (cs.overflow === "hidden") { const ra = a.getBoundingClientRect();
          if (rp.left < ra.left - 1 || rp.right > ra.right + 1 || rp.top < ra.top - 1 || rp.bottom > ra.bottom + 1) { out.push(`capa recortada por ${a.className || a.tagName}`); break; } } a = a.parentElement; }
        if (rp.right > W || rp.bottom > H) out.push("capa fuera de la ventana");
        [...p.querySelectorAll("*")].forEach((e) => { if (e.children.length === 0 && e.textContent.trim()) { const re = e.getBoundingClientRect(); if (re.right > rp.right + 1) out.push(`texto fuera de la capa: «${e.textContent.trim().slice(0, 30)}»`); } });
      });
      return [...new Set(out)];
    });
    total += r.length; console.log(`${r.length ? "✗" : "✓"} ${f.split("/").pop()}${r.length ? "\n   " + r.slice(0, 10).join("\n   ") : ""}`);
    await page.close();
  }
  await b.close(); process.exit(total ? 1 : 0);
})();
