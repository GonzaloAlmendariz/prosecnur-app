#!/usr/bin/env node
// =============================================================================
// css-cascade-audit.mjs — detecta reglas CSS que compiten por empate
// =============================================================================
// Problema que resuelve: cuando dos archivos declaran el MISMO selector con la
// MISMA especificidad y propiedades solapadas, el ganador lo decide el orden de
// carga del bundle. Ese orden es invisible en el código, así que una regla
// nueva puede no aplicarse sin que nada lo explique: hay que descubrirlo
// depurando en el navegador.
//
// No es lo mismo que "el selector aparece en dos archivos". Un override dentro
// de @media, o uno con más especificidad, gana de forma determinista y es
// cascada legítima. Este detector solo marca los EMPATES.
//
// Uso:
//   node scripts/css-cascade-audit.mjs                 # informe legible
//   node scripts/css-cascade-audit.mjs --json          # salida procesable
//   node scripts/css-cascade-audit.mjs --resolve       # quién gana cada empate
//   node scripts/css-cascade-audit.mjs --self-test     # valida el detector
//   node scripts/css-cascade-audit.mjs --max 0         # falla si hay empates
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "frontend/src");

// --- postcss vive en el store de pnpm del frontend; se resuelve sin fijar versión
function loadPostcss() {
  const store = path.join(ROOT, "frontend/node_modules/.pnpm");
  if (fs.existsSync(store)) {
    const dir = fs.readdirSync(store).find((d) => /^postcss@\d/.test(d));
    if (dir) {
      const mod = path.join(store, dir, "node_modules/postcss");
      if (fs.existsSync(mod)) return import(path.join(mod, "lib/postcss.mjs")).catch(() => import(mod));
    }
  }
  return import("postcss");
}

/** Especificidad (a,b,c) del selector, ignorando pseudo-elementos. */
export function specificity(selector) {
  let s = selector
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/::[a-z-]+(\([^)]*\))?/gi, "")            // pseudo-elementos: no cuentan como clase
    .trim();
  // :is()/:where()/:not() — :where() aporta 0; los otros, el máximo interno.
  s = s.replace(/:where\([^)]*\)/gi, " ");
  const inner = [];
  s = s.replace(/:(?:is|not|has)\(([^)]*)\)/gi, (_, g) => { inner.push(g); return " "; });
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+/g) || []).length
    + (s.match(/\[[^\]]+\]/g) || []).length
    + (s.match(/:[a-z-]+(\([^)]*\))?/gi) || []).length;
  const types = (s.replace(/[.#\[][^\s>+~]*/g, " ").match(/\b[a-z][\w-]*\b/gi) || []).length;
  let acc = [ids, classes, types];
  for (const group of inner) {
    // El máximo entre las alternativas separadas por coma
    let best = [0, 0, 0];
    for (const alt of group.split(",")) {
      const sp = specificity(alt);
      if (sp[0] > best[0] || (sp[0] === best[0] && sp[1] > best[1])
        || (sp[0] === best[0] && sp[1] === best[1] && sp[2] > best[2])) best = sp;
    }
    acc = [acc[0] + best[0], acc[1] + best[1], acc[2] + best[2]];
  }
  return acc;
}

const VISUAL = new Set([
  "background", "background-color", "background-image", "border", "border-color",
  "border-width", "border-radius", "box-shadow", "color", "padding", "margin",
  "display", "backdrop-filter", "min-height", "height", "gap", "font-size", "font-weight",
]);

/** Contexto condicional de la regla: @media/@supports/@container la aíslan. */
function conditionalContext(rule) {
  const conds = [];
  for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule") conds.push(`@${p.name} ${p.params}`.trim());
  }
  return conds.reverse().join(" ∧ ");
}

function walkCss(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCss(p, acc);
    else if (e.name.endsWith(".css") && !e.name.endsWith(".min.css")) acc.push(p);
  }
  return acc;
}

export async function audit({ src = SRC } = {}) {
  const postcssMod = await loadPostcss();
  const postcss = postcssMod.default ?? postcssMod;
  const decls = new Map(); // clave: selector + contexto condicional

  for (const file of walkCss(src)) {
    const css = fs.readFileSync(file, "utf8");
    let root;
    try { root = postcss.parse(css, { from: file }); }
    catch (err) { console.error(`  aviso: no se pudo parsear ${file}: ${err.message}`); continue; }

    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /^(keyframes|font-face|property)$/i.test(rule.parent.name)) return;
      const cond = conditionalContext(rule);
      const props = rule.nodes
        .filter((n) => n.type === "decl" && !n.prop.startsWith("--"))
        .map((n) => n.prop.toLowerCase());
      if (!props.length) return;
      const cuerpo = rule.nodes.filter((n) => n.type === "decl").map((n) => [n.prop.toLowerCase(), n.value]);
      const grupo = rule.selectors ?? [rule.selector];
      for (const sel of grupo) {
        const norm = sel.trim().replace(/\s+/g, " ");
        const key = `${norm}\u0000${cond}`;
        if (!decls.has(key)) decls.set(key, []);
        decls.get(key).push({
          file: path.relative(ROOT, file),
          line: rule.source?.start?.line ?? 0,
          props, selector: norm, cond, cuerpo,
          agrupado: grupo.length > 1,
          spec: specificity(norm),
        });
      }
    });
  }

  const ties = [];
  for (const [, defs] of decls) {
    // Agrupa por especificidad exacta: solo empatan las idénticas.
    const bySpec = new Map();
    for (const d of defs) {
      const k = d.spec.join(",");
      if (!bySpec.has(k)) bySpec.set(k, []);
      bySpec.get(k).push(d);
    }
    for (const group of bySpec.values()) {
      const files = new Set(group.map((d) => d.file));
      if (files.size < 2) continue;               // mismo archivo = orden explícito y visible
      const overlap = new Set();
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++) {
          if (group[i].file === group[j].file) continue;
          for (const p of group[i].props) if (group[j].props.includes(p) && VISUAL.has(p)) overlap.add(p);
        }
      if (overlap.size) {
        ties.push({
          selector: group[0].selector,
          cond: group[0].cond,
          spec: group[0].spec.join(","),
          props: [...overlap].sort(),
          sites: group.map(({ file, line, cuerpo, agrupado }) => ({ file, line, cuerpo, agrupado })),
        });
      }
    }
  }
  ties.sort((a, b) => b.props.length - a.props.length || a.selector.localeCompare(b.selector));
  return ties;
}

// --- Autovalidación: el detector se prueba contra casos construidos a mano ---
const FIXTURES = {
  "a.css": `
    .tie { background: red; }                     /* empata con b.css */
    .safe { color: red; }                         /* solo aquí */
    @media (max-width: 9px) { .cond { background: red; } }
    :root[data-x="1"] .scoped { background: red; }
    .spec.spec { background: red; }               /* (0,2,0) */
  `,
  "b.css": `
    .tie { background: blue; }                    /* EMPATE real */
    .cond { background: blue; }                   /* distinto contexto: NO empata */
    .scoped { background: blue; }                 /* menor especificidad: NO empata */
    .spec { background: blue; }                   /* (0,1,0) vs (0,2,0): NO empata */
    .tie { color: green; }                        /* mismo archivo: no cuenta solo */
  `,
};

async function selfTest() {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "css-audit-"));
  for (const [name, body] of Object.entries(FIXTURES)) fs.writeFileSync(path.join(tmp, name), body);
  const ties = await audit({ src: tmp });
  fs.rmSync(tmp, { recursive: true, force: true });

  const found = new Set(ties.map((t) => t.selector));
  const checks = [
    ["detecta el empate real (.tie)", found.has(".tie")],
    ["ignora distinto contexto @media (.cond)", !found.has(".cond")],
    ["ignora distinta especificidad (.spec)", !found.has(".spec")],
    ["ignora selector scoped de más peso (.scoped)", !found.has(".scoped")],
    ["ignora selector sin duplicar (.safe)", !found.has(".safe")],
    ["solo un empate en el fixture", ties.length === 1],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  const sp = [
    [".a", "0,1,0"], ["#a", "1,0,0"], ["div", "0,0,1"],
    [".a .b", "0,2,0"], [":where(.a) .b", "0,1,0"], [".a:not(.b, .c.d)", "0,3,0"],
    ["a[href]", "0,1,1"], [".a::before", "0,1,0"],
  ];
  for (const [sel, exp] of sp) {
    const got = specificity(sel).join(",");
    const pass = got === exp;
    console.log(`  ${pass ? "✓" : "✗"} especificidad ${sel} → ${got}${pass ? "" : ` (esperado ${exp})`}`);
    if (!pass) ok = false;
  }
  return ok && await resolverTest();
}

// --- Fase 2: quién gana el empate, según el bundle de producción -----------
// El detector solo dice qué empata. Para saber quién gana hay que mirar el
// orden real de la cascada, y ese orden no está en los imports del código: lo
// arma el grafo de módulos. El build resuelve la pregunta — cada chunk CSS
// concatena sus hojas en el orden en que se aplican, así que dentro de un chunk
// la última declaración de un selector es la que manda.
//
// Requiere haber ejecutado `pnpm --dir frontend build`.
const BUNDLE_DIR = path.join(ROOT, "api/inst/www/assets");

/** Un selector minificado y uno del código fuente deben comparar igual. */
const normSel = (s) => s
  .replace(/=["']([^"'\]]*)["']/g, "=$1")
  .replace(/\s*([>+~,])\s*/g, "$1")
  .replace(/\s+/g, " ")
  .trim();
const normCond = (c) => c.replace(/\s+/g, "").replace(/["']/g, "");
const normVal = (v) => String(v).toLowerCase().replace(/\s+/g, "").replace(/\b0\.(\d)/g, ".$1");

/**
 * Atribuye un bloque del bundle a uno de los sitios fuente. El minificador
 * reescribe valores (`rgba(255,255,255,.88)` → `#ffffffe0`), así que la
 * igualdad literal no sirve: se puntúa por propiedades en común, y el valor
 * idéntico solo desempata.
 */
function atribuir(declsBloque, sites) {
  let mejor = null, mejorPunto = 0;
  for (const s of sites) {
    let punto = 0;
    for (const [prop, val] of s.cuerpo ?? []) {
      if (!declsBloque.has(prop)) continue;
      punto += declsBloque.get(prop) === normVal(val) ? 3 : 1;
    }
    if (punto > mejorPunto) { mejorPunto = punto; mejor = s; }
  }
  return mejor ? { sitio: `${mejor.file}:${mejor.line}`, punto: mejorPunto } : null;
}

export async function resolveWinners(ties, { bundleDir = BUNDLE_DIR } = {}) {
  if (!fs.existsSync(bundleDir)) return { available: false, ties };
  const postcssMod = await loadPostcss();
  const postcss = postcssMod.default ?? postcssMod;

  // Índice del bundle: (selector, contexto) → apariciones en orden de cascada.
  // Se parsea en vez de buscar texto: así un `@media` no se confunde con la
  // regla incondicional, ni `.sel p code` con `.sel p`.
  const indice = new Map();
  for (const f of fs.readdirSync(bundleDir).filter((x) => x.endsWith(".css"))) {
    const root = postcss.parse(fs.readFileSync(path.join(bundleDir, f), "utf8"), { from: f });
    let orden = 0;
    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /^(keyframes|font-face|property)$/i.test(rule.parent.name)) return;
      const cond = normCond(conditionalContext(rule));
      const decls = new Map();
      for (const n of rule.nodes) if (n.type === "decl") decls.set(n.prop.toLowerCase(), normVal(n.value));
      if (!decls.size) return;
      const pos = orden++;
      for (const sel of rule.selectors ?? [rule.selector]) {
        const key = `${normSel(sel)}\u0000${cond}`;
        if (!indice.has(key)) indice.set(key, []);
        indice.get(key).push({ chunk: f, pos, decls });
      }
    });
  }

  const resolved = ties.map((tie) => {
    const apariciones = indice.get(`${normSel(tie.selector)}\u0000${normCond(tie.cond)}`) ?? [];
    const porChunk = new Map();
    for (const a of apariciones) {
      if (!porChunk.has(a.chunk)) porChunk.set(a.chunk, []);
      porChunk.get(a.chunk).push(a);
    }
    // Un chunk resuelve el empate solo si sus apariciones vienen de archivos
    // DISTINTOS. Dos reglas del mismo archivo en el mismo chunk son cascada
    // normal —su orden se lee en el propio archivo— y no explican nada.
    const porChunkAtribuido = [...porChunk.entries()].map(([name, ap]) => {
      const ordenadas = [...ap].sort((a, b) => a.pos - b.pos)
        .map((a) => ({ ...a, ...atribuir(a.decls, tie.sites) }))
        .filter((a) => a.sitio);
      return { name, ordenadas, archivos: new Set(ordenadas.map((a) => a.sitio.split(":")[0])) };
    });
    const disputados = porChunkAtribuido.filter((c) => c.archivos.size > 1);
    // Vivir en chunks distintos NO absuelve: si ambos chunks cargan en la misma
    // pantalla, el ganador lo decide el orden de inyección de los <link>, que es
    // de runtime y depende de la ruta. Es el caso MÁS opaco, no el más benigno.
    const clase = disputados.length ? "resoluble" : porChunk.size >= 2 ? "runtime" : porChunk.size === 0 ? "ausente" : "fusionado";

    let ganador = null, perdedores = [];
    if (clase === "resoluble") {
      // El chunk más disputado manda; dentro de él, la última aparición gana.
      const { ordenadas } = disputados.sort((a, b) => b.ordenadas.length - a.ordenadas.length)[0];
      const ultimo = ordenadas[ordenadas.length - 1];
      ganador = { sitio: ultimo.sitio, decls: ultimo.decls };
      const archivoGanador = ultimo.sitio.split(":")[0];
      // Lo que la perdedora aún aporta = lo que la ganadora no declara.
      for (const s of tie.sites) {
        const clave = `${s.file}:${s.line}`;
        if (clave === ultimo.sitio) continue;
        const sobreviven = (s.cuerpo ?? [])
          .map(([p]) => p)
          .filter((p) => !ultimo.decls.has(p) && !LONGHAND_DE[p]?.some((sh) => ultimo.decls.has(sh)));
        perdedores.push({ sitio: clave, agrupado: !!s.agrupado, mismoArchivo: s.file === archivoGanador, sobreviven });
      }
    }
    return {
      ...tie,
      bundle: {
        chunks: [...porChunk.keys()],
        clase,
        conflictivos: disputados.map((c) => ({ chunk: c.name, apariciones: c.ordenadas.length })),
        ganador: ganador?.sitio ?? null,
        perdedores,
        // Una perdedora es REDUNDANTE si no aporta ni una declaración propia:
        // borrarla no cambia un pixel. Si aporta algo, el resultado en pantalla
        // es una mezcla de las dos hojas que nadie diseñó.
        redundantes: perdedores.filter((p) => !p.mismoArchivo && p.sobreviven.length === 0).map((p) => p.sitio),
        veredicto: {
          resoluble: "convive en un chunk: gana la última aparición",
          runtime: "vive en chunks distintos: el ganador lo decide el orden de carga",
          ausente: "el selector no llegó al bundle (posible código muerto)",
          fusionado: "una sola aparición en el bundle: las hojas se fusionaron",
        }[clase],
      },
    };
  });
  return { available: true, ties: resolved };
}

/** Qué shorthand cubre a cada longhand, para no contar como viva una propiedad ya pisada. */
const LONGHAND_DE = {
  "border-color": ["border"], "border-width": ["border"], "border-style": ["border"],
  "background-color": ["background"], "background-image": ["background"],
  "padding-top": ["padding"], "padding-right": ["padding"], "padding-bottom": ["padding"], "padding-left": ["padding"],
  "margin-top": ["margin"], "margin-right": ["margin"], "margin-bottom": ["margin"], "margin-left": ["margin"],
};

// --- Autovalidación de la fase 2: el veredicto se prueba contra un bundle a mano
const FUENTES_R = {
  "c.css": `
    .redundante { background: red; color: red; }
    .viva { background: red; padding: 2px; }
    .lejos { background: red; }
    .enmedia { background: red; }
    .mismofile { background: red; }
    .mismofile { background: green; }
  `,
  "d.css": `
    .redundante { background: blue; color: blue; }
    .viva { background: blue; }
    .lejos { background: blue; }
    .enmedia { background: blue; }
    .mismofile { background: blue; }
  `,
};
const BUNDLE_R = {
  // Un chunk donde ambas hojas conviven: el orden es visible y decide.
  "pagina.css": ".redundante{background:red;color:red}.redundante{background:blue;color:blue}"
    + ".viva{background:red;padding:2px}.viva{background:blue}"
    + ".lejos{background:red}"
    // La copia condicional NO compite con la incondicional.
    + "@media (max-width:9px){.enmedia{background:red}}.enmedia{background:red}"
    // Dos reglas del MISMO archivo: orden visible en la fuente, no explica el empate.
    + ".mismofile{background:red}.mismofile{background:green}",
  // ...y otro chunk que se carga aparte: el orden entre ambos es de runtime.
  "otra.css": ".lejos{background:blue}.mismofile{background:blue}",
};

async function resolverTest() {
  const src = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "css-src-"));
  const bun = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "css-bun-"));
  for (const [n, b] of Object.entries(FUENTES_R)) fs.writeFileSync(path.join(src, n), b);
  for (const [n, b] of Object.entries(BUNDLE_R)) fs.writeFileSync(path.join(bun, n), b);
  const { ties } = await resolveWinners(await audit({ src }), { bundleDir: bun });
  fs.rmSync(src, { recursive: true, force: true });
  fs.rmSync(bun, { recursive: true, force: true });

  const t = (sel) => ties.find((x) => x.selector === sel)?.bundle;
  const checks = [
    ["clasifica resoluble el empate dentro de un chunk", t(".redundante")?.clase === "resoluble"],
    ["nombra ganadora la última aparición del chunk", /d\.css:\d+$/.test(t(".redundante")?.ganador ?? "")],
    ["marca redundante a la perdedora sin aporte", t(".redundante")?.redundantes.length === 1],
    ["NO marca redundante a la que aún aporta", t(".viva")?.redundantes.length === 0],
    ["dice qué sobrevive de la perdedora viva", t(".viva")?.perdedores[0]?.sobreviven.join() === "padding"],
    ["clasifica runtime lo que vive en chunks distintos", t(".lejos")?.clase === "runtime"],
    ["ignora la copia dentro de @media", t(".enmedia")?.clase !== "resoluble"],
    ["no resuelve nada con dos reglas del mismo archivo", t(".mismofile")?.clase === "runtime"],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  return ok;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    console.log("Autovalidación del detector:");
    const ok = await selfTest();
    console.log(ok ? "\nDETECTOR VÁLIDO" : "\nDETECTOR INVÁLIDO — no confíes en su salida");
    process.exit(ok ? 0 : 1);
  }
  let ties = await audit();
  if (args.includes("--resolve")) {
    const r = await resolveWinners(ties);
    if (!r.available) {
      console.error("Para --resolve hace falta el bundle: pnpm --dir frontend build");
      process.exit(2);
    }
    ties = r.ties;
    const por = (c) => ties.filter((t) => t.bundle.clase === c);
    console.log(`Empates analizados contra el bundle: ${ties.length}`);
    console.log(`  resoluble (conviven en un chunk):        ${por("resoluble").length}`);
    console.log(`  runtime (chunks distintos, orden opaco): ${por("runtime").length}`);
    console.log(`  fusionado (una sola aparición):          ${por("fusionado").length}`);
    console.log(`  ausente del bundle:                      ${por("ausente").length}\n`);
    const redundantes = por("resoluble").filter((t) => t.bundle.redundantes.length);
    console.log(`  ...de los resolubles, con perdedora redundante:  ${redundantes.length}\n`);
    for (const t of [...por("resoluble"), ...por("runtime")]) {
      console.log(`[${t.bundle.clase}] ${t.selector}   [${t.props.join(", ")}]`);
      for (const c of t.bundle.conflictivos) console.log(`    ⚔ ${c.chunk} — ${c.apariciones} apariciones`);
      if (t.bundle.ganador) console.log(`    ✓ gana ${t.bundle.ganador}`);
      for (const p of t.bundle.perdedores)
        console.log(`    ✗ pierde ${p.sitio}${p.agrupado ? " [agrupado]" : ""} → ${p.sobreviven.length ? `aún aporta: ${p.sobreviven.join(", ")}` : "REDUNDANTE (no aporta nada)"}`);
      if (t.bundle.clase === "runtime") {
        for (const c of t.bundle.chunks) console.log(`    ↯ ${c}`);
        for (const s of t.sites) console.log(`    · ${s.file}:${s.line}`);
      }
      console.log();
    }
    process.exit(0);
  }
  if (args.includes("--json")) {
    console.log(JSON.stringify({ total: ties.length, ties }, null, 2));
  } else {
    console.log(`Empates de cascada entre archivos: ${ties.length}`);
    console.log("(mismo selector, misma especificidad, mismo contexto, propiedad visual en común:");
    console.log(" el ganador lo decide el orden de carga del bundle)\n");
    for (const t of ties) {
      console.log(`${t.selector}${t.cond ? `   {${t.cond}}` : ""}   esp=(${t.spec})`);
      console.log(`    disputan: ${t.props.join(", ")}`);
      for (const s of t.sites) console.log(`    · ${s.file}:${s.line}`);
      console.log();
    }
  }
  const maxArg = args.indexOf("--max");
  if (maxArg >= 0) {
    const max = Number(args[maxArg + 1] ?? 0);
    if (ties.length > max) {
      console.error(`FALLA: ${ties.length} empates supera el máximo permitido (${max}).`);
      process.exit(1);
    }
  }
}
