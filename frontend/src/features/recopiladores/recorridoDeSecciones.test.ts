// Las cuatro secciones de Recopiladores SON una secuencia —el plan entra, se
// preparan los accesos, se generan los materiales y se entrega— y el selector
// las pintaba como cuatro botones intercambiables. Quien abre el módulo a mitad
// de trabajo no sabía qué falta para poder salir a campo.
//
// La regla vive en el shell y se lee del fuente, como el resto de reglas de
// render del módulo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fuente = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "RecopiladoresShell.tsx"),
  "utf8",
);

describe("el selector de secciones dice qué falta", () => {
  it("cada paso se declara hecho por su propia evidencia", () => {
    // No por la sección visitada: entrar en Paquetes no genera materiales.
    expect(fuente).toContain("unidades: Boolean(state?.plan?.units?.length)");
    expect(fuente).toContain("accesos: Boolean(state?.deployment?.bindings?.length)");
    expect(fuente).toContain("catalogo: Boolean(state?.artifact_receipts?.length)");
    expect(fuente).toContain("paquetes: Boolean(state?.artifact_receipts?.length)");
    expect(fuente).toContain("entrega: Boolean(payload?.handoff ?? state?.deployment?.handoff)");
  });

  it("el avance va como marca no numérica del rail compartido", () => {
    // Desde 2026-10-16 ningún módulo numera sus secciones. Lo hecho viaja en
    // `done` de `SectionPillbar`; el numeral y «es lo siguiente» se retiraron.
    expect(fuente).toContain("done: pasosHechos[id]");
    expect(fuente).toContain("<SectionPillbar");
    expect(fuente).not.toContain("pulso-phase-pill-number");
    expect(fuente).not.toContain("is-next");
    expect(fuente).not.toContain("index + 1");
  });
});
