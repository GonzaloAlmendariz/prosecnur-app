import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import {
  ayudaDeLaOpcion,
  textoAyuda,
  avisoParte, camposDeDatos, codigosATexto, conEtiquetaCorta, filasAPartes, leerEtiquetaCorta, mismasPartes, notaParte, partesAFilas,
  textoACodigos, propiosDeAspecto, variableQueExcluye,
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
      a("rotulo_total", "string", "textos"), a("publico", "string", "textos"), a("nombre_nivel", "string", "textos"),
      a("lectura", "textarea", "textos"),
    ];
    const campos = camposDeDatos(lineas, { series: [{ rotulo: "Trabaja", codigos: ["1"] }] }, "p_lineas_nivel");
    const por = (n: string) => campos.find((c) => c.arg.name === n);
    expect(campos.map((c) => c.arg.name)).toEqual([
      "var", "cruce", "grupos", "titulo_seccion", "publico", "nombre_nivel", "lectura", "series", "total_arriba", "rotulo_total", "segmentos_total",
    ]);
    expect(campos[1]).toMatchObject({ rotulo: "Niveles del eje", ayuda: "Un punto por nivel, de menor a mayor." });
    expect(por("series")).toMatchObject({ rotulo: "Líneas", control: "partes" });
    expect(por("segmentos_total")).toMatchObject({ rotulo: "Partes del total", control: "partes", ayuda: "Vacío, la franja se arma sola." });
    // U5 del checklist del mazo: los textos y los niveles, con el valor que el motor usa sin escribir nada.
    expect(por("grupos")).toMatchObject({ rotulo: "Niveles que se muestran", control: "codigos" });
    expect(por("titulo_seccion")).toMatchObject({ rotulo: "Título de las líneas", control: "texto", placeholder: "Sin título" });
    expect(por("rotulo_total")).toMatchObject({ rotulo: "Título del total", control: "texto", placeholder: "Total" });
    expect(por("publico")).toMatchObject({ rotulo: "Cómo se nombran los casos", control: "texto", placeholder: "casos" });
    expect(por("nombre_nivel")).toMatchObject({ rotulo: "Qué crece", control: "texto", placeholder: "nivel" });
    expect(por("total_arriba")).toMatchObject({ rotulo: "Total arriba", control: "interruptor" });
    // Sin la franja del total no hay partes que elegir ni título que ponerle.
    const sinTotal = camposDeDatos(lineas, { total_arriba: false }, "p_lineas_nivel").map((c) => c.arg.name);
    expect(sinTotal).not.toContain("segmentos_total");
    expect(sinTotal).not.toContain("rotulo_total");
    expect(sinTotal).toContain("total_arriba");
    // Otro graficador que declarase los mismos nombres no los hereda.
    const otros = camposDeDatos([...agrupadas, a("publico", "string"), a("grupos", "codigos_list"), a("total_arriba", "bool")], {}, "p_barras_agrupadas");
    expect(otros.map((c) => c.arg.name)).not.toContain("publico");
    expect(otros.map((c) => c.arg.name)).not.toContain("grupos");
    expect(otros.map((c) => c.arg.name)).not.toContain("total_arriba");
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

describe("ayudaDeLaOpcion (H2): la ayuda de «Pista gris» describe la opción elegida", () => {
  const pista = {
    arg: { name: "pista_barras", label: "Pista", tipo_input: "choice", default: "auto" } as ArgMetadata,
    ayuda: "Automática: en toda barra de una serie.",
    opciones: [
      { value: "auto", label: "Automática", hint: "En toda barra de una serie, como el resto del mazo." },
      { value: "siempre", label: "Siempre", hint: "La escala pasa a ir de 0 a 100%." },
      { value: "nunca", label: "Nunca", hint: "La barra sola, sin pista." },
    ],
  };
  it("con «Nunca» elegida dice lo que hace «Nunca», no «Automática»", () => {
    expect(ayudaDeLaOpcion(pista, "nunca")).toBe("Nunca: la barra sola, sin pista.");
    expect(ayudaDeLaOpcion(pista, "siempre")).toBe("Siempre: la escala pasa a ir de 0 a 100%.");
  });
  it("sin valor guardado manda el default del registro", () => {
    expect(ayudaDeLaOpcion(pista, undefined)).toBe("Automática: en toda barra de una serie, como el resto del mazo.");
  });
  it("otro mando suma la opción elegida detrás de su guarda (ítem 9: el hint de la elegida va al «?»)", () => {
    expect(ayudaDeLaOpcion({ ...pista, arg: { ...pista.arg, name: "tipo_rango" } }, "nunca"))
      .toBe("Automática: en toda barra de una serie. Nunca: la barra sola, sin pista.");
  });
  it("una opción sin hint deja la ayuda fija", () => {
    const sinHint = { ...pista, arg: { ...pista.arg, name: "tipo_rango" }, opciones: pista.opciones.map(({ value, label }) => ({ value, label })) };
    expect(ayudaDeLaOpcion(sinHint, "nunca")).toBe(pista.ayuda);
  });
});

describe("ADR 0135 §8: el «?» y los args que la tarjeta todavía no sabe dibujar", () => {
  it("textoAyuda junta guarda y descripción sin repetir y con su punto", () => {
    expect(textoAyuda("Hasta tres", null, "", "Hasta tres", "Líneas de la serie.")).toBe("Hasta tres. Líneas de la serie.");
    expect(textoAyuda(null, undefined, "  ")).toBe("");
  });
  it("R6-8: no repite una frase que la descripción del registro comparte con la ayuda («Residuales en gris»)", () => {
    const ayuda = "Pinta de gris “Prefiero no responder”, “No sabe”, “Otros”…; apagado por defecto.";
    const registro = "Pinta de gris “Prefiero no responder”, “No sabe”, “Otros”…; apagado por defecto. Siguen al final de la lista, con o sin gris.";
    expect(textoAyuda(ayuda, null, registro)).toBe(`${ayuda} Siguen al final de la lista, con o sin gris.`);
    // Sin distinguir caja, tildes ni el punto final; y una frase contenida en otra ya dicha tampoco se repite.
    expect(textoAyuda("Automática: en toda barra", "automatica: en toda barra.")).toBe("Automática: en toda barra.");
    expect(textoAyuda("La escala va de 0 a 100% siempre.", "La escala va de 0 a 100%")).toBe("La escala va de 0 a 100% siempre.");
  });
  it("un tipo de control desconocido no rompe la tarjeta", () => {
    const nuevo = a("vars", "tipo_que_no_existe" as unknown as ArgMetadata["tipo_input"]);
    expect(camposDeDatos([nuevo, a("corte", "codigos_list")], {}, "p_panorama").map((c) => c.arg.name)).toEqual(["corte"]);
  });
});

describe("ADR 0135 §2: la regla de preguntas en Datos", () => {
  const regla = a("regla", "regla_preguntas");
  const vars = a("vars", "variables_list");
  it("en el panorama sale siempre, después de las preguntas y con su control", () => {
    const campos = camposDeDatos([regla, vars], {}, "p_panorama");
    expect(campos.map((c) => [c.arg.name, c.control])).toEqual([["vars", "variables"], ["regla", "regla_preguntas"]]);
    expect(campos[1].rotulo).toBe("Regla de preguntas");
  });
  it("en la brecha y la divergente, sólo con el estilo resumen o con una regla ya guardada", () => {
    expect(camposDeDatos([regla], { estilo: "recetario" }, "p_barras_divergentes")).toEqual([]);
    expect(camposDeDatos([regla], {}, "p_dumbbell")).toEqual([]);
    expect(camposDeDatos([regla], { estilo: "resumen" }, "p_dumbbell").map((c) => c.arg.name)).toEqual(["regla"]);
    expect(camposDeDatos([regla], { regla: { tipo: "todas" } }, "p_barras_divergentes").map((c) => c.arg.name)).toEqual(["regla"]);
  });
  it("en Fortalezas y alertas sale siempre (sin regla rige la del constructor)", () => {
    expect(camposDeDatos([vars, regla], {}, "p_fortalezas").map((c) => c.arg.name)).toEqual(["vars", "regla"]);
  });
  it("en otro graficador no sale aunque el registro la declare", () => {
    expect(camposDeDatos([regla], { estilo: "resumen" }, "p_barras_agrupadas")).toEqual([]);
  });
});

describe("R6-4: la cabecera plegada de Aspecto cuenta lo propio que no es campo del registro", () => {
  const base = { graficador: "p_barras_agrupadas", conOrden: true, destacadas: [] as string[] };
  it("sin nada propio, nada", () => {
    expect(propiosDeAspecto({ ...base, args: {} })).toEqual([]);
  });
  it("el orden elegido, lo destacado, la letra, el espacio y el eje libre", () => {
    const args = {
      orden_categorias: { modo: "frecuencia", lista: [], invertir: false },
      overrides: { size_ejes: 14, canvas_w_etiquetas: 0.3, usar_eje_libre: true },
    };
    expect(propiosDeAspecto({ ...base, args, destacadas: ["Sí"] })).toEqual(["Orden", "Destacar", "Letra", "Espacio para las etiquetas", "Eje libre"]);
  });
  it("«La más alta» cuenta como destacar; un gráfico que no destaca ni lleva letra no suma eso", () => {
    expect(propiosDeAspecto({ ...base, args: { overrides: { resaltar_mayor: true } } })).toEqual(["Destacar"]);
    expect(propiosDeAspecto({ graficador: "p_torta", conOrden: false, destacadas: null, args: { overrides: { size_ejes: 14 } } })).toEqual([]);
  });
});

describe("R6-15: «Excluir grupos» en las barras con cruce", () => {
  const args = [a("var", "variable"), a("cruces", "variable_opt"), a("excluir_grupos", "codigos_list", "filtro")];
  const nombres = (g: string, v: Record<string, unknown>) => camposDeDatos(args, v, g).map((c) => c.arg.name);
  it("aparece en la apilada y la agrupada con un cruce, y no sin él", () => {
    expect(nombres("p_barras_apiladas", { var: "p1", cruces: ["sexo"] })).toContain("excluir_grupos");
    expect(nombres("p_barras_agrupadas", { var: "p1", cruces: "sexo" })).toContain("excluir_grupos");
    expect(nombres("p_barras_apiladas", { var: "p1" })).not.toContain("excluir_grupos");
  });
  it("en la multiapilada sólo con modo cruce o var_cruce", () => {
    const multi = [...args, a("modo", "choice")];
    const en = (v: Record<string, unknown>) => camposDeDatos(multi, v, "p_barras_multiapiladas").map((c) => c.arg.name);
    expect(en({ modo: "cruce", var: "p1", cruces: ["sexo"] })).toContain("excluir_grupos");
    expect(en({ modo: "var_cruce", vars: ["p1"], cruces: ["sexo"] })).toContain("excluir_grupos");
    expect(en({ modo: "var", vars: ["p1"], cruces: ["sexo"] })).not.toContain("excluir_grupos");
  });
  it("la variable que lista: `grupo` primero; si no, el primer cruce", () => {
    expect(variableQueExcluye("p_histograma", { grupo: "sexo", cruces: ["edad"] })).toBe("sexo");
    expect(variableQueExcluye("p_barras_apiladas", { cruces: ["edad", "zona"] })).toBe("edad");
    expect(variableQueExcluye("p_barras_multiapiladas", { modo: "var", cruces: ["edad"] })).toBe("");
  });
});
