import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("semántica del selector de vista del calendario", () => {
  test("Mes y Semana controlan un tabpanel etiquetado", () => {
    const source = fs.readFileSync(path.join(__dirname, "Calendar.tsx"), "utf8");
    const toolbar = source.slice(
      source.indexOf("function CalendarToolbar("),
      source.indexOf("// --- Vista Mes"),
    );

    expect(toolbar).toMatch(
      /id=\{CALENDAR_VIEW_A11Y\.month\.tabId\}[\s\S]*?aria-controls=\{CALENDAR_VIEW_A11Y\.month\.panelId\}/,
    );
    expect(toolbar).toMatch(
      /id=\{CALENDAR_VIEW_A11Y\.week\.tabId\}[\s\S]*?aria-controls=\{CALENDAR_VIEW_A11Y\.week\.panelId\}/,
    );
    const panels = source.match(/<section\s+[\s\S]*?role="tabpanel"[\s\S]*?>/g) ?? [];
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel).toMatch(
        /id=\{CALENDAR_VIEW_A11Y\[view\]\.panelId\}/,
      );
      expect(panel).toMatch(
        /aria-labelledby=\{CALENDAR_VIEW_A11Y\[view\]\.tabId\}/,
      );
    }
  });
});
