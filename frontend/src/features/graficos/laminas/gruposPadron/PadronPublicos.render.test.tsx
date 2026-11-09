// Padrón por público pintado (ADR 0135 §6): propuesta con su «Usar» y «Usar todos», «En uso» cuando ya está escrita,
// «Sin propuesta» con su motivo en el «?», y en la cobertura los públicos que entran, la meta con su unidad y las filas
// extra.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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
const modos = vi.hoisted(() => ({ valor: null as null | { calc: { modo: string | null }; monitoreo: { modos: string[] } } }));
vi.mock("../../../estudio/usePlannerModos", () => ({ usePlannerModos: () => ({ modos: modos.valor, error: null, recargar: async () => undefined }) }));

import { PadronPublicos } from "./PadronPublicos";

const P = (base: string, extra: Partial<PadronPropuesto>): PadronPropuesto => ({
  base, padron: null, padron_origen: "", meta: null, meta_unidad: null, meta_origen: "", motivo: "", ...extra,
});

const pintar = (graficador: string, args: Record<string, unknown>) => renderToStaticMarkup(
  <MemoryRouter><PadronPublicos graficador={graficador} args={args} scope="consolidated" onCambio={() => undefined} /></MemoryRouter>,
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

  it("cobertura por categorías (ADR 0140): sólo las bases, sin padrón, meta ni filas extra", () => {
    estado.propuestas = [P("docentes", { padron: 123, meta: 60, meta_unidad: "porcentaje" })];
    const html = renderToStaticMarkup(
      <MemoryRouter><PadronPublicos graficador="p_cobertura" args={{ modo: "categorias" }} scope="active" onCambio={() => undefined} soloBases /></MemoryRouter>,
    );
    expect(html).toContain("Bases");
    expect(html).toContain('data-campo="bases"');
    expect(html).not.toContain("Padrón");
    expect(html).not.toContain("Meta de");
    expect(html).not.toContain("Filas extra");
    expect(html).not.toContain("Usar");
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

  it("X5: un público sin padrón dice dónde declararlo, por dirección canónica", () => {
    estado.propuestas = [P("docentes", { padron: 123 }), P("estudiantes", { motivo: "Sin padrón declarado." })];
    modos.valor = null;
    const args = { estilo: "resumen", cruce: null, vars: { t1: ["docentes$p1", "estudiantes$p1"] } };
    const html = pintar("p_dumbbell", args);
    expect(html).toContain("Declarar en Cálculo de muestra");
    expect(html).toContain('href="/calc-muestra"');
    expect(html).not.toContain("o en Monitoreo");
    // Con el estudio de acreditación, Monitoreo también aporta el padrón (el universo del reporte de avance).
    modos.valor = { calc: { modo: "acreditacion" }, monitoreo: { modos: ["acreditacion"] } };
    const conMonitoreo = pintar("p_dumbbell", args);
    expect(conMonitoreo).toContain('href="/calc-muestra?modo=acreditacion"');
    expect(conMonitoreo).toContain('href="/monitoreo?modo=acreditacion"');
    expect(conMonitoreo).toContain('aria-label="Declarar el padrón en Monitoreo de acreditación"');
    // Con el padrón ya escrito en la lámina, no hay nada que declarar.
    expect(pintar("p_dumbbell", { ...args, universos: "Estudiantes: 300" })).not.toContain("Declarar en");
    modos.valor = null;
  });

  it("sin públicos elegidos no hay padrón que listar; en el contraste se piden los públicos, no las preguntas", () => {
    estado.propuestas = [];
    expect(pintar("p_dumbbell", { estilo: "resumen", cruce: null, vars: {} })).toContain("Elige primero los públicos que se comparan.");
    expect(pintar("p_fortalezas", { vars: [] })).toContain("Elige primero las preguntas");
  });
  it("ronda 18: con tres públicos elegidos, una fila de padrón por cada uno", () => {
    estado.propuestas = [];
    const html = pintar("p_dumbbell", { estilo: "resumen", cruce: null, bases: ["docentes", "estudiantes", "administrativos"] });
    for (const n of ["Docentes", "Estudiantes", "Administrativos"]) expect(html).toContain(n);
  });
});
