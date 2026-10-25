// TXT-10/16: el aviso de una pregunta que no está en «Preguntas para codificar» lo dice en texto llano y ofrece la
// misma acción de Preparar («Incluir en codificación»); nunca la incluye solo.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PreguntaAbierta } from "../../api/codificacion";
import { FocoSinIncluirAviso } from "./FocoSinIncluirAviso";

const coment = { parent: "coment", parent_label: "Comentarios finales", tipo: "text", col_efectiva: "coment", marcada: false, marcada_auto: false } as PreguntaAbierta;
const noop = () => undefined;
const html = (props: Partial<Parameters<typeof FocoSinIncluirAviso>[0]> = {}) =>
  renderToStaticMarkup(createElement(FocoSinIncluirAviso, {
    resolucion: { tipo: "sin-incluir", pregunta: coment, incluible: true },
    incluyendo: false, error: "", onIncluir: noop, onVolver: noop, ...props,
  }));

describe("FocoSinIncluirAviso", () => {
  it("dice que la pregunta no está incluida y ofrece incluirla", () => {
    const h = html();
    expect(h).toContain("coment");
    expect(h).toContain("no está en «Preguntas para codificar»");
    expect(h).toMatch(/<button[^>]*>(?:(?!<\/button>).)*Incluir en codificación/);
    expect(h).toContain('data-audit-ready="codificacion-codificar"');
    expect(h).toContain('data-qa-geometry-capacity="owned"');
  });

  it("si no se puede incluir desde aquí, no ofrece el botón y manda a Preparar", () => {
    const h = html({ resolucion: { tipo: "sin-incluir", pregunta: { ...coment, tipo: "select_one" }, incluible: false } });
    expect(h).not.toContain("Incluir en codificación</");
    expect(h).toContain("Volver a organizar");
  });

  it("un foco que no es una pregunta abierta se dice", () => {
    const h = html({ resolucion: { tipo: "no-existe", foco: "zzz" } });
    expect(h).toContain("zzz");
    expect(h).not.toContain("Incluir en codificación</");
  });

  it("un error al incluir se dice con role=alert; mientras incluye, el botón se apaga", () => {
    expect(html({ error: "No se pudo marcar." })).toMatch(/role="alert"[^>]*>No se pudo marcar\./);
    expect(html({ incluyendo: true })).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Incluyendo/);
  });
});
