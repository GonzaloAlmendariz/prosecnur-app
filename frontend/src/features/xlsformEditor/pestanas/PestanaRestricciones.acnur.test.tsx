// S4/S5 en la pestaña Restricciones con filas reales del ACNUR. Mata: un check verde «Tiene mensaje» en una fila rota
// (su «mensaje» es su propio nombre), «Validación técnica importada» en vez de decir que está rota, «sólo se evalúan
// en el teléfono» para unas comillas tipográficas, y «Pide corregir» en todas las opciones de Spent_5th.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { acnur } from "../reglas/acnurEs.fixture";
import { LECTURA_FILA_ROTA } from "../reglas/motor";
import { PestanaRestricciones } from "./PestanaRestricciones";

const A = acnur();
const nada = () => {};
const pintar = (seleccionada: string) =>
  renderToStaticMarkup(
    <PestanaRestricciones structure={A.structure} scope={A.base} seleccionada={seleccionada} onSeleccionar={nada} onEditar={nada}
      onCampo={nada} onCampos={nada} catalogs={A.catalogs} />,
  );

describe("Restricciones con el ACNUR", () => {
  it("REG02_Other_recod: dice que la fila está rota y no pone el check de mensaje", () => {
    const html = pintar("REG02_Other_recod");
    expect(html).toContain(LECTURA_FILA_ROTA);
    expect(html).not.toContain("Validación técnica importada");
    expect(html).not.toContain("Tiene mensaje para quien se equivoca");
    expect(html).not.toContain("sólo se evalúan en el teléfono");
  });
  it("IDP01: la prueba no se hace por las comillas tipográficas, y el aviso va aparte", () => {
    const html = pintar("IDP01");
    expect(html).toContain("la regla usa comillas tipográficas");
    expect(html).not.toContain("sólo se evalúan en el teléfono");
  });
  it("Spent_5th: con las demás vacías, ninguna opción pide corregir", () => {
    const html = pintar("Spent_5th");
    expect(html).not.toContain("Pide corregir");
    expect(html).toContain("Se acepta");
  });
});
