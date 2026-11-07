import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { AlumnosAulas, franjaDeAlumnos, readinessDeAlumnos } from "./AlumnosAulas";

// Ficha Ctl8 (CCSS): el cruce de los códigos de alumno con el padrón.

const ccss = {
  cruce_por_carrera: { aplica: true, total: { consideradas: 642, personas: 605, duplicadas: 15, sin_cruce: 22, tasa: 0.966 }, carreras: [] },
} as unknown as MonitoreoAulasDashboard;

describe("AlumnosAulas", () => {
  it("la franja con las cifras del cruce", () => {
    expect(franjaDeAlumnos(ccss).map((c) => c.valor)).toEqual(["642", "605", "15", "22", "96.6 %"]);
  });

  it("publica su marca; sin código pedido, su vacío y no inventa un cruce", () => {
    expect(renderToStaticMarkup(<AlumnosAulas dashboard={ccss} cargando={false} vacioSinTablero={null} />))
      .toContain('data-audit-ready="monitoreo-aulas-control-alumnos"');
    const hsvg = { cruce_por_carrera: { aplica: false, motivo: "No pide código." } } as unknown as MonitoreoAulasDashboard;
    expect(readinessDeAlumnos(false, hsvg)).toBe("vacio:sin-codigo");
    expect(renderToStaticMarkup(<AlumnosAulas dashboard={hsvg} cargando={false} vacioSinTablero={null} />)).toContain("No pide código.");
  });
});
