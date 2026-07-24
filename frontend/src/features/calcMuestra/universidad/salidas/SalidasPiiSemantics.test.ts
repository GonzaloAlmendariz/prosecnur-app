import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Salidas privacy policy semantics", () => {
  it("exposes the mutually exclusive policies as a keyboard-operable radio group", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "SalidasEntregablesTab.tsx"),
      "utf8",
    );
    const selector = source.slice(
      source.indexOf("<GlidingTabList", source.indexOf("Política de privacidad de los entregables")),
      source.indexOf('<p className="cmv2-sal-nota cmv2-uni-swap"'),
    );

    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={pii === option.id}");
    expect(selector).toContain("onKeyDown={(event) =>");
    expect(selector).not.toContain('role="tablist"');
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected");
  });
});
