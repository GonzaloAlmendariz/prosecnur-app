import { describe, expect, it } from "vitest";

import {
  aulasPorFacultad,
  cintaDeMetas,
  facultadesQueNoLlegan,
  filasAlfabeticas,
  tasasQueSeApartan,
} from "./metasDeLaPestana";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";

const fila = (extra: Partial<MonitoreoAulasProyeccionFila> = {}): MonitoreoAulasProyeccionFila => ({
  facultad: "DERECHO",
  meta: 363, meta_M: 126, meta_F: 237,
  obtenidas: 51, obtenidas_M: 17, obtenidas_F: 34,
  aulas_aplicadas: 3, aulas_agendadas: 9, elegibles_agendados: 320,
  tasa_usada: 0.568, tasa_es_del_diseno: true, tasa_diseno: 0.568, tasa_obtenida: 0.408,
  elegibles_aplicados: 125, desvio_de_la_del_diseno: -0.282,
  proyectadas: 181.9, proyectadas_M: 63, proyectadas_F: 118.9,
  total: 232.9, brecha: -130.1, llega: false,
  meta_elegida: "muestra", factor_meta: 1,
  supuesto_meta: "", supuesto_sexo: "…",
  ...extra,
});

describe("la cinta suma las facultades, no lee un total aparte", () => {
  it("los seis totales salen de las filas", () => {
    const c = cintaDeMetas([
      fila({ meta: 100, meta_M: 40, meta_F: 60, obtenidas: 30, obtenidas_M: 10, obtenidas_F: 20 }),
      fila({ facultad: "LETRAS", meta: 50, meta_M: 20, meta_F: 30, obtenidas: 5, obtenidas_M: 2, obtenidas_F: 3 }),
    ]);
    expect(c).toEqual({ meta: 150, meta_M: 60, meta_F: 90, obtenidas: 35, obtenidas_M: 12, obtenidas_F: 23 });
  });

  it("sin filas no hay cinta que pintar, y se dice con null", () => {
    expect(cintaDeMetas(null)).toBeNull();
    expect(cintaDeMetas([])).toBeNull();
  });
});

describe("el orden de la pestaña es el de BUSCAR, no el de decidir", () => {
  it("alfabético en español, sin tocar ninguna cifra", () => {
    const orden = filasAlfabeticas([
      fila({ facultad: "PSICOLOGÍA" }),
      fila({ facultad: "ARTE Y DISEÑO" }),
      fila({ facultad: "EDUCACION" }),
    ]).map((f) => f.facultad);
    expect(orden).toEqual(["ARTE Y DISEÑO", "EDUCACION", "PSICOLOGÍA"]);
  });

  it("no muta la lista que recibe: el motor la manda ordenada por brecha", () => {
    const original = [fila({ facultad: "Z" }), fila({ facultad: "A" })];
    filasAlfabeticas(original);
    expect(original[0].facultad).toBe("Z");
  });
});

describe("las aulas se cruzan por facultad", () => {
  it("una entrada por facultad, con sus dos cifras", () => {
    const m = aulasPorFacultad([
      { facultad: "DERECHO", planificadas: 19, aplicadas: 3 },
      { facultad: "EDUCACION", planificadas: 3, aplicadas: 0 },
    ]);
    expect(m.get("DERECHO")).toEqual({ planificadas: 19, aplicadas: 3 });
    expect(m.get("EDUCACION")?.aplicadas).toBe(0);
  });

  it("una facultad sin nombre no entra, y un duplicado no pisa al primero", () => {
    const m = aulasPorFacultad([
      { facultad: "  ", planificadas: 1, aplicadas: 1 },
      { facultad: "DERECHO", planificadas: 19, aplicadas: 3 },
      { facultad: "DERECHO", planificadas: 99, aplicadas: 99 },
    ]);
    expect(m.size).toBe(1);
    expect(m.get("DERECHO")?.planificadas).toBe(19);
  });

  it("sin bloque de aulas el mapa está vacío, no revienta", () => {
    expect(aulasPorFacultad(undefined).size).toBe(0);
  });
});

describe("quién no llega", () => {
  it("se lee de `llega`, que lo decide el motor", () => {
    // Si esto recalculara `total >= meta` daría lo mismo hoy y algo distinto el
    // día que el motor afine el criterio: la forma exacta de abrir una
    // discrepancia entre dos sitios.
    const r = facultadesQueNoLlegan([
      fila({ llega: false, total: 999, meta: 1 }),
      fila({ facultad: "LETRAS", llega: true, total: 0, meta: 999 }),
    ]);
    expect(r).toEqual({ noLlegan: 1, total: 2 });
  });

  it("sin filas no se afirma nada", () => {
    expect(facultadesQueNoLlegan([])).toBeNull();
  });
});

describe("las tasas que se apartan", () => {
  it("cuenta sólo las que tienen desvío calculable", () => {
    expect(tasasQueSeApartan([
      fila({ desvio_de_la_del_diseno: -0.282 }),
      fila({ desvio_de_la_del_diseno: 0.05 }),
      fila({ desvio_de_la_del_diseno: null }),
      fila({ desvio_de_la_del_diseno: 0.541 }),
    ])).toBe(2);
  });

  it("una facultad sin tasa propia no tiene desvío CERO: no tiene desvío", () => {
    expect(tasasQueSeApartan([fila({ desvio_de_la_del_diseno: null })])).toBe(0);
  });
});
