import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CriterioSeleccion, CriterioVariable } from "../../../../../api/client";
import { ExcepcionesFacultad } from "../facultades";

const variable = {
  id: "modality",
  label: "Modalidad",
  kind: "flat",
  categories: [
    { key: "presencial", label: "Presencial" },
    { key: "virtual", label: "Virtual" },
  ],
} as unknown as CriterioVariable;

const facultades = [
  { key: "derecho", label: "Derecho" },
  { key: "ing", label: "Ingeniería" },
  { key: "salud", label: "Salud" },
];

function render(sel: CriterioSeleccion) {
  return renderToStaticMarkup(
    <ExcepcionesFacultad
      variable={variable}
      sel={sel}
      facultades={facultades}
      onSel={() => {}}
    />,
  );
}

describe("ExcepcionesFacultad — F24: el criterio se decide por facultad", () => {
  // La regla de producto: «absolutamente toda la información de criterios es por
  // facultad… debe permitir escoger cada criterio no a nivel general sino a
  // nivel de criterio por facultad». Antes esto era un alta genérica detrás de
  // un toggle cerrado: para actuar había que saber de antemano qué facultad se
  // desviaba, que es justo lo que se viene a averiguar.
  it("lista todas las facultades, no solo las que ya tienen criterio propio", () => {
    const html = render({ mode: "include", categories: ["presencial"] });
    for (const fac of facultades) expect(html).toContain(fac.label);
    expect((html.match(/cmv2-crit-exc-item/g) ?? [])).toHaveLength(facultades.length);
  });

  it("cada facultad publica qué aplica y de dónde viene", () => {
    const html = render({
      mode: "include",
      categories: ["presencial"],
      exceptions: { ing: { categories: ["virtual"], op: "replace" } },
    });
    // La que hereda muestra el set general y se rotula «general».
    expect(html).toContain("Presencial");
    // La que decidió distinto muestra el suyo y se distingue en el marcado.
    expect(html).toContain("Virtual");
    expect(html).toContain('data-propio="true"');
    expect((html.match(/data-propio="false"/g) ?? [])).toHaveLength(2);
  });

  it("cuenta cuántas facultades se apartaron del criterio general", () => {
    expect(render({ mode: "include", categories: ["presencial"] })).toContain(
      "las 3 aplican el criterio general",
    );
    expect(
      render({
        mode: "include",
        categories: ["presencial"],
        exceptions: { ing: { categories: ["virtual"], op: "replace" } },
      }),
    ).toContain("1 de 3 con criterio propio");
  });
});
