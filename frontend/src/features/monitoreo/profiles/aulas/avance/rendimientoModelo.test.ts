import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { rendimientoContraEsperado } from "./rendimientoContraEsperado";
import { construirRendimiento, readinessDeRendimiento } from "./rendimientoModelo";

// Casos de la revisión metodológica (2026-10-31): el rendimiento se compara
// contra lo ESPERADO de los mismos cursos-horario, nunca por volumen.

// 2026-09-28 es lunes; 2026-09-29, martes.
const aula = (codigo: string, esperadas: number) => ({ operational_code: codigo, eligible_n: 50, expected_valid: esperadas, faculty: "DERECHO" });
const parte = (codigo: string, fecha: string, efectivas: number | null, aplicador = "Aplicador A", asistentes = 40) =>
  ({ operational_code: codigo, applied_at: fecha, applied_by: aplicador, effective_surveys: efectivas, observed_students: asistentes });

// Lunes: 4 aulas al 40 % de lo esperado. Martes: 1 aula al 80 %.
const lunesVsMartes = {
  ritmo_diario: { dias: [{ fecha: "2026-09-28", validas: 64 }, { fecha: "2026-09-29", validas: 16 }], dias_con_campo: 2, media_diaria: 40, meta: 100 },
  agenda: [aula("CH 1", 40), aula("CH 2", 40), aula("CH 3", 40), aula("CH 4", 40), aula("CH 5", 20)],
  partes_campo: [
    parte("CH 1", "2026-09-28 9:00", 16), parte("CH 2", "2026-09-28 10:00", 16),
    parte("CH 3", "2026-09-28 11:00", 16), parte("CH 4", "2026-09-28 15:00", 16),
    parte("CH 5", "2026-09-29 10:00", 16, "Aplicador B"),
  ],
} as unknown as MonitoreoAulasDashboard;

describe("rendimiento contra lo esperado (A4)", () => {
  it("día de la semana: el martes rinde más que el lunes aunque el lunes sume más, y va marcado como poca evidencia", () => {
    const m = construirRendimiento(lunesVsMartes);
    if (m.semana.tipo !== "barras") throw new Error("sin semana");
    const [lun, mar] = m.semana.filas;
    expect([lun.etiqueta, lun.razon, lun.aulas, lun.pocos]).toEqual(["Lun", "40 %", 4, false]);
    expect([mar.etiqueta, mar.razon, mar.aulas, mar.pocos]).toEqual(["Mar", "80 %", 1, true]);
    expect(mar.relleno).toBeGreaterThan(lun.relleno);
    // Un día sin campo no se pinta como cero: sólo salen lunes y martes.
    expect(m.semana.filas).toHaveLength(2);
  });

  it("por hora: la razón de cada hora de aplicación, con las horas sin aulas declaradas y no en cero", () => {
    const m = construirRendimiento(lunesVsMartes);
    if (m.porHora.tipo !== "barras") throw new Error("sin horas");
    expect(m.porHora.barras.map((b) => b.etiqueta)).toEqual(["9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]);
    const diez = m.porHora.barras[1];
    expect([diez.razon, diez.aulas, diez.pocos]).toEqual(["53 %", 2, true]);
    expect(m.porHora.barras[3]).toMatchObject({ razon: "—", aulas: 0 });
    expect(m.porHora.sub).not.toMatch(/pico/);
  });

  it("por aplicador: quien tiene 1 aula al 100 % no encabeza a quien tiene 10 al 60 %", () => {
    const plan = Array.from({ length: 11 }, (_, i) => aula(`CH ${i + 1}`, 10));
    const partes = [
      parte("CH 1", "2026-09-28 9:00", 10, "Uno solo"),
      ...Array.from({ length: 10 }, (_, i) => parte(`CH ${i + 2}`, "2026-09-28 10:00", 6, "Diez aulas")),
    ];
    const m = construirRendimiento({ agenda: plan, partes_campo: partes } as unknown as MonitoreoAulasDashboard);
    if (m.aplicadores.tipo !== "tabla") throw new Error("sin tabla");
    expect(m.aplicadores.filas.map((f) => [f.aplicador, f.contraEsperado, f.pocos])).toEqual([
      ["Diez aulas", "60 %", false],
      ["Uno solo", "100 %", true],
    ]);
  });

  it("un parte sin esperadas en el plan no cambia el denominador y se declara", () => {
    const r = rendimientoContraEsperado(
      [parte("CH 1", "2026-09-28 9:00", 20), parte("CH 99", "2026-09-28 9:00", 30), parte("CH 2", "2026-09-28 9:00", null)] as never,
      [aula("CH 1", 40)] as never,
      () => "todos",
    );
    expect(r.grupos[0]).toMatchObject({ aulas: 1, efectivas: 20, esperadas: 40 });
    expect(r.sinEsperadas).toBe(1);
    expect(r.sinCifra).toBe(1);
  });

  it("sin esperadas en ningún parte la razón es vacía, nunca 0 %", () => {
    const r = rendimientoContraEsperado([parte("CH 1", "2026-09-28 9:00", 20)] as never, [] as never, () => "todos");
    expect(r.grupos).toHaveLength(0);
    expect(r.razonDelEstudio).toBeNull();
  });

  it("tasa contra el diseño: ordena por la señal y una facultad sin banda no encabeza", () => {
    const m = construirRendimiento({
      efectividad_seguimiento: {
        facultades: [
          { facultad: "UNA AULA", faculty_key: "a", tau_previsto: 0.8, tau_observado: 0.3, senal: "sin_banda", aulas_aplicadas: 1, banda_bajo: null, banda_alto: null },
          { facultad: "DERECHO", faculty_key: "d", tau_previsto: 0.6, tau_observado: 0.5, senal: "bajo", aulas_aplicadas: 12, banda_bajo: 0.45, banda_alto: 0.55 },
          { facultad: "LETRAS", faculty_key: "l", tau_previsto: 0.6, tau_observado: 0.6, senal: "conforme", aulas_aplicadas: 8, banda_bajo: 0.5, banda_alto: 0.7 },
        ],
      },
    } as unknown as MonitoreoAulasDashboard);
    if (m.tasas.tipo !== "pesas") throw new Error("sin pesas");
    expect(m.tasas.filas.map((f) => [f.facultad, f.senal, f.aulas])).toEqual([
      ["Derecho", "Bajo lo previsto", "12"],
      ["Letras", "Conforme", "8"],
      ["Una Aula", "Sin banda", "1"],
    ]);
    expect(m.tasas.filas[0].banda).not.toBeNull();
    expect(m.tasas.filas[2].banda).toBeNull();
  });

  it('el volumen por día se rotula como volumen y no promete "el mejor"', () => {
    const m = construirRendimiento(lunesVsMartes);
    if (m.porDia.tipo !== "barras") throw new Error("sin días");
    expect(m.porDia.sub).toBe("volumen; media de 40.0 por día con campo");
  });

  it("readiness: false al cargar, la marca al pintar y vacio sin tablero", () => {
    expect(readinessDeRendimiento(null, true)).toBe("false");
    expect(readinessDeRendimiento(construirRendimiento(lunesVsMartes), false)).toBe("monitoreo-aulas-avance-rendimiento");
    expect(readinessDeRendimiento(construirRendimiento(null), false)).toBe("vacio:sin-tablero");
  });
});
