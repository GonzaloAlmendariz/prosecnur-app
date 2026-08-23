// La hoja de «Base de control» ya avisaba de sus columnas sin nombre; la de
// agenda no avisaba de nada. Si el equipo renombra una columna en el Sheets
// —«TELEFONO DE DOCENTE» pasa a «CELULAR»— el campo se lee vacío y nadie se
// entera, y ése es el dato con el que se agenda.
//
// El aviso NOMBRA los campos en vez de contarlos: «falta el teléfono del
// docente» se puede arreglar; «faltan 2 campos» manda a buscarlos.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoSource } from "../../../../api/monitoreo";
import { AulasFuentesDelEstudio, type ReciboDelLibro } from "./AulasFuentesDelEstudio";

const recibo = (campos?: string[]): ReciboDelLibro => ({
  importado_en: "2026-08-22T10:00:00Z",
  hojas: [{ hoja: "Aulas Agendadas", vino: true }],
  hojas_ausentes: 0,
  control_sin_nombre: 0,
  ...(campos ? { agenda_campos_ausentes: campos } : {}),
});

const render = (libro: ReciboDelLibro) =>
  renderToStaticMarkup(
    <AulasFuentesDelEstudio
      fuentes={[] as ReadonlyArray<MonitoreoSource>}
      anonimas={false}
      libro={libro}
      filas={0}
      columnas={0}
    />,
  );

describe("la hoja de agenda declara los campos que no bautiza", () => {
  it("nombra el campo con la palabra del equipo, no con la clave técnica", () => {
    const html = render(recibo(["teacher_phone"]));
    expect(html).toContain("el teléfono del docente");
    expect(html).toContain("se leen vacías");
    // Nombrar, no contar.
    expect(html).not.toContain("1 campo");
  });

  it("con varios los enumera", () => {
    const html = render(recibo(["teacher", "faculty"]));
    expect(html).toContain("el nombre del docente");
    expect(html).toContain("la facultad");
  });

  it("un campo sin rótulo cae a su clave en vez de desaparecer", () => {
    // Preferible una clave técnica visible a un aviso que se traga el campo.
    const html = render(recibo(["campo_nuevo_sin_rotulo"]));
    expect(html).toContain("campo_nuevo_sin_rotulo");
  });

  it("sin campos ausentes no ensucia la tarjeta", () => {
    expect(render(recibo([]))).not.toContain("se leen vacías");
    // Y un recibo viejo, sin el campo, tampoco rompe ni avisa.
    expect(render(recibo())).not.toContain("se leen vacías");
  });
});

// Un recibo sin `hojas` tumbaba la aplicación entera.
//
// `LibroDelOperativo` hacía `recibo.hojas.map(...)` a ciegas. Justo después de
// importar el plan desde Cálculo de muestra —cuando todavía no hay dashboard y
// el libro llega en su forma cruda— eso reventaba con «Cannot read properties of
// undefined (reading 'length')» y la pantalla de «La aplicación se detuvo por un
// error». Visto en la app con el proyecto real.
describe("el recibo del libro tolera venir a medias", () => {
  const sinHojas = { importado_en: "2026-08-22T10:00:00Z", hojas_ausentes: 0, control_sin_nombre: 0 };

  it("sin `hojas` no revienta y no inventa un denominador", () => {
    const html = renderToStaticMarkup(
      <AulasFuentesDelEstudio
        fuentes={[] as ReadonlyArray<MonitoreoSource>}
        anonimas={false}
        libro={sinHojas as unknown as ReciboDelLibro}
        filas={0}
        columnas={0}
      />,
    );
    expect(html).toContain("hojas sin registrar todavía");
    // «0 de 3» sería peor que no decir nada: afirma que faltan las tres.
    expect(html).not.toContain("0 de 3 hojas");
  });

  it("con `hojas` sigue contando como siempre", () => {
    const html = renderToStaticMarkup(
      <AulasFuentesDelEstudio
        fuentes={[] as ReadonlyArray<MonitoreoSource>}
        anonimas={false}
        libro={{ ...sinHojas, hojas_ausentes: 1, hojas: [
          { hoja: "Aulas Agendadas", vino: true },
          { hoja: "Aulas Aplicadas (Campo)", vino: true },
          { hoja: "Base de control", vino: false },
        ] } as ReciboDelLibro}
        filas={0}
        columnas={0}
      />,
    );
    expect(html).toContain("2 de 3 hojas");
  });
});
