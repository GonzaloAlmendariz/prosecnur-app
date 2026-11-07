import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { baseAutomatica, ranurasDeMaqueta, ttbDeBloque } from "./modeloMaqueta";

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
      args: { modo: "multilista", bloques: [{ vars: { tema_1: ["docentes$p11"] }, barra_extra: ["top2box"] }] },
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

  it("Q2-6: las láminas de resumen recién puestas no piden pregunta: la cobertura lee públicos y la regla elige", () => {
    const [cob] = ranurasDeMaqueta(slide({ graficador: "p_cobertura", args: { bases: ["estudiantes", "docentes"] } }), []);
    expect(cob.preguntas.map((q) => q.titulo)).toEqual(["Estudiantes", "Docentes"]);
    const [pan] = ranurasDeMaqueta(slide({ graficador: "p_panorama", args: { vars: ["docentes$*", "estudiantes$*"], regla: { tipo: "todas" } } }), []);
    expect(pan.preguntas.map((q) => q.titulo)).toEqual(["Docentes, todas las de escala", "Estudiantes, todas las de escala"]);
    expect(pan.bases).toEqual(["Docentes", "Estudiantes"]);
    const [fort] = ranurasDeMaqueta(slide({ graficador: "p_fortalezas", args: { regla: { tipo: "extremos", n: 5 } } }), []);
    expect(fort.preguntas.map((q) => q.titulo)).toEqual(["Preguntas que elige la regla"]);
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
      { vars: { t: ["docentes$p12"] }, barra_extra: ["top2box"], top2box_labels: ["De acuerdo"] },
    ] } });
    const [r] = ranurasDeMaqueta(s, vars);
    expect(r.preguntas.map((q) => [q.titulo, q.ttb])).toEqual([["¿Conoce?", false], ["Definidos", true]]);
    expect(r.twoBox.ttb).toBe(true);
  });

  it("un bloque Sí/No con el Top Two Box encendido no lo dibuja: no tiene «dos mejores» (como el motor)", () => {
    const vars = [
      { name: "p11", source: "docentes", label: "¿Conoce?", list_name: "sn", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
      { name: "p12", source: "docentes", label: "Definidos", list_name: "ac", choices: ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"].map((l, i) => ({ name: String(i + 1), label: l })) },
    ] as never[];
    const s = slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", barra_extra: ["top2box"], bloques: [
      { vars: { t: ["docentes$p11"] } },
      { vars: { t: ["docentes$p12"] } },
    ] } });
    const [r] = ranurasDeMaqueta(s, vars);
    expect(r.preguntas.map((q) => [q.titulo, q.ttb])).toEqual([["¿Conoce?", false], ["Definidos", true]]);
  });

  it("cada pregunta trae su escala con los colores de su lista y se dice si comparten escala", () => {
    const vars = [
      { name: "p11", source: "docentes", label: "¿Conoce?", list_name: "sn", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] },
      { name: "p12", source: "docentes", label: "Definidos", list_name: "ac", choices: [{ name: "1", label: "De acuerdo" }, { name: "2", label: "En desacuerdo" }] },
    ] as never[];
    const graf = (b: string[]) => slide({ graficador: "p_barras_multiapiladas", args: { modo: "multilista", bloques: b.map((v) => ({ vars: { t: [`docentes$${v}`] } })) } });
    const [dist] = ranurasDeMaqueta(graf(["p11", "p12"]), vars, {}, { paletas: { sn: { "Sí": "#081F5C" } } });
    expect(dist.mismaEscala).toBe(false);
    expect(dist.preguntas[0]).toMatchObject({ titulo: "¿Conoce?", opciones: [{ rotulo: "Sí", color: "#081F5C" }, { rotulo: "No", color: null }], ttb: false, bases: [] });
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

describe("barra extra por bloque: bloque > lámina > preset", () => {
  it("un bloque sin barra propia hereda la de la lámina; false propio la apaga; Conteos no es Top Two Box", () => {
    expect(ttbDeBloque({}, ["top2box"])).toBe(true);
    expect(ttbDeBloque({ barra_extra: false }, ["top2box"])).toBe(false);
    expect(ttbDeBloque({ barra_extra: ["top2box"] }, false)).toBe(true);
    expect(ttbDeBloque({ barra_extra: ["conteos"] }, ["top2box"])).toBe(false);
    expect(ttbDeBloque({}, undefined)).toBe(false);
  });
});

describe("tienePistasDeOrden: la misma regla que .goc_pistas_orden del motor", () => {
  it("números romanos, solos o con «ciclo», cuentan como orden (graficos_orden_romanos.R)", async () => {
    const { tienePistasDeOrden, sonRomanos } = await import("./modeloMaqueta");
    expect(tienePistasDeOrden(["VI", "VII", "VIII", "IX"])).toBe(true);
    expect(tienePistasDeOrden(["Ciclo I", "Ciclo II", "Ciclo X"])).toBe(true);
    expect(sonRomanos(["IIII", "V"])).toBe(false);            // mal escrito: la ida y vuelta lo descarta
    expect(sonRomanos(["Mi casa", "Vivo solo"])).toBe(false);
  });
  it("los residuales van anclados al inicio, con Ninguna/Ninguno, como .CATEGORIAS_RESIDUALES", async () => {
    const { tienePistasDeOrden } = await import("./modeloMaqueta");
    // «Ninguno» es residual: no hace de segunda etiqueta con cifra.
    expect(tienePistasDeOrden(["1 hijo", "Ninguno"])).toBe(false);
    // «Hay otro modo» no empieza por «Otro»: cuenta como etiqueta (antes el «otro» suelto la tiraba).
    expect(tienePistasDeOrden(["Más de 3 años", "Hay otro modo 2"])).toBe(true);
  });
  it("una escala en romanos con Top Two Box encendido y sin categorías: la maqueta lo muestra para que la tarjeta avise", async () => {
    const { twoBoxEnPregunta } = await import("./modeloMaqueta");
    expect(twoBoxEnPregunta(true, undefined, ["Ciclo I", "Ciclo II", "Ciclo III"].map((rotulo) => ({ rotulo })))).toBe(true);
  });
});
