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
    // No por la sección visitada: entrar en Materiales no genera materiales.
    expect(fuente).toContain('"plan-recoleccion": Boolean(state?.plan?.units?.length)');
    expect(fuente).toContain("accesos: Boolean(state?.deployment?.bindings?.length)");
    expect(fuente).toContain("materiales: Boolean(state?.artifact_receipts?.length)");
  });

  it("el siguiente paso es el primero que falta", () => {
    expect(fuente).toContain("find((id) => !pasosHechos[id])");
  });

  it("con todos los pasos dados no se marca ninguno", () => {
    // `find` devuelve undefined y `siguientePaso` queda en null: el recorrido
    // terminó y señalar un paso inventaría trabajo.
    expect(fuente).toContain("?? null");
  });

  it("el punto no es sólo color: lleva texto para lector de pantalla", () => {
    expect(fuente).toContain("pulso-sr-only");
    expect(fuente).toContain("· hecho");
    expect(fuente).toContain("· es lo siguiente");
  });
});
