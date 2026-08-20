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

const partes = [
  { faculty: "Derecho", applied_at: "2026-08-10 10:00", effective_surveys: 20, observed_students: 25, operational_code: "CH 1" },
  { faculty: "Arte", applied_at: "2026-08-11 10:00", effective_surveys: 15, observed_students: 20, operational_code: "CH 2" },
] as unknown as MonitoreoRow[];

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

describe("las listas también PONEN el foco, no sólo lo reflejan", () => {
  // Se veía en cinco listas y sólo se podía elegir en una —la pirámide, en su
  // propia pestaña—: quien miraba «A quién hay que agendar» y quería seguir a
  // Derecho tenía que irse a Cuotas, pulsar y volver. Un foco que se ve en cinco
  // sitios y se pone en uno es media función.
  const resumen = [
    { faculty: "Derecho", aulas: 9, meta: 100, brecha: 40, respuestas_validas: 60 },
    { faculty: "Arte", aulas: 5, meta: 80, brecha: 30, respuestas_validas: 50 },
  ];

  it("sin `onFoco` el nombre es texto, no un botón", () => {
    // Las listas que no participen del foco no deben cambiar de semántica.
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad filas={[]} resumen={resumen as never} />,
    );
    expect(html).not.toContain("aulas-foco-boton");
    expect(html).not.toContain("aria-pressed");
  });

  it("con `onFoco` cada nombre es un botón que dice si está pulsado", () => {
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad filas={[]} resumen={resumen as never}
        facultadEnFoco="Derecho" onFoco={() => {}} />,
    );
    expect((html.match(/aulas-foco-boton/g) ?? []).length).toBe(2);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-pressed="false"/g) ?? []).length).toBe(1);
  });

  it("pulsar la que ya está en foco lo SUELTA", () => {
    // Es un interruptor, no una opción de un conjunto: por eso `aria-pressed` y
    // no `aria-selected`. Sin esto no habría forma de volver a verlas todas.
    const recibido: unknown[] = [];
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad filas={[]} resumen={resumen as never}
        facultadEnFoco="Derecho" onFoco={(f) => recibido.push(f)} />,
    );
    // El render estático no dispara clicks; se comprueba el contrato del
    // componente que los construye.
    expect(html).toContain("Dejar de seguir Derecho");
    expect(html).toContain("Seguir Arte en toda la sección");
  });

  it("las lentes que no agrupan por facultad no ponen foco de facultad", () => {
    // Sus filas se llaman «9:01 – 19:00» o «Martes»: poner el foco desde ahí
    // escribiría el nombre de una franja donde va una facultad.
    const html = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={partes} plan={[]}
        clave="franja" unidad="Franja" onFoco={() => {}} />,
    );
    expect(html).not.toContain("aulas-foco-boton");
  });
});
