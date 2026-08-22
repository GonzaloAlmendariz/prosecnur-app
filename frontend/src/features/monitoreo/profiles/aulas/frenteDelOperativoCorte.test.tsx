// «Ya pasaron su fecha» respecto de CUÁNDO.
//
// El panel medía el atraso contra el sello del tablero —a propósito, no contra
// el reloj del navegador— y no nombraba ese día en ninguna parte. En un proyecto
// reabierto días después, «12 de 40 siguen sin parte» es cierto al día del
// sello y ya no al de hoy, y nada en pantalla permitía notarlo.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasPlanRow, MonitoreoRow } from "../../../../api/monitoreo";
import { AulasFrenteDelOperativo } from "./AulasFrenteDelOperativo";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

const render = (corte: string) =>
  renderToStaticMarkup(
    <AulasFrenteDelOperativo
      filas={[
        fila({ operational_code: "CH 1", scheduled_date: "2026-08-11" }),
        fila({ operational_code: "CH 2", scheduled_date: "2026-08-30" }),
      ]}
      partes={[] as ReadonlyArray<MonitoreoRow>}
      corte={corte}
    />,
  );

describe("el frente del operativo nombra su día de corte", () => {
  it("dice contra qué día se mide el atraso", () => {
    const html = render("2026-08-22");
    expect(html).toContain("al 22 de agosto");
  });

  it("el día sale del corte recibido, no del reloj", () => {
    // Si leyera `new Date()`, este aserto cambiaría de resultado cada día.
    expect(render("2026-03-05")).toContain("al 5 de marzo");
  });

  it("un corte ilegible no inventa una fecha", () => {
    // Antes que mostrar «Invalid Date» o el día de hoy, no mostrar nada.
    const html = render("");
    expect(html).not.toContain("al ");
    expect(html).not.toContain("Invalid");
  });

  it("un corte a medias tampoco", () => {
    expect(render("2026-08")).not.toContain("Invalid");
  });
});
