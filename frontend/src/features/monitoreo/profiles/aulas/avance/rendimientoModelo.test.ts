import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { construirRendimiento, readinessDeRendimiento } from "./rendimientoModelo";

// 2026-09-12 sábado y 2026-09-13 domingo: la serie trae los días sin campo en cero.
const dias = [
  { fecha: "2026-09-11", validas: 300, acumulado: 300 },
  { fecha: "2026-09-12", validas: 100, acumulado: 400 },
  { fecha: "2026-09-13", validas: 0, acumulado: 400 },
  { fecha: "2026-09-14", validas: 200, acumulado: 600 },
];

const base = {
  ritmo_diario: {
    dias, dias_con_campo: 3, media_diaria: 200, meta: 2500,
    por_hora: [{ hora: 9, validas: 100 }, { hora: 11, validas: 450 }],
  },
  efectividad_seguimiento: {
    facultades: [
      { facultad: "LETRAS Y CIENCIAS HUMANAS", faculty_key: "letras", tau_previsto: 0.8, tau_observado: 0.57, senal: "bajo" },
      { facultad: "EDUCACION", faculty_key: "educacion", tau_previsto: 0.62, tau_observado: 0.67, senal: "conforme" },
      { facultad: "DERECHO", faculty_key: "derecho", tau_previsto: 0.57, tau_observado: null, senal: "sin_banda" },
    ],
  },
  partes_campo: [
    { operational_code: "CH 1", applied_by: "Aplicador 08", effective_surveys: 30, observed_students: 40 },
    { operational_code: "CH 2", applied_by: "Aplicador 08", effective_surveys: 20, observed_students: 25 },
    { operational_code: "CH 3", applied_by: "Aplicador 44", effective_surveys: 10, observed_students: 30 },
    { operational_code: "CH 4", applied_by: "Aplicador 44", observed_students: 30 },
  ],
  agenda: [
    { operational_code: "CH 1", eligible_n: 50, faculty: "DERECHO" },
    { operational_code: "CH 2", eligible_n: 50, faculty: "DERECHO" },
    { operational_code: "CH 3", eligible_n: 40, faculty: "EDUCACION" },
  ],
} as unknown as MonitoreoAulasDashboard;

describe("construirRendimiento (A4)", () => {
  it("por día: el fin de semana se marca y la media es la del motor", () => {
    const m = construirRendimiento(base);
    expect(m.porDia.tipo).toBe("barras");
    if (m.porDia.tipo !== "barras") return;
    expect(m.porDia.sub).toBe("media de 200.0 por día con campo");
    expect(m.porDia.barras.map((b) => b.finDeSemana)).toEqual([false, true, true, false]);
    expect(m.porDia.barras.map((b) => b.etiqueta)).toEqual(["11", "12", "13", "14"]);
    expect(m.porDia.barras[0].alto).toBe(100);
  });

  it("por hora: rellena las horas sin respuestas, nombra el pico y dice lo que queda sin hora", () => {
    const m = construirRendimiento(base);
    if (m.porHora.tipo !== "barras") throw new Error("sin barras");
    expect(m.porHora.barras.map((b) => b.hora)).toEqual([9, 10, 11]);
    expect(m.porHora.barras.map((b) => b.validas)).toEqual([100, 0, 450]);
    expect(m.porHora.sub).toBe("pico a las 11:00");
    expect(m.porHora.pie).toBe("50 efectivas sin hora legible no entran en ninguna barra.");
  });

  it("por hora: un corte anterior al bloque lo declara, no dibuja ceros", () => {
    const viejo = { ...base, ritmo_diario: { ...base.ritmo_diario, por_hora: undefined } } as MonitoreoAulasDashboard;
    const m = construirRendimiento(viejo);
    expect(m.porHora).toMatchObject({ tipo: "vacio", vacio: { clase: "desconexion" } });
  });

  it("tasas: la que más se aleja hacia abajo primero, con la señal del motor y la facultad sin campo en el pie", () => {
    const m = construirRendimiento(base);
    if (m.tasas.tipo !== "pesas") throw new Error("sin pesas");
    expect(m.tasas.filas.map((f) => [f.diseno, f.campo, f.bajo])).toEqual([["80 %", "57 %", true], ["62 %", "67 %", false]]);
    expect(m.tasas.escala).toBe("Del 50 % al 80 %");
    expect(m.tasas.filas[0].xDiseno).toBeCloseTo(100);
    expect(m.tasas.pie).toBe("1 facultad queda fuera por no tener cursos-horario aplicados o tasa del diseño.");
  });

  it("tasas: con el eje por nivel (CCSS) el grupo es el nivel, no una facultad", () => {
    const ccss = {
      ...base,
      avance_cuota: { eje: { clave: "nivel", columna: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", motivo: "" } },
      efectividad_seguimiento: { facultades: [
        { facultad: "9", faculty_key: "9", tau_previsto: 0.6, tau_observado: 0.5, senal: "bajo" },
        { facultad: "6", faculty_key: "6", tau_previsto: 0.6, tau_observado: null, senal: "sin_banda" },
      ] },
    } as unknown as MonitoreoAulasDashboard;
    const m = construirRendimiento(ccss);
    if (m.tasas.tipo !== "pesas") throw new Error("sin pesas");
    expect(m.tasas.eje).toBe("Nivel");
    expect(m.tasas.filas[0].facultad).toBe("Nivel 9");
    expect(m.tasas.pie).toBe("1 nivel queda fuera por no tener cursos-horario aplicados o tasa del diseño.");
  });

  it("día de la semana: suma la serie diaria, lunes primero y domingo sólo si tuvo campo", () => {
    const m = construirRendimiento(base);
    if (m.semana.tipo !== "barras") throw new Error("sin barras");
    expect(m.semana.filas.map((f) => [f.dia, f.validas])).toEqual([
      ["Lun", 200], ["Mar", 0], ["Mié", 0], ["Jue", 0], ["Vie", 300], ["Sáb", 100],
    ]);
  });

  it("por aplicador: de más a menos efectivas, tasa sobre elegibles y el parte sin cifra dicho", () => {
    const m = construirRendimiento(base);
    if (m.aplicadores.tipo !== "tabla") throw new Error("sin tabla");
    expect(m.aplicadores.sub).toBe("2 con partes");
    expect(m.aplicadores.filas.map((f) => [f.aplicador, f.aulas, f.efectivas, f.tasa])).toEqual([
      ["Aplicador 08", "2", "50", "50.0 %"],
      ["Aplicador 44", "1", "10", "25.0 %"],
    ]);
    expect(m.aplicadores.pie).toBe("1 parte sin cifra de efectivas no entra en la tabla.");
  });

  it("readiness: false al cargar, la marca al pintar y vacio sin tablero", () => {
    expect(readinessDeRendimiento(null, true)).toBe("false");
    expect(readinessDeRendimiento(construirRendimiento(base), false)).toBe("monitoreo-aulas-avance-rendimiento");
    expect(readinessDeRendimiento(construirRendimiento(null), false)).toBe("vacio:sin-tablero");
  });
});
