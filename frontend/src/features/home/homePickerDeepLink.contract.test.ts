import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

// El selector de módulos es un overlay global (ModulePickerHost, montado en el
// Layout) disparado por `?agregar=1` sobre la ruta ACTUAL. No vive acoplado a
// la ruta `/`: abrirlo desde dentro de un módulo (ej. /monitoreo) y cerrarlo
// debe preservar el pathname, no devolver al home.
describe("Module picker deep-link (global overlay)", () => {
  it("materializes the picker from agregar=1 on any route", () => {
    const host = fs.readFileSync(path.join(featureDir, "ModulePickerHost.tsx"), "utf8");

    expect(host).toMatch(/get\("agregar"\)\s*===\s*"1"/);
    expect(host).toMatch(/createPortal\(/);
  });

  it("closes by deleting only agregar and preserving the current pathname", () => {
    const host = fs.readFileSync(path.join(featureDir, "ModulePickerHost.tsx"), "utf8");

    expect(host).toContain('params.delete("agregar")');
    expect(host).toMatch(/pathname: location\.pathname/);
    expect(host).not.toMatch(/pathname: "\/"/);
  });

  it("is decoupled from HomePage: HomePage no longer hosts the picker overlay", () => {
    const page = fs.readFileSync(path.join(featureDir, "HomePage.tsx"), "utf8");

    expect(page).not.toContain("ModulePickerDialog");
    expect(page).not.toMatch(/pickerOpen/);
  });
});
