import { describe, expect, it } from "vitest";
import type { OrigenExterno } from "../../api/cargaOrigenExterno";
import {
  BORRADOR_VACIO,
  cadenaOrigenEnLlano,
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
  },
  resumen: { recibidas: 3327, excluidas: 9, entregadas: 3318, por_categoria: [] },
  avisos: [],
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

  it("dice qué falta para declarar", () => {
    expect(motivoNoDeclarable(BORRADOR_VACIO)).toMatch(/lista de exclusiones/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, archivo: archivo("lista.pdf") })).toMatch(/xlsx o un csv/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, archivo: archivo("lista.csv"), recibidas: "3.5" })).toMatch(/entero/u);
    expect(motivoNoDeclarable({ ...BORRADOR_VACIO, archivo: archivo("lista.xlsx") })).toBe("");
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
