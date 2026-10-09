import { describe, expect, it } from "vitest";

import { cursosDeUnTramo } from "./cursosDeUnTramo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (f: Partial<MonitoreoAulasPlanRow> & Record<string, unknown>) =>
  ({ application_state: "cerrando", ...f } as unknown as MonitoreoAulasPlanRow);

describe("cursosDeUnTramo", () => {
  const filas = [
    // 3 de 20 = 15 % → crítico
    fila({ operational_code: "CH 1", faculty: "DERECHO", expected_valid: 20, respuestas_validas: 3, eligible_n: 40, observed_students: 25 }),
    // 12 de 20 = 60 % → insuficiente
    fila({ operational_code: "CH 2", faculty: "DERECHO", expected_valid: 20, respuestas_validas: 12, eligible_n: 40, observed_students: 30 }),
    // 17 de 20 = 85 % → parcial
    fila({ operational_code: "CH 3", faculty: "LETRAS", expected_valid: 20, respuestas_validas: 17 }),
    // 20 de 20 = 100 % → pleno
    fila({ operational_code: "CH 4", faculty: "LETRAS", expected_valid: 20, respuestas_validas: 20 }),
    // 0 → nulo, y NO crítico: «sin respuestas» no es «poquísimas»
    fila({ operational_code: "CH 5", faculty: "LETRAS", expected_valid: 20, respuestas_validas: 0 }),
  ];

  it("devuelve sólo los del tramo pedido", () => {
    expect(cursosDeUnTramo(filas, "critico").map((c) => c.codigo)).toEqual(["CH 1"]);
    expect(cursosDeUnTramo(filas, "insuficiente").map((c) => c.codigo)).toEqual(["CH 2"]);
    expect(cursosDeUnTramo(filas, "parcial").map((c) => c.codigo)).toEqual(["CH 3"]);
    expect(cursosDeUnTramo(filas, "pleno").map((c) => c.codigo)).toEqual(["CH 4"]);
    expect(cursosDeUnTramo(filas, "nulo").map((c) => c.codigo)).toEqual(["CH 5"]);
  });

  it("trae las cuatro cifras de la cadena, cada una con su nombre", () => {
    const [ch1] = cursosDeUnTramo(filas, "critico");
    expect(ch1.elegibles).toBe(40);
    expect(ch1.esperadas).toBe(20);
    expect(ch1.asistentes).toBe(25);
    expect(ch1.efectivas).toBe(3);
    expect(ch1.cumplimiento).toBe(15);
  });

  it("un curso-horario sin parte no inventa asistentes: van en null, no en cero", () => {
    // Cero asistentes significa «no fue nadie»; que no haya parte significa
    // «todavía no lo sabemos». Son dos cosas distintas.
    const [ch3] = cursosDeUnTramo(filas, "parcial");
    expect(ch3.asistentes).toBeNull();
    expect(ch3.elegibles).toBeNull();
  });

  it("ordena por lo que falta, no por el alfabeto", () => {
    const dos = [
      fila({ operational_code: "CH Z", expected_valid: 20, respuestas_validas: 2 }),
      fila({ operational_code: "CH A", expected_valid: 20, respuestas_validas: 9 }),
    ];
    expect(cursosDeUnTramo(dos, "critico").map((c) => c.codigo)).toEqual(["CH Z", "CH A"]);
  });

  it("los NO aplicados quedan fuera, igual que en el reparto del motor", () => {
    // Un curso-horario agendado y sin visitar no rindió cero: todavía no le toca.
    const pendiente = [fila({
      operational_code: "CH 9", application_state: "lista",
      expected_valid: 20, respuestas_validas: 0,
    })];
    expect(cursosDeUnTramo(pendiente, "nulo")).toEqual([]);
  });

  it("sin meta declarada no se puede repartir, así que no entra", () => {
    const sinMeta = [fila({ operational_code: "CH 8", expected_valid: 0, respuestas_validas: 5 })];
    expect(cursosDeUnTramo(sinMeta, "pleno")).toEqual([]);
    expect(cursosDeUnTramo(sinMeta, "nulo")).toEqual([]);
  });

  it("un tramo que no existe devuelve vacío en vez de reventar", () => {
    expect(cursosDeUnTramo(filas, "inventado")).toEqual([]);
    expect(cursosDeUnTramo(null, "critico")).toEqual([]);
  });
});
