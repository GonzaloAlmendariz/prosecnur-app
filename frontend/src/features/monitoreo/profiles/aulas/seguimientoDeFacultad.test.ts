import { describe, expect, it } from "vitest";

import { seguimientoDeFacultad } from "./seguimientoDeFacultad";
import type { MonitoreoAulasProyeccionFila, MonitoreoRow } from "../../../../api/monitoreo";

const fila = (f: Record<string, unknown>) => f as unknown as MonitoreoRow;

const proy = (p: Partial<MonitoreoAulasProyeccionFila>) => ({
  facultad: "DERECHO", meta: 100, meta_M: 50, meta_F: 50,
  obtenidas: 40, obtenidas_M: 25, obtenidas_F: 15,
  proyectadas: 30, proyectadas_M: 15, proyectadas_F: 15,
  ...p,
} as MonitoreoAulasProyeccionFila);

const agenda = [
  fila({ faculty: "DERECHO", operational_code: "CH 1", application_state: "cerrando", expected_valid: 10, respuestas_validas: 9 }),
  fila({ faculty: "DERECHO", operational_code: "CH 2", application_state: "lista", expected_valid: 10, scheduled_date: "2026-09-12" }),
  fila({ faculty: "DERECHO", operational_code: "CH 3", application_state: "lista", expected_valid: 10, scheduled_date: "2026-09-15" }),
  fila({ faculty: "DERECHO", operational_code: "CH 4", application_state: "pendiente", expected_valid: 10 }),
  // Otra facultad: no debe contaminar.
  fila({ faculty: "LETRAS", operational_code: "CH 9", application_state: "lista", expected_valid: 10, scheduled_date: "2026-09-30" }),
];

describe("seguimientoDeFacultad", () => {
  it("contesta las tres primeras: agendadas, faltantes y hasta cuándo llega la agenda", () => {
    const s = seguimientoDeFacultad("DERECHO", agenda, proy({}))!;
    expect(s.agendados).toBe(2);
    expect(s.aplicados).toBe(1);
    expect(s.sinAgendar).toBe(1);
    expect(s.ultimaFecha).toBe("2026-09-15");
  });

  it("no se contamina con otra facultad, ni siquiera en la última fecha", () => {
    // LETRAS tiene una agendada para el 30; si se colara, esta facultad diría
    // que su agenda llega dos semanas más allá de lo que llega.
    expect(seguimientoDeFacultad("DERECHO", agenda, proy({}))!.ultimaFecha).toBe("2026-09-15");
    expect(seguimientoDeFacultad("LETRAS", agenda, proy({}))!.agendados).toBe(1);
  });

  it("las tres cuotas con su brecha, y la de sexo por separado", () => {
    const s = seguimientoDeFacultad("DERECHO", agenda, proy({}))!;
    expect(s.cuotas.map((c) => [c.clave, c.brecha]))
      .toEqual([["total", -30], ["hombres", -10], ["mujeres", -20]]);
    expect(s.faltaAlguna).toBe(true);
  });

  it("una cuota que SÍ llega no cuenta como falta", () => {
    const s = seguimientoDeFacultad("DERECHO", agenda, proy({
      meta: 60, meta_M: 30, meta_F: 30, proyectadas: 30, proyectadas_M: 20, proyectadas_F: 20,
      obtenidas: 40, obtenidas_M: 25, obtenidas_F: 15,
    }))!;
    expect(s.cuotas.map((c) => c.brecha)).toEqual([10, 15, 5]);
    expect(s.faltaAlguna).toBe(false);
  });

  it("sin proyección NO se inventa que llega: brecha nula y ninguna alarma", () => {
    // «No se puede proyectar» y «no llega» son dos cosas distintas, y tratar la
    // falta de dato como falta es el defecto que este perfil lleva desmontando.
    const s = seguimientoDeFacultad("DERECHO", agenda, null)!;
    expect(s.cuotas).toEqual([]);
    expect(s.faltaAlguna).toBe(false);
  });

  it("una proyección sin cifras de sexo deja esa brecha en null, no en cero", () => {
    const s = seguimientoDeFacultad("DERECHO", agenda, proy({
      proyectadas_M: null, proyectadas_F: null,
    }))!;
    expect(s.cuotas.find((c) => c.clave === "hombres")?.brecha).toBeNull();
    expect(s.cuotas.find((c) => c.clave === "mujeres")?.brecha).toBeNull();
    // Y la del total, que sí viene, se sigue calculando.
    expect(s.cuotas.find((c) => c.clave === "total")?.brecha).toBe(-30);
  });

  it("cuenta los relevos vivos de SUS cursos-horario y los extras de SU facultad", () => {
    const s = seguimientoDeFacultad("DERECHO", agenda, proy({}), "", {
      "CH 2": { disponibles: 3 },
      "CH 9": { disponibles: 5 },   // de LETRAS: no cuenta
    }, [
      { facultad: "DERECHO", disponibles: 2 },
      { facultad: "LETRAS", disponibles: 7 },
    ])!;
    expect(s.relevosVivos).toBe(3);
    expect(s.extrasDisponibles).toBe(2);
  });

  it("sin nombre de facultad no devuelve un objeto vacío: devuelve null", () => {
    expect(seguimientoDeFacultad("", agenda, proy({}))).toBeNull();
  });
});
