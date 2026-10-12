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
    // Ningún bloque declara su Top Two Box: la maqueta no dibuja la columna (el motor tampoco).
    expect(r.twoBox).toEqual({ ttb: false, btb: false });
  });

  it("un bloque con Top Two Box enciende la columna en la maqueta", () => {
    const [r] = ranurasDeMaqueta(slide({
      graficador: "p_barras_multiapiladas",
      args: { modo: "multilista", bloques: [{ vars: { tema_1: ["docentes$p11"] }, top2box: true }] },
    }), []);
    expect(r.twoBox.ttb).toBe(true);
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

  it("cada pregunta trae su escala con los colores de su lista y se dice si comparten escala", () => {
    const vars = [
      { name: "p11", source: "docentes", label: "¿Conoce?", list_name: "sn", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
      { name: "p12", source: "docentes", label: "Definidos", list_name: "ac", choices: [{ name: "1", label: "De acuerdo" }, { name: "2", label: "En desacuerdo" }] },
    ] as never[];
    const graf = (b: string[]) => slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", bloques: b.map((v) => ({ vars: { t: [`docentes$${v}`] } })) } });
    const [dist] = ranurasDeMaqueta(graf(["p11", "p12"]), vars, {}, { paletas: { sn: { "Sí": "#081F5C" } } });
    expect(dist.mismaEscala).toBe(false);
    expect(dist.preguntas[0]).toEqual({ titulo: "¿Conoce?", opciones: [{ rotulo: "Sí", color: "#081F5C" }, { rotulo: "No", color: null }] });
    const [igual] = ranurasDeMaqueta(graf(["p11", "p11"]), vars, {});
    expect(igual.mismaEscala).toBe(true);
  });
});
