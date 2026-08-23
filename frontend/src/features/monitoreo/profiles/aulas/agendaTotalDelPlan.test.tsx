// «Ninguno de los 42 cursos-horario tiene fecha de aplicación» — sobre un plan
// de 686.
//
// `course_status` se topea a 500 filas antes de salir del backend y trae el
// banco mezclado, así que al filtrar el banco en el cliente quedaban 42. El
// aviso contaba lo que había llegado y lo llamaba «los N cursos-horario»:
// presentaba un recorte de payload como si fuera el universo.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasAgendaPorDia } from "./AulasAgendaPorDia";

const filas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ operational_code: `CH ${i + 1}` })) as MonitoreoAulasPlanRow[];

describe("la agenda no confunde lo que le llegó con el plan", () => {
  it("dice el total del plan, no las filas recibidas", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia filas={filas(42)} totalDelPlan={686} />,
    );
    expect(html).toContain("Ninguno de los 686 cursos-horario");
    expect(html).not.toContain("Ninguno de los 42");
  });

  it("y avisa de que está dibujando sólo una parte", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia filas={filas(42)} totalDelPlan={686} />,
    );
    expect(html).toContain("dibuja los 42 que caben");
  });

  it("cuando llegó el plan entero no habla de partes", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia filas={filas(686)} totalDelPlan={686} />,
    );
    expect(html).toContain("Ninguno de los 686 cursos-horario");
    expect(html).not.toContain("que caben");
  });

  it("sin total declarado se comporta como antes", () => {
    // Un dashboard viejo no trae `course_status_total_plan`: ahí lo contado es
    // lo único que hay, y es mejor que no decir nada.
    const html = renderToStaticMarkup(<AulasAgendaPorDia filas={filas(42)} />);
    expect(html).toContain("Ninguno de los 42 cursos-horario");
  });
});
