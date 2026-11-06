import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../../api/graficos";
import { ajustesQueAplican, conDependientesJuntos, valorEfectivo } from "./ajustesRegistro";

const a = (name: string, extra: Partial<ArgMetadata> = {}): ArgMetadata => ({ name, label: name, tipo_input: "number", grupo: "textos", ...extra });
const resumen = [
  a("seleccion", { tipo_input: "choice", default: "manual" }),
  a("cruces", { tipo_input: "variables_list" }),
  a("max_filas", { default: 18, depende: { arg: "seleccion", valores: ["auto"] } }),
  a("max_por_capitulo", { default: 4, depende: { arg: "seleccion", valores: ["auto"] } }),
  a("capitulos", { tipo_input: "resumen_capitulos" }),
];

describe("ajustes del registro", () => {
  it("el valor efectivo cae al del registro si no hay nada escrito", () => {
    expect(valorEfectivo({}, resumen[0])).toBe("manual");
    expect(valorEfectivo({ seleccion: "" }, resumen[0])).toBe("manual");
    expect(valorEfectivo({ seleccion: "auto" }, resumen[0])).toBe("auto");
  });

  it("los topes aplican sólo en «auto», y van justo bajo la selección", () => {
    expect(ajustesQueAplican(resumen, {}).map((x) => x.name)).toEqual(["seleccion", "cruces", "capitulos"]);
    const auto = ajustesQueAplican(resumen, { seleccion: "auto" });
    expect(conDependientesJuntos(auto).map((x) => x.name)).toEqual(["seleccion", "max_filas", "max_por_capitulo", "cruces", "capitulos"]);
  });

  it("un dependiente de un ajuste ausente se queda en su lugar", () => {
    const sueltos = [a("x"), a("y", { depende: { arg: "modo", valores: ["r"] } }), a("z")];
    expect(conDependientesJuntos(sueltos).map((x) => x.name)).toEqual(["x", "y", "z"]);
  });
});
