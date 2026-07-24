import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("runners de QA visual", () => {
  test("pueden activar navegación semántica por nombre", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const runners = [
      path.join(repoRoot, "scripts", "ui-quick-check.mjs"),
      path.join(repoRoot, "scripts", "visual-qa.mjs"),
    ];

    for (const runner of runners) {
      const source = fs.readFileSync(runner, "utf8");
      const clickHelper = source.slice(
        source.indexOf("async function clickNamedControl("),
        source.indexOf("\n}", source.indexOf("async function clickNamedControl(")) + 2,
      );

      expect(clickHelper, runner).toMatch(
        /getByRole\("link",\s*\{\s*name:\s*startsWithPattern\s*\}\)/,
      );
      expect(clickHelper.indexOf('getByRole("link"')).toBeLessThan(
        clickHelper.indexOf("getByText("),
      );
    }
  });
});
