import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoreoCuota, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { franjaDeCuota, idDeControl, variablesDeControl } from "./composicionModelo";
import { PorCuotaVista } from "./PorCuota";

const cuota = {
  id: "q1", actor: "Estudiantes de pregrado", variable: "Unidad académica", cobertura: 0.1, universo: 45000, meta: 4547, efectivas: 2658, avance: 0.58,
  categorias_cumplidas: 0, categorias_total: 2, sin_dato: 0,
  categorias: [
    { categoria: "Gastronomía", universo: 1000, meta: 100, efectivas: 41, falta: 59, avance: 0.41, tasa: 0.041, estado: "en_curso" },
    { categoria: "Derecho", universo: 2000, meta: 200, efectivas: 150, falta: 50, avance: 0.75, tasa: 0.075, estado: "en_curso" },
  ],
} as unknown as MonitoreoCuota;
const publicos = [{ actor: "Estudiantes de pregrado", universo: 45000, efectivas: 2658, meta: 295, variables: [] }] as unknown as MonitoreoCuotaPublico[];
const controles = [
  { Actor: "Egresados", Variable: "Ciclo de egreso", Valor: "2025-2", Universo: 300, Efectivas: 60, "% base": 0.3, "% efectivas": 0.324, "Diferencia pp": 2.4 },
  { Actor: "Egresados", Variable: "Ciclo de egreso", Valor: "2024-1", Universo: 700, Efectivas: 125, "% base": 0.7, "% efectivas": 0.676, "Diferencia pp": -2.4 },
  { Actor: "Estudiantes de pregrado", Variable: "Unidad académica", Valor: "Derecho", Universo: 2000, Efectivas: 150, "% base": 0.5, "% efectivas": 0.6, "Diferencia pp": 10 },
];

describe("Avance › Por cuota", () => {
  it("lee las variables de control sin repetir las que tienen cuota", () => {
    const variables = variablesDeControl(controles, [cuota]);
    expect(variables).toHaveLength(1);
    expect(variables[0].id).toBe(idDeControl("Egresados", "Ciclo de egreso"));
    expect(variables[0].filas[0].pctBase).toBeCloseTo(70);
    expect(Math.abs(variables[0].maxDelta ?? 0)).toBe(2.4);
  });

  it("arma la franja con la diferencia por redondeo y la categoría más atrasada", () => {
    const franja = franjaDeCuota(cuota, publicos);
    expect(franja.metaPorCategorias).toBe(300);
    expect(franja.diferencia).toBe(5);
    expect(franja.masAtrasada).toEqual({ categoria: "Gastronomía", avance: 0.41 });
  });

  it("dibuja la cuota elegida con su detalle y la lista de variables", () => {
    const html = renderToStaticMarkup(
      <PorCuotaVista publicos={publicos} cuotas={[cuota]} controles={variablesDeControl(controles, [cuota])} foco={null} onElegir={() => {}} onEditarEnModelo={() => {}} onDefinirEnModelo={() => {}} />,
    );
    expect(html).toContain("Con meta");
    expect(html).toContain("Variables de control, sin meta");
    expect(html).toContain("+5 por redondeo");
    expect(html).toContain("Editar en Modelo");
    expect(html).not.toMatch(/Diferencia pp|% base|>en_curso</);
  });

  it("una variable sin meta se lee como composición con escala y diferencia", () => {
    const variables = variablesDeControl(controles, [cuota]);
    const html = renderToStaticMarkup(
      <PorCuotaVista publicos={publicos} cuotas={[cuota]} controles={variables} foco={variables[0].id} onElegir={() => {}} onEditarEnModelo={() => {}} onDefinirEnModelo={() => {}} />,
    );
    expect(html).toContain("% del universo");
    expect(html).toContain("% del público");
    expect(html).toContain("+2.4 pp");
    expect(html).toContain("Definir cuota en Modelo");
  });
});
