import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { construirAvisos, destinoDeAviso } from "./avisosModel";

function reportes(alertas: Array<Record<string, unknown>>, telefonico: Record<string, Array<Record<string, unknown>>> = {}): MonitoreoAcreditacionReports {
  return {
    schema: "test",
    generated_at: "",
    reference_tabs: [],
    sheets: [
      { id: "alertas", title: "Alertas", blocks: [{ id: "alertas", title: "Alertas", columns: [], rows: alertas }] },
      { id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(telefonico).map(([id, rows]) => ({ id, title: id, columns: [], rows })) },
    ],
  } as unknown as MonitoreoAcreditacionReports;
}

const fila = (nivel: string, tipo: string, detalle: string, extra: Record<string, unknown> = {}) => ({
  Nivel: nivel, "Tipo alerta": tipo, "Detalle del tipo de alerta": detalle, Detalle: detalle, Responsable: "", CodPulso: "", ...extra,
});

describe("Control › Avisos del telefónico", () => {
  it("incluye los avisos fuertes del RMS cuando el bloque los trae, con su destino", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "cruce_llave_bajo", "Solo 2 de 430 respuestas cruzan con el barrido."),
      fila("Media", "status_desconocido", "Pendiente de llamar: 12."),
      fila("Media", "status_desconocido", "Volver a llamar: 3."),
    ]));
    const porCodigo = Object.fromEntries(avisos.map((aviso) => [aviso.codigo, aviso]));
    expect(porCodigo.cruce_llave_bajo.destino.direccion).toEqual({ seccion: "insumos", pestana: "llave" });
    expect(porCodigo.cruce_llave_bajo.nivel).toBe("alta");
    expect(porCodigo.status_desconocido.destino.direccion).toEqual({ seccion: "insumos", pestana: "estados" });
    expect(porCodigo.status_desconocido.casos).toBe(2);
  });

  it("sin los avisos fuertes en el bloque, no los dibuja", () => {
    const { avisos } = construirAvisos(reportes([]));
    expect(avisos.some((aviso) => aviso.codigo.includes("cruce_llave"))).toBe(false);
  });

  it("separa los casos sin asignar y no los cuenta como aviso", () => {
    const resultado = construirAvisos(reportes(
      [fila("Media", "Casos sin responsable", "1197 casos sin responsable", { Responsable: "Sin responsable" })],
      { no_barridos_responsable: [{ Responsable: "Sin responsable", "No barridos": 1197 }] },
    ));
    expect(resultado.sinAsignar?.casos).toBe(1197);
    expect(resultado.avisos.some((aviso) => /sin responsable/i.test(aviso.titulo))).toBe(false);
  });

  it("lo que se corrige en la hoja del equipo no lleva enlace", () => {
    expect(destinoDeAviso("fecha irregular", "other")).toEqual({ etiqueta: "Hoja del equipo", direccion: null });
    expect(destinoDeAviso("duracion_muy_larga", "short_duration").direccion).toEqual({ seccion: "control", pestana: "respuestas" });
  });

  it("da ids únicos aunque dos grupos compartan causa", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "cruce_llave_bajo", "a"),
    ]));
    expect(new Set(avisos.map((aviso) => aviso.id)).size).toBe(avisos.length);
  });

  it("lee de los bloques los avisos que el motor no emite como alerta", () => {
    const { avisos } = construirAvisos(reportes([], {
      control_tiempo_kobo: [
        { CodPulso: "PDM1371", "Duración segundos": 365_100 },
        { CodPulso: "PDM1429", "Duración segundos": 900 },
        { CodPulso: "PDM1429", "Duración segundos": 1000 },
      ],
      comparacion_codpulso: [{ CodPulso: "PDM1000", "Efectiva Kobo": "Sí", "Estado telefónico": "No barrido" }],
      estatus_dia: [{ Estado: "Efectivo", "1/07/2026": 10, "30/06/2020": 1, "Sin fecha": 2 }],
    }));
    const porCodigo = Object.fromEntries(avisos.map((aviso) => [aviso.codigo, aviso.casos]));
    expect(porCodigo).toMatchObject({ duracion_mayor_2h: 1, codpulso_repetido: 1, barrido_desfasado: 1, fecha_irregular: 3 });
  });
});
