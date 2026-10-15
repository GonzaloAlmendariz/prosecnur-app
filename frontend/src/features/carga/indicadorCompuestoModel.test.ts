// ADR 0105: la matriz declara indicadores compuestos de varias preguntas.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConteosCompuesto,
  normalizarArmonizacionPreview,
  normalizarEstadoEquivalencias,
  type EquivalenciaFila,
  type EquivalenciasEstado,
  type VariableDeBase,
} from "../../api/equivalencias";
import { aFilasEditor, filaVacia, filasParaGuardar } from "./equivalenciasEditorModel";
import {
  PANEL_INDICADOR_COMPUESTO,
  alternarCodigo,
  armonizacionDeCompuesto,
  borradorCompuestoDesde,
  componentesDeBase,
  expresionAlguna,
  filaDeCompuesto,
  filasConCompuesto,
  fusionarCompuestoGuardado,
  opcionesDeAyuda,
  parsearCodigos,
  reducirCompuesto,
  resultadosBusqueda,
  rotuloDeVariable,
  textoComponentes,
  textoConteos,
  validarCompuesto,
  variablesDeExpresion,
} from "./indicadorCompuestoModel";
import { PANELES_CARGA } from "./panelesCarga";

const v = (name: string, label: string, opciones?: { codigo: string; etiqueta: string }[]): VariableDeBase => ({
  name,
  label,
  seccion: "",
  ...(opciones ? { opciones } : {}),
});

const compuesta: EquivalenciaFila = {
  id: "AP-12",
  seccion: "Apoyo",
  etiqueta_estandar: "Recurrió a alguna instancia PUCP",
  variables: { "2024": "alguna(P28_1,P28_2)", "2026": "alguna(Q9)" },
  cantidad: 2,
  derivada: {
    regla: "alguna",
    por_base: {
      "2024": { variables: ["P28_1", "P28_2"], codigos: ["1"] },
      "2026": { variables: ["Q9"], codigos: ["1", "2"] },
    },
  },
  armonizacion: {
    escala: [{ codigo: "1", etiqueta: "Recurrió" }, { codigo: "0", etiqueta: "No recurrió" }],
    por_base: { "2024": { comparable: true, mapa: {} }, "2026": { comparable: false, nota: "otra pregunta", mapa: {} } },
  },
};

describe("panel direccionable", () => {
  it("se declara en el manifiesto de Carga con un id estable", () => {
    expect(PANEL_INDICADOR_COMPUESTO.id).toBe("indicador-compuesto");
    expect(PANELES_CARGA.map((p) => p.id)).toContain("indicador-compuesto");
  });
});

describe("expresión y lectura", () => {
  it("la expresión canónica respeta el orden declarado y se lee de vuelta", () => {
    expect(expresionAlguna(["P28_2", "P28_1"])).toBe("alguna(P28_2,P28_1)");
    expect(variablesDeExpresion("alguna(P28_1, P28_2)")).toEqual(["P28_1", "P28_2"]);
    expect(variablesDeExpresion("P28_1")).toBeNull();
  });

  it("la celda dice los componentes, nunca la expresión cruda", () => {
    const c = componentesDeBase(compuesta, "2024");
    expect(c).toEqual({ variables: ["P28_1", "P28_2"], codigos: ["1"] });
    expect(textoComponentes(c!)).toBe("Alguna de: P28_1, P28_2 · código 1");
    expect(textoComponentes(componentesDeBase(compuesta, "2026")!)).toBe("Alguna de: Q9 · códigos 1, 2");
    expect(componentesDeBase(compuesta, "2025")).toBeNull();
  });

  it("si la derivada no trae la base, se lee de la expresión sin códigos", () => {
    const sinDerivadaDeBase = { ...compuesta, derivada: { regla: "alguna" as const, por_base: {} } };
    expect(componentesDeBase(sinDerivadaDeBase, "2024")).toEqual({ variables: ["P28_1", "P28_2"], codigos: [] });
  });
});

describe("códigos «sí»", () => {
  it("se parsean sin repetir y se alternan desde la ayuda", () => {
    expect(parsearCodigos(" 1, 2 2;3 ")).toEqual(["1", "2", "3"]);
    expect(alternarCodigo("1", "2")).toBe("1, 2");
    expect(alternarCodigo("1, 2", "1")).toBe("2");
  });

  it("la ayuda son las opciones de la primera pregunta elegida", () => {
    const opciones = [v("P28_1", "¿Recurrió a la Defensoría?", [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }]), v("P28_2", "Otra")];
    expect(opcionesDeAyuda(opciones, ["P28_1", "P28_2"]).map((o) => o.codigo)).toEqual(["1", "2"]);
    expect(opcionesDeAyuda(opciones, [])).toEqual([]);
  });
});

describe("borrador", () => {
  const bases = ["2024", "2025", "2026"];

  it("uno nuevo empieza sin preguntas y con «1» como código por base", () => {
    const b = borradorCompuestoDesde(null, bases);
    expect(b.etiqueta).toBe("");
    expect(Object.values(b.porBase)).toEqual(bases.map(() => ({ variables: [], codigosTexto: "1" })));
  });

  it("al reabrir, trae lo guardado", () => {
    const b = borradorCompuestoDesde(compuesta, bases);
    expect(b.etiqueta).toBe("Recurrió a alguna instancia PUCP");
    expect(b.porBase["2024"].variables).toEqual(["P28_1", "P28_2"]);
    expect(b.porBase["2026"].codigosTexto).toBe("1, 2");
    expect(b.porBase["2025"].variables).toEqual([]);
  });

  it("agregar no repite y quitar saca sólo esa", () => {
    let b = borradorCompuestoDesde(null, bases);
    b = reducirCompuesto(b, { tipo: "agregar", base: "2024", variable: "P28_1" });
    b = reducirCompuesto(b, { tipo: "agregar", base: "2024", variable: "P28_1" });
    b = reducirCompuesto(b, { tipo: "agregar", base: "2024", variable: "P28_2" });
    expect(b.porBase["2024"].variables).toEqual(["P28_1", "P28_2"]);
    b = reducirCompuesto(b, { tipo: "quitar", base: "2024", variable: "P28_1" });
    expect(b.porBase["2024"].variables).toEqual(["P28_2"]);
  });

  it("valida nombre, al menos una base y un código por base declarada", () => {
    let b = borradorCompuestoDesde(null, bases);
    expect(validarCompuesto(b, bases)).toEqual(["Falta el nombre estándar.", "Elige al menos una pregunta en una base."]);
    b = reducirCompuesto(b, { tipo: "etiqueta", valor: "Conoce alguna instancia" });
    b = reducirCompuesto(b, { tipo: "agregar", base: "2025", variable: "C1" });
    b = reducirCompuesto(b, { tipo: "codigos", base: "2025", valor: " , " });
    expect(validarCompuesto(b, bases)).toEqual(["Falta al menos un código «sí» en 2025."]);
    b = reducirCompuesto(b, { tipo: "codigos", base: "2025", valor: "1" });
    expect(validarCompuesto(b, bases)).toEqual([]);
  });
});

describe("fila que se guarda", () => {
  const bases = ["2024", "2025", "2026"];

  it("una nueva lleva derivada, expresión por base y armonización Sí/No comparable; la base vacía no se declara", () => {
    let b = borradorCompuestoDesde(null, bases);
    b = reducirCompuesto(b, { tipo: "etiqueta", valor: "  Conoce al menos una instancia " });
    b = reducirCompuesto(b, { tipo: "seccion", valor: "Conocimiento" });
    b = reducirCompuesto(b, { tipo: "agregar", base: "2024", variable: "C1" });
    b = reducirCompuesto(b, { tipo: "agregar", base: "2024", variable: "C2" });
    b = reducirCompuesto(b, { tipo: "agregar", base: "2026", variable: "K4" });
    const fila = filaDeCompuesto(b, bases, null);
    expect(fila).toEqual({
      seccion: "Conocimiento",
      etiqueta_estandar: "Conoce al menos una instancia",
      variables: { "2024": "alguna(C1,C2)", "2026": "alguna(K4)" },
      cantidad: 2,
      derivada: {
        regla: "alguna",
        por_base: { "2024": { variables: ["C1", "C2"], codigos: ["1"] }, "2026": { variables: ["K4"], codigos: ["1"] } },
      },
      armonizacion: {
        escala: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "0", etiqueta: "No" }],
        por_base: { "2024": { comparable: true, mapa: {} }, "2026": { comparable: true, mapa: {} } },
      },
    });
  });

  it("al editar conserva id, la escala renombrada y lo ya decidido por base", () => {
    let b = borradorCompuestoDesde(compuesta, bases);
    b = reducirCompuesto(b, { tipo: "agregar", base: "2025", variable: "R7" });
    const fila = filaDeCompuesto(b, bases, compuesta);
    expect(fila.id).toBe("AP-12");
    expect(fila.armonizacion?.escala.map((c) => c.etiqueta)).toEqual(["Recurrió", "No recurrió"]);
    expect(fila.armonizacion?.por_base["2026"]).toEqual({ comparable: false, nota: "otra pregunta", mapa: {} });
    expect(fila.armonizacion?.por_base["2025"]).toEqual({ comparable: true, mapa: {} });
  });

  it("una base que se queda sin preguntas sale de la armonización", () => {
    expect(Object.keys(armonizacionDeCompuesto(["2024"], compuesta.armonizacion).por_base)).toEqual(["2024"]);
  });

  it("reemplaza por índice o agrega al final", () => {
    const otra: EquivalenciaFila = { seccion: "", etiqueta_estandar: "Edad", variables: { "2024": "edad" }, cantidad: 1 };
    expect(filasConCompuesto([otra], null, compuesta)).toEqual([otra, compuesta]);
    expect(filasConCompuesto([otra, otra], 1, compuesta)).toEqual([otra, compuesta]);
  });

  it("sobrevive al guardado del editor de la tabla: tiene variables y conserva la derivada", () => {
    const [enEditor] = aFilasEditor([compuesta]);
    const [guardada] = filasParaGuardar([enEditor]);
    expect(guardada.derivada).toEqual(compuesta.derivada);
    expect(guardada.id).toBe("AP-12");
  });
});

describe("fusión con cambios pendientes de la tabla", () => {
  it("agrega la nueva al final y no pisa las demás", () => {
    const prev = [...aFilasEditor([{ seccion: "", etiqueta_estandar: "Edad editada", variables: { a: "edad" }, cantidad: 1 }]), filaVacia()];
    const guardadas: EquivalenciaFila[] = [
      { seccion: "", etiqueta_estandar: "Edad", variables: { a: "edad" }, cantidad: 1 },
      compuesta,
    ];
    const out = fusionarCompuestoGuardado(prev, guardadas, 1);
    expect(out).toHaveLength(3);
    expect(out[0].etiqueta_estandar).toBe("Edad editada");
    expect(out[2].derivada).toEqual(compuesta.derivada);
    expect(out[2].indice_declarado).toBe(1);
    expect(out[2].id_declarado).toBe("AP-12");
  });

  it("reemplaza la que se editó conservando su identidad local", () => {
    const prev = aFilasEditor([{ ...compuesta, etiqueta_estandar: "vieja" }]);
    const out = fusionarCompuestoGuardado(prev, [compuesta], 0);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(prev[0].id);
    expect(out[0].etiqueta_estandar).toBe("Recurrió a alguna instancia PUCP");
  });
});

describe("búsqueda de preguntas", () => {
  const opciones = Array.from({ length: 12 }, (_, i) => v(`P28_${i + 1}`, `¿Recurrió a la instancia ${i + 1}?`));

  it("sin consulta no lista nada; con consulta, ocho y cuántas más, sin las ya elegidas", () => {
    expect(resultadosBusqueda(opciones, "  ", [])).toEqual({ visibles: [], resto: 0 });
    const r = resultadosBusqueda(opciones, "recurrio", ["P28_1"]);
    expect(r.visibles).toHaveLength(8);
    expect(r.visibles.map((o) => o.name)).not.toContain("P28_1");
    expect(r.resto).toBe(3);
  });
});

describe("normalizador del estado (frontera con R)", () => {
  it("conserva la derivada y corrige escalares de R", () => {
    const crudo = {
      ok: true,
      disponible: true,
      declarada: true,
      n_filas: 1,
      bases: ["2024"],
      cobertura: {},
      desfasadas: [],
      filas: [{
        seccion: "",
        etiqueta_estandar: "X",
        variables: { "2024": "alguna(P1,P2)" },
        derivada: { regla: ["alguna"], por_base: { "2024": { variables: ["P1", "P2"], codigos: 1 } } },
      }],
    } as unknown as EquivalenciasEstado;
    const fila = normalizarEstadoEquivalencias(crudo).filas?.[0];
    expect(fila?.derivada).toEqual({ regla: "alguna", por_base: { "2024": { variables: ["P1", "P2"], codigos: ["1"] } } });
  });

  it("una derivada que no reconoce no se borra en silencio", () => {
    const rara = { regla: "todas", por_base: { a: { variables: ["P1"], codigos: ["1"] } } };
    const crudo = {
      bases: [],
      desfasadas: [],
      filas: [{ seccion: "", etiqueta_estandar: "X", variables: { a: "todas(P1)" }, derivada: rara }],
    } as unknown as EquivalenciasEstado;
    expect(normalizarEstadoEquivalencias(crudo).filas?.[0].derivada).toEqual(rara);
  });
});

describe("conteos de lo guardado", () => {
  afterEach(() => vi.unstubAllGlobals());

  const responder = (status: number, body: unknown) => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })));
  };

  it("el preview normaliza el bloque derivada y la línea lo dice breve", () => {
    const p = normalizarArmonizacionPreview({
      ok: [true], fila: "0", base: "2024", variable: "alguna(P1,P2)", codigos: [], escala: [],
      derivada: { regla: "alguna", variables: ["P1", "P2"], codigos: 1, n_si: [120], n_no: "80", n_sin_dato: 5 },
    });
    expect(p.derivada).toEqual({ regla: "alguna", variables: ["P1", "P2"], codigos: ["1"], n_si: 120, n_no: 80, n_sin_dato: 5 });
    expect(normalizarArmonizacionPreview({ ok: true }).derivada).toBeUndefined();
    expect(textoConteos({ tipo: "conteos", n_si: 120, n_no: 80, n_sin_dato: 5 }, "2024")).toBe("Sí 120 · No 80 · Sin dato 5");
  });

  it("el 409 de componente ausente dice qué variable falta en esa base", async () => {
    responder(409, {
      error: {
        code: "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE",
        message: "falta",
        details: { base: "2024", variable: "alguna(P1,P2)", variables_ausentes: ["P2"] },
      },
    });
    const c = await getConteosCompuesto("0", "2024");
    expect(c).toEqual({ tipo: "ausente", variables: ["P2"] });
    expect(textoConteos(c!, "2024")).toBe("Falta P2 en los datos de 2024.");
    expect(textoConteos({ tipo: "ausente", variables: ["P1", "P2"] }, "2024")).toBe("Faltan P1, P2 en los datos de 2024.");
  });

  it("con 200 devuelve los conteos de la derivada", async () => {
    responder(200, { ok: true, derivada: { regla: "alguna", variables: ["P1"], codigos: ["1"], n_si: 3, n_no: 4, n_sin_dato: 0 } });
    expect(await getConteosCompuesto("0", "2024")).toEqual({ tipo: "conteos", n_si: 3, n_no: 4, n_sin_dato: 0 });
  });

  it("otro error se lanza, no se disfraza de conteo", async () => {
    responder(409, { error: { code: "E_EQUIV_SIN_ARMONIZACION", message: "sin escala" } });
    await expect(getConteosCompuesto("0", "2024")).rejects.toThrow("E_EQUIV_SIN_ARMONIZACION");
  });
});

describe("cabecera de la armonización", () => {
  it("una fila compuesta muestra sus componentes; una simple, su variable", () => {
    expect(rotuloDeVariable(compuesta, "2024")).toBe("Alguna de: P28_1, P28_2 · código 1");
    expect(rotuloDeVariable({ variables: { a: "p12" } }, "a")).toBe("variable p12");
  });
});
