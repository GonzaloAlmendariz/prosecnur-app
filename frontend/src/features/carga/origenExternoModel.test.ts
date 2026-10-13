import { describe, expect, it } from "vitest";
import type { OrigenExterno } from "../../api/cargaOrigenExterno";
import {
  BORRADOR_VACIO,
  borradorDesde,
  cadenaOrigenEnLlano,
  desgloseVariables,
  fraseVariablesRetiradas,
  motivosElegidos,
  motivosIniciales,
  muestraCadenaCasos,
  leerRecibidas,
  motivoNoDeclarable,
  procedenciaScript,
  rotuloEstado,
  tramosOrigen,
} from "./origenExternoModel";

const DECLARADA: OrigenExterno = {
  base: "hostigamiento",
  estado: "vigente",
  bloque: {
    script: "limpieza.R",
    version: "v3",
    n_recibidas: 3327,
    n_recibidas_deducida: false,
    n_entregadas: 3318,
    n_excluidas: 9,
    data_file_id: "abc",
    declarado_at: "2026-10-13T15:00:00Z",
    enabled: true,
    variables_retiradas: [],
    n_variables_retiradas: 0,
  },
  resumen: {
    recibidas: 3327,
    excluidas: 9,
    entregadas: 3318,
    por_categoria: [],
    variables_retiradas: { total: 0, por_motivo: [] },
  },
  variables_faltantes: [],
  avisos: [],
  variables_excluidas_agregadas: [],
};

const SOLO_VARIABLES: OrigenExterno = {
  ...DECLARADA,
  bloque: {
    ...DECLARADA.bloque!,
    n_recibidas: 3318,
    n_entregadas: 3318,
    n_excluidas: 0,
    variables_retiradas: [{ variable: "p40", tipo: "text", motivo: "no_va_al_cliente" }],
    n_variables_retiradas: 1,
  },
  resumen: {
    recibidas: 3318,
    excluidas: 0,
    entregadas: 3318,
    por_categoria: [],
    variables_retiradas: { total: 1, por_motivo: [{ motivo: "no_va_al_cliente", n: 1 }] },
  },
  variables_faltantes: [
    { variable: "start", tipo: "start", motivo_sugerido: "metadato" },
    { variable: "p40", tipo: "text", motivo_sugerido: "" },
    { variable: "p41", tipo: "integer", motivo_sugerido: "" },
  ],
};

function archivo(nombre: string): File {
  return new File(["_uuid,motivo\n"], nombre);
}

describe("origenExternoModel", () => {
  it("lee las recibidas: vacío se deduce, acepta miles y rechaza decimales", () => {
    expect(leerRecibidas("")).toEqual({ ok: true, valor: null });
    expect(leerRecibidas(" 3327 ")).toEqual({ ok: true, valor: 3327 });
    expect(leerRecibidas("3 327")).toEqual({ ok: true, valor: 3327 });
    expect(leerRecibidas("3,327")).toEqual({ ok: true, valor: 3327 });
    expect(leerRecibidas("3.5").ok).toBe(false);
    expect(leerRecibidas("-4").ok).toBe(false);
    expect(leerRecibidas("tres mil").ok).toBe(false);
  });

  it("dice qué falta para declarar: basta una de las dos partes", () => {
    expect(motivoNoDeclarable(BORRADOR_VACIO)).toMatch(/^No hay nada que declarar/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, motivos: { p40: "" } })).toMatch(/^No hay nada que declarar/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, archivo: archivo("lista.pdf") })).toMatch(/xlsx o un csv/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, archivo: archivo("lista.csv"), recibidas: "3.5" })).toMatch(/entero/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, archivo: archivo("lista.xlsx") })).toBe("");
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, motivos: { start: "metadato" } })).toBe("");
  });

  it("precarga el motivo declarado, si no el sugerido, y envía sólo los elegidos", () => {
    expect(motivosIniciales(SOLO_VARIABLES)).toEqual({ start: "metadato", p40: "no_va_al_cliente", p41: "" });
    expect(borradorDesde(SOLO_VARIABLES).archivo).toBeNull();
    expect(motivosElegidos({ start: "metadato", p40: "", p41: "otra" })).toEqual({ start: "metadato", p41: "otra" });
  });

  it("variables retiradas: frase, desglose y si la cadena de casos aplica", () => {
    expect(fraseVariablesRetiradas(1)).toBe("1 variable retirada");
    expect(fraseVariablesRetiradas(30)).toBe("30 variables retiradas");
    expect(desgloseVariables(SOLO_VARIABLES)).toEqual([
      { motivo: "no_va_al_cliente", rotulo: "No va al cliente", valor: "1" },
    ]);
    expect(muestraCadenaCasos(SOLO_VARIABLES)).toBe(false);
    expect(muestraCadenaCasos(DECLARADA)).toBe(true);
  });

  it("arma la cadena recibidas → retiradas fuera → cargadas", () => {
    expect(tramosOrigen(DECLARADA).map((tramo) => [tramo.rotulo, tramo.valor])).toEqual([
      ["Recibidas", "3,327"],
      ["Retiradas fuera", "9"],
      ["Cargadas", "3,318"],
    ]);
    expect(cadenaOrigenEnLlano(DECLARADA)).toBe("Recibidas 3,327 → retiradas fuera 9 → cargadas 3,318");
  });

  it("marca las recibidas deducidas y deja la cadena vacía sin declaración", () => {
    const deducida = { ...DECLARADA, bloque: { ...DECLARADA.bloque!, n_recibidas_deducida: true } };
    expect(tramosOrigen(deducida)[0].nota).toMatch(/deducidas/u);
    expect(tramosOrigen({ ...DECLARADA, bloque: null, resumen: null, estado: "" })).toEqual([]);
  });

  it("rotula estado y procedencia", () => {
    expect(rotuloEstado("vigente")).toBe("Declarada");
    expect(rotuloEstado("otra_base")).toBe("Otra base");
    expect(rotuloEstado("")).toBe("Sin declarar");
    expect(procedenciaScript(DECLARADA)).toBe("limpieza.R · versión v3");
  });
});
