import { beforeEach, describe, expect, it } from "vitest";
import type { Slide, SlideType, VarInfo } from "../../../../api/graficos";
import { payloadPorDefecto, SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { conOpcion, type EstudioDelSelector } from "../selectores/opcionesLamina";
import {
  alternarPublico, contarElegidas, escalaDominante, escalasPorPublico, FALTA_DIVIDE, indicadoresDelEstudio, insertarTras,
  laminaDePropuesta, laminasDelMazo, META_NOMBRE, nombreAccesible, listaPublicos, mensajeInsertadas, moverA, ordenarPropuestas, ordenPublicos, proponerMazo,
  publicoEnFrase, REFERENCIA_POR_DEFECTO, reglaEnPalabras, rotuloInsertar, textoElegidas, unirPublicos, type EntradaMazo,
} from "./modeloMazo";
import { nombreSinTitulo } from "../tituloQueSale";
import { origenesDelPlan } from "../cierreHallazgos/modeloCierre";

const ARGS: Record<string, string[]> = {
  p_panorama: ["vars", "corte", "corte_etiqueta", "regla", "referencia"],
  p_dumbbell: ["cruce", "grupos", "corte", "corte_etiqueta", "regla", "estilo", "orden"],
  p_barras_divergentes: ["var", "vars", "regla", "estilo", "orden"],
  p_fortalezas: ["vars", "corte", "corte_etiqueta", "n", "regla", "universos"],
  p_cobertura: ["bases", "universos", "metas", "extras"],
};
const ORDEN_DIVERGENTES = ["top_two_box", "sin_informacion", "declarado"];

const admiteArg = (g: string, arg: string, valor?: string) =>
  (ARGS[g] ?? []).includes(arg) && (valor === undefined || g !== "p_barras_divergentes" || arg !== "orden" || ORDEN_DIVERGENTES.includes(valor));

const TIPOS = new Set(Object.keys(SLIDE_GRAF_SLOTS) as SlideType[]);

const estudio: EstudioDelSelector = { bases: ["docentes", "estudiantes"], baseActiva: "estudiantes" };

function entrada(extra: Partial<EntradaMazo> = {}): EntradaMazo {
  return {
    estudio,
    publicos: estudio.bases,
    graficadores: new Set(Object.keys(ARGS)),
    laminas: new Set(["p_slide_1_grafico"]),
    tiposInsertables: TIPOS,
    admiteArg,
    indicador: null,
    referencia: 60,
    ...extra,
  };
}

const grafico = (args: Record<string, unknown>) => args;

describe("el mazo propone en orden (ADR 0135; maqueta Mazo)", () => {
  it("con dos públicos: cobertura, panorama, contraste, las dos escalas, aperturas y una de fortalezas por público", () => {
    expect(proponerMazo(entrada()).map((p) => p.id)).toEqual([
      "cobertura", "panorama", "contraste", "escala_umbral", "escala_sin_info", "aperturas", "fortalezas:docentes", "fortalezas:estudiantes",
    ]);
  });

  it("el contraste sólo con dos públicos o más", () => {
    const ids = proponerMazo(entrada({ publicos: ["docentes"] })).map((p) => p.id);
    expect(ids).not.toContain("contraste");
    expect(ids).toContain("fortalezas:docentes");
  });

  it("sin públicos no propone nada; sin cobertura ni fortalezas en el registro, no aparecen", () => {
    expect(proponerMazo(entrada({ publicos: [] }))).toEqual([]);
    const ids = proponerMazo(entrada({ graficadores: new Set(["p_panorama", "p_dumbbell", "p_barras_divergentes"]) })).map((p) => p.id);
    expect(ids).toEqual(["panorama", "contraste", "escala_umbral", "escala_sin_info", "aperturas"]);
  });

  it("el cierre con hallazgos es el último paso cuando el registro lo trae, como lámina de resumen", () => {
    const props = proponerMazo(entrada({ laminas: new Set(["p_slide_1_grafico", "p_slide_cierre_hallazgos"]) }));
    const ultima = props[props.length - 1];
    expect(ultima).toMatchObject({ id: "cierre", tipo: "p_slide_cierre_hallazgos", nombre: "Cierre con hallazgos", claseTarjeta: "resumen" });
    expect(proponerMazo(entrada()).map((p) => p.id)).not.toContain("cierre");
    const sinInsertar = new Set([...TIPOS].filter((t) => t !== "p_slide_cierre_hallazgos"));
    expect(proponerMazo(entrada({ tiposInsertables: sinInsertar, laminas: new Set(["p_slide_1_grafico", "p_slide_cierre_hallazgos"]) })).map((p) => p.id)).not.toContain("cierre");
  });

  it("la lámina del cierre nace con los hallazgos vacíos y sin título", () => {
    const props = proponerMazo(entrada({ laminas: new Set(["p_slide_1_grafico", "p_slide_cierre_hallazgos"]) }));
    const cierre = props.find((p) => p.id === "cierre");
    const s = cierre && laminaDePropuesta(cierre, "s-9");
    expect(s?.payload).toMatchObject({ titulo: "", hallazgos: [] });
  });

  it("los públicos respetan el orden elegido en la franja (el del panorama y la cobertura)", () => {
    const props = proponerMazo(entrada({ publicos: ["estudiantes", "docentes"] }));
    expect(props.find((x) => x.id === "panorama")?.args.vars).toEqual(["estudiantes$*", "docentes$*"]);
    expect(props.find((x) => x.id === "cobertura")?.args.bases).toEqual(["estudiantes", "docentes"]);
    expect(props.filter((x) => x.clase === "fortalezas").map((x) => x.id)).toEqual(["fortalezas:estudiantes", "fortalezas:docentes"]);
    expect(proponerMazo(entrada({ publicos: ["otra", "docentes"] })).find((x) => x.id === "panorama")?.args.vars).toEqual(["docentes$*"]);
  });

  it("el orden de los públicos: lo elegido, una base nueva detrás, y mover uno no se sale de la lista", () => {
    expect(ordenPublicos(null, ["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(ordenPublicos(["c", "a", "x"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
    expect(moverA(["a", "b", "c"], "c", "b")).toEqual(["a", "c", "b"]);
    expect(moverA(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moverA(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moverA(["a", "b", "c"], "a", "x")).toEqual(["a", "b", "c"]);
    expect(alternarPublico(["c", "a"], "b", ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });
});

describe("lámina del mazo = lámina del selector", () => {
  it("sin franja que aplicar, el panorama es el del selector «¿Qué quieres contar?»", () => {
    const sinFranja = entrada({ admiteArg: () => false });
    const p = proponerMazo(sinFranja).find((x) => x.id === "panorama");
    const delSelector = conOpcion("p_slide_1_grafico:panorama", payloadPorDefecto("p_slide_1_grafico"), estudio);
    expect(p && laminaDePropuesta(p, "s-1").payload.grafico).toEqual(delSelector.grafico);
  });

  it("la cobertura nace con todas las bases del mazo, como en el selector", () => {
    const p = proponerMazo(entrada()).find((x) => x.id === "cobertura");
    expect(p?.args).toEqual({ bases: ["docentes", "estudiantes"] });
  });
});

describe("la franja y la regla", () => {
  const indicador = { id: "top2box", etiqueta: "Top Two Box", rotulo: "De acuerdo + Totalmente de acuerdo (Top Two Box)", codigos: ["4", "5"] };

  it("el indicador escribe el corte: lista en el panorama, cadena en el contraste; la escala no tiene corte", () => {
    const ps = proponerMazo(entrada({ indicador }));
    const de = (id: string) => ps.find((p) => p.id === id)?.args ?? {};
    expect(de("panorama")).toMatchObject({ corte: ["4", "5"], corte_etiqueta: "Top Two Box" });
    expect(de("contraste")).toMatchObject({ corte: "4,5", corte_etiqueta: "Top Two Box" });
    expect(de("escala_umbral").corte).toBeUndefined();
  });

  it("la referencia va a la línea del panorama y al umbral de la escala", () => {
    const ps = proponerMazo(entrada({ referencia: 70 }));
    expect(ps.find((p) => p.id === "panorama")?.args.referencia).toBe(70);
    expect(ps.find((p) => p.id === "escala_umbral")?.args.regla).toEqual({ tipo: "bajo_umbral", umbral: 70 });
    expect(ps.find((p) => p.id === "escala_umbral")?.nombre).toBe("Escala bajo 70%");
  });

  it("contraste: las 13 de mayor diferencia; escala por Sin información: las 12 y ordenada así si el graficador lo admite", () => {
    const ps = proponerMazo(entrada());
    expect(ps.find((p) => p.id === "contraste")?.args.regla).toEqual({ tipo: "mayor_diferencia", n: 13 });
    const sinInfo = ps.find((p) => p.id === "escala_sin_info");
    expect(sinInfo?.args).toMatchObject({ regla: { tipo: "mayor_sin_info", n: 12 }, orden: "sin_informacion", estilo: "resumen" });
    const sinOrden = proponerMazo(entrada({ admiteArg: (g, a, v) => !(a === "orden" && v === "sin_informacion") && admiteArg(g, a, v) }));
    expect(sinOrden.find((p) => p.id === "escala_sin_info")?.args.orden).toBeUndefined();
  });

  it("contraste con tres públicos: UN par, los dos primeros de la franja, con `bases` y su antetítulo (prueba con Arte)", () => {
    const tres: EstudioDelSelector = { bases: ["docentes", "estudiantes", "administrativos"], baseActiva: "estudiantes" };
    const ps = proponerMazo(entrada({ estudio: tres, publicos: tres.bases }));
    const c = ps.find((p) => p.id === "contraste");
    expect(c?.args).toMatchObject({ estilo: "resumen", bases: ["docentes", "estudiantes"], regla: { tipo: "mayor_diferencia", n: 13 } });
    expect(c?.publicos).toEqual(["docentes", "estudiantes"]);
    expect(c?.reglaEnPalabras).toBe("Las 13 de mayor diferencia, de docentes y estudiantes");
    // Reordenar la franja cambia el par.
    const otro = proponerMazo(entrada({ estudio: tres, publicos: ["administrativos", "docentes", "estudiantes"] })).find((p) => p.id === "contraste");
    expect(otro?.args.bases).toEqual(["administrativos", "docentes"]);
    expect(otro?.publicos).toEqual(["administrativos", "docentes"]);
    // La lámina que entra lleva el par en el payload del gráfico.
    const lamina = c && laminaDePropuesta(c, "s-1");
    expect(JSON.stringify(lamina?.payload)).toContain('"bases":["docentes","estudiantes"]');
  });

  it("una regla editada en el mazo manda sobre la de partida", () => {
    const ps = proponerMazo(entrada({ reglas: { contraste: { tipo: "diferencia_minima", umbral: 15 } } }));
    const c = ps.find((p) => p.id === "contraste");
    expect(c?.args.regla).toEqual({ tipo: "diferencia_minima", umbral: 15 });
    expect(c?.reglaEnPalabras).toBe("Con diferencia de al menos 15 puntos, de docentes y estudiantes");
  });

  it("aperturas entra con su aviso y sin pregunta que divide; aperturas y fortalezas leen un público", () => {
    const ps = proponerMazo(entrada());
    const a = ps.find((p) => p.id === "aperturas");
    expect(a?.falta).toBe(FALTA_DIVIDE);
    expect(a?.args.cruce).toBeUndefined();
    expect(ps.find((p) => p.id === "fortalezas:docentes")?.args.vars).toEqual(["docentes$*"]);
  });

  it("con 2+ públicos, Brechas e Información son UNA lámina cada una sobre todos, en el orden de la franja", () => {
    const ps = proponerMazo(entrada({ publicos: ["estudiantes", "docentes"] }));
    const u = ps.find((p) => p.id === "escala_umbral");
    const s = ps.find((p) => p.id === "escala_sin_info");
    expect(ps.filter((p) => p.clase === "escala_umbral" || p.clase === "escala_sin_info")).toHaveLength(2);
    expect(u?.args.vars).toEqual(["estudiantes$*", "docentes$*"]);
    expect(s?.args.vars).toEqual(["estudiantes$*", "docentes$*"]);
    expect(u?.args.regla).toEqual({ tipo: "bajo_umbral", umbral: 60 });
    expect(s?.args.regla).toEqual({ tipo: "mayor_sin_info", n: 12 });
    expect(u?.reglaEnPalabras).toBe("Bajo 60%, de estudiantes y docentes");
    expect(s?.reglaEnPalabras).toBe("Las 12 de más Sin información, de estudiantes y docentes");
    const uno = proponerMazo(entrada({ publicos: ["docentes"] }));
    expect(uno.find((p) => p.id === "escala_umbral")?.args.vars).toEqual(["docentes$*"]);
    expect(uno.find((p) => p.id === "escala_umbral")?.reglaEnPalabras).toBe("Bajo 60%, de docentes");
  });
});

describe("los públicos que lee cada tarjeta y las palabras", () => {
  it("cada propuesta dice qué públicos lee; Brechas e Información, todos, y aperturas, el principal", () => {
    const leen = Object.fromEntries(proponerMazo(entrada()).map((p) => [p.id, p.publicos]));
    expect(leen).toMatchObject({
      cobertura: ["docentes", "estudiantes"],
      panorama: ["docentes", "estudiantes"],
      contraste: ["docentes", "estudiantes"],
      escala_umbral: ["docentes", "estudiantes"],
      escala_sin_info: ["docentes", "estudiantes"],
      aperturas: ["estudiantes"],
      "fortalezas:docentes": ["docentes"],
    });
    const uno = Object.fromEntries(proponerMazo(entrada({ publicos: ["docentes"] })).map((p) => [p.id, p.publicos]));
    expect(uno.escala_umbral).toEqual(["docentes"]);
  });

  it("la regla en palabras", () => {
    expect(listaPublicos(["estudiantes", "docentes", "personal_admin"])).toBe("Estudiantes, docentes y personal admin");
    expect(reglaEnPalabras({ tipo: "todas" }, ["docentes", "estudiantes"])).toBe("Todas las preguntas de escala, de docentes y estudiantes");
    expect(reglaEnPalabras({ tipo: "bajo_umbral", umbral: 60 }, ["docentes"])).toBe("Bajo 60%, de docentes");
    expect(reglaEnPalabras({ tipo: "extremos", n: 5 }, ["docentes"])).toBe("Las 5 más altas y las 5 más bajas, de docentes");
    expect(proponerMazo(entrada()).find((p) => p.id === "fortalezas:docentes")?.reglaEnPalabras)
      .toBe("Las 5 más altas y las 5 más bajas, de docentes");
  });
});

describe("la escala del estudio", () => {
  const opciones = (labels: string[]) => labels.map((label, i) => ({ name: String(i + 1), label }));
  const v = (name: string, labels: string[], tipo = "select_one"): VarInfo => ({ name, label: name, tipo, seccion: "", choices: opciones(labels) });
  const acuerdo = ["Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"];
  const fuentes = [
    { name: "docentes", variables: [v("p1", acuerdo), v("p2", acuerdo), v("sexo", ["Mujer", "Hombre"]), v("p3", acuerdo, "select_multiple")] },
    { name: "estudiantes", variables: [v("q1", ["Nada", "Poco", "Algo", "Mucho"])] },
  ];

  it("cuenta las de escala por público y toma la escala más repetida sin «Sin información»", () => {
    expect(escalasPorPublico(fuentes, ["docentes", "estudiantes"])).toEqual({ docentes: 2, estudiantes: 1 });
    expect(escalaDominante(fuentes, ["docentes", "estudiantes"]).map((o) => o.label)).toEqual(acuerdo.slice(0, 5));
  });

  it("Top Two Box es el de partida y nombra sus respuestas", () => {
    const ind = indicadoresDelEstudio(escalaDominante(fuentes, ["docentes"]));
    expect(ind[0]).toEqual({ id: "top2box", etiqueta: "Top Two Box", rotulo: "De acuerdo + Totalmente de acuerdo (Top Two Box)", codigos: ["4", "5"] });
    expect(ind.map((i) => i.id)).toEqual(["top2box", "topbox", "bottom2box"]);
    expect(indicadoresDelEstudio([])).toEqual([]);
  });
});

describe("elegir y ordenar (el mazo arranca sin elegir)", () => {
  it("sin elegidas no inserta nada; el botón dice «Insertar láminas»", () => {
    expect(laminasDelMazo(proponerMazo(entrada()), {}, () => "s")).toEqual([]);
    expect(rotuloInsertar(0)).toBe("Insertar láminas");
  });

  it("los textos de la elección y del aviso", () => {
    expect(textoElegidas(4, 10)).toBe("4 de 10 elegidas");
    expect(textoElegidas(1, 10)).toBe("1 de 10 elegida");
    expect(textoElegidas(0, 10)).toBe("Ninguna de 10 elegida");
    expect(mensajeInsertadas(8)).toBe("Se insertaron 8 láminas");
    expect(mensajeInsertadas(1)).toBe("Se insertó 1 lámina");
  });

  it("una elección de una propuesta que ya no está no cuenta", () => {
    const ps = proponerMazo(entrada({ publicos: ["docentes"] }));
    expect(contarElegidas(ps, { panorama: true, "fortalezas:estudiantes": true })).toBe(1);
  });

  it("el orden del analista manda; lo que no nombra, detrás en su orden", () => {
    const ps = proponerMazo(entrada());
    const ids = ordenarPropuestas(ps, ["fortalezas:docentes", "panorama", "ya-no-esta"]).map((p) => p.id);
    expect(ids.slice(0, 3)).toEqual(["fortalezas:docentes", "panorama", "cobertura"]);
    expect(ids).toHaveLength(ps.length);
    expect(ordenarPropuestas(ps, null).map((p) => p.id)).toEqual(ps.map((p) => p.id));
  });

  it("los exports que usan otros módulos siguen", () => {
    expect(REFERENCIA_POR_DEFECTO).toBe(60);
    expect(unirPublicos(["a_b", "c"])).toBe("a b y c");
    expect(publicoEnFrase("personal_admin")).toBe("personal admin");
  });
});

describe("insertar", () => {
  it("las elegidas, en el orden de las propuestas, sin título ni antetítulo y con origen «resumen»", () => {
    let n = 0;
    const ps = ordenarPropuestas(proponerMazo(entrada()), ["contraste", "cobertura"]);
    const nuevas = laminasDelMazo(ps, { cobertura: true, contraste: true, "fortalezas:docentes": true }, () => `s-${++n}`);
    expect(nuevas).toHaveLength(3);
    expect(nuevas[0]).toMatchObject({ id: "s-1", tipo: "p_slide_1_grafico", origen: "resumen" });
    expect(grafico(nuevas[0].payload.grafico as Record<string, unknown>)).toMatchObject({ graficador: "p_dumbbell" });
    for (const s of nuevas) {
      expect(s.payload).toMatchObject({ titulo: "" });
      expect(JSON.stringify(s.payload)).not.toContain("antetitulo");
    }
  });

  it("detrás de la lámina del foco o al final", () => {
    const viejas: Slide[] = [{ id: "a", tipo: "p_slide_texto", payload: {} }, { id: "b", tipo: "p_slide_texto", payload: {} }];
    const nuevas: Slide[] = [{ id: "x", tipo: "p_slide_texto", payload: {} }, { id: "y", tipo: "p_slide_texto", payload: {} }];
    expect(insertarTras(viejas, nuevas, 1).map((s) => s.id)).toEqual(["a", "x", "y", "b"]);
    expect(insertarTras(viejas, nuevas, null).map((s) => s.id)).toEqual(["a", "b", "x", "y"]);
    expect(rotuloInsertar(8)).toBe("Insertar 8 láminas");
    expect(rotuloInsertar(1)).toBe("Insertar 1 lámina");
  });

  it("el último público no se apaga y el orden es el del estudio", () => {
    expect(alternarPublico(["docentes"], "docentes", ["docentes", "estudiantes"])).toEqual(["docentes"]);
    expect(alternarPublico(["estudiantes"], "docentes", ["docentes", "estudiantes"])).toEqual(["docentes", "estudiantes"]);
  });
});

describe("un solo paso de deshacer", () => {
  beforeEach(() => {
    usePlanStore.setState({ plan: { slides: [{ id: "a", tipo: "p_slide_texto", payload: {} }] }, past: [], future: [], selectedSlideId: "a" });
  });

  it("insertar el mazo y deshacer una vez deja el plan como estaba", () => {
    let n = 0;
    const ps = proponerMazo(entrada());
    const nuevas = laminasDelMazo(ps, Object.fromEntries(ps.map((p) => [p.id, true as const])), () => `s-${++n}`);
    usePlanStore.getState().transformarLaminas((slides) => insertarTras(slides, nuevas, 1));
    expect(usePlanStore.getState().plan.slides).toHaveLength(1 + nuevas.length);
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.slides.map((s) => s.id)).toEqual(["a"]);
  });
});

describe("M2: la lámina insertada se nombra como la propuesta", () => {
  it("el nombre va en meta.nombre, sin título ni antetítulo", () => {
    const p = {
      id: "escala_umbral", clase: "escala_umbral", tarjeta: "p_slide_1_grafico:escala", tipo: "p_slide_1_grafico", nombre: "Escala bajo 60%",
      claseTarjeta: "resumen", publicos: ["docentes"], graficador: "p_barras_divergentes", slot: "grafico", args: { estilo: "resumen" },
      reglaEnPalabras: "", falta: null,
    } as const satisfies Parameters<typeof laminaDePropuesta>[0];
    const s = laminaDePropuesta({ ...p, publicos: [...p.publicos], args: { ...p.args } }, "s-1");
    expect((s.payload.meta as Record<string, unknown>)[META_NOMBRE]).toBe("Escala bajo 60%, Docentes");
    expect(s.payload).toMatchObject({ titulo: "" });
    expect(JSON.stringify(s.payload)).not.toContain("antetitulo");
  });
});

describe("M8: las láminas del mismo gráfico se distinguen por su público en la Estructura y en Elegir cifra", () => {
  it("las tres «Fortalezas y alertas» insertadas llevan nombres distintos en meta.nombre, y la Estructura y el cierre los leen", () => {
    const tres = proponerMazo(entrada({ estudio: { bases: ["docentes", "estudiantes", "administrativos"], baseActiva: null },
      publicos: ["docentes", "estudiantes", "administrativos"] })).filter((p) => p.clase === "fortalezas");
    expect(tres).toHaveLength(3);
    const slides = tres.map((p, i) => laminaDePropuesta(p, `s-${i}`));
    const nombres = slides.map((s) => nombreSinTitulo(s));
    expect(nombres).toEqual(["Fortalezas y alertas, Docentes", "Fortalezas y alertas, Estudiantes", "Fortalezas y alertas, Administrativos"]);
    expect(origenesDelPlan(slides).map((o) => o.nombre)).toEqual([
      "Lámina 1: Fortalezas y alertas, Docentes", "Lámina 2: Fortalezas y alertas, Estudiantes", "Lámina 3: Fortalezas y alertas, Administrativos",
    ]);
  });
});

describe("M4: el nombre accesible de la tarjeta lleva el público", () => {
  it("«Fortalezas y alertas, Docentes»; sin públicos, el nombre solo", () => {
    expect(nombreAccesible({ nombre: "Fortalezas y alertas", publicos: ["docentes"] })).toBe("Fortalezas y alertas, Docentes");
    expect(nombreAccesible({ nombre: "Cierre con hallazgos", publicos: [] })).toBe("Cierre con hallazgos");
  });
});
