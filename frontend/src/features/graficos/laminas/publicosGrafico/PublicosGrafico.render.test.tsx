// Q2-11: «Públicos» pintado: una ficha por base («Docentes, todas las de escala») con sus flechas y su quitar, el
// selector para agregar las que faltan y, en Fortalezas, cambiar de público en vez de sumar otro. Ningún selector de
// pregunta vacío.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [{ name: "docentes", variables: [] }, { name: "estudiantes", variables: [] }, { name: "administrativos", variables: [] }] }),
}));

import { PublicosGrafico } from "./PublicosGrafico";

const pintar = (valor: unknown, graficador = "p_panorama") =>
  renderToStaticMarkup(<PublicosGrafico id="x" graficador={graficador} valor={valor} onCambio={() => undefined} />);

describe("PublicosGrafico", () => {
  it("una ficha por público, ordenable y con quitar; agrega las bases que faltan", () => {
    const html = pintar(["estudiantes$*", "docentes$*"]);
    expect(html.indexOf("Estudiantes")).toBeLessThan(html.indexOf("Docentes"));
    expect(html).toContain("todas las de escala");
    expect(html).toContain('aria-label="Mover Estudiantes después"');
    expect(html).toContain('aria-label="Quitar Docentes"');
    expect(html).toContain("Agregar público");
    expect(html).not.toContain("Elige una pregunta");
  });

  it("en Fortalezas, un solo público que se cambia", () => {
    const html = pintar(["docentes$*"], "p_fortalezas");
    expect(html).toContain("Cambiar de público");
    expect(html).not.toContain("Quitar Docentes");
  });

  it("las preguntas sueltas se cuentan y se dejan a la regla", () => {
    expect(pintar(["docentes$*", "docentes$p4", "docentes$p5"])).toContain("Además, 2 preguntas sueltas: se ajustan en la regla");
  });
});
