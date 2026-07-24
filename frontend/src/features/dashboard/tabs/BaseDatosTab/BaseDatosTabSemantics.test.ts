import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("BaseDatosTab view semantics", () => {
  it("associates Códigos and Etiquetas with the active data panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");

    expect(source).toContain('tabId: "dashboard-base-data-tab-codigos"');
    expect(source).toContain('tabId: "dashboard-base-data-tab-etiquetas"');
    expect(source).toContain('panelId: "dashboard-base-data-panel"');
    expect(source).toMatch(
      /id=\{BASE_DATA_VIEW_A11Y\.codigos\.tabId\}[\s\S]*?aria-controls=\{BASE_DATA_VIEW_A11Y\.codigos\.panelId\}/,
    );
    expect(source).toMatch(
      /id=\{BASE_DATA_VIEW_A11Y\.etiquetas\.tabId\}[\s\S]*?aria-controls=\{BASE_DATA_VIEW_A11Y\.etiquetas\.panelId\}/,
    );
    expect(source).toMatch(
      /<main[\s\S]*?id=\{BASE_DATA_VIEW_A11Y\[baseDatos\.modo\]\.panelId\}[\s\S]*?role="tabpanel"[\s\S]*?aria-labelledby=\{BASE_DATA_VIEW_A11Y\[baseDatos\.modo\]\.tabId\}[\s\S]*?tabIndex=\{0\}/,
    );
  });
});
