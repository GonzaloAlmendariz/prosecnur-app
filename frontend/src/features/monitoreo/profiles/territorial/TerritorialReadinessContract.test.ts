import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(territorialDir, "TerritorialMonitoreoPage.tsx"), "utf8");

describe("Territorial: readiness después de hidratar la pestaña activa", () => {
  test("no publica monitoreo mientras la vista sigue cargando", () => {
    expect(source).toMatch(/data-audit-ready=\{activeLoading\s*\?\s*undefined\s*:\s*"monitoreo"\}/);
    expect(source).toMatch(/data-audit-loading=\{activeLoading\s*\?\s*"true"\s*:\s*"false"\}/);
    expect(source).not.toContain('data-audit-ready="monitoreo"');
  });
});
