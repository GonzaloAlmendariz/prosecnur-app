import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasObservacionesDeCampo } from "./AulasObservacionesDeCampo";

/**
 * Los techos revocados (B33/P7, principio 3 del Sistema Pabellón): jamás
 * «…y N más» — la lista se organiza, no se esconde. El panel recortaba los
 * códigos a 6 con contador y las observaciones a las 12 más repetidas; ahora
 * todo se pinta y la sección scrollea, que para eso es suya.
 */

const parte = (codigo: string, nota: string) => ({
  operational_code: codigo,
  field_note: nota,
  applied_by: "Equipo A",
  faculty: "Derecho",
});

describe("las listas de observaciones no tienen techo", () => {
  it("una observación repetida enseña TODOS sus códigos, sin «y N más»", () => {
    const partes = Array.from({ length: 9 }, (_, i) => parte(`CH ${i + 1}`, "El docente pide empezar al final"));
    const html = renderToStaticMarkup(
      <AulasObservacionesDeCampo partes={partes} />,
    );
    for (let i = 1; i <= 9; i += 1) expect(html).toContain(`CH ${i}`);
    expect(html).not.toContain("más</");
    expect(html).not.toMatch(/y \d+ más/);
  });

  it("todas las observaciones distintas se pintan, no sólo doce", () => {
    const partes = Array.from({ length: 15 }, (_, i) => parte(`CH ${i + 1}`, `Nota distinta número ${i + 1}`));
    const html = renderToStaticMarkup(
      <AulasObservacionesDeCampo partes={partes} />,
    );
    for (let i = 1; i <= 15; i += 1) expect(html).toContain(`Nota distinta número ${i}`);
    expect(html).not.toContain("más repetidas");
  });
});
