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
    expect(html).toContain("en la opción «Nunca se ha mudado de casa mientras estaba en ${countryname}»");
    expect(html).toContain("El texto de la opción elegida en");
  });
});
