import { describe, expect, test } from "vitest";
import type { AdvertenciaBloques, Armonizacion } from "../../api/equivalencias";
import {
  normalizarArmonizacion,
  normalizarArmonizacionPreview,
  normalizarEstadoEquivalencias,
  normalizarImportacionBloques,
  type EquivalenciasEstado,
} from "../../api/equivalencias";
import {
  aArmonizacion,
  agruparAdvertencias,
  borradorDesde,
  destinoDe,
  estadoArmonizacion,
  filasConArmonizacion,
  filasDeMapa,
  indiceDeFoco,
  mapaPeriodosInicial,
  mapaPeriodosValido,
  moverEnLista,
  ordenEfectivo,
  reducirArmonizacion,
  resumenMapa,
  resumenOrdenSerie,
  textoResumenMapa,
  validarArmonizacion,
} from "./armonizacionModel";
import { aFilasEditor, filasParaGuardar } from "./equivalenciasEditorModel";
import { ordenPorAnio, ordenPorDefectoDeSerie } from "./nombreDeSerie";

const ARM: Armonizacion = {
  escala: [
    { codigo: "1", etiqueta: "Heterosexual" },
    { codigo: "2", etiqueta: "Homosexual (gay/lesbiana)" },
  ],
  por_base: {
    b2024: { comparable: true, mapa: { "6": "1", "1": "2", "2": "2" } },
    b2025: { comparable: false, nota: "Otra pregunta", mapa: {} },
  },
};

describe("estadoArmonizacion", () => {
  test("sin armonización dice «Sin armonizar»", () => {
    expect(estadoArmonizacion({ variables: { b2024: "p5" } }).texto).toBe("Sin armonizar");
  });

  test("nombra la base no comparable y sólo las que tienen variable", () => {
    const e = estadoArmonizacion({ armonizacion: ARM, variables: { b2024: "p5", b2025: "p6" } });
    // El chip dice cuántas, las bases van en `bases` (y en el title).
    expect(e).toMatchObject({ tipo: "no_comparable", texto: "No comparable en 1 base", bases: ["b2025"] });
    const sinLaDe2025 = estadoArmonizacion({ armonizacion: ARM, variables: { b2024: "p5" } });
    expect(sinLaDe2025.texto).toBe("Armonizada");
  });

  test("una base con variable y sin entrada no se presume comparable", () => {
    const e = estadoArmonizacion({ armonizacion: ARM, variables: { b2024: "p5", b2026: "p4" } });
    expect(e).toMatchObject({ texto: "No comparable en 1 base", bases: ["b2026"] });
  });
});

describe("destino de un código", () => {
  test("mapa vacío es identidad contra la escala", () => {
    const b = borradorDesde({ escala: ARM.escala, por_base: { x: { comparable: true, mapa: {} } } }, ["x"]);
    expect(destinoDe(b.porBase.x, ARM.escala, "1")).toBe("1");
    expect(destinoDe(b.porBase.x, ARM.escala, "9")).toBeNull();
  });

  test("con mapa, lo que el mapa no nombra queda sin destino", () => {
    const b = borradorDesde(ARM, ["b2024"]);
    expect(destinoDe(b.porBase.b2024, ARM.escala, "6")).toBe("1");
    expect(destinoDe(b.porBase.b2024, ARM.escala, "99")).toBeNull();
  });

  test("una base no comparable o sin declarar no tiene destinos", () => {
    const b = borradorDesde(ARM, ["b2025", "b2026"]);
    expect(destinoDe(b.porBase.b2025, ARM.escala, "1")).toBeNull();
    expect(b.porBase.b2026.comparable).toBeNull();
    expect(destinoDe(b.porBase.b2026, ARM.escala, "1")).toBeNull();
  });
});

describe("reducirArmonizacion", () => {
  test("editar un destino con identidad implícita la materializa primero", () => {
    let b = borradorDesde({ escala: ARM.escala, por_base: { x: { comparable: true, mapa: {} } } }, ["x"]);
    b = reducirArmonizacion(b, { tipo: "destino", base: "x", codigo: "3", destino: "2", conocidos: ["1", "2", "3"] });
    expect(b.porBase.x.mapa).toEqual({ "1": "1", "2": "2", "3": "2" });
  });

  test("renombrar un código de la escala arrastra los mapas", () => {
    let b = borradorDesde(ARM, ["b2024", "b2025"]);
    b = reducirArmonizacion(b, { tipo: "codigo", clave: b.escala[1].clave, valor: "20" });
    expect(b.porBase.b2024.mapa).toEqual({ "6": "1", "1": "20", "2": "20" });
  });

  test("quitar una categoría deja sin destino a quienes caían en ella", () => {
    let b = borradorDesde(ARM, ["b2024"]);
    b = reducirArmonizacion(b, { tipo: "quitar", clave: b.escala[0].clave });
    expect(b.escala.map((c) => c.codigo)).toEqual(["2"]);
    expect(b.porBase.b2024.mapa).toEqual({ "1": "2", "2": "2" });
  });

  test("mover reordena y no sale del borde", () => {
    let b = borradorDesde(ARM, []);
    b = reducirArmonizacion(b, { tipo: "mover", clave: b.escala[0].clave, delta: -1 });
    expect(b.escala.map((c) => c.codigo)).toEqual(["1", "2"]);
    b = reducirArmonizacion(b, { tipo: "mover", clave: b.escala[0].clave, delta: 1 });
    expect(b.escala.map((c) => c.codigo)).toEqual(["2", "1"]);
  });

  test("agregar propone el siguiente código libre bajo los especiales", () => {
    let b = borradorDesde({ escala: [...ARM.escala, { codigo: "99", etiqueta: "NS" }], por_base: {} }, []);
    b = reducirArmonizacion(b, { tipo: "agregar" });
    expect(b.escala.at(-1)?.codigo).toBe("3");
  });

  test("emparejar por etiqueta propone sólo lo que casa y no pisa lo decidido", () => {
    let b = borradorDesde({ escala: ARM.escala, por_base: { x: { comparable: true, mapa: { "7": "1" } } } }, ["x"]);
    b = reducirArmonizacion(b, {
      tipo: "emparejar",
      base: "x",
      opciones: [
        { codigo: "7", etiqueta: "Homosexual (gay/lesbiana)" },
        { codigo: "8", etiqueta: "  heterosexual " },
        { codigo: "9", etiqueta: "Bisexual" },
      ],
    });
    expect(b.porBase.x.mapa).toEqual({ "7": "1", "8": "1" });
  });

  test("sembrar copia una lista sólo sobre una escala vacía", () => {
    let b = borradorDesde(null, ["x"]);
    b = reducirArmonizacion(b, { tipo: "sembrar", opciones: [{ codigo: "1", etiqueta: "Sí" }] });
    expect(b.escala).toHaveLength(1);
    b = reducirArmonizacion(b, { tipo: "sembrar", opciones: [{ codigo: "5", etiqueta: "No" }] });
    expect(b.escala.map((c) => c.codigo)).toEqual(["1"]);
  });
});

describe("validar y serializar", () => {
  test("detecta código vacío, inválido y repetido", () => {
    let b = borradorDesde(ARM, []);
    b = reducirArmonizacion(b, { tipo: "agregar", codigo: "1" });
    b = reducirArmonizacion(b, { tipo: "agregar", codigo: "a b" });
    expect(validarArmonizacion(b)).toEqual([
      "El código «1» se repite en la escala.",
      "El código «a b» lleva espacios o símbolos.",
    ]);
  });

  test("omite las bases sin declarar y los destinos fuera de la escala", () => {
    const b = borradorDesde(ARM, ["b2024", "b2025", "b2026"]);
    b.porBase.b2024.mapa["5"] = "zz";
    const arm = aArmonizacion(b);
    expect(Object.keys(arm?.por_base ?? {})).toEqual(["b2024", "b2025"]);
    expect(arm?.por_base.b2024.mapa).toEqual({ "6": "1", "1": "2", "2": "2" });
    expect(arm?.por_base.b2025).toEqual({ comparable: false, nota: "Otra pregunta", mapa: {} });
  });

  test("un borrador vacío borra la armonización", () => {
    expect(aArmonizacion(borradorDesde(null, ["x"]))).toBeNull();
  });

  test("guardar una fila no toca las demás", () => {
    const guardadas = [
      { seccion: "", etiqueta_estandar: "A", variables: { x: "a" }, cantidad: 1 },
      { seccion: "", etiqueta_estandar: "B", variables: { x: "b" }, cantidad: 1, armonizacion: ARM },
    ];
    const out = filasConArmonizacion(guardadas, 0, ARM);
    expect(out[0].armonizacion).toBe(ARM);
    expect(out[1]).toBe(guardadas[1]);
    expect(filasConArmonizacion(guardadas, 1, null)[1].armonizacion).toBeNull();
  });
});

describe("tabla de mapeo", () => {
  test("resalta sin mapa y suma sus casos", () => {
    const b = borradorDesde(ARM, ["b2024"]);
    const filas = filasDeMapa(
      [
        { codigo: "6", etiqueta: "Heterosexual", n: 40 },
        { codigo: "3", etiqueta: "Bisexual", n: 7 },
        { codigo: "99", etiqueta: null, n: 2 },
      ],
      b.porBase.b2024,
      ARM.escala,
    );
    expect(filas.map((f) => f.destino)).toEqual(["1", null, null]);
    expect(resumenMapa(filas)).toEqual({ sinMapa: 2, casosSinMapa: 9, etiquetaDistinta: 0 });
  });

  // Caso del verificador (acrconta_mazo, género en docentes): con la identidad
  // el 3 «Prefiero no responder» caía en «3 Otro» y la UI decía «Todos los
  // códigos tienen destino».
  const ESCALA_GENERO = [
    { codigo: "1", etiqueta: "Masculino" },
    { codigo: "2", etiqueta: "Femenino" },
    { codigo: "3", etiqueta: "Otro" },
  ];
  const DOCENTES = [
    { codigo: "1", etiqueta: "Masculino", n: 33 },
    { codigo: "2", etiqueta: "femenino ", n: 19 },
    { codigo: "3", etiqueta: "Prefiero no responder", n: 0 },
  ];

  test("docentes: la identidad que cae en otra etiqueta se marca y el resumen no la da por buena", () => {
    const b = borradorDesde(
      { escala: ESCALA_GENERO, por_base: { docentes: { comparable: true, mapa: {} } } },
      ["docentes"],
    );
    const filas = filasDeMapa(DOCENTES, b.porBase.docentes, ESCALA_GENERO);
    expect(filas.map((f) => [f.destino, f.etiquetaDistinta])).toEqual([
      ["1", false],
      ["2", false],
      ["3", true],
    ]);
    expect(filas[2].etiquetaDestino).toBe("Otro");
    const r = resumenMapa(filas);
    expect(r).toEqual({ sinMapa: 0, casosSinMapa: 0, etiquetaDistinta: 1 });
    const texto = textoResumenMapa(r, false);
    expect(texto).toContain("1 código con etiqueta distinta");
    expect(texto).not.toContain("Todos los códigos");
  });

  test("docentes: convertir la identidad en mapa por etiqueta deja el 3 sin mapa", () => {
    let b = borradorDesde(
      { escala: ESCALA_GENERO, por_base: { docentes: { comparable: true, mapa: {} } } },
      ["docentes"],
    );
    b = reducirArmonizacion(b, {
      tipo: "emparejar",
      base: "docentes",
      opciones: DOCENTES.map((d) => ({ codigo: d.codigo, etiqueta: d.etiqueta })),
    });
    expect(b.porBase.docentes.mapa).toEqual({ "1": "1", "2": "2" });
    const filas = filasDeMapa(DOCENTES, b.porBase.docentes, ESCALA_GENERO);
    expect(filas.map((f) => [f.destino, f.etiquetaDistinta])).toEqual([
      ["1", false],
      ["2", false],
      [null, false],
    ]);
    expect(textoResumenMapa(resumenMapa(filas), true)).toBe("1 código sin mapa.");
  });

  test("todo con su etiqueta sí se da por bueno", () => {
    const r = { sinMapa: 0, casosSinMapa: 0, etiquetaDistinta: 0 };
    expect(textoResumenMapa(r, true)).toBe("Todos los códigos caen en una categoría con su misma etiqueta.");
  });
});

describe("foco de la fila", () => {
  test("casa primero por id y después por posición", () => {
    const filas = [{ id: "S-04" }, { id: "0" }, {}];
    expect(indiceDeFoco(filas, "S-04")).toBe(0);
    expect(indiceDeFoco(filas, "0")).toBe(1);
    expect(indiceDeFoco(filas, "2")).toBe(2);
    expect(indiceDeFoco(filas, "7")).toBeNull();
    expect(indiceDeFoco(filas, null)).toBeNull();
  });

  test("el id del bloque sobrevive al editor y vuelve al guardar", () => {
    const filas = aFilasEditor([
      { id: "S-04", seccion: "", etiqueta_estandar: "X", variables: { a: "p" }, cantidad: 1 },
    ]);
    expect(filas[0].id_declarado).toBe("S-04");
    expect(filas[0].indice_declarado).toBe(0);
    const guardadas = filasParaGuardar(filas);
    expect(guardadas[0].id).toBe("S-04");
    expect(guardadas[0]).not.toHaveProperty("indice_declarado");
    expect(guardadas[0]).not.toHaveProperty("id_declarado");
  });
});

describe("orden de la serie", () => {
  test("conserva lo declarado, descarta lo ajeno y agrega lo que falta", () => {
    expect(ordenEfectivo(["b2025", "vieja", "b2024"], ["b2024", "b2025", "b2026"])).toEqual([
      "b2025",
      "b2024",
      "b2026",
    ]);
  });

  test("sin declarar, cronológico si todas las bases nombran un año (F6)", () => {
    expect(ordenEfectivo([], ["hsvg2026", "hsvg2024", "hsvg2025"])).toEqual(["hsvg2024", "hsvg2025", "hsvg2026"]);
    // Lo declarado que ya no es una base cuenta como no declarado.
    expect(ordenEfectivo(["vieja"], ["b2026", "b2024"])).toEqual(["b2024", "b2026"]);
    // Una base sin año: el orden de alta.
    expect(ordenEfectivo([], ["b2026", "posgrado", "b2024"])).toEqual(["b2026", "posgrado", "b2024"]);
    // Declarado manda aunque no sea cronológico.
    expect(ordenEfectivo(["b2026", "b2024"], ["b2024", "b2026"])).toEqual(["b2026", "b2024"]);
  });

  test("ordenPorAnio: empates en su orden, rótulos con año y null sin año", () => {
    expect(ordenPorAnio(["e2024", "d2023", "d2024"])).toEqual(["d2023", "e2024", "d2024"]);
    expect(ordenPorAnio(["actual", "previa"], { actual: "2026", previa: "Ola 2024" })).toEqual(["previa", "actual"]);
    expect(ordenPorAnio(["b2024", "docentes"])).toBeNull();
    expect(ordenPorAnio([])).toBeNull();
    expect(ordenPorDefectoDeSerie(["b2024", "docentes"])).toEqual(["b2024", "docentes"]);
  });

  test("mover no sale de la lista", () => {
    expect(moverEnLista(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moverEnLista(["a", "b"], 0, 1)).toEqual(["b", "a"]);
  });
});

describe("importar por bloques", () => {
  test("propone la base que nombra el año sin repetirla", () => {
    expect(mapaPeriodosInicial(["2022", "2024", "2026"], ["hsvg2024", "hsvg2026", "otra"])).toEqual({
      "2022": "",
      "2024": "hsvg2024",
      "2026": "hsvg2026",
    });
  });

  test("rechaza un mapa vacío o con una base repetida", () => {
    expect(mapaPeriodosValido({ "2024": "" }).ok).toBe(false);
    expect(mapaPeriodosValido({ "2024": "a", "2025": "a" }).motivo).toBe("Dos columnas apuntan a la misma base.");
    expect(mapaPeriodosValido({ "2024": "a", "2025": "" }).ok).toBe(true);
  });

  test("agrupa advertencias por tipo, de mayor a menor", () => {
    const a = (tipo: AdvertenciaBloques["tipo"], id: string): AdvertenciaBloques => ({
      id, base: "", tipo, tipo_crudo: tipo, mensaje: id,
    });
    const g = agruparAdvertencias([a("fusion", "1"), a("variable_pendiente", "2"), a("variable_pendiente", "3")]);
    expect(g.map((x) => [x.tipo, x.n])).toEqual([["variable_pendiente", 2], ["fusion", 1]]);
  });
});

describe("normalizadores de la frontera", () => {
  test("armonización con mapa como arreglo vacío y códigos numéricos", () => {
    const arm = normalizarArmonizacion({
      escala: [{ codigo: 1, etiqueta: "Sí" }, { codigo: "", etiqueta: "x" }],
      por_base: { a: { comparable: [true], mapa: [] }, b: { comparable: false, mapa: { "3": 1 } } },
    });
    expect(arm).toEqual({
      escala: [{ codigo: "1", etiqueta: "Sí" }],
      por_base: { a: { comparable: true, mapa: {} }, b: { comparable: false, mapa: { "3": "1" } } },
    });
    expect(normalizarArmonizacion([])).toBeNull();
  });

  test("estado con periodos como escalar y fila sin armonización", () => {
    const raw = {
      ok: true, disponible: true, declarada: true, n_filas: 1, bases: "a", cobertura: {}, desfasadas: [],
      armonizacion_periodos: "a",
      filas: [{ seccion: "s", etiqueta_estandar: "E", variables: { a: "p1" }, cantidad: 1, armonizacion: null }],
    } as unknown as EquivalenciasEstado;
    const est = normalizarEstadoEquivalencias(raw);
    expect(est.bases).toEqual(["a"]);
    expect(est.armonizacion_periodos).toEqual(["a"]);
    expect(est.filas?.[0]).not.toHaveProperty("armonizacion");
  });

  test("preview con NA y conteos como texto", () => {
    const p = normalizarArmonizacionPreview({
      ok: [true], comparable: [true], n_total: "12", n_sin_mapa: 2,
      codigos: [{ codigo: 1, etiqueta: null, n: "10", armonizado: "NA" }, { codigo: 2, n: 2, armonizado: null }],
      escala: [{ codigo: "1", etiqueta: "Sí", n: 10 }],
    });
    expect(p.ok).toBe(true);
    expect(p.n_total).toBe(12);
    expect(p.codigos[0]).toEqual({ codigo: "1", etiqueta: null, n: 10, armonizado: null });
    expect(p.codigos[1].armonizado).toBeNull();
  });

  test("importación con un tipo desconocido lo agrupa como «otro»", () => {
    const imp = normalizarImportacionBloques({
      ok: true, modo: "previsualizar",
      advertencias: [{ id: "S-1", base: "", tipo: "nuevo_tipo", mensaje: "m" }],
      resumen: { n_bloques: 3, por_base: { a: { anio: 2024, n_variables: "5" } } },
    });
    expect(imp.advertencias[0].tipo).toBe("otro");
    expect(imp.advertencias[0].tipo_crudo).toBe("nuevo_tipo");
    expect(imp.resumen.por_base.a).toEqual({ anio: "2024", n_variables: 5, n_pendientes: 0, n_codigos_inexistentes: 0 });
  });
});

describe("resumenOrdenSerie (M7)", () => {
  test("con pocas bases las nombra todas", () => {
    expect(resumenOrdenSerie(["b2024", "b2025", "b2026"])).toBe("b2024 → b2025 → b2026");
  });

  test("con muchas nombra las primeras y la última y cuenta el resto", () => {
    const siete = ["b2024", "b2025", "b2026", "egresados", "docentes", "administrativos", "posgrado"];
    expect(resumenOrdenSerie(siete)).toBe("b2024 → b2025 → b2026 → … (3 más) → posgrado");
    expect(resumenOrdenSerie(siete, 2)).toBe("b2024 → … (5 más) → posgrado");
  });
});

describe("textos del informe (enunciado y base)", () => {
  const guardadas = [
    { seccion: "", etiqueta_estandar: "Edad", variables: { b2024: "p1" }, cantidad: 1, enunciado: "¿Qué edad tienes?" },
    { seccion: "", etiqueta_estandar: "Sexo", variables: { b2024: "p2" }, cantidad: 1 },
  ];

  test("el borrador parte de los textos guardados y se editan con su acción", () => {
    let b = borradorDesde(null, ["b2024"], guardadas[0]);
    expect(b.textos).toEqual({ enunciado: "¿Qué edad tienes?", baseTexto: "" });
    b = reducirArmonizacion(b, { tipo: "texto", campo: "baseTexto", valor: " total de encuestados " });
    expect(b.textos.baseTexto).toBe(" total de encuestados ");
  });

  test("se guardan con la armonización, recortados; vaciar uno ya guardado lo manda vacío", () => {
    const out = filasConArmonizacion(guardadas, 0, ARM, { enunciado: "  ", baseTexto: " total de encuestados " });
    expect(out[0].enunciado).toBe("");
    expect(out[0].base_texto).toBe("total de encuestados");
    const sinTextos = filasConArmonizacion(guardadas, 1, ARM, { enunciado: "", baseTexto: "" });
    expect("enunciado" in sinTextos[1]).toBe(false);
    expect("base_texto" in sinTextos[1]).toBe(false);
    expect(out[1]).toBe(guardadas[1]);
  });

  test("el normalizador conserva base_texto y enunciado como texto", () => {
    const est = normalizarEstadoEquivalencias({
      filas: [{ seccion: "", etiqueta_estandar: "Edad", variables: { b2024: "p1" }, base_texto: ["total de encuestados"], enunciado: "¿Edad?" }],
    } as unknown as EquivalenciasEstado);
    expect(est.filas?.[0].base_texto).toBe("total de encuestados");
    expect(est.filas?.[0].enunciado).toBe("¿Edad?");
  });
});

describe("resumen del mapa: un código sin casos se informa sin alarmar", () => {
  test("«0 Selecciona una respuesta» con 0 casos no es aviso; sin conteo o con casos, sí", async () => {
    const { resumenEsAviso } = await import("./armonizacionModel");
    const r = (sinMapa: number, casosSinMapa: number) => ({ sinMapa, casosSinMapa, etiquetaDistinta: 0 });
    expect(resumenEsAviso(r(1, 0), true)).toBe(false);
    expect(resumenEsAviso(r(1, 0), false)).toBe(true);
    expect(resumenEsAviso(r(1, 3), true)).toBe(true);
    expect(resumenEsAviso({ ...r(0, 0), etiquetaDistinta: 1 }, true)).toBe(true);
  });
});
