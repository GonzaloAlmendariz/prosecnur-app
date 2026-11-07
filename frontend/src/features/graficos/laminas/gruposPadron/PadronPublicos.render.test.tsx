// Padrón por público pintado (ADR 0135 §6): propuesta con su «Usar» y «Usar todos», «En uso» cuando ya está escrita,
// «Sin propuesta» con su motivo en el «?», y en la cobertura los públicos que entran, la meta con su unidad y las filas
// extra.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PadronPropuesto } from "../../../../api/graficosPadron";

const estado = vi.hoisted(() => ({ propuestas: [] as PadronPropuesto[] }));
vi.mock("../../useVariables", () => ({
  useVariables: () => ({ sources: [{ name: "docentes", variables: [] }, { name: "estudiantes", variables: [] }] }),
}));
vi.mock("./usePadronPropuesto", () => ({
  usePadronPropuesto: () => ({ fase: "lista", propuestas: estado.propuestas, reintentar: () => undefined }),
  propuestasDe: (e: { propuestas: PadronPropuesto[] }) => e.propuestas,
}));
vi.mock("./useGuardaNoConfiables", () => ({ useGuardaNoConfiables: () => true }));

import { PadronPublicos } from "./PadronPublicos";

const P = (base: string, extra: Partial<PadronPropuesto>): PadronPropuesto => ({
  base, padron: null, padron_origen: "", meta: null, meta_unidad: null, meta_origen: "", motivo: "", ...extra,
});

const pintar = (graficador: string, args: Record<string, unknown>) => renderToStaticMarkup(
  <PadronPublicos graficador={graficador} args={args} scope="consolidated" onCambio={() => undefined} />,
);

describe("PadronPublicos", () => {
  it("cobertura: públicos con interruptor, padrón, meta con unidad, propuesta y filas extra", () => {
    estado.propuestas = [
      P("docentes", { padron: 123, padron_origen: "Cálculo de muestra: marco validado (Docentes)", meta: 60, meta_unidad: "porcentaje" }),
      P("estudiantes", { padron: 327, padron_origen: "Monitoreo: universo (Estudiantes)" }),
    ];
    const html = pintar("p_cobertura", {});
    expect(html).toContain('data-qa-geometry-group="graficos/f6-padron-publicos"');
    expect(html).toContain("Usar todos");
    expect(html).toContain("Propuesta: padrón 123, meta 60%");
    expect(html).toContain('aria-label="Meta de Docentes"');
    expect(html).toContain("% del padrón");
    expect(html).toContain("Filas extra");
    expect(html).toContain("Agregar fila");
    expect(html).not.toContain('type="checkbox"');
  });

  it("propuesta ya escrita: «En uso»; sin dato: «Sin propuesta» con el motivo", () => {
    estado.propuestas = [P("docentes", { padron: 123 }), P("estudiantes", { motivo: "Sin padrón declarado." })];
    const html = pintar("p_dumbbell", { estilo: "resumen", cruce: null, universos: "Docentes: 123",
      vars: { t1: ["docentes$p1", "estudiantes$p1"] } });
    expect(html).toContain("En uso");
    expect(html).not.toContain("Usar todos");
    expect(html).toContain("Sin propuesta");
    expect(html).toContain("Sin padrón declarado.");
    expect(html).not.toContain("Meta de");
  });

  it("sin preguntas no hay públicos que listar", () => {
    estado.propuestas = [];
    expect(pintar("p_dumbbell", { estilo: "resumen", cruce: null, vars: {} })).toContain("Elige primero las preguntas");
  });
});
