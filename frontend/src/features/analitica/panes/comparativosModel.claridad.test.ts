// Ronda de claridad (U2-U4): N mediciones, bases sin año y la lista agrupada.
import { describe, expect, it } from "vitest";
import {
  agruparPorSeccion,
  coberturaPorMedicion,
  comparativosReducer,
  estadoDeCasilla,
  contadorElegidas,
  estadoInicial,
  filtrarFilas,
  rotulosPorDefecto,
  rotulosRepetidos,
  tituloDeSeccion,
  type FilaArmonizada,
} from "./comparativosModel";

function fila(clave: string, parcial: Partial<FilaArmonizada> = {}): FilaArmonizada {
  return {
    clave,
    ref: clave,
    claveNota: clave,
    etiqueta: `Pregunta ${clave}`,
    seccion: "",
    basesComparables: [],
    basesSinVariable: [],
    nCategorias: 3,
    seleccionable: true,
    ...parcial,
  };
}

describe("rótulos por defecto", () => {
  it("usa el año cuando el nombre lo trae y el nombre entero cuando no", () => {
    expect(rotulosPorDefecto(["b2024", "b2025", "docentes"])).toEqual({
      b2024: "2024",
      b2025: "2025",
      docentes: "docentes",
    });
  });

  it("no repite un año que nombra a dos bases: conserva el nombre de cada una", () => {
    expect(rotulosPorDefecto(["enc_2024_docentes", "enc_2024_estudiantes", "enc_2025"])).toEqual({
      enc_2024_docentes: "enc_2024_docentes",
      enc_2024_estudiantes: "enc_2024_estudiantes",
      enc_2025: "2025",
    });
  });

  it("siete bases sin año salen con sus siete nombres", () => {
    const bases = ["a", "b", "c", "d", "e", "f", "g"];
    expect(Object.values(rotulosPorDefecto(bases))).toEqual(bases);
    expect(estadoInicial([], bases).rotulos).toEqual(Object.fromEntries(bases.map((b) => [b, b])));
  });

  it("avisa los rótulos que titulan a más de una medición", () => {
    expect(rotulosRepetidos({ a: "2024", b: "2024", c: "2025" }, ["a", "b", "c"])).toEqual(["2024"]);
    expect(rotulosRepetidos({ a: "", b: "b" }, ["a", "b"])).toEqual([]);
  });
});

describe("cobertura por medición", () => {
  it("da un estado por medición, en el orden de la serie y con su rótulo", () => {
    const f = fila("0", { basesComparables: ["docentes", "egresados"], basesSinVariable: ["administrativos"] });
    const cob = coberturaPorMedicion(f, ["docentes", "estudiantes", "egresados", "administrativos"], { egresados: "Egresados" });
    expect(cob).toEqual([
      { base: "docentes", rotulo: "docentes", estado: "comparable" },
      { base: "estudiantes", rotulo: "estudiantes", estado: "no-comparable" },
      { base: "egresados", rotulo: "Egresados", estado: "comparable" },
      { base: "administrativos", rotulo: "administrativos", estado: "sin-variable" },
    ]);
  });
});

describe("lista agrupada", () => {
  const filas = [
    fila("0", { seccion: "Clima", etiqueta: "Acoso" }),
    fila("1", { seccion: "pag3", etiqueta: "Edad" }),
    fila("2", { seccion: "Clima", etiqueta: "Discriminación" }),
    fila("3", { seccion: "", etiqueta: "Sexo", seleccionable: false }),
  ];

  it("agrupa por sección en el orden de la matriz y nombra las secciones legibles", () => {
    const grupos = agruparPorSeccion(filas);
    expect(grupos.map((g) => g.titulo)).toEqual(["Clima", "Página 3 del formulario", "Sin sección"]);
    expect(grupos[0].filas.map((f) => f.clave)).toEqual(["0", "2"]);
    expect(tituloDeSeccion("pagina_12")).toBe("Página 12 del formulario");
  });

  it("el rótulo de sección pierde la numeración y el punto medio de la matriz", () => {
    expect(tituloDeSeccion("7. Tema · subtema")).toBe("Tema (subtema)");
  });

  it("la casilla de sección dice todas, ninguna o algunas", () => {
    expect(estadoDeCasilla(["0", "2"], ["0", "2", "9"])).toBe("todas");
    expect(estadoDeCasilla(["0", "2"], ["2"])).toBe("algunas");
    expect(estadoDeCasilla(["0", "2"], [])).toBe("ninguna");
  });

  it("busca sin tildes ni mayúsculas en la etiqueta y en la sección", () => {
    expect(filtrarFilas(filas, "discriminacion").map((f) => f.clave)).toEqual(["2"]);
    expect(filtrarFilas(filas, "CLIMA").map((f) => f.clave)).toEqual(["0", "2"]);
    expect(filtrarFilas(filas, "página 3").map((f) => f.clave)).toEqual(["1"]);
    expect(filtrarFilas(filas, "  ")).toHaveLength(4);
  });

  it("cuenta las elegidas entre las que se pueden elegir", () => {
    expect(contadorElegidas(filas, ["0", "3"])).toBe("1 elegida de 3");
    expect(contadorElegidas(filas, ["0", "1"])).toBe("2 elegidas de 3");
  });

  it("elige y suelta una sección entera sin tocar las demás", () => {
    const ui = estadoInicial(filas, ["a", "b"]);
    const sin = comparativosReducer(ui, { tipo: "elegir-preguntas", claves: ["0", "2"], valor: false });
    expect(sin.preguntas).toEqual(["1"]);
    const con = comparativosReducer(sin, { tipo: "elegir-preguntas", claves: ["0", "2"], valor: true });
    expect([...con.preguntas].sort()).toEqual(["0", "1", "2"]);
    // Elegir dos veces no duplica.
    const otra = comparativosReducer(con, { tipo: "elegir-preguntas", claves: ["0"], valor: true });
    expect(otra.preguntas.filter((c) => c === "0")).toHaveLength(1);
  });
});

import { normalizarComparativoResultado } from "../../../api/analitica";
import {
  avisosGenerales,
  celdaSinVariable,
  direccionDeOmitida,
  omitidasDe,
  textoMotivoOmision,
} from "./comparativosModel";

describe("filas omitidas y sin variable", () => {
  const datos = normalizarComparativoResultado({
    periodos: [{ base: "sede_a", rotulo: "Sede A" }, { base: "sede_b", rotulo: "Sede B" }],
    resumen: {
      preguntas: [
        { titulo: "P1", sin_variable: ["sede_b"] },
        { titulo: "P2", sin_variable: [{ base: "sede_a", fila: "Sexo" }] },
        { titulo: "P3", sin_variable: {} },
      ],
      omitidas: [
        { fila: "q9", titulo: "Medios", tipo: "pregunta", motivo: "select_multiple", base: "sede_a", codigos: [], detalle: "Es de respuesta múltiple." },
        { fila: "q10", titulo: "Turno", tipo: "cruce", motivo: "mapa_roto", base: "sede_b", codigos: ["7", "8"], detalle: "" },
        { fila: "q11", titulo: "", tipo: "otra", motivo: "otro_nuevo" },
      ],
      avisos: [
        { tipo: "pregunta_omitida", fila: "q9", motivo: "select_multiple", mensaje: "«Medios» se omitió." },
        { tipo: "cruce_omitido", fila: "q10", motivo: "mapa_roto", mensaje: "«Turno» se omitió." },
        { tipo: "sin_variable", base: "sede_b", fila: "q1", mensaje: "«P1» no tiene variable en Sede B." },
      ],
    },
  });

  it("el normalizador conserva las omitidas con su tipo, motivo, base y códigos", () => {
    expect(datos.resumen.omitidas).toEqual([
      { fila: "q9", titulo: "Medios", tipo: "pregunta", motivo: "select_multiple", base: "sede_a", codigos: [], detalle: "Es de respuesta múltiple.", ausentes: [] },
      { fila: "q10", titulo: "Turno", tipo: "cruce", motivo: "mapa_roto", base: "sede_b", codigos: ["7", "8"], detalle: "", ausentes: [] },
      { fila: "q11", titulo: "q11", tipo: "pregunta", motivo: "otro_nuevo", base: "", codigos: [], detalle: "", ausentes: [] },
    ]);
    expect(datos.resumen.preguntas.map((p) => p.sin_variable)).toEqual([
      [{ base: "sede_b" }],
      [{ base: "sede_a", fila: "Sexo" }],
      [],
    ]);
  });

  it("las omisiones no se mezclan con los demás avisos y un motivo desconocido se muestra tal cual", () => {
    expect(avisosGenerales(datos.resumen.avisos).map((a) => a.tipoOriginal)).toEqual(["sin_variable"]);
    expect(textoMotivoOmision("otro_nuevo")).toBe("otro_nuevo");
    expect(textoMotivoOmision(undefined)).toBe("Motivo no informado");
    expect(textoMotivoOmision("select_multiple")).not.toMatch(/[—·;]/);
  });

  it("sin `omitidas` las reconstruye desde los avisos de omisión", () => {
    const viejo = omitidasDe({ omitidas: [], avisos: datos.resumen.avisos });
    expect(viejo.map((o) => [o.fila, o.tipo, o.motivo])).toEqual([
      ["q9", "pregunta", "select_multiple"],
      ["q10", "cruce", "mapa_roto"],
    ]);
  });

  it("«Revisar en Equivalencias» abre el editor sobre esa fila", () => {
    expect(direccionDeOmitida({ fila: "q9" })).toBe("/carga?pestana=equivalencias&panel=armonizacion&foco=q9");
  });

  it("la celda «Sin variable» usa los rótulos de la serie", () => {
    expect(celdaSinVariable(datos.resumen.preguntas[0], datos.periodos)).toEqual(["Sede B"]);
    expect(celdaSinVariable(datos.resumen.preguntas[1], datos.periodos)).toEqual(["Sede A (Sexo)"]);
  });
});

import { accionParaAviso, etiquetaDeAviso, textoAusente } from "./comparativosModel";

describe("variable ausente", () => {
  const datos = normalizarComparativoResultado({
    periodos: [{ base: "a", rotulo: "Medición A" }, { base: "b", rotulo: "Medición B" }],
    resumen: {
      preguntas: [{ titulo: "P1", variable_ausente: [{ base: "b", fila: "q1", variable: "p7", motivo: "excluida" }] }],
      omitidas: [
        { fila: "q2", titulo: "P2", tipo: "pregunta", motivo: "variable_ausente", ausentes: [{ base: "a", variable: "p8", motivo: "excluida" }] },
        { fila: "q3", titulo: "P3", tipo: "cruce", motivo: "variable_ausente", ausentes: [{ base: "a", variable: "p9", motivo: "excluida" }, { base: "b", variable: "p9", motivo: "no_esta_en_la_base" }] },
      ],
      avisos: [
        { tipo: "variable_ausente", base: "b", fila: "q1", variable: "p7", motivo: "excluida", mensaje: "p7 está excluida." },
        { tipo: "variable_ausente", base: "a", fila: "q4", variable: "p0", motivo: "no_esta_en_la_base", mensaje: "p0 no está." },
      ],
    },
  });

  it("los avisos se rotulan por su motivo: la exclusión sólo se dice y la ausencia se revisa en Equivalencias", () => {
    const [excluida, ausente] = datos.resumen.avisos;
    expect(excluida.variable).toBe("p7");
    expect(etiquetaDeAviso(excluida)).toBe("Variable excluida en Analítica");
    expect(etiquetaDeAviso(ausente)).toBe("Variable que no está en la base");
    expect(accionParaAviso(excluida)).toBeNull();
    expect(accionParaAviso(ausente)).toEqual({
      etiqueta: "Revisar en Equivalencias",
      href: "/carga?pestana=equivalencias&panel=armonizacion&foco=q4",
    });
    expect(textoAusente({ variable: "p7", motivo: "excluida" })).toBe("La variable p7 está excluida en Analítica para esta base");
  });

  it("la omisión por variable ausente se explica según sus ausentes", () => {
    const [soloExcluida, mixta] = datos.resumen.omitidas;
    expect(textoMotivoOmision(soloExcluida.motivo, soloExcluida.ausentes)).toBe("Variable excluida en Analítica");
    expect(textoMotivoOmision(mixta.motivo, mixta.ausentes)).toBe("Variable que no está en la base");
  });

  it("la celda «Sin variable» dice qué variable falta y por qué", () => {
    expect(celdaSinVariable(datos.resumen.preguntas[0], datos.periodos)).toEqual(["Medición B: La variable p7 está excluida en Analítica para esta base"]);
  });
});

import { detalleDeOmitida } from "./comparativosModel";

describe("detalle de una omisión", () => {
  const periodos = [{ base: "a", rotulo: "Medición A" }];
  it("usa el texto del motor y no repite los códigos que ya nombra", () => {
    expect(detalleDeOmitida({ detalle: "Ningún caso cae (códigos 7, 8).", ausentes: [], codigos: ["7", "8"] }, periodos))
      .toBe("Ningún caso cae (códigos 7, 8).");
  });
  it("sin texto del motor dice los códigos, y suma las variables ausentes por base", () => {
    expect(detalleDeOmitida({ detalle: "", ausentes: [], codigos: ["7"] }, periodos)).toBe("Códigos: 7.");
    expect(detalleDeOmitida({ detalle: "", ausentes: [{ base: "a", variable: "p1", motivo: "no_esta_en_la_base" }], codigos: [] }, periodos))
      .toBe("Medición A: La variable p1 no está en los datos de esta base.");
  });
});
