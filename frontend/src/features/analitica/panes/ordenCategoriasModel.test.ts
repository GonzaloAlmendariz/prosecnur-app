import { describe, expect, test } from "vitest";
import type { DataReviewVariable, VariableInstrumento } from "../../../api/client";
import {
  aplicarOrdenGuardado,
  derivarCatalogoListas,
  enviarEspecialesAlFinal,
  esListaOrdinalEfectiva,
  esValorEspecial,
  moverAbajo,
  moverAlFinal,
  moverAlInicio,
  moverArriba,
  ordenesIguales,
  ordinalAutoDeLista,
  sembrarOrden,
  VALORES_ESPECIALES,
} from "./ordenCategoriasModel";

describe("ordenCategoriasModel", () => {
  test("esValorEspecial reconoce el estándar de la casa", () => {
    for (const code of VALORES_ESPECIALES) expect(esValorEspecial(code)).toBe(true);
    expect(esValorEspecial("1")).toBe(false);
    expect(esValorEspecial("5")).toBe(false);
  });

  test("enviarEspecialesAlFinal empuja especiales al final preservando orden relativo", () => {
    expect(enviarEspecialesAlFinal(["1", "98", "2", "99", "3"])).toEqual(["1", "2", "3", "98", "99"]);
  });

  test("enviarEspecialesAlFinal no altera listas sin especiales", () => {
    expect(enviarEspecialesAlFinal(["1", "2", "3"])).toEqual(["1", "2", "3"]);
  });

  test("aplicarOrdenGuardado respeta guardados y anexa faltantes en orden del instrumento", () => {
    const instrumento = ["1", "2", "3", "4"];
    const guardado = ["3", "1"];
    expect(aplicarOrdenGuardado(instrumento, guardado)).toEqual(["3", "1", "2", "4"]);
  });

  test("aplicarOrdenGuardado descarta códigos guardados que ya no existen y no duplica", () => {
    const instrumento = ["1", "2", "3"];
    const guardado = ["3", "999", "3", "2"];
    expect(aplicarOrdenGuardado(instrumento, guardado)).toEqual(["3", "2", "1"]);
  });

  test("sembrarOrden sin override usa instrumento con especiales al final", () => {
    expect(sembrarOrden(["1", "98", "2", "99"], undefined)).toEqual(["1", "2", "98", "99"]);
    expect(sembrarOrden(["1", "2"], [])).toEqual(["1", "2"]);
  });

  test("sembrarOrden con override lo respeta tal cual (ausentes al final)", () => {
    expect(sembrarOrden(["1", "2", "3", "99"], ["99", "1"])).toEqual(["99", "1", "2", "3"]);
  });

  test("ordenesIguales compara secuencia exacta", () => {
    expect(ordenesIguales(["1", "2"], ["1", "2"])).toBe(true);
    expect(ordenesIguales(["1", "2"], ["2", "1"])).toBe(false);
    expect(ordenesIguales(["1"], ["1", "2"])).toBe(false);
  });
});

// ---- Helpers de fixtures para el catálogo ----------------------------------
function mkVar(name: string, list_name: string, list_ordinal_auto?: boolean): VariableInstrumento {
  return { name, label: name, tipo: "select_one", list_name, list_ordinal_auto };
}

function mkDR(name: string, codes: string[]): DataReviewVariable {
  return {
    name,
    tipo_xlsform: "select_one",
    seccion: "",
    included: true,
    label_actual: name,
    label_original: name,
    n_non_missing: 0,
    n_missing: 0,
    opciones: codes.map((code) => ({ code, label: code, count: 0 })),
  };
}

describe("derivarCatalogoListas", () => {
  test("agrupa por list_name con conteos, categorías y flag de override", () => {
    const variables = [
      mkVar("p1", "satisfaccion"),
      mkVar("p2", "satisfaccion"),
      mkVar("p3", "acuerdo"),
    ];
    const dataReview = [
      mkDR("p1", ["1", "2", "3", "4"]),
      mkDR("p2", ["1", "2", "3", "4"]),
      mkDR("p3", ["1", "2"]),
    ];
    const catalogo = derivarCatalogoListas(variables, dataReview, { satisfaccion: ["4", "3", "2", "1"] });

    // satisfaccion primero (2 variables > 1 de acuerdo).
    expect(catalogo.map((e) => e.listName)).toEqual(["satisfaccion", "acuerdo"]);
    expect(catalogo[0]).toEqual({
      listName: "satisfaccion",
      nVariables: 2,
      nCategorias: 4,
      tieneOverride: true,
      ordinalAuto: false,
      ordinalEfectivo: false,
    });
    expect(catalogo[1]).toEqual({
      listName: "acuerdo",
      nVariables: 1,
      nCategorias: 2,
      tieneOverride: false,
      ordinalAuto: false,
      ordinalEfectivo: false,
    });
  });

  test("ignora list_name vacío y resuelve categorías desde la primera var con opciones", () => {
    const variables = [
      mkVar("sinlista", "  "),
      mkVar("a1", "canales"),
      mkVar("a2", "canales"),
    ];
    // a1 sin opciones en la base (todas missing); cae a a2.
    const dataReview = [mkDR("a1", []), mkDR("a2", ["1", "2", "3"])];
    const catalogo = derivarCatalogoListas(variables, dataReview, {});

    expect(catalogo).toEqual([
      { listName: "canales", nVariables: 2, nCategorias: 3, tieneOverride: false, ordinalAuto: false, ordinalEfectivo: false },
    ]);
  });

  test("override vacío no cuenta como orden propio", () => {
    const catalogo = derivarCatalogoListas(
      [mkVar("p1", "acuerdo")],
      [mkDR("p1", ["1", "2"])],
      { acuerdo: [] },
    );
    expect(catalogo[0].tieneOverride).toBe(false);
  });

  test("desempata alfabéticamente cuando hay igual número de variables", () => {
    const variables = [mkVar("z1", "zeta"), mkVar("a1", "alfa")];
    const dataReview = [mkDR("z1", ["1"]), mkDR("a1", ["1"])];
    const catalogo = derivarCatalogoListas(variables, dataReview, {});
    expect(catalogo.map((e) => e.listName)).toEqual(["alfa", "zeta"]);
  });
});

describe("movimiento manual por fila", () => {
  test("moverArriba en la primera fila es no-op (misma referencia)", () => {
    const codes = ["1", "2", "3"];
    expect(moverArriba(codes, 0)).toBe(codes);
  });

  test("moverArriba intercambia con la fila anterior", () => {
    expect(moverArriba(["1", "2", "3"], 2)).toEqual(["1", "3", "2"]);
  });

  test("moverAbajo en la última fila es no-op (misma referencia)", () => {
    const codes = ["1", "2", "3"];
    expect(moverAbajo(codes, 2)).toBe(codes);
  });

  test("moverAbajo intercambia con la fila siguiente", () => {
    expect(moverAbajo(["1", "2", "3"], 0)).toEqual(["2", "1", "3"]);
  });

  test("moverAlInicio lleva la categoría al tope", () => {
    expect(moverAlInicio(["1", "2", "3", "4"], 3)).toEqual(["4", "1", "2", "3"]);
    // ya en el inicio → no-op.
    const codes = ["1", "2"];
    expect(moverAlInicio(codes, 0)).toBe(codes);
  });

  test("moverAlFinal lleva la categoría al fondo", () => {
    expect(moverAlFinal(["1", "2", "3", "4"], 0)).toEqual(["2", "3", "4", "1"]);
    // ya en el final → no-op.
    const codes = ["1", "2"];
    expect(moverAlFinal(codes, 1)).toBe(codes);
  });

  test("índice fuera de rango es no-op", () => {
    const codes = ["1", "2"];
    expect(moverArriba(codes, 9)).toBe(codes);
    expect(moverAbajo(codes, -1)).toBe(codes);
  });
});

describe("esListaOrdinalEfectiva (contrato compartido)", () => {
  test("sin override: cae a la auto-detección del backend", () => {
    expect(esListaOrdinalEfectiva("satisfaccion", {}, { satisfaccion: true })).toBe(true);
    expect(esListaOrdinalEfectiva("distrito", {}, { distrito: false })).toBe(false);
  });

  test("sin override y sin auto mapeado: false", () => {
    expect(esListaOrdinalEfectiva("desconocida", {}, {})).toBe(false);
  });

  test("override false gana sobre auto true", () => {
    expect(esListaOrdinalEfectiva("satisfaccion", { satisfaccion: false }, { satisfaccion: true })).toBe(false);
  });

  test("override true gana sobre auto false", () => {
    expect(esListaOrdinalEfectiva("distrito", { distrito: true }, { distrito: false })).toBe(true);
  });

  test("override no afecta a otras listas", () => {
    const overrides = { satisfaccion: false };
    const auto = { satisfaccion: true, acuerdo: true };
    expect(esListaOrdinalEfectiva("acuerdo", overrides, auto)).toBe(true);
  });
});

describe("ordinalAutoDeLista", () => {
  test("toma el primer list_ordinal_auto definido de las variables agrupadas", () => {
    expect(ordinalAutoDeLista([mkVar("p1", "esc", true), mkVar("p2", "esc", true)])).toBe(true);
    expect(ordinalAutoDeLista([mkVar("p1", "esc", false)])).toBe(false);
  });

  test("sin señal (todas undefined) → false", () => {
    expect(ordinalAutoDeLista([mkVar("p1", "esc"), mkVar("p2", "esc")])).toBe(false);
    expect(ordinalAutoDeLista([])).toBe(false);
  });

  test("ignora undefined hasta encontrar el primer valor definido", () => {
    expect(ordinalAutoDeLista([mkVar("p1", "esc"), mkVar("p2", "esc", true)])).toBe(true);
  });
});

describe("derivarCatalogoListas — ordinalidad", () => {
  test("expone ordinalAuto desde las variables y ordinalEfectivo = auto sin override", () => {
    const variables = [mkVar("p1", "satisfaccion", true), mkVar("p2", "distrito", false)];
    const dataReview = [mkDR("p1", ["1", "2"]), mkDR("p2", ["1", "2", "3"])];
    const catalogo = derivarCatalogoListas(variables, dataReview, {}, {});
    const sat = catalogo.find((e) => e.listName === "satisfaccion")!;
    const dist = catalogo.find((e) => e.listName === "distrito")!;
    expect(sat.ordinalAuto).toBe(true);
    expect(sat.ordinalEfectivo).toBe(true);
    expect(dist.ordinalAuto).toBe(false);
    expect(dist.ordinalEfectivo).toBe(false);
  });

  test("el override explícito gana sobre la auto-detección", () => {
    const variables = [mkVar("p1", "satisfaccion", true), mkVar("p2", "distrito", false)];
    const dataReview = [mkDR("p1", ["1", "2"]), mkDR("p2", ["1", "2"])];
    const catalogo = derivarCatalogoListas(
      variables,
      dataReview,
      {},
      { satisfaccion: false, distrito: true },
    );
    const sat = catalogo.find((e) => e.listName === "satisfaccion")!;
    const dist = catalogo.find((e) => e.listName === "distrito")!;
    // auto true pero override false → efectivo false.
    expect(sat.ordinalAuto).toBe(true);
    expect(sat.ordinalEfectivo).toBe(false);
    // auto false pero override true → efectivo true.
    expect(dist.ordinalAuto).toBe(false);
    expect(dist.ordinalEfectivo).toBe(true);
  });
});
