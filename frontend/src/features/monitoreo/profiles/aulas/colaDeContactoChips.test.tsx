import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasColaDeContacto } from "./AulasColaDeContacto";

/**
 * Sistema Pabellón en la cola de contacto (B33/P3): la celda «Día y hora» de
 * las citas fijadas lleva la hora como chip — es la identidad del compromiso.
 * El resto de la tabla queda en su peso: densidad manda.
 */

const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    operational_code: "CH 3",
    faculty: "DERECHO",
    teacher: "R. QUISPE",
    sample_role: "titular",
    sample_status: "agendada",
    operational_status: "agendada",
    scheduled_date: "2026-09-03",
    scheduled_time: "11:00",
    ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

// Una pendiente acompaña a la citada: sin cola el panel entero cae a su rama
// vacía y la tabla de citas ni se pinta (comportamiento previo del panel).
const PENDIENTE = fila({
  operational_code: "CH 9",
  sample_status: "sin contactar",
  operational_status: "planificada",
  scheduled_date: "",
  scheduled_time: "",
});

describe("las citas fijadas llevan su hora como chip", () => {
  it("la celda de la cita pinta el chip de hora", () => {
    const html = renderToStaticMarkup(
      <AulasColaDeContacto filas={[fila({}), PENDIENTE]} />,
    );
    expect(html).toContain("aulas-cola-cita");
    expect(html).toContain("aulas-chip-hora");
    expect(html).toContain("11:00");
  });

  it("una cita sin hora no pinta chip vacío", () => {
    const html = renderToStaticMarkup(
      <AulasColaDeContacto filas={[fila({ scheduled_time: "" }), PENDIENTE]} />,
    );
    expect(html).not.toContain("aulas-chip-hora");
  });
});
