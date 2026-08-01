import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const quickCheckPath = path.join(repoRoot, "scripts/ui-quick-check.mjs");

const pageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Geometry fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      .group { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px; }
      .card { border: 1px solid #999; padding: 12px; }
      .equal .card:first-child { height: 120px; }
      .equal .card:last-child { height: 170px; }
      .intrinsic { align-items: stretch; }
      .intrinsic .card:first-child { min-height: 180px; }
      .intrinsic .card:last-child > div { height: 140px; }
      .clipped-placeholder { width: 112px; padding: 4px 8px; font: 600 14px sans-serif; }
    </style>
  </head>
  <body>
    <main data-audit-ready="geometry">
      <input class="clipped-placeholder" placeholder="Buscar UMP, manzana, distrito o responsable...">
      <section class="group equal">
        <article class="card"><div>Uno</div></article>
        <article class="card"><div>Uno</div><div>Dos</div></article>
      </section>
      <section class="group intrinsic">
        <article class="card"><div>Corto</div></article>
        <article class="card"><div>Largo</div></article>
      </section>
    </main>
  </body>
</html>`;

const validPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Valid geometry fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      .group { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px; align-items: start; }
      .card { border: 1px solid #999; padding: 12px; }
      .equal .card { height: 170px; }
      .scroll-owner { height: 92px; overflow-y: auto; }
      .scroll-owner article { height: 52px; }
    </style>
  </head>
  <body>
    <main data-audit-ready="geometry">
      <section class="group equal">
        <article class="card">
          <div class="scroll-owner">
            <article><strong>Primero completo</strong></article>
            <article><strong>Segundo completo</strong></article>
            <article><strong>Último contenido alcanzable</strong></article>
          </div>
        </article>
        <article class="card"><div>Uno</div><div>Dos</div><div>Tres</div></article>
      </section>
      <section class="group intrinsic">
        <article class="card"><div>Corto</div></article>
        <article class="card"><div>Uno</div><div>Dos</div></article>
      </section>
    </main>
  </body>
</html>`;

const undeclaredGeometryPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Undeclared geometry fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      main { display: grid; gap: 12px; padding: 16px; }
      .declared-group,
      .undeclared-group,
      .mixed-variants,
      .undeclared-list,
      .undeclared-cards,
      .undeclared-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
      .undeclared-flex-cards { display: flex; gap: 16px; align-items: flex-start; }
      .candidate-card { border: 1px solid #999; padding: 12px; }
      .declared-group > .candidate-card { height: 120px; }
      .undeclared-group > .candidate-card:first-child { height: 110px; }
      .undeclared-group > .candidate-card:last-child { height: 160px; }
      .candidate-list-row,
      .candidate-control-card,
      .candidate-control-section,
      .candidate-flex-control-card { border: 1px solid #999; padding: 12px; }
      span.candidate-control-card { display: grid; }
      span.candidate-flex-control-card { display: flex; gap: 8px; }
      .false-field-labels { margin: 8px 0; }
      .false-inline-badges,
      .false-inline-legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
      .candidate-inline-badge,
      .candidate-inline-legend { display: inline-flex; }
      nav,
      [role="tablist"] { display: flex; gap: 8px; align-items: flex-start; }
      nav > .candidate-card:first-child,
      [role="tablist"] > .candidate-card:first-child { height: 32px; }
      nav > .candidate-card:last-child,
      [role="tablist"] > .candidate-card:last-child { height: 82px; }
      table { border-collapse: collapse; }
      tr.candidate-card:first-child { height: 34px; }
      tr.candidate-card:last-child { height: 84px; }
      .mixed-variants > .candidate-card--primary { height: 100px; }
      .mixed-variants > .candidate-card--secondary { height: 150px; }
    </style>
  </head>
  <body>
    <main data-audit-ready="geometry-undeclared">
      <section class="declared-group">
        <article class="candidate-card"><div>Declarada uno</div></article>
        <article class="candidate-card"><div>Declarada dos</div></article>
      </section>
      <section class="undeclared-group">
        <article class="candidate-card"><label>Candidata corta <input type="checkbox"></label></article>
        <article class="candidate-card"><label>Candidata alta <input type="checkbox"></label></article>
      </section>
      <ol class="undeclared-list">
        <li class="candidate-list-row"><span>Paso uno</span><button type="button">Activar</button></li>
        <li class="candidate-list-row"><span>Paso dos</span><button type="button">Activar</button></li>
      </ol>
      <section class="undeclared-cards">
        <span class="candidate-control-card"><strong>Umbral uno</strong><input type="number" value="10"></span>
        <span class="candidate-control-card"><strong>Umbral dos</strong><input type="number" value="20"></span>
      </section>
      <div class="undeclared-sections">
        <section class="candidate-control-section"><button type="button">Criterio uno</button></section>
        <section class="candidate-control-section"><button type="button">Criterio dos</button></section>
      </div>
      <div class="undeclared-flex-cards">
        <span class="candidate-flex-control-card"><strong>Tarjeta flexible uno</strong><input type="checkbox"></span>
        <span class="candidate-flex-control-card"><strong>Tarjeta flexible dos</strong><input type="checkbox"></span>
      </div>
      <div class="false-field-labels">
        <label class="candidate-field-label">Mínimo <input type="number" value="10"></label>
        <label class="candidate-field-label">Máximo <input type="number" value="20"></label>
      </div>
      <div class="false-inline-badges">
        <span class="candidate-inline-badge">Activa</span>
        <span class="candidate-inline-badge">Heredada</span>
      </div>
      <div class="false-inline-legend">
        <span class="candidate-inline-legend"><span class="legend-key">A</span><span class="legend-label"> Incluida</span></span>
        <span class="candidate-inline-legend"><span class="legend-key">B</span><span class="legend-label"> Excluida</span></span>
      </div>
      <nav aria-label="Navegación negativa">
        <a class="candidate-card" href="#uno">Sección uno</a>
        <a class="candidate-card" href="#dos">Sección dos</a>
      </nav>
      <div role="tablist" aria-label="Pestañas negativas">
        <button class="candidate-card" role="tab">Pestaña uno</button>
        <button class="candidate-card" role="tab">Pestaña dos</button>
      </div>
      <table>
        <tbody>
          <tr class="candidate-card"><td>Fila corta</td></tr>
          <tr class="candidate-card"><td>Fila alta</td></tr>
        </tbody>
      </table>
      <section class="mixed-variants">
        <article class="candidate-card candidate-card--primary"><div>Variante primaria</div></article>
        <article class="candidate-card candidate-card--secondary"><div>Variante secundaria</div></article>
      </section>
    </main>
  </body>
</html>`;

const unequalWidthPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Unequal width geometry fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      .equal-width { display: flex; gap: 16px; margin: 16px; align-items: start; }
      .equal-width > article { height: 120px; border: 1px solid #999; padding: 12px; }
      .equal-width > article:first-child { width: 200px; }
      .equal-width > article:last-child { width: 260px; }
    </style>
  </head>
  <body>
    <main data-audit-ready="geometry-width">
      <section class="equal-width">
        <article><div>Marco angosto</div></article>
        <article><div>Marco ancho</div></article>
      </section>
    </main>
  </body>
</html>`;

const zeroCapacityScrollPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Zero capacity scroll fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      .mon-page { height: 200px; overflow: hidden; }
      .zero-scroll-owner { height: 0; overflow-y: auto; }
      .zero-scroll-owner > div,
      .clipped-content { height: 500px; }
    </style>
  </head>
  <body>
    <main class="mon-page" data-audit-ready="zero-scroll">
      <section class="zero-scroll-owner"><div>Scroll sin ventana visible</div></section>
      <section class="clipped-content">Contenido recortado</section>
    </main>
  </body>
</html>`;

const terminalContentPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Terminal content fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      .terminal-group { margin: 16px; }
      .terminal-group > article { border: 1px solid #999; padding: 12px; }
      .terminal-owner { height: 96px; overflow-y: auto; }
      .terminal-wrapper {
        height: 32px;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .visible-wrapper,
      .nested-wrapper { overflow: visible; }
      .visible-terminal {
        flex: 0 0 48px;
        margin-top: 120px;
      }
      .clip-owner {
        display: flex;
        flex-direction: column;
      }
      .terminal-spacer { flex: 0 0 120px; }
      .clip-wrapper { flex: 0 0 32px; overflow: hidden; }
      .clip-terminal {
        flex: 0 0 40px;
        margin-top: 48px;
      }
      .nested-inner-owner {
        flex: 0 0 64px;
        margin-top: 120px;
        overflow-y: auto;
      }
      .nested-inner-content { height: 200px; }
    </style>
  </head>
  <body>
    <main data-audit-ready="terminal-content">
      <section id="visible-group" class="terminal-group">
        <article>
          <div class="terminal-owner visible-owner">
            <div class="terminal-wrapper visible-wrapper">
              <article class="visible-terminal terminal">Terminal visible</article>
            </div>
          </div>
        </article>
      </section>
      <section id="clip-group" class="terminal-group">
        <article>
          <div class="terminal-owner clip-owner">
            <div class="terminal-spacer"></div>
            <div class="terminal-wrapper clip-wrapper">
              <article class="clip-terminal terminal">Terminal recortado</article>
            </div>
          </div>
        </article>
      </section>
      <section id="nested-group" class="terminal-group">
        <article>
          <div class="terminal-owner nested-outer-owner">
            <div class="terminal-wrapper nested-wrapper">
              <div class="nested-inner-owner">
                <div class="nested-inner-content">Contenido del owner interior</div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  </body>
</html>`;

const settledMotionPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Settled motion geometry fixture</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px sans-serif; }
      @keyframes settle-member {
        from { opacity: 0; transform: translateY(48px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes decorative-spin {
        to { transform: rotate(360deg); }
      }
      .settled-motion-group {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin: 16px;
        align-items: start;
      }
      .settled-member,
      .visibility-wrapper > article {
        border: 1px solid #999;
        padding: 12px;
      }
      .settled-member {
        opacity: 0;
        transform: translateY(48px);
        animation: settle-member 1ms linear forwards;
      }
      .settled-member:nth-child(1) { animation-delay: 30s; }
      .settled-member:nth-child(2) { animation-delay: 31s; }
      .settled-member:nth-child(3) { animation-delay: 32s; }
      .partially-visible { opacity: .35; }
      .actually-hidden { opacity: 0; }
      .opacity-overflow {
        width: 44px;
        overflow: visible;
        white-space: nowrap;
      }
      .decorative-spinner {
        display: block;
        width: 16px;
        height: 16px;
        margin: 16px;
        border: 2px solid #777;
        animation: decorative-spin 250ms linear infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .settled-member {
          animation: none;
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  </head>
  <body>
    <main data-audit-ready="settled-motion">
      <span class="decorative-spinner" aria-hidden="true"></span>
      <section
        class="settled-motion-group"
        data-qa-geometry-group="settled-motion"
        data-qa-geometry-contract="intrinsic"
      >
        <article id="settled-one" class="settled-member" data-qa-geometry-member><strong>Etapa uno</strong></article>
        <article id="settled-two" class="settled-member" data-qa-geometry-member><strong>Etapa dos</strong></article>
        <article id="settled-three" class="settled-member" data-qa-geometry-member><strong>Etapa tres</strong></article>
        <div class="visibility-wrapper partially-visible">
          <article id="partially-visible" data-qa-geometry-member><strong>Visible parcial</strong></article>
          <button class="opacity-overflow" type="button">Desborde visible con opacidad positiva</button>
        </div>
        <div class="visibility-wrapper actually-hidden">
          <article id="actually-hidden" data-qa-geometry-member><strong>No visible</strong></article>
          <button class="opacity-overflow" type="button">Desborde oculto por opacidad cero</button>
        </div>
      </section>
    </main>
  </body>
</html>`;

async function startFixtureServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", connection: "close" });
    response.end(
      request.url === "/valid"
        ? validPageHtml
        : request.url === "/unequal-width"
          ? unequalWidthPageHtml
        : request.url === "/undeclared-geometry"
          ? undeclaredGeometryPageHtml
        : request.url === "/zero-scroll"
          ? zeroCapacityScrollPageHtml
          : request.url === "/terminal-content"
            ? terminalContentPageHtml
            : request.url === "/settled-motion"
              ? settledMotionPageHtml
          : pageHtml,
    );
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

async function runScrollQuickCheck({ url, out }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", "/zero-scroll",
      "--viewport", "900x700",
      "--out", out,
      "--fail-on-issues",
    ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function runQuickCheck({ url, out, route }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", route,
      "--viewport", "900x700",
      "--out", out,
      "--geometry-group", "equal::.equal",
      "--geometry-group", "intrinsic::.intrinsic",
      "--require-geometry",
      "--fail-on-issues",
    ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function runTerminalQuickCheck({ url, out }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", "/terminal-content",
      "--viewport", "900x700",
      "--out", out,
      "--geometry-group", "equal::.terminal-group",
      "--geometry-tolerance", "2",
      "--require-geometry",
      "--fail-on-issues",
    ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function runUndeclaredGeometryQuickCheck({ url, out }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", "/undeclared-geometry",
      "--viewport", "900x700",
      "--out", out,
      "--geometry-group", "equal::.declared-group",
      "--require-geometry",
      "--fail-on-issues",
    ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function runUnequalWidthQuickCheck({ url, out }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", "/unequal-width",
      "--viewport", "900x700",
      "--out", out,
      "--geometry-group", "equal::.equal-width",
      "--geometry-tolerance", "2",
      "--require-geometry",
      "--fail-on-issues",
    ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function runSettledMotionQuickCheck({ url, out }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", "/settled-motion",
      "--viewport", "900x700",
      "--out", out,
      "--require-geometry",
      "--fail-on-issues",
    ], { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("ui-quick-check reports equal-frame drift and invalid intrinsic capacity", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-geometry-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const invalidOut = path.join(tempRoot, "invalid");
  const result = await runQuickCheck({ url: fixture.url, out: invalidOut, route: "/invalid" });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);

  const report = JSON.parse(await fs.readFile(path.join(invalidOut, "report.json"), "utf8"));
  assert.equal(report.summary.geometryGroups, 2);
  assert.equal(report.summary.geometryCoverageMisses, 0);
  assert.deepEqual(
    report.results[0].geometryIssues.map((issue) => issue.type).sort(),
    ["capacity-drift", "equal-frame-drift"],
  );
  const placeholderMetric = report.results[0].controlTextMetrics.find(
    (metric) => metric.label === "Buscar UMP, manzana, distrito o responsable...",
  );
  assert.equal(placeholderMetric.clippedX, true);
  assert.ok(placeholderMetric.textWidth > placeholderMetric.availableWidth);
  assert.equal(
    report.results[0].issues.some((issue) => issue.type === "placeholder-clipped"),
    true,
  );

  const equalAudit = report.results[0].geometryAudits.find((audit) => audit.contract === "equal");
  assert.equal(equalAudit.members.length, 2);
  assert.equal(equalAudit.members[0].cardinality, 1);
  assert.ok(equalAudit.members[0].unusedInteriorBottom > 0);
  assert.ok(equalAudit.heightDelta > 2);

  const validOut = path.join(tempRoot, "valid");
  const validResult = await runQuickCheck({ url: fixture.url, out: validOut, route: "/valid" });
  assert.equal(validResult.status, 0, `${validResult.stdout}\n${validResult.stderr}`);
  const validReport = JSON.parse(await fs.readFile(path.join(validOut, "report.json"), "utf8"));
  assert.equal(validReport.ok, true);
  assert.equal(validReport.summary.geometryGroups, 2);
  assert.equal(validReport.summary.geometryIssues, 0);
  const validEqualAudit = validReport.results[0].geometryAudits.find((audit) => audit.contract === "equal");
  assert.ok(validEqualAudit.widthDelta <= 2);
  assert.ok(validEqualAudit.members[0].unusedInteriorBottom > 0, "equal frames may preserve unused interior capacity");
  assert.equal(validEqualAudit.members[0].overflowOwner.scrollAudit.atEnd, true);
  assert.equal(validEqualAudit.members[0].overflowOwner.scrollAudit.lastContentReachable, true);
  assert.equal(
    validEqualAudit.members[0].overflowOwner.scrollAudit.positions.end,
    validEqualAudit.members[0].overflowOwner.scrollAudit.maxScroll,
  );
  assert.equal(
    validEqualAudit.members[0].overflowOwner.textMetrics.some((item) => item.clippedX || item.clippedY),
    false,
  );
});

test("ui-quick-check rejects a zero-height descendant as scroll owner", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-zero-scroll-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const out = path.join(tempRoot, "zero-scroll");
  const result = await runScrollQuickCheck({ url: fixture.url, out });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);

  const report = JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));
  assert.equal(report.summary.scrollJails, 1);
  assert.equal(report.results[0].scrollJails[0].type, "scroll-jail");
  assert.equal(report.results[0].scrollJails[0].scrollOwner, null);
});

test("ui-quick-check follows visible wrappers without crossing clips or nested owners", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-terminal-content-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const out = path.join(tempRoot, "terminal-content");
  const result = await runTerminalQuickCheck({ url: fixture.url, out });
  assert.equal(result.status, 1, `\${result.stdout}\n\${result.stderr}`);

  const report = JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));
  assert.equal(report.summary.geometryGroups, 3);
  assert.equal(report.summary.geometryCoverageMisses, 0);
  assert.equal(report.summary.geometryIssues, 1);

  const audits = report.results[0].geometryAudits;
  const issues = report.results[0].geometryIssues;
  const visibleAudit = audits.find((audit) => audit.group.id === "visible-group")
    .members[0].overflowOwner.scrollAudit;
  assert.equal(visibleAudit.atEnd, true);
  assert.equal(visibleAudit.positions.end, visibleAudit.maxScroll);
  assert.equal(visibleAudit.lastContent.className, "visible-terminal terminal");
  assert.equal(visibleAudit.lastContentKind, "leaf");
  assert.equal(visibleAudit.lastContentReachable, true);

  const clipIssue = issues[0];
  assert.match(clipIssue.owner.className, /\bclip-owner\b/);
  assert.equal(clipIssue.scrollAudit.lastContent.className, "clip-terminal terminal");
  assert.equal(clipIssue.scrollAudit.lastContentKind, "clipped");
  assert.equal(clipIssue.scrollAudit.lastContentReachable, false);
  assert.match(clipIssue.scrollAudit.clippedBy.className, /\bclip-wrapper\b/);

  const nestedAudit = audits.find((audit) => audit.group.id === "nested-group")
    .members[0].overflowOwner.scrollAudit;
  assert.equal(nestedAudit.lastContent.className, "nested-inner-owner");
  assert.equal(nestedAudit.lastContentKind, "nested-scroll");
  assert.equal(nestedAudit.lastContentReachable, true);
  assert.equal(issues.some((issue) => /\bnested-outer-owner\b/.test(issue.owner.className)), false);
});

test("ui-quick-check reports only structural undeclared geometry groups", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-geometry-undeclared-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const out = path.join(tempRoot, "undeclared-geometry");
  const result = await runUndeclaredGeometryQuickCheck({ url: fixture.url, out });
  const report = JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));

  assert.equal(report.summary.geometryGroups, 1);
  const misses = report.results[0].geometryCoverageMisses;
  assert.deepEqual(
    misses.map((miss) => ({
      type: miss.type,
      parent: miss.parent.className,
      variant: miss.variant,
      count: miss.count,
    })),
    [
      { type: "geometry-undeclared", parent: "undeclared-group", variant: "article.candidate-card", count: 2 },
      { type: "geometry-undeclared", parent: "undeclared-list", variant: "li.candidate-list-row", count: 2 },
      { type: "geometry-undeclared", parent: "undeclared-cards", variant: "span.candidate-control-card", count: 2 },
      { type: "geometry-undeclared", parent: "undeclared-sections", variant: "section.candidate-control-section", count: 2 },
      { type: "geometry-undeclared", parent: "undeclared-flex-cards", variant: "span.candidate-flex-control-card", count: 2 },
    ],
    `runner status=${result.status}\n${result.stdout}\n${result.stderr}`,
  );
  assert.equal(report.summary.geometryCoverageMisses, 5);
  assert.equal(misses.length, 5);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
});

test("ui-quick-check reports unequal widths for an equal geometry group", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-width-geometry-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const result = await runUnequalWidthQuickCheck({ url: fixture.url, out: tempRoot });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(await fs.readFile(path.join(tempRoot, "report.json"), "utf8"));
  assert.equal(report.summary.geometryGroups, 1);
  assert.equal(report.summary.geometryIssues, 1);
  const audit = report.results[0].geometryAudits[0];
  assert.equal(audit.contract, "equal");
  assert.equal(audit.heightDelta, 0);
  assert.equal(audit.widthDelta, 60);
  assert.deepEqual(report.results[0].geometryIssues, [{
    type: "equal-frame-width-drift",
    selector: ".equal-width",
    widthDelta: 60,
    tolerance: 2,
    memberWidths: [200, 260],
  }]);
});

test("ui-quick-check inspects settled staggered motion and excludes effective opacity zero", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-settled-motion-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const result = await runSettledMotionQuickCheck({ url: fixture.url, out: tempRoot });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);

  const report = JSON.parse(await fs.readFile(path.join(tempRoot, "report.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.equal(report.summary.visualIssues, 1);
  assert.equal(report.summary.geometryGroups, 1);
  assert.equal(report.summary.geometryIssues, 0);
  assert.equal(report.summary.geometryCoverageMisses, 0);
  assert.deepEqual(
    report.results[0].issues.map((issue) => issue.label),
    ["Desborde visible con opacidad positiva"],
    "opacity: .35 remains auditable while an equivalent overflow under opacity: 0 stays absent",
  );

  const audit = report.results[0].geometryAudits[0];
  assert.equal(audit.contract, "intrinsic");
  assert.deepEqual({
    memberIds: audit.members.map((member) => member.id),
    allAtFinalY: audit.members.every((member) => member.rect.y === audit.group.rect.y),
  }, {
    memberIds: ["settled-one", "settled-two", "settled-three", "partially-visible"],
    allAtFinalY: true,
  }, "the stagger must settle, positive opacity must remain, and effective opacity: 0 must stay absent");
});
