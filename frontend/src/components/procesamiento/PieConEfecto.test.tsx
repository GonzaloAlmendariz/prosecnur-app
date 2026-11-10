import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PieConEfecto } from "./PieConEfecto";

describe("PieConEfecto", () => {
  test("la línea de efecto va antes de las acciones y se anuncia al cambiar", () => {
    const html = renderToStaticMarkup(
      <PieConEfecto cifra={3} efecto="valores quedan vacíos en el año de egreso.">
        <button type="button">Omitir</button>
        <button type="button">Guardar y seguir</button>
      </PieConEfecto>,
    );
    expect(html).toBe(
      '<footer class="pulso-pie-efecto">' +
        '<p class="pulso-pie-efecto-linea" aria-live="polite"><b class="pulso-pie-efecto-cifra">3</b><span>valores quedan vacíos en el año de egreso.</span></p>' +
        '<div class="pulso-pie-efecto-acciones"><button type="button">Omitir</button><button type="button">Guardar y seguir</button></div>' +
        "</footer>",
    );
  });

  test("una cifra numérica sale con separador de millares; una escrita, tal cual", () => {
    const numero = renderToStaticMarkup(<PieConEfecto cifra={1234} efecto="casos dejan de contar."><button type="button">Guardar</button></PieConEfecto>);
    const escrita = renderToStaticMarkup(<PieConEfecto cifra="2 de 7" efecto="casos dejan de contar."><button type="button">Guardar</button></PieConEfecto>);
    expect(numero).toContain('<b class="pulso-pie-efecto-cifra">1,234</b>');
    expect(escrita).toContain('<b class="pulso-pie-efecto-cifra">2 de 7</b>');
  });

  test("sin cifra no se pinta el número y la línea lo declara", () => {
    const html = renderToStaticMarkup(<PieConEfecto efecto="Nada cambia en la base."><button type="button">Cerrar</button></PieConEfecto>);
    expect(html).not.toContain("pulso-pie-efecto-cifra");
    expect(html).toContain('data-sin-cifra=""');
    expect(html).toContain("<span>Nada cambia en la base.</span>");
  });
});
