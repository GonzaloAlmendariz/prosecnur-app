import { describe, expect, it } from "vitest";

import {
  proyeccionElegida,
  respaldoDeLaTasa,
  supuestosAlPie,
} from "./proyeccionDeMetas";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";

const fila = (extra: Partial<MonitoreoAulasProyeccionFila> = {}): MonitoreoAulasProyeccionFila => ({
  facultad: "DERECHO",
  meta: 363, meta_M: 180, meta_F: 183,
  obtenidas: 120, obtenidas_M: 60, obtenidas_F: 60,
  aulas_aplicadas: 8, aulas_agendadas: 12, elegibles_agendados: 400,
  tasa_usada: 0.3, tasa_es_del_diseno: true, tasa_diseno: 0.3, tasa_obtenida: 0.28,
  elegibles_aplicados: 300, desvio_de_la_del_diseno: -0.066,
  proyectadas: 120, proyectadas_M: 59, proyectadas_F: 61,
  total: 240, brecha: -123, llega: false,
  meta_elegida: "muestra", factor_meta: 1,
  supuesto_meta: "", supuesto_sexo: "El reparto por sexo de lo proyectado usa la proporción de la cuota.",
  ...extra,
});

describe("la combinación elegida sale del motor, no de la pantalla", () => {
  const payload = {
    muestra_diseno: [fila({ meta: 363 })],
    sobremuestra_diseno: [fila({ meta: 545, meta_elegida: "sobremuestra", factor_meta: 1.5 })],
  };

  it("cada mando elige su combinación ya calculada", () => {
    expect(proyeccionElegida(payload, "muestra", "diseno")?.[0].meta).toBe(363);
    expect(proyeccionElegida(payload, "sobremuestra", "diseno")?.[0].meta).toBe(545);
  });

  it("una combinación que el motor no emitió es «no se sabe», no una lista vacía", () => {
    // La distinción que la pantalla necesita para declarar su vacío (C3): sin
    // cuotas no se puede decir «no llega», sólo «no se sabe».
    expect(proyeccionElegida(payload, "muestra", "obtenida")).toBeNull();
    expect(proyeccionElegida(null, "muestra", "diseno")).toBeNull();
    expect(proyeccionElegida(undefined, "muestra", "diseno")).toBeNull();
  });

  it("descarta filas sin facultad en vez de pintarlas sin nombre", () => {
    const sucio = { muestra_diseno: [fila(), { facultad: "  " } as MonitoreoAulasProyeccionFila] };
    expect(proyeccionElegida(sucio, "muestra", "diseno")).toHaveLength(1);
  });

  it("un payload que no es objeto no revienta la pantalla", () => {
    expect(proyeccionElegida("nada" as never, "muestra", "diseno")).toBeNull();
    expect(proyeccionElegida({ muestra_diseno: "x" as never }, "muestra", "diseno")).toBeNull();
  });
});

describe("de qué se sostiene la tasa obtenida", () => {
  it("suma aulas y elegibles aplicados, y cuenta las que caen a la del diseño", () => {
    const r = respaldoDeLaTasa([
      fila({ aulas_aplicadas: 8, elegibles_aplicados: 300, tasa_es_del_diseno: true }),
      fila({ facultad: "LETRAS", aulas_aplicadas: 5, elegibles_aplicados: 150, tasa_es_del_diseno: false }),
    ]);
    expect(r).toEqual({ aulas: 13, elegibles: 450, facultadesSinTasaPropia: 1 });
  });

  it("sin filas no hay respaldo que enseñar", () => {
    expect(respaldoDeLaTasa(null)).toBeNull();
    expect(respaldoDeLaTasa([])).toBeNull();
  });
});

describe("los supuestos al pie", () => {
  it("salen del dato y no se repiten", () => {
    const s = supuestosAlPie([fila(), fila({ facultad: "LETRAS" })]);
    expect(s).toHaveLength(1);
    expect(s[0]).toContain("proporción de la cuota");
  });

  it("la sobremuestra añade el suyo", () => {
    const s = supuestosAlPie([fila({ supuesto_meta: "La sobremuestra no está repartida por facultad." })]);
    expect(s).toHaveLength(2);
  });

  it("no se inventa ninguna frase cuando el motor no manda ninguna", () => {
    expect(supuestosAlPie([fila({ supuesto_meta: "", supuesto_sexo: "" })])).toEqual([]);
  });
});
