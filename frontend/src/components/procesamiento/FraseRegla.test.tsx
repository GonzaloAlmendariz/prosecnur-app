import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { Split } from "../../vendor/lucide-react";
import { FichaPregunta } from "./FichaPregunta";
import { FraseRegla } from "./FraseRegla";

describe("FraseRegla", () => {
  test("pinta el tipo arriba y la frase en un párrafo, con sus fichas intercaladas", () => {
    const html = renderToStaticMarkup(
      <FraseRegla tipo="Condiciones combinadas">
        Se marca cuando <FichaPregunta tipo="numerica" codigo="p4" etiqueta="Año de egreso" /> es mayor que el año de la{" "}
        <FichaPregunta tipo="texto" etiqueta="Fecha de respuesta" />.
      </FraseRegla>,
    );
    expect(html).toContain('<span class="pulso-frase-regla-nombre">Condiciones combinadas</span>');
    const frase = /<p class="pulso-frase-regla-frase">(.*)<\/p>/.exec(html)?.[1] ?? "";
    expect(frase.startsWith("Se marca cuando <span")).toBe(true);
    expect(frase.match(/pulso-ficha-pregunta"/g)).toHaveLength(2);
    expect(frase.endsWith("</span>.")).toBe(true);
  });

  test("por defecto es normal; compacto cambia el atributo de tamaño", () => {
    const normal = renderToStaticMarkup(<FraseRegla tipo="Salto del formulario">Se pregunta cuando trabaja.</FraseRegla>);
    const compacto = renderToStaticMarkup(
      <FraseRegla tipo="Salto del formulario" tamano="compacto">
        Se pregunta cuando trabaja.
      </FraseRegla>,
    );
    expect(normal).toContain('class="pulso-frase-regla" data-tamano="normal"');
    expect(compacto).toContain('class="pulso-frase-regla" data-tamano="compacto"');
  });

  test("el ícono va en su caja, oculto al lector de pantalla; sin ícono no hay caja", () => {
    const con = renderToStaticMarkup(
      <FraseRegla tipo="Salto del formulario" icono={<Split size={14} />}>
        Se pregunta cuando trabaja.
      </FraseRegla>,
    );
    const sin = renderToStaticMarkup(<FraseRegla tipo="Salto del formulario">Se pregunta cuando trabaja.</FraseRegla>);
    expect(con).toContain('<span class="pulso-frase-regla-icono" aria-hidden="true"><svg');
    expect(sin).not.toContain("pulso-frase-regla-icono");
  });

  test("la acción va al extremo de la línea del tipo; sin acción no hay hueco", () => {
    const con = renderToStaticMarkup(
      <FraseRegla tipo="Condiciones combinadas" accion={<button type="button">Cambiar</button>}>
        Se marca cuando es mayor que 0.
      </FraseRegla>,
    );
    const sin = renderToStaticMarkup(<FraseRegla tipo="Condiciones combinadas">Se marca cuando es mayor que 0.</FraseRegla>);
    expect(con).toContain('<span class="pulso-frase-regla-accion"><button type="button">Cambiar</button></span></div><p');
    expect(sin).not.toContain("pulso-frase-regla-accion");
    expect(sin).not.toContain("<button");
  });
});
