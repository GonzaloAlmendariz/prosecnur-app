import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Multibase strategy semantics", () => {
  it("exposes work modes as pressed buttons with non-activating roving focus", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "BasesPanel.tsx"),
      "utf8",
    );
    const anchor = source.indexOf('aria-label="Forma de trabajar varias bases"');
    const selector = source.slice(
      source.lastIndexOf("<GlidingTabList", anchor),
      source.indexOf("</GlidingTabList>", anchor),
    );

    expect(selector).toContain('role="group"');
    expect(selector).toContain('mode="tabs"');
    expect(selector).toContain("aria-pressed=");
    expect(selector).toContain("requestStrategyChange(");
    expect(selector).not.toContain('role="tablist"');
    expect(selector).not.toContain('role="tab"');
    expect(selector).not.toContain("aria-selected=");
    expect(selector).not.toContain("onKeyDown=");
  });
});
