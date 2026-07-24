import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const visualQaPath = path.join(repoRoot, "scripts/visual-qa.mjs");

const pageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Readiness fixture</title>
  </head>
  <body>
    <section data-audit-ready="validacion">Validación lista</section>
  </body>
</html>`;

const clickPageHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Post-click readiness fixture</title>
  </head>
  <body>
    <button type="button" role="tab">Destino</button>
    <section id="panel" data-audit-ready="origen">Panel de origen</section>
    <script>
      document.querySelector("button").addEventListener("click", () => {
        const panel = document.querySelector("#panel");
        panel.removeAttribute("data-audit-ready");
        panel.textContent = "Cargando destino";
        window.setTimeout(() => {
          panel.dataset.auditReady = "destino";
          panel.textContent = "Panel de destino";
        }, 650);
      });
    </script>
  </body>
</html>`;

async function startFixtureServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      connection: "close",
    });
    response.end(request.url === "/click" ? clickPageHtml : pageHtml);
  });

  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function runVisualQa({ url, out, waitSelector, clickTabs = [], timeoutMs = 500 }) {
  return await new Promise((resolve, reject) => {
    const clickArgs = clickTabs.flatMap((tab) => ["--click-tab", tab]);
    const child = spawn(
      process.execPath,
      [
        visualQaPath,
        "--url",
        url,
        "--api",
        "auto",
        "--out",
        out,
        "--wait-selector",
        waitSelector,
        ...clickArgs,
        "--no-reload-engine",
        "--only-viewport",
        "320x240",
        "--timeout-ms",
        String(timeoutMs),
        "--fail-on-issues",
      ],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
      resolve({ status, signal, stdout, stderr });
    });
  });
}

async function readReport(out) {
  return JSON.parse(await fs.readFile(path.join(out, "report.json"), "utf8"));
}

function childDiagnostic(result) {
  return [
    `status=${result.status} signal=${result.signal ?? "none"}`,
    result.stdout.trim(),
    result.stderr.trim(),
  ].filter(Boolean).join("\n");
}

test("visual-qa treats wait-selector readiness as a strict contract", async (t) => {
  const fixture = await startFixtureServer();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prosecnur-visual-qa-readiness-"));

  t.after(async () => {
    await closeServer(fixture.server);
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  await t.test("control: the matching semantic selector completes cleanly", async () => {
    const out = path.join(tempRoot, "matching");
    const result = await runVisualQa({
      url: fixture.url,
      out,
      waitSelector: '[data-audit-ready="validacion"]',
    });

    assert.equal(result.status, 0, childDiagnostic(result));
    assert.equal(result.signal, null, childDiagnostic(result));

    const report = await readReport(out);
    assert.equal(report.ok, true);
    assert.deepEqual(report.viewports[0].ready, ["validacion"]);
    assert.equal(report.summary.waitSelectorMisses ?? 0, 0);
  });

  await t.test("mismatch: a missing semantic selector fails the run and report", async () => {
    const out = path.join(tempRoot, "mismatch");
    const result = await runVisualQa({
      url: fixture.url,
      out,
      waitSelector: '[data-audit-ready="codificacion"]',
    });
    assert.equal(result.signal, null, childDiagnostic(result));

    const report = await readReport(out);
    assert.equal(report.options.waitSelector, '[data-audit-ready="codificacion"]');
    assert.deepEqual(
      {
        exitStatus: result.status,
        reportOk: report.ok,
        waitSelectorMisses: report.summary.waitSelectorMisses,
      },
      {
        exitStatus: 1,
        reportOk: false,
        waitSelectorMisses: 1,
      },
      childDiagnostic(result),
    );
  });

  await t.test("click: readiness is checked after the destination panel settles", async () => {
    const out = path.join(tempRoot, "post-click");
    const result = await runVisualQa({
      url: new URL("/click", fixture.url).toString(),
      out,
      waitSelector: '[data-audit-ready="destino"]',
      clickTabs: ["Destino"],
      timeoutMs: 1000,
    });
    assert.equal(result.signal, null, childDiagnostic(result));

    const report = await readReport(out);
    assert.deepEqual(
      {
        exitStatus: result.status,
        reportOk: report.ok,
        waitSelectorMisses: report.summary.waitSelectorMisses,
        ready: report.viewports[0].ready,
      },
      {
        exitStatus: 0,
        reportOk: true,
        waitSelectorMisses: 0,
        ready: ["destino"],
      },
      childDiagnostic(result),
    );
  });
});
