import { describe, expect, it } from "vitest";
import {
  admiteEmparejar,
  admiteIncluir,
  armarUnidades,
  cifrasDeUnidad,
  contarFiltros,
  admiteCambiarTexto,
  destinoDeArrastre,
  ejemplosDeUnidad,
  estadoDeUnidad,
  etiquetaCorta,
  faltaModo,
  faltaOpcionOtros,
  filtroVigente,
  formaDeUnidad,
  papelesDePareja,
  preguntasDeUnidad,
  recibePorDefecto,
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
    expect(una("p3").principal.parent).toBe("p3");
    expect(una("p3").aporta?.parent).toBe("p3_otro");
  });

  it("una pareja cuya columna de texto no está en la lista conserva la columna y queda sin pregunta de texto", () => {
    expect(una("D1")).toMatchObject({ clase: "pareja", columnaTexto: "D1_otro", aporta: null });
  });

  it("una suelta es una sola pregunta, sin columna emparejada ni pregunta que le aporte", () => {
    for (const id of ["p10", "p9", "p11", "p30"]) {
      expect(una(id), id).toMatchObject({ clase: "suelta", aporta: null, columnaTexto: "" });
      expect(preguntasDeUnidad(una(id)).map((p) => p.parent)).toEqual([id]);
    }
  });

  it("desemparejar devuelve el texto a su propia fila", () => {
    const sinPareja = FORMULARIO.map((p) => (p.parent === "p3" ? { ...p, pareja: null, marcada_auto: false } : p));
    expect(armarUnidades(sinPareja).map((u) => u.id)).toContain("p3_otro");
  });
});

// Lo que devuelve el motor tras emparejar (api/R/router_codificacion.R, POST y GET de pareja): solo cambia
// la fila de la pregunta que RECIBE los códigos. Esa fila pasa a traer `pareja.child_col`, queda incluida
// de oficio y, si es de texto, el motor le lee la columna de la otra (`col_efectiva` es la de la pareja,
// y sus cifras y ejemplos salen de ahí). La fila de la que aporta no cambia.
describe("toda pareja guardada es una unidad y ninguna pregunta se pierde", () => {
  const recibe = (p: ReturnType<typeof pregunta>, columna: string, extra: Parameters<typeof pregunta>[2] = {}) => ({
    ...p,
    ...extra,
    marcada: true,
    marcada_auto: true,
    pareja: { child_col: columna, modo_so: p.modo_so, dummy_col: "" },
  });
  const unica = pregunta("transport", "select_one", { q_order: 1, parent_col: "transport" });
  const textoSuyo = pregunta("transport_other", "text", { q_order: 2, col_efectiva: "transport_other", n_respuestas: 31, n_unicas: 20, preview: ["mototaxi"] });
  const otroTexto = pregunta("improve", "text", { q_order: 3, col_efectiva: "improve", preview: ["más personal"] });
  const numerica = pregunta("age", "integer", { q_order: 4, parent_col: "age", col_efectiva: "age" });
  const suelta = pregunta("timing", "select_one", { q_order: 5 });

  /** Las preguntas representadas en las unidades de "Todas". */
  const representadas = (todas: ReturnType<typeof pregunta>[]) => {
    const us = armarUnidades(todas);
    return { unidades: us, vistas: [...new Set(us.flatMap((u) => preguntasDeUnidad(u).map((p) => p.parent)))].sort() };
  };
  const nombres = (todas: ReturnType<typeof pregunta>[]) => todas.map((p) => p.parent).sort();

  it("un texto recibe a una cerrada (lo que pasaba al arrastrar la única sobre su texto): una unidad con las dos", () => {
    // El motor guarda la pareja en la fila del texto y le lee la columna de la cerrada.
    const todas = [unica, recibe(textoSuyo, "transport", { col_efectiva: "transport", preview: ["1", "2"] }), otroTexto, suelta];
    const { unidades: us, vistas } = representadas(todas);
    expect(vistas).toEqual(nombres(todas));
    expect(us.map((u) => `${u.id}:${u.clase}`)).toEqual(["transport_other:pareja", "improve:suelta", "timing:suelta"]);
    const pareja = us[0];
    expect(pareja.principal.parent).toBe("transport_other");
    expect(pareja.aporta?.parent).toBe("transport");
    // La cerrada ya no aparece además como "Pregunta suelta".
    expect(us.some((u) => u.id === "transport")).toBe(false);
    // Lo que aporta una cerrada son códigos: ni cifra de respuestas ni ejemplos.
    expect(cifrasDeUnidad(pareja)).toBeNull();
    expect(ejemplosDeUnidad(pareja)).toEqual([]);
    // Se puede desemparejar, pero no cambiar su texto con el selector de columna de una cerrada.
    expect(unidadEnFiltro(pareja, "con-texto")).toBe(true);
    expect(admiteCambiarTexto(pareja)).toBe(false);
  });

  it("una cerrada recibe a su texto: una unidad con las dos", () => {
    const todas = [recibe(unica, "transport_other", { modo_so: "padre" }), textoSuyo, otroTexto, suelta];
    const { unidades: us, vistas } = representadas(todas);
    expect(vistas).toEqual(nombres(todas));
    expect(us.map((u) => `${u.id}:${u.clase}`)).toEqual(["transport:pareja", "improve:suelta", "timing:suelta"]);
    expect(us[0].aporta?.parent).toBe("transport_other");
    expect(ejemplosDeUnidad(us[0])).toEqual(["mototaxi"]);
    expect(admiteCambiarTexto(us[0])).toBe(true);
  });

  it("dos textos: la que aporta va dentro de la unidad de la que recibe", () => {
    const todas = [unica, textoSuyo, recibe(otroTexto, "transport_other", { col_efectiva: "transport_other" }), suelta];
    const { unidades: us, vistas } = representadas(todas);
    expect(vistas).toEqual(nombres(todas));
    expect(us.map((u) => `${u.id}:${u.clase}`)).toEqual(["transport:suelta", "improve:pareja", "timing:suelta"]);
    expect(us[1].aporta?.parent).toBe("transport_other");
  });

  it("una numérica con una cerrada, en los dos sentidos", () => {
    const cerradaRecibe = [recibe(unica, "age", { modo_so: "padre" }), textoSuyo, numerica];
    expect(representadas(cerradaRecibe).vistas).toEqual(nombres(cerradaRecibe));
    expect(armarUnidades(cerradaRecibe).map((u) => `${u.id}:${u.clase}:${u.aporta?.parent ?? ""}`)).toEqual(["transport:pareja:age", "transport_other:suelta:"]);
    const numericaRecibe = [unica, textoSuyo, recibe(numerica, "transport")];
    expect(representadas(numericaRecibe).vistas).toEqual(nombres(numericaRecibe));
    expect(armarUnidades(numericaRecibe).map((u) => `${u.id}:${u.clase}:${u.aporta?.parent ?? ""}`)).toEqual(["transport_other:suelta:", "age:pareja:transport"]);
  });

  it("una pareja cuya columna no es de ninguna pregunta de la lista conserva la columna", () => {
    const todas = [recibe(unica, "transport_txt_libre", { modo_so: "padre" }), textoSuyo];
    const { unidades: us, vistas } = representadas(todas);
    expect(vistas).toEqual(nombres(todas));
    expect(us[0]).toMatchObject({ clase: "pareja", aporta: null, columnaTexto: "transport_txt_libre" });
    expect(us[1]).toMatchObject({ id: "transport_other", clase: "suelta" });
  });

  it("casos límite: una pregunta que apunta a su propia columna va suelta, y una que aporta y además recibe conserva su fila", () => {
    const aSiMisma = [recibe(textoSuyo, "transport_other"), unica];
    expect(armarUnidades(aSiMisma).map((u) => `${u.id}:${u.clase}`)).toEqual(["transport:suelta", "transport_other:suelta"]);
    expect(representadas(aSiMisma).vistas).toEqual(nombres(aSiMisma));
    const cadena = [recibe(unica, "transport_other", { modo_so: "padre" }), recibe(textoSuyo, "improve", { col_efectiva: "improve" }), otroTexto];
    expect(armarUnidades(cadena).map((u) => `${u.id}:${u.aporta?.parent ?? ""}`)).toEqual(["transport:transport_other", "transport_other:improve"]);
    expect(representadas(cadena).vistas).toEqual(nombres(cadena));
  });

  it("el formulario de prueba completo también cumple el invariante", () => {
    expect(representadas(FORMULARIO).vistas).toEqual(nombres(FORMULARIO));
  });
});

describe("quién recibe los códigos por defecto", () => {
  const unica = pregunta("transport", "select_one");
  const texto = pregunta("transport_other", "text");
  it("si exactamente una es cerrada, recibe la cerrada, se arrastre en el sentido que se arrastre", () => {
    expect(recibePorDefecto(unica, texto)).toBe("origen");
    expect(recibePorDefecto(texto, unica)).toBe("destino");
    expect(recibePorDefecto(unica, pregunta("age", "integer"))).toBe("origen");
  });

  it("si las dos son cerradas o ninguna lo es, recibe la de destino", () => {
    expect(recibePorDefecto(texto, pregunta("improve", "text"))).toBe("destino");
    expect(recibePorDefecto(unica, pregunta("timing", "select_multiple"))).toBe("destino");
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

  it("sin decidir dice cuánto falta, contado sobre el texto que se codifica", () => {
    expect(estadoDeUnidad(una("p9"))?.nota).toBe("27 sin asignar");
    // En la fila de una cerrada emparejada el motor cuenta las únicas de la CERRADA (códigos): lo que
    // falta se cuenta con las únicas de su texto.
    const pareja = armarUnidades([
      pregunta("reason_edp", "select_multiple", {
        col_efectiva: "reason_edp", n_respuestas: 426, n_unicas: 28, n_codificadas: 40, marcada: true, marcada_auto: true, status: "en-curso",
        pareja: { child_col: "reason_edp_other", modo_so: "", dummy_col: "reason_edp/96" },
      }),
      pregunta("reason_edp_other", "text", { col_efectiva: "reason_edp_other", n_respuestas: 72, n_unicas: 67 }),
    ])[0];
    expect(estadoDeUnidad(pareja)?.nota).toBe("27 sin asignar");
    expect(cifrasDeUnidad(pareja)).toBe("72 respuestas, 67 únicas");
  });

  it("si la columna emparejada no es de ninguna pregunta y la cerrada no la lee, no se da cifra", () => {
    // D1 es múltiple: el motor le cuenta su propia columna, no D1_otro, que no está en la lista.
    expect(estadoDeUnidad(una("D1"))?.nota).toBe("Sin categorías");
    expect(cifrasDeUnidad(una("D1"))).toBeNull();
    // Una única que codifica el texto aparte sí lee esa columna: sus cifras valen.
    const aparte = armarUnidades([
      pregunta("p5", "select_one", {
        modo_so: "hijo", col_efectiva: "p5_otro", n_respuestas: 9, n_unicas: 7, n_codificadas: 2, marcada: true, marcada_auto: true, status: "en-curso",
        pareja: { child_col: "p5_otro", modo_so: "hijo", dummy_col: "" },
      }),
    ])[0];
    expect(cifrasDeUnidad(aparte)).toBe("9 respuestas, 7 únicas");
    expect(estadoDeUnidad(aparte)?.nota).toBe("5 sin asignar");
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

  it("los papeles de la pareja: en una de opción única los dice el modo; en las demás, quién recibe y quién aporta", () => {
    expect(papelesDePareja(pregunta("p3", "select_one", { modo_so: "padre" }))).toEqual({ recibe: "Se recodifica con sus opciones", aporta: "Aporta categorías nuevas" });
    expect(papelesDePareja(pregunta("p3", "select_one", { modo_so: "hijo" }))).toEqual({ recibe: "Queda como está", aporta: "Se codifica como texto aparte" });
    expect(papelesDePareja(pregunta("D1", "select_multiple"))).toEqual({ recibe: "Recibe los códigos", aporta: "Aporta las respuestas" });
    expect(papelesDePareja(pregunta("p9", "text"))).toEqual({ recibe: "Recibe los códigos", aporta: "Aporta las respuestas" });
  });
});
