// S1 en la pestaña Cálculos con filas reales del ACNUR. Mata: «Ninguna pregunta lo lee» para countryname, que
// muestran las etiquetas de IDP01, REF10b y REF16.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { acnur } from "../reglas/acnurEs.fixture";
import { PestanaCalculos } from "./PestanaCalculos";

const A = acnur();
const nada = () => {};

describe("Cálculos con el ACNUR", () => {
  it("countryname: «Lo usan» lista las etiquetas que lo muestran, con dónde", () => {
    const html = renderToStaticMarkup(
      <PestanaCalculos structure={A.structure} scope={A.base} seleccionada="countryname" onSeleccionar={nada} onEditar={nada} onCampo={nada} catalogs={A.catalogs} />,
    );
    expect(html).not.toContain("Ninguna pregunta lo lee");
    expect(html).not.toContain("Ninguna fila lo usa");
    expect(html).toContain("en su etiqueta");
    // M2: sufijo corto; qué opción, en el tooltip y sin `${x}` crudo.
    expect(html).toContain(">en una opción<");
    expect(html).toContain("En la opción «Nunca se ha mudado de casa mientras estaba en «countryname»»");
    expect(html).not.toContain("estaba en ${countryname}");
    expect(html).toContain("El texto de la opción elegida en");
  });
});

describe("S13: la tarjeta Fórmula lee la fórmula y el contador no deja cálculos fuera", () => {
  const pintar = (seleccionada: string) => renderToStaticMarkup(
    <PestanaCalculos structure={A.structure} scope={A.base} seleccionada={seleccionada} onSeleccionar={nada} onEditar={nada} onCampo={nada} catalogs={A.catalogs} />,
  );
  it("countryname (choice-name): la fórmula se lee y la prueba dice por qué se calcula en el teléfono", () => {
    const html = pintar("countryname");
    expect(html).toContain("El texto de la opción elegida en");
    expect(html).toContain("Editar la fórmula");
    expect(html).toContain("Se calcula en el teléfono: toma el texto de la opción elegida");
    expect(html).not.toContain("usa funciones que el editor no evalúa");
  });
});
