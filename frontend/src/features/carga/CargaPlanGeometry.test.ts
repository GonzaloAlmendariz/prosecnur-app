import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CargaPlanOverview } from "./CargaPlanOverview";

const css = fs.readFileSync(path.join(__dirname, "carga-v2.css"), "utf8");

function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...source.matchAll(
    new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"),
  )];
  const match = matches.at(-1) ?? null;
  expect(match, `missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("Carga Plan geometry", () => {
  it("fills a large workspace while coverage receives the flexible row", () => {
    const largeViewport = css.slice(0, css.indexOf("@media (max-height: 700px)"));
    const overview = ruleBody(largeViewport, ".pulso-carga-plan-overview");
    const coverage = ruleBody(largeViewport, ".pulso-carga-plan-coverage");

    expect(overview).toMatch(/min-height:\s*100%/);
    expect(overview).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/);
    expect(coverage).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/);
  });

  it("returns Plan to intrinsic height in a short viewport", () => {
    const mediaStart = css.indexOf("@media (max-height: 700px)");
    const mediaEnd = css.indexOf("@media", mediaStart + 1);
    const shortViewport = css.slice(mediaStart, mediaEnd);
    const overview = ruleBody(shortViewport, ".pulso-carga-plan-overview");

    expect(overview).toMatch(/grid-template-rows:\s*auto\s+auto/);
    expect(overview).toMatch(/min-height:\s*auto/);
  });

  it("keeps empty capacity inside the coverage roster", () => {
    const html = renderToStaticMarkup(createElement(CargaPlanOverview, {
      topology: {
        mode: "multi",
        status: "planned",
        strategy: "separate",
        modeLocked: false,
        strategyLocked: false,
      },
      bases: [],
      hasInstrument: false,
      hasData: false,
      pendingChoiceMapping: false,
      allReady: false,
    }));

    expect(html).toMatch(/class="pulso-carga-plan-roster"[\s\S]*?<li class="is-empty">/);
    expect(html).toContain("Aún no hay bases creadas");
  });

  it("declares the paired source assets as an equal geometry group", () => {
    const source = fs.readFileSync(path.join(__dirname, "CargaPlanOverview.tsx"), "utf8");

    expect(source).toContain('data-qa-geometry-group="carga-base-assets"');
    expect(source).toContain('data-qa-geometry-contract="equal"');
    expect(source.match(/data-qa-geometry-member/g)).toHaveLength(2);
  });
});
