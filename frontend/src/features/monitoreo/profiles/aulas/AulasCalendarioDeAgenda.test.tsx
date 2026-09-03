import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasCalendarioDeAgenda } from "./AulasCalendarioDeAgenda";

/**
 * La familia del día que toca en el mapa del mes (B57/B58): la primera fecha
 * no pasada CON agenda lleva su anillo, y lo pasado se atenúa — la misma
 * lectura de despliegue que Asignación (B43), Calendario de Carga (B46) y
 * Disponibilidad (B49).
 */
describe("AulasCalendarioDeAgenda — el que toca y lo pasado", () => {
  const html = renderToStaticMarkup(
    <AulasCalendarioDeAgenda
      dias={[
        { fecha: "2026-09-01", aulas: 2, sinEmpezar: 1 },
        { fecha: "2026-09-10", aulas: 1, sinEmpezar: 1 },
      ] as never}
      hoy="2026-09-05"
    />,
  );

  it("la primera fecha con agenda no pasada lleva el anillo y su título", () => {
    expect(html).toContain("es-el-que-toca");
    expect(html).toContain("El día que toca: el despliegue inminente");
    // Y es la del 10, no la pasada del 1.
    expect(html).toMatch(/es-el-que-toca[^>]*>[\s\S]{0,80}>10</);
  });

  it("la fecha pasada se atenúa; hoy no cuenta como pasado", () => {
    expect(html).toContain("es-pasado");
    expect(html).toMatch(/es-pasado[^>]*>[\s\S]{0,80}>1</);
  });
});
