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

  // El click de Playwright deja el cursor sobre el control, así que la burbuja del carril
  // icon-only (dec-sidebar-icon-tooltip) queda desplegada al inspeccionar el DOM y su ::before
  // absoluto infla scrollWidth. Sin la exención, cada corrida con --click-tab sobre un rail
  // reporta un overflow-x fantasma en el botón de 42px.
  test("no reportan como desborde la burbuja flotante del carril icon-only", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const runners = [
      path.join(repoRoot, "scripts", "ui-quick-check.mjs"),
      path.join(repoRoot, "scripts", "visual-qa.mjs"),
    ];

    for (const runner of runners) {
      const source = fs.readFileSync(runner, "utf8");
      const guard = source.slice(
        source.indexOf("const railTooltipEscape = ("),
        source.indexOf("\n    };", source.indexOf("const railTooltipEscape = (")),
      );

      expect(guard, runner).toMatch(/hasAttribute\("data-rail-tooltip"\)/);
      // Solo se exime la burbuja que efectivamente escapa: si el botón clippea o el ::before
      // deja de ser absoluto, el desborde vuelve a ser un hallazgo real.
      expect(guard, runner).toMatch(/style\.overflowX !== "visible"/);
      expect(guard, runner).toMatch(/bubble\.position !== "absolute"/);
      expect(source, runner).toMatch(/if \(railTooltipEscape\(el, style\)\) continue;/);
    }
  });
});
