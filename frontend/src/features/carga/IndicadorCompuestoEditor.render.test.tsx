// ADR 0105: el indicador compuesto se declara y se lee en la tabla de equivalencias.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VariableDeBase } from "../../api/equivalencias";
import { EquivalenciasTabla } from "./EquivalenciasTabla";
import { aFilasEditor } from "./equivalenciasEditorModel";
import { BaseCompuesta } from "./IndicadorCompuestoEditor";

const opciones: VariableDeBase[] = [
  { name: "P28_1", label: "¿Recurrió a la Defensoría?", seccion: "", opciones: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }] },
  { name: "P28_2", label: "¿Recurrió a la Comisión?", seccion: "" },
];

const tabla = (conCompuesto: boolean) => renderToStaticMarkup(createElement(EquivalenciasTabla, {
  bases: ["2024", "2026"],
  filas: aFilasEditor([{
    seccion: "",
    etiqueta_estandar: "Recurrió a alguna instancia",
    variables: { "2024": "alguna(P28_1,P28_2)" },
    cantidad: 1,
    derivada: { regla: "alguna", por_base: { "2024": { variables: ["P28_1", "P28_2"], codigos: ["1"] } } },
  }]),
  variablesPorBase: { "2024": opciones, "2026": [] },
  onAsignar: () => undefined,
  onEditar: () => undefined,
  onQuitar: () => undefined,
  onConfirmar: () => undefined,
  onAgregarFila: () => undefined,
  ...(conCompuesto ? { onIndicadorCompuesto: () => undefined } : {}),
}));

describe("la fila compuesta en la tabla", () => {
  it("muestra los componentes legibles, no la expresión, y reabre el editor", () => {
    const html = tabla(true);
    expect(html).toContain("Alguna de: P28_1, P28_2 · código 1");
    expect(html).not.toContain("alguna(P28_1,P28_2)");
    expect(html).toContain('data-compuesto-abrir="0"');
    expect(html).toContain("Sin declarar");
    expect(html).not.toContain('aria-haspopup="listbox"');
  });

  it("«Añadir indicador compuesto» va junto a «Añadir pregunta equivalente»", () => {
    const html = tabla(true);
    expect(html).toContain("Añadir pregunta equivalente");
    expect(html).toContain("Añadir indicador compuesto");
    expect(tabla(false)).not.toContain("Añadir indicador compuesto");
  });
});

describe("una base del editor", () => {
  const render = (variables: string[], conteo?: string | null) => renderToStaticMarkup(createElement(BaseCompuesta, {
    base: "2024",
    entrada: { variables, codigosTexto: "1" },
    opciones,
    conteo,
    despachar: () => undefined,
  }));

  it("los conteos de lo guardado van bajo las preguntas; sin ellos, nada de relleno", () => {
    expect(render(["P28_1"], "Sí 120 · No 80 · Sin dato 5")).toContain('<p class="pulso-compuesto-conteos">Sí 120 · No 80 · Sin dato 5</p>');
    expect(render(["P28_1"], null)).not.toContain("pulso-compuesto-conteos");
    expect(render([], "Sí 1 · No 0 · Sin dato 0")).not.toContain("pulso-compuesto-conteos");
  });

  it("C3: sin preguntas elegidas, el vacío vive en su sección", () => {
    const html = render([]);
    expect(html).toContain("Sin preguntas elegidas: 2024 queda sin declarar.");
    expect(html).toContain("is-vacia");
    expect(html).not.toContain("Códigos «sí»");
  });

  it("con preguntas: las lista, ofrece quitarlas y los códigos con la ayuda de la primera", () => {
    const html = render(["P28_1", "P28_2"]);
    expect(html).toContain('aria-label="Quitar P28_1 de 2024"');
    expect(html).toContain("Códigos «sí»");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });
});
