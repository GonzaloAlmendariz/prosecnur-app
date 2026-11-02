// El estándar del cuestionario que muestra Impreso › Estilos es el mismo que lee el motor (L36 · D-L36-21).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESTANDAR_CUESTIONARIO } from "./estandarCuestionario.generated";

const RAIZ = path.resolve(__dirname, "../../../../..");

describe("estándar del cuestionario", () => {
  it("estandarCuestionario.generated.ts copia exactamente la clave `cuestionario` de estandar_pulso.json", () => {
    const json = JSON.parse(fs.readFileSync(path.join(RAIZ, "api/inst/estandar/estandar_pulso.json"), "utf8")) as {
      cuestionario: unknown;
    };
    expect(ESTANDAR_CUESTIONARIO).toEqual(json.cuestionario);
  });
});
