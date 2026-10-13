import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import { camposDeDatos } from "../laminas/argsDatosGrafico";
import { validateArgs } from "../MultiApiladasBuilder";

// G12 (Gonzalo, 2026-10-13): «Bloques del gráfico» de multiapiladas traía un «Dividir por» además de sus modos, y un
// bloque podía partirse por grupos dentro de «Combinar bloques»: demasiado desagregado.
const arg = (name: string): ArgMetadata => ({ name, label: name, tipo_input: "variable", grupo: "datos" } as ArgMetadata);

describe("multiapiladas sin un «Dividir por» aparte", () => {
  test("la tarjeta no ofrece «Dividir por» en multiapiladas; en barras apiladas sí", () => {
    const args = [arg("var"), arg("cruces")];
    const multi = camposDeDatos(args, { var: "p1" }, "p_barras_multiapiladas").map((c) => c.rotulo);
    const apiladas = camposDeDatos(args, { var: "p1" }, "p_barras_apiladas").map((c) => c.rotulo);
    expect(multi).not.toContain("Dividir por");
    expect(apiladas).toContain("Dividir por");
  });

  test("un bloque que se divide por grupos dentro de «Combinar bloques» avisa", () => {
    const args = { modo: "multilista", bloques: [{ modo: "var", vars: ["p1", "p2"] }, { modo: "cruce", var: "p3", cruces: "sexo" }] };
    const avisos = validateArgs(args, [], false).filter((i) => i.kind === "warning").map((i) => i.message);
    expect(avisos.some((m) => m.startsWith("El bloque 2 se divide por grupos"))).toBe(true);
    expect(avisos.some((m) => m.startsWith("El bloque 1"))).toBe(false);
  });
});
