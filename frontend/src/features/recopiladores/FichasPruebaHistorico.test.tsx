import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CollectionFichaPrueba } from "../../api/recopiladores";
import { FichasPruebaHistorico } from "./FichasPruebaHistorico";

const ENLACE = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm?d%5B/aNNu/collectorID%5D=CAPACITACION";

function ficha(over: Partial<CollectionFichaPrueba> = {}): CollectionFichaPrueba {
  return {
    codigo: "CAPACITACION",
    etiqueta: "CAPACITACION",
    enlace: ENLACE,
    creada_en: "2026-08-27T10:00:00Z",
    vigente: true,
    ...over,
  };
}

function render(fichas: CollectionFichaPrueba[], ocupado = false) {
  return renderToStaticMarkup(
    <FichasPruebaHistorico fichas={fichas} onPdf={() => {}} ocupado={ocupado} />,
  );
}

describe("el histórico de fichas de prueba", () => {
  it("no ocupa sitio cuando no hay ninguna", () => {
    // Una sección vacía con su título sería un hueco pautado sobre nada.
    expect(render([])).toBe("");
  });

  it("da las tres cosas que se piden de una ficha ya hecha", () => {
    // Abrir el enlace, copiarlo y volver a bajar el PDF. Sin esto había que
    // acordarse del código y regenerarla a ciegas para saber qué llevaba.
    const markup = render([ficha()]);
    expect(markup).toContain("CAPACITACION");
    expect(markup).toContain(`href="${ENLACE.replace(/&/g, "&amp;")}"`);
    expect(markup).toContain("Abrir");
    expect(markup).toContain("Copiar");
    expect(markup).toContain("PDF");
  });

  it("marca la que quedó de un despliegue anterior", () => {
    // Su enlace sigue sirviendo para la hoja ya repartida, pero NO es el que se
    // genera hoy. Callarlo sería enseñar un enlace muerto como si estuviera
    // vigente.
    const markup = render([ficha({ vigente: false })]);
    expect(markup).toContain("de un despliegue anterior");
    expect(markup).toContain("is-desfasada");

    const vigente = render([ficha()]);
    expect(vigente).not.toContain("de un despliegue anterior");
    expect(vigente).not.toContain("is-desfasada");
  });

  it("enseña la etiqueta sólo cuando dice algo distinto del código", () => {
    // Con etiqueta igual al código, repetirla es ruido. Se mira el `<em>` que la
    // lleva y no el conteo del texto: el código aparece además dentro del enlace
    // y del title, así que contarlo diría siempre que sí.
    expect(render([ficha({ etiqueta: "Taller 12 de agosto" })])).toContain("<em>Taller 12 de agosto</em>");
    expect(render([ficha()])).not.toContain("<em>");
  });

  it("no deja regenerar mientras hay un render en curso", () => {
    expect(render([ficha()], true)).toContain("disabled");
    expect(render([ficha()], false)).not.toContain("disabled");
  });

  it("lista cada código una sola vez, en su fila", () => {
    const markup = render([ficha(), ficha({ codigo: "PRUEBA_2026", etiqueta: "PRUEBA_2026" })]);
    expect(markup.match(/<li/g) ?? []).toHaveLength(2);
  });
});
