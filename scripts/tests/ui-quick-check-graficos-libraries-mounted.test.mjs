import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { startStack, stopStack } from "../ui-quick-check.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const fixturePath = path.join(
  repoRoot,
  "scripts/tests/fixtures/graficos-libraries-acnur-acg.v1.json",
);
const sourceProjectPath = path.join(
  repoRoot,
  "api/inst/reference_projects/acnur_acg/acnur_acg.pulso",
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url),
);
const { chromium } = requireFromFrontend("@playwright/test");

const SLIDE_ROOT = '[data-audit-ready="slide-picker"]';
const GRAF_ROOT = '[data-audit-ready="graficador-picker"]';
const SLIDE_FRAME = ".pulso-slide-library-card-frame";
const GRAF_FRAME = ".pulso-graficador-library-card-frame";
const READY_TIMEOUT_MS = 60_000;
const VIEWPORT_LARGE = { width: 1440, height: 1000 };
const VIEWPORT_COMPACT = { width: 1024, height: 600 };
const ALLOWED_FIXTURE_PATH = "/fixtures/acnur_acg.pulso";
const PII_KEY_TOKENS = new Set([
  "correo", "email", "telefono", "phone", "dni", "documento", "cliente", "client",
]);

let browser;
let stack;
let tempDir;
let vitePid;
let vitePort;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fixtureSanitizationViolations(value, currentPath = "$", violations = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      fixtureSanitizationViolations(item, `${currentPath}[${index}]`, violations);
    });
    return violations;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = `${currentPath}.${key}`;
      const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const keyTokens = normalizedKey.split(/[^a-z0-9]+/).filter(Boolean);
      if (/state\.rds/i.test(key)) violations.push(`${nextPath}: key state.rds`);
      if (keyTokens.some((token) => PII_KEY_TOKENS.has(token))) {
        violations.push(`${nextPath}: key PII`);
      }
      fixtureSanitizationViolations(nested, nextPath, violations);
    }
    return violations;
  }

  if (typeof value !== "string") return violations;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    violations.push(`${currentPath}: email`);
  }
  if (/state\.rds/i.test(value)) violations.push(`${currentPath}: state.rds`);
  const clientUserPath = /\/Users\/|\/home\/|[A-Za-z]:\\Users\\/i.test(value);
  const absolutePath = /^(?:\/|[A-Za-z]:[\\/])/.test(value);
  if ((clientUserPath || absolutePath) && value !== ALLOWED_FIXTURE_PATH) {
    violations.push(`${currentPath}: ruta absoluta`);
  }
  return violations;
}

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function responseGate() {
  const seen = deferred();
  const release = deferred();
  let seenOnce = false;
  let released = false;
  return {
    seen: seen.promise,
    releasePromise: release.promise,
    markSeen() {
      if (seenOnce) return;
      seenOnce = true;
      seen.resolve();
    },
    release() {
      if (released) return;
      released = true;
      release.resolve();
    },
  };
}

async function withTimeout(promise, label, timeoutMs = 15_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout esperando ${label}`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sessionStateFor(sid) {
  return sid === fixture.session_ids.B
    ? clone(fixture.sessions.B)
    : clone(fixture.sessions.A);
}

function registryFor(sid, options) {
  const registry = clone(fixture.registry);
  if (options.markSessionA && sid === fixture.session_ids.A) {
    const dimension = registry.graficadores.find((item) => item.name === "p_dim_radar");
    dimension.titulo_humano = `${dimension.titulo_humano} · sesión A QA`;
  }
  if (options.includeFutureSlide) {
    registry.slides.push(clone(fixture.sentinels.future_slide));
  }
  if (options.includeFutureGraficador) {
    registry.graficadores.push(clone(fixture.sentinels.future_graficador));
  }
  if (options.registryState === "empty-slides") registry.slides = [];
  if (options.registryState === "empty-graficadores") registry.graficadores = [];
  return registry;
}

async function installFixtureRouter(context, options = {}) {
  const initialSid = options.initialSid ?? fixture.session_ids.A;
  const evidence = {
    requests: [],
    computationalPosts: [],
    unauthorizedWrites: [],
    unexpectedEndpoints: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname;
    const method = request.method().toUpperCase();
    if (!endpoint.startsWith("/api/")) return route.continue();
    const sid = request.headers()["x-pulso-session"] || initialSid;
    evidence.requests.push({ method, endpoint, sid });

    const fulfillJson = (body, status = 200, headers = {}) => route.fulfill({
      status,
      contentType: "application/json",
      headers,
      body: JSON.stringify(body),
    });

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (endpoint === "/api/graficos/plan/coverage" && method === "POST") {
        evidence.computationalPosts.push({ method, endpoint, sid });
        return fulfillJson(fixture.coverage);
      }
      evidence.unauthorizedWrites.push({ method, endpoint, sid });
      return fulfillJson({ error: { code: "E_QA_READ_ONLY", message: "Fixture L6 de sólo lectura" } }, 405);
    }

    if (endpoint === "/api/system/health") {
      return fulfillJson({
        ok: true,
        version: "l6-mounted-test",
        prosecnur_version: "fixture",
        time: "2026-08-08T00:00:00Z",
      });
    }
    if (endpoint === "/api/system/bootstrap") {
      return fulfillJson({ sid: initialSid });
    }
    if (endpoint === "/api/session/state") {
      const gate = options.stateGates?.get(sid);
      if (gate) {
        gate.markSeen();
        await gate.releasePromise;
      }
      return fulfillJson(sessionStateFor(sid));
    }
    if (endpoint === "/api/project/status") {
      return fulfillJson(fixture.project_status);
    }
    if (endpoint === "/api/project/overview") {
      return fulfillJson(fixture.overview);
    }
    if (endpoint === "/api/estudio") {
      return fulfillJson(fixture.estudio);
    }
    if (endpoint === "/api/graficos/config") {
      return fulfillJson({ ok: true, config: fixture.config });
    }
    if (endpoint === "/api/graficos/registry") {
      const gate = options.registryGates?.get(sid);
      if (gate) {
        gate.markSeen();
        await gate.releasePromise;
      }
      if (options.registryState === "error") {
        return fulfillJson({ error: { code: "E_QA_REGISTRY", message: "fallo controlado" } }, 503);
      }
      return fulfillJson(registryFor(sid, options));
    }
    if (endpoint === "/api/graficos/templates") {
      return fulfillJson({ templates: [] });
    }
    if (endpoint === "/api/graficos/variables") {
      return fulfillJson(fixture.variables);
    }
    if (endpoint === "/api/graficos/presets-defaults") {
      return fulfillJson({ ok: true, presets: {}, es_custom: false });
    }
    if (endpoint === "/api/graficos/presets-metadata") {
      return fulfillJson({ presets: [] });
    }
    if (endpoint === "/api/graficos/ppt-style-profiles") {
      return fulfillJson({ style_profiles: [] });
    }
    if (endpoint === "/api/graficos/slide-layout-preview") {
      return fulfillJson({
        ok: true,
        tipo: url.searchParams.get("tipo") || "",
        layout: "Fixture L6",
        source: "fallback",
        placeholders: [],
      });
    }

    evidence.unexpectedEndpoints.push({ method, endpoint, sid });
    return fulfillJson({
      error: {
        code: "E_QA_ENDPOINT_UNEXPECTED",
        message: `Endpoint no autorizado por fixture L6: ${method} ${endpoint}`,
      },
    }, 404);
  });

  return evidence;
}

async function createFixtureContext(viewport, options = {}) {
  const context = await browser.newContext({ viewport });
  const initialSid = options.initialSid ?? fixture.session_ids.A;
  await context.addInitScript(({ sessionId, projectStatus }) => {
    localStorage.setItem("pulso.sessionId", sessionId);
    localStorage.setItem("pulso.layoutPreset", "auto");
    localStorage.setItem("pulso.visualQaWarmup", "1");
    localStorage.setItem("pulso.visualQaWarmupModuleIds", "graficos");
    localStorage.setItem("pulso.visualQaSkipBackendWarmup", "1");
    sessionStorage.setItem("pulso.bootProject", JSON.stringify(projectStatus));
  }, { sessionId: initialSid, projectStatus: fixture.project_status });
  const evidence = await installFixtureRouter(context, { ...options, initialSid });
  return { context, evidence };
}

async function runFixtureContext(viewport, options, callback) {
  const { context, evidence } = await createFixtureContext(viewport, options);
  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") evidence.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      evidence.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "" });
    });
    try {
      await callback(page, evidence);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nEvidencia navegador: ${JSON.stringify(evidence)}`,
        { cause: error },
      );
    }
    assert.deepEqual(
      evidence.unexpectedEndpoints,
      [],
      `Endpoints inesperados: ${JSON.stringify(evidence.unexpectedEndpoints)}`,
    );
    assert.deepEqual(
      evidence.unauthorizedWrites,
      [],
      `Escrituras persistentes observadas: ${JSON.stringify(evidence.unauthorizedWrites)}`,
    );
  } finally {
    await context.close();
  }
}

function appUrl(search = "") {
  return new URL(`graficos${search}`, stack.url).toString();
}

async function openEditor(page, search = "") {
  await page.goto(appUrl(search), { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  try {
    await page.locator(".pulso-gv2-shell").waitFor({
      state: "visible",
      timeout: 20_000,
    });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      href: window.location.href,
      bootPhase: document.querySelector("[data-boot-phase]")?.getAttribute("data-boot-phase") ?? null,
      body: (document.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 800),
    }));
    throw new Error(`Gráficos no montó su shell: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
}

async function openSlidesFromTrigger(page) {
  const trigger = page.getByRole("button", { name: "Agregar slide" });
  await trigger.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  await trigger.click();
  const root = page.locator(SLIDE_ROOT);
  await root.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  return { root, trigger };
}

async function openSlidesFromShortcut(page) {
  const trigger = page.getByRole("button", { name: "Agregar slide" });
  await trigger.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  await trigger.focus();
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  const root = page.locator(SLIDE_ROOT);
  assert.equal(await root.count(), 0, "La biblioteca debe estar cerrada antes de pulsar N");
  await page.keyboard.press("N");
  await root.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  return { root, trigger };
}

async function openGraphsFromPopulatedSlot(page) {
  const occupied = page.locator('[data-graficador="p_barras_agrupadas"]');
  await occupied.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  const trigger = occupied.getByRole("button", { name: "Cambiar por otro tipo de gráfico" });
  await trigger.click();
  const root = page.locator(GRAF_ROOT);
  await root.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  return { root, trigger };
}

async function assertFocusInside(page, root) {
  assert.equal(await root.evaluate((dialog) => dialog.contains(document.activeElement)), true);
  const candidates = root.locator([
    "a[href]",
    "button:not([disabled])",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", "));
  const visibleIndexes = await candidates.evaluateAll((nodes) => nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => {
      if (!(node instanceof HTMLElement) || node.tabIndex < 0) return false;
      if (node.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    })
    .sort((a, b) => {
      const aOrder = a.node.tabIndex > 0 ? a.node.tabIndex : Number.MAX_SAFE_INTEGER;
      const bOrder = b.node.tabIndex > 0 ? b.node.tabIndex : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.index - b.index;
    })
    .map(({ index }) => index));
  assert.ok(visibleIndexes.length >= 2, "El diálogo debe exponer ambos extremos tabbables");
  const first = candidates.nth(visibleIndexes[0]);
  const last = candidates.nth(visibleIndexes.at(-1));
  const rootHandle = await root.elementHandle();
  assert.ok(rootHandle, "El diálogo debe permanecer montado durante el trap de foco");

  await last.focus();
  assert.equal(await last.evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press("Tab");
  await page.waitForFunction((dialog) => dialog.contains(document.activeElement), rootHandle);
  assert.equal(await last.evaluate((node) => node !== document.activeElement), true);

  await first.focus();
  assert.equal(await first.evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  await page.waitForFunction((dialog) => dialog.contains(document.activeElement), rootHandle);
  assert.equal(await first.evaluate((node) => node !== document.activeElement), true);
}

async function focusedModelType(page) {
  return page.evaluate(() => document.activeElement?.closest("[data-model-type]")?.getAttribute("data-model-type"));
}

async function assertFocusedModelType(page, expected) {
  await page.waitForFunction((modelType) => (
    document.activeElement?.closest("[data-model-type]")?.getAttribute("data-model-type") === modelType
  ), expected);
  assert.equal(await focusedModelType(page), expected);
}

async function assertFocusReturned(page, locator) {
  const handle = await locator.elementHandle();
  assert.ok(handle, "El control de retorno de foco debe seguir montado");
  await page.waitForFunction((node) => document.activeElement === node, handle);
}

async function storeSlotSnapshot(page, slideId, slotName) {
  return page.evaluate(async ({ targetSlideId, targetSlotName }) => {
    const { usePlanStore } = await import("/src/features/graficos/store.ts");
    const state = usePlanStore.getState();
    const slide = state.plan.slides.find((item) => item.id === targetSlideId);
    const slotValue = slide?.payload?.[targetSlotName] ?? null;
    const occupantCount = state.plan.slides.filter((item) => {
      const occupant = item.payload?.[targetSlotName];
      return Boolean(occupant && typeof occupant === "object" && occupant.graficador);
    }).length;
    return {
      planSlideCount: state.plan.slides.length,
      occupantCount,
      slideId: slide?.id ?? null,
      slotName: targetSlotName,
      value: slotValue === null ? null : JSON.parse(JSON.stringify(slotValue)),
    };
  }, { targetSlideId: slideId, targetSlotName: slotName });
}

async function assertSingleLiveRegion(root, state) {
  const live = root.locator('[role="status"][aria-live], [role="alert"][aria-live]');
  assert.equal(await live.count(), 1, `${state} debe tener exactamente una región viva`);
  assert.equal(await live.getAttribute("aria-atomic"), "true");
  assert.equal(await live.getAttribute("role"), state === "error" ? "alert" : "status");
  assert.equal(await live.getAttribute("aria-live"), state === "error" ? "assertive" : "polite");
  if (state === "loading") assert.equal(await live.getAttribute("aria-busy"), "true");
}

async function waitForPortClosed(port, timeoutMs = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await portIsOpen(port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    const closed = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once("timeout", closed);
    socket.once("error", closed);
  });
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

before(async () => {
  tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "prosecnur-l6-mounted-"));
  const logDir = path.join(tempDir, "logs");
  await fsp.mkdir(logDir, { recursive: true });
  stack = await startStack({
    url: "",
    urlProvided: false,
    api: "stub",
    apiUrl: "",
    project: "",
    timeoutMs: READY_TIMEOUT_MS,
    frontendPort: Number(process.env.L6_GRAFICOS_FRONTEND_PORT || "5197"),
    apiPort: 8788,
  }, logDir);
  vitePid = stack.frontend?.pid ?? null;
  vitePort = stack.frontendPort;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  try {
    if (browser) {
      await browser.close();
      assert.equal(browser.isConnected(), false, "Chromium siguió conectado tras browser.close()");
    }
  } finally {
    await stopStack(stack);
    if (Number.isInteger(vitePort)) {
      assert.equal(await waitForPortClosed(vitePort), true, `Vite dejó ocupado el puerto ${vitePort}`);
    }
    if (Number.isInteger(vitePid)) {
      assert.equal(processIsAlive(vitePid), false, `Vite dejó vivo el PID ${vitePid}`);
    }
    if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true });
  }
});

test("fixture v1 conserva procedencia acnur_acg sin datos de cliente", () => {
  assert.equal(fixture.schema, "prosecnur.qa.graficos_libraries_fixture.v1");
  assert.equal(fixture.source.reference_project, "acnur_acg");
  assert.equal(fixture.source.sanitized, true);
  assert.equal(sha256File(sourceProjectPath), fixture.source.sha256);
  assert.equal(fixture.registry.slides.length, 20);
  assert.equal(fixture.registry.graficadores.length, 19);
  assert.equal(fixture.project_status.path, ALLOWED_FIXTURE_PATH);
  assert.deepEqual(fixtureSanitizationViolations(fixture), []);
});

test("1440: teclado, búsqueda, insertar-y-seguir, trap, Escape y reemplazo montados", async () => {
  await runFixtureContext(VIEWPORT_LARGE, {}, async (page) => {
    await openEditor(page);
    const timelineSlides = page.locator(
      '.pulso-gv2-timeline-list [role="button"][aria-label^="Slide "]',
    );
    const initialPlanSize = await timelineSlides.count();
    const { root, trigger } = await openSlidesFromShortcut(page);
    const search = root.getByRole("searchbox", { name: "Buscar modelo de slide" });
    await search.waitFor({ state: "visible" });
    assert.equal(await search.evaluate((node) => node === document.activeElement), true);
    assert.equal(await root.locator(SLIDE_FRAME).count(), 20);

    await search.fill("zzzz_l6_sin_coincidencias");
    await root.locator('[data-state="no-results"]').first().waitFor({ state: "visible" });
    await assertSingleLiveRegion(root, "no-results");
    await search.fill("");
    await root.locator(SLIDE_FRAME).first().waitFor({ state: "visible" });
    assert.equal(await root.locator(SLIDE_FRAME).count(), 20);
    await root.getByText("20 modelos visibles", { exact: true }).waitFor();

    const firstCard = root.locator(`${SLIDE_FRAME}[data-model-type="p_slide_portada"] button`);
    await firstCard.focus();
    await page.keyboard.press("End");
    await assertFocusedModelType(page, "p_slide_6_graficos_poblacion");
    await page.keyboard.press("Home");
    await assertFocusedModelType(page, "p_slide_portada");
    await page.keyboard.press("ArrowRight");
    await assertFocusedModelType(page, "p_slide_indice");
    await page.keyboard.press("Space");
    assert.equal(
      await root.locator(`${SLIDE_FRAME}[data-model-type="p_slide_indice"] button`).getAttribute("aria-pressed"),
      "true",
    );

    await search.focus();
    await assertFocusInside(page, root);
    await root.locator(`${SLIDE_FRAME}[data-model-type="p_slide_indice"] button`).focus();
    await page.keyboard.press("Enter");
    await root.getByText(/Índice insertado\. La biblioteca sigue abierta\. Inserción 1\./).waitFor();
    assert.equal(await timelineSlides.count(), initialPlanSize + 1, "Enter debe aumentar el plan en un slide");
    assert.equal(await root.isVisible(), true);
    await root.locator(`${SLIDE_FRAME}[data-model-type="p_slide_seccion"] button`).dblclick();
    await root.getByText(/Separador de sección insertado\. La biblioteca sigue abierta\. Inserción 2\./).waitFor();
    assert.equal(await timelineSlides.count(), initialPlanSize + 2, "doble clic debe aumentar el plan otra vez");
    await page.keyboard.press("Escape");
    await root.waitFor({ state: "detached" });
    await assertFocusReturned(page, trigger);
  });

  await runFixtureContext(VIEWPORT_LARGE, {}, async (page) => {
    await openEditor(page);
    const { root } = await openGraphsFromPopulatedSlot(page);
    const oldOccupant = page.locator('[data-graficador="p_barras_agrupadas"]');
    assert.equal(await oldOccupant.count(), 1);
    const beforeReplacement = await storeSlotSnapshot(page, "slide-l6-ocupado", "grafico");
    assert.deepEqual(beforeReplacement, {
      planSlideCount: 1,
      occupantCount: 1,
      slideId: "slide-l6-ocupado",
      slotName: "grafico",
      value: {
        graficador: "p_barras_agrupadas",
        args: {
          variable: "sexo",
          titulo: "Distribución inicial",
          obsoleto: "no debe sobrevivir al reemplazo",
        },
      },
    });
    const search = root.getByRole("searchbox", { name: "Buscar graficador" });
    assert.equal(await search.evaluate((node) => node === document.activeElement), true);
    await search.fill("zzzz_l6_sin_coincidencias");
    await root.locator('[data-state="no-results"]').first().waitFor({ state: "visible" });
    await assertSingleLiveRegion(root, "no-results");
    await search.fill("");
    assert.equal(await root.locator(GRAF_FRAME).count(), 19);
    await root.getByText("19 modelos visibles", { exact: true }).waitFor();

    const firstCard = root.locator(`${GRAF_FRAME}[data-model-type="p_barras_agrupadas"] button`);
    await firstCard.focus();
    await page.keyboard.press("End");
    await assertFocusedModelType(page, "p_dim_heatmap_criterios");
    await page.keyboard.press("Home");
    await assertFocusedModelType(page, "p_barras_agrupadas");
    await page.keyboard.press("ArrowRight");
    await assertFocusedModelType(page, "p_barras_categoricas");
    const selectedBySpace = root.locator(
      `${GRAF_FRAME}[data-model-type="p_pie"] button`,
    );
    await selectedBySpace.focus();
    await page.keyboard.press("Space");
    assert.equal(await selectedBySpace.getAttribute("aria-pressed"), "true");
    await search.focus();
    await assertFocusInside(page, root);
    await selectedBySpace.focus();
    await page.keyboard.press("Enter");
    await root.waitFor({ state: "detached" });
    const committedByEnter = page.locator('[data-graficador="p_pie"]');
    await committedByEnter.waitFor({ state: "visible" });
    assert.equal(await oldOccupant.count(), 0);
    assert.equal(await committedByEnter.count(), 1);
    const slotOccupants = page.locator('[data-graficador]:has([data-slot-name="grafico"])');
    assert.equal(await slotOccupants.count(), 1);
    assert.equal(await slotOccupants.getAttribute("data-graficador"), "p_pie");
    const afterReplacement = await storeSlotSnapshot(page, "slide-l6-ocupado", "grafico");
    assert.deepEqual(afterReplacement, {
      planSlideCount: 1,
      occupantCount: 1,
      slideId: "slide-l6-ocupado",
      slotName: "grafico",
      value: {
        graficador: "p_pie",
        args: {
          variable: "sexo",
          titulo: "Distribución inicial",
        },
      },
    });
    assert.notDeepEqual(afterReplacement, beforeReplacement);
    const afterEnterTrigger = committedByEnter.getByRole("button", { name: "Cambiar por otro tipo de gráfico" });
    await assertFocusReturned(page, afterEnterTrigger);

    await afterEnterTrigger.click();
    const reopened = page.locator(GRAF_ROOT);
    await reopened.waitFor({ state: "visible" });
    await reopened.locator(`${GRAF_FRAME}[data-model-type="p_donut"] button`).dblclick();
    await reopened.waitFor({ state: "detached" });
    const replaced = page.locator('[data-graficador="p_donut"]');
    await replaced.waitFor({ state: "visible" });
    const returnedTrigger = replaced.getByRole("button", { name: "Cambiar por otro tipo de gráfico" });
    await assertFocusReturned(page, returnedTrigger);

    await returnedTrigger.click();
    await page.locator(GRAF_ROOT).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator(GRAF_ROOT).waitFor({ state: "detached" });
    await assertFocusReturned(page, returnedTrigger);
  });
});

test("1024: ambos diálogos abren y guards separan futuro, dimensiones y disponibilidad", async () => {
  await runFixtureContext(VIEWPORT_COMPACT, { includeFutureSlide: true }, async (page) => {
    await openEditor(page);
    const { root, trigger } = await openSlidesFromTrigger(page);
    assert.deepEqual(await page.viewportSize(), VIEWPORT_COMPACT);
    assert.equal(await root.locator(SLIDE_FRAME).count(), 21);
    const future = root.locator(`${SLIDE_FRAME}[data-model-type="p_slide_realidad_aumentada"] button`);
    await future.click();
    assert.equal(await future.getAttribute("data-can-insert"), "false");
    assert.equal(await root.getByRole("button", { name: "Insertar modelo" }).isDisabled(), true);
    const before = await page.locator(".pulso-gv2-timeline-list > *").count();
    await future.dblclick();
    assert.equal(await page.locator(".pulso-gv2-timeline-list > *").count(), before);
    assert.match(await root.textContent(), /requiere una versión más reciente/i);
    await page.keyboard.press("Escape");
    await root.waitFor({ state: "detached" });
    await assertFocusReturned(page, trigger);
  });

  await runFixtureContext(VIEWPORT_COMPACT, {
    initialSid: fixture.session_ids.B,
    includeFutureGraficador: true,
  }, async (page) => {
    await openEditor(page);
    const { root } = await openGraphsFromPopulatedSlot(page);
    assert.deepEqual(await page.viewportSize(), VIEWPORT_COMPACT);
    assert.equal(await root.locator(GRAF_FRAME).count(), 20);

    const dimension = root.locator(`${GRAF_FRAME}[data-model-type="p_dim_radar"] button`);
    await dimension.click();
    assert.equal(await dimension.getAttribute("data-can-insert"), "false");
    assert.match(await root.textContent(), /Requiere dimensiones/);
    assert.equal(await root.getByRole("button", { name: "Insertar modelo" }).isDisabled(), true);

    const territorial = root.locator(`${GRAF_FRAME}[data-model-type="p_mapa_cobertura_territorial"] button`);
    await territorial.click();
    assert.equal(await territorial.getAttribute("data-can-insert"), "false");
    assert.match(await root.textContent(), /Modelo no disponible/);
    assert.match(await root.textContent(), /no tiene cobertura territorial preparada/);

    const future = root.locator(`${GRAF_FRAME}[data-model-type="p_holograma"] button`);
    await future.click();
    assert.equal(await future.getAttribute("data-can-insert"), "true");
    assert.equal(await root.getByRole("button", { name: "Insertar modelo" }).isEnabled(), true);
    await future.dblclick();
    await root.waitFor({ state: "detached" });
    const replaced = page.locator('[data-graficador="p_holograma"]');
    await replaced.waitFor({ state: "visible" });
    await assertFocusReturned(
      page,
      replaced.getByRole("button", { name: "Cambiar por otro tipo de gráfico" }),
    );
  });
});

test("loading/error/empty/no-results montan una sola live-region en ambas bibliotecas", async () => {
  const cases = [
    { library: "slides", viewport: VIEWPORT_LARGE, root: SLIDE_ROOT, frame: SLIDE_FRAME, search: "Buscar modelo de slide", panel: "biblioteca-slides", readyCount: 20 },
    { library: "graficadores", viewport: VIEWPORT_COMPACT, root: GRAF_ROOT, frame: GRAF_FRAME, search: "Buscar graficador", panel: "biblioteca-graficadores", readyCount: 19 },
  ];

  for (const item of cases) {
    for (const state of ["loading", "error", "empty", "no-results"]) {
      const registryGate = state === "loading" ? responseGate() : null;
      const options = {
        registryState: state === "error"
          ? "error"
          : state === "empty"
            ? `empty-${item.library}`
            : "ready",
        registryGates: registryGate
          ? new Map([[fixture.session_ids.A, registryGate]])
          : undefined,
      };
      await runFixtureContext(item.viewport, options, async (page) => {
        try {
          await openEditor(page, `?panel=${item.panel}&origen=l6-${state}`);
          const root = page.locator(item.root);
          await root.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
          if (state === "no-results") {
            await root.locator(item.frame).first().waitFor({ state: "visible" });
            await root.getByRole("searchbox", { name: item.search }).fill("zzzz_l6_sin_coincidencias");
          }
          await root.locator(`[data-state="${state}"]`).first().waitFor({ state: "visible" });
          await assertSingleLiveRegion(root, state);
          if (state === "error") {
            assert.equal(/fallo controlado/.test(await root.textContent()), false);
          }
          if (state === "loading") {
            registryGate.release();
            await root.locator(item.frame).first().waitFor({ state: "visible" });
            assert.equal(await root.locator(item.frame).count(), item.readyCount);
          }
        } finally {
          registryGate?.release();
        }
      });
    }
  }
});

async function runCrossSessionOrder(viewport, order) {
  const stateGateB = responseGate();
  const registryGateB = responseGate();
  await runFixtureContext(viewport, {
    markSessionA: true,
    stateGates: new Map([[fixture.session_ids.B, stateGateB]]),
    registryGates: new Map([[fixture.session_ids.B, registryGateB]]),
  }, async (page) => {
    try {
      await openEditor(page);
      const { root } = await openGraphsFromPopulatedSlot(page);
      const dimensionA = root.locator(`${GRAF_FRAME}[data-model-type="p_dim_radar"] button`);
      await dimensionA.click();
      assert.match(await root.textContent(), /sesión A QA/);
      assert.match(await root.textContent(), /Dimensiones listas/);

      await page.evaluate(({ oldSid, newSid }) => {
        localStorage.setItem("pulso.sessionId", newSid);
        window.dispatchEvent(new CustomEvent("pulso:session-changed", {
          detail: { old_sid: oldSid, new_sid: newSid },
        }));
      }, { oldSid: fixture.session_ids.A, newSid: fixture.session_ids.B });

      await withTimeout(
        Promise.all([stateGateB.seen, registryGateB.seen]),
        `requests B (${order})`,
      );
      await root.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
      await root.locator('[data-state="loading"]').first().waitFor({ state: "visible" });
      assert.equal(await root.locator(GRAF_FRAME).count(), 0);
      assert.equal((await root.textContent()).includes("sesión A QA"), false);
      assert.equal((await root.textContent()).includes("Dimensiones listas"), false);

      if (order === "state-before-registry") {
        stateGateB.release();
        await page.waitForTimeout(50);
        assert.equal(await root.locator(GRAF_FRAME).count(), 0);
        assert.equal((await root.textContent()).includes("sesión A QA"), false);
        registryGateB.release();
      } else {
        registryGateB.release();
        await root.locator(GRAF_FRAME).first().waitFor({ state: "visible" });
        const dimensionWhileStatePending = root.locator(`${GRAF_FRAME}[data-model-type="p_dim_radar"] button`);
        await dimensionWhileStatePending.click();
        assert.equal((await root.textContent()).includes("sesión A QA"), false);
        assert.match(await root.textContent(), /Requiere dimensiones/);
        stateGateB.release();
      }

      await root.locator(GRAF_FRAME).first().waitFor({ state: "visible" });
      assert.equal(await root.locator(GRAF_FRAME).count(), 19);
      const dimensionB = root.locator(`${GRAF_FRAME}[data-model-type="p_dim_radar"] button`);
      await dimensionB.click();
      assert.equal((await root.textContent()).includes("sesión A QA"), false);
      assert.equal((await root.textContent()).includes("Dimensiones listas"), false);
      assert.match(await root.textContent(), /Requiere dimensiones/);
      assert.equal(await dimensionB.getAttribute("data-can-insert"), "false");
    } finally {
      stateGateB.release();
      registryGateB.release();
    }
  });
}

async function runLateSessionAResponse() {
  const registryGateA = responseGate();
  const stateGateB = responseGate();
  const registryGateB = responseGate();
  await runFixtureContext(VIEWPORT_LARGE, {
    markSessionA: true,
    stateGates: new Map([[fixture.session_ids.B, stateGateB]]),
    registryGates: new Map([
      [fixture.session_ids.A, registryGateA],
      [fixture.session_ids.B, registryGateB],
    ]),
  }, async (page) => {
    try {
      await openEditor(page, "?panel=biblioteca-graficadores&origen=l6-stale-a");
      const root = page.locator(GRAF_ROOT);
      await root.waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
      await withTimeout(registryGateA.seen, "request registry A pendiente");
      await root.locator('[data-state="loading"]').first().waitFor({ state: "visible" });

      await page.evaluate(({ oldSid, newSid }) => {
        localStorage.setItem("pulso.sessionId", newSid);
        window.dispatchEvent(new CustomEvent("pulso:session-changed", {
          detail: { old_sid: oldSid, new_sid: newSid },
        }));
      }, { oldSid: fixture.session_ids.A, newSid: fixture.session_ids.B });

      await withTimeout(
        Promise.all([stateGateB.seen, registryGateB.seen]),
        "requests B antes de liberar A",
      );
      stateGateB.release();
      registryGateB.release();
      await root.locator(GRAF_FRAME).first().waitFor({ state: "visible" });
      const dimensionB = root.locator(`${GRAF_FRAME}[data-model-type="p_dim_radar"] button`);
      await dimensionB.click();
      assert.equal((await root.textContent()).includes("sesión A QA"), false);
      assert.match(await root.textContent(), /Requiere dimensiones/);

      const staleResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === "/api/graficos/registry"
          && response.request().headers()["x-pulso-session"] === fixture.session_ids.A;
      });
      registryGateA.release();
      await withTimeout(staleResponse, "respuesta registry A tardía");
      await page.waitForTimeout(100);

      assert.equal(await root.locator(GRAF_FRAME).count(), 19);
      assert.equal((await root.textContent()).includes("sesión A QA"), false);
      await dimensionB.click();
      assert.match(await root.textContent(), /Requiere dimensiones/);
      assert.equal(await dimensionB.getAttribute("data-can-insert"), "false");
    } finally {
      registryGateA.release();
      stateGateB.release();
      registryGateB.release();
    }
  });
}

test("A→B falla cerrado con órdenes diferidos y una respuesta A tardía", async () => {
  await runCrossSessionOrder(VIEWPORT_LARGE, "state-before-registry");
  await runCrossSessionOrder(VIEWPORT_COMPACT, "registry-before-state");
  await runLateSessionAResponse();
});
