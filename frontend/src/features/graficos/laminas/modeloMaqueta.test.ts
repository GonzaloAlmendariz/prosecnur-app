import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { ranurasDeMaqueta } from "./modeloMaqueta";

const slide = (grafico: unknown) => ({ tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico } }) as unknown as Slide;

describe("maqueta: qué muestra cada ranura", () => {
  it("multilista: la pregunta es el título del tema y las bases, los actores que cruza", () => {
    const [r] = ranurasDeMaqueta(slide({
      graficador: "p_barras_multiapiladas",
      args: { modo: "multilista", bloques: [
        { vars: { tema_1: ["docentes$p11", "estudiantes$p9"] }, titulos_grupo: { tema_1: "¿Conoce los propósitos?" } },
        { vars: { tema_1: ["docentes$p12", "estudiantes$p10"] }, titulos_grupo: { tema_1: "Están definidos con claridad." } },
      ] },
    }), []);
    expect(r).toMatchObject({ k: 1, graficador: "p_barras_multiapiladas", pregunta: "¿Conoce los propósitos?", masPreguntas: 1, bases: ["Docentes", "Estudiantes"] });
    expect(r.rect.w).toBeGreaterThan(0.5);
  });

  it("una sola base no se lista, y la pregunta sale de la etiqueta de la variable", () => {
    const [r] = ranurasDeMaqueta(slide({ graficador: "p_barras_categoricas", args: { var: "estudiantes$p1" } }),
      [{ name: "p1", label: "Sexo (Recodificada)", source: "estudiantes" } as never]);
    expect(r).toMatchObject({ pregunta: "Sexo", masPreguntas: 0, bases: [] });
  });

  it("una ranura sin gráfico queda vacía, sin pregunta", () => {
    const [r] = ranurasDeMaqueta(slide(null), []);
    expect(r).toMatchObject({ graficador: null, pregunta: null, bases: [] });
  });
});
