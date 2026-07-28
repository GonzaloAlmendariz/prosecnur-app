import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const quickCheckPath = path.join(repoRoot, "scripts/ui-quick-check.mjs");

async function readFunctionSource(name, nextName) {
  const source = await fs.readFile(quickCheckPath, "utf8");
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `expected ${name} to exist`);
  assert.notEqual(end, -1, `expected ${nextName} to follow ${name}`);
  return source.slice(start, end);
}

test("canonical navigation cannot approve a route without final readiness", async () => {
  const source = await fs.readFile(quickCheckPath, "utf8");

  assert.doesNotMatch(
    source,
    /if \(ultimo\.motivo === "sin-marca-de-readiness"\) return ultimo;/,
    "a missing readiness marker must keep polling instead of ending the wait",
  );
  assert.match(source, /const readiness = await esperarListo\(page, timeoutMs\);/);
  assert.match(source, /if \(!readiness\?\.listo\) \{/);
  assert.match(source, /La dirección .* no alcanzó readiness final/);
});

test("visibility audits ignore descendants hidden by a closed details", async () => {
  const source = await fs.readFile(quickCheckPath, "utf8");

  assert.match(source, /closest\("details:not\(\[open\]\)"\)/);
  assert.match(source, /visibleSummary\.contains\(el\)/);
});

test("canonical navigation does not spend its full readiness budget waiting for network idle", async () => {
  const source = await readFunctionSource("irADireccion", "esperarListo");

  assert.doesNotMatch(
    source,
    /waitForLoadState\("networkidle",\s*\{\s*timeout:\s*timeoutMs\s*\}\)/,
    "networkidle is auxiliary and must not consume the destination readiness timeout",
  );
});

test("telephone click labels prefetch the phone summary report", async () => {
  const source = await readFunctionSource("monitoreoReportScopeForClickTabs", "prefetchRouteDataForQa");

  assert.match(source, /phone_summary/);
  assert.match(source, /tel[eé]fono|llamada/i);
});

test("click-tab transitions require final readiness after the click", async () => {
  const source = await fs.readFile(quickCheckPath, "utf8");
  const start = source.indexOf("for (const tab of opts.clickTabs)");
  const end = source.indexOf("let postClickWaitSelectorMatched", start + 1);
  assert.notEqual(start, -1, "expected the clickTabs transition loop to exist");
  assert.notEqual(end, -1, "expected the clickTabs transition loop boundary to exist");
  const clickLoop = source.slice(start, end);

  assert.match(clickLoop, /await esperarListo\(page,\s*opts\.timeoutMs\)/);
  assert.match(clickLoop, /if\s*\(\s*![A-Za-z_$][\w$]*\?\.listo\s*\)/);
});

test("readiness keeps polling while the navigation bridge is temporarily absent", async () => {
  const source = await readFunctionSource("esperarListo", "clickNamedControl");

  assert.doesNotMatch(
    source,
    /if\s*\(\s*!ultimo\s*\)\s*return\s*\{\s*listo:\s*false,\s*motivo:\s*"sin-puente"\s*\}/,
    "the navigation bridge can be installed after page.goto, so its temporary absence must keep polling",
  );
});

test("static audit fixtures may use their marker without weakening app readiness", async () => {
  const source = await readFunctionSource("esperarListo", "clickNamedControl");

  assert.match(source, /querySelector\("\[data-audit-ready\]"\)/);
  assert.match(source, /querySelector\("\.pulso-shell"\)/);
  assert.match(
    source,
    /!appShell[\s\S]*marker/,
    "the DOM-marker fallback must only apply outside a mounted Prosecnur shell",
  );
});
