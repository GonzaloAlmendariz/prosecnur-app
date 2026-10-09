import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(territorialDir, "TerritorialMonitoreoPage.tsx"), "utf8");

describe("Territorial: readiness después de hidratar la pestaña activa", () => {
  test("no publica monitoreo mientras la vista sigue cargando, pero SÍ declara que existe", () => {
    // Este contrato fijaba la forma exacta —`activeLoading ? undefined : ...`—
    // en vez de su intención, y así acabó defendiendo el defecto que decía
    // vigilar: `undefined` BORRA el atributo, y una marca ausente le dice al
    // puente «esta vista no participa del contrato» (`sin-marca-de-readiness`),
    // no «espera, está cargando». Con eso el QA visual daba por no medible el
    // perfil entero. Medido: el motivo pasó de `sin-marca-de-readiness` a
    // `marca-en-false` al cambiar esta sola rama.
    expect(source).toMatch(/data-audit-ready=\{activeLoading\s*\?\s*"false"\s*:\s*"monitoreo"\}/);
    expect(source).not.toMatch(/data-audit-ready=\{[^}]*\bundefined\b/);
    expect(source).toMatch(/data-audit-loading=\{activeLoading\s*\?\s*"true"\s*:\s*"false"\}/);
    expect(source).not.toContain('data-audit-ready="monitoreo"');
  });
});
