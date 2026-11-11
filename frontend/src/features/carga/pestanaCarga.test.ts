import { describe, expect, it } from "vitest";
import { PROCESAMIENTO_PESTANAS, pestanasCargaDisponibles } from "../../lib/navegacion/catalogos/procesamiento";
import {
  ALIAS_PESTANAS_CARGA,
  PESTANA_CARGA_POR_DEFECTO,
  avisoPestanaNoDisponible,
  clavePedidaCarga,
  pestanaPedidaDeDireccion,
  resolverPestanaCarga,
} from "./pestanaCarga";

const CON_EQUIVALENCIAS = pestanasCargaDisponibles({ basesSeparadas: true }).map((tab) => tab.key);
const SIN_EQUIVALENCIAS = pestanasCargaDisponibles({ basesSeparadas: false }).map((tab) => tab.key);

describe("pestaña de Carga pedida por la dirección (ADR 0142)", () => {
  it("Bases es la pestaña por omisión y la primera del catálogo", () => {
    expect(PESTANA_CARGA_POR_DEFECTO).toBe("bases");
    expect(PROCESAMIENTO_PESTANAS.carga[0].key).toBe(PESTANA_CARGA_POR_DEFECTO);
    for (const pedida of [null, undefined, "", "  ", "insumos", "base", "pestana-inventada"]) {
      expect(resolverPestanaCarga(pedida, CON_EQUIVALENCIAS)).toEqual({ pestana: "bases", noDisponible: null });
    }
  });

  it("cada clave canónica abre su pestaña", () => {
    for (const clave of CON_EQUIVALENCIAS) {
      expect(resolverPestanaCarga(clave, CON_EQUIVALENCIAS)).toEqual({ pestana: clave, noDisponible: null });
    }
  });

  it.each([
    ["plan", "bases"],
    ["fuentes", "bases"],
    ["estructura", "formulario"],
    ["datos", "respuestas"],
  ] as const)("la clave vieja `%s` abre %s", (vieja, nueva) => {
    expect(ALIAS_PESTANAS_CARGA[vieja]).toBe(nueva);
    expect(clavePedidaCarga(vieja)).toBe(nueva);
    expect(resolverPestanaCarga(vieja, SIN_EQUIVALENCIAS)).toEqual({ pestana: nueva, noDisponible: null });
  });

  it("ningún alias apunta a una pestaña que el catálogo no tenga", () => {
    const claves = new Set<string>(PROCESAMIENTO_PESTANAS.carga.map((tab) => tab.key));
    for (const destino of Object.values(ALIAS_PESTANAS_CARGA)) expect(claves.has(destino)).toBe(true);
    for (const vieja of Object.keys(ALIAS_PESTANAS_CARGA)) expect(claves.has(vieja)).toBe(false);
  });

  it("Equivalencias pedida en un estudio sin equivalencias cae en Bases y lo dice", () => {
    expect(resolverPestanaCarga("equivalencias", SIN_EQUIVALENCIAS)).toEqual({
      pestana: "bases",
      noDisponible: "equivalencias",
    });
    expect(resolverPestanaCarga("equivalencias", CON_EQUIVALENCIAS)).toEqual({
      pestana: "equivalencias",
      noDisponible: null,
    });
    expect(avisoPestanaNoDisponible("equivalencias")).toEqual({
      mensaje: '"Equivalencias" no está en este estudio',
      detalle: "Se ofrece cuando el estudio tiene dos o más bases con formularios distintos.",
    });
  });

  it("el panel Variables de la base abre la pestaña Variables, sea cual sea la pestaña", () => {
    expect(pestanaPedidaDeDireccion({ pestana: "fuentes", panel: "variables-base" })).toBe("variables");
    expect(pestanaPedidaDeDireccion({ pestana: null, panel: "variables-base" })).toBe("variables");
    expect(pestanaPedidaDeDireccion({ pestana: "revision", panel: "emparejamiento" })).toBe("revision");
    expect(pestanaPedidaDeDireccion({ pestana: null, panel: null })).toBeNull();
  });
});
