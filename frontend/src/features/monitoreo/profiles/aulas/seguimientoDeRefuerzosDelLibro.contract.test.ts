import { describe, expect, it } from "vitest";

import { seguimientoDeRefuerzos } from "./seguimientoDeRefuerzos";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (p: Record<string, unknown>) => p as unknown as MonitoreoAulasPlanRow;

/**
 * **Un refuerzo recuperado del Sheets sigue siendo un refuerzo.**
 *
 * Al publicar sólo viaja STATUS MUESTRA, así que `activation_origin` —el sello
 * que pone la app al marcar— se queda en la sesión. El panel filtraba sólo por
 * ese sello y descartaba lo que volvía del libro.
 *
 * Medido el 2026-09-12 sobre el operativo real: los 15 refuerzos recuperados
 * llegaron con `activation_origin` vacío los 15, y la pestaña Refuerzos ofrecía
 * «marcar los 15 mejores» como si no hubiera ninguno pedido.
 */
describe("los refuerzos que vuelven del libro se ven", () => {
  it("sin sello pero con estado de refuerzo, entra", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "EXTRA 10", sample_status: "refuerzo_por_contactar", activation_origin: "" }),
    ]);
    expect(s.pedidos).toHaveLength(1);
    expect(s.pedidos[0]?.paso).toBe("por_contactar");
  });

  it("dice que vino del libro, no inventa un sello", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 161.5", sample_status: "refuerzo_por_contactar", activation_origin: "" }),
    ]);
    expect(s.pedidos[0]?.origen).toBe("libro");
  });

  it("el sello de la app sigue mandando cuando está", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 1", sample_status: "refuerzo_por_contactar", activation_origin: "complemento" }),
    ]);
    expect(s.pedidos[0]?.origen).toBe("complemento");
  });

  it("los 15 del operativo entran todos", () => {
    const codigos = ["EXTRA 10", "EXTRA 11", "EXTRA 15", "EXTRA 17", "EXTRA 23", "EXTRA 31",
      "EXTRA 34", "EXTRA 35", "EXTRA 36", "R 109.1", "R 135.3", "R 161.5", "R 161.6", "R 161.8", "R 75.6"];
    const s = seguimientoDeRefuerzos(codigos.map((c) =>
      fila({ operational_code: c, sample_status: "REFUERZO POR CONTACTAR", activation_origin: "" })));
    // Y en la forma del LIBRO, con espacios y mayúsculas: es como llega de verdad.
    expect(s.pedidos).toHaveLength(15);
    expect(s.cuenta.por_contactar).toBe(15);
  });

  it("un aula normal NO entra por la puerta nueva, aunque esté agendada", () => {
    // La razón de que el sello existiera: `agendada` o `en_contacto` los tiene
    // cualquiera de las 1.392, y admitirlos convertiría el panel en el plan.
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "CH 1", sample_status: "agendada", activation_origin: "" }),
      fila({ operational_code: "CH 2", sample_status: "en_contacto", activation_origin: "" }),
      fila({ operational_code: "CH 3", sample_status: "sin_contactar", activation_origin: "" }),
    ]);
    expect(s.pedidos).toHaveLength(0);
  });
});
