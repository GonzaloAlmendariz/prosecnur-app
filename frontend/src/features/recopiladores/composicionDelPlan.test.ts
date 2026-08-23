import { describe, expect, it } from "vitest";
import { composicionPorFacultad } from "./composicionDelPlan";
import type { CollectionUnit } from "../../api/recopiladores";

const unidad = (
  role: string,
  faculty: string,
  seq: number,
  eligible?: number,
): CollectionUnit => ({
  unit_id: `${role}-${faculty}-${seq}-${eligible ?? 0}-${Math.random()}`,
  label: "x",
  role,
  dimensions: { faculty, operational_sequence: seq, eligible_n: eligible },
});

describe("composicionPorFacultad", () => {
  it("reparte titulares y reservas por facultad, ordenado por peso", () => {
    const c = composicionPorFacultad([
      unidad("titular", "DERECHO", 1, 40),
      unidad("chain_reserve", "DERECHO", 1),
      unidad("chain_reserve", "DERECHO", 1),
      unidad("titular", "DERECHO", 2, 30),
      unidad("titular", "GESTIÓN", 3, 20),
      unidad("chain_reserve", "GESTIÓN", 3),
    ]);
    expect(c.filas.map((f) => f.facultad)).toEqual(["DERECHO", "GESTIÓN"]);
    expect(c.filas[0]).toMatchObject({ titulares: 2, reservas: 2, elegibles: 70, respaldo: 1 });
    expect(c.filas[1]).toMatchObject({ titulares: 1, reservas: 1, elegibles: 20 });
    expect(c.titulares).toBe(3);
    expect(c.reservas).toBe(3);
  });

  it("no suma los elegibles de las reservas: sustituyen, no se acumulan", () => {
    // Una cadena de 1 titular + 3 reservas cubre UNA aula. Si el respaldo
    // sumara elegibles, una facultad con muchas reservas pareceria tener
    // cuatro veces la muestra que en realidad va a recoger.
    const c = composicionPorFacultad([
      unidad("titular", "DERECHO", 1, 40),
      unidad("chain_reserve", "DERECHO", 1, 38),
      unidad("chain_reserve", "DERECHO", 1, 41),
      unidad("chain_reserve", "DERECHO", 1, 39),
    ]);
    expect(c.elegibles).toBe(40);
    expect(c.filas[0].reservas).toBe(3);
    expect(c.filas[0].respaldo).toBe(3);
  });

  it("deja el banco de extras fuera del reparto", () => {
    // El banco es capacidad sin asignar: repartirlo inflaria el respaldo de
    // facultades que no lo tienen reservado.
    const c = composicionPorFacultad([
      unidad("titular", "DERECHO", 1, 40),
      unidad("extra_reserve_pool", "DERECHO", 0),
      unidad("extra_reserve_pool", "GESTIÓN", 0),
    ]);
    expect(c.filas).toHaveLength(1);
    expect(c.filas[0]).toMatchObject({ titulares: 1, reservas: 0 });
    expect(c.reservas).toBe(0);
  });

  it("atribuye la reserva a la facultad de su titular, no a la suya", () => {
    // Hoy coinciden siempre. El dia que una cadena cruce facultades, contar por
    // el campo propio de la reserva repartiria mal y sin avisar.
    const titular = unidad("titular", "DERECHO", 7, 40);
    const reserva: CollectionUnit = {
      unit_id: "r", label: "x", role: "chain_reserve",
      dimensions: { operational_sequence: 7 },
    };
    const c = composicionPorFacultad([titular, reserva]);
    expect(c.filas).toHaveLength(1);
    expect(c.filas[0]).toMatchObject({ facultad: "DERECHO", titulares: 1, reservas: 1 });
  });

  it("declara los titulares sin facultad en vez de repartirlos", () => {
    // Un titular sin facultad no puede caer en «Otros» ni en la primera fila:
    // se cuenta aparte para que la pantalla pueda decirlo.
    const c = composicionPorFacultad([
      unidad("titular", "DERECHO", 1, 40),
      { unit_id: "z", label: "x", role: "titular", dimensions: {} },
    ]);
    expect(c.sinFacultad).toBe(1);
    expect(c.titulares).toBe(1);
    expect(c.filas).toHaveLength(1);
  });

  it("el respaldo es reservas por titular, no reservas a secas", () => {
    // Cinco titulares con cinco reservas NO estan cubiertas como cinco con
    // quince, y el numero crudo de reservas no distingue los dos casos.
    const flaca = composicionPorFacultad([
      unidad("titular", "A", 1, 10), unidad("titular", "A", 2, 10),
      unidad("chain_reserve", "A", 1), unidad("chain_reserve", "A", 2),
    ]);
    const gorda = composicionPorFacultad([
      unidad("titular", "B", 1, 10), unidad("titular", "B", 2, 10),
      unidad("chain_reserve", "B", 1), unidad("chain_reserve", "B", 1),
      unidad("chain_reserve", "B", 1), unidad("chain_reserve", "B", 2),
    ]);
    expect(flaca.filas[0].respaldo).toBe(1);
    expect(gorda.filas[0].respaldo).toBe(2);
  });

  it("un plan vacio no inventa filas", () => {
    const c = composicionPorFacultad([]);
    expect(c.filas).toEqual([]);
    expect(c.titulares).toBe(0);
    expect(c.elegibles).toBe(0);
  });
});
