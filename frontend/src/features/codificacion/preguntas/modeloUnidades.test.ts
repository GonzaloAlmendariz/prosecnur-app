import { describe, expect, it } from "vitest";
import {
  admiteEmparejar,
  admiteIncluir,
  armarUnidades,
  cifrasDeUnidad,
  contarFiltros,
  destinoDeArrastre,
  ejemplosDeUnidad,
  estadoDeUnidad,
  etiquetaCorta,
  faltaModo,
  faltaOpcionOtros,
  filtroVigente,
  formaDeUnidad,
  papelesDePareja,
  seccionesVisibles,
  selectorDeEmparejar,
  tieneTexto,
  tipoDeFicha,
  unidadEnFiltro,
  type FiltroPreguntas,
  type Unidad,
} from "./modeloUnidades";
import { FORMULARIO, pregunta } from "./unidadesDePrueba";

const unidades = armarUnidades(FORMULARIO);
const una = (id: string): Unidad => {
  const u = unidades.find((x) => x.id === id);
  if (!u) throw new Error(`sin unidad ${id}`);
  return u;
};

describe("armarUnidades", () => {
  it("un texto que ya es de una pareja no hace fila propia: va dentro de la unidad de su pregunta", () => {
    expect(unidades.map((u) => u.id)).toEqual(["p3", "D1", "p10", "p9", "p10_otro", "p11", "p30"]);
    expect(una("p3")).toMatchObject({ clase: "pareja", columnaTexto: "p3_otro" });
    expect(una("p3").cerrada?.parent).toBe("p3");
    expect(una("p3").texto?.parent).toBe("p3_otro");
  });

  it("una pareja cuya columna de texto no está en la lista conserva la columna y queda sin pregunta de texto", () => {
    expect(una("D1")).toMatchObject({ clase: "pareja", columnaTexto: "D1_otro", texto: null });
  });

  it("una suelta ocupa un solo lado: las cerradas a la izquierda, el texto y la numérica a la derecha", () => {
    expect(una("p10")).toMatchObject({ clase: "suelta", texto: null, columnaTexto: "" });
    expect(una("p10").cerrada?.parent).toBe("p10");
    expect(una("p9").cerrada).toBeNull();
    expect(una("p9").texto?.parent).toBe("p9");
    expect(una("p11").cerrada).toBeNull();
  });

  it("desemparejar devuelve el texto a su propia fila", () => {
    const sinPareja = FORMULARIO.map((p) => (p.parent === "p3" ? { ...p, pareja: null, marcada_auto: false } : p));
    expect(armarUnidades(sinPareja).map((u) => u.id)).toContain("p3_otro");
  });
});

describe("filtros", () => {
  it("cada filtro cuenta exactamente las filas que deja ver", () => {
    const conteos = contarFiltros(unidades);
    expect(conteos).toEqual({ "con-texto": 6, "por-codificar": 2, codificadas: 1, todas: 7 });
    const filtros: FiltroPreguntas[] = ["con-texto", "por-codificar", "codificadas", "todas"];
    for (const filtro of filtros) {
      const filas = seccionesVisibles(unidades, filtro, "").flatMap((s) => s.unidades);
      expect(filas.length, filtro).toBe(conteos[filtro]);
    }
  });

  it("con texto es lo que se codifica: pares y preguntas abiertas; la cerrada sin texto queda para Todas", () => {
    expect(unidades.filter(tieneTexto).map((u) => u.id)).toEqual(["p3", "D1", "p9", "p10_otro", "p11", "p30"]);
    expect(unidadEnFiltro(una("p10"), "con-texto")).toBe(false);
    expect(unidadEnFiltro(una("p10"), "todas")).toBe(true);
  });

  it("una múltiple suelta no es texto aunque el motor le cuente respuestas: sus valores son cadenas de códigos", () => {
    const suelta = armarUnidades([
      pregunta("reason_edp", "select_multiple", { col_efectiva: "reason_edp", n_respuestas: 426, n_unicas: 28, preview: ["5 2 96", "2 5"] }),
    ])[0];
    expect(tieneTexto(suelta)).toBe(false);
    expect(unidadEnFiltro(suelta, "con-texto")).toBe(false);
    expect(unidadEnFiltro(suelta, "todas")).toBe(true);
    // Tampoco se le pinta la cifra ni se le sacan ejemplos: lo que trae son sus propios códigos.
    expect(cifrasDeUnidad(suelta)).toBeNull();
    expect(ejemplosDeUnidad(suelta)).toEqual([]);
  });

  it("una base sin ninguna unidad con texto se muestra en Todas; con alguna, o vacía, se respeta el filtro", () => {
    const soloCerradas = contarFiltros(armarUnidades([pregunta("p1", "select_one"), pregunta("p2", "select_multiple", { n_respuestas: 9, n_unicas: 4 })]));
    expect(soloCerradas["con-texto"]).toBe(0);
    expect(filtroVigente("con-texto", soloCerradas)).toBe("todas");
    expect(filtroVigente("por-codificar", soloCerradas)).toBe("por-codificar");
    expect(filtroVigente("con-texto", contarFiltros(unidades))).toBe("con-texto");
    expect(filtroVigente("con-texto", contarFiltros([]))).toBe("con-texto");
  });

  it("sin decidir son las que tienen una decisión abierta, no todas las marcadas", () => {
    expect(unidades.filter((u) => unidadEnFiltro(u, "por-codificar")).map((u) => u.id)).toEqual(["D1", "p9"]);
    expect(unidadEnFiltro(una("p3"), "por-codificar")).toBe(false);
  });

  it("la búsqueda mira el código, la etiqueta, la sección y la columna de texto de la pareja", () => {
    const ids = (consulta: string) => seccionesVisibles(unidades, "todas", consulta).flatMap((s) => s.unidades.map((u) => u.id));
    expect(ids("p3_otro")).toEqual(["p3"]);
    expect(ids("d1_OTRO")).toEqual(["D1"]);
    expect(ids("etiqueta de p11")).toEqual(["p11"]);
    expect(ids("situación laboral")).toEqual(["p10", "p9", "p10_otro", "p11", "p30"]);
    expect(ids("no existe")).toEqual([]);
  });

  it("las secciones salen en el orden del formulario y solo las que tienen filas", () => {
    expect(seccionesVisibles(unidades, "todas", "").map((s) => s.rotulo)).toEqual(["Datos generales", "Situación laboral"]);
    expect(seccionesVisibles(unidades, "codificadas", "").map((s) => s.rotulo)).toEqual(["Datos generales"]);
  });
});

describe("estado de la unidad", () => {
  it("usa las palabras de los filtros", () => {
    expect(estadoDeUnidad(una("p3"))).toMatchObject({ clave: "codificada", rotulo: "Codificada", tono: "success" });
    expect(estadoDeUnidad(una("D1"))).toMatchObject({ clave: "sin-decidir", rotulo: "Sin decidir", tono: "warn" });
    expect(estadoDeUnidad(una("p30"))).toMatchObject({ clave: "desactivada" });
  });

  it("sin decidir dice cuánto falta", () => {
    expect(estadoDeUnidad(una("p9"))?.nota).toBe("27 sin asignar");
    expect(estadoDeUnidad(una("D1"))?.nota).toBe("12 por agrupar");
  });

  it("una suelta que nadie pidió codificar no tiene estado que mostrar", () => {
    expect(estadoDeUnidad(una("p10"))).toBeNull();
    expect(estadoDeUnidad(una("p10_otro"))).toBeNull();
  });

  it("no se codifica lleva su motivo", () => {
    const descartada = armarUnidades([
      pregunta("p30", "text", { marcada: true, no_categorizar: { motivo: "Dato personal", decidido_en: "2026-11-10" } }),
    ])[0];
    expect(estadoDeUnidad(descartada)).toMatchObject({ clave: "no-se-codifica", rotulo: "No se codifica", nota: "Dato personal" });
  });

  it("una pareja sin nada más que decir se muestra como emparejada", () => {
    const pareja = armarUnidades([
      pregunta("p5", "select_one", { modo_so: "padre", pareja: { child_col: "p5_otro", modo_so: "padre", dummy_col: "" } }),
    ])[0];
    expect(estadoDeUnidad(pareja)).toMatchObject({ clave: "emparejada", rotulo: "Emparejada" });
  });

  it('avisa cuando a una pareja de opción múltiple le falta su opción "Otros"', () => {
    expect(faltaOpcionOtros(una("D1"))).toBe(true);
    expect(faltaOpcionOtros(una("p3"))).toBe(false);
    const conOtros = armarUnidades([
      pregunta("D1", "select_multiple", { pareja: { child_col: "D1_otro", modo_so: "", dummy_col: "D1/99" } }),
    ])[0];
    expect(faltaOpcionOtros(conOtros)).toBe(false);
  });

  it("las cifras concuerdan con el número y faltan cuando no hay respuestas", () => {
    expect(cifrasDeUnidad(una("p9"))).toBe("142 respuestas, 97 únicas");
    expect(cifrasDeUnidad(armarUnidades([pregunta("p1", "text", { n_respuestas: 1, n_unicas: 1 })])[0])).toBe("1 respuesta, 1 única");
    expect(cifrasDeUnidad(una("p10"))).toBeNull();
  });
});

describe("lo que muestra el inspector", () => {
  it("los ejemplos son del texto que se codifica: los de la pregunta abierta de la pareja, no los códigos de la cerrada", () => {
    const pareja = armarUnidades([
      pregunta("D1", "select_multiple", { preview: ["5", "2", "96", "2 5"], pareja: { child_col: "D1_otro", modo_so: "", dummy_col: "" } }),
      pregunta("D1_otro", "text", { col_efectiva: "D1_otro", preview: ["por refugio", " ", "me derivaron"] }),
    ])[0];
    expect(ejemplosDeUnidad(pareja)).toEqual(["por refugio", "me derivaron"]);
  });

  it("sin pregunta de texto con ejemplos no hay ejemplos; una abierta suelta da los suyos, hasta el máximo", () => {
    expect(ejemplosDeUnidad(una("D1"))).toEqual([]);
    expect(ejemplosDeUnidad(una("p10"))).toEqual([]);
    const abierta = armarUnidades([pregunta("p9", "text", { preview: ["a", "b", "c", "d", "e", "f"] })])[0];
    expect(ejemplosDeUnidad(abierta)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("a una pareja de opción única sin modo le falta decidirlo", () => {
    expect(faltaModo(una("p3"))).toBe(false);
    const sinModo = armarUnidades([pregunta("p5", "select_one", { pareja: { child_col: "p5_otro", modo_so: "", dummy_col: "" } })])[0];
    expect(faltaModo(sinModo)).toBe(true);
    expect(faltaModo(una("D1"))).toBe(false);
  });
});

describe("emparejar", () => {
  it("solo las sueltas activas se levantan y reciben", () => {
    expect(unidades.filter(admiteEmparejar).map((u) => u.id)).toEqual(["p10", "p9", "p10_otro", "p11"]);
  });

  it("un texto sobre una cerrada sin pareja se une de inmediato", () => {
    expect(destinoDeArrastre(una("p10_otro"), una("p10"))).toBe("directo");
  });

  it("cualquier otra combinación de dos sueltas pide decidir la dirección", () => {
    expect(destinoDeArrastre(una("p10"), una("p10_otro"))).toBe("con-dialogo");
    expect(destinoDeArrastre(una("p11"), una("p10"))).toBe("con-dialogo");
    expect(destinoDeArrastre(una("p9"), una("p10_otro"))).toBe("con-dialogo");
  });

  it("sobre una pareja, sobre una desactivada o sobre sí misma no pasa nada", () => {
    expect(destinoDeArrastre(una("p10_otro"), una("p3"))).toBeNull();
    expect(destinoDeArrastre(una("p3"), una("p10"))).toBeNull();
    expect(destinoDeArrastre(una("p10_otro"), una("p30"))).toBeNull();
    expect(destinoDeArrastre(una("p10"), una("p10"))).toBeNull();
  });

  it("sin arrastrar: una cerrada elige su columna de texto y el resto, otra pregunta", () => {
    expect(selectorDeEmparejar(una("p10"))).toBe("columna");
    expect(selectorDeEmparejar(una("p10_otro"))).toBe("pregunta");
    expect(selectorDeEmparejar(una("p11"))).toBe("pregunta");
    expect(selectorDeEmparejar(una("p3"))).toBeNull();
    expect(selectorDeEmparejar(una("p30"))).toBeNull();
  });
});

describe("incluir en codificación", () => {
  it("lo llevan las parejas y los textos o numéricas sueltas; una cerrada sin texto y una desactivada no", () => {
    expect(unidades.filter(admiteIncluir).map((u) => u.id)).toEqual(["p3", "D1", "p9", "p10_otro", "p11"]);
  });
});

describe("presentación", () => {
  it("cada tipo de pregunta tiene su color de ficha; uno desconocido va como texto", () => {
    expect(["select_one", "select_multiple", "integer", "text", "otro"].map(tipoDeFicha)).toEqual(["unica", "multiple", "numerica", "texto", "texto"]);
  });

  it("la forma de la unidad: dos bloques enlazados, un bloque a todo el ancho o un bloque en su lado", () => {
    expect(["p3", "D1", "p10", "p9", "p10_otro", "p11", "p30"].map((id) => formaDeUnidad(una(id)))).toEqual([
      "pareja", "pareja", "cerrada", "abierta", "abierta", "abierta", "abierta",
    ]);
  });

  it("la etiqueta corta va sin marcado y acortada", () => {
    expect(etiquetaCorta("<b>¿Trabaja?</b>")).toBe("¿Trabaja?");
    const larga = etiquetaCorta("a".repeat(200), 20);
    expect(larga).toHaveLength(20);
    expect(larga.endsWith("…")).toBe(true);
  });

  it("los papeles de la pareja dependen del modo, y sin modo no se dice nada", () => {
    expect(papelesDePareja("padre")).toEqual({ cerrada: "Se recodifica con sus opciones", texto: "Aporta categorías nuevas" });
    expect(papelesDePareja("hijo")).toEqual({ cerrada: "Queda como está", texto: "Se codifica como texto aparte" });
    expect(papelesDePareja("")).toBeNull();
  });
});
