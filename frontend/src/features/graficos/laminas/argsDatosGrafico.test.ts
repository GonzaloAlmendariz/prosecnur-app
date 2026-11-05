import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import {
  avisoParte, camposDeDatos, codigosATexto, conEtiquetaCorta, filasAPartes, leerEtiquetaCorta, mismasPartes, notaParte, partesAFilas,
  textoACodigos,
} from "./argsDatosGrafico";

const a = (name: string, tipo_input: ArgMetadata["tipo_input"], grupo: ArgMetadata["grupo"] = "datos"): ArgMetadata =>
  ({ name, label: name, tipo_input, grupo, descripcion: `Descripción larga de ${name}` });

// Firma real de p_barras_agrupadas en el registro (graficos_metadata.R).
const agrupadas = [
  a("var", "variable"), a("cruces", "variable_opt"), a("mostrar_significancia", "bool"), a("significancia_alpha", "number"),
  a("orden_barras", "choice"), a("orden_categorias_manual", "orden_categorias"), a("mostrar_ceros", "bool", "estilo"),
  a("excluir_opciones", "codigos_list", "filtro"), a("max_categorias", "number", "filtro"), a("agrupar_resto_en_otros", "bool", "filtro"),
  a("ancho_max_eje_y", "number", "filtro"), a("canvas_w_etiquetas", "number", "canvas"), a("lineheight_eje_y", "number", "estilo"),
];

describe("camposDeDatos", () => {
  it("sólo la lista blanca, en su orden, sin estilo ggplot", () => {
    expect(camposDeDatos(agrupadas, {}).map((c) => c.arg.name)).toEqual([
      "var", "cruces", "orden_barras", "max_categorias", "agrupar_resto_en_otros", "mostrar_ceros", "excluir_opciones",
    ]);
  });
  it("ADR 0128: ni el interruptor ni el nivel de significancia son filas genéricas (los lleva «Diferencias entre grupos»)", () => {
    const nombres = camposDeDatos(agrupadas, { mostrar_significancia: true, significancia_alpha: 0.05 }).map((c) => c.arg.name);
    expect(nombres).not.toContain("significancia_alpha");
    expect(nombres).not.toContain("mostrar_significancia");
  });
  it("rótulos cortos y la descripción larga queda como detalle", () => {
    const [p, d] = camposDeDatos(agrupadas, {});
    expect([p.rotulo, d.rotulo]).toEqual(["Pregunta", "Dividir por"]);
    expect(p.detalle).toMatch(/Descripción larga/);
  });
  it("total y línea por nivel: el cruce es el eje, y las líneas y las partes del total (partes) son filas de la tarjeta", () => {
    // Firma de p_lineas_nivel en el registro (graficos_metadata.R), sin los comunes; `total_arriba` con su default TRUE.
    const lineas = [
      a("var", "variable"), a("cruce", "variable"), a("series", "partes"), { ...a("total_arriba", "bool"), default: true },
      a("segmentos_total", "partes"), a("mostrar_significancia", "bool"), a("grupos", "codigos_list"), a("titulo_seccion", "string", "textos"),
    ];
    const campos = camposDeDatos(lineas, { series: [{ rotulo: "Trabaja", codigos: ["1"] }] }, "p_lineas_nivel");
    expect(campos.map((c) => c.arg.name)).toEqual(["var", "cruce", "series", "segmentos_total"]);
    expect(campos[1]).toMatchObject({ rotulo: "Niveles del eje", ayuda: "Un punto por nivel, de menor a mayor." });
    expect(campos[2]).toMatchObject({ rotulo: "Líneas", control: "partes" });
    expect(campos[3]).toMatchObject({ rotulo: "Partes del total", control: "partes", ayuda: "Vacío, la franja se arma sola." });
    // Sin la franja del total no hay partes que elegir.
    expect(camposDeDatos(lineas, { total_arriba: false }, "p_lineas_nivel").map((c) => c.arg.name)).not.toContain("segmentos_total");
    // Otro graficador con un arg del mismo nombre no lo hereda.
    expect(camposDeDatos([...agrupadas, a("series", "partes")], {}, "p_barras_agrupadas").map((c) => c.arg.name)).not.toContain("series");
    expect(camposDeDatos(agrupadas, {}, "p_barras_agrupadas")[1].rotulo).toBe("Dividir por");
  });
  it("total y línea por nivel: la lectura en gris se escribe en la tarjeta (antes solo en el plan) y no sale en otros gráficos", () => {
    const lineas = [a("var", "variable"), a("cruce", "variable"), a("lectura", "textarea", "textos")];
    const campos = camposDeDatos(lineas, {}, "p_lineas_nivel");
    expect(campos.map((c) => c.arg.name)).toEqual(["var", "cruce", "lectura"]);
    expect(campos[2]).toMatchObject({ rotulo: "Lectura" });
    expect(camposDeDatos([...agrupadas, a("lectura", "textarea", "textos")], {}, "p_barras_agrupadas").map((c) => c.arg.name)).not.toContain("lectura");
  });
});

describe("códigos y etiqueta corta", () => {
  it("códigos ida y vuelta", () => {
    expect(textoACodigos(" 88, 99;0 ")).toEqual(["88", "99", "0"]);
    expect(codigosATexto(["88", "99"])).toBe("88, 99");
  });
  it("etiqueta corta en overrides.etiquetas_vars sin pisar otros overrides; vacía la borra", () => {
    const args = { var: "e$p5", overrides: { titulo: "x", etiquetas_vars: { "e$p6": "Otra" } } };
    const o = conEtiquetaCorta(args, "e$p5", " Sexo ");
    expect(o).toEqual({ titulo: "x", etiquetas_vars: { "e$p6": "Otra", "e$p5": "Sexo" } });
    expect(leerEtiquetaCorta({ ...args, overrides: o }, "e$p5")).toBe("Sexo");
    expect(conEtiquetaCorta({ overrides: { etiquetas_vars: { v: "a" } } }, "v", "")).toEqual({});
  });
});

describe("partes de la línea por nivel", () => {
  const y = { var: "trabaja_horas", codigos: ["2", "3"] };
  it("lo guardado como filas: lista, una parte suelta o nada", () => {
    expect(partesAFilas(null)).toEqual([]);
    expect(partesAFilas(undefined)).toEqual([]);
    expect(partesAFilas({})).toEqual([]);
    expect(partesAFilas({ rotulo: "Trabaja", codigos: "1, 2" })).toEqual([{ clave: "p0", rotulo: "Trabaja", codigos: ["1", "2"], resto: {} }]);
    const filas = partesAFilas([{ rotulo: "Trabaja", codigos: [1, 2], y, color: "acento" }, "basura", { codigos: 3 }]);
    expect(filas.map((f) => [f.rotulo, f.codigos])).toEqual([["Trabaja", ["1", "2"]], ["", ["3"]]]);
    expect(filas[0].resto).toEqual({ y, color: "acento" });
  });
  it("de vuelta: conserva `y` y `color` intactos al editar el rótulo y las respuestas", () => {
    const [f] = partesAFilas([{ rotulo: "Trabaja", codigos: ["1"], y, color: "acento" }]);
    expect(filasAPartes([{ ...f, rotulo: " Trabaja mucho ", codigos: ["1", "4"] }], "series")).toEqual([
      { rotulo: "Trabaja mucho", codigos: ["1", "4"], y, color: "acento" },
    ]);
  });
  it("nunca guarda una fila que el motor rechaza; vacío: null en el total, lista vacía en las líneas", () => {
    const filas = partesAFilas([{ rotulo: "", codigos: ["1"] }, { rotulo: "Sí", codigos: [] }, { rotulo: "No", codigos: ["2"] }]);
    expect(filasAPartes(filas, "segmentos_total")).toEqual([{ rotulo: "No", codigos: ["2"] }]);
    expect(filasAPartes(filas.slice(0, 2), "segmentos_total")).toBeNull();
    expect(filasAPartes([], "segmentos_total")).toBeNull();
    expect(filasAPartes([], "series")).toEqual([]);
  });
  it("las líneas no pasan de tres: la cuarta se avisa y no sale", () => {
    const filas = partesAFilas(["a", "b", "c", "d"].map((r, i) => ({ rotulo: r, codigos: [String(i)] })));
    expect(filasAPartes(filas, "series")?.map((p) => p.rotulo)).toEqual(["a", "b", "c"]);
    expect(filasAPartes(filas, "segmentos_total")?.length).toBe(4);
    expect(avisoParte(filas[3], 3, "series")).toMatch(/Hasta tres/);
    expect(avisoParte(filas[3], 3, "segmentos_total")).toBeNull();
  });
  it("aviso de la fila incompleta y nota de lo que no se edita", () => {
    expect(avisoParte({ rotulo: "", codigos: [] }, 0, "series")).toBe("Falta el rótulo y las respuestas: no sale.");
    expect(avisoParte({ rotulo: " ", codigos: ["1"] }, 0, "series")).toBe("Falta el rótulo: no sale.");
    expect(avisoParte({ rotulo: "Sí", codigos: [] }, 0, "series")).toBe("Elige al menos una respuesta: no sale.");
    expect(avisoParte({ rotulo: "Sí", codigos: ["1"] }, 0, "series")).toBeNull();
    expect(notaParte({ resto: { y, color: "acento" } })).toBe("Suma una segunda pregunta: trabaja_horas. Color: acento.");
    expect(notaParte({ resto: {} })).toBeNull();
  });
  it("el borrador con filas incompletas dice lo mismo que lo guardado; un cambio afuera no", () => {
    const guardado = [{ rotulo: "Sí", codigos: ["1"] }];
    const borrador = [...partesAFilas(guardado), { clave: "n1", rotulo: "", codigos: [], resto: {} }];
    expect(mismasPartes(guardado, borrador, "series")).toBe(true);
    expect(mismasPartes([{ rotulo: "No", codigos: ["2"] }], borrador, "series")).toBe(false);
    expect(mismasPartes(null, [], "segmentos_total")).toBe(true);
  });
});
