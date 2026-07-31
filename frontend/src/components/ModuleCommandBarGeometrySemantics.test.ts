import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "ModuleCommandBar.tsx"), "utf8");

describe("semántica geométrica de ModuleCommandBar", () => {
  test("declara la banda interactiva como toolbar etiquetada de una fila", () => {
    const rootTag = source.match(/return \(\s*(<div[\s\S]*?>)/)?.[1];

    expect(rootTag).toBeDefined();
    expect(rootTag).toContain('role="toolbar"');
    expect(rootTag).toContain("aria-label={ariaLabel}");
    expect(rootTag).toContain('data-chrome-rows="1"');
  });

  test("no inventa un grupo C1 para las tres zonas de control", () => {
    expect(source).not.toContain("data-qa-geometry-group");
    expect(source).not.toContain("data-qa-geometry-contract");
  });
});
