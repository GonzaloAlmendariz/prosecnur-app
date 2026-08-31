import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasOperationsPanel } from "./AulasOperationsPanel";

/**
 * El tercer botón: leer el libro desde el Sheets.
 *
 * Se verifica por render y no por captura a propósito. Un botón no necesita
 * layout para probarse, y el runner visual depende de que la máquina esté
 * descargada —el día que se escribió esto no alcanzaba readiness ni con los
 * cambios fuera—. Un test de markup fija además el comportamiento, que una
 * captura no hace.
 */

type Props = Parameters<typeof AulasOperationsPanel>[0];

// `as never` en el spread no compila —«Spread types may only be created from
// object types»— y `as Props` obligaria a construir un config entero. Se tipa
// el parcial y se ensancha en la llamada, que es donde el compilador ya sabe
// que las obligatorias estan puestas.
function pintar(props: Partial<Props> = {}) {
  const base = {
    config: {} as Props["config"],
    sources: [] as Props["sources"],
    busy: false,
    onImportPlan: () => {},
    onSyncField: () => {},
    onGenerarLibro: () => {},
    onImportarLibro: () => {},
  };
  return renderToStaticMarkup(<AulasOperationsPanel {...base} {...props} />);
}

describe("AulasOperationsPanel — leer del Sheets", () => {
  it("ofrece el botón cuando hay con qué leer", () => {
    expect(pintar({ onLeerDeSheets: () => {} })).toContain("Leer del Sheets");
  });

  it("no lo ofrece si nadie sabe atenderlo", () => {
    // Un botón que no hace nada enseña a desconfiar de los botones. La prop es
    // opcional para que una superficie que no conecte el handler no lo pinte.
    expect(pintar()).not.toContain("Leer del Sheets");
  });

  it("va junto a las otras dos formas de traer el libro, no en un panel aparte", () => {
    // Son tres formas de la MISMA operación —traer al operativo lo que el
    // equipo escribió— y separarlas obligaría a saber de antemano cuál toca.
    const html = pintar({ onLeerDeSheets: () => {} });
    const generar = html.indexOf("Generar libro");
    const archivo = html.indexOf("Leer libro llenado");
    const sheets = html.indexOf("Leer del Sheets");
    expect(generar).toBeGreaterThan(-1);
    expect(archivo).toBeGreaterThan(generar);
    expect(sheets).toBeGreaterThan(archivo);
  });
});
