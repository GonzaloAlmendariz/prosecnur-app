import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasSexoYDescartes, sugerenciasDeDescarte } from "./AulasSexoYDescartes";

/**
 * A5 (loop estética-aulas-sheets, 2026-09-08). El 07/09 el criterio de
 * validez se declaró POR API: `sex_female_values`, `sex_male_values` y los
 * `descartes` por collectorID (CAPACITACION, PRUEBA_2026, INTERNOPULSO). Sin
 * UI, el próximo estudio repite el día 1 de éste: cuenta enviadas como
 * efectivas y deja las treinta celdas de cuota en cero. Esto es la pantalla.
 */
describe("sugerenciasDeDescarte", () => {
  it("propone los valores del colector que no casan con ningún curso-horario del plan", () => {
    const s = sugerenciasDeDescarte(
      ["CH 1", "ch 2", "CAPACITACION", "PRUEBA_2026", "R 4.1", "INTERNOPULSO", ""],
      ["CH 1", "CH 2", "R 4.1"],
    );
    expect(s).toEqual(["CAPACITACION", "INTERNOPULSO", "PRUEBA_2026"]);
  });
  it("no repite lo ya descartado", () => {
    expect(sugerenciasDeDescarte(["CAPACITACION", "PRUEBA_2026"], [], ["PRUEBA_2026"])).toEqual(["CAPACITACION"]);
  });
});

describe("AulasSexoYDescartes", () => {
  const base = {
    variableDeSexo: "sexo",
    valoresDeLaVariable: ["1", "2", "3"],
    mujeres: ["1"],
    hombres: ["2"],
    descartes: ["CAPACITACION"],
    sugerencias: ["PRUEBA_2026"],
    onValoresDeSexo: () => {},
    onDescartes: () => {},
  };

  it("enseña qué valor cuenta como mujeres y cuál como hombres, y el que falta por asignar", () => {
    const html = renderToStaticMarkup(<AulasSexoYDescartes {...base} />);
    expect(html).toContain("Cuentan como mujeres");
    expect(html).toContain("Cuentan como hombres");
    expect(html).toMatch(/aria-pressed="true"[^>]*>1</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>2</);
    expect(html).toContain("«3» no cuenta en ningún sexo");
  });

  it("sin variable de sexo declarada lo dice y no inventa valores", () => {
    const html = renderToStaticMarkup(<AulasSexoYDescartes {...base} variableDeSexo="" valoresDeLaVariable={[]} />);
    expect(html).toContain("Declara primero la variable que dice el sexo");
    expect(html).not.toContain("Cuentan como mujeres");
  });

  it("los descartes se ven con su causa, y las sugerencias se ofrecen con un click", () => {
    const html = renderToStaticMarkup(<AulasSexoYDescartes {...base} />);
    expect(html).toContain("Fuera del operativo");
    expect(html).toContain("CAPACITACION");
    expect(html).toContain("PRUEBA_2026");
    expect(html).toMatch(/no casan con ning[uú]n curso-horario/);
  });

  it("sin callbacks es de solo lectura: no hay botones", () => {
    const html = renderToStaticMarkup(<AulasSexoYDescartes {...base} onValoresDeSexo={null} onDescartes={null} />);
    expect(html).not.toContain("<button");
    expect(html).toContain("CAPACITACION");
  });

  it("sin em dashes", () => {
    expect(renderToStaticMarkup(<AulasSexoYDescartes {...base} />)).not.toContain("—");
  });
});
