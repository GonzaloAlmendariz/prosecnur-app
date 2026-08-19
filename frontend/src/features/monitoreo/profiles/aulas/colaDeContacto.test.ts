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
