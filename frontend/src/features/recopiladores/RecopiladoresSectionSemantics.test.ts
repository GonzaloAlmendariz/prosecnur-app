import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Fichas QR section selector semantics", () => {
  it("announces stages as pressed buttons while preserving arrow-key roving", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresPage.tsx"), "utf8");
    const sectionSelector = source.slice(
      source.indexOf("<GlidingTabList", source.indexOf("Selector de etapas")),
      source.indexOf('<div className="rec-actions">'),
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
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresPage.tsx"), "utf8");

    expect(source).toContain('aria-controls={active ? "rec-tabpanel" : undefined}');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('aria-labelledby={`rec-tab-${activeTab}`}');
  });
});
