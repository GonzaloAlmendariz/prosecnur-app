import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Readiness con marcas anidadas, medida en un navegador de verdad.
//
// El fallback de `esperarListo` leía la PRIMERA `[data-audit-ready]`: una marca
// exterior en `true` tapaba a una superficie anidada en `false`. Así se capturó
// el Explorador de Cálculo de muestra en «Leyendo la base…» (E15/AD6). Estas
// fixtures no montan `.pulso-shell`, así que ejercen justo ese fallback, que es
// el mismo contrato que `estadoListo()` en lib/navegacion/runtime.ts.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const quickCheckPath = path.join(repoRoot, "scripts/ui-quick-check.mjs");

const pagina = (cuerpo, script = "") => `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><title>Readiness anidada</title></head>
  <body>
    <main data-audit-ready="exterior">
      <h1>Vista</h1>
      ${cuerpo}
    </main>
    ${script ? `<script>${script}</script>` : ""}
  </body>
</html>`;

const FIXTURES = {
  // La trampa de AD6: exterior lista, interior cargando para siempre.
  "/anidada-false": pagina(
    `<section class="cmv2-expb" data-surface-contract="explorador-bases" data-audit-ready="false">Leyendo la base…</section>`,
  ),
  // Una pestaña montada pero oculta no se captura: su false no bloquea.
  "/anidada-oculta": pagina(
    `<div hidden><section data-audit-ready="false">Pestaña inactiva</section></div>`,
  ),
  // El `hidden` del PROPIO nodo sí cuenta: Monitoreo publica ahí su marca.
  "/baliza-oculta": pagina(
    `<span hidden data-surface-contract="baliza-monitoreo" data-audit-ready="false"></span>`,
  ),
  // Una carga que termina en un estado terminal clasificado.
  "/anidada-tardia": pagina(
    `<section id="interior" data-audit-ready="false">Leyendo la base…</section>`,
    `setTimeout(() => {
      const el = document.getElementById("interior");
      el.textContent = "Sin referencia histórica";
      el.setAttribute("data-audit-ready", "vacio:sin-referencia-historica");
    }, 1800);`,
  ),
};

async function startFixtureServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", connection: "close" });
    response.end(FIXTURES[request.url] ?? pagina(""));
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

async function runQuickCheck({ url, out, route }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      quickCheckPath,
      "--url", url,
      "--api", "stub",
      "--route", route,
      "--viewport", "900x700",
      "--timeout-ms", "3000",
      "--out", out,
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

test("readiness: ninguna marca visible en false, no sólo la primera", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-ui-readiness-anidada-"));
  t.after(async () => {
    await new Promise((resolve, reject) => fixture.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  await t.test("una marca anidada en false bloquea aunque la exterior esté lista", async () => {
    const r = await runQuickCheck({ url: fixture.url, out: path.join(tempRoot, "false"), route: "/anidada-false" });
    const salida = `${r.stdout}\n${r.stderr}`;
    assert.notEqual(r.status, 0, salida);
    assert.match(salida, /marca-en-false/);
    // La pista nombra la superficie que sigue sin cumplir.
    assert.match(salida, /explorador-bases/);
  });

  await t.test("un false bajo un ancestro oculto no bloquea", async () => {
    const out = path.join(tempRoot, "oculta");
    const r = await runQuickCheck({ url: fixture.url, out, route: "/anidada-oculta" });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  });

  await t.test("el hidden del propio nodo sí cuenta: la baliza de Monitoreo bloquea", async () => {
    const r = await runQuickCheck({ url: fixture.url, out: path.join(tempRoot, "baliza"), route: "/baliza-oculta" });
    const salida = `${r.stdout}\n${r.stderr}`;
    assert.notEqual(r.status, 0, salida);
    assert.match(salida, /baliza-monitoreo/);
  });

  await t.test("espera a que la anidada termine y captura su vacío clasificado", async () => {
    const out = path.join(tempRoot, "tardia");
    const r = await runQuickCheck({ url: fixture.url, out, route: "/anidada-tardia" });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const report = JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));
    const ready = report.results[0].ready ?? report.results[0].dom?.ready;
    assert.ok(Array.isArray(ready), JSON.stringify(Object.keys(report.results[0])));
    assert.deepEqual(ready, ["exterior", "vacio:sin-referencia-historica"]);
  });
});
