import { describe, expect, it } from "vitest";
import { muestraV1, resumenV1 } from "./sorteoV1";

const aviso = (d: string, pct: string) => ({ level: "warn" as const, code: "W_SAMPLE_DRAWN_WITH_V1", message: `${d}: esta muestra se sorteó con un reparto por zonas que dejó sin probabilidad de salir al ${pct} % de las viviendas del marco elegible del distrito; vuelve a sortear antes de salir a campo.` });

describe("muestra sorteada con el reparto v1", () => {
  it("sin el aviso, no es v1", () => {
    expect(muestraV1([{ level: "warn", code: "W_OTRO", message: "x" }])).toBeNull();
    expect(muestraV1(undefined)).toBeNull();
  });
  it("lee distrito y porcentaje de cada aviso y ordena del peor al menos malo", () => {
    const v1 = muestraV1([aviso("CHORRILLOS", "12.4"), aviso("ATE", "50.2")]);
    expect(v1?.distritos.map((d) => d.distrito)).toEqual(["Ate", "Chorrillos"]);
    expect(v1?.peor).toEqual({ distrito: "Ate", pct: 50.2 });
  });
  it("el resumen dice cuántos distritos y el peor caso", () => {
    const v1 = muestraV1([aviso("SAN JUAN DE LURIGANCHO", "33")]);
    expect(resumenV1(v1!)).toContain("en 1 distrito.");
    expect(resumenV1(v1!)).toContain("San Juan de Lurigancho, el 33 %");
  });
});
