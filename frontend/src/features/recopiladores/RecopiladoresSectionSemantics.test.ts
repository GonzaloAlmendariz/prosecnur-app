import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Fichas QR section selector semantics", () => {
  it("announces stages as pressed buttons while preserving arrow-key roving", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresShell.tsx"), "utf8");
    const inicio = source.indexOf("<GlidingTabList");
    const sectionSelector = source.slice(
      inicio,
      source.indexOf("</GlidingTabList>", inicio) + "</GlidingTabList>".length,
    );

    expect(sectionSelector).toContain('role="group"');
    expect(sectionSelector).toContain('mode="tabs"');
    expect(sectionSelector).toContain("aria-pressed={active}");
    expect(sectionSelector).not.toContain('as="nav"');
    expect(sectionSelector).not.toContain('role="tablist"');
    expect(sectionSelector).not.toContain('role="tab"');
    expect(sectionSelector).not.toContain("aria-selected");
    expect(sectionSelector).not.toContain("aria-current");
  });

  it("keeps the nested local tabs associated with their real panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresShell.tsx"), "utf8");

    expect(source).toContain('aria-controls={`rec-tab-panel-${tab.id}`}');
    expect(source).toContain('id={tabs.length > 1 ? `rec-tab-panel-${direction.pestana}` : undefined}');
    expect(source).toContain('role={tabs.length > 1 ? "tabpanel" : undefined}');
    expect(source).toContain('aria-labelledby={tabs.length > 1 ? `rec-tab-${direction.pestana}` : undefined}');
  });
});
