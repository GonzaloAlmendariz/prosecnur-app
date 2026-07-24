import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contextLensTabA11y } from "./ContextLens";

describe("ContextLens tab semantics", () => {
  it("derives stable, unique tab ids from the React instance id", () => {
    expect(contextLensTabA11y(":lens-a:", 0)).toEqual({
      tabId: ":lens-a:-tab-0",
      panelId: ":lens-a:-tabpanel",
    });
    expect(contextLensTabA11y(":lens-a:", 1).tabId).not.toBe(
      contextLensTabA11y(":lens-b:", 1).tabId,
    );
  });

  it("connects every rendered tab to the active panel with instance-safe ids", () => {
    const source = fs.readFileSync(path.join(__dirname, "ContextLens.tsx"), "utf8");

    expect(source).toContain("export function contextLensTabA11y(");
    expect(source).toContain("const contextLensId = useId();");
    expect(source).toMatch(
      /id=\{tabA11y\.tabId\}[\s\S]*?aria-controls=\{tabA11y\.panelId\}/,
    );
    expect(source).toMatch(
      /id=\{activeTabA11y\?\.panelId\}[\s\S]*?role=\{activeTabA11y \? "tabpanel" : undefined\}[\s\S]*?aria-labelledby=\{activeTabA11y\?\.tabId\}[\s\S]*?tabIndex=\{activeTabA11y \? 0 : undefined\}/,
    );
  });
});
