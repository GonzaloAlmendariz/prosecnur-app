import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("navegación primaria de Bitácora", () => {
  test("deriva secciones del manifiesto y usa enlaces con aria-current", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "BitacoraPage.tsx"),
      "utf8",
    );
    const rail = source.slice(
      source.indexOf("<GlidingTabList"),
      source.indexOf("</GlidingTabList>"),
    );

    expect(source).toMatch(
      /BITACORA_SECTIONS\s*=\s*BITACORA_MODULE\.sections\.filter/,
    );
    expect(rail).toMatch(/<GlidingTabList[\s\S]*?mode="nav"/);
    expect(rail).toMatch(/<Link[\s\S]*?to=\{item\.to\}/);
    expect(rail).toMatch(
      /aria-current=\{active\s*\?\s*"page"\s*:\s*undefined\}/,
    );
    expect(rail).not.toMatch(/role="tablist"/);
    expect(rail).not.toMatch(/role="tab"/);
    expect(rail).not.toMatch(/aria-selected=/);
  });
});
