import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const componentsDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(componentsDir, "MonitoreoWorkbenchChrome.tsx"), "utf8");

describe("MonitoreoWorkbenchChrome: contrato geométrico auditable", () => {
  test("expone filas intrínsecas y reserva el contenido como capacidad propia", () => {
    expect(source).toContain('data-qa-geometry-group="monitoring-workbench-rows"');
    expect(source).toContain('data-qa-geometry-contract="intrinsic"');
    expect(source).toContain('data-qa-geometry-capacity="owned"');
  });
});
