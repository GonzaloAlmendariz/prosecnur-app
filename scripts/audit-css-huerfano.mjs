#!/usr/bin/env node
/**
 * Auditoría: clases usadas en componentes que ningún CSS importado define, y
 * componentes que nadie importa.
 *
 * Nace de un caso medido el 2026-08-23: `.rec-plan-desfase` vivía en
 * `recopiladores.css` —un marcador de compatibilidad que NADIE importa— y su
 * aviso, el que evita imprimir 2.616 fichas de una corrida equivocada, se
 * pintaba como texto corrido.
 *
 * **Es una herramienta, no un gate, y la diferencia importa.** Sus candidatas
 * NO son todas defectos: una clase puede verse bien porque su elemento hereda
 * del estilo de `button`, porque otra regla estructural la alcanza, o porque
 * sólo sirve de ancla para un test. Verificadas seis a mano sobre la app: dos
 * eran defectos reales —`.rec-plan-desfase` y `.pulso-chrome-status-chip`, que
 * heredaba el padding del botón genérico y escribía un `data-tone` que nadie
 * leía—, una era de un componente muerto y tres no llegaban al DOM.
 *
 * Convertirla en test haría lo que un gate no debe: pintar de rojo 150 líneas
 * que en su mayoría no son un problema. Se corre a mano y se lee con criterio.
 *
 *   node scripts/audit-css-huerfano.mjs
 */
import fs from "node:fs";
import path from "node:path";
const raiz = "frontend/src";
const csss = [], tsxs = [];
(function anda(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) anda(p);
  else if (e.name.endsWith(".css")) csss.push(p);
  else if ((e.name.endsWith(".tsx") || e.name.endsWith(".ts")) && !e.name.includes(".test.")) tsxs.push(p);
} })(raiz);

// ¿A quién importa alguien? Un módulo vivo es el que otro módulo nombra.
const nombrado = new Set(["frontend/src/main.tsx", "frontend/src/app/App.tsx"]);
for (const t of tsxs) {
  const src = fs.readFileSync(t, "utf8");
  for (const m of src.matchAll(/from\s+"([^"]+)"|import\("([^"]+)"\)/g)) {
    const spec = m[1] ?? m[2];
    if (!spec?.startsWith(".")) continue;
    const base = path.normalize(path.join(path.dirname(t), spec));
    for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
      if (fs.existsSync(cand)) nombrado.add(path.normalize(cand));
    }
  }
}
const muertos = tsxs.filter((t) => !nombrado.has(path.normalize(t)));

const importados = new Set();
for (const t of tsxs) for (const m of fs.readFileSync(t, "utf8").matchAll(/import\s+"([^"]+\.css)"/g))
  importados.add(path.normalize(path.join(path.dirname(t), m[1])));
const sinCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const css = sinCom([...importados].filter(fs.existsSync).map((c) => fs.readFileSync(c, "utf8")).join("\n"));

const vivas = new Map(), enMuertos = new Set();
for (const t of tsxs) {
  const esMuerto = muertos.includes(t);
  for (const m of fs.readFileSync(t, "utf8").matchAll(/className="([^"{]+)"/g))
    for (const c of m[1].split(/\s+/)) {
      if (!/^[a-z][\w-]*$/.test(c) || css.includes(`.${c}`)) continue;
      if (esMuerto) enMuertos.add(c); else { if (!vivas.has(c)) vivas.set(c, t.replace("frontend/src/","")); }
    }
}
console.log(`componentes: ${tsxs.length} | NO IMPORTADOS POR NADIE: ${muertos.length}`);
for (const m of muertos.slice(0, 12)) console.log("  muerto:", m.replace("frontend/src/",""), `(${fs.readFileSync(m,"utf8").split("\n").length} lineas)`);
console.log(`\nclases sin regla en codigo MUERTO: ${enMuertos.size}`);
console.log(`clases sin regla en codigo VIVO: ${vivas.size}`);
for (const [c, d] of [...vivas].slice(0, 20)) console.log(`  .${c}  <- ${d}`);
