import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { pasoDelRefuerzo, seguimientoDeRefuerzos } from "./seguimientoDeRefuerzos";

const fila = (p: Record<string, unknown>) => ({
  operational_code: "R 1.1", faculty: "DERECHO", teacher: "Docente",
  sample_status: "refuerzo_por_contactar", operational_status: "planificada",
  activation_origin: "refuerzo", activated_for: "DERECHO",
  respuestas_validas: 0, ...p,
} as unknown as MonitoreoAulasPlanRow);

describe("seguimientoDeRefuerzos", () => {
  it("sólo recoge lo que marcó la app, no todo lo que esté en ese estado", () => {
    // Una fila puede llevar el estado especial sin venir de la app (alguien lo
    // tecleó en el libro). El sello de origen es lo que distingue una de otra.
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 1.1" }),
      fila({ operational_code: "R 2.2", activation_origin: "" }),
      fila({ operational_code: "R 3.3", activation_origin: "reemplazo" }),
    ]);
    expect(s.pedidos.map((p) => p.codigo)).toEqual(["R 1.1"]);
  });

  it("reconoce la transición del estado especial a contacto, fecha y aplicación", () => {
    // Es la pregunta de Gonzalo: la marca no se borra cuando el agendador
    // teclea el estado siguiente, así que la app puede seguirla entera.
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 1.1" }),
      fila({ operational_code: "R 2.2", sample_status: "en_contacto" }),
      fila({ operational_code: "R 3.3", sample_status: "agendada" }),
      fila({ operational_code: "R 4.4", sample_status: "reagendada" }),
      fila({ operational_code: "R 5.5", sample_status: "agendada", respuestas_validas: 12 }),
      fila({ operational_code: "R 6.6", sample_status: "rechazo" }),
    ]);
    expect(s.cuenta).toMatchObject({
      por_contactar: 1, en_gestion: 1, con_fecha: 2, aplicado: 1, rechazado: 1,
    });
    expect(s.avanzaron).toBe(3);
    expect(s.esperando).toBe(2);
  });

  it("el HECHO manda sobre el verbo: con respuestas está aplicado diga lo que diga", () => {
    // V4. El estado de muestra lo teclea una persona y llega tarde; las
    // respuestas ya ocurrieron.
    expect(pasoDelRefuerzo(fila({ sample_status: "refuerzo_por_contactar", respuestas_validas: 9 })))
      .toBe("aplicado");
    expect(pasoDelRefuerzo(fila({ sample_status: "en_contacto", operational_status: "aplicada" })))
      .toBe("aplicado");
  });

  it("pone delante lo accionable y deja el registro al final", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 9.9", respuestas_validas: 4 }),
      fila({ operational_code: "R 8.8", sample_status: "agendada" }),
      fila({ operational_code: "R 7.7" }),
    ]);
    expect(s.pedidos.map((p) => p.paso)).toEqual(["por_contactar", "con_fecha", "aplicado"]);
  });

  it("sin plan devuelve un embudo de ceros y no revienta", () => {
    const s = seguimientoDeRefuerzos(null);
    expect(s.pedidos).toEqual([]);
    expect(s.avanzaron).toBe(0);
    expect(s.esperando).toBe(0);
    expect(s.cuenta.por_contactar).toBe(0);
  });
});
