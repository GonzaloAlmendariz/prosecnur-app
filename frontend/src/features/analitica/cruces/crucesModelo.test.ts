import { describe, expect, it } from "vitest";

import type { CrucesPreview, CrucesPreviewTabla } from "../../../api/analitica";
import type { Lectura } from "../tablas/useLecturaPorBase";
import {
  avisosDeCruces, causaDelVacio, lineasDeLeyenda, rotuloDeN, celdasPorFila, cifraDePesosDeCruces, claseDeLetras, crucesALaVista, cruceVigente, filasDeLaRegla,
  motivoSinGenerarCruces, notaComun, notasDeLaTabla, porcentajeDeCelda, sinTablaDeLaElegida, textoDeBaseDeCruce, TODAS_LAS_VARIABLES,
  variablesDeCruce,
} from "./crucesModelo";
import {
  conAviso, respuestaBaseHija, respuestaConPesos, respuestaSinPesos, respuestaSinVariablesDeCruce, tablaDe,
} from "./ejemploDeCruces.test-util";

const etiquetaDe = (v: string) => ({ E2_sex: "¿Cuál es su sexo?", M5_district: "¿En qué distrito vive?", E1_age: "¿Cuál es su edad?" } as Record<string, string>)[v] ?? v;
const lectura = (datos: CrucesPreview | null, fase: Lectura<CrucesPreview>["fase"] = datos ? "lista" : "leyendo", codigo = ""): Lectura<CrucesPreview> =>
  ({ fase, datos, causa: "", codigo, reintentar: () => undefined });
const textos = (p: CrucesPreview) => avisosDeCruces(p, etiquetaDe).map((a) => a.texto);

describe("cifras como el archivo", () => {
  it("porcentaje con dos decimales fijos, sin recalcular", () => {
    expect(porcentajeDeCelda(0.589580981973866)).toBe("58.96");
    expect(porcentajeDeCelda(1)).toBe("100.00");
    expect(porcentajeDeCelda(0)).toBe("0.00");
    expect(porcentajeDeCelda(0.173)).toBe("17.30");
    expect(porcentajeDeCelda(null)).toBe("");
  });

  it("la línea de base dice la proporción en su unidad: encuestados o registros, nunca casos", () => {
    expect(textoDeBaseDeCruce(tablaDe(respuestaConPesos(), "D1_information"))).toBe("Marcó alguna opción el 43.6 % de los 1,281 encuestados");
    expect(textoDeBaseDeCruce(tablaDe(respuestaConPesos(), "E6_impact"))).toBe("Respondió el 2.9 % de los 1,281 encuestados");
    const hija = tablaDe(respuestaBaseHija(), "srv_satisfaccion");
    expect(textoDeBaseDeCruce(hija)).toBe("Respondió el 100.0 % de los 660 registros");
    // Mutación: con la unidad de la respuesta y no la de la tabla, la tabla de grano encuestado diría "registros".
    expect(textoDeBaseDeCruce(tablaDe(respuestaBaseHija(), "conocimiento"))).toBe("Respondió el 100.0 % de los 422 encuestados");
    const sinDe: CrucesPreviewTabla = { ...hija, base: { ...hija.base, de: null } };
    expect(textoDeBaseDeCruce(sinDe)).toBe("Respondieron 660 registros");
    expect(textoDeBaseDeCruce({ ...hija, sin_datos: true })).toBeUndefined();
  });

  it("las celdas se buscan por el código de su fila, no por posición", () => {
    const col = tablaDe(respuestaSinPesos(), "D1_information").cruces[0].columnas[0];
    const alReves = celdasPorFila([...col.celdas].reverse());
    expect(alReves.get("1")?.pct).toBe(col.celdas[0].pct);
    expect(alReves.get("96")?.pct).toBe(col.celdas[col.celdas.length - 1].pct);
  });

  it("las letras se leen tal cual; solo cambia su estilo", () => {
    expect(claseDeLetras("BE")).toBe("letras");
    expect(claseDeLetras("e")).toBe("letras");
    expect(claseDeLetras("▲")).toBe("flechas");
    expect(claseDeLetras("▽")).toBe("flechas");
    expect(claseDeLetras(".b")).toBe("sin-comparar");
    expect(claseDeLetras("")).toBeNull();
    expect(claseDeLetras(null)).toBeNull();
  });
});

describe("variables de cruce a la vista", () => {
  it("las de la hoja, en su orden y con su pregunta; la elegida se conserva si sigue", () => {
    const vars = variablesDeCruce(respuestaSinPesos());
    expect(vars).toEqual([
      { variable: "M5_district", etiqueta: "¿En qué distrito vive actualmente?" },
      { variable: "E2_sex", etiqueta: "¿Cuál es su sexo?" },
    ]);
    expect(cruceVigente(vars, null)).toBe("M5_district");
    expect(cruceVigente(vars, "E2_sex")).toBe("E2_sex");
    expect(cruceVigente(vars, "ya_no_esta")).toBe("M5_district");
    expect(cruceVigente(vars, TODAS_LAS_VARIABLES)).toBe(TODAS_LAS_VARIABLES);
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    expect(crucesALaVista(t, "E2_sex").map((c) => c.variable)).toEqual(["E2_sex"]);
    expect(crucesALaVista(t, TODAS_LAS_VARIABLES).map((c) => c.variable)).toEqual(["M5_district", "E2_sex"]);
  });
});

describe("notas de cada tabla", () => {
  it("una tabla sin nada que decir lleva solo el pie del archivo", () => {
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    expect(notasDeLaTabla(t, t.cruces, t.significancia?.nota ?? null)).toEqual(["Fuente: Pulso PUCP"]);
  });

  it("la nota de letras de la mayoría se dice arriba; la distinta, en su tabla", () => {
    const hija = respuestaBaseHija();
    const comun = notaComun(hija.tablas);
    // Empate de una y una: gana la primera.
    expect(comun).toBe(hija.tablas[0].significancia?.nota);
    const otra = hija.tablas[1];
    const notas = notasDeLaTabla(otra, otra.cruces, comun);
    expect(notas).toContain(otra.significancia?.nota);
    // El motivo descriptivo ya está en la nota: no se repite.
    expect(notas.filter((n) => n.includes("Ninguna comparación entre columnas"))).toHaveLength(1);
  });

  it("casos fuera de fila, filas omitidas, casos sin columna, letras por rótulo y tabla sin respuestas", () => {
    const base = tablaDe(respuestaSinPesos(), "E6_impact");
    const t: CrucesPreviewTabla = {
      ...base,
      sin_respuestas: true,
      total: base.total ? { ...base.total, casos_sin_fila: 3 } : null,
      filas_omitidas: [{ codigo: "6", etiqueta: "De acuerdo", motivo: "rotulo_repetido", casos: 4 }],
      cruces: [
        { ...base.cruces[0], sin_columna: { base_n: 5, n: 5, valores_no_reconocidos: 2 }, significancia: { metodo: "descriptivo", motivo: "letras_por_rotulo_no_calculadas", modo: "letras" } },
        base.cruces[1],
      ],
    };
    const notas = notasDeLaTabla(t, t.cruces, base.significancia?.nota ?? null);
    expect(notas).toEqual([
      // Q2: el "nadie respondió" es el vacío de la tabla, no una nota de su pie.
      // O1: los de la fila omitida ya están dentro de los 3; la nota de la omitida no los vuelve a dar por fuera.
      "3 encuestados con una respuesta que no es ninguna de estas filas, contando los de las filas que no salen: no cuentan en la tabla.",
      "\"De acuerdo\" no sale como fila: repite el rótulo de otra fila. La eligieron 4 encuestados.",
      "5 encuestados sin columna en \"¿En qué distrito vive actualmente?\" (2 con un valor que no es categoría del formulario): cuentan en el Total.",
      "Sin letras en \"¿En qué distrito vive actualmente?\": la base guarda el rótulo de la categoría y no su código, y la prueba compara por código.",
      "Fuente: Pulso PUCP",
    ]);
    // Sin filas omitidas, la nota de casos fuera no habla de ellas.
    expect(notasDeLaTabla({ ...t, filas_omitidas: [] }, [], null)).toContain("3 encuestados con una respuesta que no es ninguna de estas filas: no cuentan en la tabla.");
    // Los casos sin columna solo cuentan para la variable de cruce que se ve.
    expect(notasDeLaTabla(t, [t.cruces[1]], null).some((n) => n.includes("sin columna"))).toBe(false);
  });
});

describe("notas de la revisión metodológica", () => {
  it("O2: en una múltiple, la fila omitida no da por fuera a todos los que la marcaron", () => {
    const t = { ...tablaDe(respuestaSinPesos(), "D1_information"), filas_omitidas: [{ codigo: "9", etiqueta: "Otro medio", motivo: "rotulo_repetido", casos: 3 }] };
    const notas = notasDeLaTabla(t, [], null);
    expect(notas).toContain("\"Otro medio\" no sale como fila: repite el rótulo de otra fila. La marcaron 3 encuestados; quien marcó solo esa opción queda fuera de la tabla.");
    expect(notas.join(" ")).not.toContain("fuera de la tabla.\"");
  });

  it("O4: un cruce por conglomerado lleva su nota; uno con la regla, no", () => {
    const hija = tablaDe(respuestaBaseHija(), "srv_satisfaccion");
    const notas = notasDeLaTabla(hija, hija.cruces, null);
    expect(notas).toContain(`Letras de "${hija.cruces[0].etiqueta}": prueba con el encuestado como conglomerado, porque cada encuestado aporta varios registros; no sigue la regla aplicada.`);
    expect(notas.filter((n) => n.includes("conglomerado"))).toHaveLength(1);
    const conRegla = tablaDe(respuestaSinPesos(), "D1_information");
    expect(notasDeLaTabla(conRegla, conRegla.cruces, null).some((n) => n.includes("conglomerado"))).toBe(false);
  });

  it("O3, O7 y D2: la leyenda de la hoja", () => {
    const sin = respuestaSinPesos();
    const lineas = lineasDeLeyenda(sin.tablas.map((t) => t.cruces).flat(), false, "NOTA", 6);
    expect(lineas[0]).toBe("Porcentajes por columna: cada celda es el porcentaje de los casos de su columna. En las preguntas de selección múltiple suman más de 100.");
    expect(lineas).toContain("NOTA");
    expect(lineas.some((l) => l.includes("▲"))).toBe(false);
    expect(lineas.some((l) => l.includes("N ponderado"))).toBe(false);
    const hija = respuestaBaseHija();
    const conFlechas = lineasDeLeyenda(hija.tablas[0].cruces, true, null, 6);
    expect(conFlechas).toContain("Con más de 6 columnas, cada columna se compara con el resto de los casos: ▲ mayor y ▼ menor que el resto; △ y ▽, la misma diferencia, frágil.");
    expect(conFlechas).toContain("N ponderado redondeado a entero: las columnas pueden no sumar el Total.");
  });

  it("O8: sin pesos la fila de N es la base, en su unidad", () => {
    expect(rotuloDeN(false, "encuestado")).toBe("Base (encuestados)");
    expect(rotuloDeN(false, "registro")).toBe("Base (registros)");
    expect(rotuloDeN(true, "registro")).toBe("N ponderado");
  });

  it("O8: un cruce múltiple con casos fuera de las columnas recibe su propia causa, no la de códigos mezclados", () => {
    const p = { ...respuestaSinPesos(), avisos: [{ codigo: "casos_sin_columna", mensaje: "x" }], sin_tabla: [] };
    p.tablas[0].cruces[1] = { ...p.tablas[0].cruces[1], multiple: true, sin_columna: { base_n: null, n: null, valores_no_reconocidos: 40 } };
    expect(textos(p)).toEqual([
      "\"¿Cuál es su sexo?\" es de selección múltiple: quien marcó varias opciones no entra en ninguna columna y el Total sí lo cuenta.",
    ]);
    p.tablas[0].cruces[0] = { ...p.tablas[0].cruces[0], sin_columna: { base_n: 3, n: 3, valores_no_reconocidos: 3 } };
    expect(textos(p)[0]).toContain("\"¿En qué distrito vive actualmente?\" trae valores que no son categorías del formulario");
    expect(textos(p)[0]).not.toContain("sexo");
  });
});

describe("avisos del servicio con su causa", () => {
  it("las respuestas reales: la exclusión global con sus casos y las numéricas por su pregunta", () => {
    expect(textos(respuestaSinPesos())).toEqual([
      "El archivo trae la tabla de la pregunta numérica \"¿Cuál es su edad?\", que la vista previa no muestra.",
      "Se quitaron 2 casos de toda la base al excluir \"Otro\" en \"¿Cuál es su sexo?\". El Total y las columnas de las demás variables de cruce tampoco los cuentan.",
    ]);
    expect(textos(respuestaBaseHija())).toEqual([
      expect.stringContaining("Se quitaron 7 registros de toda la base"),
    ]);
  });

  it("cada aviso aparece solo con su caso", () => {
    const limpia = (): CrucesPreview => ({ ...respuestaSinPesos(), avisos: [], sin_tabla: [] });
    expect(textos(limpia())).toEqual([]);

    const rotulo = limpia();
    rotulo.tablas[0].cruces[1].significancia = { metodo: "descriptivo", motivo: "letras_por_rotulo_no_calculadas", modo: "letras" };
    expect(textos(conAviso(rotulo, { codigo: "letras_por_rotulo_no_calculadas", mensaje: "x" }))).toEqual([
      "Sin letras de diferencias en \"¿Cuál es su sexo?\": la base guarda el rótulo de la categoría y no su código, y la prueba compara por código. El archivo trae esas letras vacías o como base insuficiente.",
    ]);

    const ajenos = limpia();
    ajenos.tablas[0].cruces[0].sin_columna = { base_n: 3, n: 3, valores_no_reconocidos: 3 };
    expect(textos(conAviso(ajenos, { codigo: "casos_sin_columna", mensaje: "x" }))[0]).toBe(
      "\"¿En qué distrito vive actualmente?\" trae valores que no son categorías del formulario (por ejemplo, códigos y rótulos mezclados): esos casos no entran en ninguna columna y el Total sí los cuenta.",
    );

    const multiple = limpia();
    multiple.tablas[0].cruces[0].multiple = true;
    expect(textos(conAviso(multiple, { codigo: "cruce_multiple", mensaje: "x" }))[0]).toContain(
      "\"¿En qué distrito vive actualmente?\" es de selección múltiple: cada columna cuenta solo a quienes marcaron esa única opción",
    );

    // El modo no aplicado se dice bajo el control del modo (ModoDelArchivo), no en el pie.
    expect(textos(conAviso(limpia(), { codigo: "modo_configurado_no_aplicado", mensaje: "x" }))).toEqual([]);

    const sinCasos = { ...limpia(), exclusiones: [{ variable: "E2_sex", unidad: "encuestado" as const, categorias: [{ codigo: "Otro", filas: 0 }, { codigo: "3", filas: 2 }] }] };
    expect(textos(conAviso(sinCasos, { codigo: "exclusion_sin_casos", mensaje: "x" }))).toEqual([
      "Excluir la categoría Otro de \"¿Cuál es su sexo?\" no quitó ningún caso: la base no tiene ese código en esa variable, o guarda el rótulo en su lugar.",
    ]);

    const sinColumnas = { ...limpia(), cruces_sin_columnas: [{ variable: "E1_age", motivo: "no_categorica" }] };
    expect(textos(conAviso(sinColumnas, { codigo: "cruces_sin_columnas", mensaje: "x" }))).toEqual([
      "\"¿Cuál es su edad?\" no tiene columnas en las tablas: no es de selección única ni múltiple.",
    ]);

    const sinTabla = { ...limpia(), sin_tabla: [{ variable: "E2_sex", motivo: "excluida" as const, seccion: null }] };
    expect(textos(conAviso(sinTabla, { codigo: "variables_sin_tabla", mensaje: "x" }))).toEqual(["\"¿Cuál es su sexo?\" está excluida del análisis."]);

    expect(textos(conAviso(limpia(), { codigo: "motor", mensaje: "NAs introducidos por coerción" }))).toEqual(["NAs introducidos por coerción"]);
  });

  it("los avisos de una hoja vacía no se repiten en el pie", () => {
    expect(textos(respuestaSinVariablesDeCruce())).toEqual([]);
  });

  it("la ponderación activada que no se aplicó lo dice; aplicada o sin configurar, no", () => {
    const sin = respuestaSinPesos();
    expect(textos({ ...sin, avisos: [], sin_tabla: [], ponderacion: { ...sin.ponderacion, configurada: true } })).toEqual([
      "La ponderación está activada y no se aplicó: las tablas salen sin pesos. Revísala en Ponderación.",
    ]);
    expect(textos({ ...respuestaConPesos(), avisos: [], sin_tabla: [] })).toEqual([]);
  });

  it("la pregunta pedida aparte sin tabla dice por qué", () => {
    const p = { ...respuestaSinPesos(), tablas: [] };
    expect(sinTablaDeLaElegida(p, "E1_age", etiquetaDe)).toBe("\"¿Cuál es su edad?\" es numérica: el archivo la trae con su resumen y la vista previa no la muestra.");
    expect(sinTablaDeLaElegida(respuestaSinPesos(), "D1_information", etiquetaDe)).toBeNull();
  });
});

describe("la regla de las letras, en llano", () => {
  it("la que la prueba usó, con el error estándar solo cuando hay pesos", () => {
    const regla = respuestaConPesos().significancia_regla;
    if (!regla) throw new Error("la respuesta con pesos trae la regla");
    expect(filasDeLaRegla(regla, true)).toEqual([
      { rotulo: "Prueba", valor: "z de diferencia de proporciones" },
      { rotulo: "Corrección", valor: "Bonferroni dentro de cada fila" },
      { rotulo: "Nivel", valor: "p < 0.05" },
      { rotulo: "Diferencia mínima", valor: "10 puntos" },
      { rotulo: "Base mínima", valor: "30 casos sin ponderar por columna" },
      { rotulo: "Letras", valor: "Hasta 6 columnas; con más, cada una frente al resto" },
      { rotulo: "Filas sin prueba", valor: "No sabe, No responde, No aplica, Prefiero no responder, Otro y los códigos 90 a 99" },
      { rotulo: "Error estándar", valor: "Con los pesos llevados a media 1, sin el efecto de diseño de la ponderación: marca más diferencias que una prueba con el tamaño efectivo de muestra" },
    ]);
    expect(filasDeLaRegla(regla, false).map((f) => f.rotulo)).not.toContain("Error estándar");
    expect(filasDeLaRegla({ ...regla, incluir_ns: true }, false)).toContainEqual({ rotulo: "Filas sin prueba", valor: "Todas las filas entran a la prueba" });
  });
});

describe("vacío, banda y botón", () => {
  it("sin variables de cruce, el vacío pide una", () => {
    expect(causaDelVacio(respuestaSinVariablesDeCruce(), { modo: "instrumento" })).toEqual({
      titulo: "Sin variables de cruce",
      descripcion: "No hay tablas porque no hay variables de cruce configuradas.",
      agregarVariable: true,
    });
    const ocultas = { ...respuestaSinVariablesDeCruce(), avisos: [] };
    expect(causaDelVacio(ocultas, { modo: "declaradas", activas: 0 }).descripcion).toBe("Todas las secciones están ocultas. Muestra alguna en la pestaña Datos.");
  });

  it("los pesos: suma de pesos en N y bases sin ponderar en su unidad", () => {
    expect(cifraDePesosDeCruces(lectura(respuestaConPesos()))).toEqual({
      valor: "Con ponderación",
      tono: "acento",
      titulo: "Porcentajes y N ponderados; las bases, en encuestados sin ponderar. n efectivo: 817.",
    });
    expect(cifraDePesosDeCruces(lectura(respuestaSinPesos())).valor).toBe("Sin ponderación");
  });

  it("generar espera al guardado, a una variable a cruzar y a la base preparada", () => {
    const listo = { sinGuardar: false, errorGuardado: null };
    expect(motivoSinGenerarCruces(lectura(respuestaSinPesos()), 2, listo)).toBeUndefined();
    expect(motivoSinGenerarCruces(lectura(respuestaSinPesos()), 2, { sinGuardar: true, errorGuardado: null })).toBe("Guardando los ajustes");
    expect(motivoSinGenerarCruces(lectura(respuestaSinPesos()), 2, { sinGuardar: true, errorGuardado: "x" })).toBe("Ajustes sin guardar");
    expect(motivoSinGenerarCruces(lectura(respuestaSinPesos()), 0, listo)).toBe("Agrega al menos una variable a cruzar.");
    expect(motivoSinGenerarCruces(lectura(null, "error", "E_NO_RP_DATA"), 2, listo)).toBe("Falta preparar la base.");
    // Otro fallo de la vista previa no impide generar: el archivo puede salir igual.
    expect(motivoSinGenerarCruces(lectura(null, "error", "E_INTERNAL"), 2, listo)).toBeUndefined();
    expect(motivoSinGenerarCruces(lectura(null), 2, listo)).toBe("Leyendo las tablas del archivo");
  });

  it("varias bases: la activa sin variables de cruce no bloquea si otra base del archivo sí las trae", () => {
    const listo = { sinGuardar: false, errorGuardado: null };
    const sinTablas = respuestaSinVariablesDeCruce();
    const activaSinCruces: CrucesPreview = {
      ...sinTablas,
      avisos: [{ codigo: "base_sin_variables_de_cruce", mensaje: "x" }],
      base: { ...sinTablas.base, nombre: "Docentes", bases_del_archivo: ["Estudiantes"], bases_sin_cruces: ["Docentes"], n_bases: 2 },
    };
    expect(motivoSinGenerarCruces(lectura(activaSinCruces), 2, listo)).toBeUndefined();
    // Ninguna base del archivo trae las variables: no hay archivo.
    const ninguna = { ...activaSinCruces, base: { ...activaSinCruces.base, bases_del_archivo: [] } };
    expect(motivoSinGenerarCruces(lectura(ninguna), 2, listo)).toBe("El archivo no tendría tablas.");
    // Una sola base, la activa, sin tablas: tampoco.
    const sola = { ...sinTablas, base: { ...sinTablas.base, bases_del_archivo: [sinTablas.base.nombre] } };
    expect(motivoSinGenerarCruces(lectura(sola), 2, listo)).toBe("El archivo no tendría tablas.");
  });
});
