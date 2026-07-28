import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const monitoreoDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(monitoreoDir, "MonitoreoShell.css"), "utf8");

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("selector de modos de Monitoreo: geometría del contenido", () => {
  test("mantiene el texto dentro del marco estable de cada opción", () => {
    const option = ruleBody(".mon-mode-choice__option");
    const copy = ruleBody(".mon-mode-choice__copy");
    const description = ruleBody(".mon-mode-choice__copy > span");

    expect(option).toMatch(/min-width:\s*0;/);
    expect(option).toMatch(/height:\s*96px;/);
    expect(option).toMatch(/grid-template-columns:\s*36px\s+minmax\(0,\s*1fr\)\s+auto;/);
    expect(copy).toMatch(/min-width:\s*0;/);
    expect(description).toMatch(/white-space:\s*normal;/);
    expect(description).toMatch(/overflow-wrap:\s*anywhere;/);
  });
});
