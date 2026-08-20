import { describe, expect, test } from "vitest";

import { cadenaDeFiltros } from "./cadenaDeFiltros";

describe("cadena de filtros", () => {
  test("marca cuando ningún filtro descarta nada", () => {
    // El caso de este estudio: `sexo = F/M` y `p01 = 1/2/3` aceptan todos los
    // valores posibles. Con sólo el total de válidas era invisible.
    const r = cadenaDeFiltros({
      declarados: 2, aplicados: 2, entran: 3700, quedan: 3700, sin_columna: [],
      pasos: [
        { orden: 1, variable: "sexo", valores: ["F", "M"], entran: 3700, caen: 0, quedan: 3700, caen_solo_aqui: 0 },
        { orden: 2, variable: "p01", valores: ["1", "2", "3"], entran: 3700, caen: 0, quedan: 3700, caen_solo_aqui: 0 },
      ],
    });
    expect(r.nadieDescarta).toBe(true);
    expect(r.pasos[0].valores).toEqual(["F", "M"]);
  });

  test("con un solo filtro que descarta, ya no es «nadie descarta»", () => {
    const r = cadenaDeFiltros({
      declarados: 2, aplicados: 2, entran: 100, quedan: 80,
      pasos: [
        { orden: 1, variable: "sexo", valores: ["F"], entran: 100, caen: 20, quedan: 80, caen_solo_aqui: 20 },
        { orden: 2, variable: "p01", valores: ["1"], entran: 80, caen: 0, quedan: 80, caen_solo_aqui: 0 },
      ],
    });
    expect(r.nadieDescarta).toBe(false);
  });

  test("sin cadena no se dice que nadie descarta: no hay filtros", () => {
    // Son dos cosas distintas y compartir la misma frase seria la trampa de
    // una palabra para dos cosas.
    const r = cadenaDeFiltros({ declarados: 0, aplicados: 0, pasos: [] });
    expect(r.nadieDescarta).toBe(false);
    expect(r.pasos).toEqual([]);
  });

  test("los filtros sin columna en la base llegan nombrados", () => {
    const r = cadenaDeFiltros({
      declarados: 2, aplicados: 1, sin_columna: [{ variable: "no_existe" }],
      pasos: [{ orden: 1, variable: "sexo", valores: ["F"], entran: 10, caen: 4, quedan: 6, caen_solo_aqui: 4 }],
    });
    expect(r.sinColumna).toEqual(["no_existe"]);
    expect(r.aplicados).toBe(1);
  });

  test("un payload ausente no rompe la vista", () => {
    const r = cadenaDeFiltros(undefined);
    expect(r.declarados).toBe(0);
    expect(r.pasos).toEqual([]);
    expect(r.nadieDescarta).toBe(false);
  });
});
