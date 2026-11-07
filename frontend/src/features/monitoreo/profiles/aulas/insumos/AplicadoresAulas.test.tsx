import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasConfig, MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import type { ContextoDeInsumos } from "./contextoDeInsumos";
import { construirAplicadores, readinessDeAplicadores } from "./aplicadoresModelo";
import { AplicadoresAulas } from "./AplicadoresAulas";

// Ficha I3 sobre el mecanismo real (Gonzalo, 2026-10-31): por tramo, cuánto le
// tocó a cada aplicador, cuánto fijó el equipo, en cuántos viajes y si la
// distribución publicada está al día con el reparto vigente.

const asig = (codigo: string, aplicador: string, fijada = false) => ({ codigo, aplicador, inicio: "10:00", fin: "11:00", fijada });

function tablero(huellaReparto = "h2"): MonitoreoAulasDashboard {
  return {
    disponibilidad: {
      dias: [
        { dia: "Lunes", franjas: [{ inicio: "08:00", fin: "08:30", disponibles: 2, nombres: ["Ana Ruiz", "Luis Paz"] }, { inicio: "08:30", fin: "09:00", disponibles: 1, nombres: ["Ana Ruiz"] }] },
        { dia: "Miércoles", franjas: [{ inicio: "15:00", fin: "15:30", disponibles: 1, nombres: ["Luis Paz"] }] },
      ],
    },
    reparto: {
      dias: [
        // Semana 2: Ana tiene 5 el mismo lunes (sobre el tope) y una fijada.
        { fecha: "2026-09-14", asignaciones: [asig("CH 1", "Ana Ruiz", true), asig("CH 2", "Ana Ruiz"), asig("CH 3", "Ana Ruiz"), asig("CH 4", "Ana Ruiz"), asig("CH 5", "Ana Ruiz")], no_cubiertos: [] },
        { fecha: "2026-09-16", asignaciones: [asig("CH 6", "Luis Paz"), asig("CH 7", "Eva Sol")], no_cubiertos: [] },
        // Semana 1: fuera del tramo elegido.
        { fecha: "2026-09-08", asignaciones: [asig("CH 8", "Luis Paz")], no_cubiertos: [] },
      ],
      equidad: [],
      distribucion: { huella: huellaReparto, citas: 8 },
    },
    tramos: [
      { nombre: "Semana 1", desde: "2026-09-07", hasta: "2026-09-13", citas: 1, aplicadas: 1 },
      { nombre: "Semana 2", desde: "2026-09-14", hasta: "2026-09-20", citas: 7, aplicadas: 2, vigente: true },
    ],
    partes_campo: [{ applied_by: "Ana Ruiz", applied_at: "2026-09-14 10:05" }, { applied_by: "Luis Paz", applied_at: "2026-09-08 10:00" }],
  } as unknown as MonitoreoAulasDashboard;
}

const config = { distribucion_sheets: { spreadsheet_id: "x", url: "", updated_at: "2026-09-13T20:00:00Z", huella: "h1", citas: 6 } } as unknown as MonitoreoAulasConfig;

describe("construirAplicadores", () => {
  it("por defecto el tramo vigente; cada aplicador con citas, fijadas, viajes y tope", () => {
    const m = construirAplicadores(tablero(), config);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.elegido?.nombre).toBe("Semana 2");
    const ana = m.filas.find((f) => f.nombre === "Ana Ruiz")!;
    expect(ana).toMatchObject({ citas: 5, fijadas: 1, dias: 1, maxPorDia: 5, sobreTope: true, aplicadas: 1, horas: 1 });
    expect(ana.semana.lunes).toHaveLength(1);
    const luis = m.filas.find((f) => f.nombre === "Luis Paz")!;
    // La cita de la semana 1 no cuenta en la semana 2.
    expect(luis).toMatchObject({ citas: 1, aplicadas: 0, sobreTope: false });
    // Quien tiene citas sin disponibilidad declarada se dice.
    expect(m.filas.find((f) => f.nombre === "Eva Sol")?.sinDisponibilidad).toBe(true);
    expect(m.filas[0].nombre).toBe("Ana Ruiz");
  });

  it("si el vigente no tiene citas en el reparto, abre en el tramo con más citas", () => {
    const d = tablero();
    (d.tramos as Array<Record<string, unknown>>).push({ nombre: "Semana 3", desde: "2026-09-21", hasta: "2026-09-27", citas: 0, aplicadas: 0 });
    (d.tramos as Array<Record<string, unknown>>).forEach((t) => { t.vigente = t.nombre === "Semana 3"; });
    const m = construirAplicadores(d, config);
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.elegido?.nombre).toBe("Semana 2");
  });

  it("un tramo fuera del reparto no dice cero: dice que no se conoce", () => {
    const d = tablero();
    (d.tramos as Array<Record<string, unknown>>).push({ nombre: "Semana 5", desde: "2026-10-05", hasta: "2026-10-11", citas: 9, aplicadas: 0 });
    const m = construirAplicadores(d, config, "Semana 5");
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.fueraDelReparto).toBe(true);
    expect(m.pie).toContain("este tramo queda fuera");
  });

  it("otro tramo cuenta sólo lo suyo", () => {
    const m = construirAplicadores(tablero(), config, "Semana 1");
    if (m.estado !== "listo") throw new Error("esperaba listo");
    expect(m.filas.find((f) => f.nombre === "Luis Paz")).toMatchObject({ citas: 1, aplicadas: 1 });
  });

  it("la distribución publicada: al día con la misma huella; si no, cuántas filas agrega la próxima", () => {
    const al = construirAplicadores(tablero("h1"), config);
    if (al.estado !== "listo") throw new Error("esperaba listo");
    expect(al.distribucion.estado).toBe("al-dia");
    const vieja = construirAplicadores(tablero("h2"), config);
    if (vieja.estado !== "listo") throw new Error("esperaba listo");
    expect(vieja.distribucion.estado).toBe("desactualizada");
    expect(vieja.distribucion.texto).toContain("agrega 2 filas");
    const sin = construirAplicadores(tablero(), {} as MonitoreoAulasConfig);
    if (sin.estado !== "listo") throw new Error("esperaba listo");
    expect(sin.distribucion.estado).toBe("sin-destino");
  });

  it("sin disponibilidad ni reparto, vacío con su causa", () => {
    const m = construirAplicadores({} as MonitoreoAulasDashboard, config);
    expect(m.estado).toBe("sin-datos");
    expect(readinessDeAplicadores(false, m)).toBe("vacio:sin-disponibilidad");
  });
});

describe("AplicadoresAulas", () => {
  const contexto: ContextoDeInsumos = { config, fuentes: [], ocupado: false, importarPlan: () => {}, operaciones: null, importarDisponibilidad: () => {}, plantillaDisponibilidad: () => {} };

  it("publica su marca, explica el mecanismo y marca el viaje sobre el tope", () => {
    const html = renderToStaticMarkup(<AplicadoresAulas dashboard={tablero()} cargando={false} vacioSinTablero={null} contexto={contexto} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-insumos-aplicadores"');
    expect(html).toContain("Aplicadores del tramo");
    expect(html).toContain("siembra la pestaña de cada semana una sola vez");
    expect(html).toContain("Por actualizar");
    expect(html).toContain('data-tono="aviso">5</span>');
    expect(html).toContain("Importar disponibilidad");
  });
});
