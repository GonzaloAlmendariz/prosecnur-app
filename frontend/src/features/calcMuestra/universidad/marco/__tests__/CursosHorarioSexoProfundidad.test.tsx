import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../../api/client";
import { CursosHorarioSexo } from "../CursosHorarioSexo";

/**
 * F29 · Una lista deslizable declara su profundidad y no vuelca el marco entero.
 *
 * Medido en el instrumento: el contenedor tenía 39.899 px de filas dentro de una
 * ventana de 360 px —110 pantallas, 10.278 palabras— porque renderizaba los ~850
 * cursos-horario de una vez. Una lista que hay que recorrer 110 veces no
 * sostiene ninguna decisión, y la barra de scroll no dice cuánto falta.
 */
function frameCon(n: number): CalcMuestraAulasState["frame"] {
  return {
    aula_frame: Array.from({ length: n }, (_, i) => ({
      aula_id: `ch-${i}`,
      faculty: "Derecho",
      curso: `Curso ${i}`,
      eligible_n: 100 - i,
      sexo_hombres: 60 - i,
      sexo_mujeres: 40,
    })),
  } as unknown as CalcMuestraAulasState["frame"];
}

const workspace = {
  version: 2,
  frame_mode: "opinion_universitaria",
  aulas_config: {},
} as unknown as CalcMuestraWorkspace;

function render(n: number) {
  return renderToStaticMarkup(
    <CursosHorarioSexo frame={frameCon(n)} workspace={workspace} />,
  );
}

describe("CursosHorarioSexo — profundidad declarada", () => {
  it("no vuelca cientos de filas: acota la ventana visible", () => {
    const html = render(300);
    const filas = (html.match(/cmv2-ch-sexo-row/g) ?? []).length;
    // La cota es lo que importa, no su valor exacto: nunca cientos de filas.
    expect(filas).toBeLessThanOrEqual(40);
    expect(filas).toBeGreaterThan(0);
  });

  it("dice cuántos hay en total y ofrece verlos", () => {
    const html = render(300);
    expect(html).toContain("cmv2-ch-sexo-depth");
    expect(html).toContain("Ver todos");
    // El total se publica, y es mayor que la ventana: eso es lo que la barra de
    // scroll no decía. El número exacto lo fija el modelo, no este test.
    const pie = html.slice(html.indexOf("cmv2-ch-sexo-depth"));
    const total = Number((pie.match(/([\d.,]+) cursos-horario/) ?? [])[1]?.replace(/[.,]/g, ""));
    expect(total).toBeGreaterThan(40);
  });

  it("una lista que cabe no se anuncia ni se recorta", () => {
    const html = render(8);
    expect((html.match(/cmv2-ch-sexo-row/g) ?? []).length).toBe(8);
    // Sin nada que recortar, el pie de profundidad sobra: sería ruido.
    expect(html).not.toContain("cmv2-ch-sexo-depth");
  });
});
