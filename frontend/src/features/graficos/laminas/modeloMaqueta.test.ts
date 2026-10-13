import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { baseAutomatica, ranurasDeMaqueta, usaFilasCompactas } from "./modeloMaqueta";

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

  it("cada pregunta dice de qué bases viene: dos preguntas pueden cruzar actores distintos", () => {
    const vars = [
      { name: "p9", source: "docentes", label: "¿Conoce?", list_name: "sn", choices: [] },
      { name: "p9", source: "estudiantes", label: "¿Conoce?", list_name: "sn", choices: [] },
      { name: "p20", source: "egresados", label: "¿Recomendaría?", list_name: "sn", choices: [] },
    ] as never[];
    const s = slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", bloques: [
      { vars: { t: ["docentes$p9", "estudiantes$p9"] } },
      { vars: { t: ["egresados$p20"] } },
    ] } });
    const [r] = ranurasDeMaqueta(s, vars);
    expect(r.preguntas.map((q) => q.bases)).toEqual([["Docentes", "Estudiantes"], ["Egresados"]]);
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

  it("dos bloques: cada uno con su propio Top Two Box (uno encendido y el otro no)", () => {
    const vars = [
      { name: "p11", source: "docentes", label: "¿Conoce?", list_name: "sn", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
      { name: "p12", source: "docentes", label: "Definidos", list_name: "ac", choices: [{ name: "1", label: "De acuerdo" }, { name: "2", label: "En desacuerdo" }] },
    ] as never[];
    const s = slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", bloques: [
      { vars: { t: ["docentes$p11"] } },
      { vars: { t: ["docentes$p12"] }, top2box: true, top2box_labels: ["De acuerdo"] },
    ] } });
    const [r] = ranurasDeMaqueta(s, vars);
    expect(r.preguntas.map((q) => [q.titulo, q.ttb])).toEqual([["¿Conoce?", false], ["Definidos", true]]);
    expect(r.twoBox.ttb).toBe(true);
  });

  it("cada pregunta trae su escala con los colores de su lista y se dice si comparten escala", () => {
    const vars = [
      { name: "p11", source: "docentes", label: "¿Conoce?", list_name: "sn", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
      { name: "p12", source: "docentes", label: "Definidos", list_name: "ac", choices: [{ name: "1", label: "De acuerdo" }, { name: "2", label: "En desacuerdo" }] },
    ] as never[];
    const graf = (b: string[]) => slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", bloques: b.map((v) => ({ vars: { t: [`docentes$${v}`] } })) } });
    const [dist] = ranurasDeMaqueta(graf(["p11", "p12"]), vars, {}, { paletas: { sn: { "Sí": "#081F5C" } } });
    expect(dist.mismaEscala).toBe(false);
    expect(dist.preguntas[0]).toEqual({ titulo: "¿Conoce?", opciones: [{ rotulo: "Sí", color: "#081F5C" }, { rotulo: "No", color: null }], ttb: false, bases: [] });
    const [igual] = ranurasDeMaqueta(graf(["p11", "p11"]), vars, {});
    expect(igual.mismaEscala).toBe(true);
  });

  it("el pie dice la base que armará el motor, por base y con el formato del informe", () => {
    const vars = [
      { name: "p11", source: "docentes", label: "x", n_non_empty: 52 },
      { name: "p9", source: "estudiantes", label: "x", n_non_empty: 172 },
      { name: "p8", source: "administrativos", label: "x", n_non_empty: 15 },
    ] as never[];
    const s1 = slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", bloques: [{ vars: { t: ["docentes$p11", "estudiantes$p9", "administrativos$p8"] } }] } });
    expect(baseAutomatica(s1, vars)).toBe("Base: 52 docentes, 172 estudiantes y 15 administrativos");
    expect(baseAutomatica(s1, vars, "N = %s")).toBe("N = 52 docentes, 172 estudiantes y 15 administrativos");
    expect(baseAutomatica(slide({ graficador: "p_barras_categoricas", args: { var: "egresados$p1" } }), vars)).toBeNull();   // sin conteo: no se inventa
  });

  it("con temas de públicos distintos, el pie nombra a todos los públicos de la lámina (Arte, lámina 10)", () => {
    const vars = [
      { name: "a1", source: "docentes", label: "x", n_non_empty: 116 }, { name: "a2", source: "administrativos", label: "x", n_non_empty: 89 },
      { name: "b1", source: "docentes", label: "x", n_non_empty: 110 }, { name: "b2", source: "estudiantes", label: "x", n_non_empty: 289 },
    ] as never[];
    const s1 = slide({ graficador: "p_barras_multiapiladas", args: { modo: "var_cruce", vars: { t1: ["docentes$a1", "administrativos$a2"], t2: ["docentes$b1", "estudiantes$b2"] } } });
    expect(baseAutomatica(s1, vars)).toBe("Base: 116 docentes, 89 administrativos y 289 estudiantes");
  });

  it("los públicos van en el orden de las bases, no en el de las preguntas (Arte, lámina 13; así sale el PPT)", () => {
    const vars = [
      { name: "a1", source: "docentes", label: "x", n_non_empty: 116 }, { name: "a2", source: "administrativos", label: "x", n_non_empty: 89 },
      { name: "a3", source: "estudiantes", label: "x", n_non_empty: 289 },
    ] as never[];
    const s1 = slide({ graficador: "p_barras_multiapiladas", args: { modo: "var_cruce", vars: { t1: ["docentes$a1", "estudiantes$a3", "administrativos$a2"] } } });
    expect(baseAutomatica(s1, vars)).toBe("Base: 116 docentes, 89 administrativos y 289 estudiantes");
  });
});

describe("maqueta: cuándo las preguntas van en una línea cada una", () => {
  // Gonzalo, 2026-10-13 (lámina 12 de Arte): tres preguntas con la misma escala repetían la leyenda tres veces, no cabían y
  // la ranura las recortaba arriba y abajo.
  it("desde dos preguntas con la misma escala, o desde cuatro con escalas distintas", () => {
    expect(usaFilasCompactas(3, true)).toBe(true);
    expect(usaFilasCompactas(2, true)).toBe(true);
    expect(usaFilasCompactas(1, true)).toBe(false);
    expect(usaFilasCompactas(3, false)).toBe(false);
    expect(usaFilasCompactas(4, false)).toBe(true);
  });
});
