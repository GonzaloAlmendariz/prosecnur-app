import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../../api/client";
import { construirEquipo, umbralesDelPerfil } from "./equipoModelo";
import { EquipoVista } from "./Equipo";

// Operación por responsable del barrido de Egresados de Contabilidad (lienzo
// Ctl4), con los responsables anonimizados.
const OPERACION = [
  ["Responsable 1", 113, 110, 3, 27, 27], ["Responsable 2", 56, 54, 2, 28, 27], ["Responsable 3", 33, 32, 1, 31, 31],
  ["Responsable 4", 24, 24, 0, 23, 23], ["Responsable 5", 21, 19, 2, 18, 18], ["Responsable 6", 20, 15, 5, 14, 14],
  ["Sin responsable", 3, 0, 3, 0, 0],
].map(([Responsable, asignados, barridos, noBarridos, efectivas, conciliadas]) => ({
  Actor: "Egresados", Responsable, "Casos asignados": asignados, Barridos: barridos, "No barridos": noBarridos,
  "Efectivas telefónicas": efectivas, Conciliadas: conciliadas,
}));

const REPORTS = {
  schema: "test", generated_at: "", reference_tabs: [],
  sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: [
    { id: "operacion_responsable", title: "", columns: [], rows: OPERACION },
    { id: "estatus_responsable", title: "", columns: [], rows: [
      { Responsable: "Responsable 1", Estado: "Efectivo", Casos: 27 },
      { Responsable: "Responsable 1", Estado: "No contesta", Casos: 54 },
      { Responsable: "Sin responsable", Estado: "No barrido", Casos: 3 },
    ] },
    { id: "insistencia_no_contesta", title: "", columns: [], rows: [
      { Actor: "Egresados", Responsable: "Responsable 1", "Casos No contesta": 54, "Promedio intentos": 7.22 },
      { Actor: "Egresados", Responsable: "Responsable 2", "Casos No contesta": 7, "Promedio intentos": 3.1 },
    ] },
  ] }],
} as unknown as MonitoreoAcreditacionReports;

describe("Control › Equipo de acreditación", () => {
  const modelo = construirEquipo(REPORTS, [], umbralesDelPerfil({ no_sweep_min_cases: 20, no_sweep_pct: 0.2, no_answer_min_attempts: 4 }));

  it("suma la carga por responsable y deja «Sin asignar» al final", () => {
    expect(modelo.responsables.map((item) => item.nombre)).toEqual([
      "Responsable 1", "Responsable 2", "Responsable 3", "Responsable 4", "Responsable 5", "Responsable 6", "Sin asignar",
    ]);
    expect(modelo.total).toEqual({ asignados: 270, barridos: 254, efectivas: 141, sinAsignar: 3 });
    const r1 = modelo.responsables[0];
    expect(Math.round((r1.pctIncidencias ?? 0) * 100)).toBe(75);
    expect(Math.round((r1.efectividad ?? 0) * 100)).toBe(24);
    expect(r1.familias).toEqual({ efectiva: 27, reintentable: 54 });
  });

  it("las alertas siguen los umbrales del perfil y «Sin asignar» informa, no alerta", () => {
    expect(modelo.alertas.map((alerta) => [alerta.texto, alerta.casos, alerta.tono])).toEqual([
      ["Responsable 1 tiene 54 casos sin contestar, con 7.2 intentos en promedio", 54, "atencion"],
      ["Responsable 6 tiene el 25 % de sus casos sin barrer", 5, "atencion"],
      ["Casos sin asignar todavía", 3, "informa"],
    ]);
    // Con los umbrales por defecto del motor (20 casos o la mitad), Responsable 6 no alerta.
    const motor = construirEquipo(REPORTS, [], umbralesDelPerfil(null));
    expect(motor.alertas.some((alerta) => alerta.texto.startsWith("Responsable 6"))).toBe(false);
  });

  it("la vista no muestra claves crudas", () => {
    const html = renderToStaticMarkup(<EquipoVista modelo={modelo} />);
    expect(html).toContain("Carga frente a efectividad");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
