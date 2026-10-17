import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SheetsView tab semantics", () => {
  it("associates every XLSForm sheet tab with the active table panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "SheetsView.tsx"), "utf8");
    // El id del panel vive en el modelo de hojas desde el corte del revamp (2026-10-16).
    const modelo = fs.readFileSync(path.join(__dirname, "hojasModel.ts"), "utf8");

    expect(modelo).toContain('export const SHEET_PANEL_ID = "xlsform-sheet-panel";');
    expect(source).toMatch(/import \{[^}]*SHEET_PANEL_ID[^}]*\} from "\.\/hojasModel";/);
    expect(source).toMatch(
      /id=\{`xlsform-sheet-tab-\$\{tab\}`\}[\s\S]*?aria-controls=\{SHEET_PANEL_ID\}/,
    );
    expect(source).toMatch(
      /<div\s+id=\{SHEET_PANEL_ID\}[\s\S]*?role="tabpanel"[\s\S]*?aria-labelledby=\{`xlsform-sheet-tab-\$\{activeTab\}`\}[\s\S]*?tabIndex=\{0\}[\s\S]*?className="pulso-xfs-table-wrap"/,
    );
  });
});
