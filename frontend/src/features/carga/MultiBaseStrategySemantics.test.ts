import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Multibase strategy semantics", () => {
  it("presenta en Fuentes la estrategia de Plan como estado no interactivo", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "BasesPanel.tsx"),
      "utf8",
    );
    const anchor = source.indexOf('aria-label="Forma de trabajar varias bases"');
    const selector = source.slice(source.lastIndexOf("<div", anchor), source.indexOf("</div>", anchor));

    expect(anchor).toBeGreaterThan(-1);
    expect(selector).toContain('role="status"');
    expect(selector).toContain("Estrategia fijada en Plan");
    expect(selector).not.toContain("<button");
    expect(selector).not.toContain("requestStrategyChange(");
  });
});
