import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const styleSources = [
  fs.readFileSync(path.join(territorialDir, "..", "..", "monitoreo.css"), "utf8"),
  fs.readFileSync(path.join(territorialDir, "territorialProfile.css"), "utf8"),
];
const source = fs.readFileSync(
  path.join(territorialDir, "TerritorialSourceConsole.tsx"),
  "utf8",
);

function ruleBodies(selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g");

  return styleSources.flatMap((source) =>
    Array.from(source.matchAll(rule), (match) => match[1] ?? ""),
  );
}

describe("Reconciliación territorial: capacidad equivalente de paneles", () => {
  test("conserva cinco zonas y alinea los marcos Código/UMP en escritorio", () => {
    const umpBodies = ruleBodies(".mon-territorial-reconciliation-panel.is-ump");
    const umpPanelStart = source.indexOf(
      '<section className="mon-territorial-reconciliation-panel is-ump"',
    );
    const umpPanel = source.slice(umpPanelStart, source.indexOf("</section>", umpPanelStart));
    const zoneMarkers = [
      "<header>",
      '<div className="mon-territorial-reconciliation-metrics">',
      '<div className="mon-territorial-reconciliation-review-lens">',
      '<div className="mon-territorial-reconciliation-list">',
      '<aside className="mon-territorial-reconciliation-queue"',
    ];
    const zoneOffsets = zoneMarkers.map((marker) => umpPanel.indexOf(marker));

    const umpUsesSharedFrame = umpBodies.some((body) =>
      /align-self:\s*stretch\s*;/.test(body),
    );
    const preservesFiveOrderedZones = zoneOffsets.every(
      (offset, index) =>
        offset >= 0 && (index === 0 || offset > (zoneOffsets[index - 1] ?? -1)),
    );

    expect({
      sharesComparableFrame: umpUsesSharedFrame,
      preservesFiveOrderedZones,
    }).toEqual({
      sharesComparableFrame: true,
      preservesFiveOrderedZones: true,
    });
  });
});
