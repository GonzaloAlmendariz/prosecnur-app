import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasAgendaPorDia } from "./AulasAgendaPorDia";

/**
 * `course_status` viaja topeado a 500 filas. La franja de la agenda contaba
 * «sin fecha» y el reparto sobre lo que cupo y lo presentaba como si fuera el
 * plan: medido sobre HSVG2026, decía **«355 sin fecha»** mientras el tile de al
 * lado decía **«Por agendar 29»**. 355 es exactamente 500 − 145, y 96 + 78 +
 * 326 de la leyenda suman exactamente 500.
 *
 * No se repara el conteo —la vista no tiene las filas que no llegaron— sino la
 * afirmación: se declara sobre cuántas está contado.
 */
const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

const filas = [
  fila({ operational_code: "CH 1", scheduled_date: "2026-09-07", sample_role: "titular" }),
  fila({ operational_code: "CH 2", scheduled_date: "2026-09-08", sample_role: "titular" }),
  fila({ operational_code: "CH 3", sample_role: "titular" }),
];

describe("la franja de la agenda declara si está contada sobre un payload recortado", () => {
  it("lo dice cuando llegaron menos filas de las que hay", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia filas={filas} totalDelPlan={174} recorte={{ recibidas: 500, total: 1512 }} />,
    );
    expect(html).toContain("contado sobre");
    expect(html).toContain("500");
    expect(html).toContain("1,512");
  });

  it("NO lo dice cuando el payload trae el plan entero", () => {
    // Un aviso permanente de recorte sobre un plan completo entrena a no leerlo.
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia filas={filas} totalDelPlan={3} recorte={{ recibidas: 3, total: 3 }} />,
    );
    expect(html).not.toContain("contado sobre");
  });

  it("sin información de recorte no inventa un aviso", () => {
    const html = renderToStaticMarkup(<AulasAgendaPorDia filas={filas} totalDelPlan={3} />);
    expect(html).not.toContain("contado sobre");
  });

  it("el aviso NO sustituye al conteo: «sin fecha» se sigue diciendo", () => {
    // La reparación es declarar, no callar. Quitar la cifra dejaría la franja
    // sin lo que resume.
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia filas={filas} totalDelPlan={174} recorte={{ recibidas: 500, total: 1512 }} />,
    );
    expect(html).toContain("sin fecha");
  });
});
