import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasConfig, MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { construirDistribucion, readinessDeDistribucion } from "./distribucionModelo";
import { DistribucionAulas, type ContextoDeDistribucion } from "./DistribucionAulas";

// Ficha Ctl3 (maqueta v3): el reparto del día por aplicador, sobre el mecanismo
// real de la hoja (se siembra una vez, se agrega lo nuevo, lo manual manda).

// 2026-09-21 es lunes.
const tablero = {
  disponibilidad: { dias: [{ dia: "Lunes", franjas: [{ inicio: "08:00", fin: "08:30", disponibles: 1, nombres: ["Ana Ruiz"] }] }] },
  reparto: {
    dias: [
      { fecha: "2026-09-21", asignaciones: [
        { codigo: "CH 1", aplicador: "Ana Ruiz", inicio: "09:00", fin: "10:00", fijada: true, recojo: "08:30" },
        { codigo: "CH 2", aplicador: "Luis Paz", inicio: "11:00", fin: "12:00" },
        { codigo: "CH 3", aplicador: "Ana Ruiz", inicio: "15:00", fin: "16:00" },
      ], no_cubiertos: [] },
      { fecha: "2026-09-22", asignaciones: [{ codigo: "CH 4", aplicador: "Luis Paz", inicio: "10:00", fin: "11:00" }], no_cubiertos: [] },
    ],
    equidad: [{ aplicador: "Ana Ruiz", asignadas: 2 }, { aplicador: "Luis Paz", asignadas: 2 }],
    fijadas: [{ codigo: "CH 1", aplicador: "Ana Ruiz" }],
    fijadas_sin_cita: ["CH 143"],
    distribucion: { huella: "h2", citas: 4, agendadas_sin_cita: 1, sin_cita: [{ curso_horario: "CH 9" }] },
    concentrado: true,
  },
  agenda: [{ operational_code: "CH 1", scheduled_venue: "A301" }],
} as unknown as MonitoreoAulasDashboard;

const config = { distribucion_sheets: { spreadsheet_id: "x", url: "", updated_at: "2026-09-20T10:00:00Z", huella: "h1", citas: 3 } } as unknown as MonitoreoAulasConfig;

describe("construirDistribucion", () => {
  it("abre en el día más cargado; cada aplicador con sus citas en la escala y su disponibilidad", () => {
    const m = construirDistribucion(tablero, config);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.elegido).toBe("2026-09-21");
    expect(m.dias.map((d) => [d.rotulo, d.citas])).toEqual([["Lun 21", 3], ["Mar 22", 1]]);
    const ana = m.filas.find((f) => f.aplicador === "Ana Ruiz")!;
    expect(ana.citas.map((c) => [c.codigo, c.fijada])).toEqual([["CH 1", true], ["CH 3", false]]);
    expect(ana.citas[0].recojo).not.toBeNull();
    expect(ana.disponible).toHaveLength(1);
    expect(m.cruce.map((c) => [c.clave, c.valor])).toEqual([["sin-aplicador", 1], ["fijadas-sin-cita", 1], ["fuera-de-rango", 0]]);
    expect(m.hoja).toMatchObject({ conectada: true, desactualizada: true });
  });

  it("otro día cuenta sólo lo suyo y sin reparto dice por qué", () => {
    const m = construirDistribucion(tablero, config, "2026-09-22");
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.filas.find((f) => f.aplicador === "Ana Ruiz")?.citas).toHaveLength(0);
    const sin = construirDistribucion({ reparto: { dias: [], equidad: [] } } as unknown as MonitoreoAulasDashboard, config);
    expect(sin.estado).toBe("sin-reparto");
    expect(readinessDeDistribucion(false, sin)).toBe("vacio:sin-reparto");
  });
});

describe("DistribucionAulas", () => {
  const contexto: ContextoDeDistribucion = {
    config, ocupado: false, onConcentrar: () => {}, onResortear: () => {}, onPublicarDistribucion: () => {}, onSincronizarDistribucion: () => {},
  };
  it("publica su marca, explica el mecanismo y ofrece agregar lo nuevo a la hoja", () => {
    const html = renderToStaticMarkup(<DistribucionAulas dashboard={tablero} cargando={false} vacioSinTablero={null} contexto={contexto} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-distribucion"');
    expect(html).toContain("Lo que el equipo ajusta a mano en la hoja manda.");
    expect(html).toContain("Agregar lo nuevo a la hoja");
    expect(html).toContain("Por actualizar");
    expect(html).toContain("is-fijada");
  });
});
