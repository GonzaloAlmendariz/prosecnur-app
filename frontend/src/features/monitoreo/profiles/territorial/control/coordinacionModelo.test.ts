import { describe, expect, it } from "vitest";

import { normalizeAsignacionPlanificada } from "../../../../../api/monitoreoAsignacionPlanificada";
import { controlDeCoordinacion, reportePorRegion } from "./coordinacionModelo";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ReportePorRegion } from "./ReportePorRegion";
import { columnaPlanificada } from "../avance/asignacionPlanificadaModelo";

// 2h: lo declarado por coordinación al lado de Kobo validado, con su
// diferencia y su alerta; nunca se suma.

const crudo = {
  estado: "comparable",
  por_ump: [
    { id_manzana: "M1", codigo_planificado: "P844", lectura: "coincide", respuestas: 2, efectivas_kobo: 2,
      efectivas_coordinacion: 2, diferencia_coordinacion: 0 },
    { id_manzana: "M2", codigo_planificado: "P844", lectura: "coincide", respuestas: 1, efectivas_kobo: 1,
      efectivas_coordinacion: 3, diferencia_coordinacion: 2 },
  ],
  por_encuestador: [
    { codigo: "P844", nombre: "Ana Ruiz", ump: 2, efectivas_kobo: 3, efectivas_coordinacion: 5, ump_que_no_cuadran: 1,
      intentos_declarados: 12, rendimiento: 0.25, supervision_aprobadas: 3, supervision_no_aprobadas: 1 },
    { codigo: "P101", nombre: "Luis Paz", ump: 2, efectivas_kobo: 0 },
  ],
  resumen: { con_registro_coordinacion: 2, coordinacion_distinta: 1, supervision_aprobadas: 3, supervision_no_aprobadas: 1 },
};

describe("controlDeCoordinacion", () => {
  it("por código: declaradas, UMP que no cuadran, rendimiento sobre intentos y supervisión", () => {
    const c = controlDeCoordinacion(normalizeAsignacionPlanificada(crudo))!;
    expect(c.porCodigo.get("P844")).toMatchObject({ declaradas: "5", noCuadran: 1, rendimiento: "25 %", supervision: "3 / 1" });
    // Sin registro: rayas, no ceros.
    expect(c.porCodigo.get("P101")).toMatchObject({ declaradas: "—", rendimiento: "—", supervision: "—" });
    expect(c.hayAlerta).toBe(true);
    expect(c.resumen).toContain("1 no cuadran con Kobo");
    expect(c.resumen).toContain("lo declarado no se suma");
  });

  it("sin registro del coordinador no hay control que pintar", () => {
    expect(controlDeCoordinacion(normalizeAsignacionPlanificada({ ...crudo, resumen: {} }))).toBeNull();
    expect(controlDeCoordinacion(null)).toBeNull();
  });

  it("en UMP la diferencia por manzana se marca cuando no cuadra", () => {
    const col = columnaPlanificada(normalizeAsignacionPlanificada(crudo));
    if (col.tipo !== "columna") throw new Error("esperaba columna");
    expect(col.porManzana.get("M2")?.declarado?.coordinacion).toEqual({ texto: "Coordinación 3 · Kobo 1", distinto: true });
    expect(col.porManzana.get("M1")?.declarado?.coordinacion?.distinto).toBe(false);
    expect(col.resumen).toContain("Coordinación declara 2 UMP; 1 no cuadra con Kobo.");
  });
});

describe("reportePorRegion", () => {
  const conRegiones = {
    ...crudo,
    por_region: [
      { region: "Lima", ump: 3, efectivas_kobo: 10, efectivas_coordinacion: 12, ump_que_no_cuadran: 1, intentos_declarados: 20 },
      { region: "Tumbes", ump: 1, efectivas_kobo: 4 },
    ],
  };

  it("una fila por región con las cifras del control; sin registro, rayas", () => {
    const filas = reportePorRegion(normalizeAsignacionPlanificada(conRegiones));
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ region: "Lima", kobo: "10", declaradas: "12", noCuadran: 1, rendimiento: "50 %" });
    expect(filas[1]).toMatchObject({ region: "Tumbes", declaradas: "—", rendimiento: "—", supervision: "—" });
    const html = renderToStaticMarkup(createElement(ReportePorRegion, { filas }));
    expect(html).toContain("2 regiones, 1 con UMP que no cuadran");
  });

  it("con una sola región no se pinta: repetiría el resumen", () => {
    expect(reportePorRegion(normalizeAsignacionPlanificada({ ...crudo, por_region: [{ region: "Sin región", ump: 4 }] }))).toEqual([]);
    expect(reportePorRegion(normalizeAsignacionPlanificada({ ...conRegiones, resumen: {} }))).toEqual([]);
  });
});
