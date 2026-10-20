import { describe, expect, test } from "vitest";
import type { Pieza } from "../reglas/piezas";
import { etiquetaPlana, textoLegible } from "./variablesLegibles";

const etq = (n: string) => ({ HH01: "Nombre del jefe", countryname: "" })[n] ?? "";

describe("variables en un solo formato", () => {
  test("`${x}` dentro de una etiqueta pasa a la etiqueta de x o a su código, sin comillas", () => {
    expect(etiquetaPlana("3. ¿Cuál es el sexo de ${HH01}?", etq)).toBe("3. ¿Cuál es el sexo de Nombre del jefe?");
    expect(etiquetaPlana("**Vino a ${countryname}**", etq)).toBe("Vino a countryname");
  });

  test("las piezas se unen sin espacio antes de coma, punto ni paréntesis de cierre", () => {
    const piezas: Pieza[] = [
      { tipo: "texto", texto: "Si" },
      { tipo: "pregunta", name: "p1", etiqueta: "" },
      { tipo: "texto", texto: "es" },
      { tipo: "valor", texto: "1" },
      { tipo: "texto", texto: ", vale" },
      { tipo: "valor", texto: "«uno y dos»" },
      { tipo: "texto", texto: "." },
    ];
    expect(textoLegible(piezas, etq)).toBe("Si p1 es 1, vale «uno y dos».");
  });
});
