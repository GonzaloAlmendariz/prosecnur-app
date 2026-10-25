import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { CuotasVista, variablesSinCuota } from "./Cuotas";

const PUBLICOS: MonitoreoCuotaPublico[] = [
  { actor: "Docentes Campus", universo: 2599, efectivas: 481, meta: 811, variables: [{ variable: "Dedicación", categorias: 3 }, { variable: "Sexo", categorias: 2 }] },
  { actor: "Egresados", universo: 270, efectivas: 178, meta: 108, variables: [{ variable: "Ciclo de egreso", categorias: 10 }] },
];
const CUOTAS = [{
  id: "q1", actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, universo: 2599, meta: 812, efectivas: 481, avance: 0.59,
  categorias_cumplidas: 0, categorias_total: 3, sin_dato: 0,
  categorias: [
    { categoria: "TPA", universo: 1939, meta: 605, efectivas: 0, falta: 605, avance: 0, tasa: 0, estado: "sin_avance" },
    { categoria: "DTC", universo: 631, meta: 197, efectivas: 0, falta: 197, avance: 0, tasa: 0, estado: "sin_avance" },
    { categoria: "TPC20", universo: 29, meta: 10, efectivas: 0, falta: 10, avance: 0, tasa: 0, estado: "sin_avance" },
  ],
}] as unknown as MonitoreoCuota[];

describe("Modelo › Cuotas", () => {
  it("lista las variables elegibles que todavía no tienen cuota", () => {
    expect(variablesSinCuota(PUBLICOS, CUOTAS).map((item) => `${item.actor}/${item.variable}`)).toEqual(["Docentes Campus/Sexo", "Egresados/Ciclo de egreso"]);
  });

  it("avisa cuando las metas por categoría no suman la meta del público (812 frente a 811)", () => {
    const html = renderToStaticMarkup(
      <CuotasVista publicos={PUBLICOS} cuotas={CUOTAS} foco="q1" onElegir={() => undefined} onEditar={() => undefined} onNueva={() => undefined} />,
    );
    expect(html).toContain("Las metas por categoría suman 812 y la meta del público es 811: sobran 1.");
    expect(html).toContain("Cobertura de 31.2 %");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
