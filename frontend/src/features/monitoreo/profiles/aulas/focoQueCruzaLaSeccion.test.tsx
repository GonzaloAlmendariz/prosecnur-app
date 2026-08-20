import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";

vi.mock("../../../../lib/PlotlyChart", () => ({ PlotlyChart: () => null }));

const { AulasPerfilPorFacultad } = await import("./AulasPerfilPorFacultad");
const { AulasRendimientoPorFacultad } = await import("./AulasRendimientoPorFacultad");
const { AulasRitmoPorFacultad } = await import("./AulasRitmoPorFacultad");

/**
 * `foco` es una dimensión declarada de la gramática de navegación —viaja en la
 * URL como `?foco=facultad:Derecho`— y lo obedecía **una sola superficie**: la
 * tabla de cuotas. El perfil tiene seis listas de las mismas veinte facultades,
 * así que para saber cómo iba Derecho había que cazar su fila seis veces.
 *
 * Resalta y NO filtra: estas listas son rankings y dejarlas en una sola fila
 * destruiría lo único que aportan, que es dónde cae esa facultad entre las
 * otras. El detalle se filtra; el control, no.
 */

const cuantas = (html: string) => (html.match(/es-en-foco/g) ?? []).length;

describe("el foco cruza la sección y resalta sin filtrar", () => {
  const resumen = [
    { faculty: "Derecho", aulas: 9, meta: 100, brecha: 40, respuestas_validas: 60 },
    { faculty: "Arte", aulas: 5, meta: 80, brecha: 30, respuestas_validas: 50 },
  ];

  it("«Dónde falta más» marca la facultad enfocada y sólo esa", () => {
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad filas={[]} resumen={resumen as never} facultadEnFoco="Derecho" />,
    );
    expect(cuantas(html)).toBe(1);
    // Y no filtra: las dos siguen ahí.
    expect(html).toContain("Derecho");
    expect(html).toContain("Arte");
  });

  it("sin foco no marca ninguna", () => {
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad filas={[]} resumen={resumen as never} />,
    );
    expect(cuantas(html)).toBe(0);
  });

  it("una facultad que no está en la lista no marca nada", () => {
    // El foco puede venir de la URL apuntando a algo que esta lista no tiene.
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad filas={[]} resumen={resumen as never} facultadEnFoco="Inexistente" />,
    );
    expect(cuantas(html)).toBe(0);
  });

  const partes = [
    { faculty: "Derecho", applied_at: "2026-08-10 10:00", effective_surveys: 20, observed_students: 25, operational_code: "CH 1" },
    { faculty: "Arte", applied_at: "2026-08-11 10:00", effective_surveys: 15, observed_students: 20, operational_code: "CH 2" },
  ] as unknown as MonitoreoRow[];

  it("«Encuestas por día de cada facultad» también", () => {
    const html = renderToStaticMarkup(
      <AulasRitmoPorFacultad partes={partes} facultadEnFoco="Arte" />,
    );
    expect(cuantas(html)).toBe(1);
  });

  it("«Qué está rindiendo más» marca sólo cuando agrupa POR FACULTAD", () => {
    const porFacultad = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={partes} plan={[]} facultadEnFoco="Derecho" />,
    );
    expect(cuantas(porFacultad)).toBe(1);
  });

  it("y no pinta una fila que sólo COINCIDE de nombre con el foco", () => {
    // El caso que hace falta el guard: agrupado por franja, las filas se llaman
    // «9:01 – 19:00», no «Derecho». Si el foco valiera ese texto —o si algún día
    // una facultad se llamara como una franja— sin `clave === "faculty"` se
    // pintaría una fila que no es una facultad.
    //
    // La primera versión de este test comparaba con `facultadEnFoco="Derecho"`
    // sobre filas de franja, donde NINGUNA se llama así: pasaba con y sin guard,
    // o sea que no probaba nada. Lo destapó un mutante que sobrevivió.
    const porFranja = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={partes} plan={[]}
        clave="franja" unidad="Franja" facultadEnFoco="9:01 – 19:00" />,
    );
    expect(cuantas(porFranja)).toBe(0);
  });
});
