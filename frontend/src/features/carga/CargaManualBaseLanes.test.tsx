import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentPath = fileURLToPath(new URL("./CargaManualBaseLanes.tsx", import.meta.url));
const source = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, "utf8") : "";

describe("carriles manuales por entrada planificada", () => {
  it("renderiza un carril estable por plannedInputCount", () => {
    expect(source).toContain("plannedInputCount");
    expect(source).toMatch(/Array\.from\([\s\S]*plannedInputCount/iu);
    expect(source).toMatch(/carril|entrada|base/iu);
  });

  it("no reintroduce plannedBaseCount como estado paralelo", () => {
    expect(source).not.toContain("plannedBaseCount");
  });
});
