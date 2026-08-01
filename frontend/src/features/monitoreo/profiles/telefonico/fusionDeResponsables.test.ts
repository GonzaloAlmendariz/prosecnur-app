import { describe, expect, it } from "vitest";

import { fusionarResponsablesPorPersona } from "./fusionDeResponsables";

// Los bloques vienen por (Actor, Responsable), así que quien cubre dos
// componentes ocupaba dos tarjetas con cargas muy desiguales —40 y 6— cuando el
// equipo son cuatro personas con 46, 45, 46 y 46, como lo resume la tabla
// dinámica del propio estudio.

const clave = (row: Record<string, unknown>) => String(row.Responsable ?? "").toLocaleLowerCase("es").trim();
const actor = (row: Record<string, unknown>) => String(row.Actor ?? "");

describe("fusionarResponsablesPorPersona", () => {
  it("suma los conteos de la misma persona en sus dos componentes", () => {
    const filas = [
      { Responsable: "Jorge Del Solar", Actor: "Homologación Laboral", "Casos asignados": 40, Barridos: 3, "No barridos": 37, Efectivas: 2, "Sin efectiva": 1 },
      { Responsable: "Jorge Del Solar", Actor: "Vinculación Laboral", "Casos asignados": 6, Barridos: 0, "No barridos": 6, Efectivas: 0, "Sin efectiva": 0 },
    ];
    const [jorge] = fusionarResponsablesPorPersona(filas, clave, actor);

    expect(jorge["Casos asignados"]).toBe(46);
    expect(jorge.Barridos).toBe(3);
    expect(jorge["No barridos"]).toBe(43);
    expect(jorge.Efectivas).toBe(2);
    expect(jorge["Sin efectiva"]).toBe(1);
  });

  it("cuatro personas con dos asignaciones dan cuatro filas", () => {
    const filas = ["Jorge Del Solar", "Katherine Colan", "Mary Berrocal", "Silbia Cruzado"]
      .flatMap((nombre) => [
        { Responsable: nombre, Actor: "Homologación Laboral", "Casos asignados": 39 },
        { Responsable: nombre, Actor: "Vinculación Laboral", "Casos asignados": 7 },
      ]);

    const fusionadas = fusionarResponsablesPorPersona(filas, clave, actor);
    expect(fusionadas).toHaveLength(4);
    expect(fusionadas.every((fila) => fila["Casos asignados"] === 46)).toBe(true);
  });

  it("descarta el ratio en vez de sumarlo o promediarlo", () => {
    // Sumar 40% y 0% daría 40%; promediarlos, 20%. Las dos falsas: el ratio de
    // la persona sale de sus totales. Se borra y quien consume lo recalcula.
    const filas = [
      { Responsable: "Mary", Actor: "A", Barridos: 5, "Sin efectiva": 2, "Ratio incidencias": 40 },
      { Responsable: "Mary", Actor: "B", Barridos: 5, "Sin efectiva": 0, "Ratio incidencias": 0 },
    ];
    const [mary] = fusionarResponsablesPorPersona(filas, clave, actor);

    expect(mary["Ratio incidencias"]).toBeUndefined();
    expect(mary.Barridos).toBe(10);
    expect(mary["Sin efectiva"]).toBe(2);
  });

  it("con un solo actor conserva su etiqueta y su ratio", () => {
    const filas = [
      { Responsable: "Ana", Actor: "Homologación Laboral", "Casos asignados": 39, "Ratio incidencias": 12 },
    ];
    const [ana] = fusionarResponsablesPorPersona(filas, clave, actor);

    expect(ana.Actor).toBe("Homologación Laboral");
    expect(ana["Ratio incidencias"]).toBe(12);
  });

  it("quien cubre varios actores no queda etiquetado con uno", () => {
    const filas = [
      { Responsable: "Ana", Actor: "Homologación Laboral", "Casos asignados": 39 },
      { Responsable: "Ana", Actor: "Vinculación Laboral", "Casos asignados": 7 },
    ];
    const [ana] = fusionarResponsablesPorPersona(filas, clave, actor);
    expect(ana.Actor).toBeUndefined();
  });

  it("lee conteos que llegan como texto", () => {
    const filas = [
      { Responsable: "Ana", Actor: "A", "Casos asignados": "40" },
      { Responsable: "Ana", Actor: "B", "Casos asignados": "6" },
    ];
    const [ana] = fusionarResponsablesPorPersona(filas, clave, actor);
    expect(ana["Casos asignados"]).toBe(46);
  });

  it("una fila sin persona identificable no inventa una tarjeta", () => {
    const filas = [{ Responsable: "", Actor: "A", "Casos asignados": 5 }];
    expect(fusionarResponsablesPorPersona(filas, clave, actor)).toHaveLength(0);
  });
});
