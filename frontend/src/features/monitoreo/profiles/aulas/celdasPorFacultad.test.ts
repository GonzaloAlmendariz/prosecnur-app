import { describe, expect, it } from "vitest";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import { celdasPorFacultad } from "./celdasPorFacultad";

const celda = (p: Record<string, unknown>) => p as MonitoreoRow;

describe("celdasPorFacultad", () => {
  it("separa hombres y mujeres del ALUMNO, no la mayoría del aula", () => {
    const out = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40, brecha: 12 }),
      celda({ faculty: "DERECHO", sex: "M", logrado: 55, brecha: 0 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      facultad: "DERECHO",
      mujeresLogrado: 40, mujeresDeficit: 12,
      hombresLogrado: 55, hombresDeficit: 0,
      deficit: 12,
    });
  });

  it("NO publica decimales: las respuestas son personas", () => {
    // El defecto que Gonzalo señaló en el gráfico anterior: «236.1 respuestas».
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40.4, brecha: 12.1 }),
    ]);
    expect(f.mujeresLogrado).toBe(40);
    expect(f.mujeresDeficit).toBe(13);       // el deficit se pide entero, hacia arriba
    expect(Number.isInteger(f.deficit)).toBe(true);
  });

  it("ordena por el déficit proyectado, que es lo que exige decidir", () => {
    const out = celdasPorFacultad([
      celda({ faculty: "POCA", sex: "F", logrado: 10, brecha: 2 }),
      celda({ faculty: "MUCHA", sex: "F", logrado: 10, brecha: 90 }),
      celda({ faculty: "MEDIA", sex: "M", logrado: 10, brecha: 30 }),
    ]);
    expect(out.map((f) => f.facultad)).toEqual(["MUCHA", "MEDIA", "POCA"]);
  });

  it("ignora sexos que no son del alumno", () => {
    // `sex_top_1` puede traer otras marcas; aquí sólo entran F y M de la celda
    // de cuota. Una fila con otra cosa no puede inventar una tercera barra.
    const out = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "X", logrado: 99, brecha: 99 }),
      celda({ faculty: "DERECHO", sex: "F", logrado: 5, brecha: 1 }),
    ]);
    expect(out[0]!.mujeresLogrado).toBe(5);
    expect(out[0]!.hombresLogrado).toBe(0);
    expect(out[0]!.deficit).toBe(1);
  });

  it("una facultad con las dos celdas cubiertas queda con falta cero", () => {
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40, brecha: 0 }),
      celda({ faculty: "DERECHO", sex: "M", logrado: 30, brecha: 0 }),
    ]);
    expect(f.deficit).toBe(0);
  });

  it("sin celdas devuelve lista vacía, no una facultad fantasma", () => {
    expect(celdasPorFacultad([])).toEqual([]);
  });
});

describe("los tres tramos", () => {
  it("separa lo agendado del déficit: no son lo mismo", () => {
    // `brecha` de la celda es `cuota − PROYECCIÓN`, no `cuota − logrado`.
    // Pintarla como «faltan» al lado de lo recogido deja fuera lo que las aulas
    // ya agendadas van a traer, y las barras dejan de sumar la cuota.
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40, aporte_pendiente: 30, brecha: 12 }),
    ]);
    expect(f.mujeresLogrado).toBe(40);
    expect(f.mujeresPendiente).toBe(30);
    expect(f.mujeresDeficit).toBe(12);
  });

  it("lo agendado también va en personas enteras", () => {
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "M", logrado: 0, aporte_pendiente: 6.1, brecha: 0 }),
    ]);
    expect(f.hombresPendiente).toBe(6);
  });
});
