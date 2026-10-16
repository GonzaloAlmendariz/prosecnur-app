import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CodifOmitida, CodifTextosSinCodigo } from "../../api/codificacion";
import { AplicarOmitidasAviso } from "./AplicarOmitidasAviso";

// ADR 0100, P1: lo que `/aplicar` no aplicó deja de ser silencioso. Y cuando
// no hay nada que decir, el silencio es lo correcto: nada de «0 omitidas».

function texto(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const P66: CodifOmitida = {
  pregunta: "P66",
  motivo: "sin_columna_texto",
  mensaje: "La columna de texto «P66_otro» no está en la base.",
  variable_nueva: null,
};
const P29: CodifOmitida = {
  pregunta: "P29_10",
  motivo: "sin_modo",
  mensaje: "Es de opción única y no se declaró si el texto se integra a la variable original o va en una variable aparte.",
  variable_nueva: null,
};
const P4: CodifTextosSinCodigo = { pregunta: "P4", columna: "P4_otro", casos: 1, textos: 1, ejemplos: ["Hombre"] };

describe("AplicarOmitidasAviso", () => {
  it("con las dos listas vacías no pinta nada", () => {
    expect(renderToStaticMarkup(<AplicarOmitidasAviso omitidas={[]} textosSinCodigo={[]} />)).toBe("");
  });

  it("las preguntas omitidas se anuncian como alerta, con su mensaje y su motivo", () => {
    const html = renderToStaticMarkup(<AplicarOmitidasAviso omitidas={[P29, P66]} textosSinCodigo={[]} />);
    const t = texto(html);
    expect(t).toContain("2 preguntas del catálogo no se aplicaron");
    expect(t).toContain("P66");
    expect(t).toContain("La columna de texto «P66_otro» no está en la base.");
    expect(t).toContain("P29_10");
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-motivo="sin_columna_texto"');
    expect(html).toContain('data-motivo="sin_modo"');
    // Sin textos sueltos, ese bloque no aparece ni con un cero.
    expect(t).not.toContain("sin código");
    expect(t).not.toMatch(/\b0 /);
  });

  it("una agrupación omitida nombra la variable que no se crea", () => {
    const html = renderToStaticMarkup(
      <AplicarOmitidasAviso
        omitidas={[
          {
            pregunta: "P12",
            motivo: "sin_variable_madre",
            mensaje: "La agrupación no se aplica: la variable madre «P12» no está en la base.",
            variable_nueva: "P12_agrup",
          },
        ]}
        textosSinCodigo={[]}
      />,
    );
    expect(texto(html)).toContain("1 pregunta del catálogo no se aplicó");
    expect(texto(html)).toContain("No se crea P12_agrup");
  });

  it("los textos sin código dicen casos, textos distintos, columna y ejemplos", () => {
    const html = renderToStaticMarkup(<AplicarOmitidasAviso omitidas={[]} textosSinCodigo={[P4]} />);
    const t = texto(html);
    expect(t).toContain("1 pregunta tiene textos que quedarán en «Otro»");
    expect(t).toContain("1 caso · 1 texto distinto en P4_otro");
    expect(t).toContain("«Hombre»");
    expect(t).not.toContain("más");
    expect(t).not.toContain("no se aplic");
    // El bloque de textos informa; la alerta fuerte es sólo para omitidas.
    expect(html).not.toContain('role="alert"');
  });

  it("muestra hasta cinco ejemplos y cuenta el resto", () => {
    const html = renderToStaticMarkup(
      <AplicarOmitidasAviso
        omitidas={[]}
        textosSinCodigo={[
          { pregunta: "P60", columna: "P60", casos: 12, textos: 8, ejemplos: ["a", "b", "c", "d", "e"] },
        ]}
      />,
    );
    const t = texto(html);
    expect(t).toContain("12 casos · 8 textos distintos");
    // Columna igual a la pregunta: no se repite.
    expect(t).not.toContain(" en P60");
    // Los ejemplos se cuentan en su lista: «Otro» también lleva comillas.
    expect((html.match(/<li>«/g) ?? []).length).toBe(5);
    expect(t).toContain("y 3 más");
  });

  it("declara sus listas como grupos de geometría intrínseca (C1)", () => {
    const html = renderToStaticMarkup(<AplicarOmitidasAviso omitidas={[P66]} textosSinCodigo={[P4]} />);
    expect(html).toContain('data-qa-geometry-group="codificacion/aplicar-omitidas"');
    expect(html).toContain('data-qa-geometry-group="codificacion/aplicar-sin-codigo"');
    expect((html.match(/data-qa-geometry-contract="intrinsic"/g) ?? []).length).toBe(2);
  });
});

describe("AplicarOmitidasAviso con el diagnóstico incompleto (ADR 0100)", () => {
  it("si el backend no pudo revisar, lo dice aunque las listas vengan vacías", () => {
    const html = renderToStaticMarkup(
      <AplicarOmitidasAviso omitidas={[]} textosSinCodigo={[]} incompletos={["las preguntas omitidas"]} />,
    );
    expect(html).toContain("codificacion-aplicar-incompleto");
    expect(html).toContain("No se pudo revisar las preguntas omitidas");
    expect(html).toContain('role="alert"');
  });
});
