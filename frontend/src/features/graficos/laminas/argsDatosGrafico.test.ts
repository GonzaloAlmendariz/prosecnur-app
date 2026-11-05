import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import { camposDeDatos, codigosATexto, conEtiquetaCorta, leerEtiquetaCorta, textoACodigos } from "./argsDatosGrafico";

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
  it("total y línea por nivel: el cruce es el eje, y las líneas y partes del total (meta, JSON) no son filas de la tarjeta", () => {
    // Firma de p_lineas_nivel en el registro (graficos_metadata.R), sin los comunes.
    const lineas = [
      a("var", "variable"), a("cruce", "variable"), a("series", "meta"), a("total_arriba", "bool"), a("segmentos_total", "meta"),
      a("mostrar_significancia", "bool"), a("grupos", "codigos_list"), a("titulo_seccion", "string", "textos"),
    ];
    const campos = camposDeDatos(lineas, { series: [{ rotulo: "Trabaja", respuestas: ["1"] }] }, "p_lineas_nivel");
    expect(campos.map((c) => c.arg.name)).toEqual(["var", "cruce"]);
    expect(campos[1]).toMatchObject({ rotulo: "Niveles del eje", ayuda: "Un punto por nivel, de menor a mayor." });
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
