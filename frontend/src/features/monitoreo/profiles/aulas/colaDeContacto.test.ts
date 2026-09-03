import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colaDeContacto } from "./colaDeContacto";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("colaDeContacto", () => {
  it("el que más intentos lleva encabeza la cola", () => {
    // Es el que se va a caer: decidir si se insiste o se activa su reserva es
    // la decisión del día.
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "", contact_attempts: 2 }),
      fila({ operational_code: "CH 2", sample_status: "", contact_attempts: 6 }),
    ]);
    expect(pendientes.map((p) => p.codigo)).toEqual(["CH 2", "CH 1"]);
  });

  it("B23 con consumidor: el estado de llamada y el correo cruzan a la cola en las palabras del equipo", () => {
    // call_status y email_received viajaban desde 7c8e0bd3 sin que nadie los
    // mirara — una capacidad existe solo si alguien la consume. Textuales:
    // el vocabulario es del operativo, no una lista cerrada nuestra.
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "", contact_attempts: 3,
             call_status: "No contesta", email_received: "S\u00cd" }),
      fila({ operational_code: "CH 2", sample_status: "", contact_attempts: 0 }),
    ]);
    expect(pendientes[0]).toMatchObject({ codigo: "CH 1", estadoLlamada: "No contesta", correo: "S\u00cd" });
    expect(pendientes[1]).toMatchObject({ codigo: "CH 2", estadoLlamada: "", correo: "" });
  });

  it("una reserva dormida NO se persigue", () => {
    // No se llama hasta que su titular cae; meterla en la cola mandaría al
    // equipo a perseguir aulas que nadie necesita todavía.
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "R 1.1", sample_role: "chain_reserve", sample_status: "en reserva 1" }),
    ]);
    expect(pendientes).toHaveLength(0);
  });

  it("lo que ya cayó tampoco entra en la cola", () => {
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "reemplazada", contact_attempts: 9 }),
    ]);
    expect(pendientes).toHaveLength(0);
  });

  it("el esfuerzo sale de las que SÍ consiguieron cita", () => {
    const { esfuerzo } = colaDeContacto([
      fila({ operational_code: "A", faculty: "Derecho", sample_status: "agendada", contact_attempts: 4 }),
      fila({ operational_code: "B", faculty: "Derecho", sample_status: "agendada", contact_attempts: 2 }),
      fila({ operational_code: "C", faculty: "Letras", sample_status: "reagendada", contact_attempts: 1 }),
    ]);
    expect(esfuerzo[0]).toMatchObject({ facultad: "Derecho", aulas: 2, intentos: 3 });
    expect(esfuerzo[1]).toMatchObject({ facultad: "Letras", aulas: 1, intentos: 1 });
  });

  it("el banco no se contacta", () => {
    const { pendientes, esfuerzo } = colaDeContacto([
      fila({ operational_code: "EXTRA 1", sample_role: "extra_reserve_pool", sample_status: "" }),
    ]);
    expect(pendientes).toHaveLength(0);
    expect(esfuerzo).toHaveLength(0);
  });
});

describe("un componente no usa dos unidades para la misma poblacion", () => {
  // `AulasColaDeContacto` decía «Todos los cursos-horario del plan tienen cita»
  // en su estado vacío y «8 aulas» en la lista de esfuerzo, tres líneas más
  // abajo y sobre las MISMAS filas del plan. En este perfil no son la misma
  // unidad: 210 partes, 196 aulas, 236 cursos-horario.
  const componente = fs.readFileSync(
    path.resolve(__dirname, "AulasColaDeContacto.tsx"),
    "utf8",
  );
  // Los comentarios explican el defecto y nombran la palabra vieja: buscarla en
  // el fuente entero daría falso rojo.
  const visible = componente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("se aisló el texto visible", () => {
    expect(visible).toContain("tienen cita");
  });

  it("la lista de esfuerzo cuenta cursos-horario", () => {
    expect(visible).toContain('"curso-horario" : "cursos-horario"');
  });

  it("no queda copy visible que llame «aulas» a esas filas", () => {
    expect(visible).not.toMatch(/"aula" : "aulas"/);
  });
});

describe("la cola no manda a llamar lo que ya se aplicó", () => {
  /**
   * `tieneCita()` mira `sample_status`, y en cuanto un aula se aplica ese estado
   * deja de ser «agendada»: el aula volvía a la cola de contacto.
   *
   * Medido el 2026-08-29 sobre `aulas_con_respuestas.pulso`: 10 citas fijadas +
   * 183 por contactar = 193, con 48 aplicadas. O sea 38 aulas ya aplicadas en la
   * lista de a quién llamar, en la pantalla que existe para repartir llamadas.
   */
  const fila = (p: Record<string, unknown>) => p as never;

  it("una aplicada sin cita sale de la cola y se cuenta aparte", () => {
    const out = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "aplicada", operational_status: "aplicada" }),
      fila({ operational_code: "CH 2", sample_status: "sin contactar", operational_status: "planificada" }),
    ]);
    expect(out.pendientes.map((p) => p.codigo)).toEqual(["CH 2"]);
    expect(out.yaAplicadasSinCita).toBe(1);
  });

  it("«cerrada» cuenta igual que «aplicada»", () => {
    const out = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "sin contactar", operational_status: "cerrada" }),
    ]);
    expect(out.pendientes).toHaveLength(0);
    expect(out.yaAplicadasSinCita).toBe(1);
  });

  it("una agendada aplicada sigue en CITAS, no en la cuenta aparte", () => {
    // El control: las citadas ya llevaban su propio flag `aplicada` y ese lado
    // no cambia. Si esta exclusión se les aplicara también, desaparecerían las
    // citas conseguidas, que son el resultado del trabajo de quien agenda.
    const out = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "agendada", operational_status: "aplicada",
             scheduled_date: "2026-09-01" }),
    ]);
    expect(out.citadas).toHaveLength(1);
    expect(out.citadas[0]!.aplicada).toBe(true);
    expect(out.yaAplicadasSinCita).toBe(0);
  });

  it("sin aplicadas el contador es 0 y no inventa un vacío", () => {
    const out = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "sin contactar", operational_status: "planificada" }),
    ]);
    expect(out.pendientes).toHaveLength(1);
    expect(out.yaAplicadasSinCita).toBe(0);
  });
});
