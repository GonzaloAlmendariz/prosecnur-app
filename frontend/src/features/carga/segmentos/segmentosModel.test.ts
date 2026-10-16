import { describe, expect, it } from "vitest";
import type { CodigosObservados } from "../../../api/codigosObservados";
import { normalizarEstadoEquivalencias, type EquivalenciaFila, type EquivalenciasEstado } from "../../../api/equivalencias";
import type { Segmento, SegmentoEnBase, SegmentosEstado } from "../../../api/segmentos";
import { aFilasEditor } from "../equivalenciasEditorModel";
import {
  atajosPartirDe,
  aniosParaTramos,
  ayudasDisponibles,
  borradorDesde,
  casosSinMapa,
  claveDeFilaCruce,
  claveDesdeEtiqueta,
  codigosConocidos,
  estadoCelda,
  estadoDeEntrada,
  filasDeCodigos,
  fusionarFilasCruce,
  mapaPorEtiqueta,
  mapasPorEtiqueta,
  mapaPorRangos,
  mapaPorTramos,
  normalizarClave,
  opcionesDeOrigen,
  ordenarBases,
  readinessSegmentos,
  reducirSegmento,
  resumenMapa,
  resumenSegmentos,
  searchConSegmentos,
  segmentoParaGuardar,
  textoEmparejarTodas,
  textoResumenMapa,
  textoSinDatoObservado,
  tramosPorDefecto,
  validarSegmento,
  validarTramos,
  valoresParaRangos,
  type AccionSegmento,
  type BorradorSegmento,
} from "./segmentosModel";

const BASES = ["2024", "2025", "2026"];

const enBase = (extra: Partial<SegmentoEnBase> = {}): SegmentoEnBase => ({
  origen: "cruce_1",
  mapa: { "1": "1", "2": "2" },
  estado: "definido",
  n_sin_mapa: 0,
  codigos_sin_mapa: [],
  ...extra,
});

const ESCALA = [
  { codigo: "1", etiqueta: "18 a 20 años" },
  { codigo: "2", etiqueta: "21 años a más" },
];

const segmento: Segmento = {
  clave: "edad",
  nombre: "cruce_edad",
  etiqueta: "Edad",
  escala: ESCALA,
  por_base: {
    "2024": enBase(),
    "2025": enBase({ origen: "P1_recod", mapa: { "1": "2" }, estado: "incompleto", n_sin_mapa: 37, codigos_sin_mapa: ["2"] }),
    "2026": enBase({ origen: "", mapa: {}, estado: "sin_origen" }),
  },
  fila_ref: "SEG-edad",
};

function aplicar(b: BorradorSegmento, ...acciones: AccionSegmento[]): BorradorSegmento {
  return acciones.reduce(reducirSegmento, b);
}

describe("direcciones y readiness", () => {
  it("abre el panel y, con clave, el segmento", () => {
    expect(searchConSegmentos("?pestana=equivalencias")).toBe("?pestana=equivalencias&panel=segmentos");
    expect(searchConSegmentos("?pestana=equivalencias", "edad")).toBe("?pestana=equivalencias&panel=segmentos&foco=edad");
  });

  it("false sólo mientras lee; los terminales sin contenido dicen por qué", () => {
    const datos: SegmentosEstado = { disponible: true, bases: BASES, segmentos: [] };
    expect(readinessSegmentos({ tipo: "cargando" })).toBe("false");
    expect(readinessSegmentos({ tipo: "error", mensaje: "x" })).toBe("vacio:error");
    expect(readinessSegmentos({ tipo: "listo", datos: { ...datos, disponible: false } })).toBe("vacio:no-disponible");
    expect(readinessSegmentos({ tipo: "listo", datos })).toBe("vacio:sin-segmentos");
    expect(readinessSegmentos({ tipo: "listo", datos: { ...datos, segmentos: [segmento] } })).toBe("true");
  });

  it("las bases siguen el orden de la serie y las que falten van al final", () => {
    expect(ordenarBases(["2026", "2024", "otra", "2025"], ["2024", "2025", "2026"])).toEqual(["2024", "2025", "2026", "otra"]);
  });
});

describe("estado de cada celda segmento × base", () => {
  it("definido, incompleto con los casos por asignar y sin origen", () => {
    expect(estadoCelda(segmento.por_base["2024"])).toEqual({ tono: "ok", texto: "Definido", detalle: "desde cruce_1" });
    expect(estadoCelda(segmento.por_base["2025"])).toEqual({ tono: "aviso", texto: "Faltan 37 casos por asignar", detalle: "desde P1_recod" });
    expect(estadoCelda(enBase({ estado: "incompleto", n_sin_mapa: 1 })).texto).toBe("Falta 1 caso por asignar");
    expect(estadoCelda(segmento.por_base["2026"])).toEqual({ tono: "neutro", texto: "Sin origen", detalle: "" });
    expect(estadoCelda(undefined).texto).toBe("Sin origen");
  });

  it("un origen que ya no está en la data es un aviso, no un «sin origen» tranquilo", () => {
    expect(estadoCelda(enBase({ origen: "P8", estado: "sin_origen", origen_ausente: true }))).toEqual({
      tono: "aviso",
      texto: "Falta el origen",
      detalle: "P8 ya no está en la base",
    });
  });

  it("el resumen dice cuántas bases tienen algo por resolver", () => {
    expect(resumenSegmentos({ disponible: true, bases: BASES, segmentos: [] })).toBe("Ninguno todavía.");
    expect(resumenSegmentos({ disponible: true, bases: BASES, segmentos: [segmento] })).toBe("1 segmento · 1 base con algo por resolver");
    const completo = { ...segmento, por_base: { "2024": enBase() } };
    expect(resumenSegmentos({ disponible: true, bases: ["2024"], segmentos: [completo] })).toBe("1 segmento en la base");
  });
});

describe("clave y nombre propuestos", () => {
  it("la clave sale de la etiqueta, como el nombre de una calculada, sin el prefijo", () => {
    expect(claveDesdeEtiqueta("Edad")).toBe("edad");
    expect(claveDesdeEtiqueta("Año de ingreso a la PUCP")).toBe("ano_ingreso_pucp");
    expect(claveDesdeEtiqueta("Cruce: sexo")).toBe("sexo");
    expect(claveDesdeEtiqueta("Una etiqueta muy larga que no cabe en el nombre técnico").length).toBeLessThanOrEqual(26);
  });

  it("lo tecleado se normaliza a lo que acepta el backend", () => {
    expect(normalizarClave("Año Ingreso")).toBe("ano_ingreso");
    expect(normalizarClave("cruce_cruce_sexo")).toBe("sexo");
    expect(normalizarClave("edad-2")).toBe("edad_2");
  });

  it("la clave acompaña a la etiqueta mientras siga siendo la propuesta", () => {
    let b = borradorDesde(null, BASES);
    b = aplicar(b, { tipo: "etiqueta", valor: "Sexo" });
    expect(b.clave).toBe("sexo");
    b = aplicar(b, { tipo: "etiqueta", valor: "Sexo declarado" });
    expect(b.clave).toBe("sexo_declarado");
    b = aplicar(b, { tipo: "clave", valor: "genero" }, { tipo: "etiqueta", valor: "Sexo" });
    expect(b.clave).toBe("genero");
  });

  it("editando, la clave es la identidad y no cambia", () => {
    const b = aplicar(borradorDesde(segmento, BASES), { tipo: "clave", valor: "otra" }, { tipo: "etiqueta", valor: "Edad 2" });
    expect(b.clave).toBe("edad");
  });

  it("la clave de una fila de cruce sale de su id SEG-*", () => {
    const [fila] = aFilasEditor([{ id: "SEG-edad", cruce: true, seccion: "", etiqueta_estandar: "Edad", variables: {}, cantidad: 0 }]);
    expect(claveDeFilaCruce(fila)).toBe("edad");
    const [otra] = aFilasEditor([{ id: "P1", seccion: "", etiqueta_estandar: "x", variables: {}, cantidad: 0 }]);
    expect(claveDeFilaCruce(otra)).toBeNull();
  });
});

describe("variables de origen y sus códigos", () => {
  it("el catálogo más las columnas fuera del formulario, sin calculadas ni segmentos", () => {
    const opciones = opcionesDeOrigen(
      [
        { name: "P1", label: "Edad", seccion: "A" },
        { name: "vbg", label: "VBG", seccion: "" },
        { name: "cruce_edad", label: "Edad", seccion: "" },
      ],
      {
        calculadas: [{ nombre: "vbg", etiqueta: "VBG", regla: "alguna", variables: [], codigos: [], mapa: {}, escala: [] }],
        extras: [
          { name: "P8_recod", label: "Año de ingreso", tipo: "integer", opciones: [{ codigo: "2020", etiqueta: "2020" }], n_validos: 10, declarada: false },
          { name: "P1", label: "Edad", tipo: "integer", opciones: [], n_validos: 10, declarada: true },
        ],
      },
      ["cruce_edad"],
    );
    expect(opciones.map((o) => o.name)).toEqual(["P1", "P8_recod"]);
    expect(opciones[1].seccion).toBe("Fuera del formulario");
    expect(opciones[1].opciones).toEqual([{ codigo: "2020", etiqueta: "2020" }]);
  });

  it("lo guardado del mismo origen suma lo mapeado y lo que el backend vio sin mapa", () => {
    const codigos = codigosConocidos([], "P1_recod", segmento.por_base["2025"], {});
    expect(codigos.map((c) => c.codigo)).toEqual(["1", "2"]);
    expect(codigos.every((c) => c.n === null)).toBe(true);
    // Otro origen: lo guardado no cuenta.
    expect(codigosConocidos([], "P2", segmento.por_base["2025"], {})).toEqual([]);
  });

  it("con los observados, la lista son los valores de la data con sus casos, más las opciones que nadie eligió", () => {
    const observados: CodigosObservados = {
      base: "2025", variable: "P8_recod", tipo: "categorica",
      codigos: [{ codigo: "2", etiqueta: "", n: 40 }, { codigo: "1", etiqueta: "Antes de 2020", n: 12 }],
      n_validos: 52, n_sin_dato: 3, truncado: false,
    };
    const codigos = codigosConocidos(
      [{ codigo: "1", etiqueta: "Antes" }, { codigo: "2", etiqueta: "2020 o después" }, { codigo: "9", etiqueta: "No sabe" }],
      "P8_recod",
      segmento.por_base["2025"],
      { "77": "1" },
      observados,
    );
    expect(codigos).toEqual([
      { codigo: "1", etiqueta: "Antes de 2020", n: 12 },
      { codigo: "2", etiqueta: "2020 o después", n: 40 },
      { codigo: "9", etiqueta: "No sabe", n: 0 },
    ]);
    // Texto libre: no hay observados que usar y queda lo que se conoce.
    expect(codigosConocidos([], "P2", undefined, {}, { ...observados, tipo: "texto", codigos: [] })).toEqual([]);
  });

  it("ofrece tramos para años y rangos para números sin etiqueta; sin códigos, ninguna", () => {
    expect(ayudasDisponibles([{ codigo: "2019", etiqueta: "" }, { codigo: "2024", etiqueta: "" }])).toEqual(["tramos"]);
    expect(ayudasDisponibles([{ codigo: "18", etiqueta: "" }, { codigo: "40", etiqueta: "" }])).toEqual(["rangos"]);
    expect(ayudasDisponibles([{ codigo: "1", etiqueta: "Mujer" }])).toEqual([]);
    expect(ayudasDisponibles([])).toEqual([]);
  });
});

describe("filas de la tabla de códigos", () => {
  it("cada código con su destino: escala, sin dato explícito o sin mapa", () => {
    const filas = filasDeCodigos(
      [{ codigo: "1", etiqueta: "Mujer", n: 10 }, { codigo: "2", etiqueta: "Hombre", n: 8 }, { codigo: "3", etiqueta: "Otro", n: 2 }],
      { "1": "2", "2": "", "3": "9" },
      ESCALA,
    );
    expect(filas.map((f) => [f.rotulo, f.destino, f.sinMapa])).toEqual([["1", "2", false], ["2", "", false], ["3", null, true]]);
    const r = resumenMapa(filas);
    expect(r).toEqual({ total: 3, asignados: 1, sinDato: 1, sinCasos: 0, sinMapa: 1 });
    expect(textoResumenMapa(r)).toBe("1 de 3 códigos asignados · 1 sin dato · 1 sin mapa");
    expect(estadoDeEntrada("P2", filas)).toBe("incompleto");
    expect(estadoDeEntrada("", filas)).toBe("sin_origen");
    expect(casosSinMapa(filas)).toBe(2);
    expect(textoSinDatoObservado(3)).toBe("Sin dato: 3 casos");
  });

  it("un código con 0 casos y sin mapa no es pendiente: no impide «Definido» (como en el backend)", () => {
    const filas = filasDeCodigos(
      [{ codigo: "1", etiqueta: "18–20 años", n: 40 }, { codigo: "2", etiqueta: "21 a más", n: 12 }, { codigo: "99", etiqueta: "No sé", n: 0 }],
      { "1": "1", "2": "2" },
      ESCALA,
    );
    expect(filas.map((f) => [f.rotulo, f.sinMapa, f.sinCasos])).toEqual([["1", false, false], ["2", false, false], ["99", false, true]]);
    const r = resumenMapa(filas);
    expect(r).toEqual({ total: 3, asignados: 2, sinDato: 0, sinCasos: 1, sinMapa: 0 });
    expect(textoResumenMapa(r)).toBe("2 de 3 códigos asignados · 1 sin casos");
    expect(estadoDeEntrada("P1_recod", filas)).toBe("definido");
    expect(casosSinMapa(filas)).toBe(0);
    // Con destino deja de ser «sin casos»; sin conteo (`n` nulo) sigue siendo pendiente.
    expect(filasDeCodigos([{ codigo: "99", etiqueta: "No sé", n: 0 }], { "99": "" }, ESCALA)[0].sinCasos).toBe(false);
    const sinConteo = filasDeCodigos([{ codigo: "99", etiqueta: "No sé", n: null }], {}, ESCALA);
    expect([sinConteo[0].sinMapa, sinConteo[0].sinCasos]).toEqual([true, false]);
  });

  it("en tramos, un tramo con casos sigue pendiente aunque alguno de sus códigos no tenga casos", () => {
    const codigos = Array.from({ length: 40 }, (_, i) => ({ codigo: String(16 + i), etiqueta: "", n: i === 39 ? 0 : 2 }));
    const filas = filasDeCodigos(codigos, {}, ESCALA);
    expect(filas).toHaveLength(1);
    expect([filas[0].sinMapa, filas[0].sinCasos]).toEqual([true, false]);
  });

  it("muchos enteros sin etiqueta se leen como tramos con el mismo destino", () => {
    const codigos = Array.from({ length: 40 }, (_, i) => ({ codigo: String(16 + i), etiqueta: "", n: 2 }));
    const mapa = Object.fromEntries(codigos.map((c) => [c.codigo, Number(c.codigo) <= 20 ? "1" : "2"]));
    const filas = filasDeCodigos(codigos, mapa, ESCALA);
    expect(filas.map((f) => f.rotulo)).toEqual(["16 a 20", "21 a 55"]);
    expect(filas[0].codigos).toHaveLength(5);
    expect(filas.map((f) => f.n)).toEqual([10, 70]);
    expect(casosSinMapa(filas)).toBe(0);
    expect(estadoDeEntrada("P1", filas)).toBe("definido");
  });
});

describe("borrador y acciones", () => {
  it("desde lo guardado: escala, origen y mapa por base", () => {
    const b = borradorDesde(segmento, BASES);
    expect(b.editando).toBe(true);
    expect(b.escala.map((c) => c.codigo)).toEqual(["1", "2"]);
    expect(b.porBase["2025"]).toEqual({ origen: "P1_recod", mapa: { "1": "2" }, marcados: [] });
    expect(b.porBase["2026"].origen).toBe("");
  });

  it("partir de las opciones de cruce_1 de 2024 arma la escala y, si la base no tiene origen, lo toma con identidad", () => {
    const b = aplicar(borradorDesde(null, BASES), {
      tipo: "partir-de",
      opciones: ESCALA,
      base: "2024",
      variable: "cruce_1",
    });
    expect(b.escala.map((c) => [c.codigo, c.etiqueta])).toEqual([["1", "18 a 20 años"], ["2", "21 años a más"]]);
    expect(b.porBase["2024"]).toEqual({ origen: "cruce_1", mapa: { "1": "1", "2": "2" }, marcados: [] });
  });

  it("partir del origen YA elegido de una base la deja en identidad, sin tener que emparejarla", () => {
    let b = aplicar(borradorDesde(null, BASES), { tipo: "origen", base: "2024", variable: "cruce_1" });
    b = aplicar(b, { tipo: "destino", base: "2024", codigos: ["99"], destino: "" });
    b = aplicar(b, { tipo: "partir-de", opciones: ESCALA, base: "2024", variable: "cruce_1" });
    expect(b.porBase["2024"]).toEqual({ origen: "cruce_1", mapa: { "1": "1", "2": "2", "99": "" }, marcados: [] });
    // Una base con OTRO origen no cambia de origen ni recibe identidad.
    b = aplicar(b, { tipo: "origen", base: "2025", variable: "P1_recod" });
    b = aplicar(b, { tipo: "partir-de", opciones: ESCALA, base: "2025", variable: "P9" });
    expect(b.porBase["2025"]).toEqual({ origen: "P1_recod", mapa: {}, marcados: [] });
  });

  it("cambiar un código de la escala arrastra lo asignado en todas las bases; quitarlo lo deja sin mapa", () => {
    let b = borradorDesde(segmento, BASES);
    const c2 = b.escala[1].clave;
    b = aplicar(b, { tipo: "destino", base: "2025", codigos: ["2"], destino: "" });
    b = aplicar(b, { tipo: "categoria-codigo", clave: c2, valor: "5" });
    expect(b.porBase["2024"].mapa).toEqual({ "1": "1", "2": "5" });
    expect(b.porBase["2025"].mapa).toEqual({ "1": "5", "2": "" });
    b = aplicar(b, { tipo: "categoria-quitar", clave: c2 });
    expect(b.porBase["2025"].mapa).toEqual({ "2": "" });
  });

  it("cambiar el origen limpia su mapa; marcar y asignar en masa", () => {
    let b = aplicar(borradorDesde(segmento, BASES), { tipo: "origen", base: "2025", variable: "P1" });
    expect(b.porBase["2025"]).toEqual({ origen: "P1", mapa: {}, marcados: [] });
    b = aplicar(b, { tipo: "marcar", base: "2025", codigos: ["18", "19"], marcado: true });
    expect(b.porBase["2025"].marcados).toEqual(["18", "19"]);
    b = aplicar(b, { tipo: "destino", base: "2025", codigos: ["18", "19"], destino: "1" });
    expect(b.porBase["2025"]).toEqual({ origen: "P1", mapa: { "18": "1", "19": "1" }, marcados: [] });
    b = aplicar(b, { tipo: "destino", base: "2025", codigos: ["19"], destino: null });
    expect(b.porBase["2025"].mapa).toEqual({ "18": "1" });
  });

  it("emparejar por etiqueta lleva a la escala lo que dice lo mismo, aunque el orden esté invertido", () => {
    const codigos = [{ codigo: "1", etiqueta: "21 años a más" }, { codigo: "2", etiqueta: "18 a 20 AÑOS" }, { codigo: "3", etiqueta: "No sabe" }];
    expect(mapaPorEtiqueta(codigos, {}, ESCALA)).toEqual({ "1": "2", "2": "1" });
    expect(mapaPorEtiqueta(codigos, { "1": "1" }, ESCALA)).toEqual({ "2": "1" });
  });

  it("emparejar por etiqueta es tolerante: raya y guion, puntuación y marcado Kobo casan", () => {
    const escala = [{ codigo: "1", etiqueta: "18-20 años" }, { codigo: "2", etiqueta: "21 años a más" }, { codigo: "99", etiqueta: "No sé" }];
    const codigos = [
      { codigo: "1", etiqueta: "18–20 años" },
      { codigo: "2", etiqueta: "*21 años a más.*" },
      { codigo: "9", etiqueta: "¿No se?" },
    ];
    expect(mapaPorEtiqueta(codigos, {}, escala)).toEqual({ "1": "1", "2": "2", "9": "99" });
  });

  it("dos códigos de la base que dicen lo mismo no se emparejan: tampoco en el origen se elige al azar", () => {
    const escala = [{ codigo: "1", etiqueta: "Otro" }, { codigo: "2", etiqueta: "Sí" }];
    const codigos = [{ codigo: "5", etiqueta: "Otro" }, { codigo: "6", etiqueta: "*otro*" }, { codigo: "7", etiqueta: "SI" }];
    expect(mapaPorEtiqueta(codigos, {}, escala)).toEqual({ "7": "2" });
  });

  it("emparejar conserva los signos que cambian la categoría", () => {
    const escala = [{ codigo: "1", etiqueta: "18" }, { codigo: "2", etiqueta: "60" }, { codigo: "3", etiqueta: "5" }, { codigo: "4", etiqueta: "1-2" }];
    const codigos = [
      { codigo: "a", etiqueta: "+18" },
      { codigo: "b", etiqueta: "≥ 60" },
      { codigo: "c", etiqueta: "5%" },
      { codigo: "d", etiqueta: "1/2" },
      { codigo: "e", etiqueta: "1–2" },
    ];
    expect(mapaPorEtiqueta(codigos, {}, escala)).toEqual({ e: "4" });
  });

  it("dos categorías que dicen lo mismo con otro código no se emparejan: sería elegir al azar", () => {
    const escala = [{ codigo: "1", etiqueta: "Otro" }, { codigo: "2", etiqueta: "otro." }];
    expect(mapaPorEtiqueta([{ codigo: "5", etiqueta: "Otro" }], {}, escala)).toEqual({});
  });

  it("emparejar todas: cada base con origen a la vez, sólo lo sin mapa", () => {
    let b = aplicar(
      borradorDesde(null, BASES),
      { tipo: "origen", base: "2024", variable: "cruce_1" },
      { tipo: "origen", base: "2025", variable: "P1_recod" },
      { tipo: "destino", base: "2025", codigos: ["1"], destino: "2" },
    );
    const codigosPorBase = {
      "2024": [{ codigo: "1", etiqueta: "18 a 20 años" }, { codigo: "2", etiqueta: "21 años a más" }],
      "2025": [{ codigo: "1", etiqueta: "18 a 20 años" }, { codigo: "2", etiqueta: "21 años a más" }, { codigo: "3", etiqueta: "No sabe" }],
      // Sin origen en 2026: no cuenta aunque traiga códigos.
      "2026": [{ codigo: "1", etiqueta: "18 a 20 años" }],
    };
    const todas = mapasPorEtiqueta(b, codigosPorBase, ESCALA);
    expect(todas).toEqual({ mapas: { "2024": { "1": "1", "2": "2" }, "2025": { "2": "2" } }, codigos: 3, bases: 2 });
    expect(textoEmparejarTodas(todas)).toBe("Lleva 3 códigos sin mapa en 2 bases a la categoría con su misma etiqueta. No toca lo ya asignado.");
    b = aplicar(b, { tipo: "aplicar-mapas", mapas: todas.mapas });
    expect(b.porBase["2024"].mapa).toEqual({ "1": "1", "2": "2" });
    expect(b.porBase["2025"].mapa).toEqual({ "1": "2", "2": "2" });
    expect(b.porBase["2026"].mapa).toEqual({});
    expect(mapasPorEtiqueta(b, codigosPorBase, ESCALA).codigos).toBe(0);
  });

  it("los orígenes ya elegidos son atajos de «Partir de…», con sus opciones o, sin lista, sus códigos", () => {
    const b = aplicar(
      borradorDesde(null, BASES),
      { tipo: "origen", base: "2024", variable: "cruce_1" },
      { tipo: "origen", base: "2025", variable: "P1_recod" },
    );
    const opcionesPorBase = {
      "2024": [{ name: "cruce_1", label: "Edad", seccion: "", opciones: [{ codigo: "1", etiqueta: "*18-20 años*" }] }],
      "2025": [{ name: "P1_recod", label: "Edad", seccion: "Fuera del formulario" }],
      "2026": null,
    };
    const atajos = atajosPartirDe(BASES, b.porBase, opcionesPorBase, { "2025": [{ codigo: "1", etiqueta: "" }] }, (s) => s.replace(/\*/g, ""));
    expect(atajos).toEqual([
      { base: "2024", variable: "cruce_1", rotulo: "cruce_1 · 2024", opciones: [{ codigo: "1", etiqueta: "18-20 años" }] },
      { base: "2025", variable: "P1_recod", rotulo: "P1_recod · 2025", opciones: [{ codigo: "1", etiqueta: "1" }] },
    ]);
    expect(atajosPartirDe(BASES, b.porBase, opcionesPorBase, {})).toHaveLength(1);
  });
});

describe("tramos de antigüedad y rangos", () => {
  const escala3 = [{ codigo: "1", etiqueta: "0 a 2 años" }, { codigo: "2", etiqueta: "3 a 4 años" }, { codigo: "3", etiqueta: "5 años o más" }];

  it("el mapa por tramos es relativo al año de la medición", () => {
    const tramos = tramosPorDefecto(escala3);
    expect(tramos.map((t) => [t.desde, t.hasta, t.destino])).toEqual([["0", "2", "1"], ["3", "4", "2"], ["5", "", "3"]]);
    const anios = ["2026", "2024", "2023", "2022", "2021", "2010", "2027"];
    expect(mapaPorTramos(anios, 2026, tramos)).toEqual({ "2026": "1", "2024": "1", "2023": "2", "2022": "2", "2021": "3", "2010": "3" });
    // El mismo año de ingreso cae en otro tramo en otra medición.
    expect(mapaPorTramos(["2022"], 2024, tramos)).toEqual({ "2022": "1" });
  });

  it("los tramos se aplican sólo a los años observados", () => {
    expect(aniosParaTramos([])).toEqual([]);
    expect(aniosParaTramos([{ codigo: "2020", etiqueta: "" }, { codigo: "x", etiqueta: "" }])).toEqual(["2020"]);
  });

  it("rangos de edad: extremos incluidos y «o más» sin tope", () => {
    const rangos = [
      { clave: "t1", desde: "18", hasta: "20", destino: "1" },
      { clave: "t2", desde: "21", hasta: "", destino: "2" },
    ];
    expect(mapaPorRangos(["17", "18", "20", "21", "64"], rangos)).toEqual({ "18": "1", "20": "1", "21": "2", "64": "2" });
    expect(valoresParaRangos([{ codigo: "18", etiqueta: "" }, { codigo: "NS", etiqueta: "" }, { codigo: "64", etiqueta: "" }]))
      .toEqual(["18", "64"]);
    expect(valoresParaRangos([])).toEqual([]);
  });

  it("valida extremos, categoría, superposición y el año", () => {
    expect(validarTramos(tramosPorDefecto(escala3), escala3, 2026)).toEqual([]);
    expect(validarTramos(tramosPorDefecto(escala3), escala3, null)).toContain("Indica el año de la medición.");
    expect(validarTramos([{ clave: "t1", desde: "5", hasta: "2", destino: "1" }], escala3)).toContain("En el tramo 1, «hasta» es menor que «desde».");
    expect(validarTramos([{ clave: "t1", desde: "0", hasta: "3", destino: "1" }, { clave: "t2", desde: "3", hasta: "", destino: "2" }], escala3))
      .toContain("Los tramos se superponen.");
    expect(validarTramos([{ clave: "t1", desde: "0", hasta: "", destino: "" }], escala3)).toContain("Elige la categoría del tramo 1.");
  });
});

describe("validación y cuerpo del POST", () => {
  it("dice lo que falta en el orden del editor", () => {
    const b = borradorDesde(null, BASES);
    expect(validarSegmento(b, BASES, [])).toEqual([
      "Falta la etiqueta.",
      "Falta el nombre del segmento.",
      "Define al menos una categoría de la escala estándar.",
      "Elige la variable de origen en al menos una base.",
    ]);
  });

  it("una clave repetida, una base con origen sin ningún código asignado", () => {
    let b = aplicar(borradorDesde(null, BASES), { tipo: "etiqueta", valor: "Edad" }, { tipo: "partir-de", opciones: ESCALA });
    b = aplicar(b, { tipo: "origen", base: "2026", variable: "P1" });
    expect(validarSegmento(b, BASES, ["edad"])).toEqual([
      "Ya hay un segmento «cruce_edad».",
      "En 2026, asigna al menos un código de P1 a la escala.",
    ]);
  });

  it("el cuerpo lleva sólo las bases con origen y destinos de la escala o sin dato", () => {
    let b = borradorDesde(segmento, BASES);
    b = aplicar(b, { tipo: "destino", base: "2025", codigos: ["2"], destino: "" });
    b = { ...b, porBase: { ...b.porBase, "2024": { ...b.porBase["2024"], mapa: { "1": "1", "2": "2", "3": "9" } } } };
    expect(validarSegmento(b, BASES, [])).toEqual([]);
    expect(segmentoParaGuardar(b, BASES)).toEqual({
      clave: "edad",
      etiqueta: "Edad",
      escala: ESCALA,
      por_base: {
        "2024": { origen: "cruce_1", mapa: { "1": "1", "2": "2" } },
        "2025": { origen: "P1_recod", mapa: { "1": "2", "2": "" } },
      },
    });
  });
});

describe("la matriz tras guardar o quitar un segmento", () => {
  const fila = (etiqueta: string, extra: Partial<EquivalenciaFila> = {}): EquivalenciaFila => ({
    seccion: "",
    etiqueta_estandar: etiqueta,
    variables: { "2024": etiqueta },
    cantidad: 1,
    ...extra,
  });

  it("reemplaza sólo las filas de cruce y corrige la posición declarada de las demás", () => {
    const antes = [fila("A"), fila("Edad", { id: "SEG-edad", cruce: true }), fila("B")];
    const ahora = [fila("A"), fila("B"), fila("Sexo", { id: "SEG-sexo", cruce: true })];
    const enEdicion = aFilasEditor(antes).map((f) => (f.etiqueta_estandar === "B" ? { ...f, etiqueta_estandar: "B editada" } : f));
    const out = fusionarFilasCruce(enEdicion, antes, ahora);
    expect(out.map((f) => [f.etiqueta_estandar, f.indice_declarado])).toEqual([["A", 0], ["B editada", 1], ["Sexo", 2]]);
    expect(out[2].id_declarado).toBe("SEG-sexo");
  });

  it("el normalizador conserva la marca `cruce` (R la manda como arreglo de uno)", () => {
    const raw = {
      ok: true,
      disponible: true,
      declarada: true,
      n_filas: 2,
      bases: ["2024"],
      cobertura: {},
      desfasadas: [],
      filas: [
        { id: "SEG-edad", cruce: [true], seccion: "Segmentos de cruce", etiqueta_estandar: "Edad", variables: { "2024": "cruce_edad" } },
        { seccion: "", etiqueta_estandar: "P1", variables: { "2024": "P1" }, cruce: false },
      ],
    } as unknown as EquivalenciasEstado;
    const filas = normalizarEstadoEquivalencias(raw).filas ?? [];
    expect(filas[0].cruce).toBe(true);
    expect("cruce" in filas[1]).toBe(false);
  });
});
