// Los casos de la galería aprobada (docs/qa/maqueta-galeria-maquetas-2026-10-13.html; Gonzalo: «impleméntalo en el
// editor con los casos como test»), por el mismo camino que el editor: ranurasDeMaqueta → fichaDeRanura → escenaFicha.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { RANURAS_ESTANDAR } from "../../iconos/ranurasEstandar.generated";
import { ranurasDeMaqueta } from "../modeloMaqueta";
import { coloresDeEscala, fichaDeRanura, gris, lecturaMulti, MAX_BARRAS, type FichaInfo } from "./fichaModelo";
import { barrasDeForma, cajaDe, escenaFicha, type Pieza } from "./geometriaFicha";

const ESCALAS: Record<string, [string, string | null][]> = {
  satisf: [["Muy insatisfecho", "#F4B183"], ["Insatisfecho", "#FFD966"], ["Satisfecho", "#A9D18E"], ["Muy satisfecho", "#70AD47"], ["SIN INF", "#BFBFBF"]],
  frecuencia: [["Nunca", "#F4B183"], ["Casi nunca", "#F8CBAD"], ["A veces", "#FFD966"], ["Con frecuencia", "#C5E0B4"], ["Casi siempre", "#A9D18E"], ["Siempre", "#70AD47"], ["No sabe", "#BFBFBF"]],
  sino: [["Sí", "#0B2A6B"], ["No", "#9DC3E6"]],
  sinpaleta: [["Nada importante", null], ["Poco importante", null], ["Importante", null], ["Muy importante", null], ["No sabe", null]],
  diez: Array.from({ length: 10 }, (_, k) => [String(k + 1), `#${(k * 1712 + 4096).toString(16).padStart(6, "0").slice(0, 6)}`] as [string, string]),
  sexo: [["Mujer", null], ["Hombre", null], ["Otro", null]],
  genero: [["Masculino", null], ["Femenino", null], ["Prefiero no responder", null], ["Otro (especifique)", null]],
};
const PALETAS = Object.fromEntries(Object.entries(ESCALAS).map(([lista, ops]) => [lista, Object.fromEntries(ops.filter(([, c]) => c).map(([l, c]) => [l, c]))]));
const v = (source: string, name: string, lista: keyof typeof ESCALAS, label = name) =>
  ({ name, source, label, list_name: lista, choices: ESCALAS[lista].map(([l], i) => ({ name: String(i + 1), label: l })), n_non_empty: 100 });
const VARS = [
  ...["docentes", "administrativos", "estudiantes"].flatMap((s) => [
    v(s, "salud", "satisf", "Servicio de salud"), v(s, "bienestar", "satisf", "Servicio de Bienestar Psicológico"),
    v(s, "cultura", "satisf", "Actividades culturales"), v(s, "uso", "frecuencia", "Usa los servicios de bienestar"),
    v(s, "mision", "sino", "¿Conoce la misión?"), v(s, "importa", "sinpaleta", "Importancia"), v(s, "nota", "diez", "Del 1 al 10"),
    v(s, "sexo", "sexo", "Sexo"), v(s, "genero", "genero", "¿Cuál es su género?"),
  ]),
] as never[];
const slide = (tipo: string, payload: Record<string, unknown>) => ({ tipo, payload: { titulo: "T", ...payload } }) as unknown as Slide;
const multi = (args: Record<string, unknown>) => slide("p_slide_1_grafico", { grafico: { graficador: "p_barras_multiapiladas", args } });
const ficha = (s: Slide, k = 0): FichaInfo => fichaDeRanura(ranurasDeMaqueta(s, VARS, {}, { paletas: PALETAS as never })[k], "Multiapiladas");
const filasDe = (f: FichaInfo) => (f.forma?.bloques ?? []).reduce((a, b) => a + b.temas.reduce((x, t) => x + t.filas, 0), 0);
const tema = (q: string, bases = ["docentes", "estudiantes"]) => bases.map((b) => `${b}$${q}`);

// Con el Top Two Box encendido la galería declara sus respuestas: sin ellas el PowerPoint sale sin la columna y la ficha
// lo avisa (M2, fichaHallazgosCatalogo.test.tsx).
const SATISF_TTB = ["Satisfecho", "Muy satisfecho"];

describe("ficha de la maqueta: los casos de la galería", () => {
  it("1 · públicos por tema, 1 tema × 3 públicos, con Top Two Box", () => {
    const f = ficha(multi({ modo: "var_cruce", vars: { t1: tema("cultura", ["docentes", "administrativos", "estudiantes"]) }, barra_extra: ["top2box"], top2box_labels: SATISF_TTB }));
    expect(f).toMatchObject({ tipo: "Multiapiladas", lectura: "Públicos por tema", publicos: ["Docentes", "Administrativos", "Estudiantes"], ajustes: ["Top Two Box"], avisos: [] });
    expect(filasDe(f)).toBe(3);
    expect(f.leyendas).toHaveLength(1);
    expect(f.leyendas[0].items.map((i) => i.color)).toEqual(ESCALAS.satisf.map(([, c]) => c));
  });

  it("2 y 3 · las filas son las reales: 3 + 3 públicos, o temas con públicos distintos (2 + 2)", () => {
    expect(filasDe(ficha(multi({ modo: "var_cruce", vars: { t1: tema("salud", ["docentes", "administrativos", "estudiantes"]), t2: tema("bienestar", ["docentes", "administrativos", "estudiantes"]) } })))).toBe(6);
    const f = ficha(multi({ modo: "var_cruce", vars: { t1: tema("salud", ["docentes", "administrativos"]), t2: tema("bienestar") } }));
    expect(f.forma?.bloques[0].temas.map((t) => t.filas)).toEqual([2, 2]);
    expect(f.publicos).toEqual(["Docentes", "Administrativos", "Estudiantes"]);
  });

  it("4 · preguntas: una fila por pregunta y sin chips de público", () => {
    const f = ficha(slide("p_slide_1_grafico", { grafico: { graficador: "p_barras_multiapiladas", args: { modo: "var", vars: ["estudiantes$salud", "estudiantes$bienestar", "estudiantes$cultura"] } } }));
    expect(f.lectura).toBe("Preguntas");
    expect(filasDe(f)).toBe(3);
    expect(f.publicos).toEqual([]);
    expect(f.preguntas).toHaveLength(3);
  });

  it("5a y 5b · el ancho de los temas se ve en el dibujo y, si es ancho, en un chip", () => {
    const args = (w: number) => ({ modo: "var_cruce", vars: { t1: tema("salud"), t2: tema("bienestar") }, overrides: { canvas_w_grupo: w } });
    const angosto = ficha(multi(args(0.15))), ancho = ficha(multi(args(0.38)));
    const colPregunta = (f: FichaInfo) => (barrasDeForma(f.forma!, { x: 0, y: 0, w: 6, h: 3 }).find((p) => p.tipo === "barra" && p.rol === "pregunta") as { w: number }).w;
    expect(colPregunta(ancho)).toBeGreaterThan(colPregunta(angosto) * 2);
    expect(ancho.ajustes).toContain("Temas anchos");
    expect(angosto.ajustes).not.toContain("Temas anchos");
  });

  it("6 · bloques con la misma escala: una sola leyenda, sin título, y «2 bloques»", () => {
    const f = ficha(multi({ modo: "multilista", bloques: [
      { titulo: "Aulas", barra_extra: ["top2box"], vars: { t: tema("salud") } }, { titulo: "Biblioteca", barra_extra: ["top2box"], vars: { t: tema("bienestar") } },
    ] }));
    expect(f.leyendas).toHaveLength(1);
    expect(f.leyendas[0].titulo).toBeNull();
    expect(f.ajustes).toEqual(["Top Two Box", "2 bloques"]);
    expect(f.lectura).toBe("Bloques");
  });

  it("7 · bloques con escalas distintas: una leyenda por bloque con su título, Top Two Box en uno", () => {
    const f = ficha(multi({ modo: "multilista", bloques: [
      { titulo: "Satisfacción", barra_extra: ["top2box"], vars: { t: tema("salud") } }, { titulo: "Frecuencia de uso", vars: { t: tema("uso") } },
    ] }));
    expect(f.leyendas.map((l) => l.titulo)).toEqual(["Satisfacción", "Frecuencia de uso"]);
    expect(f.ajustes).toEqual(["Top Two Box en un bloque", "2 bloques"]);
    expect(f.forma?.bloques.map((b) => b.ttb)).toEqual([true, false]);
  });

  it("M10/N3b · «Respuestas por público» encendido (apagado por defecto) se ve como ajuste", () => {
    expect(ficha(multi({ modo: "var_cruce", vars: { t: tema("salud") }, mostrar_respuestas: true })).ajustes).toContain("Con respuestas por público");
    expect(ficha(multi({ modo: "var_cruce", vars: { t: tema("salud") } })).ajustes).not.toContain("Con respuestas por público");
  });

  it("8 · una pregunta por grupos: los grupos del cruce son las filas y se nombran", () => {
    const f = ficha(multi({ modo: "cruce", var: "estudiantes$salud", cruces: "estudiantes$sexo" }));
    expect(f.lectura).toBe("Una pregunta por grupos");
    expect(filasDe(f)).toBe(3);
    expect(f.ajustes).toContain("Por grupos: Sexo");
  });

  it("9, 10, 11b y 11c · escalas: 7 respuestas, Sí/No (dicotómica), sin paleta en grises, 10 colores fieles", () => {
    expect(ficha(multi({ modo: "var_cruce", vars: { t: tema("uso") } })).leyendas[0].items).toHaveLength(7);
    expect(ficha(multi({ modo: "var_cruce", vars: { t: tema("mision") } })).tipo).toBe("Dicotómica");
    const grises = ficha(multi({ modo: "var_cruce", vars: { t: tema("importa") } })).leyendas[0].items.map((i) => i.color);
    expect(grises.every((c) => c.startsWith("rgb("))).toBe(true);
    expect(new Set(grises).size).toBe(grises.length);
    expect(grises[grises.length - 1]).toBe(gris(0, 1, true));   // «No sabe», la residual, va en el gris más claro
    const diez = ficha(multi({ modo: "var_cruce", vars: { t: tema("nota") } })).leyendas[0].items.map((i) => i.color);
    expect(diez).toEqual(ESCALAS.diez.map(([, c]) => c));
    expect(coloresDeEscala(Array.from({ length: 12 }, (_, k) => ({ rotulo: String(k), color: "#000000" })))[11]).toMatch(/^rgb\(/);
  });

  it("lámina 1 de Arte · género no es dicotómica y no promete un Top Two Box que el motor omite", () => {
    const g = ficha(multi({ modo: "var_cruce", vars: { t: tema("genero", ["docentes", "administrativos", "estudiantes"]) }, barra_extra: ["top2box"], top2box_labels: ["De acuerdo", "Totalmente de acuerdo"] }));
    expect(g.tipo).toBe("Multiapiladas");
    expect(g.ajustes).not.toContain("Top Two Box");
    expect(g.forma?.bloques[0].ttb).toBe(false);
    // Encendido desde el estilo del informe SIN categorías (Arte): en género tampoco, porque no tiene orden (`sin_orden`);
    // en una escala de satisfacción sí (la tarjeta avisa que faltan las categorías).
    expect(ficha(multi({ modo: "var_cruce", vars: { t: tema("genero") }, barra_extra: ["top2box"] })).ajustes).not.toContain("Top Two Box");
    expect(ficha(multi({ modo: "var_cruce", vars: { t: tema("salud") }, barra_extra: ["top2box"] })).ajustes).toContain("Top Two Box");
    // Con categorías que sí están en la escala, se muestra.
    const s = ficha(multi({ modo: "var_cruce", vars: { t: tema("salud") }, barra_extra: ["top2box"], top2box_labels: ["Satisfecho", "Muy satisfecho"] }));
    expect(s.ajustes).toContain("Top Two Box");
  });

  it("11 · más de 7 barras: dibuja la primera parte y avisa «Sale en N láminas»", () => {
    const f = ficha(multi({ modo: "var_cruce", vars: {
      t1: tema("salud", ["docentes", "administrativos", "estudiantes"]), t2: tema("bienestar", ["docentes", "administrativos", "estudiantes"]),
      t3: tema("cultura", ["docentes", "administrativos", "estudiantes"]),
    }, top2box_labels: SATISF_TTB }));
    expect(filasDe(f)).toBeLessThanOrEqual(MAX_BARRAS);
    expect(f.avisos).toEqual(["Sale en 2 láminas"]);
    expect(f.preguntas).toHaveLength(2);   // describe la parte que se dibuja
  });

  it("21 · vacíos: ranura sin gráfico y gráfico sin pregunta", () => {
    const vacia = fichaDeRanura(ranurasDeMaqueta(slide("p_slide_1_grafico", {}), VARS)[0], null);
    expect(vacia.vacia).toBe(true);
    expect(escenaFicha(vacia, 12.5, 4.6).piezas).toEqual([expect.objectContaining({ tipo: "vacia", texto: "Elegir gráfico" })]);
    const falta = fichaDeRanura(ranurasDeMaqueta(slide("p_slide_1_grafico", { grafico: { graficador: "p_barras_multiapiladas", args: {} } }), VARS)[0], "Multiapiladas");
    const escena = escenaFicha(falta, 12.5, 4.6);
    expect(escena.piezas.some((p) => p.tipo === "chip" && p.texto === "Falta elegir la pregunta")).toBe(true);
    expect(escena.piezas.some((p) => p.tipo === "glifo" && p.tenue)).toBe(true);
  });

  it("las lecturas de multiapiladas se nombran como en su editor", () => {
    expect(lecturaMulti({ modo: "var_cruce", vars: ["a"] })).toBe("Preguntas por grupos");
    expect(lecturaMulti({})).toBe("Preguntas");
  });
});

describe("geometría de la ficha", () => {
  const pesada = ficha(multi({ modo: "multilista", bloques: [
    { titulo: "Satisfacción con los servicios de la universidad", barra_extra: ["top2box"], vars: { a: tema("salud"), b: tema("bienestar"), c: tema("cultura") } },
    { titulo: "Frecuencia de uso", vars: { t: tema("uso") } },
  ] }));
  const dentro = (p: Pieza, w: number, h: number) => { const c = cajaDe(p); return c.x >= -1e-6 && c.y >= -1e-6 && c.x + c.w <= w + 1e-6 && c.y + c.h <= h + 1e-6; };

  it("M4 · en las 22 composiciones, nada se sale de su ficha (con la ficha más cargada)", () => {
    for (const [tipo, { ranuras }] of Object.entries(RANURAS_ESTANDAR)) {
      for (const r of ranuras.filter((x) => x.tipo === "grafico")) {
        const fuera = escenaFicha(pesada, r.w, r.h).piezas.filter((p) => !dentro(p, r.w, r.h));
        expect(fuera, `${tipo} (${r.w}×${r.h})`).toEqual([]);
      }
    }
  });

  it("M4 · se ajusta por niveles: la ranura grande lo muestra todo y la chica se degrada", () => {
    expect(escenaFicha(pesada, 12.5, 4.6).nivel).toBeLessThan(escenaFicha(pesada, 3.67, 2.2).nivel);
    const lineas = escenaFicha(pesada, 12.5, 2.2).piezas.filter((p) => p.tipo === "leyenda" && p.modo === "linea");
    expect(lineas.length).toBeGreaterThan(0);
  });

  it("retícula · en horizontal la información y el dibujo comparten el alto y se centran en la ficha", () => {
    const e = escenaFicha(pesada, 12.5, 4.6);
    expect(e.horizontal).toBe(true);
    expect(e.info!.y).toBeGreaterThanOrEqual(e.dibujo!.y - 1e-6);
    expect(e.info!.y + e.info!.h).toBeLessThanOrEqual(e.dibujo!.y + e.dibujo!.h + 1e-6);
    expect(Math.abs(e.dibujo!.y - (e.h - e.dibujo!.y - e.dibujo!.h))).toBeLessThan(1e-6);
  });

  it("M8 · las barras conservan su clave al encender el Top Two Box (transitan, no se rehacen)", () => {
    const args = (ttb: boolean) => ({ modo: "var_cruce", vars: { t1: tema("salud") }, barra_extra: ttb ? ["top2box"] : false });
    const claves = (ttb: boolean) => escenaFicha(ficha(multi(args(ttb))), 12.5, 4.6, "k").piezas.filter((p) => p.tipo === "barra" && p.rol === "segmento").map((p) => (p as { clave: string }).clave);
    expect(claves(true)).toEqual(claves(false));
  });

  it("las demás ranuras usan el glifo de su tipo, con sus preguntas", () => {
    const s = slide("p_slide_1_grafico", { grafico: { graficador: "p_lollipop", args: { var: "estudiantes$salud" } } });
    const f = fichaDeRanura(ranurasDeMaqueta(s, VARS)[0], "Ranking (lollipop)");
    expect(f.forma).toBeNull();
    expect(escenaFicha(f, 12.5, 4.6).piezas.some((p) => p.tipo === "glifo" && !p.tenue)).toBe(true);
    expect(f.preguntas).toEqual(["Servicio de salud"]);
  });
});
