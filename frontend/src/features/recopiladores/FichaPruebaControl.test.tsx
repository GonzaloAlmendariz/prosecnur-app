import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FichaPruebaControl } from "./FichaPruebaControl";

// Este archivo mira el MARKUP que sale de verdad, no el código fuente del
// componente. Los tests de `fichasDenominador.test.ts` leen el fuente de
// `MaterialsSection` con grep, y un control puede estar escrito y no llegar a
// pintarse —por una rama de carga, por un `return` anterior— sin que ese grep se
// entere. Por eso el control vive en su propio archivo: para poder renderizarlo.

function render(props: Partial<Parameters<typeof FichaPruebaControl>[0]> = {}) {
  return renderToStaticMarkup(
    <FichaPruebaControl
      codigo=""
      onCodigo={() => {}}
      onGenerar={() => {}}
      motivoBloqueo={null}
      listo
      ocupado={false}
      {...props}
    />,
  );
}

describe("la ficha de prueba en pantalla", () => {
  it("tiene su campo, su rótulo y su botón", () => {
    const markup = render();
    expect(markup).toContain("Ficha de prueba");
    expect(markup).toContain('placeholder="PRUEBA_2026"');
    expect(markup).toContain('aria-label="Código de la ficha de prueba"');
    expect(markup).toContain("Generar");
  });

  it("dice que no entra al plan, y con qué códigos", () => {
    // Es una hoja que NO se reparte. Si pareciera un formato más del paquete,
    // alguien la imprimiría con el lote y se aplicaría un aula entera contra un
    // colector que no existe en el plan.
    const markup = render();
    expect(markup).toContain("No entra al plan");
    expect(markup).toContain("CAPACITACION");
    expect(markup).toContain("prueba_interna");
  });

  it("nace apagado: sin código no hay nada que generar", () => {
    // Pulsarlo vacío dispararía una petición que el backend rechaza con 422. El
    // bloqueo va delante, no en el mensaje de error.
    expect(render({ codigo: "" })).toContain("disabled");
    expect(render({ codigo: "   " })).toContain("disabled");
    expect(render({ codigo: "PRUEBA_2026" })).not.toContain("disabled");
  });

  it("se apaga sin accesos preparados y mientras hay un render en curso", () => {
    expect(render({ codigo: "PRUEBA_2026", listo: false })).toContain("disabled");
    expect(render({ codigo: "PRUEBA_2026", ocupado: true })).toContain("disabled");
  });

  it("un botón apagado dice por qué lo está, en su sitio", () => {
    // El motivo compartido con los tres botones de formato manda; el propio
    // —no hay código— sólo aparece cuando no hay otro bloqueo.
    const sinAccesos = render({ codigo: "PRUEBA_2026", listo: false, motivoBloqueo: "La ficha no tiene enlace que codificar." });
    expect(sinAccesos).toContain("La ficha no tiene enlace que codificar.");

    const sinCodigo = render({ codigo: "" });
    expect(sinCodigo).toContain("Escribe un código para la ficha");
  });
});
