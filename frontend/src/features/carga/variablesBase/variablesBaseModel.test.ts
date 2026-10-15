import { afterEach, describe, expect, it, vi } from "vitest";
import type { ColumnaPropia, VariableCalculada } from "../../../api/baseVariables";
import type { VariableDeBase } from "../../../api/equivalencias";
import { panelAbiertoEn } from "../../../lib/navegacion/paneles";
import { baseDeLaDireccion } from "../fuentesEmparejamientoModel";
import { PANELES_CARGA } from "../panelesCarga";
import { ESTADO_INICIAL, reducirEstado } from "./useVariablesBase";
import {
  BORRADOR_COLUMNAS_VACIO,
  EVENTO_VARIABLES_BASE,
  PANEL_VARIABLES_BASE,
  avisarCambioDeVariables,
  borradorCalculadaDesde,
  calculadaParaGuardar,
  columnasADeclarar,
  filasRecodificacion,
  hrefDeclararRetiradas,
  hrefVariablesBase,
  nombresOcupados,
  opcionesDeOrigen,
  opcionesSinEtiqueta,
  preguntasUsables,
  readinessVariablesBase,
  reducirCalculada,
  reducirColumnas,
  reglaLegible,
  resumenOpciones,
  searchConVariablesBase,
  separarColumnas,
  textoIncorporadas,
  textoIncorporar,
  textoResumen,
  validarCalculada,
  type AccionCalculada,
  type BorradorCalculada,
} from "./variablesBaseModel";

const col = (name: string, extra: Partial<ColumnaPropia> = {}): ColumnaPropia => ({
  name,
  label: name,
  tipo: "text",
  opciones: [],
  n_validos: 10,
  declarada: false,
  ...extra,
});

const aplicar = (b: BorradorCalculada, ...acciones: AccionCalculada[]) => acciones.reduce(reducirCalculada, b);

describe("panel y direcciones", () => {
  it("se declara en el manifiesto de Carga como sideover", () => {
    expect(PANELES_CARGA).toContain(PANEL_VARIABLES_BASE);
    expect(PANEL_VARIABLES_BASE).toMatchObject({ id: "variables-base", clase: "sideover" });
  });

  it("abre con panel y foco, conservando el resto de la dirección", () => {
    const search = searchConVariablesBase("?pestana=fuentes", "2026");
    expect(search).toBe("?pestana=fuentes&panel=variables-base&foco=2026");
    expect(panelAbiertoEn(search, PANEL_VARIABLES_BASE)).toBe(true);
    expect(hrefVariablesBase("Estudiantes 2026")).toBe("/carga?pestana=fuentes&panel=variables-base&foco=Estudiantes+2026");
  });

  it("«Declarar el motivo» lleva a Revisión con la base como base revisada", () => {
    const href = hrefDeclararRetiradas("2026");
    expect(href).toBe("/carga?pestana=revision&foco=2026");
    const params = new URLSearchParams(href.split("?")[1]);
    expect(baseDeLaDireccion(params.get("panel"), params.get("foco"))).toBe("2026");
  });

  it("readiness: false sólo mientras lee", () => {
    expect(readinessVariablesBase({ tipo: "cargando" }, null)).toBe("vacio:sin-base");
    expect(readinessVariablesBase({ tipo: "cargando" }, "b")).toBe("false");
    expect(readinessVariablesBase({ tipo: "error", mensaje: "x" }, "b")).toBe("vacio:error");
  });
});

describe("aviso a las vistas que listan variables", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dispara el catálogo de la base, la fuente de Analítica y el de base activa", () => {
    const eventos: string[] = [];
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => { eventos.push(e.type); return true; } });
    avisarCambioDeVariables("2026");
    expect(eventos).toEqual([EVENTO_VARIABLES_BASE, "pulso:analitica-source-changed", "pulso:active-base-changed"]);
  });
});

describe("rótulos", () => {
  it("resume opciones y avisa cuando vienen sin etiqueta", () => {
    const op = [1, 2, 3, 4, 5].map((n) => ({ codigo: String(n), etiqueta: String(n) }));
    expect(resumenOpciones(op)).toBe("1 · 2 · 3 · +2");
    expect(resumenOpciones([{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }])).toBe("1 Sí · 2 No");
    expect(opcionesSinEtiqueta(op)).toBe(true);
    expect(opcionesSinEtiqueta([{ codigo: "1", etiqueta: "Sí" }])).toBe(false);
    expect(opcionesSinEtiqueta([])).toBe(false);
  });

  it("cuenta lo que incorpora en singular y plural", () => {
    expect(textoIncorporar(0)).toBe("Incorporar columnas");
    expect(textoIncorporar(1)).toBe("Incorporar 1 columna");
    expect(textoIncorporar(3)).toBe("Incorporar 3 columnas");
    expect(textoIncorporadas(1)).toBe("Se incorporó 1 columna.");
    expect(textoIncorporadas(4)).toBe("Se incorporaron 4 columnas.");
  });

  it("la regla se lee en llano", () => {
    const alguna = { regla: "alguna" as const, variables: ["a", "b", "c", "d", "e", "f", "g", "h", "i"], codigos: ["1"], escala: [] };
    expect(reglaLegible(alguna)).toBe("Alguna de 9 preguntas · sí = 1");
    expect(reglaLegible({ ...alguna, variables: ["P5"], codigos: ["1", "2"] })).toBe("P5 · sí = 1, 2");
    const escala = ["1", "2", "3", "4"].map((codigo) => ({ codigo, etiqueta: codigo }));
    expect(reglaLegible({ regla: "recodificar", variables: ["P8"], codigos: [], escala })).toBe("Recodifica P8 en 4 categorías");
  });

  it("el resumen nombra cada código y el sin dato", () => {
    expect(textoResumen({ por_codigo: [{ codigo: "1", etiqueta: "Sí", n: 120 }, { codigo: "0", etiqueta: "No", n: 300 }], n_sin_dato: 5, n_total: 425 }))
      .toBe("Sí 120 · No 300 · Sin dato 5");
  });
});

describe("columnas que trae la base", () => {
  const extras = [
    col("facultad", { tipo: "select_one", opciones: [{ codigo: "1", etiqueta: "1" }, { codigo: "2", etiqueta: "2" }] }),
    col("indice_vbg", { tipo: "decimal", label: "Índice VBG" }),
    col("P12_R", { declarada: true }),
  ];

  it("separa por incorporar e incorporadas", () => {
    const { pendientes, incorporadas } = separarColumnas(extras);
    expect(pendientes.map((c) => c.name)).toEqual(["facultad", "indice_vbg"]);
    expect(incorporadas.map((c) => c.name)).toEqual(["P12_R"]);
  });

  it("envía sólo las marcadas no incorporadas, con etiquetas editadas y opciones con su código si quedan vacías", () => {
    let b = reducirColumnas(BORRADOR_COLUMNAS_VACIO, { tipo: "todas", names: ["facultad", "indice_vbg", "P12_R"], marcada: true });
    b = reducirColumnas(b, { tipo: "etiqueta", name: "facultad", valor: "  Facultad  " });
    b = reducirColumnas(b, { tipo: "opcion", name: "facultad", codigo: "1", valor: "Letras" });
    b = reducirColumnas(b, { tipo: "opcion", name: "facultad", codigo: "2", valor: "   " });
    b = reducirColumnas(b, { tipo: "marcar", name: "indice_vbg", marcada: false });
    expect(columnasADeclarar(extras, b)).toEqual([
      { name: "facultad", label: "Facultad", tipo: "select_one", opciones: [{ codigo: "1", etiqueta: "Letras" }, { codigo: "2", etiqueta: "2" }] },
    ]);
    b = reducirColumnas(b, { tipo: "marcar", name: "indice_vbg", marcada: true });
    expect(columnasADeclarar(extras, b)[1]).toEqual({ name: "indice_vbg", label: "Índice VBG", tipo: "decimal" });
    expect(reducirColumnas(b, { tipo: "reiniciar" })).toEqual(BORRADOR_COLUMNAS_VACIO);
  });

  it("una etiqueta borrada cae al nombre de la columna", () => {
    const b = reducirColumnas(reducirColumnas(BORRADOR_COLUMNAS_VACIO, { tipo: "marcar", name: "indice_vbg", marcada: true }),
      { tipo: "etiqueta", name: "indice_vbg", valor: "" });
    expect(columnasADeclarar(extras, b)[0].label).toBe("indice_vbg");
  });
});

describe("variable calculada: alguna", () => {
  it("arma el cuerpo con las preguntas y los códigos «sí»", () => {
    const b = aplicar(
      borradorCalculadaDesde(null),
      { tipo: "nombre", valor: " vbg_alguna " },
      { tipo: "etiqueta", valor: "Sufrió alguna forma de VBG" },
      { tipo: "alguna", accion: { tipo: "agregar", base: "", variable: "P1" } },
      { tipo: "alguna", accion: { tipo: "agregar", base: "", variable: "P2" } },
      { tipo: "alguna", accion: { tipo: "agregar", base: "", variable: "P2" } },
      { tipo: "alguna", accion: { tipo: "alternar-codigo", base: "", codigo: "2" } },
    );
    expect(validarCalculada(b, ["P1", "P2"])).toEqual([]);
    expect(calculadaParaGuardar(b)).toEqual({
      nombre: "vbg_alguna",
      etiqueta: "Sufrió alguna forma de VBG",
      regla: "alguna",
      variables: ["P1", "P2"],
      codigos: ["1", "2"],
    });
  });

  it("valida nombre, etiqueta, preguntas, códigos y nombres ocupados", () => {
    const vacio = borradorCalculadaDesde(null);
    expect(validarCalculada(vacio, [])).toEqual(["Falta el nombre de la variable.", "Falta la etiqueta.", "Elige al menos una pregunta."]);
    const conNombre = aplicar(vacio, { tipo: "nombre", valor: "1x" }, { tipo: "etiqueta", valor: "X" });
    expect(validarCalculada(conNombre, [])[0]).toContain("empieza con una letra");
    const ocupado = aplicar(vacio, { tipo: "nombre", valor: "Recurrio" }, { tipo: "etiqueta", valor: "X" },
      { tipo: "alguna", accion: { tipo: "agregar", base: "", variable: "P1" } },
      { tipo: "alguna", accion: { tipo: "codigos", base: "", valor: " , " } });
    expect(validarCalculada(ocupado, ["recurrio"])).toEqual(["«Recurrio» ya existe en la base.", "Indica qué códigos cuentan como «sí»."]);
  });

  it("al editar, el nombre es la clave y no cambia", () => {
    const guardada: VariableCalculada = {
      nombre: "vbg", etiqueta: "VBG", regla: "alguna", variables: ["P1"], codigos: ["1", "3"], mapa: {}, escala: [],
    };
    const b = borradorCalculadaDesde(guardada);
    expect(b.alguna.codigosTexto).toBe("1, 3");
    expect(aplicar(b, { tipo: "nombre", valor: "otro" }).nombre).toBe("vbg");
    // Editando, su propio nombre no cuenta como ocupado.
    expect(validarCalculada(b, ["vbg"])).toEqual([]);
  });
});

describe("variable calculada: recodificar", () => {
  const origen = [
    { codigo: "1", etiqueta: "Nada" },
    { codigo: "2", etiqueta: "Poco" },
    { codigo: "3", etiqueta: "Bastante" },
    { codigo: "4", etiqueta: "Mucho" },
    { codigo: "99", etiqueta: "No sabe" },
  ];
  const base = aplicar(
    borradorCalculadaDesde(null),
    { tipo: "nombre", valor: "p8_r" },
    { tipo: "etiqueta", valor: "Confianza (2 grupos)" },
    { tipo: "regla", valor: "recodificar" },
    { tipo: "origen", variable: "P8" },
    { tipo: "categoria-agregar" },
    { tipo: "categoria-agregar" },
    { tipo: "categoria-etiqueta", clave: "c1", valor: "Baja" },
    { tipo: "categoria-etiqueta", clave: "c2", valor: "Alta" },
  );

  it("asigna en masa, deja sin mapa lo no asignado y sólo desmarca lo asignado", () => {
    const b = aplicar(
      base,
      { tipo: "marcar", codigo: "1", marcado: true },
      { tipo: "marcar", codigo: "2", marcado: true },
      { tipo: "marcar", codigo: "4", marcado: true },
      { tipo: "destino", codigos: ["1", "2"], destino: "1" },
      { tipo: "destino", codigos: ["3"], destino: "2" },
    );
    expect(b.recodificar.marcados).toEqual(["4"]);
    const filas = filasRecodificacion(origen, b.recodificar);
    expect(filas.filter((f) => f.sinMapa).map((f) => f.codigo)).toEqual(["4", "99"]);
    expect(filas[0]).toMatchObject({ destino: "1", etiquetaDestino: "Baja" });
    expect(validarCalculada(b, [], origen)).toEqual([]);
    expect(calculadaParaGuardar(b)).toEqual({
      nombre: "p8_r",
      etiqueta: "Confianza (2 grupos)",
      regla: "recodificar",
      variables: ["P8"],
      mapa: { "1": "1", "2": "1", "3": "2" },
      escala: [{ codigo: "1", etiqueta: "Baja" }, { codigo: "2", etiqueta: "Alta" }],
    });
  });

  it("cambiar el código de una categoría arrastra su mapa; quitarla, lo suelta", () => {
    const b = aplicar(base, { tipo: "destino", codigos: ["1", "2"], destino: "1" }, { tipo: "categoria-codigo", clave: "c1", valor: "10" });
    expect(b.recodificar.mapa).toEqual({ "1": "10", "2": "10" });
    const sin = aplicar(b, { tipo: "categoria-quitar", clave: "c1" });
    expect(sin.recodificar.mapa).toEqual({});
    expect(sin.recodificar.escala.map((c) => c.etiqueta)).toEqual(["Alta"]);
  });

  it("partir de las opciones de origen las copia con mapa identidad; cambiar de pregunta limpia el mapa", () => {
    const b = aplicar(base, { tipo: "copiar-opciones", opciones: origen });
    expect(b.recodificar.escala).toHaveLength(5);
    expect(b.recodificar.mapa["99"]).toBe("99");
    expect(aplicar(b, { tipo: "origen", variable: "P9" }).recodificar.mapa).toEqual({});
  });

  it("sin ningún código asignado, o con códigos repetidos, no guarda", () => {
    expect(validarCalculada(base, [], origen)).toEqual(["Asigna al menos un código de origen a una categoría."]);
    const repetido = aplicar(base, { tipo: "categoria-codigo", clave: "c2", valor: "1" }, { tipo: "destino", codigos: ["1"], destino: "1" });
    expect(validarCalculada(repetido, [], origen)).toContain("Hay códigos repetidos en la escala nueva.");
  });
});

describe("catálogo de la base", () => {
  const catalogo: VariableDeBase[] = [
    { name: "P8", label: "Confianza", seccion: "", opciones: [{ codigo: "1", etiqueta: "Nada" }] },
    { name: "vbg", label: "Calculada", seccion: "" },
  ];

  it("una calculada no se usa como fuente de otra", () => {
    expect(preguntasUsables(catalogo, [{ nombre: "vbg" }]).map((v) => v.name)).toEqual(["P8"]);
  });

  it("los nombres ocupados juntan catálogo, columnas y calculadas", () => {
    expect(nombresOcupados({ extras: [col("facultad")], calculadas: [{ nombre: "vbg" } as VariableCalculada] }, catalogo).sort())
      .toEqual(["P8", "facultad", "vbg"]);
  });

  it("sin la pregunta en el catálogo, los códigos de origen salen del mapa guardado", () => {
    expect(opcionesDeOrigen(catalogo, "P8", {})).toEqual([{ codigo: "1", etiqueta: "Nada" }]);
    expect(opcionesDeOrigen(catalogo, "P20", { "1": "1", "2": "1" })).toEqual([{ codigo: "1", etiqueta: "" }, { codigo: "2", etiqueta: "" }]);
  });
});

describe("estado del panel", () => {
  it("una mutación reemplaza los datos y libera el ocupado", () => {
    const datos = { base: "b", ya_codificada: false, extras: [], calculadas: [], retiradas: [], retiradas_pendientes: [], avisos: [] };
    let e = reducirEstado(ESTADO_INICIAL, { tipo: "leida", datos });
    e = reducirEstado(e, { tipo: "ocupado", ocupado: "codificada" });
    e = reducirEstado(e, { tipo: "datos", cambio: (d) => ({ ...d, ya_codificada: true }), mensaje: null });
    expect(e.ocupado).toBe("");
    expect(e.carga).toMatchObject({ tipo: "listo", datos: { ya_codificada: true } });
    e = reducirEstado(e, { tipo: "resumen", nombre: "x", resumen: { por_codigo: [], n_sin_dato: 0, n_total: 0 } });
    expect(Object.keys(reducirEstado(e, { tipo: "sin-resumen", nombre: "x" }).resumenes)).toEqual([]);
  });
});
