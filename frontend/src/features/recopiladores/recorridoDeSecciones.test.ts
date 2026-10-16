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

  it("el siguiente paso es el primero que falta", () => {
    expect(fuente).toContain("find((id) => !pasosHechos[id])");
  });

  it("con todos los pasos dados no se marca ninguno", () => {
    // `find` devuelve undefined y `siguientePaso` queda en null: el recorrido
    // terminó y señalar un paso inventaría trabajo.
    expect(fuente).toContain("?? null");
  });

  it("el estado no es sólo color: va en texto y en el título", () => {
    // Desde el 2026-08-28 el avance lo dibujan `is-done` e `is-next` de
    // `pulso-phase-pillbar`, el mismo sistema que Cálculo de muestra, Hojas de
    // ruta y Monitoreo. Un tinte en el círculo NO es una señal accesible, así
    // que la palabra sigue viajando en el nombre accesible y en el tooltip.
    expect(fuente).toContain("pulso-sr-only");
    expect(fuente).toContain('"hecho"');
    expect(fuente).toContain('"es lo siguiente"');
    expect(fuente).toMatch(/title=\{estado/);
  });

  it("usa las píldoras de fase compartidas y no un selector propio", () => {
    // Tres módulos con un lenguaje visual y éste con otro es lo que hacía que
    // Recopiladores desentonara. El sistema vive en `app/theme.css`.
    expect(fuente).toContain("pulso-phase-pillbar");
    expect(fuente).toContain("pulso-phase-pill-list");
    expect(fuente).toContain("pulso-phase-pill-number");
    expect(fuente).toContain("is-done");
    expect(fuente).toContain("is-next");
  });
});
